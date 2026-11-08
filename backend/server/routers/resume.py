from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
import datetime
import uuid
import json
import re
from typing import Optional
from server.database import db, mongo_serialize
from server.schemas.models import ResumeChatRequest, ResumeData, ResumeOptimizeRequest, ResumeImproveRequest
from server.services.ai import call_huggingface
from server.services.resume_gen import generate_pdf, generate_docx, extract_text_from_file

router = APIRouter(prefix="/api/resume")

# Default Resume Schema template
DEFAULT_RESUME = {
    "personal_info": {"name": "", "email": "", "phone": "", "linkedin": "", "location": "", "website": ""},
    "education": [],
    "skills": {
        "programming_languages": [],
        "frameworks": [],
        "databases": [],
        "tools": [],
        "other": []
    },
    "experience": [],
    "projects": [],
    "certifications": [],
    "achievements": [],
    "summary": "",
    "optional_sections": {
        "publications": False,
        "leadership": False,
        "volunteer": False,
        "extracurricular": False,
        "languages": False,
        "interests": False
    }
}

# Helper to clean LLM markdown output and extract JSON
def extract_json_from_llm(text: str) -> dict:
    try:
        # Strip potential markdown formatting blocks (e.g. ```json ... ```)
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except Exception as e:
        print(f"[Resume Router] JSON parsing failed: {e}. Text: {text}")
        return {}

# Helper to find missing resume fields
def check_missing_fields(data: dict) -> list:
    missing = []
    p_info = data.get("personal_info", {})
    if not p_info.get("name"): missing.append("Full Name")
    if not p_info.get("email") or not p_info.get("phone"): missing.append("Contact Information (Email/Phone)")
    if not data.get("education"): missing.append("Education details")
    if not data.get("skills"): missing.append("Skills list")
    if not data.get("experience") and not data.get("projects"): missing.append("Projects or Work Experience")
    return missing

# Conversational helper questions based on missing fields
def get_followup_question(missing_fields: list) -> str:
    if "Full Name" in missing_fields:
        return "Let's start building your resume! What is your full name?"
    elif "Contact Information (Email/Phone)" in missing_fields:
        return "Could you provide your email address and phone number so recruiters can contact you?"
    elif "Education details" in missing_fields:
        return "Got it. What are your educational credentials? Please share your degree, college name, graduation year, and CGPA/GPA."
    elif "Skills list" in missing_fields:
        return "What are your core technical skills, programming languages, or tools? (e.g., Python, React, SQL)"
    elif "Projects or Work Experience" in missing_fields:
        return "Excellent. Tell me about your key academic projects or any internships/work experience. Include your role and what technologies you used."
    else:
        return "I have all the essential sections! Would you like to add an optional brief professional summary or any professional certifications?"

# -------------------------------------------------------------
# 1. Builder Sessions APIs
# -------------------------------------------------------------
@router.post("/builder/session")
def create_resume_session():
    try:
        session_id = str(uuid.uuid4())
        session = {
            "_id": session_id,
            "resume_data": DEFAULT_RESUME.copy(),
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
            "step": 0, # Used for local step-by-step state machine fallback
            "messages": [
                {
                    "sender": "bot",
                    "text": "Hello! I am your AI Resume Builder. I will guide you step-by-step to create an ATS-friendly resume. Let's begin. What is your full name?",
                    "timestamp": datetime.datetime.now().isoformat()
                }
            ]
        }
        db["resume_sessions"].insert_one(session)
        return {"session_id": session_id, "resume_data": DEFAULT_RESUME, "messages": session["messages"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/builder/session/{session_id}")
def get_resume_session(session_id: str):
    try:
        session = db["resume_sessions"].find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Resume session not found")
        return mongo_serialize(session)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/builder/session/{session_id}")
def update_resume_data(session_id: str, payload: ResumeData):
    try:
        session = db["resume_sessions"].find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Resume session not found")
            
        db["resume_sessions"].update_one(
            {"_id": session_id},
            {
                "$set": {
                    "resume_data": payload.model_dump(),
                    "updated_at": datetime.datetime.now().isoformat()
                }
            }
        )
        return {"status": "success", "message": "Resume data updated successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 2. Conversational Resume Builder Bot
# -------------------------------------------------------------
@router.post("/builder/chat")
def resume_builder_chat(payload: ResumeChatRequest):
    try:
        session_id = payload.session_id
        user_message = payload.message
        hf_token = payload.hf_token
        model_name = payload.model_name
        
        session = db["resume_sessions"].find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        current_data = session.get("resume_data", DEFAULT_RESUME.copy())
        step = session.get("step", 0)
        
        # Save user message to history
        db["resume_sessions"].update_one(
            {"_id": session_id},
            {"$push": {"messages": {
                "sender": "user",
                "text": user_message,
                "timestamp": datetime.datetime.now().isoformat()
            }}}
        )
        
        extracted_data = {}
        assistant_reply = ""
        used_llm = False
        
        # Method A: Use Gemini LLM for information extraction
        import os
        gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                # Use gemini-1.5-flash or gemini-pro for text tasks
                model = genai.GenerativeModel("gemini-1.5-flash")
                
                system_prompt = (
                    "You are an expert AI Resume Assistant. Your task is to extract resume details from the user's chat input "
                    "and match them to our standard JSON schema. Merge the new information into the schema.\n\n"
                    "SCHEMA:\n"
                    "{\n"
                    "  \"personal_info\": {\"name\": \"\", \"email\": \"\", \"phone\": \"\", \"linkedin\": \"\", \"location\": \"\", \"website\": \"\"},\n"
                    "  \"education\": [{\"degree\": \"\", \"field_of_study\": \"\", \"school\": \"\", \"graduation_year\": \"\", \"gpa\": \"\"}],\n"
                    "  \"skills\": [\"skill1\", \"skill2\"],\n"
                    "  \"experience\": [{\"role\": \"\", \"company\": \"\", \"location\": \"\", \"duration\": \"\", \"description\": \"\"}],\n"
                    "  \"projects\": [{\"title\": \"\", \"technologies\": [\"tech1\"], \"description\": \"\", \"link\": \"\"}],\n"
                    "  \"certifications\": [\"cert1\"],\n"
                    "  \"summary\": \"\"\n"
                    "}\n\n"
                    f"CURRENT RESUME DATA:\n{json.dumps(current_data)}\n\n"
                    f"USER INPUT:\n\"{user_message}\"\n\n"
                    "INSTRUCTIONS:\n"
                    "1. Extract new values and merge them into the CURRENT RESUME DATA.\n"
                    "2. Output the final, merged resume JSON. Do not delete existing fields unless the user corrects them.\n"
                    "3. Format skills as a list of strings. Extract technologies for projects as lists of strings.\n"
                    "4. Add a key called \"assistant_comment\" at the root of the JSON that contains a friendly, brief conversational reply "
                    "acknowledging what you extracted and prompting for missing fields.\n"
                    "5. Output ONLY a valid JSON structure. No markdown formatting like ```json or helper comments outside the JSON."
                )
                
                print("[Resume Builder] Calling Gemini API for extraction...")
                response = model.generate_content(system_prompt)
                extracted_json = extract_json_from_llm(response.text)
                
                if extracted_json:
                    assistant_reply = extracted_json.pop("assistant_comment", "")
                    # Overwrite/merge extracted fields
                    for k in DEFAULT_RESUME.keys():
                        if k in extracted_json:
                            current_data[k] = extracted_json[k]
                    used_llm = True
            except Exception as e:
                print(f"[Resume Builder] Gemini Extraction failed: {e}. Falling back to step state-machine.")
                
        # Method B: State-Machine Fallback if LLM fails or token is missing
        if not used_llm:
            # Step-by-step state assignment
            if step == 0:
                current_data["personal_info"]["name"] = user_message.strip()
                assistant_reply = "Nice to meet you! What is your email address and phone number?"
                step = 1
            elif step == 1:
                # Basic email/phone parsing
                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', user_message)
                phone_match = re.search(r'\+?\d[\d\-\s\(\)]{8,14}\d', user_message)
                if email_match:
                    current_data["personal_info"]["email"] = email_match.group(0)
                if phone_match:
                    current_data["personal_info"]["phone"] = phone_match.group(0)
                # If regex fails, save whole string to location/website or placeholder
                if not email_match and not phone_match:
                    current_data["personal_info"]["phone"] = user_message.strip()
                    
                assistant_reply = "Got it. Tell me about your education. What is your degree, major, college, graduation year, and GPA?"
                step = 2
            elif step == 2:
                # Basic parsing or save raw as a single block
                current_data["education"] = [{
                    "degree": "Degree/Details",
                    "field_of_study": "",
                    "school": user_message.strip(),
                    "graduation_year": "2026",
                    "gpa": "TBD"
                }]
                assistant_reply = "Noted. What are your technical skills? (e.g. Java, Python, HTML, Git)"
                step = 3
            elif step == 3:
                skills = [s.strip() for s in user_message.split(",") if s.strip()]
                current_data["skills"] = skills
                assistant_reply = "Excellent. Do you have any projects or internships? Please list them with details."
                step = 4
            elif step == 4:
                current_data["projects"] = [{
                    "title": "Academic Project",
                    "technologies": current_data["skills"][:3] if current_data["skills"] else [],
                    "description": user_message.strip(),
                    "link": ""
                }]
                assistant_reply = "Perfect! Any certifications or accomplishments you would like to showcase?"
                step = 5
            elif step == 5:
                current_data["certifications"] = [user_message.strip()]
                assistant_reply = "Thank you! I have compiled your details. You can review and refine your resume on the right, or add a summary if you like."
                step = 6
            else:
                current_data["summary"] = user_message.strip()
                assistant_reply = "I've added that to your summary. Your resume is ready to export!"
                
        # If LLM ran, calculate conversational follow-up if comment is empty
        if used_llm and not assistant_reply:
            missing = check_missing_fields(current_data)
            assistant_reply = get_followup_question(missing)
            
        # Update session with new data and messages
        db["resume_sessions"].update_one(
            {"_id": session_id},
            {
                "$set": {
                    "resume_data": current_data,
                    "step": step,
                    "updated_at": datetime.datetime.now().isoformat()
                },
                "$push": {"messages": {
                    "sender": "bot",
                    "text": assistant_reply,
                    "timestamp": datetime.datetime.now().isoformat()
                }}
            }
        )
        
        return {
            "message": assistant_reply,
            "sender": "bot",
            "resume_data": current_data
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 3. Export Endpoints (PDF / DOCX)
# -------------------------------------------------------------
@router.get("/export/{session_id}/pdf")
def export_pdf(session_id: str):
    try:
        session = db["resume_sessions"].find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Resume session not found")
            
        resume_data = session.get("resume_data", DEFAULT_RESUME)
        pdf_bytes = generate_pdf(resume_data)
        
        filename = f"resume_{session_id[:8]}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export/{session_id}/docx")
def export_docx(session_id: str):
    try:
        session = db["resume_sessions"].find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Resume session not found")
            
        resume_data = session.get("resume_data", DEFAULT_RESUME)
        docx_bytes = generate_docx(resume_data)
        
        filename = f"resume_{session_id[:8]}.docx"
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 4. Resume Analyzer & ATS Scorer
# -------------------------------------------------------------
@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    target_company: Optional[str] = Form(None),
    hf_token: Optional[str] = Form(None),
    model_name: Optional[str] = Form(None)
):
    try:
        # Extract resume text
        file_bytes = await file.read()
        resume_text = extract_text_from_file(file_bytes, file.filename)
        
        # 1. Fallback to company role/description if no job_description is provided but target_company is selected
        if target_company and not job_description:
            comp_details = db["companies"].find_one({"name": target_company})
            if comp_details:
                job_description = f"{comp_details.get('role', '')} {comp_details.get('description', '')}"

        # 2. Local Rule-based Audit
        sections_found = []
        lower_text = resume_text.lower()
        
        if any(h in lower_text for h in ["education", "academic", "qualification"]): sections_found.append("Education")
        if any(h in lower_text for h in ["experience", "employment", "history", "work"]): sections_found.append("Experience")
        if any(h in lower_text for h in ["project", "academic project", "personal project"]): sections_found.append("Projects")
        if any(h in lower_text for h in ["skills", "expertise", "technologies"]): sections_found.append("Skills")
        if any(h in lower_text for h in ["certification", "achievement", "award"]): sections_found.append("Certifications")
        
        email_present = bool(re.search(r'[\w\.-]+@[\w\.-]+\.\w+', resume_text))
        phone_present = bool(re.search(r'\+?\d[\d\-\s\(\)]{8,14}\d', resume_text))
        linkedin_present = "linkedin.com" in lower_text
        
        word_count = len(resume_text.split())
        page_warning = ""
        if word_count > 1000:
            page_warning = "Resume might be too long (exceeds 1000 words). Try to fit it on one page."
        elif word_count < 200:
            page_warning = "Resume is very short. Add more detailed descriptions of your skills and project contributions."
            
        # Standard structural scoring (Max 100)
        structural_score = 0
        if "Education" in sections_found: structural_score += 15
        if "Experience" in sections_found: structural_score += 20
        if "Projects" in sections_found: structural_score += 20
        if "Skills" in sections_found: structural_score += 15
        if email_present: structural_score += 10
        if phone_present: structural_score += 10
        if linkedin_present: structural_score += 10
        
        local_keywords_matching = []
        local_keywords_missing = []
        suggestions = []
        
        # Compile local default suggestions
        if "Experience" not in sections_found:
            suggestions.append("Add a Work Experience section to list internships, part-time jobs, or freelance work.")
        if "Projects" not in sections_found:
            suggestions.append("Add a Projects section to highlight academic or personal coding work.")
        if not linkedin_present:
            suggestions.append("Add a link to your LinkedIn profile in the contact header.")
        if not phone_present or not email_present:
            suggestions.append("Ensure your contact email and phone number are visible at the top.")
        if page_warning:
            suggestions.append(page_warning)
            
        # Parse job description keywords if provided
        has_jd = False
        target_keywords = set()
        if job_description and job_description.strip():
            has_jd = True
            # Simple word match using token overlap
            jd_words = set(re.findall(r'\b[a-zA-Z]{3,15}\b', job_description.lower()))
            resume_words = set(re.findall(r'\b[a-zA-Z]{3,15}\b', resume_text.lower()))
            
            # Common tech/business keywords to extract specifically
            tech_dict = {
                "python", "javascript", "java", "react", "node", "sql", "mongodb", "aws", "docker", "git", 
                "c++", "html", "css", "django", "flask", "fastapi", "spring", "kubernetes", "machine learning", 
                "data structures", "algorithms", "c#", "rest api", "typescript", "cloud", "agile", "analytics",
                "consulting", "excel", "communication", "management", "testing", "devops", "security"
            }
            
            target_keywords = jd_words.intersection(tech_dict)
            if not target_keywords: # Fallback to standard high frequency words
                stopwords = {"with", "that", "this", "from", "your", "will", "have", "about", "their", "there", "would"}
                target_keywords = {w for w in jd_words if len(w) > 4 and w not in stopwords}
                
            local_keywords_matching = list(target_keywords.intersection(resume_words))
            local_keywords_missing = list(target_keywords.difference(resume_words))[:8]
            
            if local_keywords_missing:
                suggestions.append(f"Add missing target keywords to your skills or bullet points: {', '.join(local_keywords_missing[:4])}")
                
        # Calculate local rule-based score
        if has_jd and target_keywords:
            match_count = len(local_keywords_matching)
            total_count = len(target_keywords)
            keyword_score = (match_count / total_count) * 100
            # Final score is 40% structural health and 60% keyword match fit
            base_score = int((structural_score * 0.4) + (keyword_score * 0.6))
        else:
            # Without target keywords, score represents structural completeness but capped at 75
            base_score = int(structural_score * 0.75)
            if not has_jd:
                suggestions.append("Paste a target Job Description (JD) or select a placement company to calculate a matching score against job requirements.")

        # Dynamically compile list of strengths
        strengths = []
        if email_present and phone_present:
            strengths.append("Standard contact credentials (Email & Phone) are present.")
        if linkedin_present:
            strengths.append("LinkedIn profile link detected, providing direct access to your online portfolio.")
        if "Education" in sections_found:
            strengths.append("Education section is clearly defined with academic achievements.")
        if "Experience" in sections_found:
            strengths.append("Work Experience section is included to showcase relevant practical roles.")
        if "Projects" in sections_found:
            strengths.append("Projects section is present to highlight technical contributions.")
        if "Skills" in sections_found:
            strengths.append("Core skills and technology list is clearly categorized.")
        if 200 <= word_count <= 1000:
            strengths.append(f"Optimal resume word count ({word_count} words) for a single page layout.")
        if not strengths:
            strengths = ["Resume formatting structure is clean."]

        from server.config import SERVER_HF_TOKEN
        # 3. Call LLM for richer Analysis if HF Token is configured
        if hf_token or SERVER_HF_TOKEN:
            try:
                prompt = (
                    "You are an ATS (Applicant Tracking System) Analyzer. Analyze this resume text and target details, and output a detailed report.\n\n"
                    f"RESUME TEXT:\n{resume_text}\n\n"
                    f"TARGET JOB DESCRIPTION:\n{job_description or 'Software Engineer Intern'}\n\n"
                    f"TARGET COMPANY:\n{target_company or 'Any Recruiter'}\n\n"
                    "Provide your evaluation in a JSON structure containing:\n"
                    "1. \"ats_score\": an integer between 0 and 100 (weighted heavily on matching keywords, formatting, structure, and metrics-oriented bullet points).\n"
                    "2. \"matching_keywords\": list of matching technology keywords.\n"
                    "3. \"missing_keywords\": list of critical keywords that are missing from the resume but present in the JD.\n"
                    "4. \"strengths\": list of 3-4 key strengths identified (e.g. strong projects, complete section headers).\n"
                    "5. \"improvements\": list of 3-4 actionable tips to increase ATS match rates (specifically rewriting weak bullets using the STAR/XYZ format: Accomplished [X] as measured by [Y], by doing [Z]).\n"
                    "6. \"company_fit_analysis\": a brief paragraph analyzing the resume against the targeted company and its criteria.\n\n"
                    "Output ONLY the raw JSON object. Do not wrap in markdown tags like ```json."
                )
                
                messages = [
                    {"role": "system", "content": "You are a professional hiring manager that evaluates resumes as JSON."},
                    {"role": "user", "content": prompt}
                ]
                
                print("[Resume Analyzer] Calling HF Inference...")
                llm_response = call_huggingface(messages, token=hf_token, model=model_name, max_tokens=1000)
                llm_json = extract_json_from_llm(llm_response)
                
                if llm_json:
                    return {
                        "ats_score": llm_json.get("ats_score", base_score),
                        "matching_keywords": llm_json.get("matching_keywords", local_keywords_matching),
                        "missing_keywords": llm_json.get("missing_keywords", local_keywords_missing),
                        "strengths": llm_json.get("strengths", strengths),
                        "improvements": llm_json.get("improvements", suggestions),
                        "company_fit_analysis": llm_json.get("company_fit_analysis", f"Analyzed against {target_company or 'recommenders'}. Adjust your description to include company culture goals.")
                    }
            except Exception as le:
                print(f"[Resume Analyzer] LLM Analysis failed: {le}. Falling back to rule-based.")
                
        # Return fallback local audit results
        return {
            "ats_score": min(base_score, 100),
            "matching_keywords": local_keywords_matching,
            "missing_keywords": local_keywords_missing,
            "strengths": strengths,
            "improvements": suggestions if suggestions else ["Your resume structure matches standard guidelines! Add specific project bullet points."],
            "company_fit_analysis": "Local Analysis: Configure a Hugging Face API key in Settings to receive advanced tailored matching and fit metrics."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 5. Company Optimization Recommendations
# -------------------------------------------------------------
@router.post("/optimize")
def optimize_resume(payload: ResumeOptimizeRequest):
    try:
        resume_data = payload.resume_data.model_dump()
        company_name = payload.company_name
        role_name = payload.role_name or "Software Engineer"
        hf_token = payload.hf_token
        model_name = payload.model_name
        
        # Pull company details from DB if available
        comp_details = db["companies"].find_one({"name": company_name})
        comp_criteria = ""
        if comp_details:
            comp_criteria = (
                f"Role: {comp_details.get('role')}\n"
                f"Description: {comp_details.get('description')}\n"
                f"Recruitment Process: {comp_details.get('recruitment_process')}"
            )
            
        system_prompt = (
            f"You are a Senior Placement Coordinator. Help optimize the user's resume for a drive with {company_name} for the position of {role_name}.\n\n"
            f"TARGET COMPANY REQUIREMENTS:\n{comp_criteria or 'Standard placement standards, focus on data structures, OOPS, and teamwork.'}\n\n"
            f"USER RESUME DATA:\n{json.dumps(resume_data)}\n\n"
            "Provide optimization suggestions in a JSON structure containing:\n"
            "1. \"summary_suggestion\": A rewritten, highly professional 2-3 sentence summary specifically tailored for this role.\n"
            f"2. \"skills_to_add\": 3-4 relevant skills that {company_name} values which should be showcased if the candidate possesses them.\n"
            "3. \"project_bullet_improvements\": A list of objects containing {\"original_project_title\": \"...\", \"suggested_bullet_rewrites\": [\"...\"]} "
            "showing how to rewrite project descriptions using quantitative metrics (e.g. Optimized database query speeds by 20% using indices).\n"
            "Output ONLY the raw JSON object. Do not wrap in markdown tags like ```json."
        )
        
        # Default fallback suggestions in case LLM is unconfigured/fails
        default_suggestions = {
            "summary_suggestion": f"Ambitious student seeking to leverage technical problem-solving capabilities in a challenging {role_name} position at {company_name}.",
            "skills_to_add": ["Data Structures", "Algorithms", "System Optimization", "Git Version Control"],
            "project_bullet_improvements": [
                {
                    "original_project_title": p.get("title", "Project"),
                    "suggested_bullet_rewrites": [
                        "Optimized runtime execution of core logic modules to improve overall performance.",
                        "Integrated REST APIs and streamlined database interactions to achieve responsive load times."
                    ]
                } for p in resume_data.get("projects", [])
            ]
        }
        from server.config import SERVER_HF_TOKEN
        if hf_token or SERVER_HF_TOKEN:
            try:
                messages = [
                    {"role": "system", "content": "You are a recruitment optimizer that outputs clean JSON."},
                    {"role": "user", "content": system_prompt}
                ]
                print(f"[Resume Optimizer] Calling HF for {company_name}...")
                llm_response = call_huggingface(messages, token=hf_token, model=model_name, max_tokens=1000)
                llm_json = extract_json_from_llm(llm_response)
                if llm_json:
                    return llm_json
            except Exception as le:
                print(f"[Resume Optimizer] LLM optimization failed: {le}. Using default suggestions.")
                
        return default_suggestions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-pdf")
def generate_resume_pdf(resume_data: ResumeData):
    try:
        import io
        from fastapi.responses import StreamingResponse
        from server.services.resume_gen import generate_pdf
        # Convert Pydantic model to dict
        data_dict = resume_data.model_dump()
        pdf_bytes = generate_pdf(data_dict)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=resume.pdf"}
        )
    except Exception as e:
        print(f"[Resume Router] Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/improve")
def improve_resume_text(req: ResumeImproveRequest):
    try:
        if not req.text.strip():
            return {"improved_text": ""}
            
        system_prompt = (
            "You are an expert AI Resume Assistant. Your job is to improve the following text provided by a student for their resume. "
            f"The context is: {req.context_type}. "
            "Make it professional, impactful, and grammatically correct. Use strong action verbs if it is a bullet point. "
            "CRITICAL: Do NOT fabricate or invent any experience, technologies, numbers, or achievements. Only improve what is given. "
            "Output ONLY the improved text, without quotes, explanations, or markdown formatting."
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.text}
        ]
        
        improved_text = call_huggingface(messages, token=req.hf_token, model=req.model_name, max_tokens=200)
        return {"improved_text": improved_text.strip()}
    except Exception as e:
        print(f"[Resume Router] Error improving text: {e}")
        raise HTTPException(status_code=500, detail=str(e))
