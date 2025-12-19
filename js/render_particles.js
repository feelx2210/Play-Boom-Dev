import { TILE_SIZE } from './constants.js';
import { state } from './state.js';
import { drawFlame, drawBeam } from './effects.js';

function drawOilFire(ctx, x, y) {
    const t = Date.now();
    ctx.save();
    ctx.translate(x, y);

    // 1. Pulsierende Glut-Basis
    const pulse = Math.sin(t / 150) * 0.1 + 1; 
    const radius = 22 * pulse;
    
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, radius);
    grad.addColorStop(0, '#ffaa00');      
    grad.addColorStop(0.5, '#cc2200');    
    grad.addColorStop(0.8, '#440505');    
    grad.addColorStop(1, 'rgba(0,0,0,0)'); 
    
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

    // 2. "Brutzelnde" Öl-Blasen
    for(let i=0; i<3; i++) {
        const offset = i * 850;
        const progress = ((t + offset) % 800) / 800; 
        if (progress < 0.9) { 
            const angle = (t / 600) + i * (Math.PI * 2 / 3);
            const dist = 6 + Math.sin(t/200 + i)*8;
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            const size = 5 * Math.sin(progress * Math.PI); 
            
            ctx.fillStyle = '#2a0000'; 
            ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = '#ff6600';
            ctx.beginPath(); ctx.arc(bx - 1, by - 1, size * 0.3, 0, Math.PI*2); ctx.fill();
        }
    }
    // 3. Gift
    const particleCount = 2; 
    for(let j=0; j<particleCount; j++) {
        const cycle = 2200;
        const offset = j * (cycle / particleCount);
        const pProg = ((t + offset) % cycle) / cycle; 
        const px = Math.sin(t/400 + j)*10; 
        const py = 4 - (pProg * 18); 
        ctx.globalAlpha = Math.max(0, 1 - pProg * 1.5); 
        ctx.fillStyle = '#33ff33'; 
        ctx.beginPath(); ctx.rect(px, py, 3, 3); ctx.fill();
    }
    ctx.restore();
}

function drawFreezing(ctx, x, y, life, maxLife) {
    const cx = x; const cy = y;
    const progress = 1 - (life / maxLife); 
    ctx.save();
    ctx.translate(cx, cy);
    const size = TILE_SIZE * 0.8 * progress;
    ctx.fillStyle = `rgba(136, 204, 255, ${0.5 * progress})`;
    ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#ccffff'; ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2); ctx.moveTo(0, 0); ctx.lineTo(-5, -size/2); ctx.lineTo(0, -size); ctx.lineTo(5, -size/2);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

// NEU: Schönerer Napalm-Effekt (Lavateppich statt Pixel-Flamme)
function drawNapalmFlame(ctx, x, y) {
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const time = Date.now();

    ctx.save();

    // 1. Pulsieren der Lava-Masse
    const pulse = Math.sin(time / 200 + x + y) * 3; 
    const radiusX = (TILE_SIZE * 0.45) + pulse;
    const radiusY = (TILE_SIZE * 0.42) + pulse * 0.7; 

    // 2. Radialer Farbverlauf (Chemische Hitze)
    const gradient = ctx.createRadialGradient(cx, cy, TILE_SIZE * 0.1, cx, cy, radiusX);
    gradient.addColorStop(0, '#ffffaa');   // Weiß-Gelb Zentrum
    gradient.addColorStop(0.4, '#ffcc00'); // Gelb-Orange
    gradient.addColorStop(0.8, '#ff4400'); // Glut
    gradient.addColorStop(1, '#990000');   // Dunkler Rand

    ctx.fillStyle = gradient;

    // 3. Form zeichnen
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 4. Blubber-Effekt
    const seed = (x * 17 + y * 23); 
    const numBubbles = 3 + (seed % 3);

    for (let i = 0; i < numBubbles; i++) {
        const bubbleTimeOffset = time / 300 + i * 100 + seed;
        const bx = cx + Math.cos(bubbleTimeOffset) * (radiusX * 0.6);
        const by = cy + Math.sin(bubbleTimeOffset * 1.3) * (radiusY * 0.6);
        
        let bubbleSize = (Math.sin(time / 100 + i * 50 + seed) + 1) * 4;
        if (bubbleSize < 0) bubbleSize = 0;

        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Leichter Glüh-Rand
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255, 60, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;

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
            
            // 1. Wachstumsphase
            if (age < 15) {
                const grow = age / 15;
                drawFlame(ctx, cx, cy, 18 * grow, '#ffffff', '#ffff00', 0.1);
            } 
            // 2. Volle Explosion
            else if (age < explosionDuration) {
                const pulse = Math.sin(Date.now() / 30) * 2;
                const baseSize = 16; 
                
                const isOil = p.isOilFire;
                const inner = isOil ? '#ff5500' : '#ffff44'; 
                const outer = isOil ? '#000000' : '#ff6600'; 
                
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
            // 3. Nachbrennen (Ölfelder)
            else if (p.isOilFire) {
                drawOilFire(ctx, cx, cy);
            } 
            // 4. Nachbrennen (Napalm) - HIER IST DIE ÄNDERUNG
            else if (p.isNapalm) {
                drawNapalmFlame(ctx, px, py);
            }
            // 5. Ausglühen (Normale Explosion)
            else {
                const emberDuration = max - explosionDuration;
                let emberProgress = 0;
                if (emberDuration > 0) emberProgress = (age - explosionDuration) / emberDuration;
                const jitter = (Math.random() - 0.5) * 3; 
                const pulse = Math.sin(Date.now() / 50) * 2; 
                
                let inner = '#ffcc00'; 
                let outer = '#cc2200';

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