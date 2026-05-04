-- ======================================================
-- Migratie 014: Offerte Calculator
-- TenderZen — 2026-04-24
-- Nieuwe tabel voor offerte-berekeningen (uren + factuur)
-- gekoppeld aan tender en bureau.
-- ======================================================

CREATE TABLE IF NOT EXISTS public.offerte_calculaties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    tender_id UUID REFERENCES public.tenders(id) ON DELETE SET NULL,

    -- Projectgegevens
    inschrijvende_partij TEXT,
    aanbestedende_dienst TEXT,
    aanbesteding TEXT,
    type_aanbesteding TEXT,
    deadline DATE,
    kwaliteit_weging INTEGER DEFAULT 60,
    prijs_weging INTEGER DEFAULT 40,

    -- Opdrachtwaarde info
    type_opdracht TEXT,
    looptijd_jaar INTEGER,
    waarde NUMERIC,

    -- Variabelen
    percelen INTEGER DEFAULT 1,
    sub_criteria INTEGER DEFAULT 0,
    paginas INTEGER DEFAULT 0,
    bijlagen INTEGER DEFAULT 0,
    vragen_nvi INTEGER DEFAULT 0,
    bijlagen_redigeren INTEGER DEFAULT 0,
    presentatie BOOLEAN DEFAULT FALSE,
    bekende_klant_pct INTEGER DEFAULT 0,
    zittende_partij_pct INTEGER DEFAULT 0,

    -- Berekende uren
    uren_berekend NUMERIC,
    uren_in_mindering NUMERIC DEFAULT 0,
    uren_netto NUMERIC,
    uurtarief INTEGER DEFAULT 130,
    bedrag_berekend NUMERIC,

    -- Factuurbedragen (handmatig ingevoerd)
    factuur_tenderschrijven NUMERIC DEFAULT 0,
    factuur_tendermanagement NUMERIC DEFAULT 0,
    factuur_tendercdocumenten NUMERIC DEFAULT 0,
    factuur_grafisch_ontwerp NUMERIC DEFAULT 0,
    factuur_totaal NUMERIC,

    -- Commissie
    commissie_naam TEXT DEFAULT 'Rick',
    commissie_pct INTEGER DEFAULT 10,
    commissie_bedrag NUMERIC,
    netto_tendertaal NUMERIC,

    -- AI
    ai_geanalyseerd BOOLEAN DEFAULT FALSE,
    ai_analyse_json JSONB,

    -- Status
    status TEXT DEFAULT 'concept' CHECK (status IN ('concept','verzonden','geaccepteerd','afgewezen')),
    notities TEXT,

    -- Meta
    aangemaakt_door UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.offerte_calculaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.offerte_calculaties
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_offerte_bureau
    ON public.offerte_calculaties(tenderbureau_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offerte_tender
    ON public.offerte_calculaties(tender_id);

CREATE TRIGGER update_offerte_calculaties_updated_at
    BEFORE UPDATE ON public.offerte_calculaties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
