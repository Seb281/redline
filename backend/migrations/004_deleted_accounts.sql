-- 004_deleted_accounts.sql
-- SP-6 — DSAR tooling (GDPR Art 15 / Art 17).
--
-- When a user deletes their account via DELETE /api/account we wipe
-- their row from `users` (cascading to analyses, sessions,
-- magic_links, clause_embeddings) and insert a single anonymised
-- aggregate record here. No email, no user id, no contract data —
-- only counts the operator needs to understand usage churn. Kept so
-- future-me has some record that a delete happened without
-- re-identifying the user.
--
-- Design: purely aggregate. The only columns are coarse counters +
-- a timestamp. Intentionally NOT FK'd to users (the user row is
-- gone). Intentionally no device / IP fingerprint — a true
-- anonymisation stub under Art 4(5) GDPR.

CREATE TABLE IF NOT EXISTS deleted_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    analyses_count      INT NOT NULL DEFAULT 0,
    account_age_days    INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at
    ON deleted_accounts (deleted_at DESC);
