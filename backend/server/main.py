from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import httpx
import urllib3

# Disable SSL Verification for Hugging Face downloads & API calls due to local network certificate issues
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
try:
    import httpx
    _old_httpx_init = httpx.Client.__init__
    def _new_httpx_init(self, *args, **kwargs):
        kwargs['verify'] = False
        _old_httpx_init(self, *args, **kwargs)
    httpx.Client.__init__ = _new_httpx_init

    _old_httpx_async_init = httpx.AsyncClient.__init__
    def _new_httpx_async_init(self, *args, **kwargs):
        kwargs['verify'] = False
        _old_httpx_async_init(self, *args, **kwargs)
    httpx.AsyncClient.__init__ = _new_httpx_async_init
    print("[SSL Patch] Successfully disabled SSL verification for httpx.")
except Exception as e:
    print(f"[SSL Patch Failed] Could not patch httpx: {e}")

try:
    import requests
    old_request = requests.Session.request
    def new_request(self, method, url, **kwargs):
        kwargs['verify'] = False
        return old_request(self, method, url, **kwargs)
    requests.Session.request = new_request
    print("[SSL Patch] Successfully disabled SSL verification for requests.")
except Exception as e:
    print(f"[SSL Patch Failed] Could not patch requests: {e}")


from server.config import PORT
from server.database import seed_database
from server.services.ai import get_embedding_model, rebuild_rag_index

# Routers
from server.routers.chat import router as chat_router
from server.routers.eligibility import router as eligibility_router
from server.routers.documents import router as documents_router
from server.routers.info import router as info_router
from server.routers.resume import router as resume_router
from server.routers.roadmap import router as roadmap_router
from server.routers.interview import router as interview_router
from server.routers.tech_interview import router as tech_interview_router

# Lifespan context manager for startup and shutdown routines
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting Placement Cell FastAPI Server...")
    try:
        # Load embedding model on start and seed database if empty
        model = get_embedding_model()
        seeded = seed_database(model)
        if not seeded:
            # Rebuild index anyway if already seeded to pull chunks
            rebuild_rag_index()
    except Exception as e:
        print(f"[Startup Error] Could not initialize dependencies: {e}")
    yield
    print("Shutting down FastAPI Server...")

app = FastAPI(
    title="Placement Cell Chatbot & Resume Builder APIs",
    description="FastAPI + MongoDB backend for placements tracking, eligibility audits, document RAG, and AI Resumes.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all feature routers
app.include_router(chat_router)
app.include_router(eligibility_router)
app.include_router(documents_router)
app.include_router(info_router)
app.include_router(resume_router)
app.include_router(roadmap_router)
app.include_router(interview_router)
app.include_router(tech_interview_router)

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Placement Cell Chatbot & Resume Suite API. Refer to /docs for Swagger specifications."
    }
