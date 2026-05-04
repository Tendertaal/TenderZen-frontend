-- ================================================================
-- Migration 002: Tendermatch sessies + kandidaten uitbreidingen
-- Voer uit in Supabase SQL Editor
-- ================================================================

-- ── Tabel: tendermatch_sessies ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tendermatch_sessies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenderbureau_id UUID REFERENCES tenderbureaus(id) ON DELETE CASCADE,
    titel           TEXT NOT NULL,
    aanbesteding_tekst TEXT,
    analyse_json    JSONB,
    status          TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'geconverteerd', 'gesloten')),
    kandidaten_count INTEGER DEFAULT 0,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor bureau-queries (meest gebruikte filter)
CREATE INDEX IF NOT EXISTS idx_tm_sessies_bureau
    ON tendermatch_sessies (tenderbureau_id, created_at DESC);

-- ── Kolommen toevoegen aan tendermatch_kandidaten ─────────────────
-- tender_id: koppeling naar de aangemaakte tender na conversie
ALTER TABLE tendermatch_kandidaten
    ADD COLUMN IF NOT EXISTS tender_id UUID REFERENCES tenders(id);

-- ── RLS policies ──────────────────────────────────────────────────
ALTER TABLE tendermatch_sessies ENABLE ROW LEVEL SECURITY;

-- Lees/schrijf alleen eigen bureau
CREATE POLICY "bureau_toegang_sessies" ON tendermatch_sessies
    FOR ALL USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM users WHERE id = auth.uid()
            UNION
            SELECT bureau_id FROM user_bureau_access WHERE user_id = auth.uid()
        )
    );

-- Super-admin heeft volledige toegang
CREATE POLICY "superadmin_toegang_sessies" ON tendermatch_sessies
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
    );

-- ── Trigger: updated_at automatisch bijwerken ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessies_updated_at
    BEFORE UPDATE ON tendermatch_sessies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
