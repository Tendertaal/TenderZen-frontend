-- ======================================================
-- Migratie 012: Tendersignalering status uitbreiding
-- TenderZen — 2026-04-24
-- Breidt de CHECK constraint op tendersignalering_matches.status uit
-- met nieuwe statuswaarden voor de match-workflow.
-- ======================================================

-- Verwijder de oude CHECK constraint (naam uit migratie 009)
ALTER TABLE public.tendersignalering_matches
    DROP CONSTRAINT IF EXISTS tendersignalering_matches_status_check;

-- Voeg nieuwe CHECK constraint toe met uitgebreide statuslijst
ALTER TABLE public.tendersignalering_matches
    ADD CONSTRAINT tendersignalering_matches_status_check
    CHECK (status IN (
        'nieuw',
        'bekeken',
        'opgeslagen',
        'afgewezen',
        'benaderd',
        'geinteresseerd',
        'offerte',
        'niet_relevant'
    ));
