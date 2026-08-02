import json
from typing import Any
import httpx

from ..config import settings


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
COHERE_EMBED_URL = "https://api.cohere.com/v1/embed"
COHERE_RERANK_URL = "https://api.cohere.com/v1/rerank"


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    response = httpx.post(url, json=payload, headers=headers, timeout=120)
    response.raise_for_status()
    return response.json()


def groq_chat(prompt: str, *, model: str = "llama-3.1-8b-instant", json_mode: bool = False) -> str:
    if not settings.groq_api_key:
        return "{}" if json_mode else ""

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    data = _post_json(
        GROQ_URL,
        payload,
        {
            "Authorization": "Bearer " + settings.groq_api_key,
            "Content-Type": "application/json",
        },
    )
    return data["choices"][0]["message"]["content"]


def groq_chat_json(prompt: str, *, model: str = "llama-3.1-8b-instant") -> dict[str, Any]:
    content = groq_chat(prompt, model=model, json_mode=True)
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {}
    return parsed if isinstance(parsed, dict) else {}


def cohere_embed(text: str) -> list[float]:
    if not settings.cohere_api_key:
        return [0.0] * 1024

    data = _post_json(
        COHERE_EMBED_URL,
        {
            "texts": [text],
            "model": "embed-english-v3.0",
            "input_type": "search_document",
        },
        {
            "Authorization": "Bearer " + settings.cohere_api_key,
            "Content-Type": "application/json",
        },
    )
    return data.get("embeddings", [[0.0] * 1024])[0]


def cohere_rerank(query: str, documents: list[str], top_n: int = 5) -> list[dict[str, Any]]:
    if not settings.cohere_api_key or not documents:
        return [
            {"index": i, "relevance_score": 1.0}
            for i in range(min(top_n, len(documents)))
        ]

    data = _post_json(
        COHERE_RERANK_URL,
        {
            "model": "rerank-english-v3.0",
            "query": query,
            "documents": documents,
            "top_n": top_n,
        },
        {
            "Authorization": "Bearer " + settings.cohere_api_key,
            "Content-Type": "application/json",
        },
    )
    return data.get("results", [])
