from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_groq import ChatGroq
from langchain_cohere import CohereEmbeddings
from datasets import Dataset
import json
import os

RESULTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'scripts', 'test_results.json')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
COHERE_API_KEY = os.environ.get('COHERE_API_KEY', '')

def run_eval():
    if not os.path.exists(RESULTS_PATH):
        print("test_results.json not found.")
        print("Run first: npx ts-node backend/scripts/generate-test-results.ts")
        return

    with open(RESULTS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Limit to first 5 rows to stay within Groq free tier token budget
    # Re-run with full dataset after upgrading to Dev Tier
    limited_data = {k: v[:5] for k, v in data.items()}
    dataset = Dataset.from_dict(limited_data)

    llm = LangchainLLMWrapper(ChatGroq(model="llama-3.3-70b-versatile", api_key=GROQ_API_KEY, n=1))
    embeddings = LangchainEmbeddingsWrapper(CohereEmbeddings(cohere_api_key=COHERE_API_KEY, model="embed-english-v3.0"))

    metrics = [faithfulness, answer_relevancy, context_precision, context_recall]
    for m in metrics:
        m.llm = llm
    answer_relevancy.embeddings = embeddings

    print("Running RAGAS evaluation...\n")
    results = evaluate(dataset, metrics=metrics)

    print("\n--- LegalEase AI Performance ---")
    print(results)

    targets = {
        "faithfulness":      0.90,
        "answer_relevancy":  0.85,
        "context_precision": 0.75,
        "context_recall":    0.80,
    }

    print("\n--- Target Comparison ---")
    scores = results.to_pandas().select_dtypes(include='number').mean().to_dict()
    for metric, target in targets.items():
        score = scores.get(metric, 0)
        status = "PASS" if score >= target else "FAIL"
        print(f"{status}  {metric}: {score:.3f} (target: >{target})")

if __name__ == "__main__":
    run_eval()
