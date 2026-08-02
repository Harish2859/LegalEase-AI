# LegalEase AI Python Backend

This is a FastAPI rewrite of the TypeScript backend, preserving the existing API contract used by the frontend.

## Run locally

```bash
cd /home/runner/work/LegalEase-AI/LegalEase-AI/python_backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Reuse the same env values as backend/.env
export DATABASE_URL="postgresql://postgres:<password>@localhost:5432/legalease_db"
export LLAMA_CLOUD_API_KEY="..."
export GROQ_API_KEY="..."
export COHERE_API_KEY="..."

uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

## Endpoints

- `POST /upload`
- `POST /analyze`
- `GET /documents/:id/red-flags`
- `POST /documents/:id/red-flags/scan`
- `DELETE /documents/:id`
