-- ======================================================
-- Migratie 017: Offerte documenten tabel + looptijd split + AI toelichtingen
-- TenderZen — 2026-05-04
-- ======================================================

-- Documenten die bij een offerte-analyse zijn geüpload
CREATE TABLE IF NOT EXISTS public.offerte_documenten (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    offerte_id       UUID        NOT NULL REFERENCES public.offerte_calculaties(id) ON DELETE CASCADE,
    tenderbureau_id  UUID        NOT NULL,
    original_file_name TEXT      NOT NULL,
    storage_path     TEXT        NOT NULL,
    file_type        TEXT,
    file_size        INTEGER,
    gebruikt_voor_analyse BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.offerte_documenten ENABLE ROW LEVEL SECURITY;

-- Laat gebruikers alleen hun eigen bureau-documenten zien
CREATE POLICY "Offerte documenten bureau toegang" ON public.offerte_documenten
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.user_bureau_access
            WHERE user_id = auth.uid()
        )
    );

-- Extra kolommen op offerte_calculaties
ALTER TABLE public.offerte_calculaties
    ADD COLUMN IF NOT EXISTS basisperiode    NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS verlengopties   NUMERIC(4,1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ai_toelichtingen JSONB;
