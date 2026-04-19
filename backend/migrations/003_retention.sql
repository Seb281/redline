-- 003_retention.sql
-- SP-5 — per-analysis retention with pin + extend.
--
-- Adds an explicit expiry to every saved analysis. The daily prune job
-- deletes rows where `pinned = FALSE AND expires_at <= now()`, so a
-- user can always keep an analysis forever by pinning it. `extend`
-- simply rewrites `expires_at` to `now() + RETENTION_DAYS`.
--
-- Existing rows are backfilled to `created_at + 30 days`. Rows older
-- than 30 days will therefore land in the past and be swept on the
-- next prune run — a deliberate, simple policy. Callers wanting a
-- grace window should pin their old analyses before this migration is
-- applied to production.

ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pinned      BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing rows — consistent 30-day policy from their birth.
UPDATE analyses
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Prune query filters on (pinned, expires_at); partial index keeps the
-- sweep fast even as the table grows.
CREATE INDEX IF NOT EXISTS idx_analyses_expires_at
    ON analyses (expires_at)
    WHERE pinned = FALSE;
