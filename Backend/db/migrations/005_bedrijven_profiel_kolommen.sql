-- ======================================================
-- Migratie 005: Bedrijfsprofiel extra kolommen
-- TenderZen — 2026-04-20
-- ======================================================

-- Ontbrekende kolommen in bedrijven
ALTER TABLE public.bedrijven
    ADD COLUMN IF NOT EXISTS adres TEXT,
    ADD COLUMN IF NOT EXISTS contactpersoon TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS omzet_categorie TEXT,
    ADD COLUMN IF NOT EXISTS aantal_werknemers INTEGER,
    ADD COLUMN IF NOT EXISTS cpv_codes TEXT[],
    ADD COLUMN IF NOT EXISTS notities TEXT,
    ADD COLUMN IF NOT EXISTS tender_count INTEGER DEFAULT 0;

-- Ontbrekende kolommen in bedrijf_referenties
ALTER TABLE public.bedrijf_referenties
    ADD COLUMN IF NOT EXISTS gewonnen BOOLEAN DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS waarde NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS opdrachtgever TEXT,
    ADD COLUMN IF NOT EXISTS jaar INTEGER,
    ADD COLUMN IF NOT EXISTS sector TEXT,
    ADD COLUMN IF NOT EXISTS omschrijving TEXT;
