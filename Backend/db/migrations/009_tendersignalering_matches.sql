-- ======================================================
-- Migratie 009: Tendersignalering matches tabel
-- TenderZen — 2026-04-23 (herzien: geen FK naar tenders, denormalized)
-- ======================================================

-- Hoofdtabel voor tender-match resultaten per bedrijf.
-- Tenderinfo wordt denormalized opgeslagen — geen FK naar tenders-tabel.
-- Filtering op bureauniveau via tenderbureau_id-kolom (geen join nodig).
CREATE TABLE IF NOT EXISTS public.tendersignalering_matches (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bedrijf_id           UUID        NOT NULL REFERENCES public.bedrijven(id) ON DELETE CASCADE,
    tenderbureau_id      UUID        NOT NULL,
    -- Tender-informatie (denormalized, geen FK)
    tender_id            TEXT        NOT NULL,          -- interne UUID of externe ID als tekst
    tender_titel         TEXT,
    aanbestedende_dienst TEXT,
    deadline             TIMESTAMPTZ,
    procedure            TEXT,
    waarde_min           NUMERIC,
    waarde_max           NUMERIC,
    cpv_codes            TEXT[],
    regio                TEXT,
    tenderned_url        TEXT,
    -- Matching
    match_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
    score_breakdown      JSONB        NOT NULL DEFAULT '{}',
    status               TEXT         NOT NULL DEFAULT 'nieuw'
                         CHECK (status IN ('nieuw', 'bekeken', 'opgeslagen', 'afgewezen')),
    gevonden_op          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    bijgewerkt_op        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (bedrijf_id, tender_id)
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_tsm_bureau
    ON public.tendersignalering_matches (tenderbureau_id, gevonden_op DESC);

CREATE INDEX IF NOT EXISTS idx_tsm_bedrijf_score
    ON public.tendersignalering_matches (bedrijf_id, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_tsm_status
    ON public.tendersignalering_matches (tenderbureau_id, status);

-- Trigger: bijgewerkt_op automatisch updaten
CREATE OR REPLACE FUNCTION public.tsm_set_bijgewerkt_op()
RETURNS TRIGGER AS $$
BEGIN
    NEW.bijgewerkt_op = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tsm_bijgewerkt_op ON public.tendersignalering_matches;
CREATE TRIGGER trg_tsm_bijgewerkt_op
    BEFORE UPDATE ON public.tendersignalering_matches
    FOR EACH ROW EXECUTE FUNCTION public.tsm_set_bijgewerkt_op();

-- Row Level Security
ALTER TABLE public.tendersignalering_matches ENABLE ROW LEVEL SECURITY;

-- Super-admin: alles
CREATE POLICY tsm_super_admin ON public.tendersignalering_matches
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND (u.role = 'super_admin')
        )
    );

-- Gewone gebruiker: alleen eigen bureau-bedrijven
CREATE POLICY tsm_bureau_toegang ON public.tendersignalering_matches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_bureau_access uba
            WHERE uba.tenderbureau_id = tendersignalering_matches.tenderbureau_id
              AND uba.user_id = auth.uid()
        )
    );
