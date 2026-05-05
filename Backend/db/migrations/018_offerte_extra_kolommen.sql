-- ======================================================
-- Migratie 018: Offerte Calculator — ontbrekende kolommen
-- TenderZen — 2026-05-04
-- Voegt alle kolommen toe die in de backend OfferteUpdate staan
-- maar nog niet in de tabel bestonden.
-- ======================================================

ALTER TABLE public.offerte_calculaties
    -- Tarieven per component
    ADD COLUMN IF NOT EXISTS tarief_tenderschrijven   NUMERIC DEFAULT 130,
    ADD COLUMN IF NOT EXISTS tarief_tendermanagement  NUMERIC DEFAULT 130,
    ADD COLUMN IF NOT EXISTS tarief_grafisch_per_pagina NUMERIC DEFAULT 75,

    -- Kortingen per component (%)
    ADD COLUMN IF NOT EXISTS korting_tenderschrijven  INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS korting_tendermanagement INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS korting_grafisch         INTEGER DEFAULT 0,

    -- Commissie basis
    ADD COLUMN IF NOT EXISTS commissie_basis TEXT DEFAULT 'schrijven',

    -- Schrijver
    ADD COLUMN IF NOT EXISTS schrijver_type    TEXT DEFAULT 'intern',
    ADD COLUMN IF NOT EXISTS schrijver_user_id UUID,
    ADD COLUMN IF NOT EXISTS schrijver_naam    TEXT,

    -- Manager
    ADD COLUMN IF NOT EXISTS manager_user_id   UUID,
    ADD COLUMN IF NOT EXISTS manager_naam      TEXT,

    -- Grafisch ontwerper
    ADD COLUMN IF NOT EXISTS grafisch_user_id  UUID,
    ADD COLUMN IF NOT EXISTS grafisch_naam     TEXT,

    -- Inhuur
    ADD COLUMN IF NOT EXISTS inhuur_tarief_schrijven NUMERIC DEFAULT 0,

    -- Netto include toggles
    ADD COLUMN IF NOT EXISTS netto_include_schrijven  BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS netto_include_management BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS netto_include_documenten BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS netto_include_grafisch   BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS netto_include_inhuur     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS netto_include_commissie  BOOLEAN DEFAULT TRUE;
