from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from server.services.tech_interview_service import generate_first_tech_question, evaluate_tech_answer, generate_tech_report, execute_python_code

router = APIRouter(prefix="/api/tech-interview", tags=["Technical Interview"])

class TechInterviewConfig(BaseModel):
    difficulty: str
    num_questions: int
    topic: str

class TechInterviewStartRequest(BaseModel):
    config: TechInterviewConfig
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class TechInterviewTurnRequest(BaseModel):
    config: TechInterviewConfig
    history: List[Dict[str, Any]]
    current_question: Dict[str, Any]
    current_answer: str
    current_code: str
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class TechInterviewReportRequest(BaseModel):
    config: TechInterviewConfig
    history: List[Dict[str, Any]]
    hf_token: Optional[str] = None
    model_name: Optional[str] = None

class TechInterviewExecuteRequest(BaseModel):
    code: str


@router.post("/start")
def start_tech_interview(request: TechInterviewStartRequest):
    question_data = generate_first_tech_question(
        config=request.config,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return {"question": question_data}

@router.post("/next")
def next_tech_turn(request: TechInterviewTurnRequest):
    result = evaluate_tech_answer(
        config=request.config,
        history=request.history,
        current_question=request.current_question,
        current_answer=request.current_answer,
        current_code=request.current_code,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return result

@router.post("/report")
def get_tech_report(request: TechInterviewReportRequest):
    report_data = generate_tech_report(
        config=request.config,
        history=request.history,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return report_data

@router.post("/execute")
def execute_code(request: TechInterviewExecuteRequest):
    result = execute_python_code(request.code)
    return result
