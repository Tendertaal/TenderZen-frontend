/* ============================================
   TENDERZEN - ICONEN OVERZICHT VIEW
   Versie 1.0
   
   Toont alle iconen uit IconConfig per categorie
   Alleen zichtbaar voor super-admins
   ============================================ */

class IconenOverzichtView {
    constructor() {
        this.container = null;
    }

    /**
     * Helper om icoon op te halen
     */
    getIcon(name, size = 20, color = null) {
        if (typeof Icons !== 'undefined' && Icons[name]) {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return `<span style="color: #ef4444;">[${name}]</span>`;
    }

    /**
     * Render een categorie kaart
     */
    renderCategoryCard(categoryName, categoryLabel, items, description = '') {
        const itemsHtml = Object.entries(items).map(([key, iconName]) => {
            return `
                <div class="icon-item">
                    <div class="icon-preview">
                        ${this.getIcon(iconName, 24)}
                    </div>
                    <div class="icon-info">
                        <span class="icon-key">${key}</span>
                        <span class="icon-name">${iconName}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="icon-category-card">
                <div class="category-header">
                    <h3 class="category-title">${categoryLabel}</h3>
                    <span class="category-path">IconConfig.${categoryName}</span>
                </div>
                ${description ? `<p class="category-description">${description}</p>` : ''}
                <div class="icon-items-grid">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Render de volledige view
     */
    render() {
        // Check of IconConfig bestaat
        if (typeof IconConfig === 'undefined') {
            return `
                <div class="iconen-overzicht-view">
                    <div class="error-state">
                        <p>IconConfig is niet geladen. Zorg dat icons.js correct is geïmporteerd.</p>
                    </div>
                </div>
            `;
        }

        // Categorie definities met labels en beschrijvingen
        const categories = [
            {
                name: 'tenderCard',
                label: '📋 Tender Kaart',
                description: 'Iconen die op de tender cards in de lijst worden getoond'
            },
            {
                name: 'tenderForm',
                label: '📝 Tender Formulier',
                description: 'Iconen voor de secties in het tender aanmaak/bewerk formulier'
            },
            {
                name: 'header',
                label: '🔝 Header & Navigatie',
                description: 'Iconen in de header en navigatie elementen'
            },
            {
                name: 'views',
                label: '👁️ Weergaves',
                description: 'Iconen voor de verschillende weergave opties'
            },
            {
                name: 'modules',
                label: '📦 Modules',
                description: 'Iconen voor de modules in het apps menu'
            },
            {
                name: 'profiel',
                label: '👤 Profiel Menu',
                description: 'Iconen in het profiel dropdown menu'
            },
            {
                name: 'acties',
                label: '⚡ Acties',
                description: 'Iconen voor actieknoppen (toevoegen, bewerken, verwijderen, etc.)'
            },
            {
                name: 'feedback',
                label: '💬 Feedback',
                description: 'Iconen voor feedback en statusberichten'
            },
            {
                name: 'tenderStatus',
                label: '🚦 Tender Status',
                description: 'Iconen voor Go/No-Go beslissingen'
            },
            {
                name: 'bedrijven',
                label: '🏢 Bedrijven',
                description: 'Iconen in de bedrijven module'
            },
            {
                name: 'teamleden',
                label: '👥 Teamleden',
                description: 'Iconen in de teamleden module'
            },
            {
                name: 'security',
                label: '🔒 Beveiliging',
                description: 'Iconen voor MFA en beveiligingsfuncties'
            },
            {
                name: 'overig',
                label: '📎 Overig',
                description: 'Overige iconen voor algemeen gebruik'
            }
        ];

        // Bouw de categorieën HTML
        const categoriesHtml = categories
            .filter(cat => IconConfig[cat.name]) // Alleen bestaande categorieën
            .map(cat => this.renderCategoryCard(
                cat.name,
                cat.label,
                IconConfig[cat.name],
                cat.description
            ))
            .join('');

        // Tel totaal aantal iconen
        let totalIcons = 0;
        categories.forEach(cat => {
            if (IconConfig[cat.name]) {
                totalIcons += Object.keys(IconConfig[cat.name]).length;
            }
        });

        return `
            <div class="iconen-overzicht-view">
                <style>
                    .iconen-overzicht-view {
                        padding: 24px;
                        max-width: 1400px;
                        margin: 0 auto;
                    }

                    .page-header {
                        margin-bottom: 32px;
                    }

                    .page-title {
                        font-size: 28px;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 0 0 8px 0;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    .page-subtitle {
                        color: #64748b;
                        font-size: 15px;
                        margin: 0;
                    }

                    .stats-bar {
                        display: flex;
                        gap: 24px;
                        margin-top: 16px;
                        padding: 16px 20px;
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                        border-radius: 12px;
                        border: 1px solid #e2e8f0;
                    }

                    .stat-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .stat-value {
                        font-size: 24px;
                        font-weight: 700;
                        color: #6366f1;
                    }

                    .stat-label {
                        font-size: 13px;
                        color: #64748b;
                    }

                    .categories-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                        gap: 24px;
                    }

                    .icon-category-card {
                        background: white;
                        border-radius: 16px;
                        border: 1px solid #e2e8f0;
                        overflow: hidden;
                        transition: box-shadow 0.2s ease;
                    }

                    .icon-category-card:hover {
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    }

                    .category-header {
                        padding: 16px 20px;
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                        border-bottom: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 8px;
                    }

                    .category-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #1e293b;
                        margin: 0;
                    }

                    .category-path {
                        font-size: 12px;
                        font-family: 'SF Mono', Monaco, monospace;
                        color: #6366f1;
                        background: #eef2ff;
                        padding: 4px 8px;
                        border-radius: 6px;
                    }

                    .category-description {
                        padding: 12px 20px 0;
                        margin: 0;
                        font-size: 13px;
                        color: #64748b;
                    }

                    .icon-items-grid {
                        padding: 16px;
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 12px;
                    }

                    .icon-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        background: #f8fafc;
                        border-radius: 10px;
                        border: 1px solid #e2e8f0;
                        transition: all 0.15s ease;
                    }

                    .icon-item:hover {
                        background: #f1f5f9;
                        border-color: #cbd5e1;
                        transform: translateY(-1px);
                    }

                    .icon-preview {
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                        flex-shrink: 0;
                    }

                    .icon-preview svg {
                        color: #475569;
                    }

                    .icon-info {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        min-width: 0;
                    }

                    .icon-key {
                        font-size: 13px;
                        font-weight: 500;
                        color: #1e293b;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .icon-name {
                        font-size: 11px;
                        font-family: 'SF Mono', Monaco, monospace;
                        color: #64748b;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .usage-section {
                        margin-top: 32px;
                        padding: 24px;
                        background: #1e293b;
                        border-radius: 16px;
                        color: white;
                    }

                    .usage-title {
                        font-size: 18px;
                        font-weight: 600;
                        margin: 0 0 16px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .code-block {
                        background: #0f172a;
                        padding: 16px;
                        border-radius: 10px;
                        font-family: 'SF Mono', Monaco, monospace;
                        font-size: 13px;
                        line-height: 1.6;
                        overflow-x: auto;
                    }

                    .code-comment {
                        color: #64748b;
                    }

                    .code-key {
                        color: #a5b4fc;
                    }

                    .code-string {
                        color: #86efac;
                    }

                    .code-method {
                        color: #fcd34d;
                    }

                    .error-state {
                        text-align: center;
                        padding: 48px;
                        color: #64748b;
                    }

                    @media (max-width: 768px) {
                        .categories-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .icon-items-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>

                <div class="page-header">
                    <h1 class="page-title">
                        ${this.getIcon('grid', 28)}
                        Iconen Overzicht
                    </h1>
                    <p class="page-subtitle">
                        Centrale configuratie van alle iconen in TenderZen. 
                        Wijzig een icoon op één plek en het verandert overal in de applicatie.
                    </p>
                    <div class="stats-bar">
                        <div class="stat-item">
                            <span class="stat-value">${totalIcons}</span>
                            <span class="stat-label">Geconfigureerde iconen</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${categories.filter(c => IconConfig[c.name]).length}</span>
                            <span class="stat-label">Categorieën</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${typeof Icons !== 'undefined' ? Object.keys(Icons).length : 0}</span>
                            <span class="stat-label">Beschikbare iconen</span>
                        </div>
                    </div>
                </div>

                <div class="categories-grid">
                    ${categoriesHtml}
                </div>

                <div class="usage-section">
                    <h3 class="usage-title">
                        ${this.getIcon('info', 20, '#ffffff')}
                        Hoe iconen wijzigen?
                    </h3>
                    <div class="code-block">
                        <span class="code-comment">// In icons.js, zoek de IconConfig sectie:</span><br><br>
                        <span class="code-key">tenderCard</span>: {<br>
                        &nbsp;&nbsp;<span class="code-key">inschrijver</span>: <span class="code-string">'hardhat'</span>, <span class="code-comment">// ← Wijzig dit naar bijv. 'briefcase'</span><br>
                        &nbsp;&nbsp;<span class="code-key">aanbestedendeDienst</span>: <span class="code-string">'landmark'</span>,<br>
                        &nbsp;&nbsp;...<br>
                        }<br><br>
                        <span class="code-comment">// In je component gebruik je:</span><br>
                        <span class="code-method">this.getIcon</span>(<span class="code-key">IconConfig.tenderCard.inschrijver</span>, 14)
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Mount de view in een container
     */
    mount(container) {
        this.container = container;
        this.container.innerHTML = this.render();
    }

    /**
     * Unmount de view
     */
    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Cleanup (alias voor unmount)
     */
    destroy() {
        this.unmount();
    }
}

// ES Module export
export { IconenOverzichtView };

// Global beschikbaar maken (voor backwards compatibility)
window.IconenOverzichtView = IconenOverzichtView;