# Redline — Backend

FastAPI service handling file parsing, auth, persistence, and PDF export.

See the [root README](../README.md) for architecture details.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # configure DATABASE_URL, RESEND_API_KEY, etc.
uvicorn app.main:app --reload --port 8001
```

The backend works without a database — auth and persistence features are disabled when `DATABASE_URL` is unset.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload PDF/DOCX, returns extracted text + metadata |
| `POST` | `/api/export/pdf` | Generate PDF report from analysis data |
| `POST` | `/api/auth/login` | Send magic-link email |
| `POST` | `/api/auth/verify` | Verify magic-link token, create session |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/analyses` | Save an analysis |
| `GET` | `/api/analyses` | List saved analyses (owner only) |
| `GET` | `/api/analyses/{id}` | Get a saved analysis (owner only) |
| `DELETE` | `/api/analyses/{id}` | Delete an analysis (owner only) |
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
| `DATABASE_URL` | No | Neon Postgres connection string (disables auth/persistence if unset) |
| `RESEND_API_KEY` | No | Resend API key for magic-link emails |
| `FROM_EMAIL` | No | Sender address for magic-link emails |
| `FRONTEND_URL` | No | Frontend URL for magic-link redirects (default: `http://localhost:3000`) |
| `ALLOWED_ORIGINS` | No | CORS origins (default: `http://localhost:3000,http://localhost:3001`) |
