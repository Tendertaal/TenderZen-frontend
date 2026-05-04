-- ================================================================
-- Migration 003: Tendermatch kandidaat status — dynamisch via fase_statussen
-- Voer uit in Supabase SQL Editor
-- ================================================================

-- ── Stap 1: Verwijder de hardcoded CHECK constraint ───────────────
-- De fase_statussen tabel is voortaan de enige bron van waarheid.
ALTER TABLE public.tendermatch_kandidaten
    DROP CONSTRAINT IF EXISTS tendermatch_kandidaten_status_check;

-- ── Stap 2: Migreer bestaande waarden naar acquisitie status_keys ──
-- 'nieuw', 'benaderd', 'geinteresseerd', 'offerte' → eerste
-- acquisitie status (zoeken_bedrijf) of meest logische mapping.
UPDATE public.tendermatch_kandidaten
    SET status = 'zoeken_bedrijf'
    WHERE status IN ('nieuw', 'benaderd', 'geinteresseerd', 'offerte');

-- 'afgewezen' blijft 'afgewezen' — die waarde voegt de backend zelf toe.
-- Geen aanpassing nodig voor afgewezen.

-- ── Stap 3: Kolom tender_naam_snapshot toevoegen ──────────────────
-- Slaat de naam op van de aangemaakte tender, zodat we "Tender verwijderd: X"
-- kunnen tonen als de tender later verwijderd is (tender_id = NULL maar snapshot gevuld).
ALTER TABLE public.tendermatch_kandidaten
    ADD COLUMN IF NOT EXISTS tender_naam_snapshot TEXT;

-- ── Stap 4: Uitgebreide matching kolommen ─────────────────────────
-- Score breakdown per criterium (sector, regio, certificeringen, referenties)
ALTER TABLE public.tendermatch_kandidaten
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- Uitgebreide matchingsredenering van Claude (2-3 zinnen)
ALTER TABLE public.tendermatch_kandidaten
    ADD COLUMN IF NOT EXISTS matchingsadvies TEXT;

-- Aanbevolen vlag: score >= 6 EN sector score >= 2
ALTER TABLE public.tendermatch_kandidaten
    ADD COLUMN IF NOT EXISTS aanbevolen BOOLEAN DEFAULT FALSE;
