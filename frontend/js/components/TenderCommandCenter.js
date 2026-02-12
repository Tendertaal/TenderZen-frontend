/* ============================================
   TENDER COMMAND CENTER (TCC) — COMPONENT
   Versie 1.0 — 10 februari 2026
   
   Modal component die alle tender-informatie
   bundelt in 5 tabs: AI Analyse, Planning,
   Checklist, Documenten en Workflow.
   
   Gebruik:
     openCommandCenter(tenderId)
   ============================================ */

// ============================================
// AANVULLENDE ICONEN (niet in icons.js)
// ============================================

const TccIcons = {
    _svg(paths, size = 16, color = 'currentColor', sw = 1.75, fill = 'none') {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    },

    sparkles(size = 16, color = '#9333ea') {
        return this._svg(`<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>`, size, color);
    },

    robot(size = 16, color = '#9333ea') {
        return this._svg(`<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/><path d="M9 20v1"/><path d="M15 20v1"/>`, size, color);
    },

    checkSquare(size = 16, color = '#16a34a') {
        return this._svg(`<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`, size, color);
    },

    folderOpen(size = 16, color = '#2563eb') {
        return this._svg(`<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>`, size, color);
    },

    lightbulb(size = 16, color = '#d97706') {
        return this._svg(`<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`, size, color);
    },

    award(size = 16, color = '#16a34a') {
        return this._svg(`<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`, size, color);
    },

    archive(size = 16, color = '#334155') {
        return this._svg(`<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>`, size, color);
    },

    play(size = 16, color = '#16a34a') {
        return this._svg(`<polygon points="5 3 19 12 5 21 5 3"/>`, size, color);
    },

    maximize(size = 16, color = '#334155') {
        return this._svg(`<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`, size, color);
    }
};

// ============================================
// ICON HELPER — resolve icon by name
// ============================================

function tccIcon(name, size = 16, color = null) {
    // Eerst checken in TccIcons (aanvullende icons)
    if (TccIcons[name]) {
        return `<span class="tcc-icon">${TccIcons[name](size, color || undefined)}</span>`;
    }

    // Dan in globale Icons library
    if (typeof Icons !== 'undefined' && Icons[name]) {
        const opts = { size };
        if (color) opts.color = color;
        return `<span class="tcc-icon">${Icons[name](opts)}</span>`;
    }

    // Fallback: lege span
    console.warn(`[TCC] Icon "${name}" niet gevonden`);
    return `<span class="tcc-icon"></span>`;
}

// ============================================
// STATE
// ============================================

let tccState = {
    tenderId: null,
    activeTab: 'ai',
    activeSub: 'analyse',
    data: null,
    overlay: null
};

// ============================================
// MAIN API — openCommandCenter
// ============================================

/**
 * Opent het Tender Command Center voor een specifieke tender.
 * @param {string} tenderId - UUID van de tender
 * @param {Object} [preloadData] - Optionele data om direct te tonen (skip API call)
 */
async function openCommandCenter(tenderId, preloadData = null) {
    tccState.tenderId = tenderId;
    tccState.activeTab = 'ai';
    tccState.activeSub = 'analyse';

    // Data ophalen of gebruiken
    if (preloadData) {
        tccState.data = preloadData;
    } else {
        try {
            tccState.data = await fetchTccData(tenderId);
        } catch (err) {
            console.error('[TCC] Fout bij laden data:', err);
            showNotification('Fout bij laden tender data', 'error');
            return;
        }
    }

    // Render
    renderTcc();

    // Keyboard shortcut (Escape)
    document.addEventListener('keydown', handleTccKeydown);
}

/**
 * Sluit het Tender Command Center.
 */
function closeCommandCenter() {
    if (tccState.overlay) {
        tccState.overlay.classList.add('tcc-closing');
        setTimeout(() => {
            tccState.overlay.remove();
            tccState.overlay = null;
        }, 200);
    }
    document.removeEventListener('keydown', handleTccKeydown);
}

function handleTccKeydown(e) {
    if (e.key === 'Escape') {
        closeCommandCenter();
    }
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchTccData(tenderId) {
    console.log(`[TCC] Fetching data for tender: ${tenderId}`);

    // ── 1. Tender ophalen uit al geladen data (geen API call) ──
    const tender = window.app?.tenders?.find(t => t.id === tenderId);
    if (!tender) {
        console.warn('[TCC] Tender niet gevonden in window.app.tenders, fallback naar API');
        // Fallback: probeer via apiService
        try {
            const result = await window.apiService?.request(`/tenders/${tenderId}`);
            if (result) return buildTccData(result, null, []);
        } catch (e) { console.error('[TCC] Fallback API ook mislukt:', e); }
        return buildTccData({ id: tenderId, naam: 'Tender', fase: 'onbekend' }, null, []);
    }

    // ── 2. Smart Import data ophalen (analyse resultaten + uploaded files) ──
    let smartImportData = null;
    if (tender.smart_import_id) {
        try {
            smartImportData = await tccApiCall(`/api/v1/smart-import/${tender.smart_import_id}/status`);
            console.log('[TCC] Smart Import data geladen:', smartImportData?.status);
        } catch (e) {
            console.warn('[TCC] Smart Import data niet beschikbaar:', e.message);
        }
    }

    // ── 3. AI Documenten ophalen (gegenereerde docs) ──
    let aiDocuments = [];
    try {
        const aiDocsResult = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/ai-documents`);
        aiDocuments = aiDocsResult?.documents || [];
        console.log(`[TCC] ${aiDocuments.length} AI documenten geladen`);
    } catch (e) {
        console.warn('[TCC] AI documenten niet beschikbaar:', e.message);
    }

    // ── 4. AI Document Templates ophalen (voor generatie kaarten) ──
    let aiTemplates = [];
    try {
        const templResult = await tccApiCall('/api/v1/ai-documents/templates');
        aiTemplates = templResult?.templates || [];
    } catch (e) {
        console.warn('[TCC] AI templates niet beschikbaar:', e.message);
    }

    // ── 5. Team data ophalen (bureau teamleden + tender toewijzingen) ──
    // ⚠️ SECURITY: Altijd de tender's eigen tenderbureau_id meesturen
    // zodat alleen teamleden van HET JUISTE bureau worden opgehaald.
    let bureauTeamMembers = [];
    try {
        const tenderBureauId = tender.tenderbureau_id;
        if (!tenderBureauId) {
            console.warn('[TCC] ⚠️ Tender heeft geen tenderbureau_id — team members niet opgehaald');
        } else {
            const teamResult = await tccApiCall(`/api/v1/team-members?tenderbureau_id=${tenderBureauId}`);
            bureauTeamMembers = teamResult?.data || [];
            console.log(`[TCC] ${bureauTeamMembers.length} bureau teamleden geladen voor bureau ${tenderBureauId}`);
        }
    } catch (e) {
        console.warn('[TCC] Team members niet beschikbaar:', e.message);
    }

    return buildTccData(tender, smartImportData, aiDocuments, aiTemplates, bureauTeamMembers);
}

// ============================================
// API HELPER — Authenticated fetch voor TCC
// ============================================

async function tccApiCall(endpoint, options = {}) {
    // Gebruik bestaande apiService als beschikbaar (bewezen werkend)
    if (window.apiService?.request) {
        return await window.apiService.request(endpoint, options);
    }

    // Fallback: directe fetch met Supabase auth
    const baseUrl = window.API_CONFIG?.baseURL || window.API_CONFIG?.BASE_URL || 'http://localhost:3000';
    let token = null;

    // Token ophalen (zelfde patroon als ApiService)
    try {
        const client = window.supabaseClient || window.supabase;
        if (client?.auth) {
            const { data: { session } } = await client.auth.getSession();
            token = session?.access_token;
        }
    } catch (e) {
        console.warn('[TCC] Auth token ophalen mislukt:', e);
    }

    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fetchOpts = { headers, ...options };
    if (!fetchOpts.method) fetchOpts.method = 'GET';

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOpts);
    if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
    return await response.json();
}

// ============================================
// DATA TRANSFORMATIE — Bouw TCC datastructuur
// ============================================

function buildTccData(tender, smartImportData, aiDocuments, aiTemplates = [], bureauTeamMembers = []) {
    const extractedData = smartImportData?.extracted_data || {};
    const uploadedFiles = smartImportData?.uploaded_files || [];
    const warnings = smartImportData?.warnings || [];

    // ── Header data ──
    const tenderData = {
        id: tender.id,
        naam: tender.naam || 'Naamloze tender',
        fase: _formatFase(tender.fase),
        aiModel: tender.ai_model_used || smartImportData?.ai_model_used || '',
        deadline: _formatDeadlineShort(tender.deadline_indiening)
    };

    // ── AI Analyse ──
    const analyse = transformAnalyse(extractedData, smartImportData, warnings);

    // ── AI Generatie ──
    const generatie = transformGeneratie(aiDocuments, aiTemplates);

    // ── Documenten tab ──
    const documenten = transformDocumenten(uploadedFiles, aiDocuments, smartImportData);

    // ── Planning & Checklist (bridge handles rendering, maar badges nodig) ──
    const planningCounts = tender._planningCounts || { done: 0, total: 0 };
    const checklistCounts = tender._checklistCounts || { done: 0, total: 0 };

    // ── Team tab ──
    const team = transformTeam(tender, bureauTeamMembers);

    // ── Workflow (voorlopig statisch, later uit DB) ──
    const workflow = buildWorkflowData(tender, smartImportData, aiDocuments);

    return {
        tender: tenderData,
        analyse,
        generatie,
        planning: {
            badge: planningCounts.total > 0 ? String(planningCounts.total) : ''
        },
        checklist: {
            badge: checklistCounts.total > 0 ? `${checklistCounts.done}/${checklistCounts.total}` : ''
        },
        team,
        documenten,
        workflow
    };
}

// ============================================
// TRANSFORM — AI Analyse (extracted_data → secties)
// ============================================

function transformAnalyse(extractedData, smartImportData, warnings) {
    if (!extractedData || Object.keys(extractedData).length === 0) {
        return {
            badge: '',
            percentage: 0,
            filled: 0,
            total: 0,
            confidenceHigh: 0,
            confidenceMedium: 0,
            secties: [{
                titel: 'Geen analyse beschikbaar',
                icon: 'info',
                count: '',
                status: 'Voer Smart Import uit',
                statusType: 'partial',
                type: 'warnings',
                items: [{ type: 'info', tekst: 'Upload documenten via Smart Import om AI-analyse te starten.' }]
            }]
        };
    }

    // Statistieken uit smartImportData (al berekend door backend)
    const total = smartImportData?.total_fields || 0;
    const filled = smartImportData?.fields_extracted || 0;
    const highConf = smartImportData?.fields_high_confidence || 0;
    const medConf = smartImportData?.fields_medium_confidence || smartImportData?.fields_low_confidence || 0;
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

    const secties = [];

    // ── Sectie: Basisgegevens ──
    const basis = extractedData.basisgegevens || extractedData.basis || {};
    const basisVelden = _extractFields(basis, {
        naam: 'Tendernaam',
        opdrachtgever: 'Opdrachtgever',
        type_opdracht: 'Type opdracht',
        procedure: 'Procedure',
        geraamde_waarde: 'Geraamde waarde',
        sector: 'Sector',
        locatie: 'Locatie',
        referentienummer: 'Referentienummer',
        tender_nummer: 'Tendernummer'
    });
    if (basisVelden.length > 0) {
        const basisFilled = basisVelden.filter(v => v.value && v.value !== '—').length;
        secties.push({
            titel: 'Basisgegevens',
            icon: 'clipboardList',
            count: `${basisFilled}/${basisVelden.length}`,
            status: basisFilled === basisVelden.length ? 'Compleet' : `${basisVelden.length - basisFilled} ontbreken`,
            statusType: basisFilled === basisVelden.length ? 'complete' : 'partial',
            type: 'grid',
            velden: basisVelden
        });
    }

    // ── Sectie: Planning & Deadlines ──
    const planning = extractedData.planning || {};
    const timelineItems = _extractTimeline(planning);
    if (timelineItems.length > 0) {
        const planFilled = timelineItems.filter(i => i.date && i.date !== '—').length;
        secties.push({
            titel: 'Planning & Deadlines',
            icon: 'calendarView',
            count: `${planFilled}/${timelineItems.length}`,
            status: planFilled === timelineItems.length ? 'Compleet' : `${timelineItems.length - planFilled} ontbreken`,
            statusType: planFilled === timelineItems.length ? 'complete' : 'partial',
            type: 'timeline',
            items: timelineItems
        });
    }

    // ── Sectie: Overeenkomst & Contract ──
    const contract = extractedData.contract || extractedData.overeenkomst || {};
    const contractVelden = _extractFields(contract, {
        contracttype: 'Contracttype',
        looptijd: 'Looptijd',
        verlengingen: 'Verlengingen',
        ingangsdatum: 'Ingangsdatum',
        indexering: 'Indexering',
        opzegtermijn: 'Opzegtermijn'
    });
    if (contractVelden.length > 0) {
        const cFilled = contractVelden.filter(v => v.value && v.value !== '—').length;
        secties.push({
            titel: 'Overeenkomst & Contract',
            icon: 'fileText',
            count: `${cFilled}/${contractVelden.length}`,
            status: cFilled === contractVelden.length ? 'Compleet' : `${contractVelden.length - cFilled} ontbreken`,
            statusType: cFilled === contractVelden.length ? 'complete' : 'partial',
            type: 'grid',
            velden: contractVelden
        });
    }

    // ── Sectie: Gunningscriteria ──
    const criteria = extractedData.gunningscriteria || extractedData.criteria || [];
    const criteriaArr = Array.isArray(criteria) ? criteria : (criteria.items || []);
    if (criteriaArr.length > 0) {
        secties.push({
            titel: 'Gunningscriteria',
            icon: 'barChart',
            count: String(criteriaArr.length),
            status: 'Compleet',
            statusType: 'complete',
            type: 'criteria',
            criteria: criteriaArr.map(c => ({
                naam: c.naam || c.name || c.criterium || 'Onbekend',
                weging: parseInt(c.weging || c.gewicht || c.percentage || 0)
            }))
        });
    }

    // ── Sectie: Percelen ──
    const percelen = extractedData.percelen || [];
    const percelenArr = Array.isArray(percelen) ? percelen : (percelen.items || []);
    if (percelenArr.length > 0) {
        secties.push({
            titel: 'Percelen',
            icon: 'archive',
            count: String(percelenArr.length),
            type: 'percelen',
            percelen: percelenArr.map(p => ({
                naam: p.naam || p.name || 'Onbekend',
                bedrag: p.bedrag || p.waarde || '',
                beschrijving: p.beschrijving || p.omschrijving || ''
            }))
        });
    }

    // ── Sectie: AI Opmerkingen (warnings) ──
    const allWarnings = [
        ...warnings.map(w => typeof w === 'string' ? { type: 'warn', tekst: w } : w),
        ...(extractedData.opmerkingen || extractedData.aandachtspunten || []).map(o =>
            typeof o === 'string' ? { type: 'tip', tekst: o } : o
        )
    ];
    if (allWarnings.length > 0) {
        secties.push({
            titel: 'AI Opmerkingen',
            icon: 'lightbulb',
            count: String(allWarnings.length),
            type: 'warnings',
            items: allWarnings
        });
    }

    return {
        badge: total > 0 ? `${filled}/${total}` : '',
        percentage,
        filled,
        total,
        confidenceHigh: highConf,
        confidenceMedium: medConf,
        secties
    };
}

// ── Helpers voor extracted_data transformatie ──

function _extractFields(sectionData, fieldMap) {
    const velden = [];
    for (const [key, label] of Object.entries(fieldMap)) {
        const field = sectionData[key];
        if (field !== undefined) {
            const value = typeof field === 'object' ? (field.value || '') : String(field || '');
            const rawConf = typeof field === 'object' ? (field.confidence || 0) : 1;
            const confidence = rawConf >= 0.85 ? 'high' : rawConf >= 0.5 ? 'medium' : 'low';
            velden.push({ label, value: value || '—', confidence });
        }
    }
    return velden;
}

function _extractTimeline(planningData) {
    const labelMap = {
        publicatiedatum: { label: 'Publicatiedatum', icon: 'check', iconColor: '#16a34a' },
        deadline_vragen: { label: 'Deadline vragen', icon: 'clock', iconColor: '#f59e0b' },
        nota_van_inlichtingen: { label: 'Nota van Inlichtingen', icon: 'fileText', iconColor: '#2563eb' },
        deadline_indiening: { label: 'Deadline indiening', icon: 'clock', iconColor: '#dc2626' },
        beoordelingsperiode: { label: 'Beoordelingsperiode', icon: 'calendarView', iconColor: '#7c3aed' },
        voorlopige_gunning: { label: 'Voorlopige gunning', icon: 'award', iconColor: '#4f46e5' },
        definitieve_gunning: { label: 'Definitieve gunning', icon: 'award', iconColor: '#16a34a' },
        start_opdracht: { label: 'Start opdracht', icon: 'play', iconColor: '#059669' },
        aanvang_werkzaamheden: { label: 'Aanvang werkzaamheden', icon: 'play', iconColor: '#059669' },
        schouwdatum: { label: 'Schouwdatum', icon: 'eye', iconColor: '#0284c7' }
    };

    const items = [];
    for (const [key, meta] of Object.entries(labelMap)) {
        const field = planningData[key];
        if (field !== undefined) {
            const dateVal = typeof field === 'object' ? (field.value || '') : String(field || '');
            const formattedDate = dateVal ? _formatDateNL(dateVal) : '—';
            const now = new Date();
            const dateObj = dateVal ? new Date(dateVal) : null;
            const dotType = !dateObj ? 'empty'
                : dateObj < now ? 'past'
                    : _daysUntil(dateObj) <= 7 ? 'urgent'
                        : 'filled';

            items.push({
                label: meta.label,
                date: formattedDate,
                dotType,
                icon: meta.icon,
                iconColor: meta.iconColor,
                urgent: key === 'deadline_indiening' && dotType === 'urgent'
            });
        }
    }
    return items;
}

// ============================================
// TRANSFORM — AI Generatie (documents + templates)
// ============================================

function transformGeneratie(aiDocuments, aiTemplates) {
    // Maak een map van bestaande documenten per template_key
    const docsByKey = {};
    for (const doc of aiDocuments) {
        docsByKey[doc.template_key] = doc;
    }

    // Template icon en beschrijving mapping
    const templateMeta = {
        go_no_go: { icon: 'statusGo', beschrijving: 'Haalbaarheidsanalyse met score' },
        samenvatting: { icon: 'fileText', beschrijving: 'Beknopt overzicht voor team', iconColor: '#2563eb' },
        compliance_matrix: { icon: 'barChart', beschrijving: 'Alle eisen en bewijsstukken' },
        risico_analyse: { icon: 'warning', beschrijving: 'Risico-inventarisatie en mitigatie' },
        rode_draad: { icon: 'lightbulb', beschrijving: 'Rode draad document / kick-off' },
        offerte: { icon: 'fileText', beschrijving: 'Professionele tenderofferte', iconColor: '#16a34a' },
        versie1_inschrijving: { icon: 'fileText', beschrijving: 'Eerste concept inschrijving', iconColor: '#7c3aed' },
        win_check: { icon: 'award', beschrijving: 'Feedback voor hogere winstkans', iconColor: '#16a34a' },
        nvi_vragen: { icon: 'clipboardList', beschrijving: 'Nota van Inlichtingen vragenlijst' },
        pva_skelet: { icon: 'fileText', beschrijving: 'Plan van Aanpak skelet', iconColor: '#4338ca' }
    };

    // Combineer templates met hun document-status
    const documenten = [];

    // Gebruik aiTemplates als beschikbaar, anders alleen bestaande docs
    if (aiTemplates.length > 0) {
        for (const tmpl of aiTemplates) {
            const key = tmpl.template_key;
            const doc = docsByKey[key];
            const meta = templateMeta[key] || { icon: 'fileText', beschrijving: tmpl.beschrijving || '' };

            documenten.push(_buildGenDocCard(key, tmpl.template_name || key, meta, doc));
        }
    } else if (aiDocuments.length > 0) {
        // Geen templates, toon alleen bestaande gegenereerde docs
        for (const doc of aiDocuments) {
            const key = doc.template_key || doc.type || 'onbekend';
            const meta = templateMeta[key] || { icon: 'fileText', beschrijving: '' };
            documenten.push(_buildGenDocCard(key, doc.titel || key, meta, doc));
        }
    } else {
        // Geen templates EN geen docs — toon standaard set als 'ready'
        for (const [key, meta] of Object.entries(templateMeta)) {
            if (['go_no_go', 'samenvatting', 'compliance_matrix', 'risico_analyse'].includes(key)) {
                const naam = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                documenten.push(_buildGenDocCard(key, naam, meta, null));
            }
        }
    }

    const doneCount = documenten.filter(d => d.status === 'done' || d.status === 'gonogo').length;

    return {
        badge: documenten.length > 0 ? `${doneCount}/${documenten.length}` : '',
        documenten
    };
}

function _buildGenDocCard(key, titel, meta, doc) {
    if (!doc) {
        return {
            type: key,
            status: 'ready',
            titel,
            beschrijving: meta.beschrijving || '',
            icon: meta.icon || 'fileText',
            iconColor: meta.iconColor
        };
    }

    const status = doc.status === 'completed' || doc.status === 'geaccepteerd' ? 'done'
        : doc.status === 'generating' || doc.status === 'processing' ? 'generating'
            : doc.status === 'concept' ? 'done'
                : 'ready';

    // Speciale behandeling Go/No-Go (heeft score)
    if (key === 'go_no_go' && status === 'done') {
        const inhoud = doc.inhoud || doc.content || {};
        return {
            type: key,
            status: 'gonogo',
            titel,
            beschrijving: meta.beschrijving || '',
            icon: meta.icon || 'statusGo',
            score: inhoud.score || 0,
            verdictLabel: inhoud.aanbeveling || inhoud.verdict || 'Onbekend',
            winkans: inhoud.geschatte_winkans ? `Winkans: ${inhoud.geschatte_winkans}` : '',
            sterktePunten: inhoud.sterke_punten || inhoud.argumenten_go || [],
            risicos: inhoud.risicos || inhoud.argumenten_no_go || []
        };
    }

    return {
        type: key,
        status,
        titel,
        beschrijving: meta.beschrijving || '',
        icon: meta.icon || 'fileText',
        iconColor: meta.iconColor,
        generatedDate: doc.completed_at ? _formatDateNL(doc.completed_at) : '',
        generatingMeta: status === 'generating' ? 'Even geduld...' : ''
    };
}

// ============================================
// TRANSFORM — Documenten tab
// ============================================

function transformDocumenten(uploadedFiles, aiDocuments, smartImportData) {
    // ── Geüploade bestanden ──
    const uploaded = (Array.isArray(uploadedFiles) ? uploadedFiles : []).map((f, idx) => {
        const name = f.name || f.filename || f.original_name || `Document ${idx + 1}`;
        const ext = name.split('.').pop().toLowerCase();
        const type = ['pdf'].includes(ext) ? 'pdf' : ['xlsx', 'xls'].includes(ext) ? 'xlsx' : ['docx', 'doc'].includes(ext) ? 'docx' : ext;
        const sizeStr = f.size ? _formatFileSize(f.size) : '';
        const dateStr = f.uploaded_at ? _formatDateNL(f.uploaded_at) : '';
        const analyzed = smartImportData?.status === 'completed';

        return {
            id: f.id || `upload-${idx}`,
            naam: name,
            type,
            meta: [sizeStr, dateStr].filter(Boolean).join(' · '),
            tags: analyzed ? [{ type: 'analyzed', label: 'Geanalyseerd', icon: 'checkCircle', iconColor: '#16a34a' }] : []
        };
    });

    // ── Gegenereerde documenten ──
    const generated = aiDocuments
        .filter(d => d.status === 'completed' || d.status === 'concept' || d.status === 'geaccepteerd')
        .map(d => ({
            id: d.id,
            naam: d.titel || d.template_key || 'AI Document',
            icon: 'zap',
            meta: d.completed_at ? _formatDateNL(d.completed_at) : '',
            tags: [{ type: 'ai', label: 'AI Generatie', icon: 'zap', iconColor: '#7c3aed' }]
        }));

    return {
        badge: String(uploaded.length + generated.length),
        uploaded,
        generated
    };
}

// ============================================
// TRANSFORM — Workflow (slim op basis van beschikbare data)
// ============================================

// ============================================
// TRANSFORM — Team (tender toewijzingen + bureau leden)
// ============================================

function transformTeam(tender, bureauTeamMembers) {
    // Tender-specifieke toewijzingen
    const assignments = tender.tender_team_assignments || tender.team_members || [];

    // Standaard rollen voor een tender
    const allRoles = [
        { key: 'tendermanager', label: 'Tendermanager', icon: 'user', required: true },
        { key: 'schrijver', label: 'Schrijver', icon: 'edit', required: true },
        { key: 'calculator', label: 'Calculator', icon: 'barChart', required: false },
        { key: 'reviewer', label: 'Reviewer', icon: 'checkCircle', required: false },
        { key: 'designer', label: 'Designer', icon: 'fileText', required: false }
    ];

    // Bouw leden-array met gecombineerde info
    // Ondersteunt twee dataformaten:
    // 1. Genest: { team_member_id, rol_in_tender, team_member: { naam, email, ... } }
    // 2. Flat:   { team_member_id, rol_in_tender, naam, email, ... }
    const members = assignments.map(a => {
        const nested = a.team_member || {};
        const bureauInfo = bureauTeamMembers.find(
            bm => bm.id === (a.team_member_id || a.user_id)
        ) || {};

        const naam = a.naam || nested.naam || bureauInfo.naam || bureauInfo.email || 'Onbekend';
        const initialen = naam.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);

        return {
            id: a.team_member_id || a.user_id || a.id,
            assignment_id: a.id,
            naam: naam,
            email: a.email || nested.email || bureauInfo.email || '',
            initialen: initialen,
            rol: a.rol_in_tender || a.rol || 'schrijver',
            uren: a.geplande_uren || a.uren || a.geschatte_uren || 0,
            avatar_kleur: a.avatar_kleur || nested.avatar_kleur || bureauInfo.avatar_kleur || '#6366f1',
            functie_titel: a.functie_titel || nested.functie_titel || bureauInfo.functie_titel || ''
        };
    });

    // Bouw rolverdeling — welke rollen bezet/vacant
    const rolVerdeling = allRoles.map(role => {
        const assigned = members.filter(m => m.rol === role.key);
        return {
            ...role,
            assigned: assigned,
            vacant: assigned.length === 0
        };
    });

    const filledRoles = rolVerdeling.filter(r => !r.vacant).length;
    const requiredVacant = rolVerdeling.filter(r => r.required && r.vacant);

    // Beschikbare teamleden die nog niet toegewezen zijn
    const assignedIds = members.map(m => m.id);
    const available = bureauTeamMembers.filter(bm => !assignedIds.includes(bm.id));

    return {
        members: members,
        rolVerdeling: rolVerdeling,
        available: available,
        allRoles: allRoles,
        badge: members.length > 0 ? String(members.length) : '',
        filledRoles: filledRoles,
        totalRoles: allRoles.length,
        requiredVacant: requiredVacant,
        totalUren: members.reduce((sum, m) => sum + (m.uren || 0), 0)
    };
}

function buildWorkflowData(tender, smartImportData, aiDocuments) {
    const hasAnalyse = smartImportData?.status === 'completed';
    const hasPlanning = (tender._planningCounts?.total || 0) > 0;
    const hasChecklist = (tender._checklistCounts?.total || 0) > 0;

    // Document statussen checken
    const docsByKey = {};
    for (const d of aiDocuments) docsByKey[d.template_key] = d;

    const stappen = [
        {
            nummer: 0,
            titel: 'Tenderplanning',
            kortLabel: 'Planning',
            beschrijving: 'Extraheer deadlines en mijlpalen',
            status: hasAnalyse ? 'done' : 'pending',
            resultDate: smartImportData?.completed_at ? _formatDateNL(smartImportData.completed_at) : '',
            resultPreview: hasAnalyse ? `${smartImportData?.fields_extracted || 0} velden geëxtraheerd uit ${(smartImportData?.uploaded_files || []).length} document(en).` : ''
        },
        {
            nummer: 1,
            titel: 'Inlever Checklist',
            kortLabel: 'Checklist',
            beschrijving: 'Identificeer verplichte documenten',
            status: hasChecklist ? 'done' : (hasAnalyse ? 'active' : 'pending'),
            resultDate: hasChecklist ? '' : '',
            resultPreview: hasChecklist ? `${tender._checklistCounts.total} inleveritems geïdentificeerd.` : ''
        },
        {
            nummer: 2,
            titel: 'Tender Samenvatting',
            kortLabel: 'Samenvatting',
            beschrijving: 'Beknopt overzicht voor het team',
            status: docsByKey['samenvatting']?.status === 'completed' ? 'done' : (hasAnalyse ? 'active' : 'pending'),
            role: 'SUPERUSER',
            promptVersion: 'v1',
            promptDesc: 'Maak een beknopte samenvatting met kernpunten en eisen',
            tip: 'Tender naam, opdrachtgever en deadline worden automatisch ingevuld.',
            howto: [
                'Klik op "Copy Prompt"',
                'Open Claude.ai met je Pro account',
                'Upload je brondocumenten',
                'Paste de prompt en druk op Enter',
                'Wacht ~5 minuten',
                'Copy het resultaat en klik "Resultaat Opslaan"'
            ]
        },
        { nummer: 3, titel: 'Tenderofferte', kortLabel: 'Offerte', beschrijving: 'Professionele offerte', status: docsByKey['offerte']?.status === 'completed' ? 'done' : 'pending', promptDesc: 'Genereer offerte op basis van pricing strategieën' },
        { nummer: 4, titel: 'Rode Draad Sessie', kortLabel: 'Rode Draad', beschrijving: 'Kick-off document', status: docsByKey['rode_draad']?.status === 'completed' ? 'done' : 'pending', promptDesc: 'Rode-draad-sessie met alle kritieke info' },
        { nummer: 5, titel: 'Versie 1 Concept', kortLabel: 'Versie 1', beschrijving: 'Eerste concept inschrijving', status: docsByKey['versie1_inschrijving']?.status === 'completed' ? 'done' : 'pending', promptDesc: 'Schrijf eerste concept' },
        { nummer: 6, titel: 'Check op Win Succes', kortLabel: 'Win Check', beschrijving: 'Feedback voor hogere winstkans', status: docsByKey['win_check']?.status === 'completed' ? 'done' : 'pending', promptDesc: 'Win/no-go analyse op criteria' }
    ];

    // Eerste 'active' stap bepalen (eerste niet-done stap)
    let foundActive = false;
    for (const stap of stappen) {
        if (stap.status === 'done') continue;
        if (!foundActive) {
            stap.status = 'active';
            foundActive = true;
        } else {
            stap.status = 'pending';
        }
    }

    const doneCount = stappen.filter(s => s.status === 'done').length;

    return {
        badge: `${doneCount}/${stappen.length}`,
        stappen
    };
}

// ============================================
// FORMAT HELPERS
// ============================================

function _formatFase(fase) {
    if (!fase) return 'Onbekend';
    return fase.charAt(0).toUpperCase() + fase.slice(1).replace(/_/g, ' ');
}

function _formatDeadlineShort(deadline) {
    if (!deadline) return '';
    try {
        const d = new Date(deadline);
        if (isNaN(d)) return deadline;
        const dag = d.getDate();
        const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        return `${dag} ${maanden[d.getMonth()]}`;
    } catch { return deadline; }
}

function _formatDateNL(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const dag = d.getDate();
        const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        return `${dag} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return dateStr; }
}

function _formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _daysUntil(date) {
    const now = new Date();
    const diff = date - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============================================
// RENDER — Hoofdcomponent
// ============================================

function renderTcc() {
    // Verwijder eventueel bestaand TCC
    const existing = document.querySelector('.tcc-overlay');
    if (existing) existing.remove();

    const data = tccState.data;

    const overlay = document.createElement('div');
    overlay.className = 'tcc-overlay';
    overlay.innerHTML = `
        <div class="tcc-panel">
            ${renderTccHeader(data)}
            <div class="tcc-body">
                ${renderTabAI(data)}
                ${renderTabPlanning(data)}
                ${renderTabChecklist(data)}
                ${renderTabTeam(data)}
                ${renderTabDocs(data)}
                ${renderTabWorkflow(data)}
            </div>
            ${renderTccFooter()}
        </div>
    `;

    // Overlay klik = sluiten
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCommandCenter();
    });

    document.body.appendChild(overlay);
    tccState.overlay = overlay;

    // Bind events
    bindTccEvents(overlay);

    // Footer updaten voor initiële tab
    updateTccFooter(tccState.activeTab || 'ai');

    // ⭐ Bridge: als TCC opent op planning/checklist tab, laad PlanningModal content
    if (tccState.activeTab === 'planning' || tccState.activeTab === 'checklist') {
        bridgePlanningToTcc(tccState.activeTab);
    }
}

// ============================================
// RENDER — Header met tabs
// ============================================

function renderTccHeader(data) {
    const tender = data.tender || {};
    const analyse = data.analyse || {};
    const planning = data.planning || {};
    const checklist = data.checklist || {};
    const team = data.team || {};
    const docs = data.documenten || {};
    const workflow = data.workflow || {};

    return `
    <div class="tcc-header">
        <div class="tcc-header-top">
            <div class="tcc-header-left">
                <div class="tcc-header-icon">${TccIcons.sparkles(22, '#ffffff')}</div>
                <div class="tcc-header-info">
                    <h2>${escHtml(tender.naam || 'Tender')}</h2>
                    <div class="tcc-header-meta">
                        <span class="tcc-meta-tag tcc-meta-tag--fase">
                            ${tccIcon('folderOpen', 13, '#92400e')} ${escHtml(tender.fase || 'Onbekend')}
                        </span>
                        ${tender.aiModel ? `<span class="tcc-meta-tag tcc-meta-tag--model">
                            ${tccIcon('robot', 13, '#4338ca')} ${escHtml(tender.aiModel)}
                        </span>` : ''}
                        ${tender.deadline ? `<span class="tcc-meta-tag tcc-meta-tag--date">
                            ${tccIcon('clock', 13, '#dc2626')} ${escHtml(tender.deadline)}
                        </span>` : ''}
                    </div>
                </div>
            </div>
            <button class="tcc-close-btn" data-action="close">
                ${tccIcon('close', 16, '#64748b')}
            </button>
        </div>
        <div class="tcc-tabs">
            ${renderTab('ai', 'sparkles', 'AI Analyse', analyse.badge || '', 'score')}
            ${renderTab('planning', 'calendar', 'Planning', planning.badge || '', 'count')}
            ${renderTab('checklist', 'checkSquare', 'Checklist', checklist.badge || '', 'warn')}
            ${renderTab('team', 'users', 'Team', team.badge || '', 'count')}
            ${renderTab('docs', 'fileText', 'Documenten', docs.badge || '', 'docs')}
            ${renderTab('workflow', 'refresh', 'Workflow', workflow.badge || '', 'wf')}
        </div>
    </div>`;
}

function renderTab(id, icon, label, badge, badgeType) {
    const isActive = tccState.activeTab === id;
    const iconMap = {
        sparkles: () => TccIcons.sparkles(16),
        calendar: () => tccIcon('calendarView', 16),
        checkSquare: () => TccIcons.checkSquare(16),
        users: () => tccIcon('users', 16),
        fileText: () => tccIcon('fileText', 16),
        refresh: () => tccIcon('refresh', 16)
    };
    const iconHtml = iconMap[icon] ? iconMap[icon]() : tccIcon(icon, 16);

    return `
    <button class="tcc-tab${isActive ? ' is-active' : ''}" data-tab="${id}">
        <span class="tcc-icon">${iconHtml}</span> ${label}
        ${badge ? `<span class="tcc-tab-badge tcc-tab-badge--${badgeType}">${badge}</span>` : ''}
    </button>`;
}

// ============================================
// RENDER — Tab 1: AI Analyse (met sub-toggle)
// ============================================

function renderTabAI(data) {
    const analyse = data.analyse || {};
    const generatie = data.generatie || {};

    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'ai' ? ' is-active' : ''}" data-panel="ai">
        <div class="tcc-subnav">
            <button class="tcc-subnav-btn is-active" data-sub="analyse">
                ${tccIcon('barChart', 15)} Analyse Resultaten
                ${analyse.badge ? `<span class="tcc-subnav-badge tcc-subnav-badge--score">${analyse.badge}</span>` : ''}
            </button>
            <button class="tcc-subnav-btn" data-sub="generatie">
                ${tccIcon('zap', 15)} AI Generatie
                ${generatie.badge ? `<span class="tcc-subnav-badge tcc-subnav-badge--ai">${generatie.badge}</span>` : ''}
            </button>
        </div>
        
        <!-- Sub: Analyse Resultaten -->
        <div class="tcc-subpanel is-active" data-sub="analyse">
            ${renderScoreBar(analyse)}
            ${renderAnalyseSections(analyse.secties || [])}
        </div>
        
        <!-- Sub: AI Generatie -->
        <div class="tcc-subpanel" data-sub="generatie">
            <div class="tcc-aidoc-grid">
                ${(generatie.documenten || []).map(doc => renderAiDocCard(doc)).join('')}
            </div>
        </div>
    </div>`;
}

function renderScoreBar(analyse) {
    const pct = analyse.percentage || 0;
    const filled = analyse.filled || 0;
    const total = analyse.total || 0;
    const circumference = 2 * Math.PI * 17; // r=17
    const offset = circumference - (pct / 100) * circumference;

    const highCount = analyse.confidenceHigh || 0;
    const medCount = analyse.confidenceMedium || 0;

    return `
    <div class="tcc-score-bar">
        <div class="tcc-score-item">
            <div class="tcc-score-ring">
                <svg width="42" height="42" viewBox="0 0 42 42">
                    <circle class="ring-bg" cx="21" cy="21" r="17"/>
                    <circle class="ring-fill" cx="21" cy="21" r="17" 
                        stroke-dasharray="${circumference.toFixed(1)}" 
                        stroke-dashoffset="${offset.toFixed(1)}"/>
                </svg>
                <span class="tcc-score-value">${pct}%</span>
            </div>
            <div class="tcc-score-label"><strong>${filled}/${total}</strong>velden</div>
        </div>
        <div class="tcc-score-divider"></div>
        <div class="tcc-conf-badges">
            ${highCount ? `<span class="tcc-conf-badge tcc-conf-badge--high"><span class="tcc-conf-dot tcc-conf-dot--high"></span> ${highCount} hoog</span>` : ''}
            ${medCount ? `<span class="tcc-conf-badge tcc-conf-badge--medium"><span class="tcc-conf-dot tcc-conf-dot--medium"></span> ${medCount} gemiddeld</span>` : ''}
        </div>
    </div>`;
}

function renderAnalyseSections(secties) {
    return secties.map((sectie, idx) => {
        const isOpen = idx === 0; // Eerste sectie standaard open
        return `
        <div class="tcc-section${isOpen ? ' is-open' : ''}">
            <div class="tcc-section-header" data-action="toggle-section">
                <div class="tcc-section-header-left">
                    <div class="tcc-section-icon">${tccIcon(sectie.icon || 'clipboardList', 16)}</div>
                    <span class="tcc-section-title">${escHtml(sectie.titel)}</span>
                    <span class="tcc-section-count">${escHtml(sectie.count || '')}</span>
                </div>
                <div class="tcc-section-header-right">
                    ${sectie.status ? `<span class="tcc-section-status tcc-section-status--${sectie.statusType || 'complete'}">${escHtml(sectie.status)}</span>` : ''}
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 16)}</span>
                </div>
            </div>
            <div class="tcc-section-body">
                ${renderSectionContent(sectie)}
            </div>
        </div>`;
    }).join('');
}

function renderSectionContent(sectie) {
    switch (sectie.type) {
        case 'grid':
            return renderDataGrid(sectie.velden || []);
        case 'timeline':
            return renderTimeline(sectie.items || []);
        case 'criteria':
            return renderCriteriaTable(sectie.criteria || []);
        case 'percelen':
            return renderPercelen(sectie.percelen || []);
        case 'warnings':
            return renderWarnings(sectie.items || []);
        default:
            return renderDataGrid(sectie.velden || []);
    }
}

function renderDataGrid(velden) {
    return `<div class="tcc-grid">
        ${velden.map(v => `
            <div class="tcc-field">
                <div class="tcc-field-label">
                    <span class="tcc-conf-dot tcc-conf-dot--${v.confidence || 'high'}"></span>
                    ${escHtml(v.label)}
                </div>
                <div class="tcc-field-value">${escHtml(v.value || '—')}</div>
            </div>
        `).join('')}
    </div>`;
}

function renderTimeline(items) {
    return `<div class="tcc-timeline">
        ${items.map(item => `
            <div class="tcc-timeline-item">
                <div class="tcc-timeline-dot tcc-timeline-dot--${item.dotType || 'filled'}">
                    ${tccIcon(item.icon || 'clock', 14, item.iconColor || undefined)}
                </div>
                <div class="tcc-timeline-info">
                    <div class="tcc-timeline-label">${escHtml(item.label)}</div>
                    <div class="tcc-timeline-date${item.urgent ? ' tcc-timeline-date--urgent' : ''}">
                        ${escHtml(item.date)}
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;
}

function renderCriteriaTable(criteria) {
    return `<table class="tcc-criteria-table">
        <thead><tr><th>Criterium</th><th>Weging</th></tr></thead>
        <tbody>
            ${criteria.map(c => `
                <tr>
                    <td><strong>${escHtml(c.naam)}</strong></td>
                    <td>
                        <div class="tcc-weight-bar">
                            <div class="tcc-weight-track">
                                <div class="tcc-weight-fill" style="width:${c.weging}%"></div>
                            </div>
                            <span class="tcc-weight-pct">${c.weging}%</span>
                        </div>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

function renderPercelen(percelen) {
    return `<div class="tcc-percelen-list">
        ${percelen.map((p, i) => `
            <div class="tcc-perceel-card">
                <div class="tcc-perceel-header" data-action="toggle-perceel">
                    <div class="tcc-perceel-header-left">
                        <div class="tcc-perceel-nr">${i + 1}</div>
                        <span class="tcc-perceel-name">${escHtml(p.naam)}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        ${p.bedrag ? `<span style="font-size:12px;color:#64748b">${escHtml(p.bedrag)}</span>` : ''}
                        <span class="tcc-perceel-chevron">${tccIcon('chevronDown', 14)}</span>
                    </div>
                </div>
                <div class="tcc-perceel-body">${escHtml(p.beschrijving || '')}</div>
            </div>
        `).join('')}
    </div>`;
}

function renderWarnings(items) {
    return `<div class="tcc-warnings-list">
        ${items.map(w => {
        const typeClass = w.type === 'warn' ? 'warn' : w.type === 'tip' ? 'tip' : 'info';
        const iconName = w.type === 'warn' ? 'warning' : w.type === 'tip' ? 'lightbulb' : 'info';
        const iconColor = w.type === 'warn' ? '#ea580c' : w.type === 'tip' ? '#16a34a' : '#4338ca';
        return `
            <div class="tcc-warning-item tcc-warning-item--${typeClass}">
                ${tccIcon(iconName, 14, iconColor)} ${escHtml(w.tekst)}
            </div>`;
    }).join('')}
    </div>`;
}

// ============================================
// RENDER — AI Generatie Cards
// ============================================

function renderAiDocCard(doc) {
    const statusMap = {
        done: renderAiDocDone,
        ready: renderAiDocReady,
        generating: renderAiDocGenerating,
        gonogo: renderAiDocGoNoGo
    };

    const renderBody = statusMap[doc.status] || renderAiDocReady;

    return `
    <div class="tcc-aidoc-card">
        <div class="tcc-aidoc-card-header">
            <div class="tcc-aidoc-card-icon tcc-aidoc-card-icon--${doc.type || 'samenvatting'}">
                ${tccIcon(doc.icon || 'fileText', 24, doc.iconColor || undefined)}
            </div>
            <div class="tcc-aidoc-card-info">
                <div class="tcc-aidoc-card-title">${escHtml(doc.titel)}</div>
                <div class="tcc-aidoc-card-desc">${escHtml(doc.beschrijving || '')}</div>
            </div>
        </div>
        <div class="tcc-aidoc-card-body">
            ${renderBody(doc)}
        </div>
    </div>`;
}

function renderAiDocGoNoGo(doc) {
    const score = doc.score || 0;
    const verdict = score >= 60 ? 'GO' : score >= 40 ? 'MAYBE' : 'NO-GO';
    const verdictLabel = doc.verdictLabel || `${verdict} — ${doc.verdictSub || ''}`;
    const bgColor = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

    return `
    <div class="tcc-gonogo-verdict" style="background: ${score >= 60 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#fef2f2'}; border-color: ${score >= 60 ? '#bbf7d0' : score >= 40 ? '#fde68a' : '#fecaca'}">
        <div class="tcc-gonogo-score" style="background:${bgColor}">${score}</div>
        <div class="tcc-gonogo-info">
            <div class="tcc-gonogo-label" style="color:${score >= 60 ? '#166534' : score >= 40 ? '#92400e' : '#991b1b'}">${escHtml(verdictLabel)}</div>
            <div class="tcc-gonogo-sublabel">${escHtml(doc.winkans || '')}</div>
        </div>
    </div>
    ${doc.sterktePunten || doc.risicos ? `
    <div class="tcc-gonogo-details">
        ${doc.sterktePunten ? `<div class="tcc-gonogo-detail">
            <div class="tcc-gonogo-detail-label">${tccIcon('checkCircle', 12)} Sterk</div>
            <ul>${doc.sterktePunten.map(s => `<li>${tccIcon('check', 11)} ${escHtml(s)}</li>`).join('')}</ul>
        </div>` : ''}
        ${doc.risicos ? `<div class="tcc-gonogo-detail">
            <div class="tcc-gonogo-detail-label">${tccIcon('warning', 12)} Risico's</div>
            <ul>${doc.risicos.map(r => `<li>${tccIcon('warning', 11, '#ea580c')} ${escHtml(r)}</li>`).join('')}</ul>
        </div>` : ''}
    </div>` : ''}
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-regenerate" data-type="${doc.type}">${tccIcon('refresh', 13)} Opnieuw</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-copy" data-type="${doc.type}">${tccIcon('copy', 13)} Kopieer</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-download" data-type="${doc.type}">${tccIcon('download', 13)} Download</button>
    </div>`;
}

function renderAiDocReady(doc) {
    return `
    <div class="tcc-aidoc-status tcc-aidoc-status--ready">
        ${tccIcon('clipboardList', 16)}
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Nog niet gegenereerd</div>
        </div>
    </div>
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--primary tcc-btn--sm" data-action="ai-generate" data-type="${doc.type}">
            ${tccIcon('zap', 13, '#ffffff')} Genereer
        </button>
    </div>`;
}

function renderAiDocGenerating(doc) {
    return `
    <div class="tcc-aidoc-status tcc-aidoc-status--generating">
        <div class="tcc-spinner"></div>
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Bezig met genereren…</div>
            <div class="tcc-aidoc-status-meta">${escHtml(doc.generatingMeta || 'Even geduld')}</div>
        </div>
    </div>`;
}

function renderAiDocDone(doc) {
    return `
    <div class="tcc-aidoc-status" style="background:#f0fdf4;border:1px solid #bbf7d0;">
        ${tccIcon('checkCircle', 16)}
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Gegenereerd</div>
            <div class="tcc-aidoc-status-meta">${escHtml(doc.generatedDate || '')}</div>
        </div>
    </div>
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-view" data-type="${doc.type}">${tccIcon('eye', 13)} Bekijk</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-regenerate" data-type="${doc.type}">${tccIcon('refresh', 13)} Opnieuw</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-download" data-type="${doc.type}">${tccIcon('download', 13)} Download</button>
    </div>`;
}

// ============================================
// RENDER — Tab 2: Planning
// ============================================

function renderTabPlanning(data) {
    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'planning' ? ' is-active' : ''}" data-panel="planning">
        <div class="planning-modal-container tcc-bridge-host" style="position:relative;display:flex;flex-direction:column;height:100%;">
            <div class="tcc-bridge-loading" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 20px;color:#94a3b8;font-size:14px;">
                <div class="planning-spinner"></div>
                <span>Projectplanning laden...</span>
            </div>
        </div>
    </div>`;
}

function renderPlanningTaken(taken) {
    return taken.map(item => {
        if (item.type === 'phase') {
            return `
            <div class="tcc-task-phase-row">
                <span class="tcc-task-phase-label" style="background:${item.bgColor || '#eef2ff'};color:${item.textColor || '#4338ca'};">
                    ${escHtml(item.naam)}
                </span>
                <div class="tcc-task-phase-line"></div>
            </div>`;
        }

        const statusClass = item.status === 'done' ? 'tcc-task-status--done'
            : item.status === 'progress' ? 'tcc-task-status--progress' : '';
        const statusIcon = item.status === 'done' ? tccIcon('check', 12, '#ffffff')
            : item.status === 'progress' ? TccIcons.play(10, '#4f46e5') : '';

        return `
        <div class="tcc-task">
            <div class="tcc-task-status ${statusClass}">${statusIcon}</div>
            <div class="tcc-task-info">
                <div class="tcc-task-name${item.status === 'done' ? ' tcc-task-name--done' : ''}">${escHtml(item.naam)}</div>
                <div class="tcc-task-detail">
                    ${item.avatar ? `<span class="tcc-task-avatar" style="background:${item.avatarColor || '#3b82f6'}">${escHtml(item.avatar)}</span>` : ''}
                    <span>${escHtml(item.detail || '')}</span>
                </div>
            </div>
            ${item.deadline ? `
            <span class="tcc-task-date${item.overdue ? ' tcc-task-date--overdue' : ''}">
                ${tccIcon('clock', 12, item.overdue ? '#dc2626' : undefined)} ${escHtml(item.deadline)}
            </span>` : ''}
        </div>`;
    }).join('');
}

// ============================================
// RENDER — Tab 3: Checklist
// ============================================

function renderTabChecklist(data) {
    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'checklist' ? ' is-active' : ''}" data-panel="checklist">
        <div class="planning-modal-container tcc-bridge-host" style="position:relative;display:flex;flex-direction:column;height:100%;">
            <div class="tcc-bridge-loading" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 20px;color:#94a3b8;font-size:14px;">
                <div class="planning-spinner"></div>
                <span>Indieningschecklist laden...</span>
            </div>
        </div>
    </div>`;
}

function renderCheckGroup(groep) {
    return `
    <div class="tcc-check-group">
        <div class="tcc-check-group-header">
            ${tccIcon(groep.icon || 'fileText', 14)} ${escHtml(groep.titel)}
        </div>
        ${(groep.items || []).map(item => `
            <div class="tcc-check-item">
                <div class="tcc-check-box${item.done ? ' tcc-check-box--done' : ''}" data-action="toggle-check" data-item-id="${item.id || ''}">
                    ${item.done ? tccIcon('check', 12, '#ffffff') : ''}
                </div>
                <div class="tcc-check-info">
                    <div class="tcc-check-name${item.done ? ' tcc-check-name--done' : ''}">${escHtml(item.naam)}</div>
                    ${item.beschrijving ? `<div class="tcc-check-desc">${escHtml(item.beschrijving)}</div>` : ''}
                </div>
                ${!item.done && item.uploadable ? `
                <span class="tcc-check-action tcc-check-action--upload" data-action="check-upload" data-item-id="${item.id || ''}">
                    ${tccIcon('upload', 11, '#4338ca')} Upload
                </span>` : ''}
            </div>
        `).join('')}
    </div>`;
}

// ============================================
// RENDER — Tab: Team
// ============================================

function renderTabTeam(data) {
    const team = data.team || {};
    const members = team.members || [];
    const rolVerdeling = team.rolVerdeling || [];
    const available = team.available || [];
    const allRoles = team.allRoles || [];

    // ── Teamleden kaarten ──
    const memberCardsHtml = members.length > 0
        ? members.map(m => `
            <div class="tcc-team-card" data-member-id="${m.id}">
                <div class="tcc-team-card-avatar" style="background:${m.avatar_kleur};">
                    ${m.initialen}
                </div>
                <div class="tcc-team-card-info">
                    <div class="tcc-team-card-naam">${escHtml(m.naam)}</div>
                    <div class="tcc-team-card-rol">${escHtml(_rolLabel(m.rol))}</div>
                    ${m.uren > 0 ? `<div class="tcc-team-card-uren">${m.uren} uur</div>` : ''}
                </div>
                <button class="tcc-team-card-remove" data-action="team-remove" data-member-id="${m.id}" title="Verwijderen">
                    ${tccIcon('close', 12, '#94a3b8')}
                </button>
            </div>
        `).join('')
        : `<div class="tcc-team-empty">
            ${tccIcon('users', 20, '#cbd5e1')}
            <span>Nog geen teamleden toegewezen</span>
           </div>`;

    // ── Rolverdeling ──
    const rolHtml = rolVerdeling.map(r => {
        const assignedNames = r.assigned.map(a => escHtml(a.naam)).join(', ');
        const statusIcon = r.vacant
            ? (r.required ? `<span class="tcc-team-rol-status tcc-team-rol-status--warn">${tccIcon('warning', 12, '#f59e0b')} Vacant</span>` : `<span class="tcc-team-rol-status tcc-team-rol-status--empty">—</span>`)
            : `<span class="tcc-team-rol-status tcc-team-rol-status--ok">${tccIcon('check', 12, '#16a34a')}</span>`;

        return `
        <div class="tcc-team-rol-row${r.vacant && r.required ? ' tcc-team-rol-row--warn' : ''}">
            <div class="tcc-team-rol-label">
                ${tccIcon(r.icon, 14, r.vacant ? '#94a3b8' : '#475569')}
                <span>${escHtml(r.label)}</span>
                ${r.required ? '<span class="tcc-team-rol-req">*</span>' : ''}
            </div>
            <div class="tcc-team-rol-assigned">
                ${r.vacant ? '<span style="color:#94a3b8;font-style:italic;">Niet toegewezen</span>' : assignedNames}
            </div>
            ${statusIcon}
        </div>`;
    }).join('');

    // ── Waarschuwing als verplichte rollen vacant ──
    const requiredVacant = team.requiredVacant || [];
    const warningHtml = requiredVacant.length > 0 ? `
        <div class="tcc-team-warning">
            ${tccIcon('warning', 14, '#f59e0b')}
            <span><strong>${requiredVacant.length} verplichte ${requiredVacant.length === 1 ? 'rol' : 'rollen'}</strong> niet ingevuld: 
            ${requiredVacant.map(r => r.label).join(', ')}. 
            Dit beïnvloedt de backplanning toewijzingen.</span>
        </div>` : '';

    // ── Teamlid toevoegen form ──
    const addFormHtml = `
        <div class="tcc-team-add" id="tcc-team-add-form" style="display:none;">
            <div class="tcc-team-add-row">
                <select class="tcc-team-add-select" id="tcc-team-add-member">
                    <option value="">— Selecteer teamlid —</option>
                    ${available.map(a => `
                        <option value="${a.id}">${escHtml(a.naam || a.email)} ${a.rol ? `(${a.rol})` : ''}</option>
                    `).join('')}
                </select>
                <select class="tcc-team-add-select tcc-team-add-select--rol" id="tcc-team-add-rol">
                    ${allRoles.map(r => `
                        <option value="${r.key}">${escHtml(r.label)}</option>
                    `).join('')}
                </select>
                <input type="number" class="tcc-team-add-uren" id="tcc-team-add-uren" placeholder="Uren" min="0" value="0" />
                <button class="tcc-btn tcc-btn--primary tcc-btn--sm" data-action="team-add-confirm">
                    ${tccIcon('check', 12, '#ffffff')} Toevoegen
                </button>
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="team-add-cancel">
                    Annuleren
                </button>
            </div>
        </div>`;

    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'team' ? ' is-active' : ''}" data-panel="team">
        <div class="tcc-team-container">

            ${warningHtml}

            <!-- Teamleden -->
            <div class="tcc-section is-open">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('users', 16)} 
                    <span>Teamleden</span>
                    <span class="tcc-section-count">${members.length}</span>
                    ${team.totalUren > 0 ? `<span class="tcc-section-meta">Totaal: ${team.totalUren} uur</span>` : ''}
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div class="tcc-team-grid">
                        ${memberCardsHtml}
                    </div>
                    ${addFormHtml}
                </div>
            </div>

            <!-- Rolverdeling -->
            <div class="tcc-section is-open">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('clipboardList', 16)}
                    <span>Rolverdeling</span>
                    <span class="tcc-section-count">${team.filledRoles}/${team.totalRoles}</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div class="tcc-team-rol-list">
                        ${rolHtml}
                    </div>
                </div>
            </div>

            <!-- Workload -->
            <div class="tcc-section is-open">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('barChart', 16)}
                    <span>Workload</span>
                    <span class="tcc-section-meta">Komende 4 weken</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div id="tcc-team-workload" class="tcc-team-workload-container">
                        <div style="display:flex;align-items:center;gap:8px;padding:20px;color:#94a3b8;font-size:13px;">
                            <div class="planning-spinner" style="width:16px;height:16px;border-width:2px;"></div>
                            Workload laden...
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toewijzingscriteria -->
            <div class="tcc-section">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('info', 16)}
                    <span>Toewijzingscriteria</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div class="tcc-team-criteria">
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#eef2ff;color:#4338ca;">${tccIcon('user', 14)}</div>
                            <div>
                                <strong>Rol-gebaseerd</strong>
                                <p>Elke taak in het template heeft een rol (schrijver, reviewer, etc.). Het teamlid met die rol krijgt de taak automatisch toegewezen.</p>
                            </div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#fef3c7;color:#92400e;">${tccIcon('users', 14)}</div>
                            <div>
                                <strong>Gedeelde verantwoordelijkheid</strong>
                                <p>Als meerdere teamleden dezelfde rol hebben, worden zij <em>allemaal</em> aan de taak gekoppeld. De eerste is primair verantwoordelijk, de rest volgt en controleert.</p>
                            </div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#f0fdf4;color:#166534;">${tccIcon('calendarView', 14)}</div>
                            <div>
                                <strong>Volgorde & Deadlines</strong>
                                <p>Taken worden terugwaarts gepland vanaf de indiendatum. Weekenden en feestdagen worden automatisch overgeslagen. Taken in dezelfde categorie lopen parallel.</p>
                            </div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#fef2f2;color:#dc2626;">${tccIcon('warning', 14)}</div>
                            <div>
                                <strong>Vacante rollen</strong>
                                <p>Als een rol niet is ingevuld, worden taken van die rol <em>zonder toewijzing</em> aangemaakt. Vul het team aan vóór het backplannen voor het beste resultaat.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>`;
}

function _rolLabel(rol) {
    const labels = {
        tendermanager: 'Tendermanager',
        schrijver: 'Schrijver',
        calculator: 'Calculator',
        reviewer: 'Reviewer',
        designer: 'Designer'
    };
    return labels[rol] || rol || 'Onbekend';
}

// ============================================
// RENDER — Tab 4: Documenten
// ============================================

function renderTabDocs(data) {
    const docs = data.documenten || {};

    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'docs' ? ' is-active' : ''}" data-panel="docs">
        <!-- Aanbestedingsstukken -->
        <div class="tcc-docs-section-title">
            <div class="tcc-docs-section-icon tcc-docs-section-icon--upload">
                ${TccIcons.folderOpen(20)}
            </div>
            <div class="tcc-docs-section-info">
                <h3>Aanbestedingsstukken</h3>
                <p>Upload alle relevante documenten voor deze tender</p>
            </div>
            <span class="tcc-docs-section-badge tcc-docs-section-badge--upload">
                ${(docs.uploaded || []).length} documenten
            </span>
        </div>

        <!-- Upload zone -->
        <div class="tcc-upload-zone" data-action="upload-zone">
            <div class="tcc-upload-icon-wrap">${tccIcon('upload', 24)}</div>
            <div class="tcc-upload-title">Sleep bestanden hierheen of klik om te uploaden</div>
            <div class="tcc-upload-desc">Upload de aanbestedingsleidraad en andere relevante documenten</div>
            <div class="tcc-upload-formats">PDF, Word, Excel · Max 10MB per bestand</div>
        </div>

        <div class="tcc-upload-tip">
            ${TccIcons.lightbulb(14)} Tip: Upload minimaal de Aanbestedingsleidraad. Hoe meer documenten, hoe beter de AI kan helpen.
        </div>

        <div class="tcc-file-list">
            ${(docs.uploaded || []).map(f => renderFileItem(f)).join('')}
        </div>

        <!-- Divider -->
        <div class="tcc-docs-divider"></div>

        <!-- Gegenereerde documenten -->
        <div class="tcc-docs-section-title">
            <div class="tcc-docs-section-icon tcc-docs-section-icon--generated">
                ${tccIcon('zap', 20, '#16a34a')}
            </div>
            <div class="tcc-docs-section-info">
                <h3>Gegenereerde Documenten</h3>
                <p>AI-gegenereerde documenten en workflow resultaten</p>
            </div>
            <span class="tcc-docs-section-badge tcc-docs-section-badge--generated">
                ${(docs.generated || []).length} documenten
            </span>
        </div>

        <div class="tcc-file-list">
            ${(docs.generated || []).map(f => renderFileItem(f, true)).join('')}
        </div>

        ${(docs.generated || []).length === 0 ? `
        <div class="tcc-empty-hint">
            Meer documenten genereren? Ga naar <a data-action="goto-tab" data-target="ai" data-sub="generatie">AI Generatie</a> of <a data-action="goto-tab" data-target="workflow">Workflow</a>.
        </div>` : ''}
    </div>`;
}

function renderFileItem(file, isGenerated = false) {
    const extClass = file.type === 'pdf' ? 'pdf' : file.type === 'xlsx' ? 'xlsx' : file.type === 'docx' ? 'docx' : isGenerated ? 'ai' : 'pdf';
    const iconColor = file.type === 'pdf' ? '#dc2626' : file.type === 'xlsx' ? '#16a34a' : file.type === 'docx' ? '#2563eb' : undefined;

    return `
    <div class="tcc-file-item">
        <div class="tcc-file-icon tcc-file-icon--${extClass}">
            ${isGenerated && !file.type ? tccIcon(file.icon || 'statusGo', 20) : tccIcon('fileText', 20, iconColor)}
        </div>
        <div class="tcc-file-info">
            <div class="tcc-file-name">${escHtml(file.naam)}</div>
            <div class="tcc-file-meta">
                <span>${escHtml(file.meta || '')}</span>
                ${(file.tags || []).map(tag => `
                    <span class="tcc-file-tag tcc-file-tag--${tag.type || 'source'}">
                        ${tag.icon ? tccIcon(tag.icon, 10, tag.iconColor) : ''} ${escHtml(tag.label)}
                    </span>
                `).join('')}
            </div>
        </div>
        <div class="tcc-file-actions">
            <span class="tcc-file-action" data-action="file-view" data-file-id="${file.id || ''}">${tccIcon('eye', 14)}</span>
            <span class="tcc-file-action" data-action="file-download" data-file-id="${file.id || ''}">${tccIcon('download', 14)}</span>
            ${!isGenerated ? `<span class="tcc-file-action tcc-file-action--danger" data-action="file-delete" data-file-id="${file.id || ''}">${tccIcon('trash', 14)}</span>` :
            `<span class="tcc-file-action" data-action="file-refresh" data-file-id="${file.id || ''}">${tccIcon('refresh', 14)}</span>`}
        </div>
    </div>`;
}

// ============================================
// RENDER — Tab 5: Workflow
// ============================================

function renderTabWorkflow(data) {
    const workflow = data.workflow || {};
    const stappen = workflow.stappen || [];

    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'workflow' ? ' is-active' : ''}" data-panel="workflow">
        <!-- Progress bar -->
        <div class="tcc-wf-progress">
            ${renderWorkflowProgress(stappen)}
        </div>
        
        <!-- Stappen -->
        ${stappen.map(stap => renderWorkflowStep(stap)).join('')}
    </div>`;
}

function renderWorkflowProgress(stappen) {
    return stappen.map((stap, idx) => {
        const dotClass = stap.status === 'done' ? 'done' : stap.status === 'active' ? 'active' : 'pending';
        const dotContent = stap.status === 'done' ? tccIcon('check', 14, '#ffffff') : stap.nummer;
        const line = idx < stappen.length - 1
            ? `<div class="tcc-wf-progress-line${stap.status === 'done' ? ' tcc-wf-progress-line--done' : ''}"></div>`
            : '';
        return `
        <div class="tcc-wf-progress-step">
            <div class="tcc-wf-progress-dot tcc-wf-progress-dot--${dotClass}">${dotContent}</div>
            <div class="tcc-wf-progress-label">${escHtml(stap.kortLabel || stap.titel)}</div>
        </div>${line}`;
    }).join('');
}

function renderWorkflowStep(stap) {
    const statusClass = stap.status === 'done' ? 'done' : stap.status === 'active' ? 'active' : 'pending';
    const isOpen = stap.status === 'active';
    const badgeText = stap.status === 'done' ? 'Afgerond' : stap.status === 'active' ? 'Volgende stap' : 'Wachtend';
    const badgeIcon = stap.status === 'done' ? tccIcon('check', 11, '#16a34a') : stap.status === 'active' ? TccIcons.play(11, '#4338ca') : '';

    return `
    <div class="tcc-wf-step tcc-wf-step--${statusClass}${isOpen ? ' is-open' : ''}">
        <div class="tcc-wf-step-header" data-action="toggle-wf-step">
            <div class="tcc-wf-step-num">${stap.nummer}</div>
            <div class="tcc-wf-step-info">
                <div class="tcc-wf-step-title">${escHtml(stap.titel)}</div>
                <div class="tcc-wf-step-desc">${escHtml(stap.beschrijving || '')}</div>
            </div>
            <span class="tcc-wf-step-badge tcc-wf-step-badge--${statusClass}">
                ${badgeIcon} ${badgeText}
            </span>
            <span class="tcc-wf-step-chevron">${tccIcon('chevronDown', 16)}</span>
        </div>
        <div class="tcc-wf-step-body">
            ${stap.status === 'done' ? renderWfStepDone(stap) : renderWfStepActive(stap)}
        </div>
    </div>`;
}

function renderWfStepDone(stap) {
    return `
    <div class="tcc-wf-result">
        <div class="tcc-wf-result-header">
            ${tccIcon('checkCircle', 14)}
            <span class="tcc-wf-result-label">Opgeslagen</span>
            <span class="tcc-wf-result-date">${escHtml(stap.resultDate || '')}</span>
        </div>
        <div class="tcc-wf-result-preview">${escHtml(stap.resultPreview || '')}</div>
    </div>
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="wf-view" data-step="${stap.nummer}">${tccIcon('eye', 13)} Bekijk</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="wf-redo" data-step="${stap.nummer}">${tccIcon('refresh', 13)} Opnieuw</button>
    </div>`;
}

function renderWfStepActive(stap) {
    const isSuperuser = stap.role === 'SUPERUSER';

    return `
    <div class="tcc-wf-prompt-card">
        <div class="tcc-wf-prompt-header">
            <div class="tcc-wf-prompt-icon">${TccIcons.robot(16, '#ffffff')}</div>
            <span class="tcc-wf-prompt-title">AI Prompt (Claude.ai)</span>
            <span class="tcc-wf-prompt-version">${escHtml(stap.promptVersion || 'v1')}</span>
            ${isSuperuser ? '<span class="tcc-wf-prompt-role">SUPERUSER</span>' : ''}
        </div>
        <div class="tcc-wf-prompt-desc">${escHtml(stap.promptDesc || '')}</div>
        <span class="tcc-wf-prompt-edit" data-action="wf-edit-prompt" data-step="${stap.nummer}">
            ${tccIcon('edit', 12)} Prompt Bewerken
        </span>
    </div>

    ${stap.tip ? `
    <div class="tcc-wf-tip">
        ${TccIcons.lightbulb(14)} ${escHtml(stap.tip)}
    </div>` : ''}

    ${stap.howto ? `
    <div class="tcc-wf-howto">
        <div class="tcc-wf-howto-title">
            ${tccIcon('info', 14, '#92400e')} Hoe te gebruiken:
        </div>
        <ol>
            ${stap.howto.map(h => `<li>${escHtml(h)}</li>`).join('')}
        </ol>
    </div>` : ''}

    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost" data-action="wf-copy" data-step="${stap.nummer}">
            ${tccIcon('copy', 14)} Copy Prompt
        </button>
        <button class="tcc-btn tcc-btn--secondary" data-action="wf-open-claude" data-step="${stap.nummer}">
            ${tccIcon('externalLink', 14)} Open Claude.ai
        </button>
        <button class="tcc-btn tcc-btn--success" data-action="wf-save" data-step="${stap.nummer}">
            ${tccIcon('save', 14, '#ffffff')} Resultaat Opslaan
        </button>
    </div>`;
}

// ============================================
// RENDER — Footer
// ============================================

function renderTccFooter() {
    return `
    <div class="tcc-footer">
        <div class="tcc-footer-left"></div>
        <div class="tcc-footer-right"></div>
    </div>`;
}

function updateTccFooter(ctx) {
    const overlay = tccState.overlay;
    if (!overlay) return;

    const fl = overlay.querySelector('.tcc-footer-left');
    const fr = overlay.querySelector('.tcc-footer-right');
    if (!fl || !fr) return;

    const configs = {
        'ai': {
            left: `<button class="tcc-btn tcc-btn--ghost" data-action="add-document">${tccIcon('fileText', 14)} Extra document</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--primary" data-action="edit-fields">${tccIcon('edit', 14, '#ffffff')} Gegevens bewerken</button>`
        },
        'ai-gen': {
            left: `<button class="tcc-btn tcc-btn--ghost" data-action="generate-all">${tccIcon('zap', 14)} Alles genereren</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--secondary" data-action="download-all">${tccIcon('download', 14)} Alles downloaden</button>`
        },
        'planning': {
            left: `<button class="tcc-btn tcc-btn--secondary" data-action="backplannen">${tccIcon('calendarView', 14)} Backplannen</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--ghost" data-action="open-fullscreen-planning" data-pm-tab="planning">${tccIcon('maximize', 14)} Volledig scherm</button>`
        },
        'checklist': {
            left: `<span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
                       ${tccIcon('clipboardList', 14)} Indieningschecklist — beheer via toolbar hierboven
                   </span>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--ghost" data-action="open-fullscreen-planning" data-pm-tab="checklist">${tccIcon('maximize', 14)} Volledig scherm</button>`
        },
        'team': {
            left: `<button class="tcc-btn tcc-btn--secondary" data-action="team-add-show">${tccIcon('plus', 14)} Teamlid toevoegen</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--ghost" data-action="edit-fields">${tccIcon('edit', 14)} Bewerken in tender</button>`
        },
        'docs': {
            left: `<button class="tcc-btn tcc-btn--secondary" data-action="doc-upload">${tccIcon('upload', 14)} Document uploaden</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--ghost" data-action="docs-download-all">${tccIcon('download', 14)} Alles downloaden</button>`
        },
        'workflow': {
            left: `<button class="tcc-btn tcc-btn--ghost" data-action="wf-all-prompts">${tccIcon('clipboardList', 14)} Alle prompts</button>`,
            right: `<button class="tcc-btn tcc-btn--ghost" data-action="close">${tccIcon('close', 14, '#64748b')} Sluiten</button>
                    <button class="tcc-btn tcc-btn--primary" data-action="wf-next">${TccIcons.play(14, '#ffffff')} Volgende stap</button>`
        }
    };

    const cfg = configs[ctx] || configs['ai'];
    fl.innerHTML = cfg.left;
    fr.innerHTML = cfg.right;
}

// ============================================
// EVENT BINDING
// ============================================

function bindTccEvents(overlay) {
    overlay.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) {
            // Tab klik
            const tab = e.target.closest('.tcc-tab');
            if (tab) {
                switchTccTab(tab.dataset.tab);
                return;
            }
            // Sub-nav klik
            const subBtn = e.target.closest('.tcc-subnav-btn');
            if (subBtn) {
                switchTccSub(subBtn.dataset.sub);
                return;
            }
            return;
        }

        const action = target.dataset.action;

        switch (action) {
            case 'close':
                closeCommandCenter();
                break;
            case 'toggle-section':
                target.closest('.tcc-section')?.classList.toggle('is-open');
                break;
            case 'toggle-perceel':
                target.closest('.tcc-perceel-card')?.classList.toggle('is-open');
                break;
            case 'toggle-wf-step':
                target.closest('.tcc-wf-step')?.classList.toggle('is-open');
                break;
            case 'toggle-check':
                handleToggleCheck(target);
                break;
            case 'goto-tab':
                switchTccTab(target.dataset.target);
                if (target.dataset.sub) {
                    setTimeout(() => switchTccSub(target.dataset.sub), 50);
                }
                break;
            case 'upload-zone':
                handleUploadClick();
                break;
            case 'wf-copy':
                handleWfCopyPrompt(target.dataset.step);
                break;
            case 'wf-open-claude':
                window.open('https://claude.ai', '_blank');
                break;
            case 'wf-save':
                handleWfSaveResult(target.dataset.step);
                break;
            case 'ai-generate':
                handleAiGenerate(target.dataset.type);
                break;
            case 'ai-regenerate':
                handleAiGenerate(target.dataset.type);
                break;
            case 'file-view':
                handleFileView(target.dataset.fileId);
                break;
            case 'file-download':
                handleFileDownload(target.dataset.fileId);
                break;
            case 'file-delete':
                handleFileDelete(target.dataset.fileId);
                break;
            case 'open-fullscreen-planning':
                // Sluit TCC en open PlanningModal op volledig scherm
                {
                    const pmTab = target.dataset.pmTab || 'planning';
                    const fullTender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
                    closeCommandCenter();
                    if (window.planningModal && fullTender) {
                        window.planningModal.open(fullTender, pmTab);
                    }
                }
                break;
            case 'backplannen':
                handleBackplanning();
                break;
            case 'team-add-show':
                // Toon het toevoegen formulier
                {
                    const addForm = overlay.querySelector('#tcc-team-add-form');
                    if (addForm) addForm.style.display = 'block';
                }
                break;
            case 'team-add-cancel':
                // Verberg het toevoegen formulier
                {
                    const addForm = overlay.querySelector('#tcc-team-add-form');
                    if (addForm) addForm.style.display = 'none';
                }
                break;
            case 'team-add-confirm':
                handleTeamAddMember();
                break;
            case 'team-remove':
                handleTeamRemoveMember(target.dataset.memberId);
                break;
            default:
                console.log(`[TCC] Actie "${action}" nog niet geïmplementeerd`);
        }
    });

    // Drag & drop voor upload zone
    const uploadZone = overlay.querySelector('.tcc-upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('is-dragover');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('is-dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('is-dragover');
            handleFileDrop(e.dataTransfer.files);
        });
    }
}

// ============================================
// TAB / SUB-NAV SWITCHING
// ============================================

function switchTccTab(tabName) {
    const overlay = tccState.overlay;
    if (!overlay) return;

    tccState.activeTab = tabName;

    // Tabs
    overlay.querySelectorAll('.tcc-tab').forEach(t =>
        t.classList.toggle('is-active', t.dataset.tab === tabName)
    );

    // Panels
    overlay.querySelectorAll('.tcc-tab-panel').forEach(p =>
        p.classList.toggle('is-active', p.dataset.panel === tabName)
    );

    // Footer context
    if (tabName === 'ai' && tccState.activeSub === 'generatie') {
        updateTccFooter('ai-gen');
    } else {
        updateTccFooter(tabName);
    }

    // ⭐ Bridge: laad PlanningModal content voor planning/checklist tabs
    if (tabName === 'planning' || tabName === 'checklist') {
        bridgePlanningToTcc(tabName);
    }

    // ⭐ Laad workload data voor team tab
    if (tabName === 'team') {
        loadTeamWorkload();
    }
}

function switchTccSub(subName) {
    const overlay = tccState.overlay;
    if (!overlay) return;

    tccState.activeSub = subName;

    overlay.querySelectorAll('.tcc-subnav-btn').forEach(b =>
        b.classList.toggle('is-active', b.dataset.sub === subName)
    );
    overlay.querySelectorAll('.tcc-subpanel').forEach(p =>
        p.classList.toggle('is-active', p.dataset.sub === subName)
    );

    // Footer context aanpassen
    if (subName === 'generatie') {
        updateTccFooter('ai-gen');
    } else {
        updateTccFooter('ai');
    }
}

// ============================================
// BRIDGE — PlanningModal integratie
// ============================================
// Hergebruikt de bestaande PlanningModal class om echte
// planning/checklist data te renderen in TCC panels.
// PlanningModal zoekt naar #planning-modal-body en
// .planning-modal-container — beide zitten in het TCC panel.

let _bridgeTenderId = null; // Track welke tender geladen is

async function bridgePlanningToTcc(tabName) {
    const pm = window.planningModal;
    if (!pm) {
        console.warn('[TCC Bridge] PlanningModal niet beschikbaar op window.planningModal');
        return;
    }

    const overlay = tccState.overlay;
    if (!overlay) return;

    // Vind het actieve panel en zijn bridge host
    const panel = overlay.querySelector(`[data-panel="${tabName}"]`);
    if (!panel) return;

    const host = panel.querySelector('.tcc-bridge-host');
    if (!host) return;

    // Verwijder eventueel bestaand #planning-modal-body uit ALLE TCC panels
    // (er mag maar 1 bestaan in de DOM voor PlanningModal's querySelector)
    overlay.querySelectorAll('#planning-modal-body').forEach(el => el.remove());

    // Maak #planning-modal-body container aan in dit panel
    const body = document.createElement('div');
    body.id = 'planning-modal-body';
    body.style.cssText = 'flex:1;overflow-y:auto;min-height:300px;';
    body.innerHTML = `<div class="planning-loading" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 20px;">
        <div class="planning-spinner"></div>
        <span>Laden...</span>
    </div>`;

    // Vervang loading placeholder door body container
    host.innerHTML = '';
    host.appendChild(body);

    // ⭐ Wijs PlanningModal's modal referentie naar het PANEL (niet host)
    // Zo vindt pm.querySelector('#planning-modal-body') het als descendant,
    // en pm.querySelector('.planning-modal-container') vindt de host
    // (nodig voor date pickers en assignee dropdowns)
    pm.modal = panel;

    // Map TCC tab naar PlanningModal tab
    pm.activeTab = tabName === 'checklist' ? 'checklist' : 'planning';

    // Zoek het volledige tender object (bevat tenderbureau_id etc.)
    const fullTender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    pm.tender = fullTender || { id: tccState.tenderId };

    // Laad data alleen als het een andere tender is
    const needsLoad = _bridgeTenderId !== tccState.tenderId;

    if (needsLoad) {
        console.log(`[TCC Bridge] Loading planning data for: ${pm.tender?.naam || pm.tender?.id}`);
        _bridgeTenderId = tccState.tenderId;
        await pm.loadData(); // Roept renderContent() + attachContentListeners() aan
    } else {
        // Zelfde tender, andere tab — alleen herrenderen
        console.log(`[TCC Bridge] Switching to tab: ${pm.activeTab}`);
        pm.renderContent(); // Herrendert + herkoppelt listeners
    }
}

// Override closeCommandCenter om bridge state op te ruimen
const _originalCloseCC = closeCommandCenter;
closeCommandCenter = function () {
    _bridgeTenderId = null;

    // Herstel PlanningModal's modal referentie
    const pm = window.planningModal;
    if (pm) {
        // Reset naar PlanningModal's eigen modal element
        const ownModal = document.getElementById('planning-modal');
        if (ownModal) {
            pm.modal = ownModal;
        }
    }

    _originalCloseCC();
};

// ============================================
// TEAM — Teamlid toevoegen / verwijderen
// ============================================

async function handleTeamAddMember() {
    const memberId = document.getElementById('tcc-team-add-member')?.value;
    const rol = document.getElementById('tcc-team-add-rol')?.value || 'schrijver';
    const uren = parseInt(document.getElementById('tcc-team-add-uren')?.value) || 0;

    if (!memberId) {
        showTccToast('Selecteer een teamlid', 'error');
        return;
    }

    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    try {
        const tender = window.app?.tenders?.find(t => t.id === tenderId);
        if (!tender) throw new Error('Tender niet gevonden');

        // Check of al toegewezen (op team_member_id)
        const currentAssignments = tender.tender_team_assignments || tender.team_members || [];
        if (currentAssignments.some(a => (a.team_member_id || a.user_id || a.id) === memberId)) {
            showTccToast('Dit teamlid is al toegewezen', 'error');
            return;
        }

        // POST naar team-assignments endpoint
        const result = await tccApiCall(`/api/v1/tenders/${tenderId}/team-assignments`, {
            method: 'POST',
            body: JSON.stringify({
                team_member_id: memberId,
                rol_in_tender: rol,
                geplande_uren: uren
            })
        });

        console.log('[TCC] Team assignment result:', result);
        showTccToast('Teamlid toegevoegd', 'success');

        // Herlaad tender data + team tab
        await refreshTccAfterTeamChange();

    } catch (e) {
        console.error('[TCC] Team add error:', e);
        showTccToast(`Toevoegen mislukt: ${e.message}`, 'error');
    }
}

async function handleTeamRemoveMember(memberId) {
    if (!memberId || !tccState.tenderId) return;

    const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    const assignments = tender?.tender_team_assignments || tender?.team_members || [];
    const member = assignments.find(a =>
        (a.team_member_id || a.user_id || a.id) === memberId
    );
    const naam = member?.naam || member?.team_member?.naam || 'dit teamlid';

    if (!confirm(`Weet je zeker dat je ${naam} wilt verwijderen uit dit team?`)) return;

    try {
        await tccApiCall(`/api/v1/tenders/${tccState.tenderId}/team-assignments/${memberId}`, {
            method: 'DELETE'
        });

        showTccToast(`${naam} verwijderd uit team`, 'success');
        await refreshTccAfterTeamChange();

    } catch (e) {
        console.error('[TCC] Team remove error:', e);
        showTccToast(`Verwijderen mislukt: ${e.message}`, 'error');
    }
}

async function refreshTccAfterTeamChange() {
    try {
        // 1. Haal actuele team assignments op via dedicated endpoint
        const teamResult = await tccApiCall(`/api/v1/tenders/${tccState.tenderId}/team-assignments`);
        const freshAssignments = teamResult?.data || [];

        // 2. Update tender in app state
        const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
        if (tender) {
            tender.tender_team_assignments = freshAssignments;
            tender.team_members = freshAssignments; // compatibiliteit
        }

        // 3. Haal bureau teamleden op (voor beschikbare lijst)
        // ⚠️ SECURITY: Altijd tender's eigen bureau ID meesturen
        let bureauTeamMembers = [];
        try {
            const tenderBureauId = tender?.tenderbureau_id;
            if (tenderBureauId) {
                const btResult = await tccApiCall(`/api/v1/team-members?tenderbureau_id=${tenderBureauId}`);
                bureauTeamMembers = btResult?.data || [];
            }
        } catch (e) { /* ignore */ }

        // 4. Herbereken team data
        const team = transformTeam(tender || { tender_team_assignments: freshAssignments }, bureauTeamMembers);

        // 5. Update team panel HTML
        const panel = tccState.overlay?.querySelector('[data-panel="team"]');
        if (panel) {
            if (tccState.data) tccState.data.team = team;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderTabTeam({ team });
            const newPanel = tempDiv.querySelector('[data-panel="team"]');
            if (newPanel) {
                panel.innerHTML = newPanel.innerHTML;
                panel.classList.toggle('is-active', tccState.activeTab === 'team');
            }
        }

        // 6. Update badge
        const teamTab = tccState.overlay?.querySelector('[data-tab="team"]');
        if (teamTab) {
            const badge = teamTab.querySelector('.tcc-tab-badge');
            if (badge) {
                badge.textContent = team.badge || '';
                if (!team.badge) badge.remove();
            } else if (team.badge) {
                teamTab.insertAdjacentHTML('beforeend',
                    `<span class="tcc-tab-badge tcc-tab-badge--count">${team.badge}</span>`);
            }
        }

        // 7. Herlaad workload als team tab actief
        if (tccState.activeTab === 'team') {
            loadTeamWorkload();
        }

    } catch (e) {
        console.error('[TCC] Team refresh error:', e);
    }
}


// ============================================
// TEAM — Workload laden
// ============================================

async function loadTeamWorkload() {
    const container = tccState.overlay?.querySelector('#tcc-team-workload');
    if (!container) return;

    const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    const teamMembers = tender?.team_members || tender?.tender_team_assignments || [];

    if (teamMembers.length === 0) {
        container.innerHTML = `
            <div class="tcc-team-empty" style="padding:16px;">
                ${tccIcon('users', 16, '#cbd5e1')}
                <span>Voeg teamleden toe om workload te bekijken</span>
            </div>`;
        return;
    }

    // Haal user IDs op
    const userIds = teamMembers
        .map(tm => tm.team_member_id || tm.user_id)
        .filter(Boolean);

    if (userIds.length === 0) {
        container.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;">Geen teamleden met user ID gevonden</div>';
        return;
    }

    // Periode: vandaag + 4 weken
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 28);

    const startStr = today.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    try {
        const result = await tccApiCall(
            `/api/v1/planning/team/workload?user_ids=${userIds.join(',')}&start=${startStr}&end=${endStr}`
        );

        renderWorkloadBars(container, result, teamMembers);

    } catch (e) {
        console.warn('[TCC] Workload laden mislukt:', e);
        // Fallback: bereken uit lokale planning data
        renderWorkloadFromLocal(container, userIds, teamMembers);
    }
}

function renderWorkloadBars(container, workloadData, teamMembers) {
    const memberWorkloads = workloadData?.workload || workloadData?.data || [];

    if (!memberWorkloads.length && !teamMembers.length) {
        container.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;">Geen workload data beschikbaar</div>';
        return;
    }

    // Bouw workload per teamlid
    const maxTaken = 20; // Referentie voor progress bar

    const barsHtml = teamMembers.map(tm => {
        const userId = tm.team_member_id || tm.user_id;
        const naam = tm.naam || tm.email || 'Onbekend';
        const initialen = naam.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
        const avatarKleur = tm.avatar_kleur || '#6366f1';

        // Zoek workload data voor dit teamlid
        const memberData = memberWorkloads.find(w =>
            w.user_id === userId || w.id === userId
        );
        const takenCount = memberData?.total_taken || memberData?.count || 0;
        const percentage = Math.min(Math.round((takenCount / maxTaken) * 100), 100);

        // Kleur op basis van belasting
        let barColor = '#22c55e'; // groen
        let statusLabel = 'Beschikbaar';
        if (percentage >= 80) {
            barColor = '#ef4444'; // rood
            statusLabel = 'Overbelast';
        } else if (percentage >= 60) {
            barColor = '#f59e0b'; // oranje
            statusLabel = 'Druk';
        } else if (percentage >= 30) {
            barColor = '#3b82f6'; // blauw
            statusLabel = 'Normaal';
        }

        return `
        <div class="tcc-team-workload-row">
            <div class="tcc-team-workload-avatar" style="background:${avatarKleur};">${initialen}</div>
            <div class="tcc-team-workload-info">
                <div class="tcc-team-workload-name">${escHtml(naam)}</div>
                <div class="tcc-team-workload-bar-bg">
                    <div class="tcc-team-workload-bar-fill" style="width:${percentage}%;background:${barColor};"></div>
                </div>
            </div>
            <div class="tcc-team-workload-stats">
                <span class="tcc-team-workload-count">${takenCount}/${maxTaken}</span>
                <span class="tcc-team-workload-pct" style="color:${barColor};">(${percentage}%)</span>
                ${percentage >= 80 ? `<span class="tcc-team-workload-warn">${tccIcon('warning', 12, '#ef4444')}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="tcc-team-workload-list">
            ${barsHtml}
        </div>
        <div class="tcc-team-workload-legend">
            <span style="color:#22c55e;">● Beschikbaar</span>
            <span style="color:#3b82f6;">● Normaal</span>
            <span style="color:#f59e0b;">● Druk</span>
            <span style="color:#ef4444;">● Overbelast</span>
        </div>`;
}

function renderWorkloadFromLocal(container, userIds, teamMembers) {
    // Fallback: tel taken uit alle tenders in window.app
    const allTenders = window.app?.tenders || [];
    const counts = {};
    userIds.forEach(id => { counts[id] = 0; });

    // Tel planning_taken per user over alle tenders
    // (Beperkte data — alleen wat lokaal beschikbaar is)
    container.innerHTML = `
        <div style="padding:12px 16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:12px;color:#78350f;">
                ${tccIcon('info', 12)} Workload API niet beschikbaar — schakel naar de Planning view voor volledig overzicht
            </div>
            ${teamMembers.map(tm => {
        const naam = tm.naam || tm.email || 'Onbekend';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#475569;">
                    <span style="width:8px;height:8px;border-radius:50%;background:#cbd5e1;"></span>
                    ${escHtml(naam)} — <span style="color:#94a3b8;">workload onbekend</span>
                </div>`;
    }).join('')}
        </div>`;
}


// ============================================
// BACKPLANNING — Genereer automatische planning
// ============================================

async function handleBackplanning() {
    const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    if (!tender) {
        alert('Tender niet gevonden.');
        return;
    }

    // Check of er een deadline is
    if (!tender.deadline_indiening) {
        alert('Deze tender heeft geen deadline indiening. Stel eerst een deadline in voordat je een backplanning kunt genereren.');
        return;
    }

    // Haal templates op
    let templates = [];
    try {
        const result = await tccApiCall('/api/v1/planning-templates');
        templates = result?.data || result?.templates || [];
    } catch (e) {
        console.warn('[TCC] Templates ophalen mislukt:', e.message);
    }

    if (templates.length === 0) {
        alert('Geen planning templates beschikbaar. Maak eerst een template aan via het beheer.');
        return;
    }

    // Haal bestaande items op voor de overschrijf-waarschuwing
    let existingPlan = 0, existingCheck = 0;
    try {
        const pm = window.planningModal;
        if (pm) {
            existingPlan = pm.taken?.length || 0;
            existingCheck = pm.checklistItems?.length || 0;
        }
    } catch (e) { /* ignore */ }

    const standaardTemplate = templates.find(t => t.is_standaard) || templates[0];
    showBackplanningConfirm(tender, templates, standaardTemplate, existingPlan, existingCheck);
}

// ─── STAP 1: Bevestigingsmodal ─────────────────────────
function showBackplanningConfirm(tender, templates, selected, existingPlan, existingCheck) {
    // Verwijder eventueel bestaande picker
    tccState.overlay?.querySelector('.tcc-bp-modal')?.remove();

    const deadlineStr = _formatDateNL(tender.deadline_indiening);
    const daysLeft = _daysUntil(new Date(tender.deadline_indiening));
    const hasExisting = existingPlan > 0 || existingCheck > 0;

    // Team info
    const teamMembers = tender.team_members || tender.tender_team_assignments || [];
    const teamHtml = teamMembers.length > 0
        ? teamMembers.map(tm => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;padding:3px 10px;border-radius:12px;font-size:12px;color:#475569;">
            ${tccIcon('user', 12)} ${escHtml(tm.naam || tm.email || tm.rol_in_tender || 'Teamlid')}
            <span style="color:#94a3b8;font-size:11px;">${tm.rol_in_tender || ''}</span>
          </span>`).join(' ')
        : '<span style="color:#94a3b8;font-size:13px;">Geen teamleden toegewezen</span>';

    const modalHtml = `
    <div class="tcc-bp-modal" style="
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(15,23,42,0.5);z-index:10010;
        display:flex;align-items:center;justify-content:center;
    ">
        <div style="
            background:white;border-radius:16px;padding:0;
            width:100%;max-width:520px;box-shadow:0 20px 40px rgba(0,0,0,0.15);
            overflow:hidden;
        ">
            <!-- Header -->
            <div style="padding:24px 28px 16px;border-bottom:1px solid #f1f5f9;">
                <h3 style="margin:0 0 4px;font-size:18px;color:#0f172a;display:flex;align-items:center;gap:10px;">
                    ${tccIcon('calendarView', 20, '#6366f1')} Backplanning genereren
                </h3>
                <p style="margin:0;font-size:13px;color:#64748b;">
                    Automatisch een planning en checklist opstellen op basis van de deadline
                </p>
            </div>

            <!-- Body -->
            <div style="padding:20px 28px;">
                <!-- Tender info -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:13px;font-weight:600;color:#334155;">Deadline indiening</span>
                        <span style="font-size:14px;font-weight:700;color:#6366f1;">${deadlineStr}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:13px;font-weight:600;color:#334155;">Resterende werkdagen</span>
                        <span style="font-size:14px;font-weight:600;color:${daysLeft < 14 ? '#dc2626' : '#16a34a'};">
                            ${daysLeft > 0 ? daysLeft + ' dagen' : 'Verlopen!'}
                        </span>
                    </div>
                    <div style="margin-top:10px;">
                        <span style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:6px;">Team</span>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">${teamHtml}</div>
                    </div>
                </div>

                <!-- Template selectie -->
                <label style="display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:6px;">
                    Template
                </label>
                <select id="tcc-bp-template" style="
                    width:100%;padding:10px 12px;border:2px solid #e2e8f0;
                    border-radius:8px;font-size:14px;color:#0f172a;
                    margin-bottom:16px;outline:none;
                ">
                    ${templates.map(t => `
                        <option value="${t.id}" ${t.id === selected.id ? 'selected' : ''}>
                            ${escHtml(t.naam || t.name || t.template_naam)} ${t.is_standaard ? '(standaard)' : ''}
                        </option>
                    `).join('')}
                </select>

                <!-- Wat gaat er gebeuren -->
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:${hasExisting ? '12px' : '0'};">
                    <div style="font-size:13px;font-weight:600;color:#1e40af;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                        ${tccIcon('info', 14, '#3b82f6')} Wat gaat er gebeuren?
                    </div>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#334155;line-height:1.7;">
                        <li>Taken worden <strong>teruggepland</strong> vanaf de deadline</li>
                        <li>Weekenden worden automatisch overgeslagen</li>
                        <li>Teamleden worden gekoppeld aan taken op basis van hun rol</li>
                        <li>Je krijgt eerst een <strong>preview</strong> voordat er iets wordt opgeslagen</li>
                    </ul>
                </div>

                ${hasExisting ? `
                <!-- Overschrijf-waarschuwing -->
                <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:13px;font-weight:600;color:#92400e;display:flex;align-items:center;gap:6px;">
                        ${tccIcon('warning', 14, '#f59e0b')} Let op
                    </div>
                    <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.5;">
                        Er zijn al <strong>${existingPlan} planning taken</strong> en <strong>${existingCheck} checklist items</strong> aanwezig. 
                        Deze worden <strong>vervangen</strong> als je doorgaat.
                    </p>
                </div>
                ` : ''}
            </div>

            <!-- Footer -->
            <div style="padding:16px 28px 24px;display:flex;gap:12px;justify-content:flex-end;">
                <button class="tcc-btn tcc-btn--ghost" data-bp-action="cancel">Annuleren</button>
                <button class="tcc-btn tcc-btn--primary" data-bp-action="calculate" style="min-width:180px;">
                    ${tccIcon('calendarView', 14, '#ffffff')} Berekenen
                </button>
            </div>
        </div>
    </div>`;

    tccState.overlay.insertAdjacentHTML('beforeend', modalHtml);

    // Event handlers
    const modal = tccState.overlay.querySelector('.tcc-bp-modal');
    modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-bp-action]');
        if (!btn) return;

        if (btn.dataset.bpAction === 'cancel') {
            modal.remove();
        } else if (btn.dataset.bpAction === 'calculate') {
            const templateId = modal.querySelector('#tcc-bp-template').value;
            // Toon loading state op de knop
            btn.disabled = true;
            btn.innerHTML = `<div class="tcc-spinner" style="width:14px;height:14px;border-width:2px;"></div> Berekenen...`;
            executeBackplanning(tender, templateId, modal);
        }
    });
}

// ─── STAP 2: Berekenen + Preview tonen ─────────────────
async function executeBackplanning(tender, templateId, confirmModal) {
    try {
        // Bouw team_assignments vanuit tender.team_members
        // Let op: meerdere personen kunnen dezelfde rol hebben
        const teamAssignments = {};
        const teamAssignmentsFull = {}; // { rol: [{ id, naam }] } voor multi-toewijzing
        const teamMembers = tender.team_members || tender.tender_team_assignments || [];
        for (const tm of teamMembers) {
            const rol = tm.rol_in_tender || tm.rol || 'schrijver';
            const userId = tm.team_member_id || tm.user_id;
            if (!userId) continue;

            // Eerste match per rol → voor backend (accepteert momenteel single ID)
            if (!teamAssignments[rol]) {
                teamAssignments[rol] = userId;
            }

            // Volledige mapping → voor multi-toewijzing bij opslaan
            if (!teamAssignmentsFull[rol]) teamAssignmentsFull[rol] = [];
            teamAssignmentsFull[rol].push({
                id: userId,
                naam: tm.naam || tm.email || ''
            });
        }

        // Bewaar volledige mapping voor saveBackplanningBulk
        tccState._teamAssignmentsFull = teamAssignmentsFull;

        const requestBody = {
            deadline: tender.deadline_indiening,
            template_id: templateId,
            team_assignments: teamAssignments,
            tenderbureau_id: tender.tenderbureau_id,
            tender_id: tender.id,
            include_checklist: true
        };

        console.log('[TCC] Backplanning request:', requestBody);

        const result = await tccApiCall('/api/v1/planning/generate-backplanning', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        console.log('[TCC] Backplanning result:', result);

        // Verwijder bevestigingsmodal
        if (confirmModal) confirmModal.remove();

        // Toon preview
        showBackplanningPreview(tender, result);

    } catch (e) {
        console.error('[TCC] Backplanning fout:', e);
        // Herstel knop in bevestigingsmodal
        if (confirmModal) {
            const btn = confirmModal.querySelector('[data-bp-action="calculate"]');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${tccIcon('calendarView', 14, '#ffffff')} Opnieuw proberen`;
            }
        }
        showTccToast(`Berekening mislukt: ${e.message || 'Onbekende fout'}`, 'error');
    }
}

// ─── STAP 3: Preview modal ─────────────────────────────
function showBackplanningPreview(tender, result) {
    tccState.overlay?.querySelector('.tcc-bp-modal')?.remove();

    const planTaken = result?.planning_taken || [];
    const checkItems = result?.checklist_items || [];
    const warnings = result?.workload_warnings || [];
    const deadlineStr = _formatDateNL(tender.deadline_indiening);

    // Groepeer planning taken per categorie
    const categorieGroups = {};
    for (const taak of planTaken) {
        let cat = 'Voorbereiding';
        if (taak.volgorde > 30 && taak.volgorde <= 100) cat = 'Schrijven & Review';
        else if (taak.volgorde > 100) cat = 'Afronding & Indiening';
        if (!categorieGroups[cat]) categorieGroups[cat] = [];
        categorieGroups[cat].push(taak);
    }

    // Bouw planning rows HTML
    let planningHtml = '';
    for (const [categorie, taken] of Object.entries(categorieGroups)) {
        planningHtml += `
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;padding:8px 0 4px;margin-top:4px;border-bottom:1px solid #f1f5f9;">
                ${escHtml(categorie)} <span style="float:right;font-weight:500;">${taken.length} taken</span>
            </div>`;
        for (const taak of taken) {
            const datumStr = taak.datum ? _formatDateNL(taak.datum) : '—';
            const isMijlpaal = taak.is_mijlpaal ? `<span style="color:#dc2626;margin-right:4px;">▸</span>` : '';
            const toewijzing = taak.toegewezen_aan?.naam || taak.toegewezen_aan?.email || '';
            planningHtml += `
                <div style="display:flex;align-items:center;padding:6px 0;font-size:13px;border-bottom:1px solid #f8fafc;gap:8px;">
                    <span style="flex:1;color:#0f172a;">${isMijlpaal}${escHtml(taak.naam)}</span>
                    ${toewijzing ? `<span style="color:#6366f1;font-size:11px;background:#ede9fe;padding:1px 8px;border-radius:10px;">${escHtml(toewijzing)}</span>` : ''}
                    <span style="min-width:80px;text-align:right;color:#64748b;font-size:12px;">${datumStr}</span>
                </div>`;
        }
    }

    // Bouw checklist rows HTML
    let checklistHtml = checkItems.map(item => `
        <div style="display:flex;align-items:center;padding:5px 0;font-size:13px;border-bottom:1px solid #f8fafc;gap:8px;">
            <span style="flex:1;color:#0f172a;">${escHtml(item.naam)}</span>
            <span style="font-size:11px;color:#64748b;background:#f1f5f9;padding:1px 8px;border-radius:10px;">
                ${item.is_verplicht ? 'Verplicht' : 'Optioneel'}
            </span>
        </div>
    `).join('');

    // Waarschuwingen HTML
    let warningsHtml = '';
    if (warnings.length > 0) {
        warningsHtml = `
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                ${tccIcon('warning', 14, '#f59e0b')} Workload waarschuwingen
            </div>
            ${warnings.map(w => `<p style="margin:4px 0;font-size:12px;color:#78350f;">• ${escHtml(typeof w === 'string' ? w : w.message || w.tekst || '')}</p>`).join('')}
        </div>`;
    }

    // Metadata
    const meta = result?.metadata || {};
    const startDate = meta.earliest_date ? _formatDateNL(meta.earliest_date) : '—';
    const endDate = meta.latest_date ? _formatDateNL(meta.latest_date) : deadlineStr;

    const previewHtml = `
    <div class="tcc-bp-modal" style="
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(15,23,42,0.5);z-index:10010;
        display:flex;align-items:center;justify-content:center;
    ">
        <div style="
            background:white;border-radius:16px;
            width:100%;max-width:640px;max-height:85vh;
            box-shadow:0 20px 40px rgba(0,0,0,0.15);
            display:flex;flex-direction:column;overflow:hidden;
        ">
            <!-- Header -->
            <div style="padding:24px 28px 16px;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
                <h3 style="margin:0 0 4px;font-size:18px;color:#0f172a;display:flex;align-items:center;gap:10px;">
                    ${tccIcon('checkCircle', 20, '#16a34a')} Backplanning berekend
                </h3>
                <p style="margin:0;font-size:13px;color:#64748b;">
                    Controleer het resultaat voordat je opslaat
                </p>
            </div>

            <!-- Samenvatting -->
            <div style="padding:16px 28px 0;flex-shrink:0;">
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#16a34a;">${planTaken.length}</div>
                        <div style="font-size:12px;color:#15803d;">Planning taken</div>
                    </div>
                    <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;text-align:center;">
                        <div style="font-size:24px;font-weight:700;color:#2563eb;">${checkItems.length}</div>
                        <div style="font-size:12px;color:#1d4ed8;">Checklist items</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;text-align:center;">
                        <div style="font-size:13px;font-weight:600;color:#334155;">${startDate}</div>
                        <div style="font-size:11px;color:#64748b;">t/m ${endDate}</div>
                    </div>
                </div>
                ${warningsHtml}
            </div>

            <!-- Scrollbare inhoud -->
            <div style="flex:1;overflow-y:auto;padding:0 28px 16px;min-height:0;">
                <!-- Planning taken -->
                <details open style="margin-bottom:12px;">
                    <summary style="cursor:pointer;font-size:14px;font-weight:700;color:#0f172a;padding:8px 0;user-select:none;">
                        ${tccIcon('calendarView', 14)} Planning taken (${planTaken.length})
                    </summary>
                    <div style="padding-left:4px;">${planningHtml}</div>
                </details>

                <!-- Checklist -->
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-size:14px;font-weight:700;color:#0f172a;padding:8px 0;user-select:none;">
                        ${tccIcon('checkCircle', 14)} Checklist items (${checkItems.length})
                    </summary>
                    <div style="padding-left:4px;">${checklistHtml}</div>
                </details>
            </div>

            <!-- Footer -->
            <div style="padding:16px 28px 24px;border-top:1px solid #f1f5f9;display:flex;gap:12px;justify-content:flex-end;flex-shrink:0;">
                <button class="tcc-btn tcc-btn--ghost" data-bp-action="cancel">
                    Annuleren
                </button>
                <button class="tcc-btn tcc-btn--primary" data-bp-action="save" style="min-width:160px;">
                    ${tccIcon('checkCircle', 14, '#ffffff')} Opslaan
                </button>
            </div>
        </div>
    </div>`;

    tccState.overlay.insertAdjacentHTML('beforeend', previewHtml);

    // Event handlers
    const modal = tccState.overlay.querySelector('.tcc-bp-modal');
    modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-bp-action]');
        if (!btn) return;

        if (btn.dataset.bpAction === 'cancel') {
            modal.remove();
        } else if (btn.dataset.bpAction === 'save') {
            btn.disabled = true;
            btn.innerHTML = `<div class="tcc-spinner" style="width:14px;height:14px;border-width:2px;"></div> Opslaan...`;
            saveBackplanningBulk(tender, result, modal);
        }
    });
}

// ─── STAP 4: Bulk opslaan (1 API call) ─────────────────
async function saveBackplanningBulk(tender, result, previewModal) {
    const planTaken = result?.planning_taken || [];
    const checkItems = result?.checklist_items || [];

    try {
        // Transformeer data naar database-formaat
        // ⭐ Multi-toewijzing: taken krijgen ALLE teamleden met de juiste rol
        const fullAssignments = tccState._teamAssignmentsFull || {};

        const planningRows = planTaken.map(taak => {
            let categorie = 'Voorbereiding';
            if (taak.volgorde > 30 && taak.volgorde <= 100) categorie = 'Schrijven & Review';
            else if (taak.volgorde > 100) categorie = 'Afronding & Indiening';

            // Bepaal toewijzing: primair uit taak data, aangevuld met volledige rol-mapping
            let toegewezenIds = [];
            if (taak.toegewezen_aan?.id) {
                toegewezenIds = [taak.toegewezen_aan.id];
                // Voeg overige leden met dezelfde rol toe voor gedeelde verantwoordelijkheid
                const taakRol = taak.rol || taak.verantwoordelijke_rol || '';
                if (taakRol && fullAssignments[taakRol]) {
                    const extraIds = fullAssignments[taakRol]
                        .map(m => m.id)
                        .filter(id => !toegewezenIds.includes(id));
                    toegewezenIds = [...toegewezenIds, ...extraIds];
                }
            }

            return {
                taak_naam: taak.naam,
                categorie: categorie,
                beschrijving: taak.beschrijving || '',
                datum: taak.datum || null,
                toegewezen_aan: toegewezenIds,
                status: 'todo',
                volgorde: taak.volgorde || 0,
                is_milestone: taak.is_mijlpaal || false
            };
        });

        const checklistRows = checkItems.map(item => {
            let sectie = 'Overige Documenten';
            const rol = item.rol || '';
            if (['tendermanager', 'reviewer'].includes(rol)) sectie = 'Verklaringen & Formulieren';
            else if (rol === 'schrijver') sectie = 'Inhoudelijke Documenten';
            else if (rol === 'calculator') sectie = 'Financieel';

            return {
                taak_naam: item.naam,
                sectie: sectie,
                beschrijving: item.beschrijving || '',
                is_verplicht: item.is_verplicht ?? true,
                status: 'pending',
                volgorde: item.volgorde || 0
            };
        });

        // ⭐ Eén API call: verwijdert oud + insert nieuw
        await tccApiCall(`/api/v1/tenders/${tender.id}/planning-bulk`, {
            method: 'POST',
            body: JSON.stringify({
                planning_taken: planningRows,
                checklist_items: checklistRows,
                overwrite: true
            })
        });

        console.log(`[TCC] Bulk save: ${planningRows.length} taken + ${checklistRows.length} checklist items`);

        // Sluit preview modal
        if (previewModal) previewModal.remove();

        // Toon success
        showTccToast(`✅ Backplanning opgeslagen: ${planningRows.length} taken en ${checklistRows.length} checklist items`, 'success');

        // Footer update
        const fl = tccState.overlay?.querySelector('.tcc-footer-left');
        if (fl) {
            fl.innerHTML = `<span style="display:flex;align-items:center;gap:8px;font-size:13px;color:#16a34a;">
                ${tccIcon('checkCircle', 14)} ${planningRows.length} taken + ${checklistRows.length} checklist items opgeslagen
            </span>`;
            setTimeout(() => updateTccFooter(tccState.activeTab || 'planning'), 4000);
        }

        // Herlaad de planning tab
        await refreshPlanningBridge();

    } catch (e) {
        console.error('[TCC] Bulk save fout:', e);
        // Herstel knop in preview modal
        if (previewModal) {
            const btn = previewModal.querySelector('[data-bp-action="save"]');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${tccIcon('checkCircle', 14, '#ffffff')} Opnieuw proberen`;
            }
        }
        showTccToast(`Opslaan mislukt: ${e.message || 'Onbekende fout'}`, 'error');
    }
}

// Oude individuele save functies verwijderd — vervangen door saveBackplanningBulk hierboven

async function refreshPlanningBridge() {
    // Force herlaad door _bridgeTenderId te resetten
    // Zo zal bridgePlanningToTcc needsLoad=true zien en pm.loadData() aanroepen
    _bridgeTenderId = null;
    await bridgePlanningToTcc(tccState.activeTab || 'planning');
}

/**
 * Toon een toast-melding bovenin het TCC overlay
 * @param {string} message - Bericht
 * @param {'success'|'error'|'info'} type - Type melding
 * @param {number} duration - Duur in ms (default 4000)
 */
function showTccToast(message, type = 'info', duration = 4000) {
    const overlay = tccState.overlay;
    if (!overlay) return;

    // Inject keyframes éénmalig
    if (!document.getElementById('tcc-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'tcc-toast-styles';
        style.textContent = `
            @keyframes tccToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-15px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // Verwijder eventueel bestaande toast
    overlay.querySelector('.tcc-toast')?.remove();

    const colors = {
        success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: 'checkCircle' },
        error: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: 'warning' },
        info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: 'info' }
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'tcc-toast';
    toast.style.cssText = `
        position: absolute;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10010;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        background: ${c.bg};
        border: 1px solid ${c.border};
        border-radius: 10px;
        color: ${c.text};
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        animation: tccToastIn 0.3s ease-out;
        max-width: 90%;
    `;
    toast.innerHTML = `${tccIcon(c.icon, 16)} <span>${message}</span>`;

    overlay.appendChild(toast);

    // Auto-remove met fade-out
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// EVENT HANDLERS (stubs — te implementeren)
// ============================================

function handleToggleCheck(target) {
    const box = target.closest('.tcc-check-box');
    if (!box) return;

    const isDone = box.classList.contains('tcc-check-box--done');
    const item = box.closest('.tcc-check-item');

    if (isDone) {
        box.classList.remove('tcc-check-box--done');
        box.innerHTML = '';
        item?.querySelector('.tcc-check-name')?.classList.remove('tcc-check-name--done');
    } else {
        box.classList.add('tcc-check-box--done');
        box.innerHTML = tccIcon('check', 12, '#ffffff');
        item?.querySelector('.tcc-check-name')?.classList.add('tcc-check-name--done');
    }

    // TODO: Opslaan naar backend
    console.log(`[TCC] Checklist item toggled: ${box.dataset.itemId}`);
}

function handleUploadClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx';
    input.onchange = (e) => {
        if (e.target.files.length > 0) {
            handleFileDrop(e.target.files);
        }
    };
    input.click();
}

function handleFileDrop(files) {
    console.log(`[TCC] ${files.length} bestand(en) gedropt:`, Array.from(files).map(f => f.name));
    // TODO: Upload via API
    // POST /api/tenders/{id}/documents/upload
    if (typeof showNotification === 'function') {
        showNotification(`${files.length} bestand(en) worden geüpload...`, 'info');
    }
}

function handleWfCopyPrompt(stepNr) {
    // TODO: Haal prompt op van API en kopieer naar clipboard
    console.log(`[TCC] Copy prompt voor stap ${stepNr}`);
    if (typeof showNotification === 'function') {
        showNotification('Prompt gekopieerd naar klembord', 'success');
    }
}

function handleWfSaveResult(stepNr) {
    console.log(`[TCC] Resultaat opslaan voor stap ${stepNr}`);
    // TODO: Open modal voor resultaat invoer
}

function handleAiGenerate(docType) {
    console.log(`[TCC] Genereer AI document: ${docType}`);
    // TODO: POST /api/tenders/{id}/ai/generate/{type}
}

function handleFileView(fileId) {
    console.log(`[TCC] Bekijk bestand: ${fileId}`);
    // TODO: Open bestand in viewer
}

function handleFileDownload(fileId) {
    console.log(`[TCC] Download bestand: ${fileId}`);
    // TODO: Trigger download
}

function handleFileDelete(fileId) {
    if (confirm('Weet je zeker dat je dit bestand wilt verwijderen?')) {
        console.log(`[TCC] Verwijder bestand: ${fileId}`);
        // TODO: DELETE via API, verwijder DOM element
    }
}

// ============================================
// UTILITIES
// ============================================

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================
// MOCK DATA verwijderd — fetchTccData() haalt nu echte data op via:
// 1. window.app.tenders (al geladen)
// 2. GET /smart-import/{id}/status (analyse + uploaded files)
// 3. GET /ai-documents/tenders/{id}/ai-documents (gegenereerde docs)
// 4. GET /ai-documents/templates (template definities)

// ============================================
// GLOBAAL BESCHIKBAAR MAKEN
// ============================================

window.openCommandCenter = openCommandCenter;
window.closeCommandCenter = closeCommandCenter;