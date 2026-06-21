"""
Admin API routes for Gavel & Brief Admin Dashboard.
All routes are prefixed with /admin/api and require admin JWT auth.
Uses MongoDB Atlas exclusively — no psycopg2 / Supabase dependency.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import jwt
import bcrypt
import csv
import io
import uuid
import json
import logging
import re
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

ADMIN_JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")
ADMIN_JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@gavelandbrief.com")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")
ADMIN_PASSWORD_PLAIN = os.environ.get("ADMIN_PASSWORD", "Admin@GB2024")

router = APIRouter(prefix="/admin/api", tags=["admin"])


# ── MongoDB helper ─────────────────────────────────────────────────────────────

def _get_db():
    """Return the MongoDB db object from server module."""
    try:
        import server as srv
        return getattr(srv, "db", None)
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ── MongoDB CRUD helpers ───────────────────────────────────────────────────────

async def _mg_list(collection: str, search_field: str = None, search: str = None,
                   limit: int = 50, offset: int = 0) -> Dict:
    db = _get_db()
    if db is None:
        return {"items": [], "total": 0}
    try:
        coll = db[collection]
        query = {}
        if search and search_field:
            query[search_field] = {"$regex": search, "$options": "i"}
        total = await coll.count_documents(query)
        cursor = coll.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return {"items": items, "total": total}
    except Exception as e:
        logger.error(f"mg_list {collection}: {e}")
        return {"items": [], "total": 0}


async def _mg_get(collection: str, doc_id: str) -> Optional[Dict]:
    db = _get_db()
    if db is None:
        return None
    try:
        doc = await db[collection].find_one({"id": doc_id}, {"_id": 0})
        return doc
    except Exception as e:
        logger.error(f"mg_get {collection}/{doc_id}: {e}")
        return None


async def _mg_insert(collection: str, data: Dict) -> Dict:
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now_iso())
        await db[collection].insert_one({**data, "_id": data["id"]})
        return data
    except Exception as e:
        logger.error(f"mg_insert {collection}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _mg_update(collection: str, doc_id: str, data: Dict) -> Dict:
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        data["updated_at"] = _now_iso()
        await db[collection].update_one({"id": doc_id}, {"$set": data})
        updated = await db[collection].find_one({"id": doc_id}, {"_id": 0})
        return updated or data
    except Exception as e:
        logger.error(f"mg_update {collection}/{doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _mg_delete(collection: str, doc_id: str):
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        await db[collection].delete_one({"id": doc_id})
    except Exception as e:
        logger.error(f"mg_delete {collection}/{doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Text extraction from bytes ─────────────────────────────────────────────────

def _extract_text_from_bytes(content: bytes, ext: str) -> str:
    """Extract readable text from file bytes without external PDF libs."""
    if ext in ("txt", "md"):
        return content.decode("utf-8", errors="ignore")
    if ext == "csv":
        return content.decode("utf-8", errors="ignore")
    if ext == "json":
        try:
            obj = json.loads(content.decode("utf-8", errors="ignore"))
            return json.dumps(obj, indent=2)
        except Exception:
            return content.decode("utf-8", errors="ignore")
    if ext == "pdf":
        # Try PyMuPDF (fitz) if available
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            return "\n".join(page.get_text() for page in doc)
        except ImportError:
            pass
        # Fallback: extract readable ASCII strings from raw PDF bytes
        raw = content.decode("latin-1", errors="ignore")
        # Find text between BT and ET (PDF text operators)
        chunks = re.findall(r'\((.*?)\)', raw)
        text = " ".join(c for c in chunks if len(c) > 2 and c.isprintable())
        if not text.strip():
            # Last resort: extract printable runs ≥4 chars
            text = " ".join(re.findall(r'[A-Za-z0-9 ,.\-:;\(\)\[\]]{4,}', raw))
        return text[:50000]  # cap at 50k chars
    return content.decode("utf-8", errors="ignore")


# ── OpenAI NLP analysis ────────────────────────────────────────────────────────

async def _ai_classify_and_extract(text: str, filename: str) -> Dict:
    """Use OpenAI to classify document type and extract structured legal content."""
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return {
            "doc_type": "unknown",
            "summary": "AI classification unavailable — no API key configured.",
            "law_points": [],
            "cases": [],
            "acts": [],
            "raw_text_preview": text[:500],
        }
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        # Truncate to keep within token limits
        preview = text[:8000]

        prompt = f"""You are a legal document classifier for an Indian legal platform.
Analyse the document text below and return a JSON object with these exact fields:

{{
  "doc_type": one of ["ipc_section", "bns_section", "landmark_case", "act", "legal_guide", "court_order", "mixed", "unknown"],
  "summary": "2-3 sentence summary of the document",
  "law_points": [
    {{"section": "IPC 302 / BNS 101 etc", "title": "short title", "description": "what it says", "category": "Criminal/Civil/etc"}}
  ],
  "cases": [
    {{"title": "case name", "court": "court name", "year": 2020, "citation": "AIR 2020 SC 123", "category": "Criminal/Civil", "summary": "brief ruling"}}
  ],
  "acts": [
    {{"title": "act name", "number": "act number", "year": 2023, "ministry": "ministry", "category": "category", "description": "description"}}
  ]
}}

Return ONLY valid JSON — no markdown, no explanation.

Filename: {filename}
Document text:
{preview}"""

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2000,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r'^```[a-z]*\n?', '', raw)
            raw = re.sub(r'\n?```$', '', raw)
        result = json.loads(raw)
        result["raw_text_preview"] = text[:500]
        return result
    except Exception as e:
        logger.error(f"AI classify error: {e}")
        return {
            "doc_type": "unknown",
            "summary": f"AI analysis failed: {str(e)[:120]}",
            "law_points": [],
            "cases": [],
            "acts": [],
            "raw_text_preview": text[:500],
        }


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ChunkUpdate(BaseModel):
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SourceCreate(BaseModel):
    name: str
    url: Optional[str] = None
    type: Optional[str] = "other"
    description: Optional[str] = None

class CaseCreate(BaseModel):
    title: str
    court: Optional[str] = None
    year: Optional[int] = None
    citation: Optional[str] = None
    category: Optional[str] = "civil"
    summary: Optional[str] = None

class ActCreate(BaseModel):
    title: str
    number: Optional[str] = None
    year: Optional[int] = None
    ministry: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class SettingsUpdate(BaseModel):
    new_password: Optional[str] = None


# ── Auth ──────────────────────────────────────────────────────────────────────

def _make_admin_token(email: str) -> str:
    payload = {
        "sub": email,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "admin_access",
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=ADMIN_JWT_ALGORITHM)


async def require_admin(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin token")
    token = auth[7:]
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[ADMIN_JWT_ALGORITHM])
        if payload.get("role") != "admin" or payload.get("type") != "admin_access":
            raise HTTPException(status_code=403, detail="Not an admin token")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/login")
async def admin_login(body: LoginRequest):
    if body.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if ADMIN_PASSWORD_HASH:
        ok = bcrypt.checkpw(body.password.encode(), ADMIN_PASSWORD_HASH.encode())
    else:
        ok = body.password == ADMIN_PASSWORD_PLAIN

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": _make_admin_token(body.email), "email": body.email}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(admin: str = Depends(require_admin)):
    db = _get_db()
    counts = {"documents": 0, "chunks": 0, "sources": 0, "cases": 0, "acts": 0, "users": 0}
    recent = []

    if db is not None:
        try:
            counts["documents"] = await db["admin_documents"].count_documents({})
            counts["chunks"] = await db["admin_chunks"].count_documents({})
            counts["sources"] = await db["admin_sources"].count_documents({})
            counts["cases"] = await db["admin_cases"].count_documents({})
            counts["acts"] = await db["admin_acts"].count_documents({})
            counts["users"] = await db["users"].count_documents({})

            # Recent activity from documents
            cursor = db["admin_documents"].find({}, {"_id": 0, "id": 1, "title": 1, "created_at": 1}).sort("created_at", -1).limit(5)
            docs = await cursor.to_list(length=5)
            for d in docs:
                recent.append({"type": "document", "title": d.get("title", "Untitled"), "created_at": d.get("created_at", "")})
        except Exception as e:
            logger.error(f"Dashboard error: {e}")

    recent.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"counts": counts, "recent_activity": recent[:10]}


# ── Documents ─────────────────────────────────────────────────────────────────

@router.get("/documents")
async def list_documents(search: str = "", limit: int = 50, offset: int = 0,
                         admin: str = Depends(require_admin)):
    return await _mg_list("admin_documents", "title", search or None, limit, offset)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, admin: str = Depends(require_admin)):
    doc = await _mg_get("admin_documents", doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    content = await file.read()
    filename = file.filename or "untitled"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    text_content = _extract_text_from_bytes(content, ext)

    doc_id = _new_id()
    data = {
        "id": doc_id,
        "title": filename.rsplit(".", 1)[0],
        "source": "Upload",
        "file_type": ext,
        "file_size": len(content),
        "chunk_count": 0,
        "created_at": _now_iso(),
        "metadata": {"original_filename": filename},
        "text_preview": text_content[:500] if text_content else "",
    }
    await _mg_insert("admin_documents", data)

    # Chunk and store
    chunks_created = 0
    if text_content.strip():
        words = text_content.split()
        chunk_texts = [" ".join(words[i:i + 500]) for i in range(0, len(words), 500)]
        for idx, chunk_text in enumerate(chunk_texts[:200]):
            await _mg_insert("admin_chunks", {
                "id": _new_id(),
                "document_id": doc_id,
                "document_title": data["title"],
                "content": chunk_text,
                "chunk_index": idx,
                "created_at": _now_iso(),
            })
            chunks_created += 1
        await _get_db()["admin_documents"].update_one(
            {"id": doc_id}, {"$set": {"chunk_count": chunks_created}}
        )

    return {**data, "chunk_count": chunks_created, "message": f"Uploaded with {chunks_created} chunks"}


@router.post("/documents/import-csv")
async def import_documents_csv(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="ignore")))
    imported = 0
    for row in reader:
        try:
            await _mg_insert("admin_documents", {
                "id": _new_id(),
                "title": row.get("title", row.get("name", "Untitled")),
                "source": row.get("source", ""),
                "file_type": row.get("file_type", row.get("type", "csv")),
                "chunk_count": 0,
                "created_at": _now_iso(),
                "metadata": {k: v for k, v in row.items() if k not in ("title", "source", "file_type")},
            })
            imported += 1
        except Exception as e:
            logger.error(f"CSV row import failed: {e}")
    return {"imported": imported, "message": f"Imported {imported} documents"}


@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, body: DocumentUpdate, admin: str = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await _mg_update("admin_documents", doc_id, updates)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, admin: str = Depends(require_admin)):
    db = _get_db()
    if db:
        await db["admin_chunks"].delete_many({"document_id": doc_id})
    await _mg_delete("admin_documents", doc_id)
    return {"ok": True}


# ── Chunks ────────────────────────────────────────────────────────────────────

@router.get("/chunks")
async def list_chunks(q: str = "", limit: int = 20, offset: int = 0,
                      admin: str = Depends(require_admin)):
    return await _mg_list("admin_chunks", "content", q or None, limit, offset)


@router.get("/chunks/search")
async def search_chunks(q: str = "", admin: str = Depends(require_admin)):
    return await _mg_list("admin_chunks", "content", q, 50, 0)


@router.get("/chunks/{chunk_id}")
async def get_chunk(chunk_id: str, admin: str = Depends(require_admin)):
    chunk = await _mg_get("admin_chunks", chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return chunk


@router.put("/chunks/{chunk_id}")
async def update_chunk(chunk_id: str, body: ChunkUpdate, admin: str = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await _mg_update("admin_chunks", chunk_id, updates)


@router.delete("/chunks/{chunk_id}")
async def delete_chunk(chunk_id: str, admin: str = Depends(require_admin)):
    await _mg_delete("admin_chunks", chunk_id)
    return {"ok": True}


# ── Sources ───────────────────────────────────────────────────────────────────

@router.get("/sources")
async def list_sources(search: str = "", limit: int = 50, offset: int = 0,
                       admin: str = Depends(require_admin)):
    return await _mg_list("admin_sources", "name", search or None, limit, offset)


@router.post("/sources")
async def create_source(body: SourceCreate, admin: str = Depends(require_admin)):
    return await _mg_insert("admin_sources", body.model_dump())


@router.put("/sources/{source_id}")
async def update_source(source_id: str, body: SourceCreate, admin: str = Depends(require_admin)):
    return await _mg_update("admin_sources", source_id, body.model_dump())


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, admin: str = Depends(require_admin)):
    await _mg_delete("admin_sources", source_id)
    return {"ok": True}


@router.post("/sources/import-csv")
async def import_sources_csv(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="ignore")))
    imported = 0
    for row in reader:
        try:
            await _mg_insert("admin_sources", {
                "id": _new_id(), "name": row.get("name", ""), "url": row.get("url", ""),
                "type": row.get("type", "other"), "description": row.get("description", ""),
                "created_at": _now_iso(),
            })
            imported += 1
        except Exception:
            pass
    return {"imported": imported}


# ── Cases (admin-curated landmark cases) ──────────────────────────────────────

@router.get("/cases")
async def list_cases(search: str = "", limit: int = 50, offset: int = 0,
                     admin: str = Depends(require_admin)):
    return await _mg_list("admin_cases", "title", search or None, limit, offset)


@router.get("/cases/{case_id}")
async def get_case(case_id: str, admin: str = Depends(require_admin)):
    case = await _mg_get("admin_cases", case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.post("/cases")
async def create_case(body: CaseCreate, admin: str = Depends(require_admin)):
    return await _mg_insert("admin_cases", body.model_dump())


@router.put("/cases/{case_id}")
async def update_case(case_id: str, body: CaseCreate, admin: str = Depends(require_admin)):
    return await _mg_update("admin_cases", case_id, body.model_dump())


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, admin: str = Depends(require_admin)):
    await _mg_delete("admin_cases", case_id)
    return {"ok": True}


@router.post("/cases/import-csv")
async def import_cases_csv(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="ignore")))
    imported = 0
    for row in reader:
        try:
            year_val = row.get("year")
            await _mg_insert("admin_cases", {
                "id": _new_id(), "title": row.get("title", ""), "court": row.get("court", ""),
                "year": int(year_val) if year_val and str(year_val).isdigit() else None,
                "citation": row.get("citation", ""), "category": row.get("category", "civil"),
                "summary": row.get("summary", ""), "created_at": _now_iso(),
            })
            imported += 1
        except Exception:
            pass
    return {"imported": imported}


# ── Acts ──────────────────────────────────────────────────────────────────────

@router.get("/acts")
async def list_acts(search: str = "", limit: int = 50, offset: int = 0,
                    admin: str = Depends(require_admin)):
    return await _mg_list("admin_acts", "title", search or None, limit, offset)


@router.get("/acts/{act_id}")
async def get_act(act_id: str, admin: str = Depends(require_admin)):
    act = await _mg_get("admin_acts", act_id)
    if not act:
        raise HTTPException(status_code=404, detail="Act not found")
    return act


@router.post("/acts")
async def create_act(body: ActCreate, admin: str = Depends(require_admin)):
    return await _mg_insert("admin_acts", body.model_dump())


@router.put("/acts/{act_id}")
async def update_act(act_id: str, body: ActCreate, admin: str = Depends(require_admin)):
    return await _mg_update("admin_acts", act_id, body.model_dump())


@router.delete("/acts/{act_id}")
async def delete_act(act_id: str, admin: str = Depends(require_admin)):
    await _mg_delete("admin_acts", act_id)
    return {"ok": True}


@router.post("/acts/import-csv")
async def import_acts_csv(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="ignore")))
    imported = 0
    for row in reader:
        try:
            year_val = row.get("year")
            await _mg_insert("admin_acts", {
                "id": _new_id(), "title": row.get("title", ""), "number": row.get("number", ""),
                "year": int(year_val) if year_val and str(year_val).isdigit() else None,
                "ministry": row.get("ministry", ""), "category": row.get("category", ""),
                "description": row.get("description", ""), "created_at": _now_iso(),
            })
            imported += 1
        except Exception:
            pass
    return {"imported": imported}


# ── Users (read from main MongoDB collections) ────────────────────────────────

@router.get("/users")
async def list_users(search: str = "", limit: int = 50, offset: int = 0,
                     admin: str = Depends(require_admin)):
    db = _get_db()
    if db is None:
        return {"items": [], "total": 0}
    try:
        query = {}
        if search:
            query["$or"] = [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}},
            ]
        total = await db["users"].count_documents(query)
        cursor = db["users"].find(
            query,
            {"_id": 0, "password": 0, "hashed_password": 0}
        ).sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return {"items": items, "total": total}
    except Exception as e:
        logger.error(f"List users: {e}")
        return {"items": [], "total": 0}


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, admin: str = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await _mg_update("users", user_id, updates)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: str = Depends(require_admin)):
    await _mg_delete("users", user_id)
    return {"ok": True}


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(admin: str = Depends(require_admin)):
    db = _get_db()
    doc_count = 0
    chunk_count = 0
    if db is not None:
        try:
            doc_count = await db["admin_documents"].count_documents({})
            chunk_count = await db["admin_chunks"].count_documents({})
        except Exception:
            pass
    return {
        "admin_email": ADMIN_EMAIL,
        "openai_configured": bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")),
        "db_backend": "mongodb",
        "document_count": doc_count,
        "chunk_count": chunk_count,
    }


@router.put("/settings")
async def update_settings(body: SettingsUpdate, admin: str = Depends(require_admin)):
    if body.new_password:
        if len(body.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
        db = _get_db()
        if db is not None:
            await db["admin_settings"].update_one(
                {"key": "admin_password_hash"},
                {"$set": {"key": "admin_password_hash", "value": hashed, "updated_at": _now_iso()}},
                upsert=True,
            )
        return {"message": "Password updated — restart server to take effect"}
    return {"message": "No changes made"}


@router.post("/settings/migrate")
async def run_migration(admin: str = Depends(require_admin)):
    """Verify MongoDB collections are accessible."""
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    collections = ["admin_documents", "admin_chunks", "admin_sources", "admin_cases", "admin_acts", "users", "cases"]
    ready = []
    for col in collections:
        try:
            await db[col].count_documents({})
            ready.append(col)
        except Exception:
            pass
    return {
        "message": f"MongoDB ready — {len(ready)}/{len(collections)} collections accessible",
        "tables_ready": ready,
        "tables_missing": [c for c in collections if c not in ready],
        "action_required": False,
        "db_backend": "mongodb",
    }


# ── NLP Pipeline ──────────────────────────────────────────────────────────────

@router.post("/pipeline/run")
async def run_pipeline(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    """
    Upload a legal document (PDF/TXT/CSV/JSON).
    Extract text → AI classify → store law points, cases, acts in MongoDB → return analysis.
    Extracted data feeds directly into the intelligence engine.
    """
    content = await file.read()
    filename = file.filename or "document.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    # 1. Extract text
    text = _extract_text_from_bytes(content, ext)

    # 2. AI classify + extract structured content
    analysis = await _ai_classify_and_extract(text, filename)

    db = _get_db()
    stored = {"law_points": 0, "cases": 0, "acts": 0}

    if db is not None:
        # 3. Store extracted law points into ipc_laws (feeds intelligence engine)
        for lp in analysis.get("law_points", []):
            try:
                existing = await db["ipc_laws"].find_one({"section": lp.get("section")})
                if not existing:
                    await db["ipc_laws"].insert_one({
                        "_id": _new_id(),
                        "section": lp.get("section", ""),
                        "title": lp.get("title", ""),
                        "description": lp.get("description", ""),
                        "category": lp.get("category", "General"),
                        "source": f"Admin Pipeline — {filename}",
                        "created_at": _now_iso(),
                    })
                    stored["law_points"] += 1
            except Exception as e:
                logger.error(f"Store law point: {e}")

        # 4. Store extracted cases into past_cases (feeds intelligence engine)
        for case in analysis.get("cases", []):
            try:
                existing = await db["past_cases"].find_one({"title": case.get("title")})
                if not existing:
                    await db["past_cases"].insert_one({
                        "_id": _new_id(),
                        "title": case.get("title", ""),
                        "court": case.get("court", ""),
                        "year": case.get("year"),
                        "citation": case.get("citation", ""),
                        "category": case.get("category", "General"),
                        "summary": case.get("summary", ""),
                        "source": f"Admin Pipeline — {filename}",
                        "created_at": _now_iso(),
                    })
                    stored["cases"] += 1
            except Exception as e:
                logger.error(f"Store case: {e}")

        # 5. Store acts into admin_acts
        for act in analysis.get("acts", []):
            try:
                existing = await db["admin_acts"].find_one({"title": act.get("title")})
                if not existing:
                    await _mg_insert("admin_acts", {
                        "title": act.get("title", ""),
                        "number": act.get("number", ""),
                        "year": act.get("year"),
                        "ministry": act.get("ministry", ""),
                        "category": act.get("category", ""),
                        "description": act.get("description", ""),
                    })
                    stored["acts"] += 1
            except Exception as e:
                logger.error(f"Store act: {e}")

        # 6. Save the full document record
        await _mg_insert("admin_documents", {
            "id": _new_id(),
            "title": filename.rsplit(".", 1)[0],
            "source": "NLP Pipeline",
            "file_type": ext,
            "file_size": len(content),
            "doc_type": analysis.get("doc_type", "unknown"),
            "summary": analysis.get("summary", ""),
            "chunk_count": 0,
            "created_at": _now_iso(),
            "metadata": {"original_filename": filename, "pipeline": True},
            "text_preview": text[:500],
        })

    return {
        "ok": True,
        "filename": filename,
        "doc_type": analysis.get("doc_type", "unknown"),
        "summary": analysis.get("summary", ""),
        "stored": stored,
        "law_points": analysis.get("law_points", []),
        "cases": analysis.get("cases", []),
        "acts": analysis.get("acts", []),
        "raw_text_preview": analysis.get("raw_text_preview", text[:300]),
        "message": f"Pipeline complete — {stored['law_points']} law points, {stored['cases']} cases, {stored['acts']} acts stored in MongoDB",
    }


@router.get("/pipeline/stats")
async def pipeline_stats(admin: str = Depends(require_admin)):
    """Return counts of intelligence data stored via pipeline."""
    db = _get_db()
    if db is None:
        return {"ipc_laws": 0, "past_cases": 0, "admin_acts": 0, "admin_documents": 0}
    try:
        return {
            "ipc_laws": await db["ipc_laws"].count_documents({"source": {"$regex": "Pipeline"}}),
            "past_cases": await db["past_cases"].count_documents({"source": {"$regex": "Pipeline"}}),
            "admin_acts": await db["admin_acts"].count_documents({}),
            "admin_documents": await db["admin_documents"].count_documents({}),
        }
    except Exception as e:
        logger.error(f"Pipeline stats: {e}")
        return {"ipc_laws": 0, "past_cases": 0, "admin_acts": 0, "admin_documents": 0}
