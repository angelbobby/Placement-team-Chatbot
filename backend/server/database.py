import os
import json
import uuid
import datetime
from pymongo import MongoClient
from bson import ObjectId
from server.config import MONGO_URI

# Initialize Mongo Client
try:
    db_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    # Ping database to verify connection
    db_client.server_info()
    db = db_client["placement_chatbot"]
    print("Connected to MongoDB successfully!")
    MONGO_AVAILABLE = True
except Exception as e:
    print(f"MongoDB connection failed: {e}. Falling back to MockDB client...")
    # Creating a simple mock class for fallback if MongoDB isn't running
    class MockCollection:
        def __init__(self): 
            self.data = {}
        
        def insert_one(self, doc):
            if '_id' not in doc: 
                doc['_id'] = str(uuid.uuid4())
            self.data[str(doc['_id'])] = doc
            return type('obj', (object,), {'inserted_id': doc['_id']})()
        
        def insert_many(self, docs):
            for d in docs: 
                self.insert_one(d)
        
        def find(self, query=None, projection=None):
            res = list(self.data.values())
            if query:
                res = [r for r in res if all(r.get(k) == v for k, v in query.items())]
            # Copy to avoid external modifications modifying internal DB state
            return [r.copy() for r in res]
        
        def find_one(self, query):
            res = self.find(query)
            return res[0] if res else None
        
        def update_one(self, query, update):
            doc = self.find_one(query)
            if doc:
                # Retrieve from self.data directly to modify references
                doc_ref = self.data.get(str(doc.get('_id')))
                if doc_ref and '$set' in update:
                    doc_ref.update(update['$set'])
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
        
        def count_documents(self, query): 
            return len(self.find(query))
        
    class MockDB:
        def __init__(self):
            self.collections = {}
            
        def __getitem__(self, name):
            if name not in self.collections:
                self.collections[name] = MockCollection()
            return self.collections[name]
            
    db = MockDB()
    MONGO_AVAILABLE = False

# Helper to serialize Mongo documents (handles ObjectId and datetime)
def mongo_serialize(doc):
    if not doc:
        return None
    doc_copy = doc.copy()
    if '_id' in doc_copy:
        doc_copy['_id'] = str(doc_copy['_id'])
    
    # Process other fields recursively if necessary
    for k, v in doc_copy.items():
        if isinstance(v, ObjectId):
            doc_copy[k] = str(v)
        elif isinstance(v, datetime.datetime):
            doc_copy[k] = v.isoformat()
    return doc_copy

# Database Seeding helper
def seed_database(embedding_model):
    # Check if DB has data
    if db["companies"].count_documents({}) == 0 or db["chunks"].count_documents({}) == 0:
        print("Seeding database with sample data...")
        # Clear existing collections to prevent duplicates
        db["companies"].delete_many({})
        db["faqs"].delete_many({})
        db["tips"].delete_many({})
        db["chunks"].delete_many({})
        
        # Resolve sample data path
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sample_data_path = os.path.join(parent_dir, 'data', 'sample_data.json')
        
        if os.path.exists(sample_data_path):
            with open(sample_data_path, 'r') as f:
                data = json.load(f)
                
            db["companies"].insert_many(data.get("companies", []))
            db["faqs"].insert_many(data.get("faqs", []))
            db["tips"].insert_many(data.get("tips", []))
            
            # Create text chunks for RAG embedding
            chunks_to_insert = []
            
            # 1. Chunk companies
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
                embedding = embedding_model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"Company Drive - {comp['name']}",
                    "embedding": embedding
                })
                
            # 2. Chunk FAQs
            for faq in data.get("faqs", []):
                text = f"FAQ Category: {faq['category']}\nQuestion: {faq['question']}\nAnswer: {faq['answer']}"
                embedding = embedding_model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"FAQ - {faq['category']}",
                    "embedding": embedding
                })
                
            # 3. Chunk Tips
            for tip in data.get("tips", []):
                text = f"Tip Category: {tip['category']}\nTitle: {tip['title']}\nContent: {tip['content']}"
                embedding = embedding_model.encode(text).tolist()
                chunks_to_insert.append({
                    "text": text,
                    "source": f"Tips Hub - {tip['category']}",
                    "embedding": embedding
                })
                
            if chunks_to_insert:
                db["chunks"].insert_many(chunks_to_insert)
            
            print("Seeding completed successfully!")
            return True
        else:
            print("Sample data file not found at path:", sample_data_path)
            return False
    else:
        print("Database already seeded.")
        return False
