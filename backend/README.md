# Redline — Backend

FastAPI service handling file parsing (PDF/DOCX) and PDF report export.

See the [root README](../README.md) for architecture details.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload PDF/DOCX, returns extracted text + metadata |
| `POST` | `/api/export/pdf` | Generate PDF report from analysis data |
| `GET` | `/api/health` | Health check |

## Testing

```bash
pytest                          # all tests
pytest tests/test_parser.py     # single file
pytest -k test_name             # single test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_ORIGINS` | No | CORS origins (default: `http://localhost:3000,http://localhost:3001`) |
