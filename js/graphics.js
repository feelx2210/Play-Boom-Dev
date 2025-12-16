import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas');

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    // CANVAS HÖHER MACHEN (64px), damit Hüte/Haare Platz haben
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    // STARTPUNKT SETZEN (Füße bei Y=44, Kopf wächst nach oben)
    ctx.translate(24, 44);

    // --- PIXEL ART HELPER ---
    // Zeichnet "Pixel" Rechtecke. Keine runden Kreise!
    const rect = (x, y, w, h, col) => { 
        ctx.fillStyle = col; 
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); 
    };

    const id = charDef.id;
    const bodyCol = charDef.color;
    const accent = charDef.accent;

    // --- BASIS KÖRPER (8-BIT STYLE) ---
    // Beine
    const pantsCol = (id==='cristiano'||id==='lebron'||id==='mj') ? '#fff' : (id==='2pac'||id==='elon') ? '#345' : '#222';
    const shoeCol = (id==='cristiano'||id==='lebron'||id==='mj') ? '#fff' : '#000';
    const skinCol = (id==='mj'||id==='lebron'||id==='2pac'||id==='drizzy') ? '#8d5524' : '#ffccaa';

    // Standard Beine
    if (id !== 'lucifer' && id !== 'yeti') {
        if (d === 'side') {
            rect(-4, 0, 8, 12, pantsCol); // Bein Seite
            rect(-4, 12, 10, 4, shoeCol); // Schuh
        } else {
            rect(-8, 0, 6, 12, pantsCol); rect(2, 0, 6, 12, pantsCol); // Beine
            rect(-8, 12, 6, 4, shoeCol); rect(2, 12, 6, 4, shoeCol); // Schuhe
        }
    }

    // --- CHARAKTER SPEZIFISCH ---

    if (id === 'lucifer') {
        // Rotes Teufels-Pixel-Design
        rect(-8, -14, 16, 24, '#e62020'); // Body
        rect(-8, 10, 6, 6, '#000'); rect(2, 10, 6, 6, '#000'); // Hufe
        // Kopf
        rect(-10, -26, 20, 14, '#e62020');
        // Hörner
        rect(-8, -32, 2, 6, '#fff'); rect(6, -32, 2, 6, '#fff');
        if(d==='front') {
            rect(-6, -22, 4, 4, '#ff0'); rect(2, -22, 4, 4, '#ff0'); // Augen
            rect(-4, -14, 8, 2, '#000'); // Mund
        }
    }
    else if (id === 'rambo') {
        // Hose Grün
        rect(-8, 0, 6, 12, '#262'); rect(2, 0, 6, 12, '#262');
        // Oberkörper (Nackt)
        rect(-10, -16, 20, 16, skinCol);
        // Bandolier
        rect(-10, -16, 2, 2, '#420'); rect(-6, -12, 2, 2, '#420'); rect(2, -4, 2, 2, '#420');
        // Kopf
        rect(-9, -28, 18, 12, skinCol);
        // Schwarze Haare
        rect(-10, -30, 20, 6, '#111');
        if(d==='side' || d==='back') rect(-10, -28, 4, 12, '#111'); // Vokuhila
        // Rotes Stirnband
        rect(-10, -26, 20, 2, '#f00');
        if(d==='side' || d==='back') rect(8, -26, 6, 2, '#f00'); // Band
        if(d==='front') { rect(-6,-24,2,2,'#000'); rect(4,-24,2,2,'#000'); } // Augen
    }
    else if (id === 'nun') {
        // Robe
        rect(-10, -16, 20, 28, '#111');
        // Kopf
        rect(-8, -26, 16, 12, skinCol);
        // Haube
        rect(-10, -30, 20, 8, '#111'); rect(-10, -30, 2, 20, '#111'); rect(8, -30, 2, 20, '#111');
        // Kreuz
        if(d==='front') {
            rect(-2, -8, 4, 12, '#fc0'); rect(-6, -4, 12, 4, '#fc0');
            rect(-4,-22,2,2,'#000'); rect(2,-22,2,2,'#000');
        }
    }
    else if (id === 'yeti') {
        rect(-12, -10, 24, 24, '#0cf'); // Body Blue
        rect(-10, 14, 8, 4, '#0cf'); rect(2, 14, 8, 4, '#0cf'); // Feet
        rect(-12, -26, 24, 16, '#0cf'); // Head
        if(d==='front') {
            rect(-8, -20, 16, 8, '#048'); // Face Dark
            rect(-4, -18, 2, 2, '#fff'); rect(2, -18, 2, 2, '#fff'); // Eyes
        }
    }
    // --- PROMIS (PIXEL STYLE) ---
    else {
        // Torso
        rect(-10, -16, 20, 16, bodyCol); 
        // Kopf
        rect(-8, -28, 16, 12, skinCol);
        
        // Arme
        if (d !== 'side') {
            rect(-14, -14, 4, 12, bodyCol); // Links
            rect(10, -14, 4, 12, bodyCol);  // Rechts
            rect(-14, -2, 4, 4, skinCol);   // Hand L
            rect(10, -2, 4, 4, skinCol);    // Hand R
        }

        // --- DETAILS ---
        if (id === 'pam') {
            // Roter Badeanzug
            rect(-9, 0, 18, 6, '#f00'); // Hüfte
            if(d==='front') rect(-4, -12, 8, 6, skinCol); // Ausschnitt
            // Riesige Blonde Haare (Blocky)
            rect(-12, -34, 24, 8, '#fe8'); // Top
            rect(-14, -28, 6, 16, '#fe8'); // Seite L
            rect(8, -28, 6, 16, '#fe8');   // Seite R
        }
        else if (id === 'mj') {
            // Hut
            rect(-10, -32, 20, 4, '#111'); // Krempe
            rect(-8, -38, 16, 6, '#111');  // Top
            rect(-8, -34, 16, 2, '#fff');  // Band
            if(d==='front') rect(10, 0, 4, 4, '#fff'); // Handschuh
        }
        else if (id === 'lebron') {
            rect(-8, -30, 16, 4, '#111'); // Haare
            rect(-8, -26, 16, 2, '#fff'); // Stirnband
            if(d==='front') {
                rect(-8, -18, 16, 6, '#111'); // Bart
                rect(-4, -8, 8, 6, '#528'); // Nummer Block
            }
        }
        else if (id === 'cristiano') {
            rect(-8, -32, 16, 6, '#210'); // Haare
            if(d==='front') { rect(-2, -10, 4, 8, '#fff'); } // Nr 7
        }
        else if (id === 'dua') {
            rect(-10, -4, 20, 4, skinCol); // Bauchfrei
            // Schwarze lange Haare
            rect(-10, -32, 20, 6, '#000');
            rect(-12, -28, 4, 16, '#000'); rect(8, -28, 4, 16, '#000');
        }
        else if (id === '2pac') {
            // Bandana
            rect(-9, -30, 18, 4, '#36c');
            rect(8, -28, 4, 4, '#36c'); // Knoten
            rect(-8, -14, 16, 14, '#fff'); // Tanktop
        }
        else if (id === 'gaga') {
            // Haare + Schleife
            rect(-10, -34, 20, 8, '#eed');
            rect(-4, -40, 8, 6, '#eed'); // Schleife
            if(d==='front') rect(-8, -24, 16, 4, '#111'); // Brille
        }
        else if (id === 'hitman') {
            if(d==='front') {
                rect(-4, -16, 8, 16, '#fff'); // Hemd
                rect(-2, -14, 4, 12, '#c00'); // Krawatte
            }
            if(d==='back') rect(-2, -22, 4, 2, '#000'); // Barcode
        }
        else if (id === '007') {
            if(d==='front') {
                rect(-4, -16, 8, 16, '#fff'); // Hemd
                rect(-2, -14, 4, 2, '#000'); // Fliege
            }
        }
        else if (id === 'drizzy') {
            rect(-8, -30, 16, 4, '#111'); // Haare
            if(d==='front') rect(-2, -8, 4, 4, '#fd0'); // Eule
        }
        else if (id === 'elon') {
            if(d==='front') {
               rect(-4, -10, 8, 2, '#888'); rect(-2, -8, 4, 2, '#888'); // Logo
            }
        }

        // Gesicht (Generic)
        if(d==='front' && id!=='gaga') {
            rect(-5,-24,2,2,'#000'); rect(3,-24,2,2,'#000'); // Pixel Augen
        }
    }

    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(0, 0, 48, 64); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

// --- LEVEL CACHING (Original Code restored) ---
let cachedLevelCanvas = null;
let lastLevelId = null;

export function clearLevelCache() {
    cachedLevelCanvas = null;
    lastLevelId = null;
}

function bakeStaticLevel(levelDef) {
    const c = document.createElement('canvas');
    c.width = GRID_W * TILE_SIZE;
    c.height = GRID_H * TILE_SIZE;
    const ctx = c.getContext('2d');

    // 1. Hintergrund
    ctx.fillStyle = levelDef.bg;
    ctx.fillRect(0, 0, c.width, c.height);

    // 2. Boden-Details
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

    // 4. Statische Elemente
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];

            if (tile === TYPES.WALL_HARD) {
                if (levelDef.id === 'ice') {
                    ctx.fillStyle = '#4466ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#6688ff'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = '#2244aa'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                    ctx.fillStyle = '#ccffff'; ctx.fillRect(px + 8, py + 8, 8, 8);
                } else if (levelDef.id === 'jungle') {
                    ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, TILE_SIZE/2-2, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2-5, py+TILE_SIZE/2-5, 10, 0, Math.PI*2); ctx.fill();
                } else if (levelDef.id === 'hell') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#222'; ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#111'; ctx.fillRect(px+6, py+6, 4, 4); ctx.fillRect(px+38, py+6, 4, 4); ctx.fillRect(px+6, py+38, 4, 4); ctx.fillRect(px+38, py+38, 4, 4);
                } else if (levelDef.id === 'stone') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#333'; ctx.fillRect(px+10, py+10, TILE_SIZE-20, TILE_SIZE-20);
                } else {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                }
            } 
            else if (tile === TYPES.WATER) {
                ctx.fillStyle = '#3366ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#6699ff'; ctx.lineWidth = 2; const offset = Math.sin(x) * 4; ctx.beginPath(); ctx.moveTo(px + 4, py + 16 + offset); ctx.bezierCurveTo(px+16, py+8+offset, px+32, py+24+offset, px+44, py+16+offset); ctx.stroke();
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

            if ((levelDef.id === 'hell' || levelDef.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                ctx.fillStyle = '#440000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#ff0000'; ctx.fillRect(px + 20, py + 8, 8, 32);
                ctx.beginPath(); ctx.moveTo(px+24, py+2); ctx.lineTo(px+30, py+10); ctx.lineTo(px+18, py+10); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+24, py+46); ctx.lineTo(px+30, py+38); ctx.lineTo(px+18, py+38); ctx.fill(); 
                ctx.fillRect(px + 8, py + 20, 32, 8);
                ctx.beginPath(); ctx.moveTo(px+2, py+24); ctx.lineTo(px+10, py+18); ctx.lineTo(px+10, py+30); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+46, py+24); ctx.lineTo(px+38, py+18); ctx.lineTo(px+38, py+30); ctx.fill(); 
            }
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

// --- EXPORTIERTE FUNKTIONEN ---

export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, dir = {x:0, y:1}) {
    ctx.save();
    ctx.translate(x, y);

    let d = 'front'; 
    if (dir.y < 0) d = 'back';
    else if (dir.x !== 0) d = 'side';
    if (dir.x < 0) ctx.scale(-1, 1); 

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    
    // Offset angepasst für 48x64 Canvas (Mitte bei 24, 44)
    ctx.drawImage(sprite, -24, -44);
    
    ctx.restore();
}

export function drawLevelPreview(ctx, w, h, levelDef) {
    const tileSize = w / 3; 
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    const drawBlock = (x, y, type) => {
        const px = x * tileSize; const py = y * tileSize;
        if (type === TYPES.WALL_HARD) {
             ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, tileSize, tileSize);
             ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px+tileSize-2, py, 2, tileSize); ctx.fillRect(px, py+tileSize-2, tileSize, 2);
        } else if (type === TYPES.WALL_SOFT) {
             ctx.fillStyle = levelDef.wallSoft; ctx.fillRect(px, py, tileSize, tileSize);
             ctx.fillStyle = levelDef.wallSoftLight; ctx.fillRect(px+2, py+2, tileSize-4, tileSize-4);
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
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '24px sans-serif';
    switch(type) {
        case ITEMS.BOMB_UP: ctx.fillStyle = '#0088ff'; ctx.fillText('💣', cx, cy); break; 
        case ITEMS.RANGE_UP: ctx.fillStyle = '#ffaa00'; ctx.fillText('🔥', cx, cy); break; 
        case ITEMS.SPEED_UP: ctx.fillStyle = '#ffff00'; ctx.fillText('👟', cx, cy); break; 
        case ITEMS.NAPALM: ctx.fillStyle = '#ff0000'; ctx.fillText('☢️', cx, cy); break;   
        case ITEMS.ROLLING: ctx.fillStyle = '#ffffff'; ctx.fillText('🎳', cx, cy); break; 
        case ITEMS.SKULL: ctx.fillStyle = '#cccccc'; ctx.fillText('💀', cx, cy); break;   
    }
}

export function draw(ctx, canvas) {
    // 1. Hintergrund
    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // 2. Center Fire
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

    // 3. Grid Loop (Soft Walls & Items)
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

    if (state.players) {
        state.players.slice().sort((a,b) => a.y - b.y).forEach(p => p.draw());
    }
}