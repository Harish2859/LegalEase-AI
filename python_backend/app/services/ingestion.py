import hashlib
import re
import uuid
from pathlib import Path

from pypdf import PdfReader

from ..db import get_conn
from .llm_clients import cohere_embed, groq_chat


def generate_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def redact_pii(text: str) -> str:
    return text


def parse_legal_document(file_path: str) -> list[dict]:
    reader = PdfReader(file_path)
    pages: list[dict] = []
    for idx, page in enumerate(reader.pages, start=1):
        pages.append({"text": page.extract_text() or "", "pageNumber": idx})
    return pages


def create_parent_child_chunks(parsed_pages: list[dict]) -> list[dict]:
    full_text = "\n".join(page["text"] for page in parsed_pages)
    if not full_text.strip():
        return []

    sections = [s for s in re.split(r"\n(?=#+\s)", full_text) if s.strip()]
    if not sections:
        sections = [full_text]

    chunks: list[dict] = []
    child_size, overlap = 1000, 150
    step = child_size - overlap

    for section in sections:
        lines = section.splitlines()
        first_line = lines[0] if lines else ""
        section_title = re.sub(r"^#+\s*", "", first_line).strip() or "Untitled Section"
        parent_id = str(uuid.uuid4())

        chunks.append(
            {
                "id": parent_id,
                "content": section,
                "chunkType": "parent",
                "sectionTitle": section_title,
                "parentId": None,
            }
        )

        for start in range(0, len(section), step):
            chunks.append(
                {
                    "id": str(uuid.uuid4()),
                    "content": section[start : start + child_size],
                    "chunkType": "child",
                    "sectionTitle": section_title,
                    "parentId": parent_id,
                }
            )

    return chunks


def classify_clause(text: str) -> str:
    prompt = (
        "Classify this legal text into one category: Termination, Liability, IP, "
        "Payment, Confidentiality, Governing Law, or Other. Output ONLY the category name.\n\n"
        f"{text[:500]}"
    )
    result = groq_chat(prompt).strip()
    allowed = {
        "Termination",
        "Liability",
        "IP",
        "Payment",
        "Confidentiality",
        "Governing Law",
        "Other",
    }
    return result if result in allowed else "Other"


def ingest_document(file_path: str, file_bytes: bytes, user_id: str) -> dict:
    file_hash = generate_file_hash(file_bytes)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT id, filename FROM "Document" WHERE "sha256Hash" = %s', (file_hash,))
            existing = cur.fetchone()
            if existing:
                return {"document": existing, "chunkCount": 0}

            parsed_pages = parse_legal_document(file_path)
            _ = redact_pii("\n".join(page["text"] for page in parsed_pages))

            document_id = str(uuid.uuid4())
            filename = Path(file_path).name or "contract.pdf"

            cur.execute(
                'INSERT INTO "Document" (id, "userId", filename, "sha256Hash", "pageCount", status, "createdAt") '
                'VALUES (%s, %s, %s, %s, %s, %s, NOW())',
                (document_id, user_id, filename, file_hash, len(parsed_pages), "INGESTING"),
            )

            chunks = create_parent_child_chunks(parsed_pages)
            for chunk in chunks:
                cur.execute(
                    'INSERT INTO "Chunk" (id, "documentId", content, "chunkType", "sectionTitle", "parentChunkId", "createdAt") '
                    'VALUES (%s, %s, %s, %s, %s, %s, NOW())',
                    (
                        chunk["id"],
                        document_id,
                        chunk["content"],
                        chunk["chunkType"],
                        chunk["sectionTitle"],
                        chunk["parentId"],
                    ),
                )

            child_chunks = [c for c in chunks if c["chunkType"] == "child"]
            for chunk in child_chunks:
                embedding = cohere_embed(chunk["content"])
                clause_type = classify_clause(chunk["content"])
                embedding_literal = f"[{','.join(str(float(v)) for v in embedding)}]"
                cur.execute(
                    'UPDATE "Chunk" SET embedding = %s::vector(1024), "clauseType" = %s WHERE id = %s',
                    (embedding_literal, clause_type, chunk["id"]),
                )

            cur.execute('UPDATE "Document" SET status = %s WHERE id = %s', ("READY", document_id))
            conn.commit()

            return {
                "document": {"id": document_id, "filename": filename},
                "chunkCount": len(chunks),
            }
