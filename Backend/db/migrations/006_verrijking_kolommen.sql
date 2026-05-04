-- ======================================================
-- Migratie 006: Website verrijking kolommen
-- TenderZen — 2026-04-20
-- ======================================================

ALTER TABLE public.bedrijven
    ADD COLUMN IF NOT EXISTS ai_omschrijving      TEXT,
    ADD COLUMN IF NOT EXISTS ai_omschrijving_json  JSONB,
    ADD COLUMN IF NOT EXISTS website_status        TEXT DEFAULT 'niet_verrijkt',
    ADD COLUMN IF NOT EXISTS website_verrijkt_op   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bedrijven_website_status
    ON public.bedrijven (website_status);
