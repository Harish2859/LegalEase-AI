from typing import Any

from ..services.llm_clients import groq_chat, groq_chat_json
from ..services.retrieval import retrieve


def query_analyzer(state: dict[str, Any]) -> dict[str, Any]:
    analysis = groq_chat_json(
        f'Analyze the user\'s legal query: "{state["query"]}"\n'
        "Decide if this is a: GENERAL_QA, RED_FLAG_SCAN, or SUMMARY.\n"
        "Also extract any specific legal categories mentioned.\n"
        'Output JSON: { "intent": "...", "categories": [] }'
    )
    return {"transformedQuery": state["query"], **analysis}


def retriever_node(state: dict[str, Any]) -> dict[str, Any]:
    chunks = retrieve(state["transformedQuery"])
    sources = [
        {
            "section": c.get("sectionTitle"),
            "page": c.get("pageStart"),
            "excerpt": (c.get("content") or "")[:200],
        }
        for c in chunks
    ]
    return {"retrievedChunks": chunks, "sources": sources}


def grade_context(state: dict[str, Any]) -> str:
    if not state["retrievedChunks"]:
        return "rewrite" if state["retryCount"] < 2 else "generate"

    context = "\n".join((c.get("content") or "") for c in state["retrievedChunks"])[:2000]
    grade = groq_chat_json(
        f"User Query: {state['query']}\n"
        f"Retrieved Context: {context}\n"
        'Evaluate if context is enough. Output JSON: { "isRelevant": true/false, "reason": "..." }'
    )
    is_relevant = bool(grade.get("isRelevant", True))
    if not is_relevant and state["retryCount"] < 2:
        return "rewrite"
    return "generate"


def query_rewriter(state: dict[str, Any]) -> dict[str, Any]:
    rewritten = groq_chat(
        f'The previous search for "{state["transformedQuery"]}" failed. '
        f'Original user intent: "{state["query"]}". Generate a more specific legal search query. '
        "Output ONLY the new query string."
    ).strip()
    return {"transformedQuery": rewritten or state["transformedQuery"], "retryCount": state["retryCount"] + 1}


def answer_generator(state: dict[str, Any]) -> dict[str, Any]:
    context = "\n\n---\n\n".join(
        (
            f"[Section: {c.get('sectionTitle') or 'Unknown'}, "
            f"{'Page ' + str(c.get('pageStart')) if c.get('pageStart') is not None else 'page unknown'}]\n"
            f"{c.get('parentContent') or c.get('content') or ''}"
        )
        for c in state["retrievedChunks"]
    )

    answer = groq_chat(
        "ROLE: You are a professional Legal Document Analyst.\n"
        "TASK: Answer the user's question using ONLY the provided context.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"USER QUESTION: {state['query']}\n\n"
        "STRICT RULES:\n"
        "1. If the answer isn't in the context, say you don't know.\n"
        "2. Every claim MUST be followed by [Source: Section Name, Page X].\n"
        "3. Use a professional, objective tone."
    ).strip()

    return {"answer": answer or "I don't know based on the provided context."}


def invoke_graph(initial_state: dict[str, Any]) -> dict[str, Any]:
    state = {
        "query": initial_state["query"],
        "transformedQuery": initial_state.get("transformedQuery", initial_state["query"]),
        "retrievedChunks": initial_state.get("retrievedChunks", []),
        "retryCount": initial_state.get("retryCount", 0),
        "redFlags": initial_state.get("redFlags", []),
        "sources": initial_state.get("sources", []),
        "answer": initial_state.get("answer", ""),
    }

    state.update(query_analyzer(state))

    while True:
        state.update(retriever_node(state))
        decision = grade_context(state)
        if decision == "rewrite" and state["retryCount"] < 2:
            state.update(query_rewriter(state))
            continue
        break

    state.update(answer_generator(state))
    return state
