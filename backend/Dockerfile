# syntax=docker/dockerfile:1

# Redline backend — FastAPI + WeasyPrint
# Requires system libs (pango, cairo, gdk-pixbuf, fonts) for PDF export.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependencies for WeasyPrint PDF rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz0b \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for better layer caching.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# Copy application source.
COPY app ./app

# Railway injects $PORT at runtime; default locally to 8001.
ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
