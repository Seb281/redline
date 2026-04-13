"""FastAPI application for Redline contract analysis API."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import connect_db, disconnect_db
from app.routers import analyses, auth, export, upload


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
    """Health check endpoint."""
    return {"status": "ok"}
