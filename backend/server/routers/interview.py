from fastapi import APIRouter, HTTPException
from server.schemas.models import InterviewStartRequest, InterviewTurnRequest, InterviewTurnResponse, InterviewReportRequest, InterviewReportResponse
from server.services.interview_service import generate_first_question, evaluate_and_next, generate_report

router = APIRouter(prefix="/api/interview", tags=["Interview"])

@router.post("/start")
def start_interview(request: InterviewStartRequest):
    question = generate_first_question(
        config=request.config,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return {"question": question}

@router.post("/next", response_model=InterviewTurnResponse)
def next_turn(request: InterviewTurnRequest):
    result = evaluate_and_next(
        config=request.config,
        history=request.history,
        current_question=request.current_question,
        current_answer=request.current_answer,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return InterviewTurnResponse(
        score=result.get("score", 7),
        feedback=result.get("feedback", "No feedback available."),
        next_question=result.get("next_question", "Could you elaborate further?")
    )

@router.post("/report", response_model=InterviewReportResponse)
def get_report(request: InterviewReportRequest):
    report_data = generate_report(
        config=request.config,
        history=request.history,
        hf_token=request.hf_token,
        model_name=request.model_name
    )
    return InterviewReportResponse(**report_data)
