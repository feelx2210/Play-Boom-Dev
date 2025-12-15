// --- DEBUG MONITOR V2 ---
// Fängt Fehler ab und zeigt sie auf dem Bildschirm an.
// Toggle: CMD+# oder STRG+#

const overlay = document.createElement('div');
overlay.id = 'debug-console';
overlay.style.cssText = `
    position: fixed; 
    top: 0; left: 0; width: 100%; height: 300px;
    background: rgba(0, 0, 0, 0.95); 
    color: #ff5555; 
    font-family: 'Consolas', 'Monaco', monospace; 
    font-size: 13px;
    padding: 15px; 
    z-index: 10000; 
    overflow-y: auto;
    border-bottom: 4px solid red; 
    display: none; /* Startet ausgeblendet */
    pointer-events: auto; /* Erlaubt Maus-Interaktion (Markieren/Kopieren) */
    user-select: text;    /* Text ist auswählbar */
    white-space: pre-wrap; /* Zeilenumbrüche erhalten */
    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
`;
document.body.appendChild(overlay);

// Hilfsfunktion für Zeitstempel
function getTime() {
    const now = new Date();
    return now.toLocaleTimeString() + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

function showLog(msg, type = 'error') {
    // Bei einem echten Fehler öffnen wir das Fenster automatisch
    if (type === 'error') overlay.style.display = 'block';

    const line = document.createElement('div');
    line.style.borderBottom = "1px solid #333";
    line.style.padding = "4px 0";
    line.style.color = type === 'info' ? '#88ff88' : '#ff5555';
    
    line.textContent = `[${getTime()}] ${msg}`;
    overlay.appendChild(line);
    
    // Auto-Scroll nach unten
    overlay.scrollTop = overlay.scrollHeight;
}

// 1. Globale Fehler abfangen
window.onerror = function(msg, url, line, col, error) {
    const file = url ? url.split('/').pop() : 'unknown';
    showLog(`CRASH in ${file}:${line}\n>> ${msg}`);
    return false;
};

// 2. Promise Fehler (z.B. bei Modul-Imports oder async)
window.addEventListener('unhandledrejection', function(event) {
    showLog(`PROMISE REJECTION:\n>> ${event.reason}`);
});

// 3. Fehlende Skripte/Bilder abfangen
window.addEventListener('error', (e) => {
    if (e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG') {
        const src = e.target.src || e.target.href;
        
        // FIX: Ignoriere Fehler vom Umami-Tracking-Skript
        if (src && src.includes('umami.is')) {
            // Optional: Nur in die Browser-Konsole loggen, aber NICHT ins Overlay
            console.warn('Tracking script blocked (AdBlocker detected):', src);
            return; 
        }

        showLog(`RESOURCE LOAD ERROR:\n>> Konnte ${src} nicht laden.`);
    }
}, true);

// 4. Toggle per Tastatur (CMD+# oder STRG+#)
window.addEventListener('keydown', (e) => {
    // Prüfe auf CMD (Meta) oder STRG (Ctrl) zusammen mit '#'
    if ((e.metaKey || e.ctrlKey) && e.key === '#') {
        e.preventDefault(); // Verhindert Standardaktionen
        
        if (overlay.style.display === 'none') {
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    }
});

// Start-Nachricht
showLog("Debug Monitor bereit. Drücke CMD + # zum Öffnen.", 'info');