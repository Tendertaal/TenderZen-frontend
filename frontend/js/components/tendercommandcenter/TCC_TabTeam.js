/* ============================================
   TCC_TabTeam.js  —  v2.0  (2026-03-10)
   Team tab — leden, rolverdeling, workload

   Wijzigingen t.o.v. v1:
   - Zoekbalk met live-filter (ipv dropdown)
   - Zoekresultaten met workload-badge (Vrij/Druk/Vol)
   - Rol-selectie als pill-buttons (ipv <select>)
   - Teamleden als cards met workload-bar direct zichtbaar
   - Rolverdeling sectie compact gehouden
   - Toewijzingscriteria sectie behouden
   - _tccTeamState bijgehouden voor geselecteerd lid + rol
   ============================================ */

// ============================================
// MODULE STATE
// ============================================

const _tccTeamState = {
    selectedMemberId: null,
    selectedRol: 'schrijver',
    searchQuery: ''
};

// ============================================
// HELPERS
// ============================================

function _rolLabel(rol) {
    const labels = {
        tendermanager: 'Tendermanager',
        schrijver:     'Schrijver',
        calculator:    'Calculator',
        reviewer:      'Reviewer',
        designer:      'Designer'
    };
    return labels[rol] || rol || 'Onbekend';
}

function _rolTagClass(rol) {
    const map = {
        tendermanager: 'tcc-team-tag--lead',
        schrijver:     'tcc-team-tag--writer',
        calculator:    'tcc-team-tag--calc',
        reviewer:      'tcc-team-tag--review',
        designer:      'tcc-team-tag--design'
    };
    return map[rol] || 'tcc-team-tag--support';
}

function _workloadClass(pct) {
    if (pct >= 80) return 'high';
    if (pct >= 50) return 'medium';
    return 'low';
}

function _workloadBadgeClass(pct) {
    if (pct >= 80) return 'tcc-team-result-workload--vol';
    if (pct >= 50) return 'tcc-team-result-workload--druk';
    return 'tcc-team-result-workload--vrij';
}

function _workloadBadgeLabel(pct) {
    if (pct >= 80) return 'Vol';
    if (pct >= 50) return 'Druk';
    return 'Vrij';
}

// ============================================
// TRANSFORM — Team
// ============================================

function transformTeam(tender, bureauTeamMembers) {
    const assignments = tender.tender_team_assignments || tender.team_members || [];

    const allRoles = [
        { key: 'tendermanager', label: 'Tendermanager', icon: 'user',        required: true  },
        { key: 'schrijver',     label: 'Schrijver',     icon: 'edit',        required: true  },
        { key: 'calculator',    label: 'Calculator',    icon: 'barChart',    required: false },
        { key: 'reviewer',      label: 'Reviewer',      icon: 'checkCircle', required: false },
        { key: 'designer',      label: 'Designer',      icon: 'fileText',    required: false }
    ];

    const members = assignments.map(a => {
        const nested = a.team_member || {};
        const bureauInfo = bureauTeamMembers.find(bm => bm.id === (a.team_member_id || a.user_id)) || {};
        const naam = a.naam || nested.naam || bureauInfo.naam || bureauInfo.email || 'Onbekend';
        const initialen = naam.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
        // Workload percentage: gebruik beschikbare data of default 0
        const workloadPct = a.workload_pct || bureauInfo.workload_pct || 0;
        return {
            id: a.team_member_id || a.user_id || a.id,
            assignment_id: a.id,
            naam, email: a.email || nested.email || bureauInfo.email || '',
            initialen,
            rol: a.rol_in_tender || a.rol || 'schrijver',
            uren: a.geplande_uren || a.uren || a.geschatte_uren || 0,
            avatar_kleur: a.avatar_kleur || nested.avatar_kleur || bureauInfo.avatar_kleur || '#6366f1',
            functie_titel: a.functie_titel || nested.functie_titel || bureauInfo.functie_titel || '',
            workload_pct: workloadPct
        };
    });

    const rolVerdeling = allRoles.map(role => {
        const assigned = members.filter(m => m.rol === role.key);
        return { ...role, assigned, vacant: assigned.length === 0 };
    });

    const assignedIds = members.map(m => m.id);
    const available = bureauTeamMembers.filter(bm => !assignedIds.includes(bm.id));

    return {
        members, rolVerdeling, available, allRoles,
        badge: members.length > 0 ? String(members.length) : '',
        filledRoles: rolVerdeling.filter(r => !r.vacant).length,
        totalRoles: allRoles.length,
        requiredVacant: rolVerdeling.filter(r => r.required && r.vacant),
        totalUren: members.reduce((sum, m) => sum + (m.uren || 0), 0)
    };
}

// ============================================
// RENDER — Teamleden cards
// ============================================

function _renderMemberCard(m) {
    const wPct = m.workload_pct || 0;
    const wClass = _workloadClass(wPct);
    const tagClass = _rolTagClass(m.rol);

    return `
    <div class="tcc-team-member-card" data-member-id="${m.id}">
        <div class="tcc-team-avatar" style="background:${m.avatar_kleur};">${escHtml(m.initialen)}</div>
        <div class="tcc-team-member-info">
            <div class="tcc-team-member-name">${escHtml(m.naam)}</div>
            <div class="tcc-team-member-role">${m.functie_titel ? escHtml(m.functie_titel) + ' · ' : ''}${escHtml(_rolLabel(m.rol))}</div>
            <div class="tcc-team-member-tags">
                <span class="tcc-team-tag ${tagClass}">${escHtml(_rolLabel(m.rol))}</span>
                ${m.uren > 0 ? `<span class="tcc-team-tag tcc-team-tag--uren">${m.uren} uur</span>` : ''}
            </div>
            <div class="tcc-team-workload">
                <div class="tcc-team-workload-bar">
                    <div class="tcc-team-workload-fill tcc-team-workload-fill--${wClass}" style="width:${wPct}%;"></div>
                </div>
                <span class="tcc-team-workload-label">${wPct}% bezet</span>
            </div>
        </div>
        <div class="tcc-team-member-actions">
            <button class="tcc-btn tcc-btn--ghost tcc-btn--xs"
                    data-action="team-remove"
                    data-member-id="${m.id}"
                    title="Verwijderen uit tender">
                ${tccIcon('close', 12, '#dc2626')}
            </button>
        </div>
    </div>`;
}

// ============================================
// RENDER — Zoekresultaten
// ============================================

function _renderSearchResults(available, query) {
    if (available.length === 0) {
        return `<div class="tcc-team-add-empty">
            ${tccIcon('info', 14, '#94a3b8')}
            <span>Alle beschikbare teamleden zijn al toegewezen</span>
        </div>`;
    }

    const filtered = query
        ? available.filter(a => {
            const naam = (a.naam || a.email || '').toLowerCase();
            return naam.includes(query.toLowerCase());
          })
        : available;

    if (filtered.length === 0) {
        return `<div class="tcc-team-search-results">
            <div class="tcc-team-search-empty">Geen resultaten voor "${escHtml(query)}"</div>
        </div>`;
    }

    const items = filtered.map(a => {
        const naam = a.naam || a.email || 'Onbekend';
        const initialen = naam.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
        const kleur = a.avatar_kleur || '#6366f1';
        const wPct = a.workload_pct || 0;
        const badgeClass = _workloadBadgeClass(wPct);
        const badgeLabel = _workloadBadgeLabel(wPct);
        const isSelected = _tccTeamState.selectedMemberId === a.id;
        return `
        <div class="tcc-team-search-result-item${isSelected ? ' selected' : ''}"
             data-action="team-search-select"
             data-member-id="${a.id}">
            <div class="tcc-team-result-avatar" style="background:${kleur};">${escHtml(initialen)}</div>
            <div class="tcc-team-result-info">
                <div class="tcc-team-result-name">${escHtml(naam)}</div>
                <div class="tcc-team-result-sub">${a.functie_titel ? escHtml(a.functie_titel) : (a.email ? escHtml(a.email) : '')}</div>
            </div>
            <span class="tcc-team-result-workload ${badgeClass}">${badgeLabel}</span>
        </div>`;
    }).join('');

    return `<div class="tcc-team-search-results">${items}</div>`;
}

// ============================================
// RENDER — Rol pill-knoppen
// ============================================

function _renderRolPills(allRoles) {
    return `<div class="tcc-team-role-select">
        ${allRoles.map(r => `
            <div class="tcc-team-role-option${_tccTeamState.selectedRol === r.key ? ' selected' : ''}"
                 data-action="team-rol-select"
                 data-rol="${r.key}">
                ${escHtml(r.label)}
            </div>`).join('')}
    </div>`;
}

// ============================================
// RENDER — Toevoegen card
// ============================================

function _renderAddCard(available, allRoles) {
    const hasSelected = _tccTeamState.selectedMemberId !== null;
    return `
    <div class="tcc-team-add-card">
        <div class="tcc-team-add-title">
            ${tccIcon('users', 16, '#7c3aed')}
            Teamlid toevoegen
        </div>
        <div class="tcc-team-search-row">
            <input type="text"
                   class="tcc-team-search-input"
                   id="tcc-team-search-input"
                   placeholder="Zoek op naam of e-mail…"
                   value="${escHtml(_tccTeamState.searchQuery)}"
                   data-action="team-search-input"
                   autocomplete="off" />
        </div>
        ${_renderSearchResults(available, _tccTeamState.searchQuery)}
        <div style="margin-top:12px">
            <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Rol toewijzen</div>
            ${_renderRolPills(allRoles)}
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
            <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="team-add-cancel">Annuleren</button>
            <button class="tcc-btn tcc-btn--primary tcc-btn--sm"
                    data-action="team-add-confirm"
                    ${hasSelected ? '' : 'disabled'}>
                ${tccIcon('check', 13, '#fff')} Toevoegen
            </button>
        </div>
    </div>`;
}

// ============================================
// RENDER — Rolverdeling
// ============================================

function _renderRolverdeling(rolVerdeling) {
    return rolVerdeling.map(r => {
        const assignedNames = r.assigned.map(a => escHtml(a.naam)).join(', ');
        const statusIcon = r.vacant
            ? (r.required
                ? `<span class="tcc-team-rol-status tcc-team-rol-status--warn">${tccIcon('warning', 12, '#f59e0b')} Vacant</span>`
                : `<span class="tcc-team-rol-status tcc-team-rol-status--empty">—</span>`)
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
}

// ============================================
// RENDER — Tab 5: Team
// ============================================

function renderTabTeam(data) {
    const team = data.team || {};
    const members = team.members || [];
    const rolVerdeling = team.rolVerdeling || [];
    const available = team.available || [];
    const allRoles = team.allRoles || [];
    const requiredVacant = team.requiredVacant || [];

    // Reset selectedMemberId als het lid al is toegevoegd
    if (_tccTeamState.selectedMemberId &&
        !available.find(a => a.id === _tccTeamState.selectedMemberId)) {
        _tccTeamState.selectedMemberId = null;
    }

    const warningHtml = requiredVacant.length > 0 ? `
        <div class="tcc-team-warning">
            ${tccIcon('warning', 14, '#f59e0b')}
            <span><strong>${requiredVacant.length} verplichte ${requiredVacant.length === 1 ? 'rol' : 'rollen'}</strong> niet ingevuld: ${requiredVacant.map(r => r.label).join(', ')}.</span>
        </div>` : '';

    const memberCardsHtml = members.length > 0
        ? `<div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
               Huidig team (${members.length})
           </div>
           <div class="tcc-team-grid">${members.map(_renderMemberCard).join('')}</div>`
        : `<div class="tcc-team-empty">
               ${tccIcon('users', 20, '#cbd5e1')}
               <span>Nog geen teamleden toegewezen</span>
           </div>`;

    return `
    <div class="tcc-tab-panel${tccState.activeTab === 'team' ? ' is-active' : ''}" data-panel="team">
        <div class="tcc-team-container">

            ${warningHtml}

            <!-- Toevoegen card -->
            ${_renderAddCard(available, allRoles)}

            <!-- Huidige teamleden -->
            ${memberCardsHtml}

            <!-- Rolverdeling sectie -->
            <div class="tcc-section is-open">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('clipboardList', 16)}<span>Rolverdeling</span>
                    <span class="tcc-section-count">${team.filledRoles}/${team.totalRoles}</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div class="tcc-team-rol-list">${_renderRolverdeling(rolVerdeling)}</div>
                </div>
            </div>

            <!-- Workload sectie -->
            <div class="tcc-section is-open">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('barChart', 16)}<span>Workload</span>
                    <span class="tcc-section-meta">Komende 4 weken</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div id="tcc-team-workload" class="tcc-team-workload-container">
                        <div style="display:flex;align-items:center;gap:8px;padding:20px;color:#94a3b8;font-size:13px;">
                            <div class="planning-spinner" style="width:16px;height:16px;border-width:2px;"></div> Workload laden…
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toewijzingscriteria -->
            <div class="tcc-section">
                <div class="tcc-section-header" data-action="toggle-section">
                    ${tccIcon('info', 16)}<span>Toewijzingscriteria</span>
                    <span class="tcc-section-chevron">${tccIcon('chevronDown', 14)}</span>
                </div>
                <div class="tcc-section-body">
                    <div class="tcc-team-criteria">
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#eef2ff;color:#4338ca;">${tccIcon('user', 14)}</div>
                            <div><strong>Rol-gebaseerd</strong><p>Elke taak heeft een rol. Het teamlid met die rol krijgt de taak automatisch toegewezen.</p></div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#fef3c7;color:#92400e;">${tccIcon('users', 14)}</div>
                            <div><strong>Gedeelde verantwoordelijkheid</strong><p>Als meerdere teamleden dezelfde rol hebben, worden zij allemaal aan de taak gekoppeld.</p></div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#f0fdf4;color:#166534;">${tccIcon('calendarView', 14)}</div>
                            <div><strong>Volgorde &amp; Deadlines</strong><p>Taken worden terugwaarts gepland vanaf de indiendatum. Weekenden worden overgeslagen.</p></div>
                        </div>
                        <div class="tcc-team-criteria-item">
                            <div class="tcc-team-criteria-icon" style="background:#fef2f2;color:#dc2626;">${tccIcon('warning', 14)}</div>
                            <div><strong>Vacante rollen</strong><p>Als een rol niet is ingevuld, worden taken zonder toewijzing aangemaakt.</p></div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>`;
}

// ============================================
// HANDLERS — Zoeken & selecteren
// ============================================

function handleTeamSearchInput(value) {
    _tccTeamState.searchQuery = value;
    _tccTeamState.selectedMemberId = null; // reset bij nieuw zoeken
    _refreshSearchArea();
}

function handleTeamSearchSelect(memberId) {
    _tccTeamState.selectedMemberId =
        _tccTeamState.selectedMemberId === memberId ? null : memberId;
    _refreshSearchArea();
}

function handleTeamRolSelect(rol) {
    _tccTeamState.selectedRol = rol;
    _refreshSearchArea();
}

function _refreshSearchArea() {
    const panel = tccState.overlay?.querySelector('[data-panel="team"]');
    if (!panel) return;

    const team = tccState.data?.team || {};
    const available = team.available || [];
    const allRoles = team.allRoles || [];

    // Vervang de add-card
    const existingCard = panel.querySelector('.tcc-team-add-card');
    if (existingCard) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = _renderAddCard(available, allRoles);
        existingCard.replaceWith(tempDiv.firstElementChild);
    }

    // Focus teruggeven aan input na re-render
    const input = panel.querySelector('#tcc-team-search-input');
    if (input) {
        input.focus();
        // Cursor aan het einde zetten
        const len = input.value.length;
        input.setSelectionRange(len, len);
    }
}

// ============================================
// HANDLERS — Team toevoegen / verwijderen
// ============================================

async function handleTeamAddMember() {
    const memberId = _tccTeamState.selectedMemberId;
    const rol = _tccTeamState.selectedRol || 'schrijver';

    if (!memberId) { showTccToast('Selecteer eerst een teamlid', 'error'); return; }

    try {
        const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
        if (!tender) throw new Error('Tender niet gevonden');

        const currentAssignments = tender.tender_team_assignments || tender.team_members || [];
        if (currentAssignments.some(a => (a.team_member_id || a.user_id || a.id) === memberId)) {
            showTccToast('Dit teamlid is al toegewezen', 'error');
            return;
        }

        await tccApiCall(`/api/v1/tenders/${tccState.tenderId}/team-assignments`, {
            method: 'POST',
            body: JSON.stringify({ team_member_id: memberId, rol_in_tender: rol, geplande_uren: 0 })
        });

        // State resetten na toevoegen
        _tccTeamState.selectedMemberId = null;
        _tccTeamState.searchQuery = '';

        showTccToast('Teamlid toegevoegd', 'success');
        await refreshTccAfterTeamChange();

    } catch (e) {
        console.error('[TCC] Team add error:', e);
        showTccToast(`Toevoegen mislukt: ${e.message}`, 'error');
    }
}

function handleTeamAddCancel() {
    _tccTeamState.selectedMemberId = null;
    _tccTeamState.searchQuery = '';
    _refreshSearchArea();
}

async function handleTeamRemoveMember(memberId) {
    if (!memberId || !tccState.tenderId) return;

    const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    const assignments = tender?.tender_team_assignments || tender?.team_members || [];
    const member = assignments.find(a => (a.team_member_id || a.user_id || a.id) === memberId);
    const naam = member?.naam || member?.team_member?.naam || 'dit teamlid';

    if (!confirm(`Weet je zeker dat je ${naam} wilt verwijderen?`)) return;

    try {
        await tccApiCall(`/api/v1/tenders/${tccState.tenderId}/team-assignments/${memberId}`, { method: 'DELETE' });
        showTccToast(`${naam} verwijderd`, 'success');
        await refreshTccAfterTeamChange();
    } catch (e) {
        console.error('[TCC] Team remove error:', e);
        showTccToast(`Verwijderen mislukt: ${e.message}`, 'error');
    }
}

// ============================================
// REFRESH na wijziging
// ============================================

async function refreshTccAfterTeamChange() {
    try {
        const teamResult = await tccApiCall(`/api/v1/tenders/${tccState.tenderId}/team-assignments`);
        const freshAssignments = teamResult?.data || [];

        const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
        if (tender) {
            tender.tender_team_assignments = freshAssignments;
            tender.team_members = freshAssignments;
        }

        let bureauTeamMembers = [];
        try {
            const tenderBureauId = tender?.tenderbureau_id;
            if (tenderBureauId) {
                const btResult = await tccApiCall(`/api/v1/team-members?tenderbureau_id=${tenderBureauId}`);
                bureauTeamMembers = btResult?.data || [];
            }
        } catch (e) { /* ignore */ }

        const team = transformTeam(tender || { tender_team_assignments: freshAssignments }, bureauTeamMembers);

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

        // Badge in tab bijwerken
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

        if (tccState.activeTab === 'team') loadTeamWorkload();

    } catch (e) {
        console.error('[TCC] Team refresh error:', e);
    }
}

// ============================================
// WORKLOAD
// ============================================

async function loadTeamWorkload() {
    const container = tccState.overlay?.querySelector('#tcc-team-workload');
    if (!container) return;

    const tender = window.app?.tenders?.find(t => t.id === tccState.tenderId);
    const teamMembers = tender?.team_members || tender?.tender_team_assignments || [];

    if (teamMembers.length === 0) {
        container.innerHTML = `<div class="tcc-team-empty" style="padding:16px;">
            ${tccIcon('users', 16, '#cbd5e1')}
            <span>Voeg teamleden toe om workload te bekijken</span>
        </div>`;
        return;
    }

    const userIds = teamMembers.map(tm => tm.team_member_id || tm.user_id).filter(Boolean);
    if (userIds.length === 0) {
        container.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;">Geen teamleden met user ID gevonden</div>';
        return;
    }

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
        renderWorkloadFromLocal(container, userIds, teamMembers);
    }
}

function renderWorkloadBars(container, workloadData, teamMembers) {
    const memberWorkloads = workloadData?.workload || workloadData?.data || [];
    const maxTaken = 20;

    const barsHtml = teamMembers.map(tm => {
        const userId = tm.team_member_id || tm.user_id;
        const naam = tm.naam || tm.email || 'Onbekend';
        const initialen = naam.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
        const avatarKleur = tm.avatar_kleur || '#6366f1';
        const memberData = memberWorkloads.find(w => w.user_id === userId || w.id === userId);
        const takenCount = memberData?.total_taken || memberData?.count || 0;
        const percentage = Math.min(Math.round((takenCount / maxTaken) * 100), 100);
        const wClass = _workloadClass(percentage);

        return `
        <div class="tcc-team-workload-row">
            <div class="tcc-team-workload-avatar" style="background:${avatarKleur};">${escHtml(initialen)}</div>
            <div class="tcc-team-workload-info">
                <div class="tcc-team-workload-name">${escHtml(naam)}</div>
                <div class="tcc-team-workload-bar-bg">
                    <div class="tcc-team-workload-bar-fill tcc-team-workload-fill--${wClass}"
                         style="width:${percentage}%;"></div>
                </div>
            </div>
            <div class="tcc-team-workload-stats">
                <span class="tcc-team-workload-count">${takenCount}/${maxTaken}</span>
                <span class="tcc-team-workload-pct">${percentage}%</span>
                ${percentage >= 80 ? `<span>${tccIcon('warning', 12, '#ef4444')}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="tcc-team-workload-list">${barsHtml}</div>
        <div class="tcc-team-workload-legend">
            <span style="color:#16a34a;">● Beschikbaar</span>
            <span style="color:#d97706;">● Druk</span>
            <span style="color:#dc2626;">● Overbelast</span>
        </div>`;
}

function renderWorkloadFromLocal(container, userIds, teamMembers) {
    container.innerHTML = `
    <div style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:12px;color:#78350f;">
            ${tccIcon('info', 12)} Workload API niet beschikbaar
        </div>
        ${teamMembers.map(tm => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#475569;">
                <span style="width:8px;height:8px;border-radius:50%;background:#cbd5e1;"></span>
                ${escHtml(tm.naam || tm.email || 'Onbekend')} — <span style="color:#94a3b8;">workload onbekend</span>
            </div>`).join('')}
    </div>`;
}

// ============================================
// CSS INJECTIE
// ============================================

(function injectTeamCSS() {
    if (document.getElementById('tcc-team-css')) return;
    const style = document.createElement('style');
    style.id = 'tcc-team-css';
    style.textContent = `

/* ── Container ── */
.tcc-team-container { display: flex; flex-direction: column; gap: 16px; }

/* ── Warning banner ── */
.tcc-team-warning {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 8px;
    background: #fffbeb; border: 1px solid #fcd34d;
    font-size: 13px; color: #78350f;
}

/* ── Add card ── */
.tcc-team-add-card {
    background: #fff; border: 1.5px dashed #c4b5fd; border-radius: 12px;
    padding: 18px 20px;
}
.tcc-team-add-title {
    font-size: 14px; font-weight: 600; color: #0f172a;
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
}
.tcc-team-add-empty {
    display: flex; align-items: center; gap: 8px;
    padding: 16px; color: #94a3b8; font-size: 13px;
}

/* ── Zoekbalk ── */
.tcc-team-search-row { display: flex; gap: 8px; margin-bottom: 10px; }
.tcc-team-search-input {
    flex: 1; padding: 8px 12px;
    border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 13px; color: #0f172a; outline: none;
    transition: border-color .15s, box-shadow .15s;
}
.tcc-team-search-input:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124,58,237,.1);
}

/* ── Zoekresultaten ── */
.tcc-team-search-results {
    border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
}
.tcc-team-search-result-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-bottom: 1px solid #f1f5f9;
    cursor: pointer; transition: background .1s;
}
.tcc-team-search-result-item:last-child { border-bottom: none; }
.tcc-team-search-result-item:hover { background: #f8fafc; }
.tcc-team-search-result-item.selected { background: #ede9fe; }
.tcc-team-search-empty {
    padding: 12px 14px; font-size: 13px; color: #94a3b8; font-style: italic;
}
.tcc-team-result-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.tcc-team-result-info { flex: 1; min-width: 0; }
.tcc-team-result-name { font-size: 13px; font-weight: 500; color: #0f172a; }
.tcc-team-result-sub  { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.tcc-team-result-workload {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px;
    white-space: nowrap;
}
.tcc-team-result-workload--vrij { background: #dcfce7; color: #16a34a; }
.tcc-team-result-workload--druk { background: #fef3c7; color: #d97706; }
.tcc-team-result-workload--vol  { background: #fef2f2; color: #dc2626; }

/* ── Rol pill-knoppen ── */
.tcc-team-role-select { display: flex; gap: 8px; flex-wrap: wrap; }
.tcc-team-role-option {
    padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0;
    font-size: 12px; font-weight: 500; cursor: pointer;
    transition: all .15s; color: #475569; user-select: none;
}
.tcc-team-role-option:hover   { border-color: #c4b5fd; color: #7c3aed; }
.tcc-team-role-option.selected { background: #7c3aed; border-color: #7c3aed; color: #fff; }

/* ── Teamleden grid ── */
.tcc-team-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
@media (max-width: 640px) { .tcc-team-grid { grid-template-columns: 1fr; } }

/* ── Teamlid card ── */
.tcc-team-member-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px;
    transition: border-color .15s;
}
.tcc-team-member-card:hover { border-color: #c7d2fe; }
.tcc-team-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: #fff;
}
.tcc-team-member-info { flex: 1; min-width: 0; }
.tcc-team-member-name { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
.tcc-team-member-role { font-size: 12px; color: #64748b; margin-bottom: 6px; }
.tcc-team-member-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.tcc-team-member-actions { flex-shrink: 0; }

/* Rol-tags op cards */
.tcc-team-tag {
    font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 6px;
}
.tcc-team-tag--lead    { background: #ede9fe; color: #7c3aed; }
.tcc-team-tag--writer  { background: #dbeafe; color: #2563eb; }
.tcc-team-tag--calc    { background: #f0fdf4; color: #16a34a; }
.tcc-team-tag--review  { background: #fef3c7; color: #d97706; }
.tcc-team-tag--design  { background: #fce7f3; color: #db2777; }
.tcc-team-tag--support { background: #f0fdf4; color: #16a34a; }
.tcc-team-tag--uren    { background: #f1f5f9; color: #64748b; }

/* ── Workload bar op card ── */
.tcc-team-workload {
    display: flex; align-items: center; gap: 8px;
}
.tcc-team-workload-bar {
    flex: 1; height: 4px; background: #f1f5f9; border-radius: 2px; overflow: hidden;
}
.tcc-team-workload-fill { height: 100%; border-radius: 2px; }
.tcc-team-workload-fill--low    { background: #16a34a; }
.tcc-team-workload-fill--medium { background: #d97706; }
.tcc-team-workload-fill--high   { background: #dc2626; }
.tcc-team-workload-label { font-size: 11px; color: #94a3b8; font-weight: 500; white-space: nowrap; }

/* ── Empty state ── */
.tcc-team-empty {
    display: flex; align-items: center; gap: 10px;
    padding: 24px; color: #94a3b8; font-size: 13px;
    background: #f8fafc; border-radius: 10px; border: 1px dashed #e2e8f0;
}

/* ── Rolverdeling ── */
.tcc-team-rol-list { display: flex; flex-direction: column; gap: 2px; }
.tcc-team-rol-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px;
    border-radius: 8px; transition: background .1s;
}
.tcc-team-rol-row:hover { background: #f8fafc; }
.tcc-team-rol-row--warn { background: #fffbeb; }
.tcc-team-rol-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 500; color: #374151;
    width: 150px; flex-shrink: 0;
}
.tcc-team-rol-req { color: #dc2626; font-weight: 700; margin-left: 2px; }
.tcc-team-rol-assigned { flex: 1; font-size: 13px; color: #475569; }
.tcc-team-rol-status {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 500; white-space: nowrap;
}
.tcc-team-rol-status--ok   { color: #16a34a; }
.tcc-team-rol-status--warn { color: #d97706; }
.tcc-team-rol-status--empty { color: #94a3b8; }

/* ── Workload sectie (API) ── */
.tcc-team-workload-container { padding: 4px 0; }
.tcc-team-workload-list { display: flex; flex-direction: column; gap: 10px; padding: 8px 4px; }
.tcc-team-workload-row {
    display: flex; align-items: center; gap: 10px;
}
.tcc-team-workload-avatar {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
}
.tcc-team-workload-info { flex: 1; min-width: 0; }
.tcc-team-workload-name { font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px; }
.tcc-team-workload-bar-bg {
    height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;
}
.tcc-team-workload-bar-fill { height: 100%; border-radius: 3px; transition: width .3s; }
.tcc-team-workload-stats {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: #64748b; white-space: nowrap;
}
.tcc-team-workload-count { font-weight: 600; }
.tcc-team-workload-pct  { color: #94a3b8; }
.tcc-team-workload-legend {
    display: flex; gap: 14px; padding: 8px 4px 4px;
    font-size: 11px; color: #64748b; flex-wrap: wrap;
}

/* ── Criteria ── */
.tcc-team-criteria { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
.tcc-team-criteria-item { display: flex; align-items: flex-start; gap: 12px; }
.tcc-team-criteria-icon {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
}
.tcc-team-criteria-item strong { font-size: 13px; font-weight: 600; color: #0f172a; display: block; margin-bottom: 2px; }
.tcc-team-criteria-item p { font-size: 12px; color: #64748b; line-height: 1.5; }
    `;
    document.head.appendChild(style);
})();