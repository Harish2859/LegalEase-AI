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

## Week 2 — Multi-Stage Retrieval Engine

### Overview

Week 2 built a four-stage retrieval pipeline that goes far beyond simple vector search. Each stage filters and enriches results to ensure the LLM only receives the most legally relevant context.

### Architecture: Four-Stage Retrieval Pipeline

1. **HyDE + Query Expansion**
   - **Groq (Llama 3.3 70B)** generates a hypothetical legal paragraph answering the user's query
   - Also extracts 3 specific legal keywords for keyword search
   - Embedding the *hypothesis* instead of the raw question bridges the vocabulary gap between user language and legal jargon

2. **Hybrid Search with Reciprocal Rank Fusion (RRF)**
   - **Vector search:** Cosine similarity using the hypothesis embedding against `pgvector`
   - **Keyword search:** PostgreSQL full-text search (`tsvector` + GIN index) using expanded keywords
   - Results fused using RRF formula: `1/(k + rank_vector) + 1/(k + rank_keyword)` where `k=60`
   - Entire fusion runs inside PostgreSQL for maximum performance

3. **Cohere Reranker Quality Gate**
   - Top 50 RRF candidates passed to `cohere rerank-english-v3.0` cross-encoder
   - Filters to top 5 chunks with relevance score > 0.3
   - Prevents semantically similar but legally irrelevant chunks from reaching the LLM

4. **Parent Context Fetch**
   - Each reranked child chunk's `parentChunkId` is used to fetch the full legal section
   - LLM receives complete article/section context, not just the matched fragment

### Folder Structure

```
backend/src/services/retrieval/
├── hybrid_search.ts   # RRF fusion query (vector + BM25 in PostgreSQL)
├── reranker.ts        # Cohere cross-encoder quality gate
├── expansion.ts       # HyDE hypothesis + keyword expansion via Groq
└── retriever.ts       # Main orchestrator: expansion → search → rerank → fetch

scripts/
├── run_ragas.py                          # RAGAS evaluation suite
└── backend/scripts/generate-test-results.ts  # Pipeline test data generator
```

### Database Migrations

- `vector(1024)` column on `Chunk` table via raw SQL (Prisma doesn't support pgvector natively)
- `content_tsv tsvector` generated column with GIN index for full-text search

### RAGAS Evaluation Targets

| Metric | Target | Status |
|---|---|---|
| Faithfulness | > 0.90 | ✅ 1.000 |
| Answer Relevancy | > 0.85 | Pending full dataset |
| Context Precision | > 0.75 | Pending full dataset |
| Context Recall | > 0.80 | Pending full dataset |

> Note: Answer Relevancy, Context Precision and Context Recall require a fully populated test dataset (rate-limited on Groq free tier). Re-run after token reset: `npx ts-node backend/scripts/generate-test-results.ts && python scripts/run_ragas.py`

### Week 2 Deliverables

- ✅ Hybrid search: Vector + BM25 fused via RRF inside PostgreSQL
- ✅ HyDE query expansion: Hypothesis embedding + keyword extraction via Groq
- ✅ Reranker quality gate: Cohere cross-encoder with 0.3 relevance threshold
- ✅ Parent context fetch: Full legal sections returned for matched child chunks
- ✅ RAGAS evaluation suite: Faithfulness, Answer Relevancy, Context Precision, Context Recall

---

## Week 3 — Agentic Generation Layer

### Overview

Week 3 transformed the linear pipeline into a **stateful, self-correcting LangGraph agent**. Instead of blindly passing context to an LLM, the system now evaluates its own retrieved data, rewrites failed queries, and generates citation-grounded answers.

### Architecture: LangGraph State Machine

```
START → analyze → retrieve → gradeContext()
                               ├── "generate" → answerGenerator → END
                               └── "rewrite"  → queryRewriter → retrieve (max 2 retries)
```

1. **Query Analyzer**
   - Classifies intent as `GENERAL_QA`, `RED_FLAG_SCAN`, or `SUMMARY`
   - Extracts legal categories mentioned (Termination, IP, Liability, etc.)

2. **Retriever Node**
   - Wraps the full Week 2 pipeline: HyDE → Hybrid Search → Rerank → Parent Fetch

3. **Context Grader (Router)**
   - Evaluates whether retrieved chunks are sufficient to answer the query
   - Routes to `generate` if relevant, or `rewrite` if not (up to 2 retries)

4. **Query Rewriter**
   - Analyzes why the search failed and generates a better query using legal synonyms and jargon
   - Increments `retryCount` to prevent infinite loops

5. **Answer Generator**
   - Strict legal analyst persona — answers using ONLY retrieved context
   - Every claim cited with `[Source: Section Name, Page X]` format
   - Returns `"I don't know"` if context is insufficient rather than hallucinating

### API Endpoint

```
POST /analyze
Body: { "query": "string", "documentId": "string" }
Response: { "answer": "string", "sources": [...], "retryCount": number }
```

### Folder Structure

```
backend/src/agents/
├── state.ts           # LangGraph shared state (query, chunks, answer, retryCount, redFlags)
├── graph.ts           # Compiled StateGraph workflow
├── analyzer.ts        # re-export
├── retriever.ts       # re-export
├── grader.ts          # re-export
└── nodes/
    ├── analyzer.ts    # Intent classification via Groq
    ├── retriever.ts   # Week 2 retrieve() wrapper
    ├── grader.ts      # Context relevance router
    ├── rewriter.ts    # Query reformulation on retrieval failure
    └── generator.ts   # Cited answer generation
```

### Week 3 Deliverables

- ✅ LangGraph stateful agent with shared state across all nodes
- ✅ Intent-aware query analyzer: GENERAL_QA / RED_FLAG_SCAN / SUMMARY
- ✅ Self-correcting retry loop: rewrite → retrieve → grade (max 2 retries)
- ✅ Citation-grounded answer generation with strict hallucination prevention
- ✅ POST /analyze API endpoint verified end-to-end

---

## Week 4 — Frontend & Production Hardening (upcoming)

Building the React frontend with PDF viewer, chat interface, and red flag highlighting.
