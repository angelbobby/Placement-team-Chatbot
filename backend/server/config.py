import os
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path, override=True)

# Server configs
PORT = int(os.environ.get("PORT", 5000))
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')

# Hugging Face configs (used for chat/RAG)
SERVER_HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
SERVER_HF_MODEL = os.environ.get("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct").strip()

# Groq configs (used for career roadmap generation)
SERVER_GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()

# Ensure uploads directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
