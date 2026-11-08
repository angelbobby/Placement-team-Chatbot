from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Chat Schemas
class ChatRequest(BaseModel):
    session_id: str
    message: str
    hf_token: Optional[str] = None
    model_name: Optional[str] = None
    use_rag: Optional[bool] = True

class SessionCreate(BaseModel):
    title: Optional[str] = None

# Eligibility Schemas
class EligibilityRequest(BaseModel):
    cgpa: float = Field(..., ge=0.0, le=10.0)
    branch: str
    backlogs: int = Field(..., ge=0)

# Settings & Connection Test Schemas
class TestConnectionRequest(BaseModel):
    hf_token: str
    model_name: str

# Resume Builder Data Schemas
class PersonalInfo(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    linkedin: Optional[str] = ""
    location: Optional[str] = ""
    website: Optional[str] = ""

class EducationEntry(BaseModel):
    degree: Optional[str] = ""
    field_of_study: Optional[str] = ""
    school: Optional[str] = ""
    graduation_year: Optional[str] = ""
    gpa: Optional[str] = ""

class ExperienceEntry(BaseModel):
    role: Optional[str] = ""
    company: Optional[str] = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    currently_working: Optional[bool] = False
    duration: Optional[str] = ""
    description: Optional[str] = ""

class ProjectEntry(BaseModel):
    title: Optional[str] = ""
    technologies: Optional[List[str]] = []
    description: Optional[str] = ""
    role: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    link: Optional[str] = ""
    github: Optional[str] = ""

class CategorizedSkills(BaseModel):
    programming_languages: Optional[List[str]] = Field(default_factory=list)
    frameworks: Optional[List[str]] = Field(default_factory=list)
    databases: Optional[List[str]] = Field(default_factory=list)
    tools: Optional[List[str]] = Field(default_factory=list)
    other: Optional[List[str]] = Field(default_factory=list)

class OptionalSections(BaseModel):
    publications: Optional[bool] = False
    leadership: Optional[bool] = False
    volunteer: Optional[bool] = False
    extracurricular: Optional[bool] = False
    languages: Optional[bool] = False
    interests: Optional[bool] = False

class ResumeData(BaseModel):
    personal_info: Optional[PersonalInfo] = Field(default_factory=PersonalInfo)
    education: Optional[List[EducationEntry]] = Field(default_factory=list)
    skills: Optional[CategorizedSkills] = Field(default_factory=CategorizedSkills)
    experience: Optional[List[ExperienceEntry]] = Field(default_factory=list)
    projects: Optional[List[ProjectEntry]] = Field(default_factory=list)
    certifications: Optional[List[str]] = Field(default_factory=list)
    achievements: Optional[List[str]] = Field(default_factory=list)
    summary: Optional[str] = ""
    optional_sections: Optional[OptionalSections] = Field(default_factory=OptionalSections)

# Resume APIs Schemas
class ResumeChatRequest(BaseModel):
    session_id: str
    message: str
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class ResumeOptimizeRequest(BaseModel):
    resume_data: ResumeData
    company_name: str
    role_name: Optional[str] = None
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class ResumeImproveRequest(BaseModel):
    text: str
    context_type: str
    hf_token: Optional[str] = None
    model_name: Optional[str] = None


# Interview Schemas
class InterviewConfig(BaseModel):
    role: str
    type: str
    difficulty: str
    num_questions: int

class InterviewTurnRequest(BaseModel):
    config: InterviewConfig
    history: List[Dict[str, Any]] # Previous Q&A objects
    current_answer: str
    current_question: str
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class InterviewTurnResponse(BaseModel):
    score: int
    feedback: str
    next_question: str

class InterviewStartRequest(BaseModel):
    config: InterviewConfig
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class InterviewReportRequest(BaseModel):
    config: InterviewConfig
    history: List[Dict[str, Any]] # Full interview Q&A
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class InterviewReportResponse(BaseModel):
    overall_score: int
    technical: int
    communication: int
    confidence: int
    strengths: List[str]
    weaknesses: List[str]
    recommended_topics: List[str]
    summary: str
