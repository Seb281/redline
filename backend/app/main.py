"""FastAPI application for Redline contract analysis API."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.db import connect_db, disconnect_db
from app.routers import analyses, auth, export, upload
from app.services.ocr import healthcheck as ocr_healthcheck

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Start and stop the database connection pool."""
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(
    title="Redline",
    description="AI contract clause analyzer",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return 429 with human-readable message on rate limit exceeded."""
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded. Try again in {exc.detail}."},
    )


allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload.router)
app.include_router(export.router)
app.include_router(auth.router)
app.include_router(analyses.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint.

    Reports API readiness plus the SP-1.5 OCR subsystem status. ``ocr``
    is ``"ok"`` when tesseract + poppler are both on PATH, otherwise
    ``"unavailable"``. The endpoint still returns HTTP 200 in both
    cases — OCR is a secondary path, not a hard dependency.
    """
    return {
        "status": "ok",
        "ocr": "ok" if ocr_healthcheck() else "unavailable",
    }
