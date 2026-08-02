from typing import Any

from ..db import get_conn
from .llm_clients import cohere_embed, cohere_rerank, groq_chat_json

K_CONSTANT = 60


def expand_query(user_query: str) -> dict[str, Any]:
    payload = groq_chat_json(
        f'You are a legal research assistant. The user asked: "{user_query}"\n'
        '1. Generate a hypothetical, highly formal legal paragraph that would answer this.\n'
        '2. List 3 specific legal keywords or phrases related to this query.\n'
        'Output in JSON: { "hypothesis": "...", "keywords": ["...", "...", "..."] }'
    )
    hypothesis = payload.get("hypothesis") or user_query
    keywords = payload.get("keywords") if isinstance(payload.get("keywords"), list) else []
    if not keywords:
        keywords = user_query.split()[:3]
    return {"hypothesis": str(hypothesis), "keywords": [str(k) for k in keywords]}


def hybrid_search(query_text: str, query_embedding: list[float], top_k: int = 50) -> list[dict[str, Any]]:
    embedding_literal = f"[{','.join(str(float(v)) for v in query_embedding)}]"

    sql = f'''
    WITH vector_search AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) AS rank
      FROM "Chunk"
      WHERE "chunkType" = 'child'
      LIMIT 50
    ),
    keyword_search AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', %s)) DESC) AS rank
      FROM "Chunk"
      WHERE content_tsv @@ plainto_tsquery('english', %s)
      LIMIT 50
    )
    SELECT
      c.id,
      c.content,
      c."chunkType",
      c."sectionTitle",
      c."clauseType",
      c."parentChunkId",
      c."documentId",
      c."pageStart",
      COALESCE(1.0 / ({K_CONSTANT} + v.rank), 0.0) +
      COALESCE(1.0 / ({K_CONSTANT} + k.rank), 0.0) AS rrf_score
    FROM "Chunk" c
    LEFT JOIN vector_search v ON c.id = v.id
    LEFT JOIN keyword_search k ON c.id = k.id
    WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT {int(top_k)}
    '''

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (embedding_literal, query_text, query_text))
        return cur.fetchall() or []


def rerank_chunks(query: str, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not chunks:
        return []

    results = cohere_rerank(query, [c["content"] for c in chunks], top_n=5)
    selected: list[dict[str, Any]] = []

    for result in results:
        score = result.get("relevance_score", result.get("relevanceScore", 0.0))
        if score <= 0.3:
            continue
        index = int(result["index"])
        selected.append({**chunks[index], "rerankScore": score})

    return selected


def retrieve(query: str) -> list[dict[str, Any]]:
    expanded = expand_query(query)
    query_embedding = cohere_embed(expanded["hypothesis"])
    candidates = hybrid_search(" ".join(expanded["keywords"]), query_embedding, top_k=50)
    reranked = rerank_chunks(query, candidates)
    if not reranked:
        return []

    parent_ids = list({c.get("parentChunkId") for c in reranked if c.get("parentChunkId")})
    parent_map: dict[str, dict[str, Any]] = {}

    if parent_ids:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT id, content, "sectionTitle" FROM "Chunk" WHERE id = ANY(%s)',
                (parent_ids,),
            )
            for row in cur.fetchall() or []:
                parent_map[row["id"]] = row

    enriched: list[dict[str, Any]] = []
    for chunk in reranked:
        parent = parent_map.get(chunk.get("parentChunkId"))
        enriched.append(
            {
                **chunk,
                "parentContent": parent.get("content") if parent else None,
                "parentSectionTitle": parent.get("sectionTitle") if parent else None,
            }
        )
    return enriched
