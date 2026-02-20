/**
 * IMPLEMENTATIE VOORBEELD: TCC Planning Tab
 * 
 * Laat zien hoe UserResolutionHelper te gebruiken in bestaande components.
 * Pas dit patroon toe in PlanningModal.js, KanbanView.js, AgendaView.js
 */

import { initUserResolver, getUserResolver } from './UserResolutionHelper.js';

// ═══════════════════════════════════════════════════════════════
// STAP 1: Initialiseer bij laden van team members
// ═══════════════════════════════════════════════════════════════

class PlanningModal {
    constructor() {
        this.userResolver = null;
        // ... rest van constructor
    }

    async loadData(tenderId) {
        // Haal team members op
        const teamMembers = await this._loadTeamMembers();
        
        // Initialiseer user resolver
        this.userResolver = initUserResolver(teamMembers);
        
        // Haal planning taken op
        const taken = await this._loadPlanningTaken(tenderId);
        
        // Render met user resolution
        this._renderTaken(taken);
    }

    async _loadTeamMembers() {
        const response = await fetch(
            `${config.api}/api/v1/team-members?tenderbureau_id=${this.tenderbureauId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        return await response.json();
    }

    async _loadPlanningTaken(tenderId) {
        const response = await fetch(
            `${config.api}/api/v1/tenders/${tenderId}/planning`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        return await response.json();
    }
}

// ═══════════════════════════════════════════════════════════════
// STAP 2: Render taken met user resolution
// ═══════════════════════════════════════════════════════════════

function renderTaakRow(taak) {
    // taak.toegewezen_aan is nu: ["uuid1", "uuid2"]
    const userResolver = getUserResolver();
    
    const html = `
        <tr>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    ${taak.is_milestone ? 
                        '<svg class="w-5 h-5 text-amber-500">...</svg>' : 
                        ''
                    }
                    <span class="font-medium">${taak.taak_naam}</span>
                </div>
            </td>
            
            <td class="px-4 py-3">
                ${renderToegewezenAan(taak.toegewezen_aan)}
            </td>
            
            <td class="px-4 py-3">
                ${formatDate(taak.datum)}
            </td>
            
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(taak.status)}">
                    ${taak.status}
                </span>
            </td>
        </tr>
    `;
    
    return html;
}

function renderToegewezenAan(userIds) {
    const userResolver = getUserResolver();
    
    // Lege array = niet toegewezen
    if (!userIds || userIds.length === 0) {
        return `
            <button class="text-sm text-gray-500 hover:text-blue-600" onclick="assignUser(this)">
                <svg class="w-5 h-5 inline">...</svg>
                Toewijzen
            </button>
        `;
    }
    
    // Single user
    if (userIds.length === 1) {
        const userId = userIds[0];
        return `
            <div class="flex items-center gap-2">
                ${userResolver.renderAvatar(userId, 'sm')}
                <span class="text-sm">${userResolver.getUserName(userId)}</span>
            </div>
        `;
    }
    
    // Multiple users - gebruik stack
    return userResolver.renderAvatarStack(userIds, 3);
}

// ═══════════════════════════════════════════════════════════════
// STAP 3: Filter op user
// ═══════════════════════════════════════════════════════════════

function filterTakenByUser(taken, userId) {
    return taken.filter(taak => {
        const userIds = taak.toegewezen_aan || [];
        return userIds.includes(userId);
    });
}

// ═══════════════════════════════════════════════════════════════
// STAP 4: User assignment dialog
// ═══════════════════════════════════════════════════════════════

function renderUserSelector(currentUserIds = []) {
    const userResolver = getUserResolver();
    const allUsers = userResolver.teamMembers;
    
    let html = `
        <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">
                Toewijzen aan
            </label>
            <select 
                multiple 
                class="w-full border rounded-lg p-2"
                id="userSelect"
            >
    `;
    
    for (const user of allUsers) {
        const selected = currentUserIds.includes(user.id) ? 'selected' : '';
        html += `
            <option value="${user.id}" ${selected}>
                ${user.naam}
            </option>
        `;
    }
    
    html += `
            </select>
            <p class="text-xs text-gray-500">
                Houd Ctrl/Cmd ingedrukt om meerdere users te selecteren
            </p>
        </div>
    `;
    
    return html;
}

async function saveUserAssignment(taakId, selectedUserIds) {
    // selectedUserIds is array van UUIDs: ["uuid1", "uuid2"]
    
    const response = await fetch(
        `${config.api}/api/v1/planning/${taakId}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                toegewezen_aan: selectedUserIds  // Stuur als array
            })
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to update assignment');
    }
    
    // Refresh de view
    await loadData();
}

// ═══════════════════════════════════════════════════════════════
// STAP 5: Kanban card rendering (voorbeeld)
// ═══════════════════════════════════════════════════════════════

function renderKanbanCard(tender) {
    const userResolver = getUserResolver();
    
    // Haal eerste planning taak op voor preview
    const eersteTaak = tender.planning_taken?.[0];
    const toegewezenAan = eersteTaak?.toegewezen_aan || [];
    
    const html = `
        <div class="kanban-card">
            <div class="card-header">
                <h4>${tender.naam}</h4>
            </div>
            
            <div class="card-body">
                <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">
                        ${formatDate(tender.deadline)}
                    </span>
                    
                    <div class="flex -space-x-2">
                        ${renderAssignedAvatars(toegewezenAan)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function renderAssignedAvatars(userIds) {
    const userResolver = getUserResolver();
    
    if (!userIds || userIds.length === 0) {
        return '<span class="text-gray-400 text-sm">Niet toegewezen</span>';
    }
    
    return userResolver.renderAvatarStack(userIds, 3);
}

// ═══════════════════════════════════════════════════════════════
// EXPORT VOOR GEBRUIK IN BESTAANDE CODE
// ═══════════════════════════════════════════════════════════════

export {
    renderTaakRow,
    renderToegewezenAan,
    filterTakenByUser,
    renderUserSelector,
    saveUserAssignment,
    renderKanbanCard
};