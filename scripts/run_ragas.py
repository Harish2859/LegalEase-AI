from ragas import evaluate
from ragas.metrics._faithfulness import Faithfulness
from ragas.metrics._answer_relevance import AnswerRelevancy
from ragas.metrics._context_precision import ContextPrecision
from ragas.metrics._context_recall import ContextRecall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.run_config import RunConfig
from langchain_groq import ChatGroq
from langchain_cohere import CohereEmbeddings
from datasets import Dataset
import json
import os
import warnings
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

RESULTS_PATH   = os.path.join(os.path.dirname(__file__), '..', 'backend', 'scripts', 'test_results.json')
GROQ_API_KEY   = os.environ.get('GROQ_API_KEY', '')
COHERE_API_KEY = os.environ.get('COHERE_API_KEY', '')

# 8b-instant: separate daily quota from the 70b model used by the app
EVAL_MODEL = "llama-3.1-8b-instant"

def run_eval():
    if not os.path.exists(RESULTS_PATH):
        print("test_results.json not found.")
        print("Run first: npx ts-node backend/scripts/generate-test-results.ts")
        return

    with open(RESULTS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Use full dataset — 20 rows = 80 LLM calls, well within 100k/day free tier
    limited_data = {k: v[:20] for k, v in data.items()}
    dataset = Dataset.from_dict(limited_data)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        llm = LangchainLLMWrapper(ChatGroq(model=EVAL_MODEL, api_key=GROQ_API_KEY))
        embeddings = LangchainEmbeddingsWrapper(
            CohereEmbeddings(cohere_api_key=COHERE_API_KEY, model="embed-english-v3.0")
        )

    metrics = [
        Faithfulness(llm=llm),
        AnswerRelevancy(llm=llm, embeddings=embeddings, strictness=1),
        ContextPrecision(llm=llm),
        ContextRecall(llm=llm),
    ]

    print(f"Running RAGAS evaluation (model: {EVAL_MODEL}, rows: {len(dataset)})...\n")
    run_config = RunConfig(timeout=120, max_retries=5, max_wait=60)
    results = evaluate(dataset, metrics=metrics, raise_exceptions=False, run_config=run_config, batch_size=1)

    print("\n--- LegalEase AI Performance ---")
    print(results)

    targets = {
        "faithfulness":      0.90,
        "answer_relevancy":  0.85,
        "context_precision": 0.75,
        "context_recall":    0.80,
    }

    # Per-row breakdown
    df = results.to_pandas()
    metric_cols = [m for m in targets if m in df.columns]
    print("\n--- Per-Row Results ---")
    print(f"{'#':<4} {'Question':<52} " + "  ".join(f"{m[:8]:>8}" for m in metric_cols))
    print("-" * (56 + 10 * len(metric_cols)))
    questions = data['question'][:len(df)]
    for i, (_, row) in enumerate(df.iterrows()):
        q = questions[i][:50] + ('…' if len(questions[i]) > 50 else '')
        scores_row = "  ".join(
            f"{'✅' if (v := row.get(m)) is not None and not (v != v) and v >= targets[m] else '❌'} {row.get(m, float('nan')):.2f}"
            for m in metric_cols
        )
        print(f"{i+1:<4} {q:<52} {scores_row}")

    print("\n--- Target Comparison ---")
    scores = df.select_dtypes(include='number').mean().to_dict()
    for metric, target in targets.items():
        score = scores.get(metric, 0)
        status = "✅ PASS" if score >= target else "❌ FAIL"
        print(f"{status}  {metric}: {score:.3f}  (target: >{target})")

    # Save detailed results to JSON
    output_path = os.path.join(os.path.dirname(__file__), 'ragas_results.json')
    df['question'] = questions
    df.to_json(output_path, orient='records', indent=2)
    print(f"\n📄 Detailed results saved to {output_path}")

if __name__ == "__main__":
    run_eval()
