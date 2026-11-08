from fastapi import APIRouter, HTTPException, BackgroundTasks
import datetime
import uuid
from server.database import db, mongo_serialize
from server.schemas.models import ChatRequest, SessionCreate
from server.services.ai import call_huggingface, search_rag, get_qa_pipeline

router = APIRouter(prefix="/api")

@router.get("/sessions")
def get_sessions():
    try:
        sessions = list(db["sessions"].find())
        sessions = sorted(sessions, key=lambda x: x.get('created_at', ''), reverse=True)
        return [mongo_serialize(s) for s in sessions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
def create_session(session_data: SessionCreate):
    try:
        title = session_data.title or f"New Chat Session {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"
        session_id = str(uuid.uuid4())
        session = {
            "_id": session_id,
            "title": title,
            "created_at": datetime.datetime.now().isoformat()
        }
        db["sessions"].insert_one(session)
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    try:
        db["sessions"].delete_one({"_id": session_id})
        db["messages"].delete_many({"session_id": session_id})
        return {"status": "success", "message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str):
    try:
        messages = list(db["messages"].find({"session_id": session_id}))
        messages = sorted(messages, key=lambda x: x.get('timestamp', ''))
        return [mongo_serialize(m) for m in messages]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
def chat(payload: ChatRequest):
    try:
        session_id = payload.session_id
        user_message = payload.message
        hf_token = payload.hf_token
        model_name = payload.model_name
        use_rag = payload.use_rag
        
        # Save User Message to MongoDB
        user_msg_doc = {
            "session_id": session_id,
            "sender": "user",
            "text": user_message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        db["messages"].insert_one(user_msg_doc)
        
        # Retrieve context if using RAG
        context = ""
        retrieved_chunks = []
        if use_rag:
            retrieved_chunks = search_rag(user_message, k=4)
            if retrieved_chunks:
                context = "\n\n".join([f"Source: {c['source']}\nContent: {c['text']}" for c in retrieved_chunks])
                
        # Retrieve recent history (last 6 messages)
        history_msgs = list(db["messages"].find({"session_id": session_id}))
        history_msgs = sorted(history_msgs, key=lambda x: x.get('timestamp', ''))[:-1]  # Exclude user's current message
        
        history_formatted = []
        for hm in history_msgs:
            role = "user" if hm["sender"] == "user" else "assistant"
            history_formatted.append({"role": role, "content": hm["text"]})
            
        response_text = ""
        system_prompt = (
            "You are a helpful and expert Placement Cell Chatbot for Apex College.\n"
            "Your job is to assist students and placement coordinators with their inquiries regarding "
            "placement guidelines, company recruitment schedules, statistics, eligibility criteria, and general prep.\n\n"
        )
        if context:
            system_prompt += (
                f"Use the following verified context from the college databases and uploaded documents to construct your answer.\n"
                f"Be factual, clear, and structured in your explanations.\n"
                f"--- CONTEXT ---\n{context}\n----------------\n\n"
                f"If the answer is not contained in the context above, utilize your general knowledge but mention "
                f"that it is standard placement advice rather than college-specific regulation."
            )
        else:
            system_prompt += "Address the student's general placement preparation inquiries, resume questions, or coding interview tips."
            
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history_formatted)
        messages.append({"role": "user", "content": user_message})
        
        # Common interview questions fallback
        common_interview_questions = {
            "handling disagreements": (
                "My approach to handling disagreements within a team involves active listening and open communication. "
                "I seek to understand the other person's perspective, find common ground, and focus on collaborative problem-solving "
                "rather than assigning blame. If necessary, I involve a neutral third party to mediate."
            ),
            "tell me about yourself": (
                "When answering 'Tell me about yourself', focus on your professional journey. Start with your current role, "
                "highlight key achievements and skills relevant to the position you're applying for, and briefly mention your future goals. "
                "Keep it concise and tailored to the job description."
            ),
            "your strengths": (
                "When discussing strengths, choose attributes that align with the job requirements. Provide specific examples of how "
                "you've demonstrated these strengths in past experiences. Common strengths include problem-solving, adaptability, "
                "teamwork, and leadership."
            ),
            "your weaknesses": (
                "When discussing weaknesses, choose a real but manageable area for improvement. More importantly, explain the proactive "
                "steps you are taking to overcome it. This demonstrates self-awareness and a commitment to personal growth."
            ),
            "where do you see yourself": (
                "When answering this, show ambition but remain realistic. Connect your goals to the company's trajectory and the role "
                "you're applying for. Express a desire to learn, grow, and take on more responsibility over time."
            ),
            "tight deadline": (
                "When working under a tight deadline, I focus on prioritization and time management. I break the project into smaller, manageable tasks, "
                "identify the critical path, and communicate clearly with stakeholders to ensure alignment and manage expectations."
            ),
            "complex technical concept": (
                "To explain a complex technical concept to a non-technical person, I avoid jargon and use relatable analogies. "
                "I focus on the 'why' and 'what' rather than the deep technical 'how', ensuring they understand the business value and impact."
            ),
            "prioritize your tasks": (
                "When I have multiple urgent deadlines, I prioritize tasks using a framework like the Eisenhower Matrix, focusing on what is both urgent and important. "
                "I also assess the impact and dependencies of each task, and if needed, I communicate with my manager to realign expectations."
            ),
            "project that failed": (
                "I once worked on a project that didn't meet its objectives due to scope creep. I learned the importance of clear requirements "
                "and regular check-ins. Since then, I always ensure we have a well-defined scope and establish clear milestones from the beginning."
            )
        }
        
        direct_answer = None
        user_msg_lower = user_message.lower()
        for key, ans in common_interview_questions.items():
            if key in user_msg_lower:
                direct_answer = ans
                break

        used_local = False
        hf_error_banner = ""
        
        if direct_answer:
            response_text = direct_answer
        else:
            from server.config import SERVER_HF_TOKEN
            # Try Hugging Face API if token is provided or backend has a token
            if hf_token or SERVER_HF_TOKEN:
                try:
                    print(f"[Chat Router] Calling Hugging Face with model {model_name}...")
                    response_text = call_huggingface(messages, token=hf_token, model=model_name, max_tokens=250)
                except Exception as e:
                    error_str = str(e)
                    print(f"[Chat Router] HF Call failed: {error_str}")
                    
                    is_permission_error = '403' in error_str or 'permission' in error_str.lower()
                    is_auth_error = '401' in error_str or 'unauthorized' in error_str.lower()
                    
                    if is_permission_error:
                        hf_error_banner = (
                            "> ⚠️ *Your Hugging Face token lacks the **\"Make calls to Inference Providers\"** permission. "
                            "[Fix it here](https://huggingface.co/settings/tokens). Answering from local documents in the meantime.*\n\n"
                        )
                        used_local = True
                    elif is_auth_error:
                        hf_error_banner = (
                            "> ⚠️ *Your Hugging Face token is invalid or expired (401 Unauthorized). "
                            "[Fix it here](https://huggingface.co/settings/tokens). Answering from local documents in the meantime.*\n\n"
                        )
                        used_local = True
                    else:
                        used_local = True
            else:
                used_local = True
            
        if used_local and not response_text:
            try:
                # Greeting and Simple Conversational Rules
                greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "howdy"]
                clean_query = "".join(c for c in user_message.lower() if c.isalnum() or c.isspace()).strip()
                
                if clean_query in greetings or any(clean_query.startswith(g + " ") for g in greetings):
                    response_text = (
                        "Hello! I am your Placement Cell Assistant. How can I help you today?\n\n"
                        "You can ask me about:\n"
                        "- Eligibility criteria for specific companies (e.g., *'What CGPA does Microsoft require?'*)\n"
                        "- Placement policies (e.g., *'Can I apply after getting an offer?'*)\n"
                        "- Resume and interview preparation tips"
                    )
                elif clean_query in ["thanks", "thank you", "thank you so much", "perfect thanks"]:
                    response_text = "You're very welcome! Let me know if you have any other questions about the placement process. Good luck!"
                elif clean_query in ["bye", "goodbye", "exit"]:
                    response_text = "Goodbye! Feel free to reach back out if you need further assistance with your placement preparation."
                elif not context:
                    try:
                        from server.services.ai import get_generative_pipeline
                        gen_pipe = get_generative_pipeline()
                        prompt = f"Answer the following question clearly and concisely: {user_message}"
                        out = gen_pipe(prompt, max_new_tokens=50, do_sample=True, temperature=0.7)
                        response_text = out[0]['generated_text'] + "\n\n*(This answer was generated locally using a fallback model)*"
                    except Exception as e:
                        print(f"Generative pipeline error: {e}")
                        response_text = (
                            "I'm sorry, but I am currently offline and my local generation model couldn't be loaded. "
                            "However, I can still help you check eligibility in the 'Eligibility Checker' tab "
                            "or you can check the standard FAQs directly!"
                        )
                else:
                    # Context matching keyword extractors
                    parsed_answer = None
                    if retrieved_chunks:
                        first_chunk = retrieved_chunks[0]['text']
                        source_label = retrieved_chunks[0].get('source', 'Placement Cell Database')
                        
                        lines = first_chunk.strip().split('\n')
                        data = {}
                        for line in lines:
                            if ':' in line:
                                key, val = line.split(':', 1)
                                data[key.strip().lower()] = val.strip()
                                
                        company_name = data.get('company') or data.get('company name')
                        if company_name:
                            msg_lower = user_message.lower()
                            if any(term in msg_lower for term in ['cgpa', 'gpa', 'grade point', 'pointer']):
                                cgpa_req = data.get('cgpa requirement') or data.get('cgpa')
                                if cgpa_req:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"**{company_name}** requires a minimum CGPA of **{cgpa_req}**.\n"
                                    )
                            elif any(term in msg_lower for term in ['package', 'salary', 'ctc', 'lpa', 'pay']):
                                package = data.get('package')
                                if package:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"The package offered by **{company_name}** is **{package}**.\n"
                                    )
                            elif any(term in msg_lower for term in ['branch', 'branches', 'stream', 'streams', 'eligible branch']):
                                branches = data.get('branches allowed') or data.get('branches')
                                if branches:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"The allowed branches for **{company_name}** are **{branches}**.\n"
                                    )
                            elif any(term in msg_lower for term in ['backlog', 'backlogs', 'active backlogs']):
                                backlogs = data.get('active backlogs allowed') or data.get('backlogs_allowed') or data.get('backlogs')
                                if backlogs is not None:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"The maximum active backlogs allowed for **{company_name}** is **{backlogs}**.\n"
                                    )
                            elif any(term in msg_lower for term in ['role', 'roles', 'profile', 'job role']):
                                role = data.get('role') or data.get('job role')
                                if role:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"The role offered by **{company_name}** is **{role}**.\n"
                                    )
                            elif any(term in msg_lower for term in ['process', 'rounds', 'selection process']):
                                process = data.get('recruitment process')
                                if process:
                                    parsed_answer = (
                                        f"According to the placement cell documents (**{source_label}**):\n\n"
                                        f"The recruitment process for **{company_name}** involves:\n\n"
                                        f"{process}\n"
                                    )

                    if parsed_answer:
                        response_text = parsed_answer
                    else:
                        qa = get_qa_pipeline()
                        qa_context = " ".join([c['text'] for c in retrieved_chunks])
                        res = qa(question=user_message, context=qa_context)
                        answer = res.get('answer', '').strip()
                        score = res.get('score', 0)
                        
                        if answer and score > 0.05:
                            source_label = retrieved_chunks[0]['source'] if retrieved_chunks else 'Database'
                            response_text = (
                                f"According to the placement cell documents:\n\n"
                                f"**{answer}**\n\n"
                                f"📄 *Source: {source_label}*\n"
                            )
                        else:
                            snippet = retrieved_chunks[0]['text'][:300] + ('...' if len(retrieved_chunks[0]['text']) > 300 else '')
                            source_label = retrieved_chunks[0]['source']
                            response_text = (
                                "I found relevant documents but couldn't extract a precise answer.\n\n"
                                f"**Most relevant excerpt** (from *{source_label}*):\n\n"
                                f"> {snippet}\n"
                            )
            except Exception as le:
                response_text = f"An error occurred while answering locally: {str(le)}."

        if hf_error_banner:
            response_text = hf_error_banner + response_text
            
        # Save Bot Response to MongoDB
        bot_msg_doc = {
            "session_id": session_id,
            "sender": "bot",
            "text": response_text,
            "timestamp": datetime.datetime.now().isoformat()
        }
        db["messages"].insert_one(bot_msg_doc)
        
        # Update session title if default
        session = db["sessions"].find_one({"_id": session_id})
        if session and session.get("title", "").startswith("New Chat Session"):
            new_title = user_message[:40] + ("..." if len(user_message) > 40 else "")
            db["sessions"].update_one({"_id": session_id}, {"$set": {"title": new_title}})
            
        return {
            "message": response_text,
            "sender": "bot",
            "retrieved_sources": [c['source'] for c in retrieved_chunks] if use_rag else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
