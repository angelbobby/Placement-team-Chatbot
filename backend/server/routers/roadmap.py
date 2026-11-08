from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from server.services.ai import call_huggingface

router = APIRouter(prefix="/api/roadmap", tags=["Roadmap"])

class RoadmapRequest(BaseModel):
    role: str
    hf_token: str = None
    model_name: str = None

def get_mock_roadmap(role: str):
    role_lower = role.lower()
    
    # Software / Web / App Developer
    if any(k in role_lower for k in ["software", "developer", "programmer", "engineer", "web", "frontend", "backend", "full stack", "fullstack", "app", "mobile", "devops", "cloud", "security"]):
        return [
            {
                "title": f"Phase 1: {role} Core Basics",
                "duration": "1-2 Months",
                "description": f"Master the fundamental languages, logic, and base tooling required for a {role}. Focus on syntax, Git version control, and command line tools.",
                "skills": ["Git & GitHub", "Command Line", "Programming Fundamentals", "Data Structures Basics"]
            },
            {
                "title": "Phase 2: Advanced DSA & Core Tech Stack",
                "duration": "2-3 Months",
                "description": "Deep dive into OOP concepts, advanced data structures, algorithms, and database systems (SQL/NoSQL) while learning the primary frameworks of your stack.",
                "skills": ["OOPs Concepts", "Data Structures & Algorithms", "SQL Databases", "Primary Frameworks"]
            },
            {
                "title": "Phase 3: Real-world Applications & APIs",
                "duration": "3-4 Months",
                "description": "Build modern backend APIs, integrate front-ends, manage state, and build multiple complex projects to showcase in your portfolio.",
                "skills": ["API Design (REST/GraphQL)", "State Management", "Authentication & Security", "Project Development"]
            },
            {
                "title": "Phase 4: System Design & Deployment",
                "duration": "1-2 Months",
                "description": "Learn cloud services, continuous integration/deployment (CI/CD), containers, caching, and fundamental scalability/system design paradigms.",
                "skills": ["System Design", "Docker", "CI/CD Pipelines", "AWS / Cloud Providers"]
            },
            {
                "title": "Phase 5: Placement Prep & Mock Audits",
                "duration": "1-2 Months",
                "description": "Solve algorithm challenges, practice mock technical and behavioral interviews, optimize your resume for ATS, and apply to recruiter pools.",
                "skills": ["LeetCode Challenges", "System Design Interviews", "Resume Optimization", "Mock Interviews"]
            }
        ]
        
    # Data Science / Machine Learning / AI
    elif any(k in role_lower for k in ["data", "science", "scientist", "machine", "learning", "ml", "ai", "artificial", "intelligence", "analyst"]):
        return [
            {
                "title": "Phase 1: Math Foundations & Programming",
                "duration": "1-2 Months",
                "description": "Build strong foundations in mathematical concepts (Linear Algebra, Calculus, Probability) and Python programming basics.",
                "skills": ["Python", "Linear Algebra", "Descriptive Statistics", "SQL Basics"]
            },
            {
                "title": "Phase 2: Data Wrangling & Analysis",
                "duration": "2-3 Months",
                "description": "Learn how to clean, manipulate, and analyze datasets. Master visualization libraries to draw intuitive business insights.",
                "skills": ["Pandas & NumPy", "Matplotlib & Seaborn", "Feature Engineering", "Data Cleaning"]
            },
            {
                "title": "Phase 3: Practical Machine Learning",
                "duration": "3-4 Months",
                "description": "Implement regression, classification, and clustering algorithms. Understand model evaluation and hyperparameter tuning.",
                "skills": ["Scikit-Learn", "Supervised Learning", "Unsupervised Learning", "Model Evaluation"]
            },
            {
                "title": "Phase 4: Deep Learning & AI Deployment",
                "duration": "2-3 Months",
                "description": "Explore Neural Networks, Natural Language Processing, or Computer Vision. Deploy models as web APIs or cloud services.",
                "skills": ["TensorFlow / PyTorch", "Deep Learning", "FastAPI / Flask", "Model Deployment"]
            },
            {
                "title": "Phase 5: Case Studies & Portfolio",
                "duration": "1-2 Months",
                "description": "Participate in Kaggle competitions, document your projects on GitHub, and prepare for core statistical and product interview questions.",
                "skills": ["Kaggle Competitions", "GitHub Portfolio", "Product Metrics", "Case Study Interviews"]
            }
        ]
        
    # Management / Product / Business
    elif any(k in role_lower for k in ["product", "manager", "pm", "business", "analyst", "consultant", "management"]):
        return [
            {
                "title": "Phase 1: Product Sense & Design",
                "duration": "1-2 Months",
                "description": "Develop user empathy, design thinking, and wireframing skills. Learn standard product lifecycle metrics.",
                "skills": ["Design Thinking", "Figma / Wireframing", "User Personas", "Product Lifecycle"]
            },
            {
                "title": "Phase 2: Analytical & Technical Skills",
                "duration": "2-3 Months",
                "description": "Learn to query data, run A/B tests, and understand architectural components of modern systems to collaborate with engineers.",
                "skills": ["SQL", "A/B Testing", "Product Metrics (KPIs)", "System Architectures"]
            },
            {
                "title": "Phase 3: Product Strategy & Business Models",
                "duration": "2-3 Months",
                "description": "Master competitor analysis, go-to-market strategies, business validation models, and agile scrum team structures.",
                "skills": ["Competitive Analysis", "GTM Strategy", "Agile / Scrum", "Market Research"]
            },
            {
                "title": "Phase 4: Estimation & Case Prep",
                "duration": "1-2 Months",
                "description": "Practice guesstimates, product design cases, and metrics/analytical interview questions. Build a strong portfolio of PRDs (Product Requirement Documents).",
                "skills": ["Guesstimates", "Product Design Cases", "PRD Writing", "Behavioral Interview Prep"]
            }
        ]
        
    # Generic template fallback
    else:
        return [
            {
                "title": f"Phase 1: Introduction to {role} Basics",
                "duration": "1-2 Months",
                "description": f"Focus on core terminology, essential software/tools, and basic workflow principles of a {role}.",
                "skills": ["Fundamental Terminology", "Core Software Tools", "Industry Overview", "Basic Concepts"]
            },
            {
                "title": "Phase 2: Intermediate Skills & Methodologies",
                "duration": "2-3 Months",
                "description": "Build on foundations by practicing standard industry workflows and mastering tools required for daily operations.",
                "skills": ["Intermediate Methodologies", "Workflow Optimization", "Tool Specialization", "Collaboration Platforms"]
            },
            {
                "title": "Phase 3: Advanced Projects & Execution",
                "duration": "3-4 Months",
                "description": "Apply your knowledge to realistic, end-to-end projects. Solve complex edge cases and collaborate on multidisciplinary challenges.",
                "skills": ["Complex Case Studies", "Independent Projects", "Troubleshooting & Debugging", "Quality Assurance"]
            },
            {
                "title": "Phase 4: Professional Networking & Job Market",
                "duration": "1-2 Months",
                "description": "Create a stellar resume, polish your LinkedIn profile, seek mentorship, and prepare for general industry screening processes.",
                "skills": ["Resume Writing", "Portfolio Presentation", "Interview Readiness", "Industry Networking"]
            }
        ]

@router.post("/generate")
def generate_roadmap(req: RoadmapRequest):
    if not req.role.strip():
        raise HTTPException(status_code=400, detail="Role cannot be empty")
        
    system_prompt = """You are an expert career advisor. Generate a detailed, step-by-step career roadmap for the requested role.
Your response MUST be a valid JSON array of objects. Do not include any explanation or markdown formatting outside the JSON array.
Format:
[
  {
    "title": "Phase 1: Basic Fundamentals",
    "duration": "1-2 Months",
    "description": "A short detailed description of what to focus on in this phase.",
    "skills": ["Skill 1", "Skill 2"]
  }
]"""

    user_prompt = f"Generate a career roadmap for the role: {req.role}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response_text = call_huggingface(
            messages=messages,
            token=req.hf_token,
            model=req.model_name,
            max_tokens=2000
        )
        
        # Clean the response to extract JSON (in case model added markdown backticks)
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        
        try:
            roadmap_data = json.loads(clean_text)
            return {"status": "success", "roadmap": roadmap_data}
        except json.JSONDecodeError:
            # Fallback if the AI didn't return proper JSON
            print("Failed to parse JSON. Raw response:", response_text)
            raise HTTPException(status_code=500, detail="AI did not return a valid JSON response. Try again.")
            
    except Exception as e:
        print(f"Hugging Face roadmap generation failed: {e}. Falling back to mock template...")
        mock_roadmap = get_mock_roadmap(req.role)
        return {
            "status": "success",
            "roadmap": mock_roadmap,
            "warning": "Hugging Face token unauthorized (401) or expired. Rendered local fallback career path."
        }
