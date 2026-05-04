// ================================================================
// TenderZen — Smart Import v5.1 — Stap 1: Basisgegevens
// Frontend/js/components/smart-import/BasicInfoStep.js
// ================================================================

const CLAUDE_MODELLEN = [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  omschrijving: 'Snel & goedkoop — voor eenvoudige taken',         badge: 'Snel',       badgeKleur: '#16a34a' },
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', omschrijving: 'Beste balans van kwaliteit en snelheid',           badge: 'Aanbevolen', badgeKleur: '#7c3aed' },
    { id: 'claude-opus-4-6',           label: 'Opus 4.6',   omschrijving: 'Hoge kwaliteit — voor complexe analyses',         badge: 'Pro',        badgeKleur: '#d97706' },
    { id: 'claude-opus-4-7',           label: 'Opus 4.7',   omschrijving: 'Nieuwste flagship — maximale kwaliteit',          badge: 'Nieuwst',    badgeKleur: '#dc2626' },
];
const DEFAULT_SI_MODEL = 'claude-sonnet-4-6';

class BasicInfoStep {
    constructor(state) {
        this.state = state;
    }

    async init() {
        // Bureau info uit state of globale context
        this.bureauNaam = this.state.tenderbureauNaam
            || window.bureauAccessService?.getCurrentBureau?.()?.bureau_naam
            || '';
        this.bureauId = this.state.tenderbureauId
            || window.bureauAccessService?.getCurrentBureau?.()?.bureau_id
            || null;

        // Laad alleen bedrijven van het actieve tenderbureau (via koppeltabel)
        try {
            const sb = window.supabaseClient || window.supabase;
            if (sb && this.bureauId) {
                // Stap 1: gekoppelde bedrijf IDs ophalen
                const { data: relaties } = await sb
                    .from('bureau_bedrijf_relaties')
                    .select('bedrijf_id')
                    .eq('tenderbureau_id', this.bureauId)
                    .eq('status', 'actief');

                const bedrijfIds = (relaties || []).map(r => r.bedrijf_id);

                if (bedrijfIds.length > 0) {
                    // Stap 2: bedrijven ophalen
                    const { data } = await sb
                        .from('bedrijven')
                        .select('id, bedrijfsnaam, plaats')
                        .in('id', bedrijfIds)
                        .order('bedrijfsnaam', { ascending: true });
                    this.bedrijven = data || [];
                } else {
                    this.bedrijven = [];
                }
            } else {
                this.bedrijven = [];
            }
        } catch (e) {
            console.warn('⚠️ Bedrijven laden mislukt:', e);
            this.bedrijven = [];
        }
    }

    render() {
        const bedrijfOpties = this.bedrijven.map(b =>
            `<option value="${b.id}">${b.bedrijfsnaam || b.naam || 'Onbekend'}${b.plaats ? ' — ' + b.plaats : ''}</option>`
        ).join('');

        // Als er al een tender gekoppeld is (openAsModal), toon die info
        const heeftTender = !!(this.state.tenderId && this.state.tenderNaam);

        return `
        <div class="si-basic-info">
            ${heeftTender ? `
            <div class="si-upload-for-tender" style="margin-bottom:18px;">
                <span class="si-upload-tender-label">Importeren voor:</span>
                <span class="si-upload-tender-name">${this._esc(this.state.tenderNaam)}</span>
            </div>
            ` : ''}

            <div class="si-basic-info-form">
                ${!heeftTender ? `
                <div class="si-basic-field">
                    <label class="si-field-label">Tendernaam <span style="color:#dc2626;">*</span></label>
                    <input type="text" class="si-field-input" id="si-basic-naam"
                           placeholder="Naam van de aanbesteding"
                           value="${this._esc(this.state.tenderNaam || '')}" />
                </div>
                ` : ''}

                <div class="si-basic-row">
                    <div class="si-basic-field si-basic-field--half">
                        <label class="si-field-label">Tenderbureau</label>
                        <div class="si-basic-readonly">
                            <span style="display:inline-flex;align-items:center;gap:6px;">
                                <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>
                                ${this._esc(this.bureauNaam || 'Niet ingesteld')}
                            </span>
                        </div>
                    </div>
                    <div class="si-basic-field si-basic-field--half">
                        <label class="si-field-label">Inschrijvend bedrijf <span style="color:#dc2626;">*</span></label>
                        <select class="si-field-input" id="si-basic-bedrijf">
                            <option value="">Selecteer bedrijf...</option>
                            ${bedrijfOpties}
                        </select>
                    </div>
                </div>

                <div class="si-basic-field">
                    <label class="si-field-label">Aanbestedende dienst <span style="color:#dc2626;">*</span></label>
                    <input type="text" class="si-field-input" id="si-basic-opdrachtgever"
                           placeholder="Bijv. Gemeente Amsterdam, Rijkswaterstaat..."
                           value="${this._esc(this.state.opdrachtgever || '')}" />
                </div>

                <div class="si-basic-field" style="max-width:240px;">
                    <label class="si-field-label">Deadline indiening <span style="color:#94a3b8;font-weight:400;text-transform:none;">(optioneel)</span></label>
                    <input type="date" class="si-field-input" id="si-basic-deadline"
                           value="${this._esc(this.state.deadline || '')}" />
                </div>

                <div class="si-basic-field">
                    <label class="si-field-label">AI Model</label>
                    <div class="si-model-grid">
                        ${CLAUDE_MODELLEN.map(m => {
                            const geselecteerd = (this.state.selectedModel || DEFAULT_SI_MODEL) === m.id;
                            return `
                            <label class="si-model-optie${geselecteerd ? ' si-model-optie--actief' : ''}">
                                <input type="radio" name="si-model" value="${m.id}" ${geselecteerd ? 'checked' : ''} style="display:none;">
                                <div class="si-model-optie-body">
                                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                                        <span style="font-weight:600;font-size:13px;color:#0f172a;">${m.label}</span>
                                        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${m.badgeKleur}20;color:${m.badgeKleur};">${m.badge}</span>
                                    </div>
                                    <span style="font-size:11px;color:#64748b;">${m.omschrijving}</span>
                                </div>
                            </label>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    }

    attachListeners(container) {
        if (this.state.bedrijfId) {
            const sel = container.querySelector('#si-basic-bedrijf');
            if (sel) sel.value = this.state.bedrijfId;
        }

        // Model-selector: highlight actieve optie bij klik
        container.querySelectorAll('.si-model-optie input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                container.querySelectorAll('.si-model-optie').forEach(el => el.classList.remove('si-model-optie--actief'));
                radio.closest('.si-model-optie')?.classList.add('si-model-optie--actief');
            });
        });
    }

    validate() {
        const naam = document.getElementById('si-basic-naam');
        const opdrachtgever = document.getElementById('si-basic-opdrachtgever');
        const bedrijf = document.getElementById('si-basic-bedrijf');

        // Als tender al gekoppeld is, naam is niet nodig
        if (!this.state.tenderId) {
            if (!naam?.value?.trim()) {
                naam?.focus();
                if (naam?.style) naam.style.borderColor = '#dc2626';
                return false;
            }
        }

        if (!opdrachtgever?.value?.trim()) {
            opdrachtgever?.focus();
            if (opdrachtgever?.style) opdrachtgever.style.borderColor = '#dc2626';
            return false;
        }

        if (!bedrijf?.value) {
            bedrijf?.focus();
            if (bedrijf?.style) bedrijf.style.borderColor = '#dc2626';
            return false;
        }

        return true;
    }

    getData() {
        const gekozenModel = document.querySelector('input[name="si-model"]:checked')?.value || DEFAULT_SI_MODEL;
        return {
            tenderNaam: document.getElementById('si-basic-naam')?.value?.trim() || this.state.tenderNaam || '',
            opdrachtgever: document.getElementById('si-basic-opdrachtgever')?.value?.trim() || '',
            bedrijfId: document.getElementById('si-basic-bedrijf')?.value || null,
            deadline: document.getElementById('si-basic-deadline')?.value || null,
            tenderbureauId: this.bureauId,
            selectedModel: gekozenModel,
        };
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
}

export { BasicInfoStep };
export default BasicInfoStep;
