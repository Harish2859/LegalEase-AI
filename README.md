# ⚖️ LegalEase AI

## 🚀 Quick Start

### 1. Spin up infrastructure
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Fill in API keys
Edit `backend/.env` with the following:
```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/legalease_db
LLAMA_CLOUD_API_KEY=        # cloud.llamaindex.ai
GROQ_API_KEY=               # console.groq.com
COHERE_API_KEY=             # dashboard.cohere.com
```

---

## Week 1 — Document Ingestion Pipeline

### Overview

Week 1 focused on building a high-precision, production-grade **Document Ingestion Pipeline**. Unlike basic RAG systems, LegalEase AI preserves the complex hierarchy of legal contracts and ensures data privacy before any information reaches the LLM.

### Architecture: Five-Stage Pipeline

1. **Fingerprinting & Deduplication**
   - Generates a **SHA-256 hash** of the raw file buffer
   - Aborts early if the document was previously ingested, preventing duplicate processing costs

2. **Layout-Aware Parsing**
   - Powered by **LlamaParse**, converting complex PDFs into structured Markdown
   - Preserves tables, numbered clauses, and section hierarchies that standard PDF readers scramble

3. **PII Redaction**
   - Placeholder wired for **Microsoft Presidio** to detect and redact Names, Addresses, SSNs
   - Redaction runs on the full text *before* any chunk reaches an external LLM

4. **Parent-Child Chunking**
   - **Parent chunks:** Full legal sections split on Markdown headers (`#`, `##`) — stored for LLM context
   - **Child chunks:** 1000-character sliding window (150-char overlap) derived from each parent — indexed for vector search
   - When a child is matched during retrieval, its parent is fetched to give the LLM the full section

5. **Embedding & Clause Classification**
   - **Embeddings:** 1024-dimensional vectors via `cohere embed-english-v3.0` stored in `pgvector`
   - **Classifier:** Zero-shot **Groq (Llama 3.3 70B)** agent labels each child chunk as one of: `Termination`, `Liability`, `IP`, `Payment`, `Confidentiality`, `Governing Law`, `Other`
   - Raw SQL used for the `vector(1024)` column insert since Prisma doesn't natively support pgvector types

### Folder Structure

```
backend/src/services/ingestion/
├── parser.ts      # LlamaParse integration
├── redaction.ts   # SHA-256 fingerprinting & PII redaction stub
├── chunker.ts     # Parent-Child splitting logic
├── embeddings.ts  # Cohere vector generation (1024 dims)
├── classifier.ts  # Groq-powered legal clause categorization
└── index.ts       # Orchestrator & Prisma transaction logic
```

### Week 1 Deliverables

- ✅ End-to-end ingestion: Raw PDF → Redacted Text → Parent-Child Chunks
- ✅ Vectorized database: `pgvector(1024)` columns populated via Cohere
- ✅ Metadata enrichment: Chunks labeled by legal clause category
- ✅ Deduplication: SHA-256 hash unique constraint on `Document` table

---

## Week 2 — Multi-Stage Retrieval Engine (upcoming)

Implementing **Hybrid Search (Vector + BM25)** and **Reranking** to achieve a target Faithfulness score of >0.90.
