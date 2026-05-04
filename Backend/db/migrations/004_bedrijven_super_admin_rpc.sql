-- ================================================================
-- Migration 004: Bedrijven super-admin RPC + kvk_verrijkt_op kolom
-- Voer uit in Supabase SQL Editor
-- ================================================================

-- ── Stap 1: Kolom kvk_verrijkt_op (indien nog niet aanwezig) ─────
ALTER TABLE public.bedrijven
    ADD COLUMN IF NOT EXISTS kvk_verrijkt_op TIMESTAMPTZ DEFAULT NULL;

-- ── Stap 2: RPC-functie voor super-admin bedrijvenlijst ───────────
-- Haalt alle bedrijven op uit de globale pool met geaggregeerde counts.
-- Ondersteunt zoeken, branche-filter, niet-gekoppeld en niet-verrijkt filters.
-- Window-functie totaal_count geeft het gefilterd totaal terug zonder extra query.

CREATE OR REPLACE FUNCTION get_bedrijven_super_admin(
    zoekterm             TEXT    DEFAULT NULL,
    branche_filter       TEXT    DEFAULT NULL,
    alleen_niet_gekoppeld BOOLEAN DEFAULT FALSE,
    alleen_niet_verrijkt  BOOLEAN DEFAULT FALSE,
    rij_limit            INT     DEFAULT 50,
    rij_offset           INT     DEFAULT 0
)
RETURNS TABLE (
    id                      UUID,
    bedrijfsnaam            TEXT,
    plaats                  TEXT,
    branche                 TEXT,
    kvk_nummer              TEXT,
    kvk_verrijkt_op         TIMESTAMPTZ,
    sbi_codes               TEXT[],
    certificeringen         TEXT[],
    website                 TEXT,
    is_actief               BOOLEAN,
    created_at              TIMESTAMPTZ,
    gekoppelde_bureaus_count BIGINT,
    referenties_count        BIGINT,
    totaal_count             BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        b.id,
        b.bedrijfsnaam,
        b.plaats,
        b.branche,
        b.kvk_nummer,
        b.kvk_verrijkt_op,
        b.sbi_codes,
        b.certificeringen,
        b.website,
        b.is_actief,
        b.created_at,
        COUNT(DISTINCT r.id)::BIGINT   AS gekoppelde_bureaus_count,
        COUNT(DISTINCT ref.id)::BIGINT AS referenties_count,
        COUNT(*) OVER()::BIGINT        AS totaal_count
    FROM bedrijven b
    LEFT JOIN bureau_bedrijf_relaties r   ON r.bedrijf_id = b.id
    LEFT JOIN bedrijf_referenties     ref ON ref.bedrijf_id = b.id
    WHERE
        (zoekterm IS NULL
            OR b.bedrijfsnaam ILIKE '%' || zoekterm || '%'
            OR b.kvk_nummer   ILIKE '%' || zoekterm || '%'
            OR b.plaats       ILIKE '%' || zoekterm || '%')
        AND (branche_filter IS NULL OR b.branche = branche_filter)
        AND (NOT alleen_niet_gekoppeld
             OR NOT EXISTS (
                 SELECT 1 FROM bureau_bedrijf_relaties
                 WHERE bedrijf_id = b.id
             ))
        AND (NOT alleen_niet_verrijkt OR b.kvk_verrijkt_op IS NULL)
    GROUP BY b.id
    ORDER BY b.bedrijfsnaam ASC
    LIMIT  rij_limit
    OFFSET rij_offset;
$$;

-- Sta toe dat de functie door geverifieerde gebruikers wordt aangeroepen
GRANT EXECUTE ON FUNCTION get_bedrijven_super_admin TO authenticated;
