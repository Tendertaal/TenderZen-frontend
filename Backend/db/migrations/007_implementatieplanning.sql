-- ======================================================
-- Migratie 007: Project Implementatieplanning
-- TenderZen — 2026-04-21
-- ======================================================

-- ── Tabel: implementatie_secties ──────────────────────
CREATE TABLE IF NOT EXISTS public.implementatie_secties (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tender_id       UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    naam            TEXT NOT NULL,
    volgorde        INTEGER NOT NULL DEFAULT 0,
    kleur           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.implementatie_secties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.implementatie_secties
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_impl_secties_tender ON public.implementatie_secties(tender_id);

-- ── Tabel: implementatie_taken ────────────────────────
CREATE TABLE IF NOT EXISTS public.implementatie_taken (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sectie_id       UUID NOT NULL REFERENCES public.implementatie_secties(id) ON DELETE CASCADE,
    tender_id       UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    nummer          TEXT,
    naam            TEXT NOT NULL,
    verantwoordelijke TEXT,
    toelichting     TEXT,
    status          TEXT DEFAULT 'open' CHECK (status IN ('open','in_uitvoering','afgerond')),
    startdatum      DATE,
    einddatum       DATE,
    dagen           INTEGER,
    volgorde        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.implementatie_taken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.implementatie_taken
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_impl_taken_tender  ON public.implementatie_taken(tender_id);
CREATE INDEX IF NOT EXISTS idx_impl_taken_sectie  ON public.implementatie_taken(sectie_id);

-- ── Tabel: implementatie_metadata ────────────────────
CREATE TABLE IF NOT EXISTS public.implementatie_metadata (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tender_id       UUID NOT NULL UNIQUE REFERENCES public.tenders(id) ON DELETE CASCADE,
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    projectnaam     TEXT,
    opdrachtgever   TEXT,
    opdrachtnemer   TEXT,
    planstart       DATE,
    planeinde       DATE,
    notities        TEXT,
    ai_gegenereerd  BOOLEAN DEFAULT FALSE,
    ai_gegenereerd_op TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.implementatie_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.implementatie_metadata
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );
