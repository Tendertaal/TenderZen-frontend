-- ======================================================
-- Migratie 019: ComplianceZen Sprint 1A
-- TenderZen — 2026-05-05
-- 8 tabellen: normen, clausules, activering, controls,
--             control-requirement koppeling, bewijs, log, notificaties
-- ======================================================

-- ── 1. compliance_normen ───────────────────────────────────────────────────
-- Platform-brede normdefinities. Geen RLS — write-only via service key.
CREATE TABLE IF NOT EXISTS public.compliance_normen (
    id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    code                 TEXT        NOT NULL,
    versie               TEXT        NOT NULL,
    naam                 TEXT        NOT NULL,
    naam_kort            TEXT,
    beschrijving         TEXT,
    type                 TEXT        NOT NULL DEFAULT 'certificeerbaar'
                             CHECK (type IN ('certificeerbaar', 'vergelijkbaar')),
    cycle_jaren          INTEGER     NOT NULL DEFAULT 3,
    drempel_score        INTEGER     NOT NULL DEFAULT 60,
    taal                 TEXT        NOT NULL DEFAULT 'nl',
    is_platform_template BOOLEAN     NOT NULL DEFAULT FALSE,
    aangemaakt_door      UUID        REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(code, versie)
);

-- ── 2. compliance_norm_requirements ───────────────────────────────────────
-- Clausules per norm. clausule_code = originele code, nooit aanpassen.
CREATE TABLE IF NOT EXISTS public.compliance_norm_requirements (
    id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    norm_id         UUID    NOT NULL REFERENCES public.compliance_normen(id) ON DELETE CASCADE,
    clausule_code   TEXT    NOT NULL,
    titel           TEXT    NOT NULL,
    beschrijving    TEXT,
    is_vertaling    BOOLEAN DEFAULT FALSE,
    parent_code     TEXT,
    level           INTEGER NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3)),
    gewicht         FLOAT   NOT NULL DEFAULT 1.0,
    is_kritiek      BOOLEAN DEFAULT FALSE,
    volgorde        INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnr_norm_id   ON public.compliance_norm_requirements(norm_id);
CREATE INDEX IF NOT EXISTS idx_cnr_clausule  ON public.compliance_norm_requirements(norm_id, clausule_code);

COMMENT ON COLUMN public.compliance_norm_requirements.clausule_code IS
    'Originele clausule-code exact zoals in de norm. Bijv. 4.1, 8.1.2, 9.2. Nooit aanpassen na aanmaken.';

-- ── 3. compliance_company_norms ───────────────────────────────────────────
-- Norm-activering per bedrijf per bureau.
CREATE TABLE IF NOT EXISTS public.compliance_company_norms (
    id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    tenderbureau_id  UUID    NOT NULL REFERENCES public.tenderbureaus(id),
    bedrijf_id       UUID    NOT NULL REFERENCES public.bedrijven(id),
    norm_id          UUID    NOT NULL REFERENCES public.compliance_normen(id),
    pad              TEXT    NOT NULL DEFAULT 'certificeerbaar'
                         CHECK (pad IN ('certificeerbaar', 'vergelijkbaar')),
    status           TEXT    NOT NULL DEFAULT 'actief'
                         CHECK (status IN ('actief', 'gepauzeerd', 'verlopen', 'ingetrokken')),
    cert_start_datum DATE,
    cert_vervaldatum DATE,
    score            FLOAT   DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    aangemaakt_door  UUID    REFERENCES auth.users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenderbureau_id, bedrijf_id, norm_id)
);

CREATE INDEX IF NOT EXISTS idx_ccn_bureau  ON public.compliance_company_norms(tenderbureau_id);
CREATE INDEX IF NOT EXISTS idx_ccn_bedrijf ON public.compliance_company_norms(bedrijf_id);

ALTER TABLE public.compliance_company_norms ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Bureau ziet eigen company norms"
    ON public.compliance_company_norms FOR ALL
    USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

-- ── 4. compliance_controls ────────────────────────────────────────────────
-- Controls (maatregelen) per bedrijf per norm. Status 0-4.
CREATE TABLE IF NOT EXISTS public.compliance_controls (
    id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    tenderbureau_id  UUID    NOT NULL REFERENCES public.tenderbureaus(id),
    bedrijf_id       UUID    NOT NULL REFERENCES public.bedrijven(id),
    company_norm_id  UUID    NOT NULL REFERENCES public.compliance_company_norms(id) ON DELETE CASCADE,
    norm_id          UUID    NOT NULL REFERENCES public.compliance_normen(id),
    titel            TEXT    NOT NULL,
    beschrijving     TEXT,
    eigenaar_id      UUID    REFERENCES auth.users(id),
    status           INTEGER NOT NULL DEFAULT 0 CHECK (status >= 0 AND status <= 4),
    review_datum     DATE,
    aangemaakt_door  UUID    REFERENCES auth.users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_bureau       ON public.compliance_controls(tenderbureau_id);
CREATE INDEX IF NOT EXISTS idx_cc_bedrijf      ON public.compliance_controls(bedrijf_id);
CREATE INDEX IF NOT EXISTS idx_cc_company_norm ON public.compliance_controls(company_norm_id);
CREATE INDEX IF NOT EXISTS idx_cc_status       ON public.compliance_controls(status);

ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Bureau ziet eigen controls"
    ON public.compliance_controls FOR ALL
    USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

-- ── 5. compliance_control_requirements ───────────────────────────────────
-- Many-to-many: control ↔ clausule (voor cross-mapping).
CREATE TABLE IF NOT EXISTS public.compliance_control_requirements (
    id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    control_id     UUID    NOT NULL REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
    requirement_id UUID    NOT NULL REFERENCES public.compliance_norm_requirements(id) ON DELETE CASCADE,
    is_primair     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(control_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_ccr_control     ON public.compliance_control_requirements(control_id);
CREATE INDEX IF NOT EXISTS idx_ccr_requirement ON public.compliance_control_requirements(requirement_id);

ALTER TABLE public.compliance_control_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Toegang via control"
    ON public.compliance_control_requirements FOR ALL
    USING (
        control_id IN (
            SELECT id FROM public.compliance_controls
            WHERE tenderbureau_id IN (
                SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
            )
        )
    );

-- ── 6. compliance_evidence ────────────────────────────────────────────────
-- Bewijsstukken per control.
CREATE TABLE IF NOT EXISTS public.compliance_evidence (
    id                 UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    control_id         UUID    NOT NULL REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
    tenderbureau_id    UUID    NOT NULL REFERENCES public.tenderbureaus(id),
    bedrijf_id         UUID    NOT NULL REFERENCES public.bedrijven(id),
    type               TEXT,
    bestandsnaam       TEXT    NOT NULL,
    original_file_name TEXT,
    storage_url        TEXT,
    uploader_id        UUID    REFERENCES auth.users(id),
    geldig_tot         DATE,
    versie             INTEGER NOT NULL DEFAULT 1,
    status             TEXT    NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'goedgekeurd', 'teruggestuurd')),
    auditor_opmerking  TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_control   ON public.compliance_evidence(control_id);
CREATE INDEX IF NOT EXISTS idx_ce_bureau    ON public.compliance_evidence(tenderbureau_id);
CREATE INDEX IF NOT EXISTS idx_ce_geldig_tot ON public.compliance_evidence(geldig_tot);

ALTER TABLE public.compliance_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Bureau ziet eigen bewijsstukken"
    ON public.compliance_evidence FOR ALL
    USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

-- ── 7. compliance_activity_log ────────────────────────────────────────────
-- Audit trail van alle statuswijzigingen en goedkeuringen.
CREATE TABLE IF NOT EXISTS public.compliance_activity_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id),
    object_type     TEXT NOT NULL,
    object_id       UUID NOT NULL,
    actie           TEXT NOT NULL,
    oude_waarde     TEXT,
    nieuwe_waarde   TEXT,
    opmerking       TEXT,
    uitgevoerd_door UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_bureau ON public.compliance_activity_log(tenderbureau_id);
CREATE INDEX IF NOT EXISTS idx_cal_object ON public.compliance_activity_log(object_type, object_id);

ALTER TABLE public.compliance_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Bureau ziet eigen activiteitenlog"
    ON public.compliance_activity_log FOR ALL
    USING (
        tenderbureau_id IN (
            SELECT tenderbureau_id FROM public.users WHERE id = auth.uid()
        )
    );

-- ── 8. compliance_notifications ───────────────────────────────────────────
-- Notificaties per gebruiker.
CREATE TABLE IF NOT EXISTS public.compliance_notifications (
    id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    tenderbureau_id     UUID    NOT NULL REFERENCES public.tenderbureaus(id),
    bedrijf_id          UUID    REFERENCES public.bedrijven(id),
    ontvanger_id        UUID    NOT NULL REFERENCES auth.users(id),
    type                TEXT    NOT NULL,
    bericht             TEXT    NOT NULL,
    gelezen             BOOLEAN NOT NULL DEFAULT FALSE,
    trigger_object_type TEXT,
    trigger_object_id   UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cn_ontvanger ON public.compliance_notifications(ontvanger_id, gelezen);
CREATE INDEX IF NOT EXISTS idx_cn_bureau    ON public.compliance_notifications(tenderbureau_id);

ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Gebruiker ziet eigen notificaties"
    ON public.compliance_notifications FOR ALL
    USING (ontvanger_id = auth.uid());
