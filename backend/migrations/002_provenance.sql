-- 002_provenance.sql
-- Adds a JSONB column to record per-analysis LLM provenance metadata
-- (provider, model, snapshot, region, reasoning effort per pass,
-- prompt template version, timestamp).
--
-- Required for EU AI Act transparency obligation — every automated
-- analysis must log the model + version used. Also useful for
-- auditability and A/B comparison across provider swaps.
--
-- Spec: docs/superpowers/specs/2026-04-15-sp1-mistral-eu-swap-design.md
--
-- Default '{}'::jsonb so the migration is harmless even if
-- pre-existing rows are present (spec confirms there are none, but
-- the safety is free).

ALTER TABLE analyses
    ADD COLUMN provenance JSONB NOT NULL DEFAULT '{}'::jsonb;
