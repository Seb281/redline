"""FastAPI application for Redline contract analysis API."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import export, upload

app = FastAPI(
    title="Redline",
    description="AI contract clause analyzer",
    version="0.1.0",
)

allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload.router)
app.include_router(export.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
