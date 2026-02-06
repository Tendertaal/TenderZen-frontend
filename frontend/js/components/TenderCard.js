/**
 * TenderCard — Samengesteld kaart-component voor de lijstweergave
 * TenderZen v3.6 — 3-Band Layout: Header + Content + Footer (volle breedte)
 *
 * DOEL-PAD:  Frontend/js/components/TenderCard.js
 *
 * STRUCTUUR:
 *   tender-row (flex column)
 *   ├── tc-header-band    = solid bar (420px) + timeline headers (flex:1)
 *   ├── tc-content-band   = body-section (420px) + data-section (flex:1)
 *   └── tc-footer-band    = footer-left (420px) + footer-right (flex:1)
 *                            └── avatars/shortcuts    └── dagen-badge onder deadline
 *
 * CHANGELOG v3.6:
 * - Footer verplaatst van tc-body-section naar eigen tc-footer-band (volle breedte)
 * - "X dagen" badge verplaatst van timeline-cel naar tc-footer-right, onder deadline kolom
 * - tc-content-band bevat nu alleen body + timeline data (geen footer meer)
 */

import { TenderCardHeader, FASE_CONFIG } from './TenderCardHeader.js';
import { TenderCardBody } from './TenderCardBody.js';
import { TenderCardFooter } from './TenderCardFooter.js';

const SOLID_BAR_GRADIENTS = {
    acquisitie:     { start: '#d97706', end: '#f59e0b' },
    inschrijvingen: { start: '#6d5ccd', end: '#7c6fe0' },
    ingediend:      { start: '#059669', end: '#10b981' },
    evaluatie:      { start: '#0d9488', end: '#14b8a6' },
    archief:        { start: '#64748b', end: '#94a3b8' }
};

const TIMELINE_COLUMNS = [
    { field: 'publicatie_datum',    label: 'PUBLICATIE',      iconName: 'calendar' },
    { field: 'schouw_datum',        label: 'SCHOUW',          iconName: 'eye' },
    { field: 'nvi1_datum',          label: 'NVI 1',           iconName: 'info' },
    { field: 'nvi2_datum',          label: 'NVI 2',           iconName: 'info' },
    { field: 'presentatie_datum',   label: 'PRESENTATIE',     iconName: 'users' },
    { field: 'interne_deadline',    label: 'INTERN',          iconName: 'clock' },
    { field: 'deadline_indiening',  label: 'DEADLINE',        iconName: 'alertTriangle', isDeadline: true },
    { field: 'voorlopige_gunning',  label: 'VOORL. GUNNING', iconName: 'checkCircle' },
    { field: 'definitieve_gunning', label: 'DEF. GUNNING',   iconName: 'checkCircle' },
    { field: 'start_uitvoering',    label: 'START',           iconName: 'play' }
];

function getIcon(name, size, color) {
    size = size || 14;
    if (window.Icons && typeof window.Icons[name] === 'function') {
        var opts = { size: size };
        if (color) opts.color = color;
        return window.Icons[name](opts);
    }
    return '';
}

function getDaysUntil(ds) {
    if (!ds) return null;
    var t = new Date(ds), today = new Date();
    today.setHours(0,0,0,0); t.setHours(0,0,0,0);
    return Math.ceil((t - today) / 86400000);
}

function hasExplicitTime(ds) {
    if (!ds) return false;
    var m = ds.match(/T(\d{2}):(\d{2})/);
    return m ? (parseInt(m[1],10) !== 0 || parseInt(m[2],10) !== 0) : false;
}

export class TenderCard {
    constructor(tenderOrOptions, legacyOptions) {
        if (tenderOrOptions && tenderOrOptions.id !== undefined && !tenderOrOptions.tender) {
            var opts = legacyOptions || {};
            this.tender = tenderOrOptions;
            this.allFaseStatussen = opts.allFaseStatussen || {};
            this.searchQuery = opts.searchQuery || '';
            this.planningCounts = opts.planningCounts || { done: 0, total: 0 };
            this.checklistCounts = opts.checklistCounts || { done: 0, total: 0 };
        } else {
            var opts = tenderOrOptions || {};
            this.tender = opts.tender || {};
            this.allFaseStatussen = opts.allFaseStatussen || {};
            this.searchQuery = opts.searchQuery || '';
            this.planningCounts = opts.planningCounts || { done: 0, total: 0 };
            this.checklistCounts = opts.checklistCounts || { done: 0, total: 0 };
        }
    }

    render() {
        var tender = this.tender;
        var fase = tender.fase || 'acquisitie';
        var gradient = SOLID_BAR_GRADIENTS[fase] || SOLID_BAR_GRADIENTS.acquisitie;

        var header = new TenderCardHeader({
            tender: tender, allFaseStatussen: this.allFaseStatussen,
            size: 'default', showActions: true, showStatusDropdown: true
        });

        var body = new TenderCardBody({
            tender: tender, searchQuery: this.searchQuery,
            size: 'default', showBureau: true
        });

        var footer = new TenderCardFooter({
            tenderId: tender.id, teamAssignments: tender.team_assignments,
            planningCounts: this.planningCounts, checklistCounts: this.checklistCounts,
            size: 'default'
        });

        var waardeHtml = tender.geschatte_waarde
            ? '<div class="tc-waarde">' + this._formatWaarde(tender.geschatte_waarde) + '</div>'
            : '';

        return ''
            + '<div class="tender-row phase-' + fase + '"'
            + ' data-tender-id="' + tender.id + '"'
            + ' data-fase="' + fase + '"'
            + ' data-status="' + (tender.fase_status || tender.status || '') + '">'

            // ── BAND 1: Header (volle breedte) ──
            + '<div class="tc-header-band">'
            +   '<div class="tc-header-wrap"'
            +   ' style="background: linear-gradient(135deg, ' + gradient.start + ', ' + gradient.end + ')">'
            +     header.render()
            +     waardeHtml
            +   '</div>'
            +   '<div class="tc-timeline-headers">'
            +     this._renderTimelineHeaders()
            +   '</div>'
            + '</div>'

            // ── BAND 2: Content (volle breedte, ZONDER footer) ──
            + '<div class="tc-content-band">'

            // Links: body + deadline (420px)
            +   '<div class="tc-body-section">'
            +     '<div class="tc-body-wrap">'
            +       body.render()
            +       this._renderDeadline()
            +     '</div>'
            +   '</div>'

            // Rechts: timeline data (flex:1)
            +   '<div class="tc-data-section">'
            +     this._renderTimelineCells()
            +   '</div>'

            + '</div>'

            // ── BAND 3: Footer (volle breedte) ──
            + this._renderFooterBand(footer)

            + '</div>';
    }

    // ── BAND 3: Footer band (volle breedte) ──
    _renderFooterBand(footer) {
        return ''
            + '<div class="tc-footer-band">'

            // Links: team avatars + shortcuts (420px)
            + '<div class="tc-footer-left">'
            +   footer.render()
            + '</div>'

            // Rechts: footer cellen uitgelijnd met timeline kolommen
            + '<div class="tc-footer-right">'
            +   this._renderFooterCells()
            + '</div>'

            + '</div>';
    }

    // ── Footer cellen: lege cellen + dagen badge onder deadline kolom ──
    _renderFooterCells() {
        var html = '';
        for (var i = 0; i < TIMELINE_COLUMNS.length; i++) {
            var col = TIMELINE_COLUMNS[i];
            var cellContent = '';

            // Deadline kolom (index 6): dagen badge
            if (col.isDeadline) {
                cellContent = this._renderDaysBadge();
            }

            html += '<div class="tc-footer-cell">' + cellContent + '</div>';
        }
        return html;
    }

    // ── Dagen badge berekening (was in _renderCell) ──
    _renderDaysBadge() {
        var dl = this.tender.deadline_indiening;
        if (!dl) return '';

        var d = new Date(dl);
        var isPast = new Date(dl) < new Date(new Date().toDateString());
        var du = getDaysUntil(dl);

        if (isPast) {
            return '<div class="tc-days-badge tc-days-badge--verlopen">'
                + getIcon('alertTriangle', 11, 'currentColor')
                + '<span>Verlopen</span></div>';
        }

        if (du === null) return '';

        var cls = '', label = '';
        if (du === 0)       { cls = 'tc-days-badge--urgent';  label = 'Vandaag!'; }
        else if (du === 1)  { cls = 'tc-days-badge--urgent';  label = 'Nog 1 dag tot deadline'; }
        else if (du <= 3)   { cls = 'tc-days-badge--urgent';  label = 'Nog ' + du + ' dagen tot deadline'; }
        else if (du <= 7)   { cls = 'tc-days-badge--soon';    label = 'Nog ' + du + ' dagen tot deadline'; }
        else                { cls = 'tc-days-badge--ok';      label = 'Nog ' + du + ' dagen tot deadline'; }

        return '<div class="tc-days-badge ' + cls + '">'
            + getIcon('clock', 11, 'currentColor')
            + '<span>' + label + '</span></div>';
    }

    _renderTimelineHeaders() {
        var html = '';
        for (var i = 0; i < TIMELINE_COLUMNS.length; i++) {
            var col = TIMELINE_COLUMNS[i];
            var cls = '';
            var iconColor = '#94a3b8';

            if (col.isDeadline) {
                var dlState = this._getDeadlineState();
                cls = ' tc-timeline-header--dl-' + dlState;
                var stateColors = {
                    ok: '#059669', soon: '#a16207', urgent: '#dc2626',
                    verlopen: '#991b1b', neutral: '#94a3b8'
                };
                iconColor = stateColors[dlState] || '#94a3b8';
            }

            html += '<div class="tc-timeline-header' + cls + '">'
                + '<span class="tc-timeline-header-icon">' + getIcon(col.iconName, 14, iconColor) + '</span>'
                + '<span class="tc-timeline-header-label">' + col.label + '</span>'
                + '</div>';
        }
        return html;
    }

    // ── Deadline state voor dynamische header-kleuring ──
    _getDeadlineState() {
        var dl = this.tender.deadline_indiening;
        if (!dl) return 'neutral';
        var du = getDaysUntil(dl);
        if (du < 0)  return 'verlopen';
        if (du <= 3) return 'urgent';
        if (du <= 7) return 'soon';
        return 'ok';
    }

    _renderDeadline() {
        var dl = this.tender.deadline_indiening;
        if (!dl) return '';
        var diff = getDaysUntil(dl), cls = '', label = '';
        if (diff < 0)       { cls = 'tc-deadline--verlopen';   label = 'Verlopen'; }
        else if (diff <= 3) { cls = 'tc-deadline--kritiek';    label = diff + 'd'; }
        else if (diff <= 7) { cls = 'tc-deadline--urgent';     label = diff + 'd'; }
        else if (diff <= 14){ cls = 'tc-deadline--binnenkort'; label = diff + 'd'; }
        if (!label) return '';
        var d = new Date(dl);
        return '<div class="tc-deadline ' + cls + '">' + getIcon('clock', 13, 'currentColor')
            + '<span>' + this._formatDateShort(d) + '</span>'
            + '<span class="tc-deadline-label">' + label + '</span></div>';
    }

    _renderTimelineCells() {
        var t = this.tender, html = '';
        for (var i = 0; i < TIMELINE_COLUMNS.length; i++) {
            var col = TIMELINE_COLUMNS[i];
            html += this._renderCell(t.id, col.field, t[col.field] || '', !!col.isDeadline);
        }
        return html;
    }

    _renderCell(id, field, date, isDL) {
        var a = 'data-tender-id="' + id + '" data-field="' + field + '" data-date="' + (date||'') + '"';
        if (!date) return '<div class="timeline-cell timeline-cell--editable" ' + a + '><div class="date-display empty"><span class="date-add-icon">+</span></div></div>';

        var d = new Date(date), day = d.getDate(), mon = d.toLocaleDateString('nl-NL',{month:'short'});
        var isPast = d < new Date(), du = getDaysUntil(date), ht = hasExplicitTime(date);
        var ts = ht ? String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') : '';
        var cls = ['filled'];
        if (isPast) cls = ['completed'];
        else if (isDL) { if (du<=3){cls=['urgent'];} else if(du<=7){cls=['soon'];} else cls=['deadline']; }

        // v3.6: days-to-deadline badge NIET meer in de cel — verplaatst naar tc-footer-band
        return '<div class="timeline-cell timeline-cell--editable" '+a+'>'
            +'<div class="date-display '+cls.join(' ')+(ht?' has-time':'')+'">'
            +'<span class="date-day">'+day+'</span><span class="date-month">'+mon+'</span>'
            +(ht?'<span class="date-time">'+ts+'</span>':'')
            +'</div></div>';
    }

    _formatWaarde(w) {
        var n = parseFloat(w); if (isNaN(n)) return '';
        if (n>=1e6) return '\u20AC'+(n/1e6).toFixed(1).replace('.0','')+'M';
        if (n>=1e3) return '\u20AC'+(n/1e3).toFixed(0)+'K';
        return '\u20AC'+n.toLocaleString('nl-NL');
    }

    _formatDateShort(d) {
        if (!d||isNaN(d.getTime())) return '';
        return d.getDate()+' '+['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getMonth()];
    }
}