-- 005_embeddings_dim_and_index.sql
-- SP-10 Arc 1 Phase 1 — repurpose clause_embeddings for Mistral embeddings (1024 dim)
-- and add an HNSW cosine-distance index for ANN recall + a model_version column
-- so future embedding-model swaps remain backwards-addressable.
--
-- Migration strategy: DROP + CREATE. The 1536-dim column from
-- 001_initial_schema.sql was provisioned for OpenAI but never populated in this
-- codebase (chat uses keyword overlap today). User confirmed the table is empty
-- and data loss is acceptable — see SP-10 plan, Phase 1, migration note.

DROP TABLE IF EXISTS clause_embeddings;

CREATE TABLE clause_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    clause_index    INT NOT NULL,
    embedding       VECTOR(1024) NOT NULL,
    model_version   TEXT NOT NULL DEFAULT 'mistral-embed-v1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (analysis_id, clause_index)
);

CREATE INDEX idx_clause_embeddings_analysis_id
    ON clause_embeddings(analysis_id);

-- HNSW index for approximate nearest-neighbour search with cosine distance.
-- m=16, ef_construction=64 are pgvector defaults that balance recall vs. build
-- time for contract-sized corpora (low thousands of vectors per user).
CREATE INDEX idx_clause_embeddings_hnsw
    ON clause_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
