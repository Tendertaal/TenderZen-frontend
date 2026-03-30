/* ============================================
   TCC_TabTenderplanning.js  —  v3.0  (2026-03-16)

   Definitieve implementatie conform goedgekeurde mockup:
   - Standaard template met vaste fasen (altijd zichtbaar, ook leeg)
   - Fasen: Voorbereiding · NvI 1..N · Indiening · Presentatie · Gunning & Start
   - Per NvI-fase: Vragen indienen + Antwoorden bekend (sub-rijen)
   - Kolommen: checkbox | MIJLPAAL | TOEGEWEZEN AAN | DATUM & TIJD | STATUS | edit
   - Checkboxes identiek aan Projectplanning tab (groen vinkje)
   - Afgevinkte rijen: doorgestreept + gedimd
   - "Eerst volgende" marker
   - Detaillaag per rij: portaal, notitie, locatie (uitklappen op klik)
   - Lege velden: "Datum toevoegen" / "Toewijzen" placeholder
   - AI Planning sectie onderaan (DB milestones)
   - Bewerken knop + potlood per rij
   - NvI ronde toevoegen / Mijlpaal toevoegen
   ============================================ */

// ============================================
// STANDAARD TEMPLATE DEFINITIE
// Altijd aanwezig, ongeacht of er data is
// ============================================

var TP_TEMPLATE = [
    {
        fase:    'voorbereiding',
        label:   'VOORBEREIDING',
        kleur:   '#0284c7',
        items: [
            { key: 'publicatiedatum',  label: 'Publicatie aanbesteding',   isDeadline: false },
            { key: 'schouwdatum',      label: 'Schouw / locatiebezoek',    isDeadline: false, optioneel: true },
        ]
    },
    {
        fase:    'nvi',
        label:   'NOTA VAN INLICHTINGEN',
        kleur:   '#7c3aed',
        isNvi:   true,
        rondes:  1,   // wordt dynamisch uitgebreid op basis van data
        items: [
            { key: 'deadline_vragen',       label: 'Vragen indienen uiterlijk',       isSub: true },
            { key: 'nota_van_inlichtingen', label: 'Antwoorden bekend (NvI gepubliceerd)', isSub: true },
        ]
    },
    {
        fase:    'indiening',
        label:   'INDIENING',
        kleur:   '#dc2626',
        items: [
            { key: 'interne_deadline',   label: 'Interne deadline',                  isDeadline: false },
            { key: 'deadline_indiening', label: 'Deadline indienen inschrijvingen',  isDeadline: true },
            { key: 'alcatraz',           label: 'Alcatraz-moment',                   isDeadline: false, isSub: true },
        ]
    },
    {
        fase:    'presentatie',
        label:   'PRESENTATIE / INTERVIEW',
        kleur:   '#64748b',
        items: [
            { key: 'presentatie', label: 'Presentatie / interview', isDeadline: false },
        ]
    },
    {
        fase:    'gunning',
        label:   'GUNNING & START',
        kleur:   '#16a34a',
        items: [
            { key: 'voorlopige_gunning',  label: 'Bekendmaken voornemen tot gunning', isDeadline: false },
            { key: 'definitieve_gunning', label: 'Definitieve gunning',               isDeadline: false },
            { key: 'start_opdracht',      label: 'Startdatum opdracht',               isDeadline: false },
        ]
    },
];

// DB-veld aliassen (tender tabel → template keys)
var TP_FIELD_ALIASES = {
    publicatiedatum:       ['publicatiedatum', 'datum_publicatie'],
    schouwdatum:           ['schouwdatum'],
    deadline_vragen:       ['deadline_vragen', 'sluitingsdatum_vragen'],
    nota_van_inlichtingen: ['nota_van_inlichtingen', 'datum_nota_inlichtingen'],
    deadline_indiening:    ['deadline_indiening', 'sluitingsdatum'],
    interne_deadline:      ['interne_deadline'],
    alcatraz:              ['alcatraz_moment', 'alcatraz'],
    presentatie:           ['presentatie', 'presentatiedatum'],
    voorlopige_gunning:    ['voorlopige_gunning', 'datum_gunning'],
    definitieve_gunning:   ['definitieve_gunning'],
    start_opdracht:        ['start_opdracht', 'startdatum_opdracht'],
};

// ============================================
// TRANSFORM — Tenderplanning
// ============================================

/**
 * Bouwt een TP_TEMPLATE-compatibele structuur vanuit DB template taken.
 * DB taken hebben: naam, categorie, is_mijlpaal, is_verplicht, volgorde
 * Categorieen: Voorbereiding | Nota van Inlichtingen | Indiening | Beoordeling | Gunning
 */
function _buildTemplateVanDb(dbTaken) {
    // Categorie → fase + kleur mapping
    const FASE_MAP = {
        'Voorbereiding':          { fase: 'voorbereiding', kleur: '#0284c7' },
        'Nota van Inlichtingen':  { fase: 'nvi',           kleur: '#7c3aed', isNvi: true },
        'Indiening':              { fase: 'indiening',     kleur: '#dc2626' },
        'Beoordeling':            { fase: 'presentatie',   kleur: '#64748b' },
        'Gunning':                { fase: 'gunning',       kleur: '#16a34a' },
    };

    // DB veld alias mapping op basis van naam (fuzzy)
    const NAAM_KEY_MAP = [
        [/publicati/i,                    'publicatiedatum'],
        [/schouw|locatie/i,               'schouwdatum'],
        [/vragen.*1|eerste.*vragen/i,     'deadline_vragen_1'],
        [/antwoord.*1|nvi.*1|nvi 1/i,     'nota_van_inlichtingen_1'],
        [/vragen.*2|tweede.*vragen/i,     'deadline_vragen_2'],
        [/antwoord.*2|nvi.*2|nvi 2/i,     'nota_van_inlichtingen_2'],
        [/vragen.*3/i,                    'deadline_vragen_3'],
        [/antwoord.*3|nvi.*3/i,           'nota_van_inlichtingen_3'],
        [/interne.deadline/i,             'interne_deadline'],
        [/deadline.*inschrij|sluitings/i, 'deadline_indiening'],
        [/alcatraz/i,                     'alcatraz'],
        [/presentatie|interview/i,        'presentatie'],
        [/voorlopig.*gunning|voornemen/i, 'voorlopige_gunning'],
        [/definitiev.*gunning/i,          'definitieve_gunning'],
        [/start.*opdracht|startdatum/i,   'start_opdracht'],
        [/einde.*contract/i,              'einde_contract'],
    ];

    function _keyVanNaam(naam) {
        for (const [patroon, key] of NAAM_KEY_MAP) {
            if (patroon.test(naam)) return key;
        }
        // Fallback: slugify de naam
        return naam.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    }

    // Groepeer taken per categorie
    const groepen = {};
    for (const taak of dbTaken) {
        const cat = taak.categorie || 'Voorbereiding';
        if (!groepen[cat]) groepen[cat] = [];
        groepen[cat].push(taak);
    }

    const template = [];
    const catVolgorde = ['Voorbereiding', 'Nota van Inlichtingen', 'Indiening', 'Beoordeling', 'Gunning'];

    for (const cat of catVolgorde) {
        if (!groepen[cat]) continue;
        const faseInfo = FASE_MAP[cat] || { fase: cat.toLowerCase(), kleur: '#64748b' };
        const items = groepen[cat].map(taak => ({
            key:        _keyVanNaam(taak.naam),
            label:      taak.naam,
            isDeadline: taak.naam.toLowerCase().includes('deadline') || taak.is_mijlpaal,
            isSub:      cat === 'Nota van Inlichtingen',
            optioneel:  !taak.is_verplicht,
        }));

        template.push({
            fase:   faseInfo.fase,
            label:  cat.toUpperCase(),
            kleur:  faseInfo.kleur,
            isNvi:  faseInfo.isNvi || false,
            rondes: faseInfo.isNvi ? 2 : undefined,
            items,
        });
    }

    return template.length > 0 ? template : TP_TEMPLATE;
}

function transformTenderplanning(tender, extractedData, smartImportData, milestones = [], planningData = {}, dbTemplateTaken = null) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    function _daysUntil(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        d.setHours(0, 0, 0, 0);
        return Math.round((d - now) / 86400000);
    }

    function _formatDateNL(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function _weekdayNL(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        return ['zo.','ma.','di.','wo.','do.','vr.','za.'][d.getDay()];
    }

    function _timeStr(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        if (d.getHours() === 0 && d.getMinutes() === 0) return '';
        return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) + ' uur';
    }

    function _resolveDate(key) {
        const aliases = TP_FIELD_ALIASES[key] || [key];
        const extracted = extractedData?.planning || {};
        for (const alias of aliases) {
            const val = tender[alias]
                || planningData[alias]
                || extracted[alias]?.value
                || extracted[alias];
            if (val) return val;
        }
        return null;
    }

    // ── MILESTONE MAPPING ────────────────────────────────────────
    // Mapt AI-geëxtraheerde milestones (uit milestones tabel) naar template-sloten
    // op basis van milestone_type EN naam (fuzzy match)

    const MILESTONE_TYPE_MAP = {
        // milestone_type → template key
        'publicatie':           'publicatiedatum',
        'aankondiging':         'publicatiedatum',
        'schouw':               'schouwdatum',
        'locatiebezoek':        'schouwdatum',
        'vragen_ronde_1':       'deadline_vragen_1',
        'nvi_1_deadline':       'deadline_vragen_1',
        'nota_inlichtingen_1':  'nota_van_inlichtingen_1',
        'nvi_1_publicatie':     'nota_van_inlichtingen_1',
        'vragen_ronde_2':       'deadline_vragen_2',
        'nvi_2_deadline':       'deadline_vragen_2',
        'nota_inlichtingen_2':  'nota_van_inlichtingen_2',
        'nvi_2_publicatie':     'nota_van_inlichtingen_2',
        'interne_deadline':     'interne_deadline',
        'sluitingsdatum':       'deadline_indiening',
        'deadline_indiening':   'deadline_indiening',
        'opening_inschrijving': 'deadline_indiening',
        'alcatraz':             'alcatraz',
        'presentatie':          'presentatie',
        'interview':            'presentatie',
        'voorlopige_gunning':   'voorlopige_gunning',
        'definitieve_gunning':  'definitieve_gunning',
        'start_opdracht':       'start_opdracht',
        'startdatum':           'start_opdracht',
    };

    const MILESTONE_NAAM_MAP = [
        // [zoekterm (lowercase), template key]
        ['aankondiging',                      'publicatiedatum'],
        ['publicatie',                        'publicatiedatum'],
        ['schouw',                            'schouwdatum'],
        ['locatiebezoek',                     'schouwdatum'],
        ['indienen vragen eerste',            'deadline_vragen_1'],
        ['vragen indienen.*1',                'deadline_vragen_1'],
        ['nota van inlichtingen 1',           'nota_van_inlichtingen_1'],
        ['nvi 1',                             'nota_van_inlichtingen_1'],
        ['beantwoorden vragen.*1',            'nota_van_inlichtingen_1'],
        ['indienen vragen tweede',            'deadline_vragen_2'],
        ['vragen indienen.*2',                'deadline_vragen_2'],
        ['nota van inlichtingen 2',           'nota_van_inlichtingen_2'],
        ['nvi 2',                             'nota_van_inlichtingen_2'],
        ['beantwoorden vragen.*2',            'nota_van_inlichtingen_2'],
        ['interne deadline',                  'interne_deadline'],
        ['opening inschrijving',              'deadline_indiening'],
        ['sluitingsdatum',                    'deadline_indiening'],
        ['indienen inschrijving',             'deadline_indiening'],
        ['deadline inschrijv',                'deadline_indiening'],
        ['alcatraz',                          'alcatraz'],
        ['presentatie',                       'presentatie'],
        ['interview',                         'presentatie'],
        ['voornemen.*gunning',                'voorlopige_gunning'],
        ['voorlopige gunning',                'voorlopige_gunning'],
        ['definitieve gunning',               'definitieve_gunning'],
        ['gunning definitief',                'definitieve_gunning'],
        ['startdatum',                        'start_opdracht'],
        ['start.*opdracht',                   'start_opdracht'],
        ['start.*contract',                   'start_opdracht'],
    ];

    // Bouw een lookup: template_key → datum (uit milestones)
    const milestoneByKey = {};
    for (const m of milestones) {
        if (!m.datum) continue;
        const dateVal = m.tijd
            ? `${m.datum}T${m.tijd}`
            : `${m.datum}T00:00:00`;

        // 1. Probeer milestone_type direct
        const typeKey = MILESTONE_TYPE_MAP[(m.milestone_type || '').toLowerCase()];
        if (typeKey && !milestoneByKey[typeKey]) {
            milestoneByKey[typeKey] = dateVal;
        }

        // 2. Probeer naam fuzzy match
        const naamLower = (m.naam || '').toLowerCase();
        for (const [patroon, templateKey] of MILESTONE_NAAM_MAP) {
            if (!milestoneByKey[templateKey] && new RegExp(patroon).test(naamLower)) {
                milestoneByKey[templateKey] = dateVal;
                break;
            }
        }
    }

    // Uitgebreide _resolveDate die ook milestone-mapping gebruikt
    function _resolveDateWithMilestones(key) {
        // 1. Directe DB velden (tender tabel + planningData)
        const direct = _resolveDate(key);
        if (direct) return direct;

        // 2. Milestone mapping (exact key)
        if (milestoneByKey[key]) return milestoneByKey[key];

        // 3. Probeer zonder ronde-suffix (ronde 1 kan zonder suffix opgeslagen zijn)
        const baseKey = key.replace(/_1$/, '');
        if (baseKey !== key && milestoneByKey[baseKey]) return milestoneByKey[baseKey];

        return null;
    }

    function _buildItem(key, label, isDeadline, isSub, ronde) {
        const resolvedKey = ronde ? `${key}_${ronde}` : key;
        const dateStr   = _resolveDateWithMilestones(resolvedKey) || _resolveDateWithMilestones(key);
        const daysLeft  = _daysUntil(dateStr);
        const isPast    = dateStr ? (daysLeft < 0) : false;
        const isChecked = !!(planningData[`checked_${key}${ronde ? '_' + ronde : ''}`]);
        const assignee  = planningData[`assignee_${key}${ronde ? '_' + ronde : ''}`] || null;
        const portaal   = planningData[`portaal_${key}${ronde ? '_' + ronde : ''}`] || tender.portaal || null;
        const notities  = planningData[`notitie_${key}${ronde ? '_' + ronde : ''}`] || null;

        return {
            key:        ronde ? `${key}_${ronde}` : key,
            baseKey:    key,
            label,
            isDeadline: !!isDeadline,
            isSub:      !!isSub,
            ronde:      ronde || null,
            dateStr,
            datumLabel: _formatDateNL(dateStr),
            weekday:    _weekdayNL(dateStr),
            time:       _timeStr(dateStr),
            daysLeft,
            isPast,
            isNext:     false,
            isChecked,
            assignee,
            portaal,
            notities,
            heeftDatum: !!dateStr,
        };
    }

    // ── Template: gebruik DB template als beschikbaar, anders hardcoded TP_TEMPLATE ──
    // dbTemplateTaken = array van taken uit planning_template_taken tabel
    // Elke taak heeft: naam, categorie, is_mijlpaal, is_verplicht
    const effectiefTemplate = dbTemplateTaken && dbTemplateTaken.length > 0
        ? _buildTemplateVanDb(dbTemplateTaken)
        : TP_TEMPLATE;

    // Bouw fasen op basis van template
    // Bepaal hoeveel NvI-rondes er zijn (min 2, max op basis van data)
    // Detecteer aantal NvI rondes op basis van data + milestones
    let nviRondes = 2;
    for (let r = 3; r <= 5; r++) {
        if (_resolveDateWithMilestones(`deadline_vragen_${r}`) || _resolveDateWithMilestones(`nota_van_inlichtingen_${r}`)) {
            nviRondes = r;
        }
    }
    const heeftNvi1 = !!(_resolveDateWithMilestones('deadline_vragen') || _resolveDateWithMilestones('nota_van_inlichtingen'));

    const fasen = [];
    let allItems = [];

    for (const faseDef of effectiefTemplate) {
        if (faseDef.isNvi) {
            for (let r = 1; r <= nviRondes; r++) {
                const items = faseDef.items.map(itemDef =>
                    _buildItem(itemDef.key, itemDef.label, false, true, r)
                );
                const ingevuld = items.filter(i => i.heeftDatum).length;
                fasen.push({
                    fase:     `nvi_${r}`,
                    label:    `NOTA VAN INLICHTINGEN ${r}`,
                    kleur:    faseDef.kleur,
                    isNvi:    true,
                    ronde:    r,
                    items,
                    ingevuld,
                    totaal:   items.length,
                });
                allItems = allItems.concat(items);
            }
        } else {
            const items = faseDef.items.map(itemDef =>
                _buildItem(itemDef.key, itemDef.label, itemDef.isDeadline, itemDef.isSub, null)
            );
            const ingevuld = items.filter(i => i.heeftDatum).length;
            fasen.push({
                fase:     faseDef.fase,
                label:    faseDef.label,
                kleur:    faseDef.kleur,
                items,
                ingevuld,
                totaal:   items.length,
            });
            allItems = allItems.concat(items);
        }
    }

    // Sorteer alle items met datum chronologisch voor "eerst volgende" logica
    const metDatum = allItems.filter(i => i.heeftDatum).sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    const firstFuture = metDatum.find(i => !i.isPast && !i.isChecked);
    if (firstFuture) firstFuture.isNext = true;

    // Deadline countdown
    const deadlineItem = allItems.find(i => i.key === 'deadline_indiening' && i.heeftDatum && !i.isPast);
    const countdown    = deadlineItem ? deadlineItem.daysLeft : null;

    // Totaal teller
    const totaalMetDatum   = allItems.filter(i => i.heeftDatum).length;
    const totaalAfgevinkt  = allItems.filter(i => i.isChecked).length;

    // AI milestones (DB)
    const milestoneItems = (milestones || []).map((m, idx) => {
        const dateStr   = m.datum || '';
        const d         = dateStr ? new Date(dateStr) : null;
        const valid     = d && !isNaN(d);
        const daysLeft  = valid ? _daysUntil(dateStr) : null;
        const isPast    = valid ? (daysLeft < 0) : false;
        const naam      = (m.naam || 'Mijlpaal').replace(/\*\*/g, '').trim();
        const isNumeric = /^\d{1,3}$/.test(naam);

        return {
            id:         m.id,
            nr:         idx + 1,
            label:      isNumeric ? (m.notities || m.datum_tekst || `Mijlpaal ${naam}`) : naam,
            notitie:    isNumeric ? '' : (m.notities || ''),
            dateStr,
            datumLabel: valid ? _formatDateNL(dateStr) : (dateStr || '—'),
            weekday:    valid ? _weekdayNL(dateStr) : '',
            time:       valid ? _timeStr(dateStr) : '',
            daysLeft,
            isPast,
            isNext:     false,
            isChecked:  !!(m.afgevinkt),
        };
    });

    milestoneItems.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    const firstFutureMilestone = milestoneItems.find(i => !i.isPast && !i.isChecked);
    if (firstFutureMilestone) firstFutureMilestone.isNext = true;

    const totalBadge = totaalMetDatum + milestoneItems.filter(i => i.dateStr).length;

    return {
        badge:           totalBadge > 0 ? String(totalBadge) : '',
        fasen,
        allItems,
        heeftData:       totaalMetDatum > 0,
        totaalMetDatum,
        totaalAfgevinkt,
        nviRondes,
        milestoneItems,
        heeftMilestones: milestoneItems.length > 0,
        countdown,
        portaal:         tender.portaal || planningData.portaal || null,
    };
}


// ============================================
// RENDER — Tab: Tenderplanning
// ============================================

function renderTabTenderplanning(data) {
    const tp       = data.tenderplanning || {};
    const isActive = tccState.activeTab === 'tenderplanning';

    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="tenderplanning">
        ${_renderTpInhoud(tp)}
    </div>`;
}

function _renderTpInhoud(tp) {
    const state = tccState.tenderplanningState || 'data';
    switch (state) {
        case 'picker':  return _renderTpPicker(tp);
        case 'loading': return _renderTpLoading();
        default:        return _renderTpData(tp);
    }
}

// ── STATE: PICKER ────────────────────────────

function _renderTpPicker(tp) {
    const docs = tccState.data?.documenten || [];

    const docRijen = docs.length > 0
        ? docs.map((doc, idx) => {
            const naam     = doc.original_file_name || doc.file_name || doc.bestandsnaam || 'Document';
            const ext      = naam.split('.').pop().toLowerCase();
            const extLabel = ({ pdf: 'PDF', docx: 'DOCX', doc: 'DOC', xlsx: 'XLSX' })[ext] || ext.toUpperCase();
            const extKleur = ({ pdf: '#dc2626', docx: '#2563eb', doc: '#2563eb', xlsx: '#16a34a' })[ext] || '#64748b';
            // Standaard alle documenten aangevinkt
            return `
            <label class="tcc-tp-doc-row">
                <input type="checkbox" name="tp-doc-select" value="${doc.id}"
                       class="tcc-tp-doc-check-input" checked>
                <div class="tcc-tp-doc-icon" style="color:${extKleur}">
                    ${tccIcon('fileText', 18, extKleur)}
                </div>
                <div class="tcc-tp-doc-info">
                    <div class="tcc-tp-doc-naam">${naam}</div>
                    <div class="tcc-tp-doc-meta">
                        <span class="tcc-tp-doc-ext" style="background:${extKleur}15;color:${extKleur};">
                            ${extLabel}
                        </span>
                    </div>
                </div>
                <div class="tcc-tp-doc-checkmark">
                    ${tccIcon('checkCircle', 16, '#2563eb')}
                </div>
            </label>`;
        }).join('')
        : '';

    const geenDocs = docs.length === 0;

    return `
    <div class="tcc-tp-header">
        <div class="tcc-tp-header-left">
            ${tccIcon('calendar', 16, '#2563eb')}
            <div>
                <div class="tcc-tp-header-title">Documenten selecteren</div>
                <div class="tcc-tp-header-sub">
                    Kies welke documenten de AI moet analyseren voor de planning-extractie
                </div>
            </div>
        </div>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="tp-cancel-picker">
            Annuleren
        </button>
    </div>

    <div class="tcc-tp-picker">
        ${geenDocs ? `
        <div class="tcc-tp-nodocs">
            <div style="margin-bottom:8px;">
                ${tccIcon('fileText', 28, '#cbd5e1')}
            </div>
            <div style="font-size:14px;font-weight:600;color:#475569;margin-bottom:4px;">
                Geen documenten beschikbaar
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">
                Upload eerst aanbestedingsdocumenten voordat je de planning kunt extraheren.
            </div>
            <button class="tcc-btn tcc-btn--secondary tcc-btn--sm" data-action="goto-tab" data-target="docs">
                ${tccIcon('folderOpen', 13)} Ga naar Documenten tab
            </button>
        </div>` : `
        <div class="tcc-tp-picker-docs">
            <div class="tcc-tp-picker-header-row">
                <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
                    ${docs.length} document${docs.length !== 1 ? 'en' : ''} beschikbaar
                </span>
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="goto-tab" data-target="docs"
                        style="font-size:11px;">
                    ${tccIcon('plus', 12)} Document toevoegen
                </button>
            </div>
            ${docRijen}
        </div>

        <div class="tcc-tp-picker-actions">
            <div class="tcc-tp-model-selector">
                <label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
                    AI Model
                </label>
                <div class="tcc-tp-model-opties">
                    <label class="tcc-tp-model-optie">
                        <input type="radio" name="tp-model-select" value="claude-haiku-4-5-20251001" checked>
                        <div class="tcc-tp-model-card">
                            <div class="tcc-tp-model-naam">Haiku</div>
                            <div class="tcc-tp-model-desc">Snel & goedkoop</div>
                        </div>
                    </label>
                    <label class="tcc-tp-model-optie">
                        <input type="radio" name="tp-model-select" value="claude-sonnet-4-6">
                        <div class="tcc-tp-model-card">
                            <div class="tcc-tp-model-naam">Sonnet</div>
                            <div class="tcc-tp-model-desc">Gebalanceerd</div>
                        </div>
                    </label>
                    <label class="tcc-tp-model-optie">
                        <input type="radio" name="tp-model-select" value="claude-opus-4-6">
                        <div class="tcc-tp-model-card">
                            <div class="tcc-tp-model-naam">Opus</div>
                            <div class="tcc-tp-model-desc">Beste kwaliteit</div>
                        </div>
                    </label>
                </div>
            </div>
            <button class="tcc-btn tcc-btn--primary" data-action="tp-extract-start"
                    id="tp-extract-btn">
                ${tccIcon('zap', 14, '#fff')} Extraheer planning
            </button>
        </div>`}
    </div>`;
}

// ── STATE: LOADING ───────────────────────────

function _renderTpLoading() {
    return `
    <div class="tcc-tp-header">
        <div class="tcc-tp-header-left">
            ${tccIcon('calendar', 16, '#2563eb')}
            <div>
                <div class="tcc-tp-header-title">Tenderplanning extraheren…</div>
                <div class="tcc-tp-header-sub">AI analyseert aanbestedingsdocumenten</div>
            </div>
        </div>
    </div>
    <div class="tcc-tp-loading">
        <div class="tcc-tp-loading-spinner"></div>
        <div class="tcc-tp-loading-desc">Even geduld, dit duurt doorgaans 10–30 seconden</div>
    </div>`;
}

// ── STATE: DATA (hoofd-renderer) — identiek aan PP tab ──────

function _renderTpData(tp) {
    const allItems  = tp.allItems || [];
    const mItems    = tp.milestoneItems || [];
    const totaal    = tp.totaalMetDatum || 0;
    const afgevinkt = tp.totaalAfgevinkt || 0;
    const countdown = tp.countdown;

    // Actie-balk — identiek aan PP
    const actieBalk = `
    <div class="tcc-actie-balk tcc-actie-balk--blue">
        <div class="tcc-actie-balk-icon tcc-actie-balk-icon--blue">
            ${tccIcon('calendar', 18, '#2563eb')}
        </div>
        <div class="tcc-actie-balk-info">
            <div class="tcc-actie-balk-title">${totaal} mijlpalen</div>
            <div class="tcc-actie-balk-desc">Standaard template · ${afgevinkt} van ${totaal} afgevinkt</div>
        </div>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="tp-start-picker">
            ${tccIcon('refresh', 13)} Opnieuw
        </button>
    </div>`;

    // Countdown — alleen tonen als relevant
    const countdownHtml = countdown !== null && countdown !== undefined ? `
        <div class="tcc-tp-countdown${countdown <= 7 ? ' tcc-tp-countdown--urgent' : countdown <= 21 ? ' tcc-tp-countdown--soon' : ''}">
            ${tccIcon('clock', 14, countdown <= 7 ? '#dc2626' : countdown <= 21 ? '#d97706' : '#64748b')}
            <span>${countdown} dag${countdown === 1 ? '' : 'en'} tot deadline indiening${tp.portaal ? ' · ' + tp.portaal : ''}</span>
        </div>` : '';

    // Toolbar met progress — identiek aan PP
    const percentage = totaal > 0 ? Math.round((afgevinkt / totaal) * 100) : 0;
    const toolbar = `
    <div class="planning-toolbar" style="padding:10px 0;">
        <div style="margin-left:auto;">
            <div class="planning-progress-inline">
                <div class="planning-progress-track">
                    <div class="planning-progress-fill" style="width:${percentage}%"></div>
                </div>
                <span class="planning-progress-label">${afgevinkt} van ${totaal} afgevinkt</span>
            </div>
        </div>
    </div>`;

    // Kolom headers
    const colHeaders = `
    <div style="display:grid;grid-template-columns:28px 1fr 160px 120px 90px 28px;align-items:center;gap:8px;
                padding:6px 4px;border-bottom:2px solid #e2e8f0;margin:0 -4px 4px -4px;
                font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
        <span></span>
        <span>Mijlpaal</span>
        <span>Toegewezen aan</span>
        <span>Datum & tijd</span>
        <span>Status</span>
        <span></span>
    </div>`;

    // Mijlpalen als taak-rijen
    const rijdenHtml = _renderTpAlleRijen(allItems, mItems);

    return `
    ${actieBalk}
    ${countdownHtml}
    <div class="planning-task-list" style="padding:0 0 20px;">
        ${toolbar}
        ${colHeaders}
        ${rijdenHtml}
    </div>`;
}

// ── ALLE RIJEN RENDERER ───────────────────────

function _renderTpAlleRijen(allItems, mItems) {
    let nextMarkerGezet = false;
    let html = '';

    // Template items
    allItems.forEach(item => {
        if (item.isNext && !nextMarkerGezet) {
            html += `
            <div class="tcc-tp-next-marker">
                <div class="tcc-tp-next-lijn"></div>
                <span class="tcc-tp-next-label">▾ EERST VOLGENDE</span>
                <div class="tcc-tp-next-lijn"></div>
            </div>`;
            nextMarkerGezet = true;
        }
        html += _renderTpTijdlijnRij(item);
    });

    // AI milestones worden via milestone_type gemapt naar template-sloten
    // De aparte AI Planning sectie is verwijderd

    return html;
}

// ── TIJDLIJN RIJ ─────────────────────────────

function _renderTpTijdlijnRij(item) {
    const isVerstreken = item.isPast && !item.isChecked;
    const isDeadline   = item.isDeadline && !item.isPast && !item.isChecked;
    const isNext       = item.isNext && !item.isPast && !item.isChecked;
    const heeftDatum   = item.heeftDatum;

    // State string voor BEM-modifiers
    let state = '';
    if (isVerstreken) state = 'verstreken';
    else if (isDeadline) state = 'deadline';
    else if (isNext) state = 'next';

    // Dot inhoud
    let dotInhoud = '';
    if (isVerstreken) {
        dotInhoud = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (isDeadline || isNext) {
        const kleur = isDeadline ? '#dc2626' : '#2563eb';
        dotInhoud = `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="${kleur}"/></svg>`;
    }

    // Naam
    const naamMod = state ? ` tcc-tp-tl-naam--${state}` : '';

    // Assign
    const assigneeLid = item.assignee
        ? (tccState.data?._bureauTeamMembers || []).find(m => m.naam === item.assignee)
        : null;
    const assignHtml = item.assignee ? `
        <div class="tcc-tp-tl-assign" data-action="tp-assign" data-key="${item.key}"
             style="cursor:pointer;display:flex;align-items:center;gap:6px;" title="${item.assignee} — klik om te wijzigen">
            <span style="width:22px;height:22px;border-radius:50%;
                         background:${assigneeLid?.avatar_kleur || '#667eea'};color:white;
                         font-size:10px;font-weight:700;display:inline-flex;align-items:center;
                         justify-content:center;flex-shrink:0;">
                ${assigneeLid ? (assigneeLid.initialen || assigneeLid.naam.substring(0,2).toUpperCase()) : item.assignee.substring(0,2).toUpperCase()}
            </span>
            <span style="font-size:12px;color:#475569;font-weight:500;">${item.assignee.split(' ')[0]}</span>
        </div>` : `
        <div class="tcc-tp-tl-assign" data-action="tp-assign" data-key="${item.key}"
             style="cursor:pointer;color:#cbd5e1;font-size:12px;display:flex;align-items:center;gap:4px;">
            ${tccIcon('user', 13)} Toewijzen
        </div>`;

    // Datum
    let datumMod = '';
    let datumTekst = '';
    if (!heeftDatum) {
        datumMod = ' tcc-tp-tl-datum--leeg';
        datumTekst = 'Datum toevoegen';
    } else {
        if (isVerstreken) datumMod = ' tcc-tp-tl-datum--verstreken';
        else if (isDeadline) datumMod = ' tcc-tp-tl-datum--deadline';
        else if (isNext) datumMod = ' tcc-tp-tl-datum--next';
        datumTekst = item.datumLabel + (item.time ? ` <span style="font-size:11px;color:#94a3b8;">${item.time}</span>` : '');
    }

    // Badge
    let badgeHtml;
    if (isVerstreken) {
        badgeHtml = `<span class="tcc-tp-tl-badge tcc-tp-tl-badge--verstreken">Verstreken</span>`;
    } else if (isDeadline) {
        badgeHtml = `<span class="tcc-tp-tl-badge tcc-tp-tl-badge--deadline">Deadline</span>`;
    } else if (isNext) {
        badgeHtml = `<span class="tcc-tp-tl-badge tcc-tp-tl-badge--next">Eerstvolgende</span>`;
    } else if (heeftDatum && item.daysLeft !== null && item.daysLeft <= 14 && item.daysLeft >= 0) {
        badgeHtml = `<span class="tcc-tp-tl-badge" style="background:#fef3c7;color:#92400e;">${item.daysLeft} dagen</span>`;
    } else if (heeftDatum && item.daysLeft !== null) {
        badgeHtml = `<span class="tcc-tp-tl-badge tcc-tp-tl-badge--grijs">${item.daysLeft} d.</span>`;
    } else {
        badgeHtml = `<span class="tcc-tp-tl-badge tcc-tp-tl-badge--grijs">—</span>`;
    }

    // Chevron — alleen als notities aanwezig
    const heeftNotities = !!item.notities;
    const chevronHtml = heeftNotities
        ? `<span class="tcc-tp-tl-chevron">›</span>`
        : `<span></span>`;

    // Uitklap
    const uitlegHtml = heeftNotities ? `
    <div class="tcc-tp-tl-uitleg tcc-tp-tl-uitleg--${state || 'leeg'}" style="display:none">
        ${item.notities}
    </div>` : '';

    return `
    <div class="tcc-tp-tl-item">
        <div class="tcc-tp-tl-rij${state ? ` tcc-tp-tl-rij--${state}` : ''}"
             data-key="${item.key}"
             ${heeftNotities ? 'data-action="tp-toggle-detail"' : ''}>
            <div class="tcc-tp-tl-dot${state ? ` tcc-tp-tl-dot--${state}` : ''}">${dotInhoud}</div>
            <span class="tcc-tp-tl-naam${naamMod}">${item.label}</span>
            ${assignHtml}
            <span class="tcc-tp-tl-datum${datumMod}">${datumTekst}</span>
            ${badgeHtml}
            ${chevronHtml}
        </div>
        ${uitlegHtml}
    </div>`;
}

// ── AI RIJ als planning-task-row ──────────────

function _renderTpAiAlsTaskRow(item) {
    const isDone = item.isChecked || item.isPast;
    const rowBg  = item.isNext ? 'planning-task-row--active' : '';

    const checkHtml = `
        <div class="planning-task-check ${isDone ? 'done' : ''}"
             data-action="tp-toggle-check-ai" data-id="${item.id}">
            ${isDone ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>`;

    const naamHtml = `
        <span class="planning-task-name ${isDone ? 'done' : ''}">
            <span style="display:inline-flex;align-items:center;justify-content:center;
                         width:18px;height:18px;border-radius:50%;background:#ede9fe;color:#6d28d9;
                         font-size:9px;font-weight:700;margin-right:6px;flex-shrink:0;">${item.nr}</span>
            ${item.label}
        </span>`;

    const assignHtml = `<div style="color:#94a3b8;font-size:12px;">—</div>`;

    let datumHtml;
    if (item.dateStr) {
        datumHtml = `<span class="planning-task-date ${isDone ? 'done' : ''}">${item.datumLabel}
            ${item.time ? `<br><span style="font-size:11px;color:#94a3b8;">${item.time}</span>` : ''}</span>`;
    } else {
        datumHtml = `<span class="planning-task-date" style="color:#cbd5e1;">—</span>`;
    }

    let statusHtml;
    if (isDone) {
        statusHtml = `<span class="planning-task-status status--done">Verstreken</span>`;
    } else if (item.isNext) {
        statusHtml = `<span class="planning-task-status" style="background:#dbeafe;color:#1d4ed8;">Eerstvolgende</span>`;
    } else if (item.daysLeft !== null && item.daysLeft <= 14) {
        statusHtml = `<span class="planning-task-status" style="background:#fef3c7;color:#92400e;">${item.daysLeft} dagen</span>`;
    } else {
        statusHtml = `<span class="planning-task-status status--todo">${item.daysLeft !== null ? item.daysLeft + ' d.' : '—'}</span>`;
    }

    return `
    <div class="planning-task-row ${rowBg}" style="grid-template-columns:32px 1fr 200px 110px 90px 32px;">
        ${checkHtml}
        ${naamHtml}
        ${assignHtml}
        ${datumHtml}
        ${statusHtml}
        <span></span>
    </div>`;
}


// ── FASE RENDERER ─────────────────────────────

function _renderTpFase(fase, tp) {
    // Geen fase-headers — clean lijst zoals Projectplanning
    let nextMarkerGezet = false;
    const rijenHtml = fase.items.map(item => {
        let markerHtml = '';
        if (item.isNext && !nextMarkerGezet) {
            markerHtml = `
            <div class="tcc-tp-next-marker">
                <span class="tcc-tp-next-label">▾ EERST VOLGENDE</span>
                <span class="tcc-tp-next-line"></span>
            </div>`;
            nextMarkerGezet = true;
        }
        return markerHtml + _renderTpRij(item);
    }).join('');

    return rijenHtml;
}

// ── RIJ RENDERER ─────────────────────────────

function _renderTpRij(item) {
    const isAfgevinkt = item.isChecked;
    const heeftDatum  = item.heeftDatum;

    // Checkbox
    const checkHtml = `
        <div class="tcc-tp-check${isAfgevinkt ? ' tcc-tp-check--done' : ''}"
             data-action="tp-toggle-check" data-key="${item.key}">
            ${isAfgevinkt ? tccIcon('check', 10, '#fff') : ''}
        </div>`;

    // Naam
    let naamCls = 'tcc-tp-rij-naam';
    if (isAfgevinkt)    naamCls += ' tcc-tp-rij-naam--done';
    if (item.isDeadline && !isAfgevinkt && !item.isPast) naamCls += ' tcc-tp-rij-naam--deadline';
    if (!heeftDatum)    naamCls += ' tcc-tp-rij-naam--empty';

    const indentHtml = item.isSub
        ? `<svg class="tcc-tp-indent" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L2 8L8 8" stroke="currentColor" stroke-width="1.5"/></svg>`
        : '';

    const naamHtml = `
        <div class="tcc-tp-rij-mijlpaal">
            ${indentHtml}
            <svg class="tcc-tp-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="${naamCls}">${item.label}</span>
            ${item.notities ? `<button class="tcc-tp-info-btn" data-action="tp-toon-info" data-key="${escHtml(item.key)}" title="Meer informatie">${tccIcon('info', 15, '#7c3aed')}</button>` : ''}
        </div>`;

    // Toegewezen aan
    const assignHtml = item.assignee
        ? `<div class="tcc-tp-assign tcc-tp-assign--filled">
               <div class="tcc-tp-avatar tcc-tp-avatar--${_avatarKleur(item.assignee)}">${_initialen(item.assignee)}</div>
               <span>${item.assignee}</span>
           </div>`
        : `<div class="tcc-tp-assign" data-action="tp-assign" data-key="${item.key}">
               ${tccIcon('user', 15, 'currentColor')}
               <span>Toewijzen</span>
           </div>`;

    // Datum & tijd
    let datumCls = 'tcc-tp-rij-datum';
    if (isAfgevinkt || item.isPast) datumCls += ' tcc-tp-rij-datum--past';
    if (item.isDeadline && !isAfgevinkt && !item.isPast) datumCls += ' tcc-tp-rij-datum--deadline';

    const datumHtml = heeftDatum
        ? `<div class="${datumCls}">
               <div class="tcc-tp-rij-datum-hoofd">${item.datumLabel} <span class="tcc-tp-weekday">(${item.weekday})</span></div>
               ${item.time ? `<div class="tcc-tp-rij-time">${item.time}</div>` : ''}
           </div>`
        : `<div class="tcc-tp-rij-datum tcc-tp-rij-datum--empty">
               <div class="tcc-tp-rij-datum-hoofd">Datum toevoegen</div>
           </div>`;

    // Status badge
    const badgeHtml = _renderTpBadge(item);

    // Edit knop
    const editHtml = `
        <button class="tcc-tp-edit-btn" data-action="tp-edit-item" data-key="${item.key}"
                title="Bewerken">
            ${tccIcon('edit', 11, 'currentColor')}
        </button>`;

    // Detail laag
    const detailHtml = _renderTpDetail(item);

    // Rij klasse
    const rowCls = [
        'tcc-tp-rij',
        item.isSub      ? 'tcc-tp-rij--sub'      : '',
        isAfgevinkt     ? 'tcc-tp-rij--checked'   : '',
        item.isNext     ? 'tcc-tp-rij--next'       : '',
        item.isDeadline && !isAfgevinkt && !item.isPast ? 'tcc-tp-rij--deadline' : '',
    ].filter(Boolean).join(' ');

    return `
    <div class="${rowCls}" data-key="${item.key}">
        <div class="tcc-tp-rij-main" data-action="tp-toggle-detail" data-key="${item.key}" style="display:grid;grid-template-columns:28px 1fr 160px 120px 90px 28px;align-items:center;gap:8px;padding:7px 20px;cursor:pointer;">
            ${checkHtml}
            ${naamHtml}
            ${assignHtml}
            ${datumHtml}
            ${badgeHtml}
            ${editHtml}
        </div>
        ${detailHtml}
    </div>`;
}

// ── AI SECTIE ────────────────────────────────

function _renderTpAiSectie(mItems) {
    const heeftNext = mItems.some(i => i.isNext);
    let nextMarkerGezet = false;

    const rijenHtml = mItems.map(item => {
        let markerHtml = '';
        if (item.isNext && !nextMarkerGezet) {
            markerHtml = `
            <div class="tcc-tp-next-marker">
                <span class="tcc-tp-next-label">▾ EERST VOLGENDE</span>
                <span class="tcc-tp-next-line"></span>
            </div>`;
            nextMarkerGezet = true;
        }
        return markerHtml + _renderTpRijAI(item);
    }).join('');

    return rijenHtml;
}

function _renderTpRijAI(item) {
    const isAfgevinkt = item.isChecked;

    const checkHtml = `
        <div class="tcc-tp-check${isAfgevinkt ? ' tcc-tp-check--done' : ''}"
             data-action="tp-toggle-check-ai" data-id="${item.id}">
            ${isAfgevinkt ? tccIcon('check', 10, '#fff') : ''}
        </div>`;

    const nrHtml = `<span class="tcc-tp-rij-nr${isAfgevinkt ? ' tcc-tp-rij-nr--past' : ''}">${item.nr}</span>`;

    const naamCls = 'tcc-tp-rij-naam' + (isAfgevinkt ? ' tcc-tp-rij-naam--done' : '');

    const naamHtml = `
        <div class="tcc-tp-rij-mijlpaal">
            <svg class="tcc-tp-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            ${nrHtml}
            <span class="${naamCls}">${item.label}</span>
        </div>`;

    const assignHtml = `<div class="tcc-tp-assign"><span style="opacity:0.3">—</span></div>`;

    const datumHtml = item.dateStr
        ? `<div class="tcc-tp-rij-datum${isAfgevinkt || item.isPast ? ' tcc-tp-rij-datum--past' : ''}">
               <div class="tcc-tp-rij-datum-hoofd">${item.datumLabel} <span class="tcc-tp-weekday">(${item.weekday})</span></div>
               ${item.time ? `<div class="tcc-tp-rij-time">${item.time}</div>` : ''}
           </div>`
        : `<div class="tcc-tp-rij-datum tcc-tp-rij-datum--empty"><div class="tcc-tp-rij-datum-hoofd">—</div></div>`;

    const badgeHtml = _renderTpBadgeAI(item);

    const detailHtml = item.notitie ? `
        <div class="tcc-tp-detail" style="display:none">
            <div class="tcc-tp-detail-item">
                <div class="tcc-tp-detail-label">NOTITIE</div>
                <div class="tcc-tp-detail-val">${item.notitie}</div>
            </div>
        </div>` : '';

    const rowCls = [
        'tcc-tp-rij tcc-tp-rij--ai',
        isAfgevinkt ? 'tcc-tp-rij--checked' : '',
        item.isNext ? 'tcc-tp-rij--next' : '',
    ].filter(Boolean).join(' ');

    return `
    <div class="${rowCls}">
        <div class="tcc-tp-rij-main" data-action="tp-toggle-detail-ai" data-id="${item.id}" style="display:grid;grid-template-columns:28px 1fr 160px 120px 90px 28px;align-items:center;gap:8px;padding:7px 20px;cursor:pointer;">
            ${checkHtml}
            ${naamHtml}
            ${assignHtml}
            ${datumHtml}
            ${badgeHtml}
            <span></span>
        </div>
        ${detailHtml}
    </div>`;
}

// ── DETAIL LAAG ──────────────────────────────

function _renderTpDetail(item) {
    const portaalHtml = `
        <div class="tcc-tp-detail-item">
            <div class="tcc-tp-detail-label">PORTAAL</div>
            <div class="tcc-tp-detail-val${!item.portaal ? ' tcc-tp-detail-val--empty' : ''}">${item.portaal || 'Niet ingesteld'}</div>
        </div>`;

    const notitieHtml = `
        <div class="tcc-tp-detail-item tcc-tp-detail-item--wide">
            <div class="tcc-tp-detail-label">NOTITIE</div>
            <div class="tcc-tp-detail-val${!item.notitie ? ' tcc-tp-detail-val--empty' : ''}">${item.notitie || 'Geen notitie'}</div>
        </div>`;

    const instellingHtml = item.key === 'interne_deadline' ? `
        <div class="tcc-tp-detail-item">
            <div class="tcc-tp-detail-label">INSTELLING</div>
            <div class="tcc-tp-detail-val">Automatisch 2 werkdagen vóór deadline</div>
        </div>` : '';

    const alcatrazHtml = item.key === 'alcatraz' ? `
        <div class="tcc-tp-detail-item tcc-tp-detail-item--wide">
            <div class="tcc-tp-detail-label">UITLEG</div>
            <div class="tcc-tp-detail-val">Moment waarop de inschrijving klaar en vergrendeld moet zijn in het portaal</div>
        </div>` : '';

    return `
    <div class="tcc-tp-detail" style="display:none">
        ${portaalHtml}
        ${instellingHtml}
        ${alcatrazHtml}
        ${notitieHtml}
    </div>`;
}

// ── STATUS BADGES ─────────────────────────────

function _renderTpBadge(item) {
    if (item.isChecked) {
        return `<span class="tcc-tp-badge tcc-tp-badge--passed">${tccIcon('checkCircle', 11, '#15803d')} Verstreken</span>`;
    }
    if (!item.heeftDatum) {
        return `<span class="tcc-tp-badge tcc-tp-badge--empty">—</span>`;
    }
    if (item.isDeadline && !item.isPast) {
        return `<span class="tcc-tp-badge tcc-tp-badge--deadline">Deadline</span>`;
    }
    if (item.isPast) {
        return `<span class="tcc-tp-badge tcc-tp-badge--passed">${tccIcon('checkCircle', 11, '#15803d')} Verstreken</span>`;
    }
    if (item.isNext) {
        return `<span class="tcc-tp-badge tcc-tp-badge--next">Eerstvolgende</span>`;
    }
    if (item.daysLeft !== null && item.daysLeft <= 14) {
        return `<span class="tcc-tp-badge tcc-tp-badge--soon">${item.daysLeft} dagen</span>`;
    }
    return `<span class="tcc-tp-badge tcc-tp-badge--gray">${item.daysLeft} d.</span>`;
}

function _renderTpBadgeAI(item) {
    if (item.isChecked) {
        return `<span class="tcc-tp-badge tcc-tp-badge--passed">${tccIcon('checkCircle', 11, '#15803d')} Verstreken</span>`;
    }
    if (!item.dateStr) {
        return `<span class="tcc-tp-badge tcc-tp-badge--empty">—</span>`;
    }
    if (item.isPast) {
        return `<span class="tcc-tp-badge tcc-tp-badge--passed">${tccIcon('checkCircle', 11, '#15803d')} Verstreken</span>`;
    }
    if (item.isNext) {
        return `<span class="tcc-tp-badge tcc-tp-badge--next">Eerstvolgende</span>`;
    }
    if (item.daysLeft !== null && item.daysLeft <= 14) {
        return `<span class="tcc-tp-badge tcc-tp-badge--soon">${item.daysLeft} dagen</span>`;
    }
    return item.daysLeft !== null
        ? `<span class="tcc-tp-badge tcc-tp-badge--gray">${item.daysLeft} d.</span>`
        : `<span class="tcc-tp-badge tcc-tp-badge--empty">—</span>`;
}

// ── HELPERS ──────────────────────────────────

function _initialen(naam) {
    if (!naam) return '?';
    const delen = naam.trim().split(' ');
    if (delen.length === 1) return delen[0].substring(0, 2).toUpperCase();
    return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

function _avatarKleur(naam) {
    const kleuren = ['blue', 'green', 'purple', 'orange'];
    let hash = 0;
    for (let i = 0; i < (naam || '').length; i++) hash += naam.charCodeAt(i);
    return kleuren[hash % kleuren.length];
}


// ============================================
// EVENT HANDLERS — Tenderplanning
// Aan te sluiten in TCC_Core.js initTccEvents()
// ============================================


// ============================================
// HANDLERS — Datum bewerken & Persoon toewijzen
// Gebaseerd op PP tab handlers (handlePpSetDate / handlePpAssign)
// ============================================

function handleTpEditItem(key, targetEl) {
    // Opent datum-picker voor het gegeven mijlpaal-slot
    const allItems = tccState.data?.tenderplanning?.allItems || [];
    const item = allItems.find(i => i.key === key);
    if (!item) return;

    // Verwijder bestaande pickers
    tccState.overlay?.querySelectorAll('.tp-date-picker').forEach(el => el.remove());

    const currentDate = item.dateStr ? new Date(item.dateStr).toISOString().split('T')[0] : '';
    const currentTime = item.time ? item.time.replace(' uur', '') : '';

    const picker = document.createElement('div');
    picker.className = 'tp-date-picker';
    Object.assign(picker.style, {
        position: 'absolute', zIndex: '10100',
        background: 'white', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '14px', display: 'flex', flexDirection: 'column',
        gap: '10px', minWidth: '220px', fontFamily: 'inherit'
    });

    picker.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:2px;">
            ${item.label}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Datum</label>
            <input type="date" id="tp-dp-datum" value="${currentDate}"
                   style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;color:#0f172a;width:100%;box-sizing:border-box;">
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tijd (optioneel)</label>
            <input type="time" id="tp-dp-tijd" value="${currentTime}"
                   style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;color:#0f172a;width:100%;box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end;padding-top:4px;">
            ${currentDate ? `<button id="tp-dp-clear" style="padding:5px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Wissen</button>` : ''}
            <button id="tp-dp-cancel" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annuleren</button>
            <button id="tp-dp-save" style="padding:5px 12px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Opslaan</button>
        </div>
    `;

    // Positioneer relatief aan TCC overlay
    const overlayEl = tccState.overlay;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl?.getBoundingClientRect() || { top: 0, left: 0, right: window.innerWidth };
    picker.style.top  = `${rect.bottom - overlayRect.top + 4}px`;
    // Links of rechts uitlijnen afhankelijk van ruimte
    if (rect.left - overlayRect.left > 200) {
        picker.style.left = `${rect.left - overlayRect.left - 100}px`;
    } else {
        picker.style.left = `${rect.left - overlayRect.left}px`;
    }
    overlayEl?.appendChild(picker);

    const datumInput = picker.querySelector('#tp-dp-datum');
    datumInput.focus();

    async function _saveDatum(datum, tijd) {
        picker.remove();
        await _tpSaveDatum(key, datum, tijd);
    }

    picker.querySelector('#tp-dp-save').addEventListener('click', async () => {
        const datum = datumInput.value;
        const tijd  = picker.querySelector('#tp-dp-tijd').value;
        await _saveDatum(datum || null, tijd || null);
    });

    picker.querySelector('#tp-dp-cancel').addEventListener('click', () => picker.remove());
    picker.querySelector('#tp-dp-clear')?.addEventListener('click', async () => {
        await _saveDatum(null, null);
    });

    datumInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const datum = datumInput.value;
            const tijd  = picker.querySelector('#tp-dp-tijd').value;
            await _saveDatum(datum || null, tijd || null);
        }
        if (e.key === 'Escape') picker.remove();
    });

    // Klik buiten sluit picker
    setTimeout(() => {
        const close = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 100);
}

async function _tpSaveDatum(key, datum, tijd) {
    // Sla datum op in de milestones tabel via de backend
    // Zoek de bijbehorende milestone op basis van key → milestone_type mapping
    const KEY_TYPE_MAP = {
        'publicatiedatum':         'publicatie',
        'schouwdatum':             'schouw',
        'deadline_vragen_1':       'vragen_ronde_1',
        'nota_van_inlichtingen_1': 'nota_inlichtingen_1',
        'deadline_vragen_2':       'vragen_ronde_2',
        'nota_van_inlichtingen_2': 'nota_inlichtingen_2',
        'interne_deadline':        'interne_deadline',
        'deadline_indiening':      'sluitingsdatum',
        'alcatraz':                'alcatraz',
        'presentatie':             'presentatie',
        'voorlopige_gunning':      'voorlopige_gunning',
        'definitieve_gunning':     'definitieve_gunning',
        'start_opdracht':          'start_opdracht',
    };

    // Haal basis key op (zonder _1, _2 suffix voor rondes)
    const baseKey = key.replace(/_\d+$/, '');
    const milestoneType = KEY_TYPE_MAP[key] || KEY_TYPE_MAP[baseKey];

    if (!milestoneType) {
        console.warn('[TCC] Geen milestone type voor key:', key);
        return;
    }

    // Zoek bestaande milestone op
    const milestones = tccState.data?.tenderplanning?.milestoneItems || [];
    // Zoek ook in de raw milestones die geladen zijn
    const allMilestones = tccState._rawMilestones || [];

    try {
        window.showAutoSaveIndicator?.('saving');

        // Datum formatteren voor DB
        let datumDb = null;
        if (datum) {
            datumDb = datum; // YYYY-MM-DD
        }

        // Zoek bestaande milestone met dit type
        const bestaande = allMilestones.find(m => m.milestone_type === milestoneType);

        if (bestaande) {
            // Update bestaande milestone
            await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones/${bestaande.id}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ datum: datumDb, tijd: tijd || null })
                }
            );
        } else if (datumDb) {
            // Maak nieuwe milestone aan
            await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        milestone_type: milestoneType,
                        naam: key,
                        datum: datumDb,
                        tijd: tijd || null,
                        status: 'pending'
                    })
                }
            );
        }

        // Herlaad milestones en re-render
        const result = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones`
        );
        const milestonesFresh = result?.items || [];
        tccState._rawMilestones = milestonesFresh;

        const tender = tccState.data?.tender || {};
        tccState.data.tenderplanning = transformTenderplanning(
            tender, {}, null, milestonesFresh, {},
            tccState.data._tpTemplate?.taken || null
        );

        window.showAutoSaveIndicator?.('saved');
        _tpRerender();

    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        console.error('[TCC] Datum opslaan mislukt:', err);
        showTccToast('Datum opslaan mislukt', 'error');
    }
}

function handleTpAssign(key, targetEl) {
    const teamleden = tccState.data?._bureauTeamMembers || [];

    // Verwijder bestaande dropdowns
    tccState.overlay?.querySelectorAll('.tp-assign-dd').forEach(el => el.remove());

    const dd = document.createElement('div');
    dd.className = 'tp-assign-dd';
    Object.assign(dd.style, {
        position: 'absolute', zIndex: '10100',
        background: 'white', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        padding: '8px 0', minWidth: '220px',
        maxHeight: '280px', overflowY: 'auto',
        fontFamily: 'inherit'
    });

    const overlayEl = tccState.overlay;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl?.getBoundingClientRect() || { top: 0, left: 0 };
    dd.style.top  = `${rect.bottom - overlayRect.top + 4}px`;
    dd.style.left = `${rect.left - overlayRect.left}px`;
    overlayEl?.appendChild(dd);

    const renderOpties = () => {
        const allItems = tccState.data?.tenderplanning?.allItems || [];
        const item = allItems.find(i => i.key === key);
        const huidigAssignee = item?.assignee || null;

        let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;
                                border-bottom:1px solid #f1f5f9;">
            Teamlid toewijzen
        </div>`;

        if (teamleden.length === 0) {
            html += `<div style="padding:14px;font-size:13px;color:#94a3b8;text-align:center;">
                Geen teamleden gevonden
            </div>`;
        } else {
            // Geen toewijzing optie
            html += `<div class="tp-assign-opt" data-member-id=""
                         style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;
                                ${!huidigAssignee ? 'background:#eff6ff;' : ''}">
                <span style="width:28px;height:28px;border-radius:50%;background:#f1f5f9;color:#94a3b8;
                             font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">—</span>
                <span style="font-size:13px;color:#64748b;">Niet toegewezen</span>
                ${!huidigAssignee ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </div>`;

            teamleden.forEach(lid => {
                const memberId = lid.user_id || lid.id;
                const naam = lid.naam || lid.email || 'Onbekend';
                const init = lid.initialen || naam.substring(0, 2).toUpperCase();
                const kleur = lid.avatar_kleur || '#667eea';
                const isHuidig = huidigAssignee === naam;

                html += `<div class="tp-assign-opt" data-member-id="${memberId}" data-member-naam="${naam}"
                              style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;
                                     ${isHuidig ? 'background:#eff6ff;' : ''}">
                    <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;
                                 font-size:11px;font-weight:700;display:flex;align-items:center;
                                 justify-content:center;flex-shrink:0;">${escHtml(init)}</span>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:${isHuidig ? '700' : '500'};color:#0f172a;">${escHtml(naam)}</div>
                        ${lid.bureau_rol ? `<div style="font-size:11px;color:#94a3b8;">${escHtml(lid.bureau_rol)}</div>` : ''}
                    </div>
                    ${isHuidig ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>`;
            });
        }

        dd.innerHTML = html;

        dd.querySelectorAll('.tp-assign-opt').forEach(opt => {
            opt.addEventListener('mouseenter', () => opt.style.background = opt.style.background || '#f8fafc');
            opt.addEventListener('mouseleave', () => {
                const isSelected = opt.querySelector('svg');
                opt.style.background = isSelected ? '#eff6ff' : 'transparent';
            });
            opt.addEventListener('click', () => {
                const naam = opt.dataset.memberNaam || null;
                _tpSetAssignee(key, naam);
                dd.remove();
            });
        });
    };

    renderOpties();

    setTimeout(() => {
        const close = (e) => {
            if (!dd.contains(e.target)) {
                dd.remove();
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 100);
}

function _tpSetAssignee(key, naam) {
    // Update lokaal in state (allItems + fasen)
    const allItems = tccState.data?.tenderplanning?.allItems || [];
    const item = allItems.find(i => i.key === key);
    if (item) {
        item.assignee = naam;
    }
    const fasen = tccState.data?.tenderplanning?.fasen || [];
    for (const fase of fasen) {
        const faseItem = fase.items?.find(i => i.key === key);
        if (faseItem) faseItem.assignee = naam;
    }

    _tpRerender();

    // Persist naar DB — sla op als notitie op de milestone
    _tpPersistAssignee(key, naam);

    showTccToast(naam ? `${naam} toegewezen` : 'Toewijzing verwijderd', 'success');
}

async function _tpPersistAssignee(key, naam) {
    // Zoek de milestone op basis van key → type mapping
    const KEY_TYPE_MAP = {
        'publicatiedatum':         'publicatie',
        'schouwdatum':             'schouw',
        'deadline_vragen_1':       'vragen_ronde_1',
        'nota_van_inlichtingen_1': 'nota_inlichtingen_1',
        'deadline_vragen_2':       'vragen_ronde_2',
        'nota_van_inlichtingen_2': 'nota_inlichtingen_2',
        'interne_deadline':        'interne_deadline',
        'deadline_indiening':      'sluitingsdatum',
        'alcatraz':                'alcatraz',
        'presentatie':             'presentatie',
        'voorlopige_gunning':      'voorlopige_gunning',
        'definitieve_gunning':     'definitieve_gunning',
        'start_opdracht':          'start_opdracht',
    };

    const baseKey = key.replace(/_\d+$/, '');
    const milestoneType = KEY_TYPE_MAP[key] || KEY_TYPE_MAP[baseKey];
    if (!milestoneType) return;

    const allMilestones = tccState._rawMilestones || [];
    const milestone = allMilestones.find(m => m.milestone_type === milestoneType);
    if (!milestone) return; // Geen milestone in DB — niets om op te slaan

    try {
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones/${milestone.id}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ verantwoordelijke: naam || null })
            }
        );
    } catch (err) {
        console.warn('[TCC] Assignee opslaan mislukt:', err);
    }
}

// ── HANDLER: Opnieuw / picker ────────────────
function handleTpStartPicker() {
    tccState.tenderplanningState = 'picker';
    _tpRerender();
}

function handleTpAnnuleer() {
    tccState.tenderplanningState = 'data';
    _tpRerender();
}

function handleTpPickerToggle(docId) {
    // Toggle document selectie in picker state
    const radio = tccState.overlay?.querySelector(`input[value="${docId}"]`);
    if (radio) radio.checked = true;
}

async function handleTpStartExtractie() {
    const panel = tccState.overlay?.querySelector('[data-panel="tenderplanning"]');
    if (!panel) return;

    const selectedDocs = [...panel.querySelectorAll('input[name="tp-doc-select"]:checked')];
    if (selectedDocs.length === 0) {
        showTccToast('Selecteer minimaal één document', 'warn');
        return;
    }
    // selectedDocs.map(d => d.value) = array van document IDs (voor toekomstig gebruik)

    tccState.tenderplanningState = 'loading';
    _tpRerender();

    // Haal gekozen model op
    const gekozenModel = panel.querySelector('input[name="tp-model-select"]:checked')?.value
        || 'claude-haiku-4-5-20251001';

    try {
        const result = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/extract-planning`,
            { method: 'POST', body: JSON.stringify({ overschrijf: true, model: gekozenModel }) }
        );

        // Herlaad data
        const milestonesResult = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones`
        );
        const milestones = milestonesResult?.items || [];

        const tender = tccState.data?.tender || {};
        const extractedData = {};
        tccState.data.tenderplanning = transformTenderplanning(
            tender, extractedData, null, milestones, {},
            tccState.data._tpTemplate?.taken || null
        );

        tccState.tenderplanningState = 'data';
        _tpRerender();

        showTccToast(`✅ ${result.aangemaakt || milestones.length} mijlpalen geëxtraheerd`, 'success');

    } catch (err) {
        console.error('[TCC] Planning extractie mislukt:', err);
        tccState.tenderplanningState = 'data';
        _tpRerender();
        showTccToast('Extractie mislukt: ' + err.message, 'error');
    }
}

function _tpRerender() {
    const panel = tccState.overlay?.querySelector('[data-panel="tenderplanning"]');
    if (!panel) return;
    const wasActive = panel.classList.contains('is-active');
    const nieuwHtml = renderTabTenderplanning(tccState.data || {});
    const tmp = document.createElement('div');
    tmp.innerHTML = nieuwHtml;
    const nieuwPanel = tmp.firstElementChild;
    if (wasActive) nieuwPanel.classList.add('is-active');
    panel.replaceWith(nieuwPanel);
}

async function handleTpToggleCheck(key, panel) {
    console.log('[TP] handleTpToggleCheck aangeroepen, key:', key);

    // Stap 1 — Item opzoeken in state
    const allItems = tccState.data?.tenderplanning?.allItems || [];
    const item = allItems.find(i => i.key === key);
    console.log('[TP] item:', item);

    // Status bepalen: item.status (DB-waarde) of fallback via item.isChecked
    const huidigeStatus = item?.status || (item?.isChecked ? 'completed' : 'pending');
    console.log('[TP] huidige status:', huidigeStatus);

    // Stap 2 — Nieuwe status
    const nieuweStatus = huidigeStatus === 'completed' ? 'pending' : 'completed';
    const isDone = nieuweStatus === 'completed';

    // Stap 3 — Optimistic UI update
    const rij = panel.querySelector(
        `.tcc-tp-rij[data-key="${key}"], .planning-task-row[data-key="${key}"]`
    );
    console.log('[TP] rij gezocht met key:', key);
    console.log('[TP] rij gevonden:', rij);
    console.log('[TP] alle planning-task-rows:',
        [...panel.querySelectorAll('.planning-task-row')].map(r => r.dataset.key));
    if (!rij) {
        console.error('[TP] Rij niet gevonden voor key:', key);
        return;
    }
    const check    = rij.querySelector('.tcc-tp-check, .planning-task-check');
    if (!check) {
        console.error('[TP] check element niet gevonden in rij:', rij.innerHTML.substring(0, 200));
        return;
    }
    const naamEl   = rij.querySelector('.tcc-tp-rij-naam, .planning-task-name');
    const datumEl  = rij.querySelector('.tcc-tp-rij-datum, .planning-task-date');

    check.classList.toggle('tcc-tp-check--done', isDone);
    check.innerHTML = isDone ? tccIcon('check', 10, '#fff') : '';
    rij.classList.toggle('tcc-tp-rij--checked', isDone);
    if (naamEl)  naamEl.classList.toggle('tcc-tp-rij-naam--done', isDone);
    if (datumEl) datumEl.classList.toggle('tcc-tp-rij-datum--past', isDone);

    // Stap 4 — State updaten (optimistic)
    if (item) {
        item.status    = nieuweStatus;
        item.isChecked = isDone;
    }

    // Stap 5 — API call via milestone_type mapping
    const KEY_TYPE_MAP = {
        'publicatiedatum':         'publicatie',
        'schouwdatum':             'schouw',
        'deadline_vragen_1':       'vragen_ronde_1',
        'nota_van_inlichtingen_1': 'nota_inlichtingen_1',
        'deadline_vragen_2':       'vragen_ronde_2',
        'nota_van_inlichtingen_2': 'nota_inlichtingen_2',
        'interne_deadline':        'interne_deadline',
        'deadline_indiening':      'sluitingsdatum',
        'alcatraz':                'alcatraz',
        'presentatie':             'presentatie',
        'voorlopige_gunning':      'voorlopige_gunning',
        'definitieve_gunning':     'definitieve_gunning',
        'start_opdracht':          'start_opdracht',
    };

    const baseKey      = key.replace(/_\d+$/, '');
    const milestoneType = KEY_TYPE_MAP[key] || KEY_TYPE_MAP[baseKey];

    if (!milestoneType) {
        console.warn('[TP] Geen milestone type voor key:', key, '— status niet opgeslagen');
        return;
    }

    const allMilestones = tccState._rawMilestones || [];
    const bestaande     = allMilestones.find(m => m.milestone_type === milestoneType);

    try {
        window.showAutoSaveIndicator?.('saving');
        let result;

        if (bestaande) {
            // Update bestaande milestone
            result = await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones/${bestaande.id}`,
                { method: 'PATCH', body: JSON.stringify({ status: nieuweStatus }) }
            );
            console.log('[TP] API response:', result);
            bestaande.status = nieuweStatus;
        } else {
            // Geen milestone in DB voor dit slot —
            // UI toggle wel tonen maar niet persisteren
            console.warn('[TP] Geen milestone voor key:', key, '— UI toggle zonder persistentie');
            window.showAutoSaveIndicator?.('saved');
            return;
        }

        window.showAutoSaveIndicator?.('saved');

    } catch (err) {
        console.error('[TP] Toggle fout:', err);
        showTccToast('Opslaan mislukt', 'error');
        window.showAutoSaveIndicator?.('error');

        // Revert UI
        check.classList.toggle('tcc-tp-check--done', !isDone);
        check.innerHTML = !isDone ? tccIcon('check', 10, '#fff') : '';
        rij.classList.toggle('tcc-tp-rij--checked', !isDone);
        if (naamEl)  naamEl.classList.toggle('tcc-tp-rij-naam--done', !isDone);
        if (datumEl) datumEl.classList.toggle('tcc-tp-rij-datum--past', !isDone);

        // Revert state
        if (item) {
            item.status    = huidigeStatus;
            item.isChecked = !isDone;
        }
    }
}

function handleTpToggleDetail(key, panel) {
    const rij = panel.querySelector(`.tcc-tp-tl-rij[data-key="${key}"]`);
    if (!rij) return;
    const item   = rij.closest('.tcc-tp-tl-item');
    const uitleg = item?.querySelector('.tcc-tp-tl-uitleg');
    const chevron = rij.querySelector('.tcc-tp-tl-chevron');
    if (!uitleg) return;

    // Sluit andere open items
    panel.querySelectorAll('.tcc-tp-tl-uitleg').forEach(el => {
        if (el !== uitleg && el.style.display !== 'none') {
            el.style.display = 'none';
            el.closest('.tcc-tp-tl-item')?.querySelector('.tcc-tp-tl-rij')?.classList.remove('tcc-tp-tl-rij--open');
            el.closest('.tcc-tp-tl-item')?.querySelector('.tcc-tp-tl-chevron')?.classList.remove('tcc-tp-tl-chevron--open');
        }
    });

    const isOpen = uitleg.style.display !== 'none';
    uitleg.style.display = isOpen ? 'none' : 'block';
    rij.classList.toggle('tcc-tp-tl-rij--open', !isOpen);
    if (chevron) chevron.classList.toggle('tcc-tp-tl-chevron--open', !isOpen);
}

function handleTpToggleCheckAi(id, panel) {
    const rij = panel.querySelector(`.tcc-tp-rij--ai .tcc-tp-check[data-id="${id}"]`)?.closest('.tcc-tp-rij');
    if (!rij) return;
    const check = rij.querySelector('.tcc-tp-check');
    const isDone = check.classList.toggle('tcc-tp-check--done');
    check.innerHTML = isDone ? tccIcon('check', 10, '#fff') : '';
    rij.classList.toggle('tcc-tp-rij--checked', isDone);
    const naam = rij.querySelector('.tcc-tp-rij-naam');
    if (naam) naam.classList.toggle('tcc-tp-rij-naam--done', isDone);
    const datum = rij.querySelector('.tcc-tp-rij-datum');
    if (datum) datum.classList.toggle('tcc-tp-rij-datum--past', isDone);
    // TODO: persist naar DB via API
}

function handleTpToggleDetailAi(id, panel) {
    const rij = panel.querySelector(`.tcc-tp-rij--ai .tcc-tp-check[data-id="${id}"]`)?.closest('.tcc-tp-rij');
    if (!rij) return;
    const detail  = rij.querySelector('.tcc-tp-detail');
    const chevron = rij.querySelector('.tcc-tp-chevron');
    if (!detail) return;
    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'flex';
    rij.classList.toggle('tcc-tp-rij--open', !isOpen);
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function handleTpAddNvi(panel) {
    // Voegt een extra NvI ronde toe aan de DOM
    // TODO: implementeer dynamisch toevoegen + persist
    console.log('NvI ronde toevoegen');
}

function handleTpToonInfo(key) {
    const panel = tccState.overlay?.querySelector('[data-panel="tenderplanning"]');
    if (!panel) return;

    // Zoek item in de verwerkte data
    console.log('[TP] toon info key:', key,
                'allItems:', tccState.data?.tenderplanning?.allItems?.length);
    const allItems = tccState.data?.tenderplanning?.allItems || [];
    const item = allItems.find(i => i.key === key);
    if (!item?.notities) return;

    const bestaand = document.querySelector(`.tcc-tp-info-popup[data-info-key="${key}"]`);
    if (bestaand) {
        panel.querySelector(`.tcc-tp-rij[data-key="${key}"]`)?.classList.remove('is-actief');
        bestaand.remove();
        return;
    }

    document.querySelectorAll('.tcc-tp-info-popup').forEach(p => p.remove());
    panel.querySelectorAll('.tcc-tp-rij.is-actief').forEach(r => r.classList.remove('is-actief'));

    const popup = document.createElement('div');
    popup.className = 'tcc-tp-info-popup';
    popup.dataset.infoKey = key;
    popup.innerHTML = `
        <div class="tcc-tp-info-popup-header">
            <div class="tcc-tp-info-popup-icon">${tccIcon('info', 13, '#64748b')}</div>
            <span class="tcc-tp-info-popup-title">Mijlpaalinformatie</span>
        </div>
        <div class="tcc-tp-info-popup-body">
            <div class="tcc-tp-info-popup-tekst">${escHtml(item.notities)}</div>
            ${item.bron_tekst ? `<div class="tcc-tp-info-popup-bron">${escHtml(item.bron_tekst)}</div>` : ''}
            ${item.document_naam ? `<div class="tcc-tp-info-popup-doc">${tccIcon('fileText', 11, '#475569')} ${escHtml(item.document_naam)}</div>` : ''}
        </div>`;

    const rij = panel.querySelector(`.tcc-tp-rij[data-key="${key}"]`);
    if (!rij) return;
    rij.classList.add('is-actief');
    rij.insertAdjacentElement('afterend', popup);

    setTimeout(() => {
        document.addEventListener('click', function sluit(e) {
            if (!popup.contains(e.target) && !e.target.closest(`[data-key="${key}"]`)) {
                rij.classList.remove('is-actief');
                popup.remove();
                document.removeEventListener('click', sluit);
            }
        });
    }, 0);
}

function handleTpAddMijlpaal(panel) {
    // Opent een mini-form om een losse mijlpaal toe te voegen
    // TODO: implementeer
    console.log('Mijlpaal toevoegen');
}