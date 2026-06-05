import os
import json
import uuid
import datetime
import ssl

# Bypass SSL verification globally to prevent certificate errors on HuggingFace downloads
ssl._create_default_https_context = ssl._create_unverified_context

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests
from huggingface_hub import configure_http_backend

def backend_factory():
    session = requests.Session()
    session.verify = False
    return session
configure_http_backend(backend_factory=backend_factory)

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from werkzeug.utils import secure_filename
import numpy as np

# Load env variables if .env exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Server-side Hugging Face defaults (from .env)
SERVER_HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
SERVER_HF_MODEL = os.environ.get("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.3").strip()
if SERVER_HF_TOKEN:
    print(f"[OK] Hugging Face token loaded from environment (model: {SERVER_HF_MODEL})")
else:
    print("[WARN] No HF_TOKEN found in environment. Set it in backend/.env to enable AI responses.")

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# MongoDB Connection
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
try:
    db_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    # Check if mongo is running
    db_client.server_info()
    db = db_client["placement_chatbot"]
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"MongoDB connection failed: {e}. Falling back to an in-memory/mock DB mock client...")
    # Creating a simple mock class for fallback if MongoDB isn't running at all
    class MockCollection:
        def __init__(self): self.data = {}
        def insert_one(self, doc):
            if '_id' not in doc: doc['_id'] = str(uuid.uuid4())
            self.data[str(doc['_id'])] = doc
            return type('obj', (object,), {'inserted_id': doc['_id']})()
        def insert_many(self, docs):
            for d in docs: self.insert_one(d)
        def find(self, query=None, projection=None):
            res = list(self.data.values())
            if query:
                res = [r for r in res if all(r.get(k) == v for k, v in query.items())]
            return res
        def find_one(self, query):
            res = self.find(query)
            return res[0] if res else None
        def update_one(self, query, update):
            doc = self.find_one(query)
            if doc and '$set' in update:
                doc.update(update['$set'])
            return type('obj', (object,), {'modified_count': 1})()
        def delete_one(self, query):
            doc = self.find_one(query)
            if doc:
                del self.data[str(doc['_id'])]
            return type('obj', (object,), {'deleted_count': 1})()
        def delete_many(self, query):
            for doc in self.find(query):
                del self.data[str(doc['_id'])]
            return type('obj', (object,), {'deleted_count': 1})()
        def count_documents(self, query): return len(self.find(query))
        
    class MockDB:
        def __init__(self):
            self.collections = {}
        def __getitem__(self, name):
            if name not in self.collections:
                self.collections[name] = MockCollection()
            return self.collections[name]
    db = MockDB()

# Load Embedding model lazily
_embedding_model = None
def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Loading SentenceTransformer model (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model

# Load QA model lazily
_qa_pipeline = None
def get_qa_pipeline():
    global _qa_pipeline
    if _qa_pipeline is None:
        print("Loading local QA pipeline (distilbert-base-uncased-distilled-squad)...")
        from transformers import pipeline
        _qa_pipeline = pipeline("question-answering", model="distilbert-base-uncased-distilled-squad")
    return _qa_pipeline

# Check FAISS
try:
    import faiss
    HAS_FAISS = True
    print("FAISS is available.")
except ImportError:
    HAS_FAISS = False
    print("FAISS is not installed. Using custom NumPy vector search fallback.")

# Global references for RAG Indexing
faiss_index = None
vector_store = []  # List of dicts: {'text': ..., 'source': ...}
embeddings_list = []  # List of numpy arrays for numpy fallback

def rebuild_rag_index():
    global faiss_index, vector_store, embeddings_list
    print("Rebuilding RAG Index...")
    
    # Retrieve all chunks from database
    chunks_cursor = db["chunks"].find()
    db_chunks = list(chunks_cursor)
    
    vector_store = []
    embeddings_list = []
    
    if not db_chunks:
        print("No chunks found in database.")
        faiss_index = None
        return
        
    for chunk in db_chunks:
        vector_store.append({
            'text': chunk['text'],
            'source': chunk.get('source', 'System Knowledge')
        })
        embeddings_list.append(chunk['embedding'])
        
    if not embeddings_list:
        return
        
    embeddings_matrix = np.array(embeddings_list, dtype=np.float32)
    dimension = embeddings_matrix.shape[1]
    
    if HAS_FAISS:
        faiss_index = faiss.IndexFlatL2(dimension)
        faiss_index.add(embeddings_matrix)
    else:
        faiss_index = None
        
    print(f"RAG Index built with {len(vector_store)} chunks.")

def search_rag(query, k=4):
    global faiss_index, vector_store, embeddings_list
    if not vector_store:
        return []
        
    model = get_embedding_model()
    query_vector = model.encode([query])[0]
    
    if HAS_FAISS and faiss_index is not None:
        q_vec = np.array([query_vector], dtype=np.float32)
        distances, indices = faiss_index.search(q_vec, k)
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(vector_store):
                item = vector_store[idx].copy()
                item['score'] = float(distances[0][i])
                results.append(item)
        return results
    else:
        # NumPy Cosine Similarity fallback
        if not embeddings_list:
            return []
        matrix = np.array(embeddings_list)
        q_vec = np.array(query_vector)
        
        norms = np.linalg.norm(matrix, axis=1)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0 or len(norms) == 0:
            return []
            
        similarities = np.dot(matrix, q_vec) / (norms * q_norm)
        top_indices = np.argsort(similarities)[::-1][:k]
        
        results = []
        for idx in top_indices:
            item = vector_store[idx].copy()
            item['score'] = float(similarities[idx])
            results.append(item)
        return results

# Database Seeding helper
def seed_database():
    if db["companies"].count_documents({}) == 0 or db["chunks"].count_documents({}) == 0:
        print("Seeding database with sample data...")
        # Clear existing collections to prevent duplicates
        db["companies"].delete_many({})
        db["faqs"].delete_many({})
        db["tips"].delete_many({})
        db["chunks"].delete_many({})
        
        sample_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'sample_data.json')
        if os.path.exists(sample_data_path):
            with open(sample_data_path, 'r') as f:
                data = json.load(f)
                
            db["companies"].insert_many(data.get("companies", []))
            db["faqs"].insert_many(data.get("faqs", []))
            db["tips"].insert_many(data.get("tips", []))
            
            # Create text chunks for RAG embedding
            chunks_to_insert = []
            
            # 1. Chunk companies
            model = get_embedding_model()
            for comp in data.get("companies", []):
                text = (
                    f"Company: {comp['name']}\n"
                    f"Role: {comp['role']}\n"
                    f"Package: {comp['package']}\n"
                    f"CGPA Requirement: {comp['cgpa']}\n"
                    f"Branches Allowed: {', '.join(comp['branches'])}\n"
                    f"Active Backlogs Allowed: {comp['backlogs_allowed']}\n"
                    f"Description: {comp['description']}\n"
                    f"Recruitment Process: {comp['recruitment_process']}"
                )
                embedding = model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"Company Drive - {comp['name']}",
                    "embedding": embedding
                })
                
            # 2. Chunk FAQs
            for faq in data.get("faqs", []):
                text = f"FAQ Category: {faq['category']}\nQuestion: {faq['question']}\nAnswer: {faq['answer']}"
                embedding = model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"FAQ - {faq['category']}",
                    "embedding": embedding
                })
                
            # 3. Chunk Tips
            for tip in data.get("tips", []):
                text = f"Tip Category: {tip['category']}\nTitle: {tip['title']}\nContent: {tip['content']}"
                embedding = model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"Tips Hub - {tip['category']}",
                    "embedding": embedding
                })
                
            if chunks_to_insert:
                db["chunks"].insert_many(chunks_to_insert)
            
            print("Seeding completed successfully!")
            rebuild_rag_index()
        else:
            print("Sample data file not found at path:", sample_data_path)
    else:
        print("Database already seeded. Indexing...")
        rebuild_rag_index()

# Document text extraction helpers
def extract_text_from_pdf(filepath):
    try:
        from pypdf import PdfReader
        reader = PdfReader(filepath)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    except Exception as e:
        return f"Error extracting PDF: {str(e)}"

def extract_text_from_docx(filepath):
    try:
        import docx
        doc = docx.Document(filepath)
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        return '\n'.join(text)
    except Exception as e:
        return f"Error extracting Docx: {str(e)}"

def extract_text_from_txt(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error extracting Txt: {str(e)}"

def chunk_text(text, chunk_size=500, overlap=50):
    text = ' '.join(text.split())
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

# ----------------- REST APIs -----------------

# Seed and initialize models on first request
@app.before_request
def initialize_app():
    # Remove before_request self-destruction to keep it running
    pass

# Helper to serialize Mongo IDs
def mongo_serialize(doc):
    if not doc:
        return None
    doc_copy = doc.copy()
    if '_id' in doc_copy:
        doc_copy['_id'] = str(doc_copy['_id'])
    return doc_copy

@app.route('/api/companies', methods=['GET'])
def get_companies():
    try:
        companies = list(db["companies"].find())
        return jsonify([mongo_serialize(c) for c in companies])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faqs', methods=['GET'])
def get_faqs():
    try:
        faqs = list(db["faqs"].find())
        return jsonify([mongo_serialize(f) for f in faqs])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tips', methods=['GET'])
def get_tips():
    try:
        tips = list(db["tips"].find())
        return jsonify([mongo_serialize(t) for t in tips])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/check-eligibility', methods=['POST'])
def check_eligibility():
    try:
        data = request.json
        cgpa = float(data.get("cgpa", 0))
        branch = str(data.get("branch", "")).upper()
        backlogs = int(data.get("backlogs", 0))
        
        companies = list(db["companies"].find())
        results = []
        
        for c in companies:
            eligible = True
            reasons = []
            
            # Check CGPA
            if cgpa < c["cgpa"]:
                eligible = False
                reasons.append(f"CGPA is {cgpa}, required is {c['cgpa']}")
                
            # Check Branch
            allowed_branches = [b.upper() for b in c["branches"]]
            if branch not in allowed_branches:
                eligible = False
                reasons.append(f"Branch '{branch}' is not in allowed list ({', '.join(c['branches'])})")
                
            # Check Backlogs
            if backlogs > c["backlogs_allowed"]:
                eligible = False
                reasons.append(f"Active backlogs is {backlogs}, max allowed is {c['backlogs_allowed']}")
                
            results.append({
                "company_id": str(c["_id"]),
                "name": c["name"],
                "role": c["role"],
                "package": c["package"],
                "required_cgpa": c["cgpa"],
                "required_branches": c["branches"],
                "required_backlogs": c["backlogs_allowed"],
                "eligible": eligible,
                "reason": "Requirements met successfully!" if eligible else " & ".join(reasons)
            })
            
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Chat Session Management
@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    try:
        sessions = list(db["sessions"].find())
        # Sort by updated/created time
        sessions = sorted(sessions, key=lambda x: x.get('created_at', ''), reverse=True)
        return jsonify([mongo_serialize(s) for s in sessions])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions', methods=['POST'])
def create_session():
    try:
        title = request.json.get("title", f"New Chat Session {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
        session_id = str(uuid.uuid4())
        session = {
            "_id": session_id,
            "title": title,
            "created_at": datetime.datetime.now().isoformat()
        }
        db["sessions"].insert_one(session)
        return jsonify(session)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        db["sessions"].delete_one({"_id": session_id})
        db["messages"].delete_many({"session_id": session_id})
        return jsonify({"status": "success", "message": "Session deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    try:
        messages = list(db["messages"].find({"session_id": session_id}))
        # Sort by timestamp
        messages = sorted(messages, key=lambda x: x.get('timestamp', ''))
        return jsonify([mongo_serialize(m) for m in messages])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Upload Document for RAG
@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part in the request"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        ext = os.path.splitext(filename)[1].lower()
        text_content = ""
        if ext == '.pdf':
            text_content = extract_text_from_pdf(filepath)
        elif ext == '.docx':
            text_content = extract_text_from_docx(filepath)
        elif ext in ['.txt', '.md']:
            text_content = extract_text_from_txt(filepath)
        else:
            return jsonify({"error": "Unsupported file format. Please upload PDF, Word (docx), or Text (txt) files."}), 400
            
        if len(text_content.strip()) == 0:
            return jsonify({"error": "Could not extract any text content from the file."}), 400
            
        chunks = chunk_text(text_content)
        if not chunks:
            return jsonify({"error": "Document is too short or empty."}), 400
            
        # Add to MongoDB and embed
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
        
        # Track uploaded document
        doc_record = {
            "filename": filename,
            "upload_date": datetime.datetime.now().isoformat(),
            "chunk_count": len(chunks)
        }
        db["documents"].insert_one(doc_record)
        
        # Re-index
        rebuild_rag_index()
        
        return jsonify({
            "status": "success",
            "message": f"Successfully parsed and uploaded '{filename}'",
            "chunks_count": len(chunks)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/documents', methods=['GET'])
def get_documents():
    try:
        docs = list(db["documents"].find())
        return jsonify([mongo_serialize(d) for d in docs])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Chat Route
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        session_id = data.get("session_id")
        user_message = data.get("message")
        # Prefer token from request; fall back to server-side .env token
        hf_token = data.get("hf_token", "").strip() or SERVER_HF_TOKEN
        # Prefer model from request; fall back to server-side .env model
        model_name = data.get("model_name", "").strip() or SERVER_HF_MODEL
        use_rag = data.get("use_rag", True)
        
        if not session_id or not user_message:
            return jsonify({"error": "session_id and message are required"}), 400
            
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
                
        # Retrieve recent history from database (limit to last 6 messages to keep context window manageable)
        history_msgs = list(db["messages"].find({"session_id": session_id}))
        history_msgs = sorted(history_msgs, key=lambda x: x.get('timestamp', ''))[:-1] # Exclude the user message just inserted
        
        history_formatted = []
        for hm in history_msgs:
            role = "user" if hm["sender"] == "user" else "assistant"
            history_formatted.append({"role": role, "content": hm["text"]})
            
        # Call Hugging Face API or Fallback
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
        
        used_local = False
        
        # Try Hugging Face API
        if hf_token:
            try:
                from huggingface_hub import InferenceClient
                client = InferenceClient(token=hf_token)
                print(f"Calling Hugging Face Inference API with model '{model_name}'...")
                
                # Use chat_completion (OpenAI-compatible)
                hf_response = client.chat_completion(
                    messages=messages,
                    model=model_name,
                    max_tokens=600,
                    temperature=0.7
                )
                response_text = hf_response.choices[0].message.content
                print("HF API response obtained successfully.")
            except Exception as e:
                print(f"[ERROR] HF API call failed for model '{model_name}': {type(e).__name__}: {e}")
                # Try a reliable fallback model before giving up
                fallback_model = "microsoft/Phi-3-mini-4k-instruct"
                if model_name != fallback_model:
                    try:
                        print(f"Retrying with fallback model '{fallback_model}'...")
                        from huggingface_hub import InferenceClient
                        client2 = InferenceClient(token=hf_token)
                        hf_response2 = client2.chat_completion(
                            messages=messages,
                            model=fallback_model,
                            max_tokens=600,
                            temperature=0.7
                        )
                        response_text = hf_response2.choices[0].message.content
                        print(f"Fallback model '{fallback_model}' responded successfully.")
                    except Exception as e2:
                        print(f"[ERROR] Fallback model also failed: {type(e2).__name__}: {e2}. Using local pipeline.")
                        used_local = True
                else:
                    used_local = True
        else:
            # Fall back to local QA model if no API token is supplied
            print("No HF Token provided. Using local QA fallback...")
            used_local = True
            
        if used_local:
            try:
                # If there's no context, we can't do local extraction QA
                if not context:
                    response_text = (
                        "I see you asked a question. To provide a comprehensive generative answer, "
                        "please input a Hugging Face API Token in the Settings panel.\n\n"
                        "Alternatively, I can help you check eligibility in the 'Eligibility Checker' tab "
                        "or you can check the standard FAQs directly!"
                    )
                else:
                    qa = get_qa_pipeline()
                    # Combine context text
                    qa_context = " ".join([c['text'] for c in retrieved_chunks])
                    res = qa(question=user_message, context=qa_context)
                    
                    answer = res.get('answer', '').strip()
                    score = res.get('score', 0)
                    
                    if answer and score > 0.05:
                        response_text = (
                            f"According to the placement cell documents:\n\n"
                            f"**{answer}**\n\n"
                    
                        )
                    else:
                        response_text = (
                            "I retrieved some documents, but couldn't find a direct, precise answer to your question in them.\n\n"
                            "Here is the most relevant snippet I found:\n"
                            f"*{retrieved_chunks[0]['text']}*\n\n"
                            "*(Configure a Hugging Face Token in Settings to get full conversational reasoning over this text)*"
                        )
            except Exception as le:
                response_text = (
                    f"An error occurred while answering locally: {str(le)}.\n\n"
                    "Please make sure python dependencies are installed and configure a Hugging Face Token in Settings."
                )
                
        # Save Bot Response to MongoDB
        bot_msg_doc = {
            "session_id": session_id,
            "sender": "bot",
            "text": response_text,
            "timestamp": datetime.datetime.now().isoformat()
        }
        db["messages"].insert_one(bot_msg_doc)
        
        # Update session title if it was default and this is the first message
        session = db["sessions"].find_one({"_id": session_id})
        if session and session.get("title", "").startswith("New Chat Session"):
            # Use the first 40 chars of user query as new session title
            new_title = user_message[:40] + ("..." if len(user_message) > 40 else "")
            db["sessions"].update_one({"_id": session_id}, {"$set": {"title": new_title}})
            
        return jsonify({
            "message": response_text,
            "sender": "bot",
            "retrieved_sources": [c['source'] for c in retrieved_chunks] if use_rag else []
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint to test HF API connection
@app.route('/api/test-connection', methods=['POST'])
def test_connection():
    try:
        data = request.json
        # Prefer token from request; fall back to server-side .env token
        hf_token = data.get("hf_token", "").strip() or SERVER_HF_TOKEN
        model_name = data.get("model_name", "").strip() or SERVER_HF_MODEL
        
        if not hf_token:
            return jsonify({"status": "error", "message": "No Hugging Face token provided. Set HF_TOKEN in backend/.env or enter it in Settings."})
            
        from huggingface_hub import InferenceClient
        client = InferenceClient(token=hf_token)
        # Call a very simple request to verify key
        test_completion = client.chat_completion(
            messages=[{"role": "user", "content": "hello"}],
            model=model_name,
            max_tokens=5
        )
        return jsonify({
            "status": "success",
            "message": "Successfully connected to Hugging Face!",
            "model": model_name
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Connection failed: {str(e)}"})

# Endpoint to return current server-side HF config status (for frontend display)
@app.route('/api/hf-config', methods=['GET'])
def get_hf_config():
    return jsonify({
        "token_configured": bool(SERVER_HF_TOKEN),
        "model": SERVER_HF_MODEL if SERVER_HF_TOKEN else None,
        "source": "environment" if SERVER_HF_TOKEN else "none"
    })

# Main execution
if __name__ == '__main__':
    # Initialize and Seed Database
    print("Initializing Database...")
    seed_database()
    
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Placement Cell Backend on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)
