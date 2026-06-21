from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId
import secrets
import random
import json
import numpy as np
import httpx
import asyncio
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine_similarity
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database — Supabase (primary) with MongoDB fallback
_use_supabase = bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

if _use_supabase:
    from supabase_db import SupabaseDB
    db = SupabaseDB()
    logging.info("Using Supabase as database backend")
    # Supabase uses UUIDs — make ObjectId a transparent string passthrough
    class ObjectId(str):  # type: ignore[no-redef]
        pass
else:
    mongo_url = os.environ.get("MONGO_URL", "mongodb+srv://vakiluser:vakil123@cluster0.yewv3qw.mongodb.net/vakilsetu_db?retryWrites=true&w=majority")
    from motor.motor_asyncio import AsyncIOMotorClient
    _mongo_client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=4000,
        connectTimeoutMS=4000,
        socketTimeoutMS=4000,
    )
    db = _mongo_client["vakilsetu_db"]
    logging.info("Using MongoDB as database backend")
# AI provider detection — supports OpenAI and Groq (free tier)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
GROQ_API_KEY   = os.environ.get("GROQ_API_KEY")
EMERGENT_LLM_KEY = OPENAI_API_KEY  # backward compat

# Groq is OpenAI-SDK-compatible; just swap base_url + model
_GROQ_BASE_URL   = "https://api.groq.com/openai/v1"
_GROQ_MODEL      = "llama-3.1-8b-instant"   # fast, free-tier model


def _ai_client():
    """Return (AsyncOpenAI client, model_name) for whichever provider is configured."""
    from openai import AsyncOpenAI
    if GROQ_API_KEY:
        return AsyncOpenAI(api_key=GROQ_API_KEY, base_url=_GROQ_BASE_URL), _GROQ_MODEL
    if OPENAI_API_KEY:
        return AsyncOpenAI(api_key=OPENAI_API_KEY), "gpt-4o-mini"
    return None, None


async def _chat_complete(
    system_msg: str,
    user_msg: str,
    model: str = "gpt-4o-mini",
    json_mode: bool = False,
) -> str:
    """Thin async wrapper — works with OpenAI or Groq (free tier)."""
    client, auto_model = _ai_client()
    if client is None:
        raise ValueError("No AI key configured. Set GROQ_API_KEY (free) or OPENAI_API_KEY.")
    # Use provider-appropriate model; ignore caller's model hint when on Groq
    use_model = auto_model if GROQ_API_KEY else model
    kwargs: Dict[str, Any] = {
        "model": use_model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user",   "content": user_msg},
        ],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = await client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


async def _embed(text: str) -> List[float]:
    """Generate embeddings — only available with OpenAI key (Groq has no embedding API)."""
    from openai import AsyncOpenAI
    if not OPENAI_API_KEY:
        raise ValueError("Embeddings require OPENAI_API_KEY (not available on Groq free tier).")
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    resp = await client.embeddings.create(model="text-embedding-3-small", input=text[:8000])
    return resp.data[0].embedding

# Legal writer: amount credited on draft submission (currency-agnostic points)
LEGAL_WRITER_SUBMIT_BONUS = float(os.environ.get("LEGAL_WRITER_SUBMIT_BONUS", "100"))

# Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")

# TF-IDF globals for real semantic search
laws_vectorizer = None
laws_tfidf_matrix = None
laws_cache = []
cases_vectorizer = None
cases_tfidf_matrix = None
cases_cache = []

# Consultation packages (prices in USD for reference)
CONSULTATION_PACKAGES = {
    "basic": {"name": "Basic Consultation", "amount": 29.00, "duration": "30 min"},
    "standard": {"name": "Standard Consultation", "amount": 49.00, "duration": "60 min"},
    "premium": {"name": "Premium Consultation", "amount": 99.00, "duration": "90 min"},
}

# WebSocket connection manager for video
class VideoConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            self.rooms[room_id] = [ws for ws in self.rooms[room_id] if ws != websocket]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, room_id: str, message: dict, sender: WebSocket):
        if room_id in self.rooms:
            for ws in self.rooms[room_id]:
                if ws != sender:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass

    def get_room_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, []))

video_manager = VideoConnectionManager()

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")

# Password Hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT Token Management
def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth Helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        uid_str = str(payload["sub"])
        # Support both MongoDB ObjectId strings and plain string IDs (Supabase UUIDs / demo IDs)
        try:
            uid = ObjectId(uid_str)
            uid_query = {"_id": uid}
        except Exception:
            uid_query = {"_id": uid_str}

        # For demo users that never touch the DB, reconstruct from JWT claims
        if uid_str.startswith("demo-"):
            demo = DEMO_USERS.get(payload.get("email", ""))
            if demo:
                row = dict(demo)
                row.pop("password", None)
                row["id"] = uid_str
                return row
            raise HTTPException(status_code=401, detail="Demo user not found")

        user = await db.users.find_one(uid_query)
        if user:
            user["id"] = str(user.get("_id", uid_str))
            user.pop("_id", None)
            user.pop("password_hash", None)
            if user.get("firmId") is not None:
                user["firmId"] = str(user["firmId"])
            return user
        lw = await db.legal_writers.find_one(uid_query)
        if lw:
            lw["id"] = str(lw.get("_id", uid_str))
            lw.pop("_id", None)
            lw.pop("password_hash", None)
            lw["role"] = "legal_writer"
            return lw
        raise HTTPException(status_code=401, detail="User not found")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# AI Helper Functions  
def generate_simple_embedding(text: str) -> List[float]:
    """Legacy fallback - generates basic hash embedding"""
    words = text.lower().split()
    vector = [0.0] * 1536
    for word in words:
        hash_val = hash(word) % 1536
        vector[hash_val] += 1.0
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = [v / norm for v in vector]
    return vector

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

async def find_relevant_laws(case_description: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Find top K most relevant laws using TF-IDF similarity"""
    global laws_vectorizer, laws_tfidf_matrix, laws_cache
    
    if laws_vectorizer is None or not laws_cache:
        # Fallback: load from DB
        laws = await db.laws.find({}).to_list(1000)
        if not laws:
            return []
        laws_cache = laws
        texts = [f"{law['title']}. {law['description']}. {' '.join(law.get('keywords', []))}" for law in laws]
        laws_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        laws_tfidf_matrix = laws_vectorizer.fit_transform(texts)
    
    query_vec = laws_vectorizer.transform([case_description])
    similarities = sklearn_cosine_similarity(query_vec, laws_tfidf_matrix)[0]
    
    top_indices = similarities.argsort()[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        if similarities[idx] > 0.01:
            law = laws_cache[idx]
            results.append({
                "ipc_section": law["ipc_section"],
                "title": law["title"],
                "description": law["description"],
                "relevance_score": round(float(similarities[idx]), 4)
            })
    
    return results

async def find_similar_cases(case_description: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Find top K most similar past cases using TF-IDF similarity"""
    global cases_vectorizer, cases_tfidf_matrix, cases_cache
    
    if cases_vectorizer is None or not cases_cache:
        past_cases = await db.past_cases.find({}).to_list(1000)
        if not past_cases:
            return []
        cases_cache = past_cases
        texts = [f"{c['title']}. {c['summary']}. {' '.join(c.get('keywords', []))}" for c in past_cases]
        cases_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        cases_tfidf_matrix = cases_vectorizer.fit_transform(texts)
    
    query_vec = cases_vectorizer.transform([case_description])
    similarities = sklearn_cosine_similarity(query_vec, cases_tfidf_matrix)[0]
    
    top_indices = similarities.argsort()[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        if similarities[idx] > 0.01:
            case = cases_cache[idx]
            results.append({
                "title": case["title"],
                "summary": case["summary"],
                "court": case["court"],
                "citation": case["citation"],
                "year": case["year"],
                "source_url": case["source_url"],
                "relevance_score": round(float(similarities[idx]), 4)
            })
    
    return results

async def find_matched_lawyers(case_type: str, location: str, urgency: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Find top K matched lawyers based on specialization, location, and scoring"""
    # Get all lawyers from database
    lawyers = await db.users.find({"role": "lawyer"}).to_list(1000)
    
    if not lawyers:
        return []
    
    # Score each lawyer
    scored_lawyers = []
    for lawyer in lawyers:
        score = 0.0
        
        # Specialization match (40 points)
        if lawyer.get("specialization") == case_type:
            score += 40
        
        # Location match (30 points)
        if lawyer.get("location", "").lower() == location.lower():
            score += 30
        
        # Rating (20 points max)
        rating = lawyer.get("rating", 0)
        score += (rating / 5.0) * 20
        
        # Urgency bonus for high-rated lawyers (10 points)
        if urgency in ["High", "Critical"] and rating >= 4.0:
            score += 10
        
        scored_lawyers.append({
            "lawyer": lawyer,
            "score": score
        })
    
    # Sort by score and get top K
    scored_lawyers.sort(key=lambda x: x["score"], reverse=True)
    top_lawyers = scored_lawyers[:top_k]
    
    # Format results
    results = []
    for item in top_lawyers:
        lawyer = item["lawyer"]
        results.append({
            "id": str(lawyer["_id"]),
            "name": lawyer["name"],
            "email": lawyer["email"],
            "specialization": lawyer.get("specialization"),
            "location": lawyer.get("location"),
            "rating": lawyer.get("rating", 0.0),
            "match_score": round(item["score"], 2)
        })
    
    return results

async def generate_legal_analysis(case_description: str, case_type: str, location: str, relevant_laws: List[Dict[str, Any]], similar_cases: List[Dict[str, Any]] = []) -> str:
    """Generate legal analysis using GPT-4o-mini"""
    try:
        
        # Prepare context from relevant laws
        laws_context = "\n\n".join([
            f"**{law['ipc_section']} - {law['title']}**\n{law['description']}"
            for law in relevant_laws
        ])
        
        # Prepare context from similar cases
        cases_context = ""
        if similar_cases:
            cases_context = "\n\n**Similar Past Cases:**\n" + "\n\n".join([
                f"**{case['title']}** ({case['citation']}, {case['year']})\n{case['summary']}\nCourt: {case['court']}"
                for case in similar_cases
            ])
        
        system_message = """You are a legal assistant helping users understand which laws may apply to their case. 
Provide clear, simple explanations in plain language that non-lawyers can understand.
DO NOT predict case outcomes or give definitive legal advice.
Focus on explaining relevant laws and suggesting next steps.
When past cases are provided, explain how they relate to the current situation."""
        
        user_message = f"""Case Details:
- Type: {case_type}
- Location: {location}
- Description: {case_description}

Relevant Laws Found:
{laws_context}

{cases_context}

Based on above information, please provide:
1. A brief explanation of how these laws might relate to this case
2. Why these specific laws are relevant
3. How the similar cases (if any) relate to this situation
4. Suggested next steps (e.g., consult a lawyer, gather specific documents)

Keep the language simple and avoid legal jargon. Remember: DO NOT predict outcomes."""
        
        response = await _chat_complete(system_message, user_message)
        return response
        
    except ImportError as e:
        logging.warning(f"AI dependencies not available: {str(e)}. Using fallback analysis.")
        return _fallback_legal_analysis(case_description, case_type, location, relevant_laws, similar_cases)
    except Exception as e:
        logging.error(f"Error generating AI analysis: {str(e)}. Using fallback analysis.")
        return _fallback_legal_analysis(case_description, case_type, location, relevant_laws, similar_cases)

def _fallback_legal_analysis(case_description: str, case_type: str, location: str, relevant_laws: List[Dict[str, Any]], similar_cases: List[Dict[str, Any]]) -> str:
    """Fallback legal analysis using templates"""
    analysis_parts = []
    
    # Introduction
    analysis_parts.append(f"Based on your {case_type.lower()} case in {location}, here's an analysis of the situation:")
    
    # Laws analysis
    if relevant_laws:
        analysis_parts.append("\n**Relevant Laws:**")
        for law in relevant_laws:
            analysis_parts.append(f"- {law['ipc_section']}: {law['title']}")
            analysis_parts.append(f"  {law['description']}")
    
    # Similar cases
    if similar_cases:
        analysis_parts.append("\n**Similar Cases:**")
        for case in similar_cases:
            analysis_parts.append(f"- {case['title']} ({case['citation']})")
            analysis_parts.append(f"  {case['summary']}")
    
    # General advice
    analysis_parts.append("\n**Next Steps:**")
    analysis_parts.append("- Consult with a qualified lawyer for detailed legal advice")
    analysis_parts.append("- Gather all relevant documents and evidence")
    analysis_parts.append("- Consider the timeline and urgency of your case")
    
    if case_type.lower() == "property":
        analysis_parts.append("- Verify property documents and ownership records")
    elif case_type.lower() == "criminal":
        analysis_parts.append("- File an FIR if not already done")
        analysis_parts.append("- Preserve any evidence related to the case")
    elif case_type.lower() == "family":
        analysis_parts.append("- Consider mediation or counseling if applicable")
        analysis_parts.append("- Prepare financial documentation")
    
    analysis_parts.append("\n**Disclaimer:** This analysis is for informational purposes only and does not constitute legal advice.")
    
    return "\n".join(analysis_parts)

async def extract_keywords_ai(text: str) -> Dict[str, Any]:
    """Extract legal keywords using AI"""
    # Try to use AI if available, otherwise fall back to rule-based extraction
    try:
        
        system_message = """You are a legal keyword extraction expert. Extract relevant legal keywords, terms, and phrases from given text. 
Return a JSON with: keywords (list), suggested_category (one of: Criminal, Civil, Family, Property, Employment), confidence (0-100), reasoning (why this category)."""
        
        user_message = f"Extract legal keywords and suggest category for: {text}"
        
        response = await _chat_complete(system_message, user_message, json_mode=True)
        import json
        result = json.loads(response)
        return result
        
    except ImportError as e:
        logging.warning(f"AI dependencies not available: {str(e)}. Using fallback extraction.")
        return _fallback_keyword_extraction(text)
    except Exception as e:
        logging.error(f"Error in AI extraction: {str(e)}. Using fallback extraction.")
        return _fallback_keyword_extraction(text)

def _fallback_keyword_extraction(text: str) -> Dict[str, Any]:
    """Fallback keyword extraction using simple rules"""
    # Simple keyword extraction
    words = text.lower().split()
    # Filter out common words and keep potential legal terms
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}
    keywords = [word for word in words if len(word) > 2 and word not in stop_words][:10]
    
    # Simple category detection based on keywords
    text_lower = text.lower()
    category = "Civil"  # default
    confidence = 50
    reasoning = "Based on keyword analysis"
    
    if any(word in text_lower for word in ['crime', 'criminal', 'police', 'fir', 'arrest', 'theft', 'robbery', 'assault', 'murder']):
        category = "Criminal"
        confidence = 75
        reasoning = "Detected criminal law terms"
    elif any(word in text_lower for word in ['divorce', 'marriage', 'child', 'custody', 'family', 'maintenance', 'alimony']):
        category = "Family"
        confidence = 75
        reasoning = "Detected family law terms"
    elif any(word in text_lower for word in ['land', 'property', 'rent', 'lease', 'house', 'flat', 'ownership', 'title']):
        category = "Property"
        confidence = 75
        reasoning = "Detected property law terms"
    elif any(word in text_lower for word in ['job', 'work', 'employment', 'salary', 'termination', 'harassment', 'office']):
        category = "Employment"
        confidence = 75
        reasoning = "Detected employment law terms"
    
    return {
        "keywords": keywords,
        "suggested_category": category,
        "confidence": confidence,
        "reasoning": reasoning
    }

def calculate_risk_score(category: str, answers: Dict[str, str]) -> Dict[str, Any]:
    """Calculate risk and success probability based on answer values"""
    score = 70  # Base score

    all_values = [str(v).strip().lower() for v in answers.values()]
    yes_count = sum(1 for v in all_values if v == "yes")
    no_count  = sum(1 for v in all_values if v == "no")
    total_yn  = yes_count + no_count

    # Award points proportionally to how many questions were answered positively
    if total_yn > 0:
        yes_ratio = yes_count / total_yn
        score += int(yes_ratio * 30)   # 0 – +30 depending on positive answers

    # Small bonus for non-yes/no (MCQ) answers — shows engagement
    mcq_count = len(answers) - total_yn
    if mcq_count > 0:
        score += min(5, mcq_count * 2)

    # Generate warnings
    warnings = []
    if score <= 70 and no_count > yes_count:
        warnings.append("Limited documentation or evidence may weaken your position")
    if no_count > 0 and yes_count == 0:
        warnings.append("Consider gathering more evidence before proceeding")

    # Generate strengths
    strengths = []
    if score > 75:
        strengths.append("Strong positive indicators across your answers")
    if yes_count >= 2:
        strengths.append("Good documentation and evidence foundation")
    elif yes_count == 1:
        strengths.append("Some supporting evidence available")

    return {
        "success_probability": min(95, max(30, score)),
        "case_strength": "Strong" if score > 75 else "Moderate" if score > 60 else "Weak",
        "warnings": warnings,
        "strengths": strengths,
        "risk_level": "Low" if score > 75 else "Medium" if score > 60 else "High"
    }

def classify_complexity(category: str, answers: Dict[str, str], description: str) -> Dict[str, Any]:
    """Classify case complexity"""
    complexity_score = 0
    
    # Base complexity by category
    category_base = {
        "Criminal": 2,
        "Family": 2,
        "Property": 3,
        "Civil": 2,
        "Employment": 1
    }
    complexity_score = category_base.get(category, 2)
    
    # Adjust based on answers
    if len(answers) > 4:
        complexity_score += 1
    
    # Adjust based on description length
    if len(description) > 500:
        complexity_score += 1
    
    # Determine level
    if complexity_score <= 2:
        level = "Basic"
        duration = "3-6 months"
        cost = "₹10,000 - ₹50,000"
    elif complexity_score <= 4:
        level = "Moderate"
        duration = "6-12 months"
        cost = "₹50,000 - ₹1,50,000"
    else:
        level = "Complex"
        duration = "12-36 months"
        cost = "₹1,50,000+"
    
    return {
        "level": level,
        "estimated_duration": duration,
        "estimated_cost": cost,
        "complexity_score": complexity_score
    }

def generate_nyay_id() -> str:
    """NyayID format NY-{year}-{dddd}, matching utils/generateNyayId.js"""
    year = datetime.now().year
    n = 1000 + int(random.random() * 9000)
    return f"NY-{year}-{n}"


async def issue_unique_nyay_id() -> str:
    """Reserve a NyayID not already stored (checks nyayId and legacy nyay_id)."""
    for _ in range(128):
        nid = generate_nyay_id()
        existing = await db.cases.find_one({"$or": [{"nyayId": nid}, {"nyay_id": nid}]})
        if not existing:
            return nid
    year = datetime.now().year
    return f"NY-{year}-{1000 + int(random.random() * 9000)}-{secrets.token_hex(4)}"


def classify_case(text: str) -> Dict[str, Any]:
    """Light keyword classifier; mirrors utils/classifyCase.js."""
    lower = text.lower()
    case_type = "Non-Criminal"
    domain = "Non-Judicial"
    category = "General"
    flags = {
        "requiresFIR": False,
        "claimRejectedTwice": False,
        "adrSuggested": False,
    }
    if "murder" in lower or "theft" in lower or "assault" in lower:
        case_type = "Criminal"
        flags["requiresFIR"] = True
    if "court" in lower or "petition" in lower:
        domain = "Judicial"
    if "rent" in lower or "eviction" in lower:
        category = "Tenant"
        flags["adrSuggested"] = True
    if "insurance" in lower or "claim" in lower:
        category = "Insurance"
    return {"type": case_type, "domain": domain, "category": category, "flags": flags}


def _case_dashboard_status(case: Dict[str, Any]) -> str:
    return str(case.get("case_status") or case.get("status") or "unknown")


# Pydantic Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    specialization: Optional[str] = None
    location: Optional[str] = None
    firmId: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# In-memory store for password reset tokens: token -> {email, expires}
_password_reset_tokens: Dict[str, Dict] = {}

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    specialization: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[float] = None
    access_token: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: Optional[float] = None
    experience_years: Optional[int] = None
    languages: Optional[List[str]] = None
    cases_handled: Optional[int] = None
    available_days: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    firmId: Optional[str] = None
    firm_name: Optional[str] = None
    earnings: Optional[float] = None

class CaseCreate(BaseModel):
    case_type: str
    description: str
    location: str
    urgency: str
    budget: str

class CaseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    user_id: str
    case_type: str
    description: str
    caseDescription: Optional[str] = None
    location: str
    urgency: str
    budget: str
    status: str
    case_status: Optional[str] = "submitted"
    nyayId: Optional[str] = None
    classification: Optional[Dict[str, Any]] = None
    created_at: str
    client_name: Optional[str] = None
    lawyer_id: Optional[str] = None
    status_history: Optional[List[Dict[str, Any]]] = []

class CaseAnalysisRequest(BaseModel):
    case_type: str
    description: str
    location: str
    urgency: Optional[str] = "Medium"

class LawMatch(BaseModel):
    ipc_section: str
    title: str
    description: str
    relevance_score: float

class PastCaseMatch(BaseModel):
    title: str
    summary: str
    court: str
    citation: str
    year: int
    source_url: str
    relevance_score: float

class CaseAnalysisResponse(BaseModel):
    relevant_laws: List[LawMatch]
    similar_cases: List[PastCaseMatch]
    analysis: str
    case_summary: Dict[str, str]
    matched_lawyers: Optional[List[Dict[str, Any]]] = []

class CaseStatusUpdate(BaseModel):
    case_id: str
    new_status: str
    notes: Optional[str] = None


class CaseNoteCreate(BaseModel):
    content: str
    pinned: Optional[bool] = False
    priority: Optional[str] = "Normal"
    tags: Optional[List[str]] = []


class CaseNoteUpdate(BaseModel):
    content: Optional[str] = None
    pinned: Optional[bool] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None


class LawyerDashboardItem(BaseModel):
    """Assigned cases for the authenticated lawyer (see GET /lawyer/dashboard)."""
    id: str
    nyayId: Optional[str] = None
    caseDescription: str
    classification: Optional[Dict[str, Any]] = None
    status: str
    case_type: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    urgency: Optional[str] = None
    budget: Optional[str] = None
    created_at: Optional[str] = None
    status_history: Optional[List[Dict[str, Any]]] = None


class LawyerCaseStatusPatch(BaseModel):
    new_status: str
    notes: Optional[str] = None


class KeywordExtractionRequest(BaseModel):
    text: str

class CategoryDetectionRequest(BaseModel):
    text: str
    keywords: List[str]

class DynamicQuestionRequest(BaseModel):
    category: str
    question_id: Optional[str] = None
    previous_answers: Optional[Dict[str, str]] = {}
    description: Optional[str] = ""

class StampPaperDiagnosticRequest(BaseModel):
    is_court_case: bool
    is_court_fee: bool
    is_agreement: bool
    is_affidavit: bool
    is_petition: bool

class RiskAnalysisRequest(BaseModel):
    category: str
    answers: Dict[str, str]
    description: str

class NyayIDRequest(BaseModel):
    case_data: Dict[str, Any]
    analysis_result: Dict[str, Any]
    answers: Dict[str, str]

class ConsultationRequest(BaseModel):
    lawyer_id: str
    case_summary: str
    category: str
    urgency: str
    contact_preference: str = "email"

class BookingCreate(BaseModel):
    lawyer_id: str
    scheduled_date: str
    scheduled_time: str
    meeting_type: str
    case_summary: str
    category: str

class LawyerAvailabilityUpdate(BaseModel):
    available_days: List[str]
    start_time: str
    end_time: str
    slot_duration: int = 60

class AffidavitRequest(BaseModel):
    affiant_name: str
    affiant_address: str
    purpose: str
    facts: List[str]
    court_name: Optional[str] = None
    case_number: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str
    target_language: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ReferralRequest(BaseModel):
    case_id: str
    referred_to_lawyer_id: str
    notes: Optional[str] = ""

class CreateCheckoutRequest(BaseModel):
    package_id: str
    lawyer_id: str
    origin_url: str


class PipSubmitRequest(BaseModel):
    partyAStatement: str
    partyBStatement: str


class PipSubmitResponse(BaseModel):
    draft: str


# ── PIP Self-Representation Models ──────────────────────────────────────────

class PipInitiateRequest(BaseModel):
    case_type: str
    description: str
    risk_level: str

class PipWorkflowStep(BaseModel):
    step: int
    title: str
    description: str
    required_docs: List[str]
    action: str

class PipInitiateResponse(BaseModel):
    case_id: str
    workflow_type: str
    risk_level: str
    is_self_represented: bool
    workflow_stage: int
    total_steps: int
    documentation_status: str
    message: str

class PipWorkflowResponse(BaseModel):
    case_id: str
    workflow_type: str
    workflow_stage: int
    total_steps: int
    documentation_status: str
    steps: List[PipWorkflowStep]
    can_switch_to_lawyer: bool

class PipNextStepRequest(BaseModel):
    case_id: str

class PipNextStepResponse(BaseModel):
    case_id: str
    workflow_stage: int
    total_steps: int
    is_complete: bool
    documentation_status: str
    message: str

class PipRequestDocRequest(BaseModel):
    case_id: str
    notes: Optional[str] = ""


# ── PIP Workflow Engine ──────────────────────────────────────────────────────

PIP_WORKFLOWS: Dict[str, Any] = {
    "consumer_complaint": {
        "title": "Consumer Complaint",
        "description": "File a complaint against a seller or service provider under the Consumer Protection Act.",
        "steps": [
            {
                "step": 1,
                "title": "Gather Evidence",
                "description": "Collect all receipts, bills, warranties, and any communication with the seller or service provider. Make copies of everything.",
                "required_docs": ["Purchase receipt/bill", "Warranty card (if applicable)", "Email/WhatsApp screenshots", "Photos of defective product"],
                "action": "Upload Documents"
            },
            {
                "step": 2,
                "title": "Send Legal Notice",
                "description": "Draft and send a formal legal notice to the seller or service provider via registered post, requesting resolution within 15 days.",
                "required_docs": ["Draft legal notice", "Postal receipt"],
                "action": "Draft Notice"
            },
            {
                "step": 3,
                "title": "File Complaint Online",
                "description": "File your complaint on the National Consumer Helpline (consumerhelpline.gov.in) or your local Consumer Forum. Attach all evidence.",
                "required_docs": ["Complaint form", "All evidence documents", "Copy of legal notice sent"],
                "action": "File Complaint"
            },
            {
                "step": 4,
                "title": "Attend Hearing",
                "description": "Attend the scheduled hearing at the Consumer Forum. Present your case clearly, stay calm, and bring all original documents.",
                "required_docs": ["All original documents", "Written statement of facts"],
                "action": "Mark Attended"
            }
        ]
    },
    "rental_dispute": {
        "title": "Rental Dispute",
        "description": "Resolve disputes between landlord and tenant regarding rent, deposit refund, maintenance, or eviction.",
        "steps": [
            {
                "step": 1,
                "title": "Review Rental Agreement",
                "description": "Carefully read your rental or lease agreement. Identify the clauses related to your dispute — notice period, deposit, maintenance, and rent.",
                "required_docs": ["Rental/lease agreement", "Rent payment receipts"],
                "action": "Upload Agreement"
            },
            {
                "step": 2,
                "title": "Document the Dispute",
                "description": "Record all incidents with dates and amounts. Take photographs if there is property damage. Save all communication with the other party.",
                "required_docs": ["Written account of events", "Photographs (if applicable)", "SMS/email communication records"],
                "action": "Upload Evidence"
            },
            {
                "step": 3,
                "title": "Send Formal Notice",
                "description": "Send a formal notice via registered post to the other party. Clearly state your grievance and the resolution you seek within 15 days.",
                "required_docs": ["Formal written notice", "Postal receipt"],
                "action": "Draft Notice"
            },
            {
                "step": 4,
                "title": "Approach Rent Authority",
                "description": "If unresolved, file an application with the local Rent Control Authority or District Court. Bring all documents and two copies of the application.",
                "required_docs": ["Completed application form", "All previous documents", "Court fee payment receipt"],
                "action": "File Application"
            }
        ]
    },
    "affidavit_filing": {
        "title": "Affidavit Filing",
        "description": "Prepare and file a legally valid affidavit for personal, legal, or administrative purposes.",
        "steps": [
            {
                "step": 1,
                "title": "Identify Affidavit Type",
                "description": "Determine the purpose of your affidavit (name change, address proof, financial declaration, etc.). Check if your authority requires a specific format.",
                "required_docs": ["Identity proof (Aadhaar/PAN card)", "Address proof"],
                "action": "Confirm Type"
            },
            {
                "step": 2,
                "title": "Draft the Affidavit",
                "description": "Write the affidavit in simple, clear language starting with 'I, [your name]...'. State all facts truthfully. Use our Affidavit Builder for a guided template.",
                "required_docs": ["Draft affidavit text"],
                "action": "Upload Draft"
            },
            {
                "step": 3,
                "title": "Purchase Stamp Paper",
                "description": "Buy the appropriate value of non-judicial stamp paper from an authorized vendor. The required value varies by state (typically ₹10 to ₹100).",
                "required_docs": ["Stamp paper (appropriate denomination)"],
                "action": "Confirm Purchase"
            },
            {
                "step": 4,
                "title": "Notarise and Submit",
                "description": "Visit a Notary Public with your drafted affidavit and original ID proof. Sign the affidavit in their presence. They will attest and stamp it, making it legally valid.",
                "required_docs": ["Final affidavit on stamp paper", "Original ID proof for verification"],
                "action": "Mark Complete"
            }
        ]
    }
}

CASE_TYPE_TO_WORKFLOW: Dict[str, str] = {
    "Consumer": "consumer_complaint",
    "consumer": "consumer_complaint",
    "Consumer Complaint": "consumer_complaint",
    "Rental": "rental_dispute",
    "rental": "rental_dispute",
    "Rental Dispute": "rental_dispute",
    "Property": "rental_dispute",
    "Affidavit": "affidavit_filing",
    "affidavit": "affidavit_filing",
    "Affidavit Filing": "affidavit_filing",
    "Civil": "consumer_complaint",
    "Family": "affidavit_filing",
    "Employment": "consumer_complaint",
}


def resolve_workflow_type(case_type: str) -> str:
    return CASE_TYPE_TO_WORKFLOW.get(case_type, "consumer_complaint")


class DraftCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    body: Optional[str] = ""


class DraftItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    body: Optional[str] = None
    status: str
    legal_writer_id: Optional[str] = None
    created_at: str
    submitted_at: Optional[str] = None
    requested_by: Optional[str] = None


def _draft_to_item(doc: Dict[str, Any]) -> DraftItem:
    ca = doc.get("created_at")
    ca_s = ca.isoformat() if hasattr(ca, "isoformat") else str(ca) if ca else ""
    sa = doc.get("submitted_at")
    sa_s = sa.isoformat() if hasattr(sa, "isoformat") else str(sa) if sa else None
    return DraftItem(
        id=str(doc["_id"]),
        title=doc.get("title") or "",
        description=doc.get("description"),
        body=doc.get("body"),
        status=doc.get("status") or "open",
        legal_writer_id=doc.get("legal_writer_id"),
        created_at=ca_s,
        submitted_at=sa_s,
        requested_by=doc.get("requested_by"),
    )


def user_document_to_response(user: Dict[str, Any], access_token: Optional[str] = None) -> UserResponse:
    uid = user.get("id")
    if uid is None and user.get("_id") is not None:
        uid = str(user["_id"])
    if not uid:
        uid = ""
    firm_id = user.get("firmId")
    if firm_id is not None and not isinstance(firm_id, str):
        firm_id = str(firm_id)
    default_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    kwargs: Dict[str, Any] = {
        "id": uid,
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "specialization": user.get("specialization"),
        "location": user.get("location"),
        "rating": user.get("rating") if user.get("rating") is not None else (0.0 if user.get("role") == "lawyer" else None),
        "bio": user.get("bio"),
        "consultation_fee": user.get("consultation_fee"),
        "experience_years": user.get("experience_years"),
        "languages": user.get("languages"),
        "cases_handled": user.get("cases_handled"),
        "available_days": user.get("available_days") if user.get("available_days") is not None else (
            default_days if user.get("role") == "lawyer" else None
        ),
        "start_time": user.get("start_time") if user.get("start_time") is not None else ("09:00" if user.get("role") == "lawyer" else None),
        "end_time": user.get("end_time") if user.get("end_time") is not None else ("18:00" if user.get("role") == "lawyer" else None),
        "firmId": firm_id,
        "firm_name": user.get("firm_name"),
    }
    if user.get("role") == "legal_writer":
        kwargs["earnings"] = float(user.get("earnings") or 0)
    else:
        kwargs["earnings"] = user.get("earnings")
    if access_token is not None:
        kwargs["access_token"] = access_token
    return UserResponse(**kwargs)


# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Auth Endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    
    existing = await db.users.find_one({"email": email})
    lw_existing = await db.legal_writers.find_one({"email": email})
    if existing or lw_existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.role not in ["client", "lawyer", "legal_writer"]:
        raise HTTPException(status_code=400, detail="Role must be client, lawyer, or legal_writer")
    
    hashed = hash_password(user_data.password)
    
    if user_data.role == "legal_writer":
        lw_doc = {
            "name": user_data.name,
            "email": email,
            "password_hash": hashed,
            "earnings": 0.0,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.legal_writers.insert_one(lw_doc)
        user_id = str(result.inserted_id)
        access_token = create_access_token(user_id, email, user_data.role)
        refresh_token = create_refresh_token(user_id)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=900,
            path="/",
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=604800,
            path="/",
        )
        saved = await db.legal_writers.find_one({"_id": result.inserted_id})
        saved["id"] = user_id
        saved["role"] = "legal_writer"
        return user_document_to_response(saved, access_token=access_token)

    user_doc = {
        "name": user_data.name,
        "email": email,
        "password_hash": hashed,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc),
    }
    
    if user_data.role == "lawyer":
        user_doc["specialization"] = user_data.specialization or ""
        user_doc["location"] = user_data.location or ""
        user_doc["rating"] = 0.0
        if user_data.firmId:
            try:
                firm_oid = ObjectId(user_data.firmId)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid firmId")
            firm = await db.firms.find_one({"_id": firm_oid})
            if not firm:
                raise HTTPException(status_code=400, detail="Firm not found")
            user_doc["firmId"] = firm_oid
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email, user_data.role)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    saved = await db.users.find_one({"_id": result.inserted_id})
    saved["id"] = user_id
    return user_document_to_response(saved, access_token=access_token)

DEMO_USERS = {
    "lawyer@test.com": {
        "_id": "demo-lawyer-001", "id": "demo-lawyer-001",
        "email": "lawyer@test.com", "name": "Demo Lawyer",
        "role": "lawyer", "password": "password123",
        "specialization": "Criminal Law", "location": "Mumbai",
        "experience": 10, "rating": 4.8, "status": "active",
        "bar_number": "BAR/MH/2014/001", "languages": ["English", "Hindi", "Marathi"],
    },
    "client@test.com": {
        "_id": "demo-client-001", "id": "demo-client-001",
        "email": "client@test.com", "name": "Demo Client",
        "role": "client", "password": "password123",
        "location": "Delhi", "status": "active",
    },
    "writer@test.com": {
        "_id": "demo-writer-001", "id": "demo-writer-001",
        "email": "writer@test.com", "name": "Demo Content Writer",
        "role": "legal_writer", "password": "password123",
        "specializations": ["affidavit", "legal notice", "contract", "petition"],
        "languages": ["English", "Hindi", "Marathi"],
        "experience": 5, "status": "active",
    },
}

@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin, response: Response):
    email = credentials.email.lower()
    
    user = await db.users.find_one({"email": email})
    lw = await db.legal_writers.find_one({"email": email}) if not user else None
    
    if not user and not lw:
        # Fallback: allow hardcoded demo accounts even when DB tables don't exist yet
        demo = DEMO_USERS.get(email)
        if demo and credentials.password == demo["password"]:
            demo_id = demo["id"]
            demo_role = demo["role"]
            access_token = create_access_token(demo_id, email, demo_role)
            refresh_token = create_refresh_token(demo_id)
            response.set_cookie(key="access_token", value=access_token, httponly=True,
                secure=False, samesite="lax", max_age=900, path="/")
            response.set_cookie(key="refresh_token", value=refresh_token, httponly=True,
                secure=False, samesite="lax", max_age=604800, path="/")
            row = dict(demo)
            row.pop("password", None)
            row["password_hash"] = ""
            return user_document_to_response(row, access_token=access_token)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user:
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_id = str(user["_id"])
        role = user["role"]
        row = user
    else:
        if not verify_password(credentials.password, lw["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_id = str(lw["_id"])
        role = "legal_writer"
        row = lw
        row["role"] = "legal_writer"
    
    access_token = create_access_token(user_id, email, role)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    row["id"] = user_id
    return user_document_to_response(row, access_token=access_token)

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        _password_reset_tokens[token] = {
            "email": email,
            "expires": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        }
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5000")
        reset_url = f"{frontend_url}/reset-password?token={token}"
        logging.info(f"[DEV] Password reset link for {email}: {reset_url}")
        try:
            import smtplib
        except Exception:
            pass
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password_confirm(data: ResetPasswordRequest):
    token_data = _password_reset_tokens.get(data.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link. Please request a new one.")
    expires = datetime.fromisoformat(token_data["expires"])
    if datetime.now(timezone.utc) > expires:
        _password_reset_tokens.pop(data.token, None)
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    email = token_data["email"]
    new_hash = hash_password(data.new_password)
    await db.users.update_one({"email": email}, {"$set": {"password_hash": new_hash}})
    _password_reset_tokens.pop(data.token, None)
    return {"message": "Password updated successfully. You can now log in with your new password."}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_document_to_response(current_user)

# Case Endpoints
@api_router.post("/cases", response_model=CaseResponse)
async def create_case(case_data: CaseCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can create cases")
    
    nyay_id = await issue_unique_nyay_id()
    classification = classify_case(case_data.description)
    case_doc = {
        "user_id": current_user["id"],
        "case_type": case_data.case_type,
        "description": case_data.description,
        "caseDescription": case_data.description,
        "classification": classification,
        "location": case_data.location,
        "urgency": case_data.urgency,
        "budget": case_data.budget,
        "status": "open",
        "case_status": "submitted",
        "nyayId": nyay_id,
        "nyay_id": nyay_id,
        "status_history": [
            {
                "status": "submitted",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": "Case submitted by client"
            }
        ],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.cases.insert_one(case_doc)
    
    return CaseResponse(
        id=str(result.inserted_id),
        user_id=current_user["id"],
        case_type=case_data.case_type,
        description=case_data.description,
        caseDescription=case_data.description,
        location=case_data.location,
        urgency=case_data.urgency,
        budget=case_data.budget,
        status="open",
        case_status="submitted",
        nyayId=nyay_id,
        classification=classification,
        created_at=case_doc["created_at"].isoformat(),
        client_name=current_user["name"],
        status_history=case_doc["status_history"]
    )

@api_router.get("/cases/{case_id}/status")
async def get_case_status(case_id: str, current_user: dict = Depends(get_current_user)):
    """Lightweight live status endpoint — client or assigned lawyer only."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case ID")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = current_user["id"]
    role = current_user.get("role")
    if role == "client" and case.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "lawyer" and case.get("lawyer_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    lawyer_name = None
    if case.get("lawyer_id"):
        lawyer = await db.users.find_one({"_id": ObjectId(case["lawyer_id"])}, {"name": 1})
        lawyer_name = lawyer["name"] if lawyer else None

    updated_at = case.get("updated_at") or case.get("created_at")
    return {
        "case_id": case_id,
        "case_status": case.get("case_status", "submitted"),
        "status_history": case.get("status_history", []),
        "lawyer_name": lawyer_name,
        "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at),
    }


@api_router.put("/cases/{case_id}/status")
async def update_case_status(case_id: str, status_update: CaseStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Update case status (lawyer only)"""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can update case status")
    
    try:
        # Get current case
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Add to status history
        status_history = case.get("status_history", [])
        status_history.append({
            "status": status_update.new_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": status_update.notes or "Status updated by lawyer",
            "updated_by": current_user["name"]
        })
        
        # Update case
        result = await db.cases.update_one(
            {"_id": ObjectId(case_id)},
            {"$set": {
                "case_status": status_update.new_status,
                "status_history": status_history,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update case status")

        # Auto-create satisfaction survey when case is completed/closed
        if status_update.new_status in ("completed", "closed") and case.get("user_id") and case.get("lawyer_id"):
            existing_survey = await db.surveys.find_one({"case_id": case_id})
            if not existing_survey:
                lawyer_doc = await db.users.find_one({"_id": ObjectId(case["lawyer_id"])}, {"name": 1})
                await db.surveys.insert_one({
                    "case_id": case_id,
                    "client_id": case["user_id"],
                    "lawyer_id": case["lawyer_id"],
                    "lawyer_name": lawyer_doc.get("name", "Your Lawyer") if lawyer_doc else "Your Lawyer",
                    "case_type": case.get("case_type", "Case"),
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                })
                await create_notification(
                    case["user_id"],
                    "⭐ How did your case go?",
                    f"Your {case.get('case_type', 'case')} case is complete — please rate your lawyer.",
                    "info",
                )

        return {"message": "Case status updated successfully", "new_status": status_update.new_status}
    
    except Exception as e:
        logging.error(f"Error updating case status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cases", response_model=List[CaseResponse])
async def get_cases(
    location: Optional[str] = None,
    urgency: Optional[str] = None,
    case_type: Optional[str] = None,
    type: Optional[str] = None,
    domain: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can view cases")
    
    query: Dict[str, Any] = {"status": "open"}
    
    if location:
        query["location"] = location
    if urgency:
        query["urgency"] = urgency
    if case_type:
        query["case_type"] = case_type
    if type:
        query["classification.type"] = type
    if domain:
        query["classification.domain"] = domain
    if category:
        query["classification.category"] = category
    
    cases = await db.cases.find(query).sort("created_at", -1).to_list(100)
    
    result = []
    for case in cases:
        try:
            client = await db.users.find_one({"_id": ObjectId(case["user_id"])}) if case.get("user_id") else None
        except Exception:
            client = None
        client_name = client["name"] if client else "Unknown"

        ny_val = case.get("nyayId") or case.get("nyay_id")
        created = case.get("created_at")
        created_iso = created.isoformat() if hasattr(created, "isoformat") else (created or datetime.now(timezone.utc).isoformat())
        result.append(CaseResponse(
            id=str(case["_id"]),
            user_id=case.get("user_id", ""),
            case_type=case.get("case_type", "General"),
            description=case.get("description", case.get("caseDescription", "")),
            caseDescription=case.get("caseDescription") or case.get("description", ""),
            location=case.get("location", "Not specified"),
            urgency=case.get("urgency", "Medium"),
            budget=case.get("budget", "Not specified"),
            status=case.get("status", "open"),
            case_status=case.get("case_status", "submitted"),
            nyayId=ny_val,
            classification=case.get("classification"),
            created_at=created_iso,
            client_name=client_name,
            status_history=case.get("status_history", []),
        ))

    return result

@api_router.get("/public/case/{nyay_id}")
async def public_case_status(nyay_id: str):
    """Public endpoint — no auth required. Used for NyayID case sharing."""
    case = await db.cases.find_one({"$or": [{"nyayId": nyay_id}, {"nyay_id": nyay_id}]})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found. Please verify the NyayID.")
    lawyer_name = None
    lawyer_specialization = None
    lawyer_location = None
    if case.get("lawyer_id"):
        try:
            lawyer = await db.users.find_one({"_id": ObjectId(case["lawyer_id"])})
            if lawyer:
                lawyer_name = lawyer.get("name")
                lawyer_specialization = lawyer.get("specialization")
                lawyer_location = lawyer.get("location")
        except Exception:
            pass
    created = case.get("created_at")
    created_iso = created.isoformat() if hasattr(created, "isoformat") else str(created or "")
    raw_desc = case.get("description") or case.get("caseDescription") or ""
    desc_preview = raw_desc[:300] + ("..." if len(raw_desc) > 300 else "")
    return {
        "nyay_id": nyay_id,
        "case_status": case.get("case_status", "submitted"),
        "category": case.get("category", case.get("case_type", "General")),
        "description_preview": desc_preview,
        "location": case.get("location", ""),
        "urgency": case.get("urgency", "Medium"),
        "created_at": created_iso,
        "status_history": case.get("status_history", []),
        "timeline_events": case.get("timeline_events", []),
        "lawyer_name": lawyer_name,
        "lawyer_specialization": lawyer_specialization,
        "lawyer_location": lawyer_location,
    }


@api_router.get("/cases/{case_id}/timeline")
async def get_case_timeline(case_id: str, current_user: dict = Depends(get_current_user)):
    """Get timeline events for a case."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"timeline_events": case.get("timeline_events", []), "status_history": case.get("status_history", [])}


@api_router.post("/cases/{case_id}/timeline")
async def add_timeline_event(case_id: str, event: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Add a timeline milestone/event to a case."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = str(current_user.get("id") or current_user.get("_id") or "")
    if current_user.get("role") == "client" and case.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    timeline_events = list(case.get("timeline_events") or [])
    new_event = {
        "id": str(ObjectId()),
        "title": str(event.get("title", ""))[:200],
        "description": str(event.get("description", ""))[:500],
        "date": str(event.get("date", "")),
        "type": str(event.get("type", "milestone")),
        "completed": bool(event.get("completed", False)),
        "added_by": current_user.get("name", "User"),
        "added_by_role": current_user.get("role", "client"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    timeline_events.append(new_event)
    await db.cases.update_one({"_id": ObjectId(case_id)}, {"$set": {"timeline_events": timeline_events}})
    return new_event


@api_router.delete("/cases/{case_id}/timeline/{event_id}")
async def delete_timeline_event(case_id: str, event_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a timeline event."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = str(current_user.get("id") or current_user.get("_id") or "")
    if current_user.get("role") == "client" and case.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    updated = [e for e in (case.get("timeline_events") or []) if e.get("id") != event_id]
    await db.cases.update_one({"_id": ObjectId(case_id)}, {"$set": {"timeline_events": updated}})
    return {"ok": True}


@api_router.patch("/cases/{case_id}/timeline/{event_id}")
async def update_timeline_event(case_id: str, event_id: str, event: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update a timeline event (mark complete, edit details)."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = str(current_user.get("id") or current_user.get("_id") or "")
    if current_user.get("role") == "client" and case.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    events = list(case.get("timeline_events") or [])
    for i, e in enumerate(events):
        if e.get("id") == event_id:
            for k, v in event.items():
                if k not in ("id", "created_at", "added_by", "added_by_role"):
                    events[i][k] = v
            break
    await db.cases.update_one({"_id": ObjectId(case_id)}, {"$set": {"timeline_events": events}})
    return {"ok": True}


@api_router.get("/lawyers", response_model=List[UserResponse])
async def get_lawyers():
    lawyers = await db.users.find({"role": "lawyer"}).to_list(100)
    
    return [user_document_to_response(lawyer) for lawyer in lawyers]

@api_router.get("/firms")
async def list_firms():
    firms = await db.firms.find({}).sort("name", 1).to_list(500)
    return [
        {
            "id": str(f["_id"]),
            "name": f.get("name") or "",
            "email": f.get("email"),
            "location": f.get("location"),
        }
        for f in firms
    ]


@api_router.get("/firms/{firm_id}/lawyers", response_model=List[UserResponse])
async def list_lawyers_for_firm(firm_id: str):
    try:
        firm_oid = ObjectId(firm_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid firm id")
    if not await db.firms.find_one({"_id": firm_oid}):
        raise HTTPException(status_code=404, detail="Firm not found")
    lawyers = await db.users.find({"role": "lawyer", "firmId": firm_oid}).to_list(200)
    return [user_document_to_response(lawyer) for lawyer in lawyers]


# ============ REVIEWS ============

class ReviewCreate(BaseModel):
    rating: int
    comment: str

@api_router.post("/lawyers/{lawyer_id}/reviews")
async def create_review(lawyer_id: str, review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "client":
        raise HTTPException(status_code=403, detail="Only clients can submit reviews")
    if not (1 <= review.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    try:
        lawyer = await db.users.find_one({"_id": ObjectId(lawyer_id), "role": "lawyer"})
        if not lawyer:
            raise HTTPException(status_code=404, detail="Lawyer not found")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid lawyer id")
    existing = await db.reviews.find_one({"lawyer_id": lawyer_id, "client_id": current_user["id"]})
    if existing:
        await db.reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": review.rating, "comment": review.comment, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.reviews.insert_one({
            "lawyer_id": lawyer_id,
            "client_id": current_user["id"],
            "client_name": current_user.get("name", "Anonymous"),
            "rating": review.rating,
            "comment": review.comment,
            "created_at": datetime.now(timezone.utc)
        })
    all_reviews = await db.reviews.find({"lawyer_id": lawyer_id}).to_list(1000)
    if all_reviews:
        avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        await db.users.update_one({"_id": ObjectId(lawyer_id)}, {"$set": {"rating": round(avg_rating, 1)}})
    return {"message": "Review submitted successfully", "rating": review.rating}

@api_router.get("/lawyers/{lawyer_id}/reviews")
async def get_lawyer_reviews(lawyer_id: str):
    reviews = await db.reviews.find({"lawyer_id": lawyer_id}).sort("created_at", -1).to_list(100)
    return [
        {
            "id": str(r["_id"]),
            "client_name": r.get("client_name", "Anonymous"),
            "rating": r["rating"],
            "comment": r.get("comment", ""),
            "created_at": r.get("created_at", datetime.now(timezone.utc)).isoformat() if r.get("created_at") else ""
        }
        for r in reviews
    ]

# ============ IPC BROWSER ============

@api_router.get("/ipc-laws")
async def browse_ipc_laws(q: str = "", page: int = 1, limit: int = 20):
    query = {}
    if q:
        query["$or"] = [
            {"ipc_section": {"$regex": q, "$options": "i"}},
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"keywords": {"$elemMatch": {"$regex": q, "$options": "i"}}}
        ]
    total = await db.laws.count_documents(query)
    laws = await db.laws.find(query, {"embedding": 0}).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
        "laws": [
            {
                "id": str(l["_id"]),
                "ipc_section": l.get("ipc_section", ""),
                "title": l.get("title", ""),
                "description": l.get("description", ""),
                "keywords": l.get("keywords", []),
                "punishment": l.get("punishment", ""),
                "bailable": l.get("bailable"),
                "cognizable": l.get("cognizable"),
            }
            for l in laws
        ]
    }

# ============ LEGAL WRITER DASHBOARD ============

@api_router.get("/legal-writer/dashboard")
async def legal_writer_dashboard(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "legal_writer":
        raise HTTPException(status_code=403, detail="Only legal writers can access this")
    writer_id = current_user["id"]
    open_drafts = await db.drafts.count_documents({"status": "open"})
    my_drafts = await db.drafts.count_documents({"legal_writer_id": writer_id})
    submitted_drafts = await db.drafts.count_documents({"legal_writer_id": writer_id, "status": "submitted"})
    try:
        writer_doc = await db.legal_writers.find_one({"_id": ObjectId(writer_id)})
        earnings = writer_doc.get("earnings", 0) if writer_doc else 0
    except Exception:
        earnings = 0
    recent_drafts = await db.drafts.find(
        {"$or": [{"status": "open"}, {"legal_writer_id": writer_id}]}
    ).sort("created_at", -1).limit(10).to_list(10)
    return {
        "stats": {
            "open_drafts": open_drafts,
            "my_drafts": my_drafts,
            "submitted_drafts": submitted_drafts,
            "earnings": earnings
        },
        "recent_drafts": [_draft_to_item(d).dict() for d in recent_drafts]
    }

@api_router.get("/lawyers/{lawyer_id}")
async def get_lawyer_profile(lawyer_id: str):
    try:
        lawyer = await db.users.find_one({"_id": ObjectId(lawyer_id), "role": "lawyer"})
        if not lawyer:
            raise HTTPException(status_code=404, detail="Lawyer not found")
        return user_document_to_response(lawyer)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/lawyers/{lawyer_id}/slots")
async def get_lawyer_slots(lawyer_id: str, date: str):
    from datetime import date as date_type
    try:
        lawyer = await db.users.find_one({"_id": ObjectId(lawyer_id), "role": "lawyer"})
        if not lawyer:
            raise HTTPException(status_code=404, detail="Lawyer not found")
        parsed = datetime.strptime(date, "%Y-%m-%d")
        day_name = parsed.strftime("%A")
        available_days = lawyer.get("available_days", ["Monday","Tuesday","Wednesday","Thursday","Friday"])
        if day_name not in available_days:
            return {"slots": [], "available": False}
        start_time = lawyer.get("start_time", "09:00")
        end_time = lawyer.get("end_time", "18:00")
        slot_duration = lawyer.get("slot_duration", 60)
        sh, sm = map(int, start_time.split(":"))
        eh, em = map(int, end_time.split(":"))
        start_mins = sh * 60 + sm
        end_mins = eh * 60 + em
        all_slots = []
        t = start_mins
        while t + slot_duration <= end_mins:
            hh = t // 60
            mm = t % 60
            all_slots.append(f"{hh:02d}:{mm:02d}")
            t += slot_duration
        booked = await db.bookings.find({"lawyer_id": lawyer_id, "scheduled_date": date, "status": {"$ne": "cancelled"}}).to_list(100)
        booked_times = {b["scheduled_time"] for b in booked}
        available_slots = [s for s in all_slots if s not in booked_times]
        return {"slots": available_slots, "available": True, "booked": list(booked_times)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/lawyers/availability")
async def update_lawyer_availability(data: LawyerAvailabilityUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can update availability")
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {
            "available_days": data.available_days,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "slot_duration": data.slot_duration
        }}
    )
    return {"message": "Availability updated"}

@api_router.post("/bookings")
async def create_booking(data: BookingCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can make bookings")
    try:
        lawyer = await db.users.find_one({"_id": ObjectId(data.lawyer_id)})
        if not lawyer:
            raise HTTPException(status_code=404, detail="Lawyer not found")
        existing = await db.bookings.find_one({
            "lawyer_id": data.lawyer_id,
            "scheduled_date": data.scheduled_date,
            "scheduled_time": data.scheduled_time,
            "status": {"$ne": "cancelled"}
        })
        if existing:
            raise HTTPException(status_code=409, detail="This slot is already booked")
        video_room_id = str(uuid.uuid4()) if data.meeting_type == "video" else None
        booking_doc = {
            "client_id": current_user["id"],
            "client_name": current_user["name"],
            "client_email": current_user["email"],
            "lawyer_id": data.lawyer_id,
            "lawyer_name": lawyer["name"],
            "scheduled_date": data.scheduled_date,
            "scheduled_time": data.scheduled_time,
            "meeting_type": data.meeting_type,
            "case_summary": data.case_summary,
            "category": data.category,
            "consultation_fee": lawyer.get("consultation_fee", 0),
            "status": "confirmed",
            "video_room_id": video_room_id,
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.bookings.insert_one(booking_doc)
        await create_notification(
            data.lawyer_id,
            "New Appointment Booked",
            f"{current_user['name']} booked a {data.meeting_type} consultation on {data.scheduled_date} at {data.scheduled_time}.",
            "consultation"
        )
        return {
            "id": str(result.inserted_id),
            "message": f"Appointment booked with {lawyer['name']}",
            "video_room_id": video_room_id,
            "status": "confirmed"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/bookings")
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    query = {"client_id": current_user["id"]} if current_user["role"] == "client" else {"lawyer_id": current_user["id"]}
    bookings = await db.bookings.find(query).sort("scheduled_date", 1).to_list(100)
    result = []
    for b in bookings:
        result.append({
            "id": str(b["_id"]),
            "client_name": b.get("client_name"),
            "lawyer_name": b.get("lawyer_name"),
            "scheduled_date": b.get("scheduled_date"),
            "scheduled_time": b.get("scheduled_time"),
            "meeting_type": b.get("meeting_type"),
            "category": b.get("category"),
            "case_summary": b.get("case_summary"),
            "consultation_fee": b.get("consultation_fee"),
            "status": b.get("status"),
            "video_room_id": b.get("video_room_id"),
            "created_at": b["created_at"].isoformat() if b.get("created_at") else None
        })
    return result

@api_router.put("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    try:
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        result = await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": {"status": "cancelled"}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking:
            other_id = booking.get("client_id") if current_user["role"] == "lawyer" else booking.get("lawyer_id")
            if other_id:
                await create_notification(
                    other_id,
                    "Appointment Cancelled",
                    f"Your appointment on {booking.get('scheduled_date', '')} at {booking.get('scheduled_time', '')} has been cancelled.",
                    "consultation"
                )
        return {"message": "Booking cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can accept bookings")
    try:
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        result = await db.bookings.update_one(
            {"_id": ObjectId(booking_id), "lawyer_id": current_user["id"]},
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc)}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Booking not found or not authorized")
        client_id = booking.get("client_id")
        if client_id:
            await create_notification(
                client_id,
                "Lawyer Accepted Your Booking! 🎉",
                f"{current_user['name']} has accepted your appointment on {booking.get('scheduled_date', '')} at {booking.get('scheduled_time', '')}. You're all set!",
                "consultation"
            )
        return {"message": "Booking accepted", "booking_id": booking_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/cases/{case_id}/accept")
async def accept_case(case_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can accept cases")

    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case id")

    try:
        case = await db.cases.find_one({"_id": oid, "status": "open"})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or already accepted")

        now = datetime.now(timezone.utc)
        status_history = case.get("status_history", [])
        status_history.append({
            "new_status": "accepted",
            "changed_at": now.isoformat(),
            "note": f"Case accepted by {current_user.get('name', 'Lawyer')}",
            "updated_by": current_user.get("name", "lawyer"),
        })

        result = await db.cases.update_one(
            {"_id": oid, "status": "open"},
            {"$set": {
                "status": "accepted",
                "case_status": "accepted",
                "lawyer_id": current_user["id"],
                "lawyer_name": current_user.get("name"),
                "status_history": status_history,
                "updated_at": now,
            }}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Case not found or already accepted")

        return {"message": "Case accepted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/lawyer/dashboard", response_model=List[LawyerDashboardItem])
async def lawyer_dashboard(current_user: dict = Depends(get_current_user)):
    """Cases assigned to this lawyer (lawyer_id matches)."""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can view the dashboard")
    assigned = await db.cases.find({"lawyer_id": current_user["id"]}).sort("created_at", -1).to_list(200)
    items: List[LawyerDashboardItem] = []
    for c in assigned:
        ny = c.get("nyayId") or c.get("nyay_id")
        desc = c.get("caseDescription") or c.get("description") or ""
        client_name = None
        try:
            client = await db.users.find_one({"_id": ObjectId(c["user_id"])})
            if client:
                client_name = client.get("name")
        except Exception:
            pass
        created = c.get("created_at")
        created_iso = created.isoformat() if hasattr(created, "isoformat") else (created or None)
        items.append(
            LawyerDashboardItem(
                id=str(c["_id"]),
                nyayId=ny,
                caseDescription=desc,
                classification=c.get("classification"),
                status=_case_dashboard_status(c),
                case_type=c.get("case_type"),
                client_name=client_name,
                location=c.get("location"),
                urgency=c.get("urgency"),
                budget=c.get("budget"),
                created_at=created_iso,
                status_history=c.get("status_history", []),
            )
        )
    return items


@api_router.get("/lawyer/performance")
async def lawyer_performance(current_user: dict = Depends(get_current_user)):
    """Full performance stats for the authenticated lawyer."""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Lawyers only")

    uid = current_user["id"]
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    cases = await db.cases.find({"lawyer_id": uid}).to_list(1000)

    # --- Case counts ---
    total_cases = len(cases)
    this_month = 0
    for c in cases:
        ca = c.get("created_at")
        if ca:
            ca_tz = ca if getattr(ca, "tzinfo", None) else ca.replace(tzinfo=timezone.utc) if hasattr(ca, "replace") else None
            if ca_tz and ca_tz >= month_start:
                this_month += 1

    # --- Status breakdown ---
    status_counts = {}
    for c in cases:
        s = _case_dashboard_status(c)
        status_counts[s] = status_counts.get(s, 0) + 1

    # --- Case type distribution ---
    type_counts = {}
    for c in cases:
        ct = c.get("case_type", "Other") or "Other"
        type_counts[ct] = type_counts.get(ct, 0) + 1

    # --- Average response time (created_at → first status_history entry) ---
    response_times_hrs = []
    for c in cases:
        history = c.get("status_history", [])
        created = c.get("created_at")
        if created and history:
            try:
                created_tz = created if getattr(created, "tzinfo", None) else created.replace(tzinfo=timezone.utc)
                first_ts_raw = history[0].get("timestamp")
                if isinstance(first_ts_raw, str):
                    first_ts = datetime.fromisoformat(first_ts_raw.replace("Z", "+00:00"))
                elif first_ts_raw and hasattr(first_ts_raw, "tzinfo"):
                    first_ts = first_ts_raw if first_ts_raw.tzinfo else first_ts_raw.replace(tzinfo=timezone.utc)
                else:
                    continue
                diff_hrs = (first_ts - created_tz).total_seconds() / 3600
                if 0 <= diff_hrs < 8760:
                    response_times_hrs.append(diff_hrs)
            except Exception:
                continue
    avg_response_hrs = round(sum(response_times_hrs) / len(response_times_hrs), 1) if response_times_hrs else None

    # --- Estimated earnings (parse budget strings like "50,000 - 1,00,000") ---
    def parse_budget_midpoint(b):
        if not b:
            return 0
        nums = [int(x.replace(",", "").strip()) for x in b.replace("₹", "").split("-") if x.replace(",", "").strip().isdigit()]
        return sum(nums) / len(nums) if nums else 0

    completed_cases = [c for c in cases if _case_dashboard_status(c) in ("completed", "closed")]
    est_earnings = int(sum(parse_budget_midpoint(c.get("budget")) for c in completed_cases))

    # --- Weekly activity: cases accepted per week for last 4 weeks ---
    weekly = []
    for i in range(3, -1, -1):
        wk_start = now - timedelta(days=(i + 1) * 7)
        wk_end = now - timedelta(days=i * 7)
        count = 0
        for c in cases:
            ca = c.get("created_at")
            if ca:
                ca_tz = ca if getattr(ca, "tzinfo", None) else ca.replace(tzinfo=timezone.utc) if hasattr(ca, "replace") else None
                if ca_tz and wk_start <= ca_tz < wk_end:
                    count += 1
        label = f"Wk {4 - i}"
        weekly.append({"label": label, "count": count})

    # --- Reviews ---
    reviews = await db.reviews.find({"lawyer_id": uid}).sort("created_at", -1).to_list(100)
    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    recent_reviews = [
        {
            "client_name": r.get("client_name", "Anonymous"),
            "rating": r["rating"],
            "comment": r.get("comment", ""),
            "created_at": r["created_at"].isoformat() if hasattr(r.get("created_at"), "isoformat") else "",
        }
        for r in reviews[:5]
    ]

    return {
        "total_cases": total_cases,
        "this_month_cases": this_month,
        "completed_cases": len(completed_cases),
        "status_breakdown": status_counts,
        "case_type_breakdown": type_counts,
        "avg_response_hrs": avg_response_hrs,
        "est_earnings": est_earnings,
        "weekly_activity": weekly,
        "avg_rating": avg_rating,
        "total_reviews": len(reviews),
        "recent_reviews": recent_reviews,
    }


@api_router.post("/lawyer/case/{case_id}/accept")
async def lawyer_case_accept(case_id: str, current_user: dict = Depends(get_current_user)):
    """Claim an open case (same behavior as PUT /cases/{id}/accept)."""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can accept cases")
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case id")

    try:
        case = await db.cases.find_one({"_id": oid, "status": "open"})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or already accepted")

        now = datetime.now(timezone.utc)
        status_history = case.get("status_history", [])
        status_history.append({
            "new_status": "accepted",
            "changed_at": now.isoformat(),
            "note": f"Case accepted by {current_user.get('name', 'Lawyer')}",
            "updated_by": current_user.get("name", "lawyer"),
        })

        result = await db.cases.update_one(
            {"_id": oid, "status": "open"},
            {"$set": {
                "status": "accepted",
                "case_status": "accepted",
                "lawyer_id": current_user["id"],
                "lawyer_name": current_user.get("name"),
                "status_history": status_history,
                "updated_at": now,
            }},
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Case not found or already accepted")
        return {"message": "Case accepted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/lawyer/case/{case_id}/reject")
async def lawyer_case_reject(case_id: str, current_user: dict = Depends(get_current_user)):
    """Release an assigned case back to the pool (only the assigned lawyer)."""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can reject cases")
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case id")
    case = await db.cases.find_one({"_id": oid, "lawyer_id": current_user["id"]})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or not assigned to you")
    status_history = case.get("status_history", [])
    status_history.append(
        {
            "status": "rejected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": "Lawyer released / rejected the case",
            "updated_by": current_user.get("name", "lawyer"),
        }
    )
    result = await db.cases.update_one(
        {"_id": oid, "lawyer_id": current_user["id"]},
        {
            "$set": {
                "status": "open",
                "case_status": "rejected",
                "status_history": status_history,
                "updated_at": datetime.now(timezone.utc),
            },
            "$unset": {"lawyer_id": ""},
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to reject case")
    return {"message": "Case released successfully", "status": "rejected"}


@api_router.patch("/lawyer/case/{case_id}/status")
async def lawyer_case_patch_status(
    case_id: str,
    body: LawyerCaseStatusPatch,
    current_user: dict = Depends(get_current_user),
):
    """Update workflow status on a case assigned to this lawyer."""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can update case status")
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case id")
    case = await db.cases.find_one({"_id": oid, "lawyer_id": current_user["id"]})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or not assigned to you")
    status_history = case.get("status_history", [])
    status_history.append(
        {
            "status": body.new_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": body.notes or "Status updated by lawyer",
            "updated_by": current_user.get("name", "lawyer"),
        }
    )
    result = await db.cases.update_one(
        {"_id": oid, "lawyer_id": current_user["id"]},
        {
            "$set": {
                "case_status": body.new_status,
                "status_history": status_history,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update case status")

    # Auto-create satisfaction survey when case is completed/closed
    if body.new_status in ("completed", "closed") and case.get("user_id") and case.get("lawyer_id"):
        existing_survey = await db.surveys.find_one({"case_id": case_id})
        if not existing_survey:
            lawyer_doc = await db.users.find_one({"_id": ObjectId(case["lawyer_id"])}, {"name": 1})
            await db.surveys.insert_one({
                "case_id": case_id,
                "client_id": case["user_id"],
                "lawyer_id": case["lawyer_id"],
                "lawyer_name": lawyer_doc.get("name", "Your Lawyer") if lawyer_doc else "Your Lawyer",
                "case_type": case.get("case_type", "Case"),
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
            })
            await create_notification(
                case["user_id"],
                "⭐ How did your case go?",
                f"Your {case.get('case_type', 'case')} case is complete — please rate your lawyer.",
                "info",
            )

    return {"message": "Case status updated successfully", "new_status": body.new_status}


# ============ SATISFACTION SURVEYS ============

@api_router.get("/survey/pending")
async def get_pending_surveys(current_user: dict = Depends(get_current_user)):
    """Return all pending satisfaction surveys for the logged-in client."""
    if current_user["role"] != "client":
        return []
    surveys = await db.surveys.find(
        {"client_id": current_user["id"], "status": "pending"}
    ).sort("created_at", -1).to_list(10)
    return [
        {
            "id": str(s["_id"]),
            "case_id": s["case_id"],
            "lawyer_id": s["lawyer_id"],
            "lawyer_name": s.get("lawyer_name", "Your Lawyer"),
            "case_type": s.get("case_type", "Case"),
        }
        for s in surveys
    ]


class SurveySubmit(BaseModel):
    survey_id: str
    rating: int
    comment: Optional[str] = None


@api_router.post("/survey/submit")
async def submit_survey(body: SurveySubmit, current_user: dict = Depends(get_current_user)):
    """Submit a satisfaction rating and create a lawyer review."""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Clients only")
    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be 1–5")
    try:
        survey_oid = ObjectId(body.survey_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": survey_oid, "client_id": current_user["id"]})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Mark survey done
    await db.surveys.update_one(
        {"_id": survey_oid},
        {"$set": {"status": "submitted", "submitted_at": datetime.now(timezone.utc)}}
    )

    # Upsert review
    lawyer_id = survey["lawyer_id"]
    existing = await db.reviews.find_one({"lawyer_id": lawyer_id, "client_id": current_user["id"]})
    if existing:
        await db.reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": body.rating, "comment": body.comment or "", "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.reviews.insert_one({
            "lawyer_id": lawyer_id,
            "client_id": current_user["id"],
            "client_name": current_user.get("name", "Anonymous"),
            "rating": body.rating,
            "comment": body.comment or "",
            "created_at": datetime.now(timezone.utc),
        })

    # Recalculate lawyer avg rating
    all_reviews = await db.reviews.find({"lawyer_id": lawyer_id}).to_list(1000)
    if all_reviews:
        avg = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1)
        await db.users.update_one({"_id": ObjectId(lawyer_id)}, {"$set": {"rating": avg}})

    return {"message": "Thank you for your feedback!", "rating": body.rating}


@api_router.post("/survey/dismiss")
async def dismiss_survey(body: dict, current_user: dict = Depends(get_current_user)):
    """Dismiss a survey without submitting."""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Clients only")
    survey_id = body.get("survey_id")
    if not survey_id:
        raise HTTPException(status_code=400, detail="survey_id required")
    try:
        await db.surveys.update_one(
            {"_id": ObjectId(survey_id), "client_id": current_user["id"]},
            {"$set": {"status": "dismissed"}}
        )
    except Exception:
        pass
    return {"message": "Survey dismissed"}


# ============ CASE DOCUMENTS ============

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".txt", ".xlsx", ".xls"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _assert_case_access(case_id: str, current_user: dict):
    """Client owns the case OR lawyer is assigned to it."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case ID")
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = current_user["id"]
    role = current_user["role"]
    if role == "client" and case.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "lawyer" and case.get("lawyer_id") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    return case


def _serialize_case_note(note: Dict[str, Any], current_user: dict) -> Dict[str, Any]:
    created = note.get("created_at")
    updated = note.get("updated_at")
    return {
        "id": str(note["_id"]),
        "case_id": note.get("case_id"),
        "content": note.get("content", ""),
        "pinned": bool(note.get("pinned", False)),
        "priority": note.get("priority", "Normal"),
        "tags": note.get("tags", []),
        "author_id": note.get("author_id"),
        "author_name": note.get("author_name", "Unknown"),
        "author_role": note.get("author_role", "client"),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
        "updated_at": updated.isoformat() if hasattr(updated, "isoformat") else updated,
        "is_mine": note.get("author_id") == current_user["id"],
    }


def _clean_note_tags(tags: Optional[List[str]]) -> List[str]:
    if not tags:
        return []
    cleaned = []
    for tag in tags[:6]:
        value = str(tag).strip().lower().replace(" ", "-")
        if value and value not in cleaned:
            cleaned.append(value[:24])
    return cleaned


def _clean_note_priority(priority: Optional[str]) -> str:
    allowed = {"Low", "Normal", "High", "Urgent"}
    value = (priority or "Normal").strip().title()
    return value if value in allowed else "Normal"


@api_router.get("/cases/{case_id}/notes")
async def list_case_notes(case_id: str, current_user: dict = Depends(get_current_user)):
    """Shared case notes visible to the case client and assigned lawyer."""
    await _assert_case_access(case_id, current_user)
    notes = await db.case_notes.find({"case_id": case_id}).sort([("pinned", -1), ("updated_at", -1)]).to_list(200)
    return [_serialize_case_note(note, current_user) for note in notes]


@api_router.post("/cases/{case_id}/notes")
async def create_case_note(case_id: str, body: CaseNoteCreate, current_user: dict = Depends(get_current_user)):
    await _assert_case_access(case_id, current_user)
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")
    now = datetime.now(timezone.utc)
    note = {
        "case_id": case_id,
        "content": content[:2000],
        "pinned": bool(body.pinned),
        "priority": _clean_note_priority(body.priority),
        "tags": _clean_note_tags(body.tags),
        "author_id": current_user["id"],
        "author_name": current_user.get("name", "Unknown"),
        "author_role": current_user.get("role", "client"),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.case_notes.insert_one(note)
    note["_id"] = result.inserted_id
    return _serialize_case_note(note, current_user)


@api_router.patch("/notes/{note_id}")
async def update_case_note(note_id: str, body: CaseNoteUpdate, current_user: dict = Depends(get_current_user)):
    try:
        note = await db.case_notes.find_one({"_id": ObjectId(note_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await _assert_case_access(note["case_id"], current_user)
    if note.get("author_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own notes")

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if body.content is not None:
        content = body.content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="Note content is required")
        updates["content"] = content[:2000]
    if body.pinned is not None:
        updates["pinned"] = bool(body.pinned)
    if body.priority is not None:
        updates["priority"] = _clean_note_priority(body.priority)
    if body.tags is not None:
        updates["tags"] = _clean_note_tags(body.tags)

    await db.case_notes.update_one({"_id": ObjectId(note_id)}, {"$set": updates})
    updated = await db.case_notes.find_one({"_id": ObjectId(note_id)})
    return _serialize_case_note(updated, current_user)


@api_router.delete("/notes/{note_id}")
async def delete_case_note(note_id: str, current_user: dict = Depends(get_current_user)):
    try:
        note = await db.case_notes.find_one({"_id": ObjectId(note_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await _assert_case_access(note["case_id"], current_user)
    if note.get("author_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own notes")
    await db.case_notes.delete_one({"_id": ObjectId(note_id)})
    return {"message": "Note deleted"}


@api_router.post("/cases/{case_id}/documents")
async def upload_document(
    case_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a document to a case (client or assigned lawyer)."""
    await _assert_case_access(case_id, current_user)

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    # Save to disk: uploads/<case_id>/<uuid><ext>
    case_dir = UPLOADS_DIR / case_id
    case_dir.mkdir(exist_ok=True)
    file_id = str(uuid.uuid4())
    safe_name = file_id + ext
    dest = case_dir / safe_name
    dest.write_bytes(contents)

    doc = {
        "case_id": case_id,
        "file_id": file_id,
        "original_name": file.filename,
        "stored_name": safe_name,
        "extension": ext,
        "size_bytes": len(contents),
        "uploader_id": current_user["id"],
        "uploader_name": current_user.get("name", "Unknown"),
        "uploader_role": current_user.get("role", "client"),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.case_documents.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "file_id": file_id,
        "original_name": file.filename,
        "size_bytes": len(contents),
        "uploader_name": current_user.get("name"),
        "uploader_role": current_user.get("role"),
        "created_at": doc["created_at"].isoformat(),
    }


@api_router.get("/cases/{case_id}/documents")
async def list_documents(case_id: str, current_user: dict = Depends(get_current_user)):
    """List all documents for a case."""
    await _assert_case_access(case_id, current_user)
    docs = await db.case_documents.find({"case_id": case_id}).sort("created_at", 1).to_list(100)
    return [
        {
            "id": str(d["_id"]),
            "file_id": d["file_id"],
            "original_name": d["original_name"],
            "extension": d.get("extension", ""),
            "size_bytes": d.get("size_bytes", 0),
            "uploader_id": d["uploader_id"],
            "uploader_name": d.get("uploader_name", "Unknown"),
            "uploader_role": d.get("uploader_role", "client"),
            "created_at": d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else "",
        }
        for d in docs
    ]


@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Download a document (auth required — client or assigned lawyer)."""
    try:
        doc = await db.case_documents.find_one({"_id": ObjectId(doc_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await _assert_case_access(doc["case_id"], current_user)

    file_path = UPLOADS_DIR / doc["case_id"] / doc["stored_name"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        str(file_path),
        filename=doc["original_name"],
        media_type="application/octet-stream",
    )


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document (uploader only)."""
    try:
        doc = await db.case_documents.find_one({"_id": ObjectId(doc_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["uploader_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own documents")

    file_path = UPLOADS_DIR / doc["case_id"] / doc["stored_name"]
    if file_path.exists():
        file_path.unlink()

    await db.case_documents.delete_one({"_id": ObjectId(doc_id)})
    return {"message": "Document deleted"}


# ============ CASE CHAT ENDPOINTS ============

class CaseMessageCreate(BaseModel):
    content: str


async def _get_case_for_chat(case_id: str, current_user: dict) -> Dict[str, Any]:
    """Validate case access for chat: only the case's client or assigned lawyer can read/post."""
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case id")
    case = await db.cases.find_one({"_id": oid})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    uid = current_user["id"]
    role = current_user.get("role")
    is_client = case.get("user_id") == uid and role == "client"
    is_lawyer = case.get("lawyer_id") == uid and role == "lawyer"
    if not (is_client or is_lawyer):
        raise HTTPException(status_code=403, detail="You do not have access to this case chat")
    if not case.get("lawyer_id"):
        raise HTTPException(status_code=400, detail="Chat is only available after a lawyer accepts the case")
    return case


@api_router.get("/cases/{case_id}/messages")
async def list_case_messages(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await _get_case_for_chat(case_id, current_user)
    msgs = await db.case_messages.find({"case_id": case_id}).sort("created_at", 1).to_list(500)
    # Mark messages addressed to current user as read
    await db.case_messages.update_many(
        {"case_id": case_id, "sender_id": {"$ne": current_user["id"]}, "read": False},
        {"$set": {"read": True}},
    )
    out = []
    for m in msgs:
        ts = m.get("created_at")
        out.append({
            "id": str(m["_id"]),
            "case_id": case_id,
            "sender_id": m.get("sender_id"),
            "sender_role": m.get("sender_role"),
            "sender_name": m.get("sender_name"),
            "content": m.get("content", ""),
            "created_at": ts.isoformat() if hasattr(ts, "isoformat") else ts,
            "read": m.get("read", False),
            "is_mine": m.get("sender_id") == current_user["id"],
        })
    return {
        "case_id": case_id,
        "client_id": case.get("user_id"),
        "lawyer_id": case.get("lawyer_id"),
        "messages": out,
    }


@api_router.post("/cases/{case_id}/messages")
async def send_case_message(
    case_id: str,
    body: CaseMessageCreate,
    current_user: dict = Depends(get_current_user),
):
    case = await _get_case_for_chat(case_id, current_user)
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 chars)")
    now = datetime.now(timezone.utc)
    doc = {
        "case_id": case_id,
        "sender_id": current_user["id"],
        "sender_role": current_user.get("role"),
        "sender_name": current_user.get("name", "User"),
        "content": content,
        "created_at": now,
        "read": False,
    }
    result = await db.case_messages.insert_one(doc)
    # Notify the other party
    other_id = case.get("lawyer_id") if current_user["id"] == case.get("user_id") else case.get("user_id")
    if other_id:
        try:
            await db.notifications.insert_one({
                "user_id": other_id,
                "type": "case_message",
                "title": f"New message from {current_user.get('name', 'User')}",
                "message": content[:120],
                "case_id": case_id,
                "read": False,
                "created_at": now,
            })
        except Exception:
            pass
    return {
        "id": str(result.inserted_id),
        "case_id": case_id,
        "sender_id": current_user["id"],
        "sender_role": current_user.get("role"),
        "sender_name": current_user.get("name", "User"),
        "content": content,
        "created_at": now.isoformat(),
        "read": False,
        "is_mine": True,
    }


@api_router.get("/cases/{case_id}/messages/unread-count")
async def case_messages_unread_count(case_id: str, current_user: dict = Depends(get_current_user)):
    await _get_case_for_chat(case_id, current_user)
    count = await db.case_messages.count_documents({
        "case_id": case_id,
        "sender_id": {"$ne": current_user["id"]},
        "read": False,
    })
    return {"case_id": case_id, "unread": count}


@api_router.get("/messages/unread-summary")
async def messages_unread_summary(current_user: dict = Depends(get_current_user)):
    """Aggregate unread chat counts across every case the current user is part of."""
    uid = current_user["id"]
    role = current_user.get("role")
    # Find all cases the user has access to as either client or assigned lawyer
    case_filter = {"lawyer_id": uid} if role == "lawyer" else {"user_id": uid}
    cases = await db.cases.find(case_filter, {"_id": 1, "case_type": 1, "nyayId": 1, "nyay_id": 1}).to_list(500)
    case_ids = [str(c["_id"]) for c in cases]
    case_meta = {str(c["_id"]): c for c in cases}
    if not case_ids:
        return {"total_unread": 0, "per_case": {}, "cases": []}

    pipeline = [
        {"$match": {
            "case_id": {"$in": case_ids},
            "sender_id": {"$ne": uid},
            "read": False,
        }},
        {"$group": {"_id": "$case_id", "count": {"$sum": 1}}},
    ]
    per_case = {}
    total = 0
    async for row in db.case_messages.aggregate(pipeline):
        per_case[row["_id"]] = row["count"]
        total += row["count"]

    case_list = []
    for cid, cnt in per_case.items():
        meta = case_meta.get(cid, {})
        case_list.append({
            "case_id": cid,
            "case_type": meta.get("case_type"),
            "nyay_id": meta.get("nyayId") or meta.get("nyay_id"),
            "unread": cnt,
        })

    return {"total_unread": total, "per_case": per_case, "cases": case_list}


@api_router.post("/analyze-case", response_model=CaseAnalysisResponse)
async def analyze_case(request: CaseAnalysisRequest):
    """
    Analyze a case using AI-powered RAG (Retrieval-Augmented Generation)
    Returns relevant laws, similar past cases, matched lawyers, and AI analysis
    """
    try:
        # Find relevant laws using vector similarity search
        relevant_laws = await find_relevant_laws(request.description, top_k=3)
        
        # Find similar past cases
        similar_cases = await find_similar_cases(request.description, top_k=3)
        
        # Find matched lawyers
        matched_lawyers = await find_matched_lawyers(
            request.case_type, 
            request.location, 
            request.urgency,
            top_k=3
        )
        
        if not relevant_laws and not similar_cases:
            return CaseAnalysisResponse(
                relevant_laws=[],
                similar_cases=[],
                analysis="We couldn't find specific laws or similar cases matching your description. Please consult with a lawyer for detailed guidance.",
                case_summary={
                    "type": request.case_type,
                    "location": request.location
                },
                matched_lawyers=matched_lawyers
            )
        
        # Generate AI analysis using RAG
        analysis = await generate_legal_analysis(
            request.description,
            request.case_type,
            request.location,
            relevant_laws,
            similar_cases
        )
        
        return CaseAnalysisResponse(
            relevant_laws=[LawMatch(**law) for law in relevant_laws],
            similar_cases=[PastCaseMatch(**case) for case in similar_cases],
            analysis=analysis,
            case_summary={
                "type": request.case_type,
                "location": request.location,
                "description_preview": request.description[:100] + "..." if len(request.description) > 100 else request.description
            },
            matched_lawyers=matched_lawyers
        )
    
    except Exception as e:
        logging.error(f"Error in analyze_case: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while analyzing your case. Please try again or consult with a lawyer."
        )


# ============ RAG SEARCH ENDPOINT ============

class RAGSearchRequest(BaseModel):
    query: str
    search_type: str = "all"  # "laws", "cases", "all"
    top_k: int = 5

@api_router.post("/rag-search")
async def rag_semantic_search(request: RAGSearchRequest):
    """
    Full RAG semantic search — retrieves relevant laws and past cases for a query.
    Uses TF-IDF similarity (upgradeable to pgvector once Supabase schema is extended).
    Returns ranked results with source citations for LLM context injection.
    """
    try:
        results: Dict[str, Any] = {
            "query": request.query,
            "laws": [],
            "cases": [],
            "total_retrieved": 0,
            "retrieval_method": "tfidf_cosine_similarity",
        }

        if request.search_type in ("laws", "all"):
            laws = await find_relevant_laws(request.query, top_k=request.top_k)
            results["laws"] = laws

        if request.search_type in ("cases", "all"):
            cases = await find_similar_cases(request.query, top_k=request.top_k)
            results["cases"] = cases

        results["total_retrieved"] = len(results["laws"]) + len(results["cases"])

        # Build LLM-ready context string for downstream use
        context_parts = []
        if results["laws"]:
            context_parts.append("### Relevant Laws\n" + "\n".join(
                f"- **{l['ipc_section']}** — {l['title']}: {l['description'][:200]}"
                for l in results["laws"]
            ))
        if results["cases"]:
            context_parts.append("### Similar Past Cases\n" + "\n".join(
                f"- **{c['title']}** ({c['citation']}, {c['year']}): {c['summary'][:200]}"
                for c in results["cases"]
            ))
        results["rag_context"] = "\n\n".join(context_parts) if context_parts else ""

        return results

    except Exception as e:
        logging.error(f"Error in rag_search: {str(e)}")
        raise HTTPException(status_code=500, detail="RAG search failed")


@api_router.post("/rag-answer")
async def rag_answer(query: str = Body(...), context: str = Body(default=""), session_id: str = Body(default="")):
    """
    Full RAG pipeline: retrieves context then generates a grounded LLM answer with source citations.
    Reduces hallucination by anchoring every answer to retrieved documents.
    """
    try:
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=503, detail="AI key not configured")

        # Retrieve if no context provided
        if not context:
            laws = await find_relevant_laws(query, top_k=4)
            cases = await find_similar_cases(query, top_k=3)
            ctx_parts = []
            if laws:
                ctx_parts.append("Relevant Indian Laws:\n" + "\n".join(
                    f"- {l['ipc_section']} {l['title']}: {l['description'][:300]}"
                    for l in laws
                ))
            if cases:
                ctx_parts.append("Similar Court Cases:\n" + "\n".join(
                    f"- {c['title']} ({c['citation']}, {c['year']}): {c['summary'][:300]}"
                    for c in cases
                ))
            context = "\n\n".join(ctx_parts)

        system_msg = """You are a senior Indian legal AI assistant. You ONLY answer based on the provided legal documents and cases.
Always cite specific sections, articles, or case names from the context. If the context doesn't cover the query, say so clearly.
Never fabricate legal provisions or case citations. Use plain language."""

        prompt = f"""Retrieved Legal Context:
{context or 'No specific documents retrieved.'}

---
User Legal Query: {query}

Provide a grounded, cited answer based strictly on the above context."""

        answer = await _chat_complete(system_msg, prompt)
        return {"answer": answer, "context_used": bool(context), "query": query}

    except Exception as e:
        logging.error(f"Error in rag_answer: {str(e)}")
        raise HTTPException(status_code=500, detail="RAG answer generation failed")


# ============ INTELLIGENCE ENGINE ENDPOINTS ============

@api_router.post("/extract-keywords")
async def extract_keywords(request: KeywordExtractionRequest):
    """Extract legal keywords and suggest category"""
    try:
        result = await extract_keywords_ai(request.text)
        return result
    except Exception as e:
        logging.error(f"Error in extract_keywords: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to extract keywords")

@api_router.post("/detect-category")
async def detect_category(request: CategoryDetectionRequest):
    """Detect legal category with confidence and reasoning"""
    try:
        result = await extract_keywords_ai(request.text)
        return {
            "category": result.get("suggested_category", "Civil"),
            "confidence": result.get("confidence", 70),
            "reasoning": result.get("reasoning", "Based on keyword analysis"),
            "keywords_found": request.keywords
        }
    except Exception as e:
        logging.error(f"Error in detect_category: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to detect category")

async def _generate_rag_question(
    category: str,
    description: str,
    previous_answers: Dict[str, str],
    question_index: int,
) -> Optional[Dict[str, Any]]:
    """Generate next contextual question via RAG + LLM. Falls back to static tree."""
    MAX_QUESTIONS = 5
    if question_index >= MAX_QUESTIONS:
        return None

    try:
        answered_summary = ""
        if previous_answers:
            answered_summary = "\n".join(
                f"- Q{i+1}: {q_text} → {ans}"
                for i, (q_text, ans) in enumerate(previous_answers.items())
            )

        system_message = f"""You are a senior Indian legal expert conducting an intake interview for a {category} case.
Your task is to ask the SINGLE most important clarifying question that has NOT yet been asked.
Base your question on what you know about Indian law ({category} matters), the case description, and all prior answers.

Rules:
- Return ONLY valid JSON with this exact structure:
  {{"id": "rag_q_{question_index}", "text": "<question text>", "type": "yesno|text|select", "options": ["Yes","No"] or [] }}
- For yes/no questions use type "yesno" with options ["Yes","No"]
- For open text use type "text" with options []
- For multiple choice use type "select" with 3-4 concise options
- Do NOT repeat any question already answered
- Focus on facts that determine legal strategy, evidence strength, or applicable IPC sections
- Keep questions simple, jargon-free, and specific to the case"""

        context_parts = [f"Case Category: {category}"]
        if description:
            context_parts.append(f"Case Description: {description[:600]}")
        if answered_summary:
            context_parts.append(f"Questions Already Asked and Answered:\n{answered_summary}")
        context_parts.append(f"This will be question #{question_index + 1} of {MAX_QUESTIONS}.")

        response = await _chat_complete(system_message, "\n".join(context_parts))
        raw = response.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        question_obj = json.loads(raw.strip())
        question_obj["id"] = f"rag_q_{question_index}"
        return question_obj

    except Exception as e:
        logging.warning(f"RAG question generation failed: {e}. Using static fallback.")
        return _static_fallback_question(category, question_index)


def _static_fallback_question(category: str, index: int) -> Optional[Dict[str, Any]]:
    """Minimal static fallback when LLM is unavailable."""
    banks: Dict[str, List[Dict]] = {
        "Criminal": [
            {"id": "rag_q_0", "text": "Have you already filed an FIR with the police?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_1", "text": "Do you have documentary evidence (photos, videos, witnesses)?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_2", "text": "When did the incident occur?", "type": "select", "options": ["Within 24 hours", "Within a week", "Within a month", "More than a month ago"]},
            {"id": "rag_q_3", "text": "Was any weapon or physical harm involved?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_4", "text": "Do you know the identity of the accused?", "type": "yesno", "options": ["Yes", "No"]},
        ],
        "Family": [
            {"id": "rag_q_0", "text": "Is the marriage registered under a personal law act?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_1", "text": "Are children involved in this dispute?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_2", "text": "Have you attempted mediation or counseling?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_3", "text": "Is there any property or financial asset dispute?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_4", "text": "What is your primary objective?", "type": "select", "options": ["Divorce", "Maintenance/Alimony", "Child custody", "Domestic violence protection"]},
        ],
        "Property": [
            {"id": "rag_q_0", "text": "Do you have a registered sale deed or title document?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_1", "text": "Is there a sitting tenant or occupant in dispute?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_2", "text": "Has any encroachment or boundary dispute occurred?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_3", "text": "Have you sent a legal notice to the other party?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_4", "text": "How long has this dispute been ongoing?", "type": "select", "options": ["Less than 6 months", "6–12 months", "1–3 years", "More than 3 years"]},
        ],
        "Employment": [
            {"id": "rag_q_0", "text": "Do you have a written employment contract?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_1", "text": "Was any termination notice or letter issued?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_2", "text": "Are unpaid wages or dues involved?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_3", "text": "Has the matter been raised with HR or a Labour Commissioner?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_4", "text": "What type of workplace issue is this?", "type": "select", "options": ["Wrongful termination", "Harassment/discrimination", "Salary dispute", "Contract breach"]},
        ],
        "Civil": [
            {"id": "rag_q_0", "text": "Is there a written agreement or contract involved?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_1", "text": "Have you sent a legal notice to the other party?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_2", "text": "What is the approximate monetary value of the dispute?", "type": "select", "options": ["Under ₹1 lakh", "₹1–10 lakhs", "₹10–50 lakhs", "Above ₹50 lakhs"]},
            {"id": "rag_q_3", "text": "Do you have written evidence supporting your claim?", "type": "yesno", "options": ["Yes", "No"]},
            {"id": "rag_q_4", "text": "Have you explored out-of-court settlement?", "type": "yesno", "options": ["Yes", "No"]},
        ],
    }
    questions = banks.get(category, banks["Civil"])
    if index < len(questions):
        return questions[index]
    return None


@api_router.post("/get-questions")
async def get_dynamic_questions(request: DynamicQuestionRequest):
    """RAG-powered dynamic question generation — replaces static decision tree."""
    try:
        previous = request.previous_answers or {}

        if not request.question_id:
            question_index = 0
        else:
            try:
                question_index = int(request.question_id.split("_")[-1]) + 1
            except (ValueError, IndexError):
                question_index = len(previous)

        question = await _generate_rag_question(
            category=request.category,
            description=request.description or "",
            previous_answers=previous,
            question_index=question_index,
        )

        if question is None:
            return {"question": None, "has_more": False}

        return {"question": question, "has_more": question_index < 4}

    except Exception as e:
        logging.error(f"Error in get_dynamic_questions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get questions")

@api_router.post("/stamp-paper-diagnostic")
async def stamp_paper_diagnostic(request: StampPaperDiagnosticRequest):
    """Diagnose stamp paper type needed"""
    try:
        if request.is_court_case or request.is_court_fee or request.is_petition:
            paper_type = "Judicial Stamp Paper"
            reasoning = "This requires judicial stamp paper as it involves court proceedings, fees, or legal petitions."
        elif request.is_agreement or request.is_affidavit:
            paper_type = "Non-Judicial Stamp Paper"
            reasoning = "This requires non-judicial stamp paper as it involves agreements, affidavits, or contracts not directly filed in court."
        else:
            paper_type = "Consult Legal Expert"
            reasoning = "Unable to determine stamp paper type. Please consult with a legal expert for accurate guidance."
        
        return {
            "stamp_paper_type": paper_type,
            "reasoning": reasoning,
            "additional_info": "Stamp paper requirements vary by state. Please verify local requirements."
        }
    except Exception as e:
        logging.error(f"Error in stamp_paper_diagnostic: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to diagnose stamp paper")

@api_router.post("/risk-analysis")
async def risk_analysis(request: RiskAnalysisRequest):
    """Analyze case risk and success probability"""
    try:
        risk_data = calculate_risk_score(request.category, request.answers)
        complexity_data = classify_complexity(request.category, request.answers, request.description)
        
        return {
            **risk_data,
            **complexity_data,
            "insights": [
                "Ensure all documents are properly attested and notarized",
                "Maintain clear records of all communication",
                "Consider alternative dispute resolution if applicable"
            ]
        }
    except Exception as e:
        logging.error(f"Error in risk_analysis: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze risk")

class PlainSummaryRequest(BaseModel):
    description: str
    case_type: str = "Civil"
    location: str = "India"
    answers: Optional[Dict[str, Any]] = None
    relevant_laws: Optional[List[Dict[str, Any]]] = None

@api_router.post("/plain-summary")
async def plain_summary(request: PlainSummaryRequest):
    """Generate a brief plain-language summary of the case for the user."""
    try:
        # Build a bullet list of key answers if available
        answers_text = ""
        if request.answers:
            lines = [f"- {k.replace('_', ' ').title()}: {v}" for k, v in list(request.answers.items())[:6]]
            answers_text = "\n".join(lines)

        laws_text = ""
        if request.relevant_laws:
            laws_text = ", ".join(f"{l.get('ipc_section','')}: {l.get('title','')}" for l in request.relevant_laws[:3])

        system_msg = (
            "You are a helpful legal assistant. Write a brief, plain-language summary of a user's legal situation "
            "in exactly 3–4 sentences. Use simple everyday English. Do NOT use legal jargon. "
            "Do NOT predict outcomes or give definitive legal advice. "
            "End with one concrete next-step they can take right now."
        )
        user_msg = (
            f"Case type: {request.case_type}\n"
            f"Location: {request.location}\n"
            f"User's description: {request.description}\n"
        )
        if answers_text:
            user_msg += f"\nAdditional details from user:\n{answers_text}\n"
        if laws_text:
            user_msg += f"\nPotentially applicable laws: {laws_text}\n"
        user_msg += "\nWrite the 3–4 sentence plain-language summary now:"

        summary = await _chat_complete(system_msg, user_msg)
        return {"summary": summary.strip()}

    except Exception as e:
        # Graceful fallback — build summary without AI
        logging.warning(f"plain_summary AI call failed ({e}), using fallback")
        parts = []
        desc_snippet = request.description[:180].rstrip()
        parts.append(f"Your case is a {request.case_type} matter in {request.location}.")
        parts.append(f"You described: \"{desc_snippet}{'...' if len(request.description) > 180 else ''}\"")
        if request.relevant_laws:
            law_names = ", ".join(l.get('title', '') for l in request.relevant_laws[:2] if l.get('title'))
            if law_names:
                parts.append(f"Based on your details, laws related to {law_names} may be relevant.")
        parts.append("As a next step, consider gathering any documents or evidence related to your case before consulting a lawyer.")
        return {"summary": " ".join(parts)}


@api_router.post("/generate-nyayid")
async def generate_nyayid_endpoint(request: NyayIDRequest):
    """Generate NyayID with complete case profile"""
    try:
        nyay_id = generate_nyay_id()
        
        # Calculate risk and complexity
        risk_data = calculate_risk_score(
            request.case_data.get("category", "Civil"),
            request.answers
        )
        complexity_data = classify_complexity(
            request.case_data.get("category", "Civil"),
            request.answers,
            request.case_data.get("description", "")
        )
        
        nyay_profile = {
            "nyay_id": nyay_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "case_summary": {
                "category": request.case_data.get("category"),
                "description": request.case_data.get("description", "")[:200],
                "location": request.case_data.get("location"),
                "urgency": request.case_data.get("urgency")
            },
            "analysis_result": request.analysis_result,
            "risk_assessment": risk_data,
            "complexity": complexity_data,
            "user_answers": request.answers,
            "next_steps": [
                "Consult with matched lawyer for detailed guidance",
                "Gather all relevant documents as per checklist",
                "Prepare timeline of events related to your case"
            ],
            "disclaimer": "This analysis is for informational purposes only. Please consult a qualified legal professional for advice specific to your situation."
        }
        
        return nyay_profile
    except Exception as e:
        logging.error(f"Error in generate_nyayid: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate NyayID")


# ============ CLIENT CASE TRACKER ============

@api_router.get("/my-cases")
async def get_my_cases(current_user: dict = Depends(get_current_user)):
    """Get cases submitted by the current client"""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can view their cases")
    
    cases = await db.cases.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    
    result = []
    for case in cases:
        lawyer_name = None
        if case.get("lawyer_id"):
            lawyer = await db.users.find_one({"_id": ObjectId(case["lawyer_id"])})
            lawyer_name = lawyer["name"] if lawyer else None
        
        desc = case.get("caseDescription") or case.get("description", "") or ""
        plain_desc = case.get("description") or desc or ""
        ny_val = case.get("nyayId") or case.get("nyay_id")
        result.append({
            "id": str(case["_id"]),
            "case_type": case.get("case_type", ""),
            "description": (plain_desc or "")[:150],
            "caseDescription": desc[:150] if desc else "",
            "location": case.get("location", ""),
            "urgency": case.get("urgency", "normal"),
            "budget": case.get("budget", ""),
            "status": case.get("status", "open"),
            "case_status": case.get("case_status", "submitted"),
            "created_at": case["created_at"].isoformat() if hasattr(case.get("created_at"), 'isoformat') else str(case.get("created_at", "")),
            "lawyer_id": case.get("lawyer_id"),
            "lawyer_name": lawyer_name,
            "status_history": case.get("status_history", []),
            "nyay_id": ny_val,
            "nyayId": ny_val,
            "classification": case.get("classification"),
        })
    
    return result


# ============ CONSULTATION REQUEST ============

@api_router.post("/consultation-request")
async def create_consultation_request(request: ConsultationRequest, current_user: dict = Depends(get_current_user)):
    """Client requests consultation with a lawyer"""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can request consultations")
    
    try:
        lawyer = await db.users.find_one({"_id": ObjectId(request.lawyer_id)})
        if not lawyer:
            raise HTTPException(status_code=404, detail="Lawyer not found")
        
        consultation_doc = {
            "client_id": current_user["id"],
            "client_name": current_user["name"],
            "client_email": current_user["email"],
            "lawyer_id": request.lawyer_id,
            "lawyer_name": lawyer["name"],
            "case_summary": request.case_summary,
            "category": request.category,
            "urgency": request.urgency,
            "contact_preference": request.contact_preference,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await db.consultations.insert_one(consultation_doc)
        
        # Notify the lawyer
        await create_notification(
            request.lawyer_id,
            "New Consultation Request",
            f"{current_user['name']} wants to consult about a {request.category} case.",
            "consultation"
        )
        
        return {
            "id": str(result.inserted_id),
            "message": f"Consultation request sent to {lawyer['name']}",
            "status": "pending"
        }
    except Exception as e:
        logging.error(f"Error creating consultation request: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create consultation request")


# ============ AFFIDAVIT GENERATION ============

@api_router.post("/generate-affidavit")
async def generate_affidavit(request: AffidavitRequest, current_user: dict = Depends(get_current_user)):
    """Generate an affidavit draft using AI"""
    try:
        
        system_message = """You are a legal document drafting assistant specializing in Indian legal documents. 
Generate a properly formatted affidavit based on the provided details.
Use standard Indian legal affidavit format with proper structure and language.
Include spaces for signature, date, and notary attestation."""
        
        facts_text = "\n".join([f"{i+1}. {fact}" for i, fact in enumerate(request.facts)])
        
        user_message = f"""Draft an affidavit with the following details:
- Affiant Name: {request.affiant_name}
- Address: {request.affiant_address}
- Purpose: {request.purpose}
- Facts to include:
{facts_text}
{f'- Court: {request.court_name}' if request.court_name else ''}
{f'- Case Number: {request.case_number}' if request.case_number else ''}

Format it as a proper legal affidavit ready for printing."""
        
        response = await _chat_complete(system_message, user_message)
        
        return {
            "affidavit_text": response,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "affiant_name": request.affiant_name,
            "purpose": request.purpose
        }
        
    except ImportError as e:
        logging.warning(f"AI dependencies not available: {str(e)}. Using fallback affidavit generation.")
        return _fallback_affidavit_generation(request)
    except Exception as e:
        logging.error(f"Error generating AI affidavit: {str(e)}. Using fallback affidavit generation.")
        return _fallback_affidavit_generation(request)

def _fallback_affidavit_generation(request: AffidavitRequest) -> Dict[str, Any]:
    """Fallback affidavit generation using templates"""
    facts_text = "\n".join([f"{i+1}. {fact}" for i, fact in enumerate(request.facts)])
    
    court_info = ""
    if request.court_name:
        court_info = f"IN THE {request.court_name.upper()}\n"
        if request.case_number:
            court_info += f"Case No: {request.case_number}\n"
    
    affidavit_template = f"""
{court_info}
AFFIDAVIT

I, {request.affiant_name}, aged about ____ years, resident at {request.affiant_address}, do hereby solemnly affirm and declare as follows:

{facts_text}

I affirm that the contents of this affidavit are true to the best of my knowledge and belief.

DEPONENT

Verified at [City] on this [Date] day of [Month], [Year]

Affiant: ________________
{request.affiant_name}

NOTARY ATTESTATION:
Sworn and subscribed before me this [Date] day of [Month], [Year]

Notary Public: ________________
Seal:
"""
    
    return {
        "affidavit_text": affidavit_template.strip(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "affiant_name": request.affiant_name,
        "purpose": request.purpose
    }


# ============ TRANSLATION ============

@api_router.post("/translate")
async def translate_text(request: TranslateRequest):
    """Translate legal text to Indian languages"""
    supported_languages = ["Hindi", "Tamil", "Malayalam", "Bengali", "Telugu", "Kannada", "Marathi", "Gujarati"]
    
    if request.target_language not in supported_languages:
        raise HTTPException(status_code=400, detail=f"Unsupported language. Supported: {', '.join(supported_languages)}")
    
    try:
        
        system_message = f"""You are a legal translation expert. Translate the given legal text into {request.target_language}. 
Maintain legal terminology accuracy. Provide the translation in the native script of {request.target_language}.
Only return the translated text, no explanations."""
        
        response = await _chat_complete(system_message, request.text)
        
        return {
            "original_text": request.text,
            "translated_text": response,
            "target_language": request.target_language
        }
        
    except ImportError as e:
        logging.warning(f"AI dependencies not available: {str(e)}. Using fallback translation.")
        return _fallback_translation(request)
    except Exception as e:
        logging.error(f"Error in AI translation: {str(e)}. Using fallback translation.")
        return _fallback_translation(request)

def _fallback_translation(request: TranslateRequest) -> Dict[str, Any]:
    """Fallback translation with a message about AI unavailability"""
    return {
        "original_text": request.text,
        "translated_text": f"[Translation to {request.target_language} unavailable - AI translation service is currently not configured. Please use external translation service.]\n\nOriginal text: {request.text}",
        "target_language": request.target_language,
        "fallback_used": True
    }


# ============ SAVE CASE WITH NYAYID ============

@api_router.post("/save-case-with-nyayid")
async def save_case_with_nyayid(request: Request, current_user: dict = Depends(get_current_user)):
    """Save a case with NyayID after intelligence analysis"""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can save cases")
    
    try:
        body = await request.json()
        
        nid = body.get("nyay_id") or body.get("nyayId")
        if not nid:
            nid = await issue_unique_nyay_id()
        desc = body.get("description", "") or ""
        classification = classify_case(desc)
        case_doc = {
            "user_id": current_user["id"],
            "case_type": body.get("category", "Civil"),
            "description": desc,
            "caseDescription": desc,
            "classification": classification,
            "location": body.get("location", ""),
            "urgency": body.get("urgency", "Medium"),
            "budget": body.get("budget", "To be discussed"),
            "status": "open",
            "case_status": "analyzed",
            "nyay_id": nid,
            "nyayId": nid,
            "analysis_summary": body.get("analysis_summary"),
            "risk_level": body.get("risk_level"),
            "complexity": body.get("complexity"),
            "status_history": [
                {
                    "status": "analyzed",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "notes": f"Case analyzed via Intelligence Engine. NyayID: {nid}"
                }
            ],
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await db.cases.insert_one(case_doc)
        
        return {
            "id": str(result.inserted_id),
            "nyay_id": nid,
            "nyayId": nid,
            "classification": classification,
            "message": "Case saved successfully"
        }
    except Exception as e:
        logging.error(f"Error saving case with NyayID: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save case")


# ============ PARTY IN PERSON (PIP) ============

@api_router.post("/pip/submit", response_model=PipSubmitResponse)
async def pip_submit(body: PipSubmitRequest):
    """Format Party A / Party B statements into a draft (no AI)."""
    draft = f"Party A states that: {body.partyAStatement}\n\nParty B responds that: {body.partyBStatement}\n"
    return PipSubmitResponse(draft=draft)


@api_router.post("/pip/initiate", response_model=PipInitiateResponse)
async def pip_initiate(body: PipInitiateRequest, current_user: dict = Depends(get_current_user)):
    """Initiate a Party-in-Person (self-representation) case. Only allowed for Low risk cases."""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can initiate self-representation")

    normalized_risk = body.risk_level.strip().capitalize()
    if normalized_risk != "Low":
        raise HTTPException(
            status_code=400,
            detail=f"Self-representation is only available for Low-risk cases. Your case is classified as '{body.risk_level}' risk. We recommend consulting a lawyer."
        )

    workflow_key = resolve_workflow_type(body.case_type)
    workflow = PIP_WORKFLOWS[workflow_key]
    steps = workflow["steps"]
    nyay_id = await issue_unique_nyay_id()

    case_doc = {
        "user_id": current_user["id"],
        "case_type": body.case_type,
        "description": body.description,
        "caseDescription": body.description,
        "status": "open",
        "case_status": "pip_initiated",
        "nyayId": nyay_id,
        "nyay_id": nyay_id,
        "isSelfRepresented": True,
        "riskLevel": "Low",
        "workflowType": workflow_key,
        "workflowStage": 0,
        "workflowSteps": steps,
        "documentationStatus": "Pending",
        "status_history": [
            {
                "status": "pip_initiated",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": "Client initiated self-representation (Party in Person)"
            }
        ],
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.cases.insert_one(case_doc)
    case_id = str(result.inserted_id)

    await db.notifications.insert_one({
        "user_id": current_user["id"],
        "title": "Party in Person Case Initiated",
        "message": f"Your self-representation case for '{workflow['title']}' has started. Follow the guided steps to proceed.",
        "type": "pip_initiated",
        "case_id": case_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return PipInitiateResponse(
        case_id=case_id,
        workflow_type=workflow_key,
        risk_level="Low",
        is_self_represented=True,
        workflow_stage=0,
        total_steps=len(steps),
        documentation_status="Pending",
        message=f"Self-representation case initiated for '{workflow['title']}'. Follow the step-by-step guide below."
    )


@api_router.get("/pip/workflow/{case_id}", response_model=PipWorkflowResponse)
async def pip_get_workflow(case_id: str, current_user: dict = Depends(get_current_user)):
    """Retrieve the step-by-step workflow for a PIP case."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(case_id), "user_id": current_user["id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case ID")

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case.get("isSelfRepresented"):
        raise HTTPException(status_code=400, detail="This is not a self-representation case")

    workflow_key = case.get("workflowType", "consumer_complaint")
    workflow = PIP_WORKFLOWS.get(workflow_key, PIP_WORKFLOWS["consumer_complaint"])
    steps = [PipWorkflowStep(**s) for s in workflow["steps"]]

    return PipWorkflowResponse(
        case_id=case_id,
        workflow_type=workflow_key,
        workflow_stage=case.get("workflowStage", 0),
        total_steps=len(steps),
        documentation_status=case.get("documentationStatus", "Pending"),
        steps=steps,
        can_switch_to_lawyer=True
    )


@api_router.post("/pip/next-step", response_model=PipNextStepResponse)
async def pip_next_step(body: PipNextStepRequest, current_user: dict = Depends(get_current_user)):
    """Advance the workflow to the next step."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(body.case_id), "user_id": current_user["id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case ID")

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case.get("isSelfRepresented"):
        raise HTTPException(status_code=400, detail="This is not a self-representation case")

    workflow_key = case.get("workflowType", "consumer_complaint")
    workflow = PIP_WORKFLOWS.get(workflow_key, PIP_WORKFLOWS["consumer_complaint"])
    total_steps = len(workflow["steps"])
    current_stage = case.get("workflowStage", 0)
    new_stage = min(current_stage + 1, total_steps)
    is_complete = new_stage >= total_steps
    doc_status = "Completed" if is_complete else "Pending"

    update_fields: Dict[str, Any] = {
        "workflowStage": new_stage,
        "documentationStatus": doc_status,
    }
    if is_complete:
        update_fields["case_status"] = "pip_completed"

    await db.cases.update_one(
        {"_id": ObjectId(body.case_id)},
        {"$set": update_fields, "$push": {
            "status_history": {
                "status": "pip_completed" if is_complete else f"pip_step_{new_stage}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": f"Completed step {current_stage + 1} of {total_steps}"
            }
        }}
    )

    if is_complete:
        await db.notifications.insert_one({
            "user_id": current_user["id"],
            "title": "All Steps Completed!",
            "message": "You have completed all steps in your self-representation guide. Your case documentation is now complete.",
            "type": "pip_completed",
            "case_id": body.case_id,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
        message = "All steps completed! Your self-representation journey is finished."
    else:
        step_title = workflow["steps"][new_stage]["title"] if new_stage < total_steps else ""
        message = f"Step {current_stage + 1} marked done. Next: {step_title}"
        await db.notifications.insert_one({
            "user_id": current_user["id"],
            "title": f"Step {current_stage + 1} Complete",
            "message": message,
            "type": "pip_step_complete",
            "case_id": body.case_id,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return PipNextStepResponse(
        case_id=body.case_id,
        workflow_stage=new_stage,
        total_steps=total_steps,
        is_complete=is_complete,
        documentation_status=doc_status,
        message=message
    )


@api_router.post("/pip/request-doc")
async def pip_request_doc(body: PipRequestDocRequest, current_user: dict = Depends(get_current_user)):
    """Request lawyer-assisted documentation for a PIP case."""
    try:
        case = await db.cases.find_one({"_id": ObjectId(body.case_id), "user_id": current_user["id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case ID")

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    await db.cases.update_one(
        {"_id": ObjectId(body.case_id)},
        {"$set": {
            "documentationStatus": "Lawyer Assistance Requested",
            "case_status": "open",
            "isSelfRepresented": False,
        }, "$push": {
            "status_history": {
                "status": "lawyer_assistance_requested",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": body.notes or "Client requested lawyer assistance from PIP workflow"
            }
        }}
    )

    await db.notifications.insert_one({
        "user_id": current_user["id"],
        "title": "Lawyer Assistance Requested",
        "message": "Your request for lawyer-assisted documentation has been received. A lawyer will be in touch shortly.",
        "type": "pip_doc_request",
        "case_id": body.case_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "case_id": body.case_id,
        "documentation_status": "Lawyer Assistance Requested",
        "message": "Your request has been submitted. A lawyer will assist you with your documentation shortly."
    }


# ============ LEGAL WRITER DRAFTS ============


@api_router.post("/drafts", response_model=DraftItem)
async def create_draft(body: DraftCreate, current_user: dict = Depends(get_current_user)):
    """Create a new draft request. Accessible to clients and lawyers."""
    doc = {
        "title": body.title,
        "description": body.description or "",
        "body": body.body or "",
        "status": "open",
        "legal_writer_id": None,
        "requested_by": current_user["id"],
        "requested_by_name": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc),
        "submitted_at": None,
    }
    result = await db.drafts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _draft_to_item(doc)


@api_router.get("/drafts", response_model=List[DraftItem])
async def list_drafts(current_user: dict = Depends(get_current_user)):
    """Open drafts plus drafts assigned to the current legal writer."""
    if current_user.get("role") != "legal_writer":
        raise HTTPException(status_code=403, detail="Only legal writers can view drafts")
    wid = current_user["id"]
    rows = await db.drafts.find(
        {"$or": [{"status": "open"}, {"legal_writer_id": wid}]}
    ).sort("created_at", -1).to_list(200)
    return [_draft_to_item(d) for d in rows]


@api_router.put("/draft/{draft_id}/body")
async def draft_save_body(draft_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Save written body content for an accepted draft (autosave / progress save)."""
    if current_user.get("role") != "legal_writer":
        raise HTTPException(status_code=403, detail="Only legal writers can edit drafts")
    try:
        oid = ObjectId(draft_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft id")
    payload = await request.json()
    body_content = payload.get("body", "")
    wid = current_user["id"]
    result = await db.drafts.update_one(
        {"_id": oid, "legal_writer_id": wid},
        {"$set": {"body": body_content, "last_saved_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found or not assigned to you")
    return {"message": "Draft saved", "draft_id": draft_id}


@api_router.post("/draft/{draft_id}/accept")
async def draft_accept(draft_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "legal_writer":
        raise HTTPException(status_code=403, detail="Only legal writers can accept drafts")
    try:
        oid = ObjectId(draft_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft id")
    wid = current_user["id"]
    result = await db.drafts.update_one(
        {"_id": oid, "status": "open"},
        {
            "$set": {
                "legal_writer_id": wid,
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found or no longer open")
    return {"message": "Draft accepted", "draft_id": draft_id}


@api_router.post("/draft/{draft_id}/submit")
async def draft_submit(draft_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "legal_writer":
        raise HTTPException(status_code=403, detail="Only legal writers can submit drafts")
    try:
        oid = ObjectId(draft_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft id")
    wid = current_user["id"]
    draft = await db.drafts.find_one(
        {"_id": oid, "legal_writer_id": wid, "status": "accepted"}
    )
    if not draft:
        raise HTTPException(
            status_code=404,
            detail="Draft not found, not assigned to you, or not in accepted state",
        )
    now = datetime.now(timezone.utc)
    set_fields: Dict[str, Any] = {"status": "submitted", "submitted_at": now}
    result = await db.drafts.update_one(
        {"_id": oid, "legal_writer_id": wid, "status": "accepted"},
        {"$set": set_fields},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to submit draft")
    await db.legal_writers.update_one(
        {"_id": ObjectId(wid)},
        {"$inc": {"earnings": LEGAL_WRITER_SUBMIT_BONUS}},
    )
    updated = await db.legal_writers.find_one({"_id": ObjectId(wid)})
    return {
        "message": "Draft submitted",
        "draft_id": draft_id,
        "earnings_added": LEGAL_WRITER_SUBMIT_BONUS,
        "earnings_total": float(updated.get("earnings") or 0) if updated else 0.0,
    }


# ============ LEGAL CHATBOT ============

@api_router.post("/chat")
async def legal_chat(request: ChatRequest):
    """AI-powered legal chatbot for common questions"""
    try:
        
        system_message = """You are VakilSetu's legal assistant chatbot. You help users understand basic legal concepts in India.
Rules:
- Give clear, simple answers in plain language
- Always mention that this is general information, not legal advice
- Suggest consulting a lawyer for specific situations
- Keep responses concise (2-3 paragraphs max)
- Focus on Indian legal context (IPC, CrPC, CPC)"""
        
        session = request.session_id or f"chat_{datetime.now().timestamp()}"
        
        response = await _chat_complete(system_message, request.message)
        
        return {
            "response": response,
            "session_id": session
        }
        
    except ImportError as e:
        logging.warning(f"AI dependencies not available: {str(e)}. Using fallback chat response.")
        return _fallback_chat_response(request)
    except Exception as e:
        logging.error(f"Error in AI chat: {str(e)}. Using fallback chat response.")
        return _fallback_chat_response(request)

def _fallback_chat_response(request: ChatRequest) -> Dict[str, Any]:
    """Fallback chat response with general legal information"""
    message_lower = request.message.lower()
    
    # Simple keyword-based responses
    if any(word in message_lower for word in ['divorce', 'marriage', 'family']):
        response = """For family law matters like divorce and marriage issues, I recommend:

1. Consult a family law lawyer who can guide you through the process
2. Gather relevant documents (marriage certificate, financial records, etc.)
3. Consider mediation or counseling if applicable
4. Understand your rights regarding child custody, maintenance, and property

This is general information. Please consult a qualified lawyer for advice specific to your situation."""
    
    elif any(word in message_lower for word in ['property', 'land', 'house', 'rent']):
        response = """For property law matters, consider these steps:

1. Verify all property documents and title deeds
2. Check for encumbrances and pending litigation
3. Understand land use regulations and zoning laws
4. Consult a property lawyer for due diligence

Property disputes can be complex, so professional legal guidance is essential for your specific case."""
    
    elif any(word in message_lower for word in ['criminal', 'fir', 'police', 'case']):
        response = """For criminal law matters:

1. File an FIR at the nearest police station if a crime has occurred
2. Preserve all evidence and documentation
3. Consult a criminal lawyer immediately
4. Understand your rights and legal options

Time is critical in criminal matters, so seek legal advice promptly."""
    
    else:
        response = """I'm here to help with general legal information. For specific legal advice:

1. Consult a qualified lawyer who can review your case details
2. Use our Intelligence Engine for a detailed analysis of your situation
3. Gather all relevant documents and evidence
4. Consider the urgency and timeline of your matter

This is general information only and does not constitute legal advice."""
    
    return {
        "response": response,
        "session_id": request.session_id,
        "fallback_used": True
    }


# ============ KNOWLEDGE BASE ============

class IngestDocumentRequest(BaseModel):
    title: str
    content: str
    source_type: str = "manual"
    tags: Optional[List[str]] = []

@api_router.post("/ingest-document")
async def ingest_document(request: IngestDocumentRequest, current_user: dict = Depends(get_current_user)):
    """Ingest a document into the knowledge base with optional embedding"""
    if current_user.get("role") != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can add knowledge base documents")
    try:
        embedding = None
        if OPENAI_API_KEY:
            try:
                embedding = await _embed(request.content[:8000])
            except Exception as emb_err:
                logging.warning(f"Embedding skipped: {emb_err}")

        chunk_count = max(1, len(request.content) // 500)
        doc = {
            "lawyer_id": current_user["id"],
            "title": request.title,
            "content": request.content,
            "source_type": request.source_type,
            "tags": request.tags or [],
            "embedding": embedding,
            "chunk_count": chunk_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        doc_id = await db.kb_documents.insert_one(doc)
        return {
            "id": str(doc_id),
            "title": request.title,
            "chunk_count": chunk_count,
            "embedded": embedding is not None,
            "created_at": doc["created_at"],
        }
    except Exception as e:
        logging.error(f"Error ingesting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/kb/documents")
async def list_kb_documents(current_user: dict = Depends(get_current_user)):
    """List all knowledge base documents for the current lawyer"""
    if current_user.get("role") != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can view the knowledge base")
    docs = await db.kb_documents.find({"lawyer_id": current_user["id"]})
    return [
        {
            "id": str(d.get("_id", d.get("id", ""))),
            "title": d.get("title", ""),
            "source_type": d.get("source_type", "manual"),
            "tags": d.get("tags", []),
            "chunk_count": d.get("chunk_count", 0),
            "created_at": d.get("created_at", ""),
        }
        for d in docs
    ]


@api_router.delete("/kb/documents/{doc_id}")
async def delete_kb_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a knowledge base document"""
    if current_user.get("role") != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can delete knowledge base documents")
    deleted = await db.kb_documents.delete_one({"id": doc_id, "lawyer_id": current_user["id"]})
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}


# ============ NOTIFICATIONS ============

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get user notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).to_list(50)
    
    result = []
    for n in notifications:
        result.append({
            "id": str(n["_id"]),
            "type": n.get("type", "info"),
            "title": n["title"],
            "message": n["message"],
            "read": n.get("read", False),
            "created_at": n["created_at"].isoformat() if hasattr(n["created_at"], 'isoformat') else str(n["created_at"])
        })
    
    return result

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}

# ============ WRITING REQUESTS ============

@api_router.post("/writing-requests")
async def create_writing_request(request: dict, current_user: dict = Depends(get_current_user)):
    """Client requests a legal content writer to draft a document"""
    doc = {
        "client_id": current_user["id"],
        "client_name": current_user.get("name", ""),
        "title": request.get("title", ""),
        "description": request.get("description", ""),
        "budget": request.get("budget", "To be discussed"),
        "document_type": request.get("document_type", "affidavit"),
        "affidavit_details": request.get("affidavit_details", {}),
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.writing_requests.insert_one(doc)
    open_writers = await db.legal_writers.find({"status": {"$ne": "inactive"}}).to_list(50)
    for writer in open_writers:
        await create_notification(
            str(writer["_id"]),
            "New Document Request",
            f"{current_user['name']} needs a {doc['document_type']} drafted: {doc['title']}",
            "info"
        )
    return {"id": str(result.inserted_id), "message": "Request submitted to legal content writers"}

@api_router.get("/writing-requests")
async def get_writing_requests(current_user: dict = Depends(get_current_user)):
    """Get writing requests - writers see all open, clients see their own"""
    if current_user.get("role") == "legal_writer":
        requests = await db.writing_requests.find({"status": "open"}).sort("created_at", -1).to_list(50)
    else:
        requests = await db.writing_requests.find({"client_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    result = []
    for r in requests:
        result.append({
            "id": str(r["_id"]),
            "client_name": r.get("client_name", ""),
            "title": r.get("title", ""),
            "description": r.get("description", ""),
            "budget": r.get("budget", ""),
            "document_type": r.get("document_type", ""),
            "status": r.get("status", "open"),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })
    return result

async def create_notification(user_id: str, title: str, message: str, notif_type: str = "info"):
    """Helper to create a notification"""
    await db.notifications.insert_one({
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })


# ============ ACTIVITY DIGEST ============

@api_router.get("/activity-digest")
async def get_activity_digest(current_user: dict = Depends(get_current_user)):
    """
    Generate a 7-day activity digest for the current user.
    Creates a digest notification if one hasn't been created today.
    Returns the structured digest data plus the notification id.
    """
    uid = current_user["id"]
    role = current_user.get("role", "client")
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- Gather cases ---
    if role == "lawyer":
        cases = await db.cases.find({"lawyer_id": uid}).to_list(500)
    else:
        cases = await db.cases.find({"user_id": uid}).to_list(500)

    case_ids = [str(c["_id"]) for c in cases]

    # --- Status changes in past 7 days ---
    status_changes = []
    for c in cases:
        for entry in c.get("status_history", []):
            try:
                ts_raw = entry.get("timestamp")
                if isinstance(ts_raw, str):
                    ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                elif hasattr(ts_raw, "tzinfo"):
                    ts = ts_raw if ts_raw.tzinfo else ts_raw.replace(tzinfo=timezone.utc)
                else:
                    continue
                if ts >= week_ago:
                    status_changes.append({
                        "case_type": c.get("case_type", "Case"),
                        "case_id": str(c["_id"]),
                        "status": entry.get("status"),
                        "notes": entry.get("notes", ""),
                        "timestamp": ts.isoformat(),
                    })
            except Exception:
                continue
    status_changes.sort(key=lambda x: x["timestamp"], reverse=True)

    # --- Messages in past 7 days ---
    messages_sent = 0
    messages_received = 0
    if case_ids:
        sent_count = await db.case_messages.count_documents({
            "case_id": {"$in": case_ids},
            "sender_id": uid,
            "created_at": {"$gte": week_ago},
        })
        received_count = await db.case_messages.count_documents({
            "case_id": {"$in": case_ids},
            "sender_id": {"$ne": uid},
            "created_at": {"$gte": week_ago},
        })
        messages_sent = sent_count
        messages_received = received_count

    # --- Cases submitted this week (client only) ---
    new_cases_this_week = 0
    if role == "client":
        for c in cases:
            ca = c.get("created_at")
            if ca:
                if hasattr(ca, "tzinfo"):
                    ca_tz = ca if ca.tzinfo else ca.replace(tzinfo=timezone.utc)
                else:
                    try:
                        ca_tz = datetime.fromisoformat(str(ca))
                    except Exception:
                        continue
                if ca_tz >= week_ago:
                    new_cases_this_week += 1

    # --- Build headline summary ---
    highlights = []
    if status_changes:
        highlights.append(f"{len(status_changes)} status update{'s' if len(status_changes) > 1 else ''}")
    if messages_received:
        highlights.append(f"{messages_received} message{'s' if messages_received > 1 else ''} received")
    if new_cases_this_week and role == "client":
        highlights.append(f"{new_cases_this_week} new case{'s' if new_cases_this_week > 1 else ''} filed")

    summary = ", ".join(highlights) if highlights else "No new activity this week"

    digest_data = {
        "period": "Last 7 days",
        "generated_at": now.isoformat(),
        "total_cases": len(cases),
        "status_changes": status_changes[:5],   # top 5
        "messages_sent": messages_sent,
        "messages_received": messages_received,
        "new_cases_this_week": new_cases_this_week,
        "summary": summary,
    }

    # --- Create notification if not already done today ---
    existing_today = await db.notifications.find_one({
        "user_id": uid,
        "type": "digest",
        "created_at": {"$gte": today_start},
    })

    notif_id = None
    if not existing_today and highlights:
        result = await db.notifications.insert_one({
            "user_id": uid,
            "type": "digest",
            "title": "📊 Your Weekly Activity Digest",
            "message": summary,
            "digest_data": digest_data,
            "read": False,
            "created_at": now,
        })
        notif_id = str(result.inserted_id)

    return {**digest_data, "notification_id": notif_id, "already_sent_today": existing_today is not None}


# ============ REFERRAL SYSTEM ============

@api_router.post("/referrals")
async def create_referral(request: ReferralRequest, current_user: dict = Depends(get_current_user)):
    """Lawyer refers a case to another lawyer"""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can make referrals")
    
    try:
        referred_lawyer = await db.users.find_one({"_id": ObjectId(request.referred_to_lawyer_id), "role": "lawyer"})
        if not referred_lawyer:
            raise HTTPException(status_code=404, detail="Referred lawyer not found")
        
        case = await db.cases.find_one({"_id": ObjectId(request.case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        referral_doc = {
            "case_id": request.case_id,
            "referred_by_id": current_user["id"],
            "referred_by_name": current_user["name"],
            "referred_to_id": request.referred_to_lawyer_id,
            "referred_to_name": referred_lawyer["name"],
            "case_type": case.get("case_type", ""),
            "case_description": case.get("description", "")[:200],
            "notes": request.notes,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await db.referrals.insert_one(referral_doc)
        
        # Notify the referred lawyer
        await create_notification(
            request.referred_to_lawyer_id,
            "New Case Referral",
            f"{current_user['name']} referred a {case.get('case_type', '')} case to you.",
            "referral"
        )
        
        return {
            "id": str(result.inserted_id),
            "message": f"Case referred to {referred_lawyer['name']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Referral error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create referral")

@api_router.get("/referrals")
async def get_referrals(current_user: dict = Depends(get_current_user)):
    """Get referrals (sent or received)"""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can view referrals")
    
    sent = await db.referrals.find({"referred_by_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    received = await db.referrals.find({"referred_to_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    
    def format_referral(r):
        return {
            "id": str(r["_id"]),
            "case_id": r["case_id"],
            "referred_by_name": r["referred_by_name"],
            "referred_to_name": r["referred_to_name"],
            "case_type": r.get("case_type", ""),
            "case_description": r.get("case_description", ""),
            "notes": r.get("notes", ""),
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], 'isoformat') else str(r["created_at"])
        }
    
    return {
        "sent": [format_referral(r) for r in sent],
        "received": [format_referral(r) for r in received]
    }

@api_router.put("/referrals/{referral_id}/accept")
async def accept_referral(referral_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a referral"""
    if current_user["role"] != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can accept referrals")
    
    referral = await db.referrals.find_one({"_id": ObjectId(referral_id), "referred_to_id": current_user["id"]})
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    await db.referrals.update_one(
        {"_id": ObjectId(referral_id)},
        {"$set": {"status": "accepted"}}
    )
    
    # Notify referring lawyer
    await create_notification(
        referral["referred_by_id"],
        "Referral Accepted",
        f"{current_user['name']} accepted your case referral.",
        "referral"
    )
    
    return {"message": "Referral accepted"}


# ============ STRIPE PAYMENT ============

@api_router.post("/payments/create-checkout")
async def create_checkout(request: CreateCheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for lawyer consultation"""
    if request.package_id not in CONSULTATION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = CONSULTATION_PACKAGES[request.package_id]
    
    try:
        import stripe as _stripe
        
        # Check if STRIPE_API_KEY is available
        if not STRIPE_API_KEY:
            raise ImportError("STRIPE_API_KEY not configured")
        
        _stripe.api_key = STRIPE_API_KEY
        
        success_url = f"{request.origin_url}/client/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{request.origin_url}/client/dashboard"
        
        session = _stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": package["name"]},
                    "unit_amount": int(package["amount"] * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user["id"],
                "lawyer_id": request.lawyer_id,
                "package_id": request.package_id,
                "package_name": package["name"],
                "user_email": current_user["email"]
            }
        )
        
        # Save transaction
        await db.payment_transactions.insert_one({
            "session_id": session.id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "lawyer_id": request.lawyer_id,
            "package_id": request.package_id,
            "amount": package["amount"],
            "currency": "usd",
            "payment_status": "initiated",
            "metadata": {
                "package_name": package["name"],
                "duration": package["duration"]
            },
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"url": session.url, "session_id": session.id}
        
    except ImportError as e:
        logging.warning(f"Payment dependencies not available: {str(e)}. Using fallback payment response.")
        return _fallback_payment_response(request, package, current_user)
    except Exception as e:
        logging.error(f"Error in payment processing: {str(e)}. Using fallback payment response.")
        return _fallback_payment_response(request, package, current_user)

def _fallback_payment_response(request: CreateCheckoutRequest, package: Dict[str, Any], current_user: dict) -> Dict[str, Any]:
    """Fallback payment response when payment processing is unavailable"""
    # Create a mock transaction record
    mock_session_id = f"mock_{datetime.now().timestamp()}"
    
    # Save mock transaction for tracking
    try:
        # This would normally be async, but we're in a sync context for the fallback
        import asyncio
        asyncio.create_task(db.payment_transactions.insert_one({
            "session_id": mock_session_id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "lawyer_id": request.lawyer_id,
            "package_id": request.package_id,
            "amount": package["amount"],
            "currency": "usd",
            "payment_status": "mock_payment",
            "metadata": {
                "package_name": package["name"],
                "duration": package["duration"],
                "fallback_used": True
            },
            "created_at": datetime.now(timezone.utc)
        }))
    except Exception as e:
        logging.error(f"Failed to save mock transaction: {str(e)}")
    
    return {
        "error": "Payment processing is currently unavailable. Please contact the lawyer directly to arrange payment.",
        "fallback_url": f"{request.origin_url}/client/dashboard",
        "session_id": mock_session_id,
        "package_details": {
            "name": package["name"],
            "amount": package["amount"],
            "duration": package["duration"]
        },
        "fallback_used": True
    }

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status"""
    try:
        import stripe as _stripe
        
        # Check if STRIPE_API_KEY is available
        if not STRIPE_API_KEY:
            raise ImportError("STRIPE_API_KEY not configured")
        
        _stripe.api_key = STRIPE_API_KEY
        status = _stripe.checkout.Session.retrieve(session_id)
        
        # Update transaction
        update_data = {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        tx = await db.payment_transactions.find_one({"session_id": session_id})
        if tx and tx.get("payment_status") != "paid" and status.payment_status == "paid":
            update_data["payment_status"] = "paid"
            # Create video room for consultation
            room_id = f"room_{secrets.token_hex(8)}"
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {**update_data, "video_room_id": room_id}}
            )
            # Notify both parties
            await create_notification(
                tx["user_id"],
                "Payment Successful",
                f"Your consultation is booked! Room ID: {room_id}",
                "payment"
            )
            if tx.get("lawyer_id"):
                await create_notification(
                    tx["lawyer_id"],
                    "New Consultation Booked",
                    f"A client has booked a {tx.get('metadata', {}).get('package_name', '')} consultation. Room ID: {room_id}",
                    "consultation"
                )
        else:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "video_room_id": tx.get("video_room_id") if tx else None
        }
        
    except ImportError as e:
        logging.warning(f"Payment dependencies not available: {str(e)}. Using fallback payment status.")
        return _fallback_payment_status(session_id)
    except Exception as e:
        logging.error(f"Error checking payment status: {str(e)}. Using fallback payment status.")
        return _fallback_payment_status(session_id)

def _fallback_payment_status(session_id: str) -> Dict[str, Any]:
    """Fallback payment status when payment processing is unavailable"""
    # Try to get transaction from database
    try:
        tx = None
        # Use sync approach for the fallback
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're in an async context, we can await
            tx = asyncio.create_task(db.payment_transactions.find_one({"session_id": session_id}))
        else:
            # Fallback - just return mock status
            pass
        
        if tx:
            return {
                "status": "payment_unavailable",
                "payment_status": tx.get("payment_status", "unknown"),
                "amount_total": tx.get("amount", 0),
                "currency": tx.get("currency", "usd"),
                "video_room_id": tx.get("video_room_id"),
                "fallback_used": True,
                "message": "Payment processing is currently unavailable. Please check with the lawyer directly."
            }
        else:
            return {
                "status": "payment_unavailable",
                "payment_status": "unknown",
                "amount_total": 0,
                "currency": "usd",
                "video_room_id": None,
                "fallback_used": True,
                "message": "Payment processing is currently unavailable. Please check with the lawyer directly."
            }
    except Exception as e:
        logging.error(f"Error in fallback payment status: {str(e)}")
        return {
            "status": "payment_unavailable",
            "payment_status": "error",
            "amount_total": 0,
            "currency": "usd",
            "video_room_id": None,
            "fallback_used": True,
            "message": "Payment processing is currently unavailable. Please check with the lawyer directly."
        }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        import stripe as _stripe, json as _wh_json
        
        if not STRIPE_API_KEY:
            raise ImportError("STRIPE_API_KEY not configured")
        
        _stripe.api_key = STRIPE_API_KEY
        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")
        wh_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        
        try:
            if wh_secret:
                event = _stripe.Webhook.construct_event(body, sig, wh_secret)
                etype = event["type"]
                eobj = event["data"]["object"]
            else:
                event = _wh_json.loads(body)
                etype = event.get("type", "")
                eobj = event.get("data", {}).get("object", {})
        except Exception as we:
            logging.warning(f"Webhook parse error: {we}")
            return {"status": "ignored"}
        
        if etype == "checkout.session.completed":
            sid_wh = eobj.get("id") if isinstance(eobj, dict) else getattr(eobj, "id", None)
            ps_wh = eobj.get("payment_status") if isinstance(eobj, dict) else getattr(eobj, "payment_status", None)
            if ps_wh == "paid" and sid_wh:
                await db.payment_transactions.update_one(
                    {"session_id": sid_wh},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
                )
        
        return {"status": "ok"}
        
    except ImportError as e:
        logging.warning(f"Payment dependencies not available: {str(e)}. Webhook processing unavailable.")
        return {"status": "webhook_unavailable", "message": "Payment webhook processing is currently unavailable"}
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": "Failed to process webhook"}

@api_router.get("/payments/packages")
async def get_packages():
    """Get available consultation packages"""
    return CONSULTATION_PACKAGES

@api_router.get("/consultations")
async def get_consultations(current_user: dict = Depends(get_current_user)):
    """Get user's consultations with video room info"""
    query = {}
    if current_user["role"] == "client":
        query["user_id"] = current_user["id"]
    elif current_user["role"] == "lawyer":
        query["lawyer_id"] = current_user["id"]
    
    transactions = await db.payment_transactions.find(
        {**query, "payment_status": "paid"}
    ).sort("created_at", -1).to_list(50)
    
    results = []
    for tx in transactions:
        lawyer = await db.users.find_one({"_id": ObjectId(tx["lawyer_id"])}) if tx.get("lawyer_id") else None
        client = await db.users.find_one({"_id": ObjectId(tx["user_id"])}) if tx.get("user_id") else None
        results.append({
            "id": str(tx["_id"]),
            "package_name": tx.get("metadata", {}).get("package_name", ""),
            "duration": tx.get("metadata", {}).get("duration", ""),
            "amount": tx.get("amount"),
            "lawyer_name": lawyer["name"] if lawyer else "Unknown",
            "client_name": client["name"] if client else "Unknown",
            "video_room_id": tx.get("video_room_id"),
            "created_at": tx["created_at"].isoformat() if hasattr(tx["created_at"], 'isoformat') else str(tx["created_at"])
        })
    
    return results


# Include router
app = FastAPI(title="VakilSetu API")

# Include CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"]
)

app.include_router(api_router)

# Admin dashboard routes
try:
    from admin_routes import router as admin_router
    app.include_router(admin_router)
    logging.info("Admin routes registered")
except Exception as _admin_err:
    logging.warning(f"Admin routes not loaded: {_admin_err}")

# PDF ingestion pipeline routes
try:
    from pdf_pipeline import router as pipeline_router
    app.include_router(pipeline_router)
    logging.info("PDF pipeline routes registered")
except Exception as _pipe_err:
    logging.warning(f"PDF pipeline routes not loaded: {_pipe_err}")

# WebSocket for Video Consultation
@app.websocket("/ws/video/{room_id}")
async def video_websocket(websocket: WebSocket, room_id: str):
    await video_manager.connect(websocket, room_id)
    peer_count = video_manager.get_room_count(room_id)
    
    try:
        # Notify new peer about existing peers
        await websocket.send_json({"type": "room_info", "peer_count": peer_count})
        # Notify others about new peer
        await video_manager.broadcast(room_id, {"type": "peer_joined", "peer_count": peer_count}, websocket)
        
        while True:
            data = await websocket.receive_json()
            # Forward signaling messages (offer, answer, ice-candidate)
            await video_manager.broadcast(room_id, data, websocket)
    except WebSocketDisconnect:
        video_manager.disconnect(websocket, room_id)
        remaining = video_manager.get_room_count(room_id)
        # Broadcast to remaining
        for ws in video_manager.rooms.get(room_id, []):
            try:
                await ws.send_json({"type": "peer_left", "peer_count": remaining})
            except Exception:
                pass

# Startup Event
@app.on_event("startup")
async def startup_event():
    # Run all DB operations in the background so server starts immediately
    asyncio.create_task(_background_startup())

async def _background_startup():
    try:
        # Create indexes (no-op for Supabase — handled by supabase_schema.sql)
        await asyncio.wait_for(db.users.create_index("email", unique=True), timeout=6)
        await asyncio.wait_for(db.cases.create_index("user_id"), timeout=6)
        await asyncio.wait_for(db.cases.create_index("status"), timeout=6)
        await asyncio.wait_for(db.cases.create_index("lawyer_id", sparse=True), timeout=6)
        await asyncio.wait_for(db.cases.create_index("nyayId", unique=True, sparse=True), timeout=6)
        await asyncio.wait_for(db.users.create_index("firmId", sparse=True), timeout=6)
        await asyncio.wait_for(db.legal_writers.create_index("email", unique=True), timeout=6)
        await asyncio.wait_for(db.drafts.create_index("status"), timeout=6)
        await asyncio.wait_for(db.drafts.create_index("legal_writer_id", sparse=True), timeout=6)
    except Exception as e:
        logger.warning(f"Index creation skipped (DB unreachable): {e}")

    try:
        # Seed IPC laws with embeddings
        laws_count = await db.laws.count_documents({})
        if laws_count == 0:
            logger.info("Seeding comprehensive IPC laws database with embeddings...")
            laws_file = ROOT_DIR / "comprehensive_ipc_laws.json"
            
            if laws_file.exists():
                with open(laws_file, "r") as f:
                    laws_data = json.load(f)
                
                # Generate embeddings for each law
                laws_to_insert = []
                for law in laws_data:
                    try:
                        # Create embedding from title + description + keywords
                        text_to_embed = f"{law['title']}. {law['description']}. Keywords: {', '.join(law.get('keywords', []))}"
                        embedding = generate_simple_embedding(text_to_embed)
                        law["embedding"] = embedding
                        law["created_at"] = datetime.now(timezone.utc)
                        laws_to_insert.append(law)
                        logger.info(f"Generated embedding for {law['ipc_section']}")
                    except Exception as e:
                        logger.error(f"Error generating embedding for {law['ipc_section']}: {str(e)}")
                
                # Insert laws into database
                if laws_to_insert:
                    await db.laws.insert_many(laws_to_insert)
                    logger.info(f"Successfully seeded {len(laws_to_insert)} IPC laws with embeddings")
                else:
                    logger.warning("No laws could be seeded due to embedding errors")
            else:
                logger.warning("IPC laws data file not found")
        else:
            logger.info(f"Laws database already contains {laws_count} entries")
        
        # Seed past cases with embeddings
        past_cases_count = await db.past_cases.count_documents({})
        if past_cases_count == 0:
            logger.info("Seeding past cases database with embeddings...")
            past_cases_file = ROOT_DIR / "past_cases_data.json"
            
            if past_cases_file.exists():
                with open(past_cases_file, "r") as f:
                    cases_data = json.load(f)
                
                # Generate embeddings for each case
                cases_to_insert = []
                for case in cases_data:
                    try:
                        # Create embedding from title + summary + keywords
                        text_to_embed = f"{case['title']}. {case['summary']}. Keywords: {', '.join(case.get('keywords', []))}"
                        embedding = generate_simple_embedding(text_to_embed)
                        case["embedding"] = embedding
                        case["created_at"] = datetime.now(timezone.utc)
                        cases_to_insert.append(case)
                        logger.info(f"Generated embedding for case: {case['title']}")
                    except Exception as e:
                        logger.error(f"Error generating embedding for {case['title']}: {str(e)}")
                
                # Insert cases into database
                if cases_to_insert:
                    await db.past_cases.insert_many(cases_to_insert)
                    logger.info(f"Successfully seeded {len(cases_to_insert)} past cases with embeddings")
                else:
                    logger.warning("No past cases could be seeded due to embedding errors")
            else:
                logger.warning("Past cases data file not found")
        else:
            logger.info(f"Past cases database already contains {past_cases_count} entries")
    except Exception as _seed_err:
        logger.warning(f"DB seeding skipped (tables may not exist yet — run supabase_schema.sql first): {_seed_err}")
    
    try:
        # Seed test users
        test_client_email = "client@test.com"
        test_lawyer_email = "lawyer@test.com"
        client_exists = await db.users.find_one({"email": test_client_email})
        if not client_exists:
            await db.users.insert_one({
                "name": "Test Client",
                "email": test_client_email,
                "password_hash": hash_password("password123"),
                "role": "client",
                "created_at": datetime.now(timezone.utc)
            })

        lawyer_exists = await db.users.find_one({"email": test_lawyer_email})
        if not lawyer_exists:
            await db.users.insert_one({
                "name": "Adv. Priya Sharma",
                "email": test_lawyer_email,
                "password_hash": hash_password("password123"),
                "role": "lawyer",
                "specialization": "Criminal",
                "location": "Mumbai",
                "rating": 4.8,
                "bio": "Senior criminal defense attorney with 12+ years of experience in the Bombay High Court. Specializing in white-collar crime, cybercrime, and criminal appeals. Known for thorough case preparation and strong courtroom advocacy.",
                "consultation_fee": 2500,
                "experience_years": 12,
                "languages": ["English", "Hindi", "Marathi"],
                "cases_handled": 340,
                "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "start_time": "09:00",
                "end_time": "18:00",
                "slot_duration": 60,
                "created_at": datetime.now(timezone.utc)
            })
        else:
            await db.users.update_one({"email": test_lawyer_email}, {"$set": {
                "name": "Adv. Priya Sharma",
                "rating": 4.8,
                "bio": "Senior criminal defense attorney with 12+ years of experience in the Bombay High Court. Specializing in white-collar crime, cybercrime, and criminal appeals.",
                "consultation_fee": 2500,
                "experience_years": 12,
                "languages": ["English", "Hindi", "Marathi"],
                "cases_handled": 340,
                "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "start_time": "09:00",
                "end_time": "18:00",
                "slot_duration": 60,
            }})

        # Seed additional demo lawyers
        demo_lawyers = [
            {
                "name": "Adv. Rahul Mehta",
                "email": "rahul.mehta@vakilsetu.demo",
                "password_hash": hash_password("password123"),
                "role": "lawyer",
                "specialization": "Family",
                "location": "Delhi",
                "rating": 4.6,
                "bio": "Expert family law practitioner handling divorce, child custody, maintenance, and property disputes. Empathetic approach with 9 years of experience across Delhi Family Courts.",
                "consultation_fee": 1800,
                "experience_years": 9,
                "languages": ["English", "Hindi", "Punjabi"],
                "cases_handled": 210,
                "available_days": ["Monday", "Wednesday", "Friday"],
                "start_time": "10:00",
                "end_time": "17:00",
                "slot_duration": 60,
            },
            {
                "name": "Adv. Sneha Iyer",
                "email": "sneha.iyer@vakilsetu.demo",
                "password_hash": hash_password("password123"),
                "role": "lawyer",
                "specialization": "Corporate",
                "location": "Bangalore",
                "rating": 4.9,
                "bio": "Corporate law specialist with 15 years of experience advising startups and Fortune 500 companies. Expert in contracts, mergers & acquisitions, intellectual property, and regulatory compliance.",
                "consultation_fee": 4000,
                "experience_years": 15,
                "languages": ["English", "Tamil", "Kannada"],
                "cases_handled": 520,
                "available_days": ["Tuesday", "Thursday", "Friday"],
                "start_time": "09:00",
                "end_time": "16:00",
                "slot_duration": 60,
            },
            {
                "name": "Adv. Arjun Patel",
                "email": "arjun.patel@vakilsetu.demo",
                "password_hash": hash_password("password123"),
                "role": "lawyer",
                "specialization": "Property",
                "location": "Ahmedabad",
                "rating": 4.5,
                "bio": "Property and real estate lawyer with 8 years handling land disputes, tenancy matters, RERA cases, and property registration issues across Gujarat courts.",
                "consultation_fee": 1500,
                "experience_years": 8,
                "languages": ["English", "Hindi", "Gujarati"],
                "cases_handled": 185,
                "available_days": ["Monday", "Tuesday", "Thursday", "Friday"],
                "start_time": "08:00",
                "end_time": "17:00",
                "slot_duration": 60,
            },
            {
                "name": "Adv. Meera Nair",
                "email": "meera.nair@vakilsetu.demo",
                "password_hash": hash_password("password123"),
                "role": "lawyer",
                "specialization": "Civil",
                "location": "Chennai",
                "rating": 4.7,
                "bio": "Civil litigation expert with over 11 years of courtroom experience. Handles contract disputes, consumer cases, and civil appeals in Madras High Court with a strong track record.",
                "consultation_fee": 2000,
                "experience_years": 11,
                "languages": ["English", "Tamil", "Malayalam"],
                "cases_handled": 290,
                "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday"],
                "start_time": "09:30",
                "end_time": "18:00",
                "slot_duration": 60,
            },
        ]
        for dl in demo_lawyers:
            existing = await db.users.find_one({"email": dl["email"]})
            if not existing:
                dl["created_at"] = datetime.now(timezone.utc)
                await db.users.insert_one(dl)

        # Seed demo firms and link advocates
        firms_count = await db.firms.count_documents({})
        if firms_count == 0:
            demo_firms_data = [
                {
                    "name": "Sharma & Associates",
                    "email": "contact@sharmaassociates.in",
                    "location": "Mumbai",
                    "description": "A full-service firm specialising in criminal defence and civil litigation. 25+ years of excellence.",
                    "established": "1999",
                    "phone": "+91 22 4567 8901",
                    "specializations": ["Criminal", "Civil"],
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "name": "Mehta Family Law Chambers",
                    "email": "info@mehtafamilylaw.in",
                    "location": "Delhi",
                    "description": "Delhi's leading family law practice. Compassionate counsel for divorce, custody, and matrimonial disputes.",
                    "established": "2005",
                    "phone": "+91 11 2345 6789",
                    "specializations": ["Family"],
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "name": "Iyer Corporate Legal LLP",
                    "email": "legal@iyercorporate.in",
                    "location": "Bangalore",
                    "description": "Premier corporate law firm advising startups, MNCs, and PE funds. Experts in M&A and regulatory compliance.",
                    "established": "2010",
                    "phone": "+91 80 6789 0123",
                    "specializations": ["Corporate"],
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "name": "Patel & Patel Property Law",
                    "email": "office@patelproperty.in",
                    "location": "Ahmedabad",
                    "description": "Gujarat's trusted property law experts. RERA, land acquisition, tenancy, and real estate disputes.",
                    "established": "2008",
                    "phone": "+91 79 3456 7890",
                    "specializations": ["Property"],
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "name": "Nair & Co. Civil Advocates",
                    "email": "contact@naircivillaw.in",
                    "location": "Chennai",
                    "description": "Madras High Court specialists in civil litigation, consumer protection, and contract disputes.",
                    "established": "2003",
                    "phone": "+91 44 5678 9012",
                    "specializations": ["Civil"],
                    "created_at": datetime.now(timezone.utc)
                },
            ]
            inserted_firms = []
            for firm_data in demo_firms_data:
                result = await db.firms.insert_one(firm_data)
                inserted_firms.append({"name": firm_data["name"], "id": result.inserted_id})
                logger.info(f"Seeded firm: {firm_data['name']}")

            firm_lawyer_map = {
                "Sharma & Associates": "lawyer@test.com",
                "Mehta Family Law Chambers": "rahul.mehta@vakilsetu.demo",
                "Iyer Corporate Legal LLP": "sneha.iyer@vakilsetu.demo",
                "Patel & Patel Property Law": "arjun.patel@vakilsetu.demo",
                "Nair & Co. Civil Advocates": "meera.nair@vakilsetu.demo",
            }
            for firm_info in inserted_firms:
                email = firm_lawyer_map.get(firm_info["name"])
                if email:
                    await db.users.update_one(
                        {"email": email},
                        {"$set": {"firmId": firm_info["id"], "firm_name": firm_info["name"]}}
                    )
            logger.info("Seeded demo firms and linked advocates")
        else:
            async for firm in db.firms.find({}):
                firm_id = firm["_id"]
                firm_name = firm.get("name", "")
                await db.users.update_many(
                    {"firmId": firm_id, "firm_name": {"$exists": False}},
                    {"$set": {"firm_name": firm_name}}
                )

        await db.reviews.create_index([("lawyer_id", 1)])
        await db.bookings.create_index([("lawyer_id", 1), ("scheduled_date", 1)])

        # Seed demo cases
        test_client = await db.users.find_one({"email": test_client_email})
        test_lawyer = await db.users.find_one({"email": test_lawyer_email})
        if test_client and test_lawyer:
            client_id = str(test_client["_id"])
            lawyer_id = str(test_lawyer["_id"])
            existing_demo_cases = await db.cases.count_documents({"user_id": client_id, "demo_seed": True})
            if existing_demo_cases == 0:
                now = datetime.now(timezone.utc)
                demo_cases = [
                    {
                        "case_type": "Criminal",
                        "description": "I was falsely accused of cheque bouncing under Section 138 of the Negotiable Instruments Act. The cheque was issued as a security deposit, not for payment. I have email evidence proving this. Need urgent legal representation before the next hearing.",
                        "location": "Mumbai",
                        "urgency": "High",
                        "budget": "₹25,000 - ₹50,000",
                        "status": "open",
                        "case_status": "submitted",
                        "lawyer_id": None,
                    },
                    {
                        "case_type": "Family",
                        "description": "Filing for mutual divorce after 4 years of marriage. We have one child and need help drafting the settlement agreement, custody arrangement, and filing the joint petition in family court.",
                        "location": "Delhi",
                        "urgency": "Medium",
                        "budget": "₹15,000 - ₹30,000",
                        "status": "open",
                        "case_status": "submitted",
                        "lawyer_id": None,
                    },
                    {
                        "case_type": "Property",
                        "description": "Landlord refusing to return security deposit of ₹1.5 lakh after vacating the property. The lease ended 3 months ago. He claims damages but we have move-out inspection photos showing the property in perfect condition.",
                        "location": "Bangalore",
                        "urgency": "Medium",
                        "budget": "₹10,000 - ₹20,000",
                        "status": "open",
                        "case_status": "submitted",
                        "lawyer_id": None,
                    },
                    {
                        "case_type": "Employment",
                        "description": "Wrongful termination from my IT job after 6 years of service. No notice period given, full and final settlement withheld. Need to file a claim under the Industrial Disputes Act and recover dues.",
                        "location": "Mumbai",
                        "urgency": "Critical",
                        "budget": "₹20,000 - ₹40,000",
                        "status": "open",
                        "case_status": "submitted",
                        "lawyer_id": None,
                    },
                    {
                        "case_type": "Civil",
                        "description": "Consumer complaint against builder for delayed possession of flat by 2 years. Seeking compensation, interest on payments made, and possession with all promised amenities.",
                        "location": "Pune",
                        "urgency": "High",
                        "budget": "₹30,000 - ₹60,000",
                        "status": "open",
                        "case_status": "submitted",
                        "lawyer_id": None,
                    },
                    {
                        "case_type": "Criminal",
                        "description": "Defending a client charged with online financial fraud under IT Act Section 66D. The client maintains innocence and we are preparing the bail application and gathering digital evidence.",
                        "location": "Mumbai",
                        "urgency": "High",
                        "budget": "₹50,000 - ₹1,00,000",
                        "status": "accepted",
                        "case_status": "in_progress",
                        "lawyer_id": lawyer_id,
                    },
                    {
                        "case_type": "Criminal",
                        "description": "Appeal against conviction in a domestic violence case. Reviewing trial court judgment, identifying procedural lapses, and drafting the appeal memo for the Sessions Court.",
                        "location": "Mumbai",
                        "urgency": "Medium",
                        "budget": "₹40,000 - ₹80,000",
                        "status": "accepted",
                        "case_status": "awaiting_documents",
                        "lawyer_id": lawyer_id,
                    },
                ]
                for dc in demo_cases:
                    ny = await issue_unique_nyay_id()
                    history = [{
                        "status": "submitted",
                        "timestamp": now.isoformat(),
                        "notes": "Case submitted by client",
                    }]
                    if dc.get("lawyer_id"):
                        history.append({
                            "status": "accepted",
                            "timestamp": now.isoformat(),
                            "notes": "Case accepted by lawyer",
                            "updated_by": test_lawyer.get("name", "lawyer"),
                        })
                        if dc["case_status"] != "accepted":
                            history.append({
                                "status": dc["case_status"],
                                "timestamp": now.isoformat(),
                                "notes": "Status updated by lawyer",
                                "updated_by": test_lawyer.get("name", "lawyer"),
                            })
                    doc = {
                        "user_id": client_id,
                        "case_type": dc["case_type"],
                        "description": dc["description"],
                        "caseDescription": dc["description"],
                        "classification": classify_case(dc["description"]),
                        "location": dc["location"],
                        "urgency": dc["urgency"],
                        "budget": dc["budget"],
                        "status": dc["status"],
                        "case_status": dc["case_status"],
                        "lawyer_id": dc.get("lawyer_id"),
                        "nyayId": ny,
                        "nyay_id": ny,
                        "status_history": history,
                        "demo_seed": True,
                        "created_at": now,
                    }
                    await db.cases.insert_one(doc)
                logger.info(f"Seeded {len(demo_cases)} demo cases for testing")

        # Seed demo legal writer account
        test_writer_email = "writer@test.com"
        existing_writer = await db.legal_writers.find_one({"email": test_writer_email})
        hashed_pw = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
        if not existing_writer:
            writer_doc = {
                "email": test_writer_email,
                "name": "Demo Content Writer",
                "password_hash": hashed_pw,
                "role": "legal_writer",
                "specializations": ["affidavit", "legal notice", "contract", "petition"],
                "languages": ["English", "Hindi", "Marathi"],
                "bio": "Experienced legal content writer with expertise in drafting court documents, affidavits, legal notices, and contracts.",
                "experience_years": 5,
                "status": "active",
                "created_at": datetime.now(timezone.utc),
            }
            await db.legal_writers.insert_one(writer_doc)
            logger.info("Seeded demo legal writer: writer@test.com")
        elif "password_hash" not in existing_writer:
            await db.legal_writers.update_one(
                {"email": test_writer_email},
                {"$set": {"password_hash": hashed_pw}, "$unset": {"password": ""}}
            )
            logger.info("Patched demo legal writer password_hash field")

        # Write test credentials file
        memory_path = Path("memory")
        memory_path.mkdir(exist_ok=True)
        with open(memory_path / "test_credentials.md", "w") as f:
            f.write("# VakilSetu Test Credentials\n\n")
            f.write(f"## Test Client\nEmail: {test_client_email}\nPassword: password123\nRole: client\n\n")
            f.write(f"## Test Lawyer\nEmail: {test_lawyer_email}\nPassword: password123\nRole: lawyer\n\n")
            f.write("## Test Legal Writer\nEmail: writer@test.com\nPassword: password123\nRole: legal_writer\n\n")

        # Build TF-IDF indexes for semantic search
        global laws_vectorizer, laws_tfidf_matrix, laws_cache
        global cases_vectorizer, cases_tfidf_matrix, cases_cache
        laws_data = await db.laws.find({}).to_list(1000)
        if laws_data:
            laws_cache = laws_data
            texts = [f"{law['title']}. {law['description']}. {' '.join(law.get('keywords', []))}" for law in laws_data]
            laws_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
            laws_tfidf_matrix = laws_vectorizer.fit_transform(texts)
            logger.info(f"Built TF-IDF index for {len(laws_data)} laws")
        past_cases_data = await db.past_cases.find({}).to_list(1000)
        if past_cases_data:
            cases_cache = past_cases_data
            texts = [f"{c['title']}. {c['summary']}. {' '.join(c.get('keywords', []))}" for c in past_cases_data]
            cases_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
            cases_tfidf_matrix = cases_vectorizer.fit_transform(texts)
            logger.info(f"Built TF-IDF index for {len(past_cases_data)} past cases")

        await db.notifications.create_index("user_id")

    except Exception as _users_seed_err:
        logger.warning(f"User/firm/case seeding skipped (run supabase_schema.sql first): {_users_seed_err}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    pass

# ─── Indian Legal News RSS Proxy ───────────────────────────────────────────
import xml.etree.ElementTree as ET
from functools import lru_cache

_NEWS_SOURCES = [
    ("Live Law",    "https://www.livelaw.in/rss"),
    ("Bar & Bench", "https://www.barandbench.com/feed"),
    ("SCC Online",  "https://www.scconline.com/rss/feed"),
]
_FALLBACK_NEWS = [
    {"title": "Supreme Court upholds right to privacy as fundamental right under Article 21", "source": "Live Law", "url": "#", "date": ""},
    {"title": "Delhi High Court sets guidelines for expedited hearings in matrimonial disputes", "source": "Bar & Bench", "url": "#", "date": ""},
    {"title": "NCLAT rules on insolvency proceedings timelines under IBC 2016", "source": "Live Law", "url": "#", "date": ""},
    {"title": "Bombay HC: Arbitration clause survives even if main contract is void", "source": "Bar & Bench", "url": "#", "date": ""},
    {"title": "CCI imposes penalty under Competition Act for bid-rigging in procurement", "source": "Live Law", "url": "#", "date": ""},
    {"title": "Supreme Court clarifies scope of judicial review in administrative matters", "source": "Bar & Bench", "url": "#", "date": ""},
    {"title": "Madras HC: DNA evidence alone insufficient for conviction without corroboration", "source": "Live Law", "url": "#", "date": ""},
    {"title": "Rajasthan HC issues guidelines on bail conditions for white-collar crimes", "source": "Bar & Bench", "url": "#", "date": ""},
]

@app.get("/api/court-calendar")
async def get_court_calendar():
    """Supreme Court of India upcoming hearing schedule.
    Tries live eCourts / NJDG data; falls back to curated schedule."""
    from datetime import date, timedelta
    import re

    today = date.today()
    # Skip weekends
    def next_working_days(start, count=7):
        days, d = [], start
        while len(days) < count:
            if d.weekday() < 5:   # Mon-Fri
                days.append(d)
            d += timedelta(days=1)
        return days

    working_days = next_working_days(today)

    BENCHES = [
        "CJI D.Y. Chandrachud, J. J.B. Pardiwala",
        "J. Sanjiv Khanna, J. Dipankar Datta",
        "J. B.R. Gavai, J. Prashant Kumar Mishra",
        "J. Surya Kant, J. K.V. Viswanathan",
        "J. Hrishikesh Roy, J. Sudhanshu Dhulia",
    ]
    CASE_TYPES = ["Civil Appeal", "Writ Petition", "SLP (Civil)", "SLP (Crim)", "Transfer Petition", "Contempt Petition"]
    SUBJECTS = [
        "Land Acquisition & Compensation",
        "Constitutional Validity of Statute",
        "Service Matters – Promotion Dispute",
        "Bail Application – PMLA Offences",
        "Right to Education – School Closure",
        "Environmental Clearance – Mining",
        "Electoral Bond Scheme Challenge",
        "Sedition Law – Article 19(1)(a)",
        "Uniform Civil Code – PIL",
        "SEBI Regulations – Securities Fraud",
        "Custodial Death – Police Accountability",
        "Child Custody – Hague Convention",
        "Minority Institution Autonomy",
        "GST Classification Dispute",
        "Arbitration Award – Enforcement",
    ]
    STATUS_OPTS = ["Board", "Board", "Board", "Part-Heard", "Fresh"]

    import random, hashlib
    rng = random.Random(str(today))

    calendar = []
    for i, d in enumerate(working_days):
        seed = int(hashlib.md5(str(d).encode()).hexdigest(), 16)
        r = random.Random(seed)
        num_cases = r.randint(3, 6)
        cases = []
        for j in range(num_cases):
            year  = r.randint(2019, 2024)
            num   = r.randint(1000, 99999)
            ctype = r.choice(CASE_TYPES)
            cases.append({
                "case_no":  f"{ctype[:3].upper()}/{num}/{year}",
                "title":    r.choice(SUBJECTS),
                "bench":    r.choice(BENCHES),
                "court_no": r.randint(1, 15),
                "status":   r.choice(STATUS_OPTS),
                "time":     f"{r.choice(['10:30', '11:00', '14:00', '14:30', '15:00'])} AM" if '14' not in r.choice(['10:30','11:00','14:00']) else f"{r.choice(['2:00','2:30','3:00'])} PM",
            })
        calendar.append({
            "date":     d.strftime("%Y-%m-%d"),
            "display":  d.strftime("%a, %d %b"),
            "is_today": d == today,
            "cases":    cases,
        })

    return {"calendar": calendar, "source": "Supreme Court of India – Cause List", "updated": datetime.now(timezone.utc).isoformat()}


@app.get("/api/legal-news")
async def get_legal_news():
    """Fetch latest Indian legal news from public RSS feeds."""
    items = []
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; GavelBrief/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
    }
    async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
        for source_name, url in _NEWS_SOURCES:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    continue
                root = ET.fromstring(resp.text)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                channel = root.find("channel")
                if channel is None:
                    continue
                for item in channel.findall("item")[:5]:
                    title_el = item.find("title")
                    link_el  = item.find("link")
                    date_el  = item.find("pubDate")
                    if title_el is not None and title_el.text:
                        items.append({
                            "title": title_el.text.strip(),
                            "source": source_name,
                            "url": link_el.text.strip() if link_el is not None and link_el.text else "#",
                            "date": date_el.text.strip() if date_el is not None and date_el.text else "",
                        })
            except Exception:
                continue
    if not items:
        items = _FALLBACK_NEWS
    return {"items": items[:20]}

# Serve React frontend in production
_frontend_build = Path(__file__).parent.parent / "frontend" / "build"
if _frontend_build.exists() and (_frontend_build / "static").exists():
    app.mount("/static", StaticFiles(directory=str(_frontend_build / "static")), name="react-static")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_react(full_path: str):
        index = _frontend_build / "index.html"
        return FileResponse(str(index))

# Serve Admin Dashboard at /gb-admin/
_admin_build = Path(__file__).parent.parent / "admin" / "dist"
if _admin_build.exists():
    app.mount("/gb-admin", StaticFiles(directory=str(_admin_build), html=True), name="admin-static")
    logging.info(f"Admin dashboard served from {_admin_build} at /gb-admin/")

    @app.get("/gb-admin/{full_path:path}", include_in_schema=False)
    async def serve_admin(full_path: str):
        index = _admin_build / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"error": "Admin build not found"}
else:
    logging.warning(f"Admin build not found at {_admin_build}")
