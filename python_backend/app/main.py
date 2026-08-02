import os
import tempfile
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request

from .agents.graph import invoke_graph
from .db import get_conn
from .services.ingestion import ingest_document

load_dotenv()

app = FastAPI(title="LegalEase AI Python Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=r"https?://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address, default_limits=["20/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

RISK_MAP: dict[str, dict[str, str]] = {
    "Termination": {"severity": "critical", "recommendation": "Review termination triggers and required notice periods."},
    "Liability": {"severity": "critical", "recommendation": "Negotiate liability caps and mutual indemnification clauses."},
    "IP": {"severity": "high", "recommendation": "Clarify IP ownership, assignment scope, and work-for-hire terms."},
    "Confidentiality": {"severity": "high", "recommendation": "Verify scope, duration, and permitted disclosure exceptions."},
    "Payment": {"severity": "medium", "recommendation": "Confirm payment schedules, late penalties, and dispute resolution."},
}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/upload")
@limiter.limit("20/minute")
async def upload_contract(request: Request, file: UploadFile = File(...)) -> dict[str, Any]:
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_bytes = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, prefix="legalease_", suffix=f"_{file.filename}") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = ingest_document(tmp_path, file_bytes, "default-user")
        return {
            "documentId": result["document"]["id"],
            "filename": file.filename,
            "chunkCount": result["chunkCount"],
        }
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@app.post("/analyze")
@limiter.limit("20/minute")
async def analyze_contract(request: Request, payload: dict[str, Any]) -> dict[str, Any]:
    query = payload.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    final_state = invoke_graph(
        {
            "query": query,
            "retryCount": 0,
            "retrievedChunks": [],
            "redFlags": [],
        }
    )

    return {
        "answer": final_state.get("answer"),
        "sources": final_state.get("sources", []),
        "retryCount": final_state.get("retryCount", 0),
    }


@app.get("/documents/{document_id}/red-flags")
@limiter.limit("20/minute")
async def get_red_flags(request: Request, document_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            'SELECT id, "documentId", "flagType", severity, explanation, recommendation, "sectionTitle", "pageStart", "createdAt" '
            'FROM "RedFlag" WHERE "documentId" = %s ORDER BY "createdAt" ASC',
            (document_id,),
        )
        return cur.fetchall() or []


@app.post("/documents/{document_id}/red-flags/scan")
@limiter.limit("20/minute")
async def scan_red_flags(request: Request, document_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute('DELETE FROM "RedFlag" WHERE "documentId" = %s', (document_id,))

        cur.execute(
            'SELECT id, "clauseType", "sectionTitle", "pageStart", content '
            'FROM "Chunk" WHERE "documentId" = %s AND "chunkType" = %s AND "clauseType" = ANY(%s)',
            (document_id, "child", list(RISK_MAP.keys())),
        )
        risky_chunks = cur.fetchall() or []

        for chunk in risky_chunks:
            risk = RISK_MAP[chunk["clauseType"]]
            content = chunk["content"] or ""
            explanation = (content[:220].rstrip() + ("…" if len(content) > 220 else ""))
            cur.execute(
                'INSERT INTO "RedFlag" (id, "documentId", "flagType", severity, explanation, recommendation, "sectionTitle", "pageStart", "createdAt") '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())',
                (
                    str(uuid.uuid4()),
                    document_id,
                    chunk["clauseType"],
                    risk["severity"],
                    explanation,
                    risk["recommendation"],
                    chunk["sectionTitle"],
                    chunk["pageStart"],
                ),
            )

        cur.execute(
            'SELECT id, "documentId", "flagType", severity, explanation, recommendation, "sectionTitle", "pageStart", "createdAt" '
            'FROM "RedFlag" WHERE "documentId" = %s ORDER BY "createdAt" ASC',
            (document_id,),
        )
        flags = cur.fetchall() or []
        conn.commit()
        return flags


@app.delete("/documents/{document_id}")
@limiter.limit("20/minute")
async def delete_document(request: Request, document_id: str) -> dict[str, str]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute('DELETE FROM "Document" WHERE id = %s', (document_id,))
        conn.commit()
    return {"deleted": document_id}
