import { TILE_SIZE } from './constants.js';
import { state } from './state.js';

// --- HAUPTFUNKTIONEN ---

export function drawAllParticles(ctx) {
    state.particles.forEach(p => {
        // Position berechnen
        const x = (p.gx !== undefined ? p.gx * TILE_SIZE : p.x);
        const y = (p.gy !== undefined ? p.gy * TILE_SIZE : p.y);

        if (p.text) {
            drawFloatingText(ctx, p);
        } else if (p.isFire) {
            drawFire(ctx, p, x, y);
        } else if (p.type === 'freezing') {
            drawFreezingEffect(ctx, p, x, y);
        } else {
            drawGenericParticle(ctx, p);
        }
    });
}

// --- SPEZIALEFFEKTE ---

// NEU: Verbesserte Napalm/Öl-Darstellung als Lavateppich
function drawFire(ctx, p, x, y) {
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const time = Date.now();

    // --- NAPALM / ÖL (Langer Lavateppich) ---
    if (p.isNapalm || p.isOilFire) {
        ctx.save();

        // 1. Pulsieren der Lava-Masse
        // Der Radius schwankt leicht über die Zeit für einen "lebendigen" Effekt
        const pulse = Math.sin(time / 200 + p.gx + p.gy) * 3; 
        const radiusX = (TILE_SIZE * 0.45) + pulse;
        const radiusY = (TILE_SIZE * 0.42) + pulse * 0.7; // Leicht oval für Perspektive

        // 2. Radialer Farbverlauf (Heißes Zentrum, kühlere Ränder)
        // Wirkt viel mehr "top-down" als aufsteigende Flammen
        const gradient = ctx.createRadialGradient(cx, cy, TILE_SIZE * 0.1, cx, cy, radiusX);
        if (p.isOilFire) {
            // Öl ist dunkler, rußiger
            gradient.addColorStop(0, '#ff8800'); // Helles Orange Zentrum
            gradient.addColorStop(0.6, '#aa4400'); // Dunkles Orange
            gradient.addColorStop(1, '#331111');   // Fast schwarzer Rand (Ruß)
        } else {
            // Napalm ist hellere, chemische Hitze
            gradient.addColorStop(0, '#ffffaa'); // Weiß-Gelbes Zentrum (extrem heiß)
            gradient.addColorStop(0.4, '#ffcc00'); // Helles Gelb-Orange
            gradient.addColorStop(0.8, '#ff4400'); // Glut-Orange
            gradient.addColorStop(1, '#990000');   // Dunkelroter Rand
        }

        ctx.fillStyle = gradient;

        // 3. Die Lava-Form zeichnen (leicht unregelmäßiges Oval)
        ctx.beginPath();
        ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 4. Blubber-Effekt (Kleine heiße Blasen)
        // Pseudozufall basierend auf Position, damit es pro Kachel konsistent aussieht
        const seed = (p.gx * 17 + p.gy * 23); 
        const numBubbles = 3 + (seed % 3);

        for (let i = 0; i < numBubbles; i++) {
            // Position der Blase bewegt sich langsam
            const bubbleTimeOffset = time / 300 + i * 100 + seed;
            const bx = cx + Math.cos(bubbleTimeOffset) * (radiusX * 0.6);
            const by = cy + Math.sin(bubbleTimeOffset * 1.3) * (radiusY * 0.6);
            
            // Größe der Blase pulsiert schnell (aufblähen und platzen)
            let bubbleSize = (Math.sin(time / 100 + i * 50 + seed) + 1) * 4;
            if (bubbleSize < 0) bubbleSize = 0;

            ctx.fillStyle = p.isOilFire ? 'rgba(255, 200, 100, 0.7)' : 'rgba(255, 255, 200, 0.8)';
            ctx.beginPath();
            ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Optional: Ein leichter Glüheffekt um die Kachel
        ctx.shadowColor = p.isOilFire ? '#ff6600' : '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI*2); ctx.stroke();
        ctx.shadowBlur = 0; // Reset

        ctx.restore();
    } 
    // --- NORMALE EXPLOSION (Kurzer Knall) ---
    else {
        // (Der alte Code für normale Explosionen bleibt hier erhalten, 
        // falls du ihn nicht auch ändern willst. Er ist etwas "pixelliger", 
        // passt aber okay zu kurzen Explosionen.)
        
        const lifeRatio = p.life / p.maxLife; // 1.0 (Start) -> 0.0 (Ende)
        const size = TILE_SIZE * (0.6 + (1 - lifeRatio) * 0.4); // Wächst leicht
        
        // Flackern
        const flicker = Math.random() * 0.2 + 0.8;
        const alpha = lifeRatio * flicker;

        // Äußere Flamme (Rot/Orange)
        ctx.fillStyle = `rgba(255, ${Math.floor(100 * lifeRatio)}, 0, ${alpha})`;
        
        if (p.type === 'center') {
            ctx.beginPath(); ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.fill();
        } else {
            // Flammenzunge in Richtung
            ctx.save();
            ctx.translate(cx, cy);
            if (p.dir.x !== 0) ctx.scale(size, size*0.6); else ctx.scale(size*0.6, size);
            ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // Innerer Kern (Gelb/Weiß)
        if (lifeRatio > 0.3) {
             ctx.fillStyle = `rgba(255, 255, ${Math.floor(200 * (1-lifeRatio))}, ${alpha})`;
             ctx.beginPath(); ctx.arc(cx, cy, size/4 * flicker, 0, Math.PI*2); ctx.fill();
        }
    }
}

function drawFreezingEffect(ctx, p, x, y) {
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const progress = 1 - (p.life / p.maxLife); // 0 -> 1
    
    ctx.save();
    ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    // Wachsender Eiskristall
    const size = TILE_SIZE * progress;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size/2);
    ctx.lineTo(cx + size/2, cy);
    ctx.lineTo(cx, cy + size/2);
    ctx.lineTo(cx - size/2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Kleine "Frost-Splitter"
    if (p.life > p.maxLife - 10) {
         for(let i=0; i<4; i++) {
             const angle = (Math.PI/2 * i) + progress;
             const dist = size * 0.6;
             ctx.beginPath();
             ctx.moveTo(cx, cy);
             ctx.lineTo(cx + Math.cos(angle)*dist, cy + Math.sin(angle)*dist);
             ctx.stroke();
         }
    }
    ctx.restore();
}


// --- STANDARD PARTIKEL (Text, Debris) ---

function drawFloatingText(ctx, p) {
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = p.color || '#ffffff';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
}

function drawGenericParticle(ctx, p) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 45; // Fade out
    ctx.beginPath();
    ctx.rect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}