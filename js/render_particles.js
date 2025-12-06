import { TILE_SIZE } from './constants.js';
import { state } from './state.js';
import { drawFlame, drawBeam } from './effects.js';

// NEU: Realistischerer Ölbrand (Top-Down, Glut + Gift)
function drawOilFire(ctx, x, y) {
    const t = Date.now();
    ctx.save();
    ctx.translate(x, y);

    // 1. Pulsierende Glut-Basis (Rot-Orange)
    // Flacher Verlauf, kein "Turm" nach oben für Top-Down-Look
    const pulse = Math.sin(t / 150) * 0.1 + 1; // Pulsieren zwischen 0.9 und 1.1
    const radius = 22 * pulse;
    
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, radius);
    grad.addColorStop(0, '#ffaa00');      // Kern: Hellorange/Gelb
    grad.addColorStop(0.5, '#cc2200');    // Mitte: Rot
    grad.addColorStop(0.8, '#440505');    // Rand: Dunkelstes Rot/Schwarz (Verkohlung)
    grad.addColorStop(1, 'rgba(0,0,0,0)'); // Transparent am Rand
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. "Brutzelnde" Öl-Blasen
    // Wir simulieren dunkle Blasen, die auf der heißen Oberfläche erscheinen und platzen
    for(let i=0; i<3; i++) {
        const offset = i * 850;
        const progress = ((t + offset) % 800) / 800; // 0 bis 1 Loop
        
        if (progress < 0.9) { // Blase sichtbar
            // Zufällige Position auf der heißen Scheibe (kreisförmig verteilt)
            const angle = (t / 600) + i * (Math.PI * 2 / 3);
            const dist = 6 + Math.sin(t/200 + i)*8;
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            
            // Blase wächst und platzt (sinus-kurve für Größe)
            const size = 5 * Math.sin(progress * Math.PI); 
            
            ctx.fillStyle = '#2a0000'; // Fast schwarzes Öl
            ctx.beginPath();
            ctx.arc(bx, by, size, 0, Math.PI*2);
            ctx.fill();
            
            // Kleiner Glanzpunkt auf der Blase (Reflexion der Glut)
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(bx - 1, by - 1, size * 0.3, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // 3. Giftige grüne Partikel (wenige)
    // Schweben langsam nach oben und verblassen
    const particleCount = 2; 
    for(let j=0; j<particleCount; j++) {
        const cycle = 2200;
        const offset = j * (cycle / particleCount);
        const pProg = ((t + offset) % cycle) / cycle; // 0 -> 1
        
        // Spiralbewegung leicht nach oben
        const px = Math.sin(t/400 + j)*10; 
        const py = 4 - (pProg * 18); // Startet mittig, schwebt etwas nach "Norden"
        
        ctx.globalAlpha = Math.max(0, 1 - pProg * 1.5); // Schnelles Verblassen
        ctx.fillStyle = '#33ff33'; // Giftgrün
        ctx.beginPath();
        // Kleine Rechtecke oder Kreise für Pixel-Look
        ctx.rect(px, py, 3, 3);
        ctx.fill();
    }

    ctx.restore();
}

// Einfrier-Animation
function drawFreezing(ctx, x, y, life, maxLife) {
    const cx = x;
    const cy = y;
    const progress = 1 - (life / maxLife); // 0.0 -> 1.0

    ctx.save();
    ctx.translate(cx, cy);

    // Wachsender Eiskristall
    const size = TILE_SIZE * 0.8 * progress;
    
    // Bodenfrost (Halbtransparentes Blau)
    ctx.fillStyle = `rgba(136, 204, 255, ${0.5 * progress})`;
    ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);

    // Kristall-Struktur
    ctx.fillStyle = '#ccffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2);
        ctx.moveTo(0, 0);
        ctx.lineTo(-5, -size/2);
        ctx.lineTo(0, -size); // Spitze
        ctx.lineTo(5, -size/2);
    }
    ctx.fill();
    
    // Glanz
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
}

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
            
            // 1. Wachstumsphase (Explosion start)
            if (age < 15) {
                const grow = age / 15;
                drawFlame(ctx, cx, cy, 18 * grow, '#ffffff', '#ffff00', 0.1);
            } 
            // 2. Volle Explosion (Strahlen & Feuerbälle)
            else if (age < explosionDuration) {
                const pulse = Math.sin(Date.now() / 30) * 2;
                const baseSize = 16; 
                const isOil = p.isOilFire;
                const inner = isOil ? '#ff5500' : (p.isNapalm ? '#ffaa00' : '#ffff44');
                const outer = isOil ? '#000000' : (p.isNapalm ? '#ff2200' : '#ff6600');
                
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
            // 3. Nachbrennen (Ölfelder) -> HIER NEUE FUNKTION
            else if (p.isOilFire) {
                drawOilFire(ctx, cx, cy);
            } 
            // 4. Ausglühen (Normale Explosion / Napalm Glut)
            else {
                const emberDuration = max - explosionDuration;
                let emberProgress = 0;
                if (emberDuration > 0) emberProgress = (age - explosionDuration) / emberDuration;
                const jitter = (Math.random() - 0.5) * 3; 
                const pulse = Math.sin(Date.now() / 50) * 2; 
                
                // Farben je nach Typ (Napalm = dunklere Glut)
                let inner = '#ffcc00'; 
                let outer = '#cc2200';
                if (p.isNapalm) {
                    inner = '#ff5500';
                    outer = '#2a0505';
                }

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
                         ctx.fillStyle = p.isNapalm ? '#ff6600' : '#ffffaa';
                         const px = (Math.random() - 0.5) * 40;
                         const py = (Math.random() - 0.5) * 10;
                         ctx.fillRect(px, py, 2, 2);
                    }
                }
            }
            ctx.restore();
        } 
        else if (p.type === 'freezing') {
            drawFreezing(ctx, px + TILE_SIZE/2, py + TILE_SIZE/2, p.life, p.maxLife);
        }
        else if (p.text) {
            ctx.fillStyle = p.color; ctx.font = '10px "Press Start 2P"'; ctx.fillText(p.text, p.x, p.y);
        } else {
            ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size || 4, p.size || 4);
        }
    });
}
