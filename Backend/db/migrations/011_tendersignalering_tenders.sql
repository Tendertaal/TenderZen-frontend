-- ======================================================
-- Migratie 011: Tendersignalering tenders archief
-- TenderZen — 2026-04-23
-- ======================================================

CREATE TABLE IF NOT EXISTS public.tendersignalering_tenders (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenderbureau_id        UUID        NOT NULL REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    tender_titel           TEXT        NOT NULL,
    aanbestedende_dienst   TEXT,
    deadline               DATE,
    procedure              TEXT,
    waarde_min             NUMERIC(15,2),
    waarde_max             NUMERIC(15,2),
    tenderned_url          TEXT,
    aanbesteding_tekst     TEXT,
    matches_count          INTEGER     NOT NULL DEFAULT 0,
    ingevoerd_door         UUID        REFERENCES public.users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tendersignalering_tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.tendersignalering_tenders
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.user_bureau_access WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND (u.role = 'super_admin')
        )
    );

CREATE TRIGGER update_ts_tenders_updated_at
    BEFORE UPDATE ON public.tendersignalering_tenders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_ts_tenders_bureau ON public.tendersignalering_tenders (tenderbureau_id, created_at DESC);

-- Koppel tendersignalering_matches aan tendersignalering_tenders
ALTER TABLE public.tendersignalering_matches
    ADD COLUMN IF NOT EXISTS ts_tender_id UUID REFERENCES public.tendersignalering_tenders(id) ON DELETE SET NULL;
