from fastapi import APIRouter, HTTPException
from server.config import SERVER_HF_TOKEN, SERVER_HF_MODEL
from server.database import db, mongo_serialize
from server.schemas.models import TestConnectionRequest

router = APIRouter(prefix="/api")

@router.get("/companies")
def get_companies():
    try:
        companies = list(db["companies"].find())
        return [mongo_serialize(c) for c in companies]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/faqs")
def get_faqs():
    try:
        faqs = list(db["faqs"].find())
        return [mongo_serialize(f) for f in faqs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tips")
def get_tips():
    try:
        tips = list(db["tips"].find())
        return [mongo_serialize(t) for t in tips]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hf-config")
def get_hf_config():
    return {
        "token_configured": bool(SERVER_HF_TOKEN),
        "model": SERVER_HF_MODEL if SERVER_HF_TOKEN else None,
        "source": "environment" if SERVER_HF_TOKEN else "none"
    }

@router.post("/test-connection")
def test_connection(payload: TestConnectionRequest):
    try:
        hf_token = payload.hf_token.strip()
        model_name = payload.model_name.strip()
        
        if not hf_token:
            return {"status": "error", "message": "No token provided."}
            
        from huggingface_hub import InferenceClient
        client = InferenceClient(token=hf_token)
        
        # Call simple completion
        client.chat_completion(
            messages=[{"role": "user", "content": "hello"}],
            model=model_name,
            max_tokens=5
        )
        return {
            "status": "success",
            "message": "Successfully connected to Hugging Face!",
            "model": model_name
        }
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}
