-- ======================================================
-- Migratie 008: Bedrijfsprofiel signalering-kolommen
-- TenderZen — 2026-04-23
-- ======================================================

-- Aanvullende profielkolommen voor tendersignalering
ALTER TABLE public.bedrijven
    ADD COLUMN IF NOT EXISTS signalering_actief     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS competentieprofiel     TEXT,
    ADD COLUMN IF NOT EXISTS min_contractwaarde     NUMERIC,
    ADD COLUMN IF NOT EXISTS max_contractwaarde     NUMERIC,
    ADD COLUMN IF NOT EXISTS geografische_focus     TEXT[],
    ADD COLUMN IF NOT EXISTS aanbestedende_diensten TEXT[],
    ADD COLUMN IF NOT EXISTS profiel_kwaliteit      INTEGER DEFAULT 0;

-- Aanvullende kolommen voor referenties (indien nog niet aanwezig via 005)
ALTER TABLE public.bedrijf_referenties
    ADD COLUMN IF NOT EXISTS cpv_codes TEXT[];

-- Index voor snelle zoekactie op signalering-actieve bedrijven
CREATE INDEX IF NOT EXISTS idx_bedrijven_signalering
    ON public.bedrijven (signalering_actief)
    WHERE signalering_actief = TRUE;
