-- ======================================================
-- Migratie 016: waarde_min en waarde_max kolommen voor Offerte Calculator
-- TenderZen — 2026-05-04
-- Vervangt het enkelvoudige 'waarde' veld door een min/max bereik
-- over de gehele looptijd van de opdracht.
-- ======================================================

ALTER TABLE public.offerte_calculaties
    ADD COLUMN IF NOT EXISTS waarde_min NUMERIC,
    ADD COLUMN IF NOT EXISTS waarde_max NUMERIC;
