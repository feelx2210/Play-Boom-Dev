import { TILE_SIZE } from './constants.js';
import { state } from './state.js';
// OPTIMIERUNG: Importiere Funktionen aus effects.js
import { drawFlame, drawBeam } from './effects.js';

// NEU: "Kochendes Öl" Effekt (Top-Down Perspektive)
function drawOilFire(ctx, x, y) {
    const cx = x;
    const cy = y;
    // Langsamerer Zeitfaktor für zähes Blubbern
    const t = Date.now() / 200; 

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Die Öl-Masse (Dunkler, zäher Untergrund)
    ctx.fillStyle = 'rgba(10, 5, 5, 0.85)'; // Fast Schwarz, leicht transparent
    ctx.beginPath();
    // Die Pfütze pulsiert ganz leicht in der Größe
    const baseSize = 20 + Math.sin(t) * 1;
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // 2. Blubbernde Hitze-Blasen
    // Wir definieren feste Positionen für Blasen, die zyklisch erscheinen
    // Farben: Hitze (Gelb/Weiß/Rot) + Giftiges Gas (Grün/Blau)
    const bubbles = [
        { ox: -8, oy: -8, offset: 0, color: '#ffaa00', maxR: 8 },   // Orange
        { ox: 10, oy: 4, offset: 1.5, color: '#ffcc00', maxR: 6 },  // Gelb
        { ox: -4, oy: 10, offset: 3.0, color: '#ff4444', maxR: 7 }, // Rot
        { ox: 6, oy: -6, offset: 4.5, color: '#ffffff', maxR: 4 },  // Weiß (Hotspot)
        { ox: 0, oy: 0, offset: 2.2, color: '#44ffaa', maxR: 5 },   // Giftgrün (Gas)
        { ox: -10, oy: 5, offset: 5.1, color: '#4488ff', maxR: 5 }  // Blau (Gas)
    ];

    bubbles.forEach(b => {
        // Zyklisches Aufblähen (Sinus-Welle verschoben durch offset)
        const cycle = (t + b.offset) % (Math.PI * 2);
        // Nur im positiven Sinus-Bereich sichtbar machen (Blubbern)
        if (Math.sin(cycle) > 0) {
            const size = Math.sin(cycle) * b.maxR; 
            const alpha = Math.sin(cycle); // Ein/Ausblenden

            ctx.globalAlpha = alpha;
            ctx.fillStyle = b.color;
            
            ctx.beginPath();
            ctx.arc(b.ox, b.oy, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Kleiner Glanzpunkt auf der Blase für "flüssigen" Look
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.ox - size*0.3, b.oy - size*0.3, size*0.2, 0, Math.PI*2);
            ctx.fill();
        }
    });
    
    ctx.restore();
}

// Hauptfunktion zum Zeichnen aller Partikel
export function drawAllParticles(ctx) {
    state.particles.forEach(p => {
        const px = p.gx * TILE_SIZE;
        const py = p.gy * TILE_SIZE;

        if (p.isFire) {
            const max = p.maxLife || 100;
            const currentLife = p.life;
            const age = max - currentLife;

            const cx = px + TILE_SIZE/2;
            const cy = py + TILE_SIZE/2;
            
            ctx.save();

            const explosionDuration = 100;

            if (age < 15) {
                // PHASE 1: EXPLOSION START
                const grow = age / 15;
                drawFlame(ctx, cx, cy, 18 * grow, '#ffffff', '#ffff00', 0.1);
            } 
            else if (age < explosionDuration) {
                // PHASE 2: EXPLOSION SUSTAIN
                const pulse = Math.sin(Date.now() / 30) * 2;
                const baseSize = 16; 
                
                const isOil = p.isOilFire;
                // Öl-Explosion: Heller, aggressiver Kern
                const inner = isOil ? '#ffaa88' : (p.isNapalm ? '#ffaa00' : '#ffff44');
                const outer = isOil ? '#440000' : (p.isNapalm ? '#ff2200' : '#ff6600');

                if (p.type === 'center') {
                    drawFlame(ctx, cx, cy, baseSize + pulse, inner, outer, 0.2);
                } else {
                    let angle = 0;
                    if (p.dir) {
                        if (p.dir.x === 0 && p.dir.y === -1) angle = -Math.PI/2;
                        if (p.dir.x === 0 && p.dir.y === 1) angle = Math.PI/2;
                        if (p.dir.x === -1 && p.dir.y === 0) angle = Math.PI;
                        if (p.dir.x === 1 && p.dir.y === 0) angle = 0;
                    }
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);
                    const beamWidth = 36 + Math.sin(Date.now()/40)*3; 
                    drawBeam(ctx, 0, 0, beamWidth, inner, outer, p.type === 'end');
                }
            } 
            else if (p.isOilFire) {
                // PHASE 3: OIL FIRE (Neuer "Kochende Pfütze" Effekt)
                drawOilFire(ctx, cx, cy);
            }
            else {
                // PHASE 3: NAPALM GLUT
                const emberDuration = max - explosionDuration;
                let emberProgress = 0;
                if (emberDuration > 0) emberProgress = (age - explosionDuration) / emberDuration;
                
                const jitter = (Math.random() - 0.5) * 3; 
                const pulse = Math.sin(Date.now() / 50) * 2; 
                const inner = '#ffcc00'; 
                const outer = '#cc2200';

                if (emberProgress > 0.9) ctx.globalAlpha = 1 - ((emberProgress - 0.9) * 10);
                else ctx.globalAlpha = 1.0;

                if (p.type === 'center') {
                    drawFlame(ctx, cx, cy, 18 + pulse + jitter, inner, outer, 0.3);
                } else {
                    let angle = 0;
                    if (p.dir) {
                        if (p.dir.x === 0 && p.dir.y === -1) angle = -Math.PI/2;
                        if (p.dir.x === 0 && p.dir.y === 1) angle = Math.PI/2;
                        if (p.dir.x === -1 && p.dir.y === 0) angle = Math.PI;
                        if (p.dir.x === 1 && p.dir.y === 0) angle = 0;
                    }
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);
                    const beamWidth = 32 + pulse + jitter;
                    drawBeam(ctx, 0, 0, beamWidth, inner, outer, p.type === 'end');
                    
                    if (Math.random() < 0.4) {
                         ctx.fillStyle = '#ffffaa';
                         const px = (Math.random() - 0.5) * 40;
                         const py = (Math.random() - 0.5) * 10;
                         ctx.fillRect(px, py, 2, 2);
                    }
                }
            }
            ctx.restore();
        } else if (p.text) {
            ctx.fillStyle = p.color; ctx.font = '10px "Press Start 2P"'; ctx.fillText(p.text, p.x, p.y);
        } else {
            ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size || 4, p.size || 4);
        }
    });
}
