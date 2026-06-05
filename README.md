# Apex College Placement Cell Chatbot & Portal

An AI-powered Placement Cell Assistant and Recruitment Eligibility Checker built using React, Flask, MongoDB, FAISS, and Hugging Face.

This system leverages **RAG (Retrieval-Augmented Generation)** to index placement policy manuals, drive schedules, and resume guidelines. It enables students to query guidelines and verify eligibility in a premium, glassmorphic dark/light UI.

---

## System Architecture

```mermaid
graph TD
    A[React Web Client] -->|HTTP Requests| B[Flask REST Backend]
    B -->|Persist History / Retrieve Seeding| C[(MongoDB Database)]
    B -->|File Chunk Vector Indexing| D[(FAISS Vector DB)]
    B -->|Local Embedding Model| E(sentence-transformers)
    B -->|HF Client Inference API| F[Hugging Face Hub (Mistral / Phi-3)]
    B -->|Local Fallback QA| G(DistilBERT QA Pipeline)
```

1. **Frontend**: Single Page Application built using React (Vite) and styled with custom Vanilla CSS (supporting glassmorphic styling and toggles).
2. **Backend**: Flask API server serving endpoints for Chat, Eligibility Verification, FAQs, Tips, and Document Uploads.
3. **MongoDB**: Stores active chat sessions, detailed message logs, FAQs, prep guides, company eligibility rules, and uploaded document registry.
4. **FAISS & RAG**: On file upload (PDF/DOCX/TXT), text is extracted, chunked, vectorized using `all-MiniLM-L6-v2`, and indexed in FAISS for semantic similarity search.
5. **Hugging Face Model**: Queries `mistralai/Mistral-7B-Instruct-v0.3` or `microsoft/Phi-3-mini-4k-instruct` via the Inference API using a student-configured token. 
6. **Local Fallback**: Runs a local QA pipeline (`distilbert-base-uncased-distilled-squad`) to find direct answers on CPU when offline or when no HF token is supplied.

---

## Project Structure

```
Placement team chatbot/
├── backend/
│   ├── data/
│   │   ├── sample_data.json   # Seed database inputs (companies, FAQs, tips)
│   │   └── db/                # (Created on startup) Local MongoDB data path
│   ├── uploads/               # (Created on startup) Uploaded PDF/DOCX storage
│   ├── app.py                 # Core Flask server and API routes
│   └── requirements.txt       # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Stateful tab views and client actions
│   │   ├── index.css          # Theme styles, animations, variables
│   │   └── main.jsx           # React app mount
│   ├── index.html             # Main entry page (SEO optimized)
│   └── package.json           # Frontend scripts and configurations
├── task.md                    # Task tracking checklist
└── README.md                  # System setup and execution manual (this file)
```

---

## Setup & Running Locally

Follow these steps to set up and run the application. Make sure you have **Node.js** and **Python 3.10+** installed.

### Step 1: Start MongoDB
Because starting MongoDB as a system service may fail due to Windows administrator restrictions, you can start a local instance manually pointing to a database folder in the workspace:

1. Open a new Terminal (PowerShell) and create the database directory:
   ```powershell
   mkdir -p backend/data/db
   ```
2. Start the MongoDB daemon process:
   ```powershell
   mongod --dbpath ./backend/data/db
   ```
   *Keep this terminal window open to keep the database running.*

---

### Step 2: Set Up Backend (Flask)
1. Open a new Terminal window in the project root.
2. Install the required Python packages:
   ```powershell
   pip install -r backend/requirements.txt
   ```
3. Run the Flask API server:
   ```powershell
   python backend/app.py
   ```
   *The server will start at `http://localhost:5000`. On first start, it will download the lightweight embedding/QA models (~300MB total) and seed MongoDB with the company, FAQ, and tip dataset.*

---

### Step 3: Set Up Frontend (React)
1. Open a third Terminal window and navigate to the frontend folder:
   ```powershell
   cd frontend
   ```
2. Install npm dependencies:
   ```powershell
   npm install
   ```
3. Start the Vite React development server:
   ```powershell
   npm run dev
   ```
4. Open your browser and navigate to the address shown (usually `http://localhost:5173`).

---

## Key REST API Endpoints

- `POST /api/chat`: Takes a user question, performs RAG context retrieval, calls Hugging Face (or local CPU fallback), and saves messages in MongoDB.
- `POST /api/check-eligibility`: Receives CGPA, Branch, and Backlogs; checks qualifications against all database recruiters.
- `POST /api/upload`: Uploads PDF/Docx/Txt files, chunks them, embeds them using sentence-transformers, and inserts them into the FAISS index.
- `GET /api/companies`: Fetches seeded recruiter profiles.
- `GET /api/faqs`: Fetches Q&A records.
- `GET /api/sessions`: Fetches all chat sessions from MongoDB.
- `POST /api/test-connection`: Tests user's Hugging Face token against the specified model.

---

## Getting a Free Hugging Face Token
1. Go to [huggingface.co](https://huggingface.co/) and sign up for a free account.
2. Click your profile avatar → **Settings** → **Access Tokens**.
3. Create a **New Token** with **Read** access.
4. Copy the key and paste it into the **Portal Settings** tab in the UI to unlock full LLM conversational generation.
