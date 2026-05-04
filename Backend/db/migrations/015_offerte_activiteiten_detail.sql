-- ======================================================
-- Migratie 015: activiteiten_detail kolom voor Offerte Calculator
-- TenderZen — 2026-04-30
-- Slaat aangepaste uren_indicatie en multiple_override per rij op.
-- ======================================================

ALTER TABLE public.offerte_calculaties
    ADD COLUMN IF NOT EXISTS activiteiten_detail JSONB;
