import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, HELL_CENTER, DIRECTION_PADS } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';
import { drawCharacterSprite } from './char_sprites.js';

export { drawCharacterSprite };

let cachedLevelCanvas = null;
let lastLevelId = null;

export function clearLevelCache() {
    cachedLevelCanvas = null;
    lastLevelId = null;
}

// --- STATISCHE LEVEL-ELEMENTE (Werden nur 1x gemalt) ---
function bakeStaticLevel(levelDef) {
    const c = document.createElement('canvas');
    c.width = GRID_W * TILE_SIZE;
    c.height = GRID_H * TILE_SIZE;
    const ctx = c.getContext('2d');

    // 1. Hintergrund
    ctx.fillStyle = levelDef.bg;
    ctx.fillRect(0, 0, c.width, c.height);

    // BEACH SPECIAL BACKGROUND
    if (levelDef.id === 'beach') {
        ctx.fillStyle = levelDef.waterColor;
        ctx.beginPath();
        // Starte oben rechts
        ctx.moveTo(GRID_W * TILE_SIZE, 0);
        // Linie nach unten, mit Wellen an der Grenze
        for (let y = 0; y <= GRID_H; y += 0.5) {
            const limitX = 9 + Math.sin(y * 0.8) * 1.5;
            ctx.lineTo((limitX + 1) * TILE_SIZE, y * TILE_SIZE); // +1 offset für weichen Übergang
        }
        ctx.lineTo(GRID_W * TILE_SIZE, GRID_H * TILE_SIZE);
        ctx.fill();

        // Schaumkrone an der Grenze
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let y = 0; y <= GRID_H; y += 0.2) {
            const limitX = 9 + Math.sin(y * 0.8) * 1.5;
            if (y===0) ctx.moveTo((limitX + 0.8) * TILE_SIZE, y * TILE_SIZE);
            else ctx.lineTo((limitX + 0.8) * TILE_SIZE, y * TILE_SIZE);
        }
        ctx.stroke();
    }
    
    // Details für andere Level
    if (levelDef.id === 'hell') {
         ctx.fillStyle = 'rgba(80, 60, 60, 0.2)';
         for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                if (Math.random() < 0.2) ctx.fillRect(x * TILE_SIZE + Math.random()*40, y * TILE_SIZE + Math.random()*40, 3, 3);
            }
         }
    } else if (levelDef.id === 'ice') {
        for (let i = 0; i < 50; i++) {
             let sx = (Math.sin(i * 123.45) * 43758.5453) % 1 * c.width;
             let sy = (Math.cos(i * 678.90) * 12345.6789) % 1 * c.height;
             if (sx < 0) sx *= -1; if (sy < 0) sy *= -1;
             ctx.fillStyle = i % 2 === 0 ? '#6688aa' : '#ffffff'; ctx.fillRect(sx, sy, 2, 2);
        }
    }

    // 3. Grid Lines
    ctx.strokeStyle = levelDef.grid; ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=GRID_W; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); }
    for(let i=0; i<=GRID_H; i++) { ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    // 4. Statische Elemente (Wände, Boden-Tiles, PADS)
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];

            // Hard Walls
            if (tile === TYPES.WALL_HARD) {
                if (levelDef.id === 'ice') {
                    ctx.fillStyle = '#4466ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#6688ff'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = '#2244aa'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                    ctx.fillStyle = '#ccffff'; ctx.fillRect(px + 8, py + 8, 8, 8);
                } else if (levelDef.id === 'jungle' || levelDef.id === 'beach') {
                    // Felsiger Look für Beach & Jungle
                    ctx.fillStyle = levelDef.wallHard; 
                    if (levelDef.id === 'beach') ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    else { ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, TILE_SIZE/2-2, 0, Math.PI*2); ctx.fill(); }
                    
                    ctx.fillStyle = 'rgba(0,0,0,0.3)'; 
                    ctx.beginPath(); ctx.arc(px+TILE_SIZE/2-5, py+TILE_SIZE/2-5, 10, 0, Math.PI*2); ctx.fill();
                } else if (levelDef.id === 'hell') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#222'; ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#111'; ctx.fillRect(px+6, py+6, 4, 4); ctx.fillRect(px+38, py+6, 4, 4); ctx.fillRect(px+6, py+38, 4, 4); ctx.fillRect(px+38, py+38, 4, 4);
                } else if (levelDef.id === 'stone') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#333'; ctx.fillRect(px+10, py+10, TILE_SIZE-20, TILE_SIZE-20);
                }
            } 
            // Boden-Objekte
            else if (tile === TYPES.WATER) {
                if (levelDef.id !== 'beach') { // Beach Wasser ist im Hintergrund
                    ctx.fillStyle = '#3366ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#6699ff'; ctx.lineWidth = 2; const offset = Math.sin(x) * 4; ctx.beginPath(); ctx.moveTo(px + 4, py + 16 + offset); ctx.bezierCurveTo(px+16, py+8+offset, px+32, py+24+offset, px+44, py+16+offset); ctx.stroke();
                }
            } else if (tile === TYPES.BRIDGE) {
                ctx.fillStyle = '#4a3b2a'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px+2, py, 44, TILE_SIZE);
                ctx.strokeStyle = '#5c3c1e'; ctx.lineWidth = 2; for(let i=0; i<TILE_SIZE; i+=8) { ctx.beginPath(); ctx.moveTo(px+2, py+i); ctx.lineTo(px+46, py+i); ctx.stroke(); }
            } else if (tile === TYPES.OIL) {
                const cx = px + TILE_SIZE / 2; const cy = py + TILE_SIZE / 2;
                ctx.fillStyle = '#7a6a6a'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#050202'; ctx.beginPath(); ctx.ellipse(cx, cy, TILE_SIZE*0.38, TILE_SIZE*0.32, Math.PI*0.1, 0, Math.PI*2); ctx.fill();
                const varyX = (x % 5 - 2) * 3; const varyY = (y % 5 - 2) * 3;
                ctx.beginPath(); ctx.arc(cx - 12 + varyX, cy + 8 + varyY, 10, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 10 - varyY, cy - 10 + varyX, 9, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
                ctx.beginPath(); ctx.ellipse(cx - 8, cy - 12, 10, 5, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx + 12, cy + 12, 4, 2, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
            }

            // Spezial-Pads (Boost) - Jetzt auch für BEACH
            if ((levelDef.id === 'hell' || levelDef.id === 'ice' || levelDef.id === 'beach') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                ctx.fillStyle = levelDef.id === 'ice' ? '#000044' : '#440000'; 
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                
                // Boost Pfeil
                ctx.fillStyle = levelDef.id === 'ice' ? '#00ccff' : '#ff0000'; 
                ctx.fillRect(px + 20, py + 8, 8, 32);
                ctx.beginPath(); ctx.moveTo(px+24, py+2); ctx.lineTo(px+30, py+10); ctx.lineTo(px+18, py+10); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+24, py+46); ctx.lineTo(px+30, py+38); ctx.lineTo(px+18, py+38); ctx.fill(); 
                ctx.fillRect(px + 8, py + 20, 32, 8);
                ctx.beginPath(); ctx.moveTo(px+2, py+24); ctx.lineTo(px+10, py+18); ctx.lineTo(px+10, py+30); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+46, py+24); ctx.lineTo(px+38, py+18); ctx.lineTo(px+38, py+30); ctx.fill(); 
            }
            
            // Direction Pads
            const dirPad = DIRECTION_PADS.find(p => p.x === x && p.y === y);
            if (dirPad) {
                const cx = px + TILE_SIZE/2; const cy = py + TILE_SIZE/2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#aaaaaa'; ctx.beginPath(); const size = 8; 
                if (dirPad.dir.y === -1) { ctx.moveTo(cx, cy - size - 2); ctx.lineTo(cx - size, cy + size - 2); ctx.lineTo(cx + size, cy + size - 2); } 
                else if (dirPad.dir.x === 1) { ctx.moveTo(cx + size + 2, cy); ctx.lineTo(cx - size + 2, cy - size); ctx.lineTo(cx - size + 2, cy + size); } 
                else if (dirPad.dir.y === 1) { ctx.moveTo(cx, cy + size + 2); ctx.lineTo(cx - size, cy - size + 2); ctx.lineTo(cx + size, cy - size + 2); } 
                else if (dirPad.dir.x === -1) { ctx.moveTo(cx - size - 2, cy); ctx.lineTo(cx + size - 2, cy - size); ctx.lineTo(cx + size - 2, cy + size); }
                ctx.fill();
            }
        }
    }

    if (levelDef.hasCentralFire) {
        const cx = HELL_CENTER.x * TILE_SIZE; const cy = HELL_CENTER.y * TILE_SIZE;
        ctx.fillStyle = '#0a0505'; ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);
    }

    return c;
}

// --- DYNAMISCHE ZEICHEN-SCHLEIFE ---
export function draw(ctx, canvas) {
    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // Dynamic Fire Pit
    if (state.currentLevel.hasCentralFire) {
        const cx = HELL_CENTER.x * TILE_SIZE; const cy = HELL_CENTER.y * TILE_SIZE;
        const centerX = cx + TILE_SIZE/2; const centerY = cy + TILE_SIZE/2;
        if (!state.hellFireActive) {
            ctx.fillStyle = '#332222'; const w = 16; 
            ctx.fillRect(centerX - w/2, cy, w, TILE_SIZE/2); ctx.fillRect(centerX - w/2, centerY, w, TILE_SIZE/2);
            ctx.fillRect(cx, centerY - w/2, TILE_SIZE/2, w); ctx.fillRect(centerX, centerY - w/2, TILE_SIZE/2, w);
            ctx.beginPath(); ctx.arc(centerX, centerY, 10, 0, Math.PI * 2); ctx.fillStyle = '#221111'; ctx.fill(); ctx.strokeStyle = '#443333'; ctx.lineWidth = 2; ctx.stroke();
        } else {
            let lavaColor = '#880000'; let coreColor = '#aa2200';
            if (state.hellFirePhase === 'WARNING') {
                const pulse = Math.sin(Date.now() / 50); const r = 200 + 55 * pulse; const g = 100 + 100 * pulse;
                lavaColor = `rgb(${r}, ${g}, 0)`; coreColor = `rgb(255, ${220 + 35 * pulse}, 200)`; 
            }
            ctx.fillStyle = lavaColor; const w = 18; 
            ctx.fillRect(centerX - w/2, cy, w, TILE_SIZE); ctx.fillRect(cx, centerY - w/2, TILE_SIZE, w);
            ctx.strokeStyle = '#440000'; ctx.lineWidth = 2;
            ctx.strokeRect(centerX - w/2, cy, w, TILE_SIZE); ctx.strokeRect(cx, centerY - w/2, TILE_SIZE, w);
            ctx.beginPath(); ctx.arc(centerX, centerY, 14, 0, Math.PI * 2); ctx.fillStyle = coreColor; ctx.fill();
            ctx.strokeStyle = state.hellFirePhase === 'WARNING' ? '#ffff00' : '#ffaa00'; ctx.lineWidth = 3; ctx.stroke();
        }
    }

    // Grid Loop (Soft Walls, Items)
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const item = state.items[y][x];
            const tile = state.grid[y][x];

            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) drawItem(ctx, item, px, py);

            if (tile === TYPES.WALL_SOFT) {
                if (state.currentLevel.id === 'ice') {
                    ctx.fillStyle = '#88ccff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE - 4); ctx.moveTo(px + TILE_SIZE - 4, py + 4); ctx.lineTo(px + 4, py + TILE_SIZE - 4); ctx.stroke();
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(px + TILE_SIZE/2 - 2, py + TILE_SIZE/2 - 2, 4, 4); 
                } else if (state.currentLevel.id === 'jungle') {
                    ctx.fillStyle = '#116611'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    let seed = x * 12.9898 + y * 78.233; const pseudoRandom = () => { seed += 1; const t = Math.sin(seed) * 10000; return t - Math.floor(t); };
                    ctx.fillStyle = '#228822'; for(let i=0; i<5; i++) { ctx.beginPath(); ctx.arc(px + pseudoRandom()*40, py + pseudoRandom()*40, 10, 0, Math.PI*2); ctx.fill(); }
                    ctx.fillStyle = '#44aa44'; for(let i=0; i<3; i++) { ctx.beginPath(); ctx.arc(px + pseudoRandom()*40, py + pseudoRandom()*40, 6, 0, Math.PI*2); ctx.fill(); }
                } else if (state.currentLevel.id === 'hell') {
                    ctx.fillStyle = '#880000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#aa0000'; ctx.fillRect(px, py, 22, 10); ctx.fillRect(px+26, py, 22, 10); ctx.fillRect(px, py+12, 10, 10); ctx.fillRect(px+14, py+12, 22, 10); ctx.fillRect(px+40, py+12, 8, 10); ctx.fillRect(px, py+24, 22, 10); ctx.fillRect(px+26, py+24, 22, 10); ctx.fillRect(px, py+36, 10, 10); ctx.fillRect(px+14, py+36, 22, 10); ctx.fillRect(px+40, py+36, 8, 10);
                } else if (state.currentLevel.id === 'stone') {
                    ctx.fillStyle = '#666'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px+10, py+10); ctx.lineTo(px+20, py+20); ctx.lineTo(px+30, py+10); ctx.moveTo(px+15, py+30); ctx.lineTo(px+25, py+40); ctx.stroke();
                    ctx.fillStyle = '#555'; ctx.fillRect(px+5, py+35, 10, 5); ctx.fillRect(px+30, py+20, 8, 8);
                } else if (state.currentLevel.id === 'beach') {
                    // Check if in water
                    const limit = 9 + Math.sin(y * 0.8) * 1.5;
                    const isInWater = x > limit;

                    ctx.fillStyle = isInWater ? state.currentLevel.wallSoftWater : state.currentLevel.wallSoft; 
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    
                    // Struktur (Treibholz/Koralle)
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(px+5, py+5, TILE_SIZE-10, 5);
                    ctx.fillRect(px+5, py+15, TILE_SIZE-10, 5);
                    ctx.fillRect(px+5, py+25, TILE_SIZE-10, 5);
                    ctx.fillRect(px+5, py+35, TILE_SIZE-10, 5);
                } else {
                    ctx.fillStyle = state.currentLevel.wallSoft; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = state.currentLevel.wallSoftLight; ctx.fillRect(px+2, py+2, 20, 10); ctx.fillRect(px+26, py+2, 20, 10); ctx.fillRect(px+2, py+14, 10, 10); ctx.fillRect(px+14, py+14, 20, 10); ctx.fillRect(px+36, py+14, 10, 10); ctx.fillRect(px+2, py+26, 20, 10); ctx.fillRect(px+26, py+26, 20, 10);
                }
            }
        }
    }

    // Bomben
    state.bombs.forEach(b => {
        const px = b.px; const py = b.py; const scale = 1 + Math.sin(Date.now() / 100) * 0.1;
        let baseColor = '#444444'; if (state.currentLevel.id === 'jungle') baseColor = '#000000';
        ctx.fillStyle = b.napalm ? '#dd0000' : baseColor; 
        if (b.isBlue) ctx.fillStyle = '#000080';
        ctx.beginPath(); ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 16 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + TILE_SIZE/2 + 8, py + TILE_SIZE/2 - 8); ctx.lineTo(px + TILE_SIZE/2 + 12, py + TILE_SIZE/2 - 14); ctx.stroke();
        ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(px + TILE_SIZE/2 + 12, py + TILE_SIZE/2 - 14, 3, 0, Math.PI*2); ctx.fill();
        const tipX = px + TILE_SIZE/2 + 12 * scale; const tipY = py + TILE_SIZE/2 - 14 * scale;
        ctx.fillStyle = Math.random() > 0.5 ? '#ffff00' : '#ff4400'; ctx.beginPath(); ctx.arc(tipX, tipY, 3 + Math.random()*2, 0, Math.PI*2); ctx.fill();
        for(let j=0; j<3; j++) { const angle = Math.random() * Math.PI * 2; const dist = 2 + Math.random() * 6; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.fillRect(tipX + Math.cos(angle)*dist, tipY + Math.sin(angle)*dist, 2, 2); ctx.globalAlpha = 1.0; }
    });

    drawAllParticles(ctx);

    state.players.slice().sort((a,b) => a.y - b.y).forEach(p => p.draw());
}

// --- HELPER ---
export function drawLevelPreview(ctx, w, h, levelDef) {
    const tileSize = w / 3; 
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    
    // BEACH PREVIEW SPECIAL
    if (levelDef.id === 'beach') {
        ctx.fillStyle = levelDef.waterColor; 
        ctx.beginPath();
        ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w*0.6, h); ctx.lineTo(w*0.6, 0);
        ctx.fill();
    }

    const drawBlock = (x, y, type) => {
        const px = x * tileSize; const py = y * tileSize;
        if (type === TYPES.WALL_HARD) {
             ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, tileSize, tileSize);
             if (levelDef.id !== 'beach') {
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px+tileSize-2, py, 2, tileSize); ctx.fillRect(px, py+tileSize-2, tileSize, 2);
             }
        } else if (type === TYPES.WALL_SOFT) {
             const isInWater = (levelDef.id === 'beach' && x === 2); // Im Preview ist rechts Wasser
             ctx.fillStyle = isInWater ? (levelDef.wallSoftWater || levelDef.wallSoft) : levelDef.wallSoft; 
             ctx.fillRect(px, py, tileSize, tileSize);
             if (levelDef.id !== 'beach') {
                ctx.fillStyle = levelDef.wallSoftLight; ctx.fillRect(px+2, py+2, tileSize-4, tileSize-4);
             }
        }
    };
    drawBlock(0, 0, TYPES.WALL_HARD); drawBlock(1, 0, TYPES.WALL_SOFT); drawBlock(2, 0, TYPES.WALL_HARD);
    drawBlock(0, 1, TYPES.WALL_SOFT); drawBlock(2, 1, TYPES.WALL_SOFT);
    drawBlock(0, 2, TYPES.WALL_HARD); drawBlock(1, 2, TYPES.WALL_SOFT); drawBlock(2, 2, TYPES.WALL_HARD);
}

export function drawItem(ctx, type, x, y) {
    const pad = 2; const size = TILE_SIZE - pad*2;
    ctx.fillStyle = '#442222'; ctx.fillRect(x+pad, y+pad, size, size);
    ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 2; ctx.strokeRect(x+pad, y+pad, size, size);
    const cx = x + TILE_SIZE/2; const cy = y + TILE_SIZE/2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '32px sans-serif';
    switch(type) {
        case ITEMS.BOMB_UP: ctx.fillStyle = '#0088ff'; ctx.fillText('💣', cx, cy); break; 
        case ITEMS.RANGE_UP: ctx.fillStyle = '#ffaa00'; ctx.fillText('🔥', cx, cy); break; 
        case ITEMS.SPEED_UP: ctx.fillStyle = '#ffff00'; ctx.fillText('👟', cx, cy); break; 
        case ITEMS.NAPALM: ctx.fillStyle = '#ff0000'; ctx.fillText('☢️', cx, cy); break;   
        case ITEMS.ROLLING: ctx.fillStyle = '#ffffff'; ctx.fillText('🎳', cx, cy); break; 
        case ITEMS.SKULL: ctx.fillStyle = '#cccccc'; ctx.fillText('💀', cx, cy); break;   
    }
}