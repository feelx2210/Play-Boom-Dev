// --- DEBUG SYSTEM ---
// Zeigt Fehler direkt im Spiel an, damit wir wissen, was los ist. Hilfreich

const debugOverlay = document.createElement('div');
debugOverlay.id = 'debug-overlay';
debugOverlay.style.cssText = `
    position: fixed; 
    top: 0; left: 0; width: 100%; height: 200px;
    background: rgba(0, 0, 0, 0.85); 
    color: #ff5555; 
    font-family: monospace;
    font-size: 14px; 
    overflow-y: scroll; 
    z-index: 99999; 
    padding: 10px;
    pointer-events: none; 
    display: none;
    border-bottom: 2px solid #ff0000;
`;
document.body.appendChild(debugOverlay);

function logToScreen(msg, type='log') {
    debugOverlay.style.display = 'block';
    const line = document.createElement('div');
    line.textContent = `> ${msg}`;
    line.style.color = type === 'error' ? '#ff5555' : '#aaffaa';
    line.style.marginBottom = '4px';
    debugOverlay.appendChild(line);
    debugOverlay.scrollTop = debugOverlay.scrollHeight;
}

// Fängt globale Fehler ab (z.B. Syntaxfehler, fehlende Variablen)
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const filename = url.split('/').pop(); // Nur Dateiname
    const message = `ERROR in ${filename}:${lineNo} -> ${msg}`;
    logToScreen(message, 'error');
    console.error("GAME ERROR:", error);
    return false; 
};

// Fängt Promise-Fehler ab (z.B. bei Modulen)
window.addEventListener('unhandledrejection', function(event) {
    logToScreen(`PROMISE ERROR: ${event.reason}`, 'error');
});

console.log = (function(originalFn) {
    return function(...args) {
        // originalFn.apply(console, args); // Optional: Auch in Konsole loggen
        // logToScreen(args.join(' '), 'log'); // Optional: Alles loggen
    };
})(console.log);

logToScreen("Debug Mode Active...", 'info');
