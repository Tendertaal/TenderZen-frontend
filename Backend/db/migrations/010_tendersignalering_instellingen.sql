-- ======================================================
-- Migratie 010: Tendersignalering instellingen per bureau
-- TenderZen — 2026-04-23
-- ======================================================

CREATE TABLE IF NOT EXISTS public.tendersignalering_instellingen (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenderbureau_id        UUID        NOT NULL UNIQUE REFERENCES public.tenderbureaus(id) ON DELETE CASCADE,
    weging_vakinhoud       INTEGER     NOT NULL DEFAULT 35,
    weging_certificeringen INTEGER     NOT NULL DEFAULT 25,
    weging_regio           INTEGER     NOT NULL DEFAULT 20,
    weging_financieel      INTEGER     NOT NULL DEFAULT 12,
    weging_ervaring        INTEGER     NOT NULL DEFAULT 8,
    drempel_opslaan        INTEGER     NOT NULL DEFAULT 0,
    drempel_hoog           INTEGER     NOT NULL DEFAULT 75,
    drempel_notificatie    INTEGER     NOT NULL DEFAULT 80,
    bijgewerkt_door        UUID        REFERENCES public.users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wegingen_totaal CHECK (
        weging_vakinhoud + weging_certificeringen + weging_regio +
        weging_financieel + weging_ervaring = 100
    )
);

ALTER TABLE public.tendersignalering_instellingen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureau_toegang" ON public.tendersignalering_instellingen
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

CREATE TRIGGER update_ts_instellingen_updated_at
    BEFORE UPDATE ON public.tendersignalering_instellingen
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
