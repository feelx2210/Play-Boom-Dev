import { TILE_SIZE } from './constants.js';
import { state } from './state.js';
import { drawFlame, drawBeam } from './effects.js';

function drawCampfire(ctx, x, y) {
    const cx = x;
    const cy = y + 10; 
    const t = Date.now() / 100;
    const scale = 1 + Math.sin(t) * 0.1;
    const sway = Math.cos(t * 1.5) * 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    
    const grad = ctx.createRadialGradient(0, 5, 5, 0, 0, 20);
    grad.addColorStop(0, '#ffcc00'); 
    grad.addColorStop(0.6, '#ff4400'); 
    grad.addColorStop(1, 'rgba(50, 0, 0, 0)'); 
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 10, 18, 8, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.quadraticCurveTo(-5 + sway, -25, 0 + sway, -35);
    ctx.quadraticCurveTo(5 + sway, -25, 10, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(0 + sway, -15, 0 + sway, -20);
    ctx.quadraticCurveTo(0 + sway, -15, 5, 5);
    ctx.fill();

    if (Math.random() < 0.3) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
        const rx = (Math.random() - 0.5) * 20;
        const ry = -20 - Math.random() * 20;
        ctx.fillRect(rx, ry, 4, 4);
    }
    ctx.restore();
}

// NEU: Einfrier-Animation
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
            // ... (Feuer-Code bleibt unverändert) ...
            const max = p.maxLife || 100;
            const currentLife = p.life;
            const age = max - currentLife;
            const cx = px + TILE_SIZE/2;
            const cy = py + TILE_SIZE/2;
            ctx.save();
            const explosionDuration = 100;
            if (age < 15) {
                const grow = age / 15;
                drawFlame(ctx, cx, cy, 18 * grow, '#ffffff', '#ffff00', 0.1);
            } else if (age < explosionDuration) {
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
            } else if (p.isOilFire) {
                drawCampfire(ctx, cx, cy);
            } else {
                // --- START ÄNDERUNG: GLUT-LOGIK ---
                const emberDuration = max - explosionDuration;
                let emberProgress = 0;
                if (emberDuration > 0) emberProgress = (age - explosionDuration) / emberDuration;
                const jitter = (Math.random() - 0.5) * 3; 
                const pulse = Math.sin(Date.now() / 50) * 2; 
                
                // Standardfarben (normales Feuer)
                let inner = '#ffcc00'; 
                let outer = '#cc2200';

                // Wenn Napalm: Ändere Farben zu "Glut" (dunkles Rot/Orange, verkohlt)
                if (p.isNapalm) {
                    inner = '#ff5500'; // Glühendes Orange/Rot
                    outer = '#2a0505'; // Sehr dunkles, fast schwarzes Rot (Kohle)
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
                         // Funkenfarbe ebenfalls anpassen für Napalm
                         ctx.fillStyle = p.isNapalm ? '#ff6600' : '#ffffaa';
                         const px = (Math.random() - 0.5) * 40;
                         const py = (Math.random() - 0.5) * 10;
                         ctx.fillRect(px, py, 2, 2);
                    }
                }
                // --- ENDE ÄNDERUNG ---
            }
            ctx.restore();
        } 
        // --- NEU: CHECK FÜR FREEZING PARTIKEL ---
        else if (p.type === 'freezing') {
            drawFreezing(ctx, px + TILE_SIZE/2, py + TILE_SIZE/2, p.life, p.maxLife);
        }
        // ----------------------------------------
        else if (p.text) {
            ctx.fillStyle = p.color; ctx.font = '10px "Press Start 2P"'; ctx.fillText(p.text, p.x, p.y);
        } else {
            ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size || 4, p.size || 4);
        }
    });
}
