/**
 * ConfirmDialog — Globale bevestigingsdialoog
 * TenderZen — vervangt browser confirm() met styled modal
 *
 * GEBRUIK:
 *   const bevestigd = await window.ConfirmDialog.show({
 *       titel: 'Verwijderen',
 *       bericht: 'Dit kan niet ongedaan worden gemaakt.',
 *       bevestigTekst: 'Verwijderen',
 *       annuleerTekst: 'Annuleren',
 *       type: 'danger'  // 'danger' | 'warning' | 'info'
 *   });
 */

const ConfirmDialog = (() => {
    function show({ titel, bericht, bevestigTekst = 'Bevestigen',
                    annuleerTekst = 'Annuleren', type = 'info' }) {
        return new Promise((resolve) => {

            // Verwijder eventuele bestaande dialog
            document.getElementById('tz-confirm-overlay')?.remove();

            const bevestigKleur = type === 'danger'
                ? 'background:#dc2626;color:#fff;border:none'
                : type === 'warning'
                ? 'background:#d97706;color:#fff;border:none'
                : 'background:#4f46e5;color:#fff;border:none';

            const overlay = document.createElement('div');
            overlay.id = 'tz-confirm-overlay';
            overlay.style.cssText = `
                position:fixed;inset:0;background:rgba(0,0,0,0.35);
                display:flex;align-items:center;justify-content:center;
                z-index:99999;font-family:'DM Sans',sans-serif;
            `;

            overlay.innerHTML = `
                <div style="
                    background:#fff;border-radius:12px;width:420px;
                    max-width:calc(100vw - 32px);
                    box-shadow:0 20px 60px rgba(0,0,0,0.15);
                    border:0.5px solid #e2e8f0;overflow:hidden;
                ">
                    <div style="padding:20px 20px 0">
                        <div style="font-size:15px;font-weight:700;
                            color:#0f172a;margin-bottom:8px;
                            font-family:'DM Sans',sans-serif;">${titel}</div>
                        <div style="font-size:14px;color:#475569;
                            line-height:1.6;
                            font-family:'DM Sans',sans-serif;">${bericht}</div>
                    </div>
                    <div style="padding:20px;display:flex;
                        justify-content:flex-end;gap:8px">
                        <button id="tz-confirm-annuleer" style="
                            font-size:13px;padding:8px 16px;background:none;
                            border:0.5px solid #e2e8f0;border-radius:8px;
                            cursor:pointer;font-family:'DM Sans',sans-serif;
                            color:#475569;transition:background .1s;
                        ">${annuleerTekst}</button>
                        <button id="tz-confirm-ok" style="
                            font-size:13px;padding:8px 16px;border-radius:8px;
                            cursor:pointer;font-family:'DM Sans',sans-serif;
                            font-weight:600;${bevestigKleur}
                        ">${bevestigTekst}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const sluit = (resultaat) => {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(resultaat);
            };

            document.getElementById('tz-confirm-ok')
                ?.addEventListener('click', () => sluit(true));
            document.getElementById('tz-confirm-annuleer')
                ?.addEventListener('click', () => sluit(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) sluit(false);
            });

            const onKey = (e) => {
                if (e.key === 'Enter') sluit(true);
                if (e.key === 'Escape') sluit(false);
            };
            document.addEventListener('keydown', onKey);

            // Focus de OK knop zodat Enter direct werkt
            setTimeout(() => document.getElementById('tz-confirm-ok')?.focus(), 50);
        });
    }

    return { show };
})();

window.ConfirmDialog = ConfirmDialog;
