// ================================================================
// TenderZen — Smart Import v5.1 — Stap 1: Basisgegevens
// Frontend/js/components/smart-import/BasicInfoStep.js
// ================================================================

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

        // Laad alleen bedrijven van het actieve tenderbureau
        try {
            const sb = window.supabaseClient || window.supabase;
            if (sb && this.bureauId) {
                const { data } = await sb
                    .from('bedrijven')
                    .select('id, bedrijfsnaam, plaats')
                    .eq('tenderbureau_id', this.bureauId)
                    .order('bedrijfsnaam', { ascending: true });
                this.bedrijven = data || [];
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
            </div>
        </div>`;
    }

    attachListeners(container) {
        // Pre-selecteer bedrijf als state al een waarde heeft
        if (this.state.bedrijfId) {
            const sel = container.querySelector('#si-basic-bedrijf');
            if (sel) sel.value = this.state.bedrijfId;
        }
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
        return {
            tenderNaam: document.getElementById('si-basic-naam')?.value?.trim() || this.state.tenderNaam || '',
            opdrachtgever: document.getElementById('si-basic-opdrachtgever')?.value?.trim() || '',
            bedrijfId: document.getElementById('si-basic-bedrijf')?.value || null,
            deadline: document.getElementById('si-basic-deadline')?.value || null,
            tenderbureauId: this.bureauId,
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
