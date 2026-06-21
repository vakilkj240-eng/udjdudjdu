"""
Legal PDF Ingestion Pipeline for Gavel & Brief
Supports: BNS, BNSS, BSA, Legal Awareness Guides, Landmark Case Summaries

Pipeline:
  Upload PDF → Extract Text → OCR if required → Detect Sections
  → Extract Metadata → Chunk Content → Store in Database
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import os
import uuid
import io
import re
import json
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/api/pipeline", tags=["pipeline"])

# ── Auth (reuse from admin_routes) ─────────────────────────────────────────
from admin_routes import require_admin, _new_id, _now_iso

def _get_supabase():
    return None

def _get_db():
    try:
        import server as srv
        return getattr(srv, "db", None)
    except Exception:
        return None


# ── Job State ───────────────────────────────────────────────────────────────
class JobStatus(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    OCR = "ocr"
    SECTIONING = "sectioning"
    CHUNKING = "chunking"
    SUMMARIZING = "summarizing"
    STORING = "storing"
    DONE = "done"
    FAILED = "failed"


# In-memory job store (survives for process lifetime)
_jobs: Dict[str, Dict] = {}
_queue: asyncio.Queue = asyncio.Queue()
_worker_started = False

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")

# Known legal document types
ACT_PATTERNS = {
    "BNS": ["bharatiya nyaya sanhita", "bns", "sanhita 2023"],
    "BNSS": ["bharatiya nagarik suraksha sanhita", "bnss", "nagarik suraksha"],
    "BSA": ["bharatiya sakshya adhiniyam", "bsa", "sakshya"],
    "IPC": ["indian penal code", "ipc", "penal code"],
    "CrPC": ["code of criminal procedure", "crpc", "criminal procedure"],
    "IEA": ["indian evidence act", "evidence act", "iea"],
    "Legal Awareness Guide": ["legal awareness", "know your rights", "legal guide", "citizen guide"],
    "Landmark Cases": ["landmark case", "supreme court", "high court", "judgment", "judgement"],
}

SECTION_PATTERNS = [
    r"(?:Section|Sec\.?|§)\s*(\d+[A-Z]?(?:\(\d+\))?)\s*[.:\-–—]?\s*(.{0,120})",
    r"(?:Chapter|Ch\.?)\s*([IVXLCDM\d]+)\s*[.:\-–—]?\s*(.{0,120})",
    r"^(\d+\.\d*)\s+([A-Z][^\n]{5,80})",
    r"^\s*(?:Article|Art\.?)\s+(\d+[A-Z]?)\s*[.:\-–—]?\s*(.{0,120})",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _update_job(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)
        _jobs[job_id]["updated_at"] = _now_iso()


def _detect_act_name(text_sample: str, filename: str) -> str:
    combined = (filename + " " + text_sample[:2000]).lower()
    for act, patterns in ACT_PATTERNS.items():
        if any(p in combined for p in patterns):
            return act
    return "Unknown"


def _extract_text_fitz(pdf_bytes: bytes) -> tuple[list[dict], bool]:
    """Extract text page by page using PyMuPDF. Returns (pages, needs_ocr)."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        total_chars = 0
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            pages.append({"page_number": page_num + 1, "text": text, "char_count": len(text)})
            total_chars += len(text)
        # Heuristic: if avg < 50 chars/page, likely scanned → needs OCR
        avg = total_chars / max(len(doc), 1)
        needs_ocr = avg < 50
        return pages, needs_ocr
    except ImportError:
        return [], True
    except Exception as e:
        logger.error(f"fitz extraction failed: {e}")
        return [], True


def _ocr_page(pdf_bytes: bytes, page_number: int) -> str:
    """Try OCR on a specific page using pytesseract if available."""
    try:
        import fitz, pytesseract
        from PIL import Image
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[page_number - 1]
        mat = fitz.Matrix(2, 2)  # 2x scale for better OCR
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return pytesseract.image_to_string(img)
    except Exception as e:
        logger.warning(f"OCR page {page_number} failed: {e}")
        return ""


def _detect_sections(page_text: str, page_number: int) -> List[Dict]:
    """Detect section headings in page text."""
    sections = []
    for pattern in SECTION_PATTERNS:
        for match in re.finditer(pattern, page_text, re.MULTILINE | re.IGNORECASE):
            groups = match.groups()
            section_num = groups[0] if groups else ""
            section_title = groups[1].strip() if len(groups) > 1 else ""
            pos = match.start()
            sections.append({
                "section_number": section_num,
                "section_title": section_title,
                "position": pos,
                "page_number": page_number,
            })
    # Deduplicate overlapping matches
    seen = set()
    unique = []
    for s in sections:
        key = s["section_number"]
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return sorted(unique, key=lambda x: x["position"])


def _chunk_page_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
    """Split text into overlapping word chunks."""
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 30]


async def _summarize_chunk(text: str) -> str:
    """Generate a brief summary of a chunk using OpenAI."""
    if not OPENAI_API_KEY or len(text) < 100:
        # Simple extractive fallback: first 2 sentences
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return " ".join(sentences[:2])[:300]
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a legal document summarizer. Summarize the following legal text in 1-2 concise sentences. Be precise and use legal terminology."},
                {"role": "user", "content": text[:1500]},
            ],
            max_tokens=80,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Summarization failed: {e}")
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return " ".join(sentences[:2])[:300]


async def _process_job(job_id: str, pdf_bytes: bytes, filename: str, act_hint: str):
    """Full pipeline processing for a single PDF job."""
    _update_job(job_id, status=JobStatus.EXTRACTING, progress=5,
                message="Extracting text from PDF…")
    try:
        # Step 1: Extract text
        pages, needs_ocr = _extract_text_fitz(pdf_bytes)
        total_pages = len(pages)
        _update_job(job_id, total_pages=total_pages, progress=15,
                    message=f"Extracted {total_pages} pages")

        # Step 2: OCR if needed
        if needs_ocr:
            _update_job(job_id, status=JobStatus.OCR, progress=20,
                        message="Low text density detected — applying OCR…")
            ocr_pages = []
            for p in pages:
                ocr_text = _ocr_page(pdf_bytes, p["page_number"])
                ocr_pages.append({**p, "text": ocr_text or p["text"]})
            pages = ocr_pages

        # Step 3: Detect act name
        all_text_sample = " ".join(p["text"][:500] for p in pages[:5])
        act_name = act_hint or _detect_act_name(all_text_sample, filename)
        doc_title = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
        _update_job(job_id, act_name=act_name, progress=30,
                    message=f"Detected: {act_name}")

        # Step 4: Store document record
        _update_job(job_id, status=JobStatus.STORING, progress=35,
                    message="Creating document record…")
        sb = _get_supabase()

        doc_id = _new_id()
        doc_record = {
            "id": doc_id,
            "title": doc_title,
            "source": act_name,
            "file_type": "pdf",
            "file_size": len(pdf_bytes),
            "chunk_count": 0,
            "metadata": {
                "act_name": act_name,
                "total_pages": total_pages,
                "ocr_applied": needs_ocr,
                "original_filename": filename,
            },
            "created_at": _now_iso(),
        }
        if sb:
            try:
                sb.table("gb_documents").insert(doc_record).execute()
            except Exception as e:
                logger.warning(f"Document insert failed: {e}")

        # Step 5: Detect sections, chunk, summarize, store
        _update_job(job_id, status=JobStatus.SECTIONING, progress=40,
                    message="Detecting legal sections and chunking…")

        chunks_created = 0
        chunk_records = []

        for page_idx, page in enumerate(pages):
            text = page["text"].strip()
            if not text:
                continue

            page_num = page["page_number"]
            sections = _detect_sections(text, page_num)
            current_section = sections[0]["section_number"] if sections else ""

            page_chunks = _chunk_page_text(text)
            for chunk_idx, chunk_text in enumerate(page_chunks):
                # Update section context as we move through page
                for sec in sections:
                    if sec["position"] <= chunk_idx * 400:
                        current_section = sec["section_number"]

                chunk_records.append({
                    "chunk_text": chunk_text,
                    "page_number": page_num,
                    "section_number": current_section,
                    "doc_id": doc_id,
                    "doc_title": doc_title,
                    "act_name": act_name,
                })
                chunks_created += 1

            progress = 40 + int((page_idx / total_pages) * 30)
            _update_job(job_id, progress=progress,
                        message=f"Processing page {page_num}/{total_pages}…")

        # Step 6: Summarize chunks (batch to avoid rate limits)
        _update_job(job_id, status=JobStatus.SUMMARIZING, progress=70,
                    message=f"Generating summaries for {len(chunk_records)} chunks…")

        # Summarize only a sample for speed (every 5th chunk), rest get extractive
        for i, cr in enumerate(chunk_records):
            if i % 5 == 0:
                cr["chunk_summary"] = await _summarize_chunk(cr["chunk_text"])
            else:
                sentences = re.split(r'(?<=[.!?])\s+', cr["chunk_text"].strip())
                cr["chunk_summary"] = " ".join(sentences[:2])[:250]

        # Step 7: Batch insert chunks into Supabase
        _update_job(job_id, status=JobStatus.STORING, progress=85,
                    message="Storing chunks in database…")

        BATCH = 50
        if sb:
            for i in range(0, len(chunk_records), BATCH):
                batch = chunk_records[i:i + BATCH]
                rows = [{
                    "id": _new_id(),
                    "document_id": cr["doc_id"],
                    "document_title": cr["doc_title"],
                    "content": cr["chunk_text"],
                    "chunk_index": idx + i,
                    "metadata": {
                        "act_name": cr["act_name"],
                        "page_number": cr["page_number"],
                        "section_number": cr["section_number"],
                        "chunk_summary": cr["chunk_summary"],
                    },
                    "created_at": _now_iso(),
                } for idx, cr in enumerate(batch)]
                try:
                    sb.table("gb_chunks").insert(rows).execute()
                except Exception as e:
                    logger.error(f"Chunk batch {i} insert error: {e}")

            # Update chunk count on document
            try:
                sb.table("gb_documents").update({"chunk_count": chunks_created}) \
                  .eq("id", doc_id).execute()
            except Exception:
                pass

        _update_job(job_id,
                    status=JobStatus.DONE,
                    progress=100,
                    message=f"Done — {chunks_created} chunks from {total_pages} pages",
                    chunks_created=chunks_created,
                    document_id=doc_id,
                    completed_at=_now_iso())

    except Exception as e:
        logger.error(f"Pipeline job {job_id} failed: {e}", exc_info=True)
        _update_job(job_id,
                    status=JobStatus.FAILED,
                    progress=0,
                    message=f"Error: {str(e)[:200]}",
                    error=str(e),
                    failed_at=_now_iso())


async def _queue_worker():
    """Async worker that processes jobs from the queue sequentially."""
    while True:
        try:
            job_id, pdf_bytes, filename, act_hint = await asyncio.wait_for(
                _queue.get(), timeout=30
            )
            await _process_job(job_id, pdf_bytes, filename, act_hint)
            _queue.task_done()
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error(f"Queue worker error: {e}", exc_info=True)


def _ensure_worker():
    """Start the background worker if not running."""
    global _worker_started
    if not _worker_started:
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(_queue_worker())
            _worker_started = True
        except RuntimeError:
            pass


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    act_hint: str = Form(""),
    background_tasks: BackgroundTasks = None,
    admin: str = Depends(require_admin),
):
    """Upload a PDF to the ingestion pipeline. Returns a job_id to track progress."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    pdf_bytes = await file.read()
    if len(pdf_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupt")

    job_id = _new_id()
    _jobs[job_id] = {
        "job_id": job_id,
        "filename": file.filename,
        "file_size": len(pdf_bytes),
        "act_hint": act_hint,
        "status": JobStatus.QUEUED,
        "progress": 0,
        "message": "Queued for processing…",
        "chunks_created": 0,
        "document_id": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    _ensure_worker()
    await _queue.put((job_id, pdf_bytes, file.filename, act_hint))

    return {
        "job_id": job_id,
        "message": "PDF queued for processing",
        "status": JobStatus.QUEUED,
        "filename": file.filename,
    }


@router.get("/jobs")
async def list_jobs(admin: str = Depends(require_admin)):
    """List all pipeline jobs sorted by most recent first."""
    jobs = sorted(_jobs.values(), key=lambda j: j["created_at"], reverse=True)
    return {
        "jobs": jobs,
        "total": len(jobs),
        "queue_size": _queue.qsize(),
    }


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, admin: str = Depends(require_admin)):
    """Get the current status and details of a specific job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, admin: str = Depends(require_admin)):
    """Remove a job from the job list (can only remove completed/failed jobs)."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] in (JobStatus.QUEUED, JobStatus.EXTRACTING, JobStatus.OCR,
                          JobStatus.SECTIONING, JobStatus.CHUNKING,
                          JobStatus.SUMMARIZING, JobStatus.STORING):
        raise HTTPException(status_code=409, detail="Cannot delete a running job")
    del _jobs[job_id]
    return {"ok": True}


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str, admin: str = Depends(require_admin)):
    """Retry a failed job — note: PDF bytes are not retained, so this just resets status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.FAILED:
        raise HTTPException(status_code=409, detail="Only failed jobs can be retried")
    return {"message": "Re-upload the PDF to create a new job", "job_id": job_id}


@router.get("/stats")
async def pipeline_stats(admin: str = Depends(require_admin)):
    """Return pipeline statistics."""
    statuses = {}
    for j in _jobs.values():
        s = j["status"]
        statuses[s] = statuses.get(s, 0) + 1

    total_chunks = sum(j.get("chunks_created", 0) for j in _jobs.values())
    return {
        "total_jobs": len(_jobs),
        "queue_size": _queue.qsize(),
        "by_status": statuses,
        "total_chunks_created": total_chunks,
    }
