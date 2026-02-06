/**
 * FaseTransitieRules — Business Rules voor Kanban Fase Transities
 * TenderZen v1.1
 *
 * DOEL-PAD:  Frontend/js/utils/FaseTransitieRules.js
 *
 * CHANGELOG v1.1:
 * - Fase "evaluatie" toegevoegd (label: Afronden)
 * - Business rules voor evaluatie transities
 * - 5 fases: acquisitie → inschrijvingen → ingediend → evaluatie → archief
 *
 * Drie niveaus:
 *   1. VRIJ     — Logische voorwaartse stap, geen melding
 *   2. BEVESTIG — Terugwaarts/ongebruikelijk, "Weet je het zeker?"
 *   3. WAARSCHUW — Er mist iets, maar actie is tóch mogelijk
 *
 * Nooit blokkeren — altijd doorlaten na bevestiging.
 */

// ============================================
// FASE DEFINITIES
// ============================================

const FASE_ORDER = ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'];

const FASE_LABELS = {
    acquisitie: 'Acquisitie',
    inschrijvingen: 'Lopend',
    ingediend: 'Ingediend',
    evaluatie: 'Afronden',
    archief: 'Archief'
};

// ============================================
// TRANSITIE TYPES
// ============================================

const TRANSITIE = {
    VRIJ: 'vrij',           // Geen melding, direct uitvoeren
    BEVESTIG: 'bevestig',   // "Weet je het zeker?" modal
    WAARSCHUW: 'waarschuw'  // Waarschuwing + bevestig modal
};

// ============================================
// REGELS MATRIX
// ============================================

/**
 * Evalueer een fase-transitie en geef het type + eventuele waarschuwingen terug.
 *
 * @param {string} vanFase - Huidige fase (bijv. 'acquisitie')
 * @param {string} naarFase - Nieuwe fase (bijv. 'inschrijvingen')
 * @param {Object} tender - Het tender object met context data
 * @returns {Object} { type, titel, bericht, warnings[], vanLabel, naarLabel }
 */
export function evalueerTransitie(vanFase, naarFase, tender = {}) {
    const vanIndex = FASE_ORDER.indexOf(vanFase);
    const naarIndex = FASE_ORDER.indexOf(naarFase);
    const vanLabel = FASE_LABELS[vanFase] || vanFase;
    const naarLabel = FASE_LABELS[naarFase] || naarFase;

    // Zelfde fase → niets doen
    if (vanFase === naarFase) {
        return { type: null, skip: true };
    }

    const basis = { vanLabel, naarLabel, tenderNaam: tender.naam || 'Onbekende tender' };
    const warnings = [];

    // ─── VOORWAARTSE STAPPEN ───

    // Acquisitie → Lopend
    if (vanFase === 'acquisitie' && naarFase === 'inschrijvingen') {
        // Check: heeft de tender een gekoppeld bedrijf/inschrijver?
        if (!tender.bedrijf_id && !tender.contactpersoon_id) {
            warnings.push('Er is nog geen inschrijver/bedrijf gekoppeld aan deze tender.');
        }
        if (warnings.length > 0) {
            return {
                ...basis,
                type: TRANSITIE.WAARSCHUW,
                titel: 'Verplaatsen naar Lopend',
                bericht: `"${basis.tenderNaam}" verplaatsen van ${vanLabel} naar ${naarLabel}?`,
                warnings
            };
        }
        return { ...basis, type: TRANSITIE.VRIJ };
    }

    // Lopend → Ingediend
    if (vanFase === 'inschrijvingen' && naarFase === 'ingediend') {
        const planning = tender._planningCounts || { done: 0, total: 0 };
        if (planning.total > 0 && planning.done < planning.total) {
            warnings.push(
                `De planning is nog niet afgerond (${planning.done}/${planning.total} taken voltooid).`
            );
        }
        const checklist = tender._checklistCounts || { done: 0, total: 0 };
        if (checklist.total > 0 && checklist.done < checklist.total) {
            warnings.push(
                `De indieningschecklist is nog niet compleet (${checklist.done}/${checklist.total}).`
            );
        }
        if (warnings.length > 0) {
            return {
                ...basis,
                type: TRANSITIE.WAARSCHUW,
                titel: 'Markeren als Ingediend',
                bericht: `"${basis.tenderNaam}" markeren als ingediend?`,
                warnings
            };
        }
        return { ...basis, type: TRANSITIE.VRIJ };
    }

    // Ingediend → Afronden (logische stap)
    if (vanFase === 'ingediend' && naarFase === 'evaluatie') {
        return { ...basis, type: TRANSITIE.VRIJ };
    }

    // Afronden → Archief (logische stap)
    if (vanFase === 'evaluatie' && naarFase === 'archief') {
        return { ...basis, type: TRANSITIE.VRIJ };
    }

    // Ingediend → Archief (slaat Afronden over)
    if (vanFase === 'ingediend' && naarFase === 'archief') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Fase overslaan',
            bericht: `"${basis.tenderNaam}" direct archiveren? Dit slaat de fase "Afronden" over.`,
            warnings: []
        };
    }

    // ─── TERUGWAARTSE STAPPEN ───

    // Afronden → terug naar eerdere fase
    if (vanFase === 'evaluatie' && naarIndex < vanIndex) {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Terug naar ' + naarLabel + '?',
            bericht: `"${basis.tenderNaam}" staat in Afronden. Weet je zeker dat je deze terug wilt zetten naar ${naarLabel}?`,
            warnings: []
        };
    }

    // Ingediend → Lopend
    if (vanFase === 'ingediend' && naarFase === 'inschrijvingen') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Tender heropenen',
            bericht: `"${basis.tenderNaam}" heropenen als Lopend? De tender wordt weer actief.`,
            warnings: []
        };
    }

    // Lopend → Acquisitie
    if (vanFase === 'inschrijvingen' && naarFase === 'acquisitie') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Terug naar Acquisitie',
            bericht: `"${basis.tenderNaam}" terugzetten naar de Acquisitie fase?`,
            warnings: []
        };
    }

    // ─── FASE OVERSLAAN ───

    // Acquisitie → Ingediend (slaat Lopend over)
    if (vanFase === 'acquisitie' && naarFase === 'ingediend') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Fase overslaan',
            bericht: `"${basis.tenderNaam}" direct als Ingediend markeren? Dit slaat de fase "Lopend" over.`,
            warnings: []
        };
    }

    // Acquisitie → Afronden (slaat Lopend + Ingediend over)
    if (vanFase === 'acquisitie' && naarFase === 'evaluatie') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Meerdere fases overslaan',
            bericht: `"${basis.tenderNaam}" direct naar Afronden? Dit slaat "Lopend" en "Ingediend" over.`,
            warnings: []
        };
    }

    // Acquisitie → Archief (slaat alles over)
    if (vanFase === 'acquisitie' && naarFase === 'archief') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Direct archiveren',
            bericht: `"${basis.tenderNaam}" direct archiveren zonder indiening?`,
            warnings: []
        };
    }

    // Lopend → Archief (slaat Ingediend + Afronden over)
    if (vanFase === 'inschrijvingen' && naarFase === 'archief') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Direct archiveren',
            bericht: `"${basis.tenderNaam}" direct archiveren? Dit slaat "Ingediend" en "Afronden" over.`,
            warnings: []
        };
    }

    // Lopend → Afronden (slaat Ingediend over)
    if (vanFase === 'inschrijvingen' && naarFase === 'evaluatie') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Fase overslaan',
            bericht: `"${basis.tenderNaam}" direct naar Afronden? Dit slaat "Ingediend" over.`,
            warnings: []
        };
    }

    // ─── VANUIT ARCHIEF ───

    if (vanFase === 'archief') {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Gearchiveerde tender heropenen',
            bericht: `"${basis.tenderNaam}" heropenen en verplaatsen naar ${naarLabel}?`,
            warnings: []
        };
    }

    // ─── OVERIGE TERUGWAARTSE STAPPEN ───

    if (naarIndex < vanIndex) {
        return {
            ...basis,
            type: TRANSITIE.BEVESTIG,
            titel: 'Fase terugzetten',
            bericht: `"${basis.tenderNaam}" terugzetten van ${vanLabel} naar ${naarLabel}?`,
            warnings: []
        };
    }

    // ─── FALLBACK: voorwaarts zonder specifieke regel ───
    return { ...basis, type: TRANSITIE.VRIJ };
}

// ============================================
// EXPORTS
// ============================================

export { FASE_ORDER, FASE_LABELS, TRANSITIE };