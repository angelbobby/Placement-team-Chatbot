from fastapi import APIRouter, HTTPException, UploadFile, File
import datetime
import os
import shutil
from server.config import UPLOAD_FOLDER
from server.database import db, mongo_serialize
from server.services.ai import get_embedding_model, rebuild_rag_index
from server.services.resume_gen import extract_text_from_file

router = APIRouter(prefix="/api")

def chunk_text(text: str, chunk_size=500, overlap=50):
    text = ' '.join(text.split())
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        filename = file.filename
        if not filename:
            raise HTTPException(status_code=400, detail="No selected file")
            
        # Save file locally
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Read saved bytes to extract content
        with open(filepath, "rb") as f:
            file_bytes = f.read()
            
        try:
            text_content = extract_text_from_file(file_bytes, filename)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
            
        if not text_content or len(text_content.strip()) == 0:
            raise HTTPException(status_code=400, detail="Could not extract any text content from the file.")
            
        chunks = chunk_text(text_content)
        if not chunks:
            raise HTTPException(status_code=400, detail="Document is too short or empty.")
            
        # Embed and insert chunks into MongoDB
        model = get_embedding_model()
        chunks_inserted = []
        for idx, chunk in enumerate(chunks):
            embedding = model.encode(chunk).tolist()
            chunks_inserted.append({
                "text": chunk,
                "source": f"Uploaded Doc: {filename} (Page/Part {idx+1})",
                "embedding": embedding,
                "filename": filename,
                "upload_time": datetime.datetime.now().isoformat()
            })
            
        db["chunks"].insert_many(chunks_inserted)
        
        # Track document metadata
        doc_record = {
            "filename": filename,
            "upload_date": datetime.datetime.now().isoformat(),
            "chunk_count": len(chunks)
        }
        db["documents"].insert_one(doc_record)
        
        # Re-index vectors
        rebuild_rag_index()
        
        return {
            "status": "success",
            "message": f"Successfully parsed and uploaded '{filename}'",
            "chunks_count": len(chunks)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
def get_documents():
    try:
        docs = list(db["documents"].find())
        return [mongo_serialize(d) for d in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
