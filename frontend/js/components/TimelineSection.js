/**
 * TimelineSection Component
 * Toont alle milestones/deadlines in een horizontale timeline
 */

import { TimelineCell } from './TimelineCell.js';

export class TimelineSection {
    constructor(deadlines = []) {
        this.deadlines = deadlines;
        // Standaard 10 cellen (milestone slots)
        this.maxCells = 10;
    }

    render() {
        const section = document.createElement('div');
        section.className = 'section-timeline';
        section.style.cssText = `
            display: flex;
            flex: 1;
            min-width: 0;
            overflow-x: auto;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
        `;

        // Voeg scrollbar styling toe voor Webkit browsers
        const style = document.createElement('style');
        style.textContent = `
            .section-timeline::-webkit-scrollbar {
                height: 8px;
            }
            .section-timeline::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 4px;
            }
            .section-timeline::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
            }
            .section-timeline::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        `;
        document.head.appendChild(style);

        // Maak een array van de juiste lengte
        const cells = Array(this.maxCells).fill(null).map((_, index) => {
            return this.deadlines[index] || null;
        });

        // Render elke cel
        cells.forEach(deadline => {
            const cell = new TimelineCell(deadline);
            section.appendChild(cell.render());
        });

        return section;
    }
}