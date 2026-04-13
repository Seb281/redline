-- 001_initial_schema.sql
-- Run against Neon Postgres to initialize Redline schema.
-- Requires pgvector extension (enabled in Neon dashboard).

CREATE EXTENSION IF NOT EXISTS vector;

-- Users who opted into persistence via magic link auth
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

-- One-time magic link tokens (stored hashed)
CREATE TABLE magic_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

-- Session tokens for authenticated requests (stored hashed)
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved contract analyses
CREATE TABLE analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    page_count      INT,
    char_count      INT,
    contract_text   TEXT NOT NULL,
    overview        JSONB NOT NULL,
    summary         JSONB NOT NULL,
    clauses         JSONB NOT NULL,
    analysis_mode   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

-- Vector embeddings for RAG chat (Stage 3)
CREATE TABLE clause_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    clause_index    INT NOT NULL,
    embedding       VECTOR(1536) NOT NULL
);

-- Indexes
CREATE INDEX idx_magic_links_token_hash ON magic_links(token_hash);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX idx_clause_embeddings_analysis_id ON clause_embeddings(analysis_id);
