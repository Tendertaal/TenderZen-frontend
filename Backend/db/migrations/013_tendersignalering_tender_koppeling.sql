-- ======================================================
-- Migratie 013: Tender koppeling vanuit Tendersignalering
-- TenderZen — 2026-04-24
-- Voegt twee kolommen toe aan tendersignalering_matches:
--   tenderzen_tender_id — FK naar tenders tabel (NULL = nog niet aangemaakt)
--   tender_aangemaakt_op — tijdstip van aanmaken
-- Let op: de bestaande tender_id kolom is TEXT (extern/intern dedup-sleutel)
--         en blijft ongewijzigd.
-- ======================================================

ALTER TABLE public.tendersignalering_matches
    ADD COLUMN IF NOT EXISTS tenderzen_tender_id UUID
        REFERENCES public.tenders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tender_aangemaakt_op TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tsm_tenderzen_tender
    ON public.tendersignalering_matches (tenderzen_tender_id)
    WHERE tenderzen_tender_id IS NOT NULL;
