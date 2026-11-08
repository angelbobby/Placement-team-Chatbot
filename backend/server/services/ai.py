import os
import numpy as np
from server.config import SERVER_HF_TOKEN, SERVER_HF_MODEL
from server.database import db

# Lazy loads
_embedding_model = None
_qa_pipeline = None
_generative_pipeline = None
faiss_index = None
vector_store = []
embeddings_list = []

# Check if FAISS is available
try:
    import faiss
    HAS_FAISS = True
    print("FAISS is available.")
except ImportError:
    HAS_FAISS = False
    print("FAISS is not installed. Using custom NumPy vector search fallback.")

# 1. Embedding Model Lazy Loader
def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Loading SentenceTransformer model (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model

# 2. Local QA Pipeline
class CustomQAPipeline:
    def __init__(self):
        print("Loading local QA model & tokenizer (distilbert-base-uncased-distilled-squad)...")
        from transformers import AutoTokenizer, AutoModelForQuestionAnswering
        self.tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased-distilled-squad")
        self.model = AutoModelForQuestionAnswering.from_pretrained("distilbert-base-uncased-distilled-squad")

    def __call__(self, question, context, max_answer_tokens=30):
        import torch
        inputs = self.tokenizer(question, context, return_tensors="pt", truncation="only_second", max_length=512)
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        start_logits = outputs.start_logits[0]
        end_logits = outputs.end_logits[0]
        
        start_probs = torch.softmax(start_logits, dim=-1)
        end_probs = torch.softmax(end_logits, dim=-1)
        
        seq_len = start_logits.shape[0]
        best_score = -1.0
        best_start = 0
        best_end = 0
        
        k = min(20, seq_len)
        top_starts = torch.topk(start_logits, k).indices
        top_ends = torch.topk(end_logits, k).indices
        
        for s in top_starts:
            for e in top_ends:
                s_val, e_val = s.item(), e.item()
                if e_val < s_val:
                    continue
                if (e_val - s_val + 1) > max_answer_tokens:
                    continue
                score = float(start_probs[s_val] * end_probs[e_val])
                if score > best_score:
                    best_score = score
                    best_start = s_val
                    best_end = e_val
        
        input_ids = inputs["input_ids"][0]
        answer_tokens = input_ids[best_start : best_end + 1]
        answer = self.tokenizer.decode(answer_tokens, skip_special_tokens=True).strip()
        
        return {"answer": answer, "score": best_score}

def get_qa_pipeline():
    global _qa_pipeline
    if _qa_pipeline is None:
        _qa_pipeline = CustomQAPipeline()
    return _qa_pipeline

def get_generative_pipeline():
    global _generative_pipeline
    if _generative_pipeline is None:
        print("Loading local generative model (google/flan-t5-small)...")
        from transformers import pipeline
        _generative_pipeline = pipeline("text2text-generation", model="google/flan-t5-small")
    return _generative_pipeline

# 3. RAG Indexing and Vector Search
def rebuild_rag_index():
    global faiss_index, vector_store, embeddings_list
    print("Rebuilding RAG Index...")
    
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

def search_rag(query: str, k: int = 4):
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

# 4. LLM Generation Service (Hugging Face)
def call_huggingface(messages: list, token: str = None, model: str = None, max_tokens: int = 600) -> str:
    """
    Calls Hugging Face Inference API. 
    Can pass specific tokens and models (from client preferences) or use backend defaults.
    """
    hf_token = (token or SERVER_HF_TOKEN or "").strip()
    hf_model = (model or SERVER_HF_MODEL or "").strip()
    
    if not hf_token:
        raise ValueError("No Hugging Face token available.")
        
    from huggingface_hub import InferenceClient
    client = InferenceClient(token=hf_token)
    
    # Attempt with selected model
    try:
        response = client.chat_completion(
            messages=messages,
            model=hf_model,
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[AI Service] Error generating response with model '{hf_model}': {e}")
        # Detect token/permission errors and pass them upwards
        err_str = str(e)
        if "403" in err_str or "permission" in err_str.lower() or "401" in err_str or "unauthorized" in err_str.lower():
            raise e
            
        # Try fallback model if it was a generic model availability/quota error
        fallback_model = "HuggingFaceH4/zephyr-7b-beta"
        if hf_model != fallback_model:
            print(f"[AI Service] Retrying generation with fallback model '{fallback_model}'...")
            response = client.chat_completion(
                messages=messages,
                model=fallback_model,
                max_tokens=max_tokens,
                temperature=0.7
            )
            return response.choices[0].message.content
        else:
            raise e

# 5. LLM Generation Service (Groq - Free Tier)
def call_groq(messages: list, api_key: str = None, model: str = None, max_tokens: int = 2000) -> str:
    """
    Calls Groq Inference API (free tier, OpenAI-compatible).
    Models: llama-3.1-8b-instant, llama-3.3-70b-versatile, mixtral-8x7b-32768
    Get your free API key at: https://console.groq.com/keys
    """
    from server.config import SERVER_GROQ_API_KEY
    groq_key = (api_key or SERVER_GROQ_API_KEY or "").strip()

    if not groq_key:
        raise ValueError("No Groq API key provided. Get a free key at https://console.groq.com/keys")

    groq_model = (model or "llama-3.1-8b-instant").strip()

    from groq import Groq
    client = Groq(api_key=groq_key)

    try:
        response = client.chat.completions.create(
            messages=messages,
            model=groq_model,
            max_tokens=max_tokens,
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[Groq AI] Error with model '{groq_model}': {e}")
        err_str = str(e).lower()
        # Auth / key errors — bubble up immediately (don't retry)
        if "401" in err_str or "invalid_api_key" in err_str or "authentication" in err_str or "403" in err_str:
            raise e
        # Try a fallback model for quota / model-availability issues
        fallback_model = "llama-3.3-70b-versatile"
        if groq_model != fallback_model:
            print(f"[Groq AI] Retrying with fallback model '{fallback_model}'...")
            response = client.chat.completions.create(
                messages=messages,
                model=fallback_model,
                max_tokens=max_tokens,
                temperature=0.7,
            )
            return response.choices[0].message.content
        raise e

