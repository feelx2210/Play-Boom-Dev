import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    // Safety
    if (!charDef) return document.createElement('canvas');

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    // WICHTIG: Höheres Canvas für Hüte/Haare
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    // WICHTIG: Mittelpunkt tiefer setzen
    ctx.translate(24, 40);

    // --- HELPER FUNKTIONEN (JETZT SICHER DEFINIERT) ---
    const fillCircle = (x, y, r, col) => { 
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); 
    };
    
    const rect = (x, y, w, h, col) => { 
        ctx.fillStyle = col; ctx.fillRect(x, y, w, h); 
    };
    
    const gradient = (y1, y2, c1, c2) => { 
        const g = ctx.createLinearGradient(0, y1, 0, y2); 
        g.addColorStop(0, c1); g.addColorStop(1, c2); 
        return g; 
    };

    const id = charDef.id;

    // ============================================================
    // 1. ORIGINAL CHARACTERS (Original Vektor-Stil)
    // ============================================================
    
    if (id === 'lucifer') {
        const skinGrad = gradient(-24, 10, '#ff5555', '#aa0000');
        ctx.fillStyle = '#1a0505'; // Hufe
        if (d==='side') { ctx.fillRect(-4, 14, 8, 10); } 
        else { ctx.fillRect(-8, 14, 6, 10); ctx.fillRect(2, 14, 6, 10); }
        
        ctx.fillStyle = skinGrad;
        ctx.beginPath(); ctx.ellipse(0, -5, 12, 18, 0, 0, Math.PI*2); ctx.fill(); // Körper
        fillCircle(0, -20, 10, skinGrad); // Kopf
        
        const hornGrad = gradient(-35, -20, '#ffffff', '#bbbbbb');
        ctx.fillStyle = hornGrad;
        if(d!=='back') {
            ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(-14, -32, -10, -40); ctx.lineTo(-4, -28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(6, -26); ctx.quadraticCurveTo(14, -32, 10, -40); ctx.lineTo(4, -28); ctx.fill();
        }
        if(d==='front') {
            rect(-7, -22, 5, 4, '#ffff00'); rect(2, -22, 5, 4, '#ffff00');
            rect(-5, -21, 2, 2, '#000'); rect(3, -21, 2, 2, '#000');
            ctx.fillStyle='#330000'; ctx.beginPath(); ctx.arc(0, -14, 4, 0, Math.PI, false); ctx.fill(); 
        }
    }
    else if (id === 'rambo') {
        const skin = '#ffccaa'; const skinShadow = '#eebba0';
        ctx.fillStyle = '#226622'; 
        if(d==='side') { ctx.fillRect(-5, 10, 10, 14); } else { ctx.fillRect(-9, 10, 8, 14); ctx.fillRect(1, 10, 8, 14); }
        
        const bodyGrad = gradient(-15, 10, skin, skinShadow);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-14, 0, -8, 10); ctx.lineTo(8, 10); ctx.quadraticCurveTo(14, 0, 12, -18); ctx.fill();
        
        ctx.strokeStyle = '#442200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(10, 10); ctx.stroke();
        fillCircle(0, -22, 9, skin); // Kopf
        
        ctx.fillStyle = '#cc0000'; ctx.fillRect(-10, -28, 20, 6); // Bandana
        if(d==='back' || d==='side') { ctx.beginPath(); ctx.moveTo(8, -25); ctx.quadraticCurveTo(16, -20, 14, -10); ctx.lineTo(10, -22); ctx.fill(); } 
        
        fillCircle(0, -24, 9, '#111'); // Haare
        if(d==='front') {
            rect(-7, -24, 5, 4, '#fff'); rect(2, -24, 5, 4, '#fff');
            rect(-5, -23, 2, 2, '#000'); rect(3, -23, 2, 2, '#000');
        }
    }
    else if (id === 'nun') {
        const robeGrad = gradient(-20, 20, '#333', '#000');
        ctx.fillStyle = robeGrad;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-14, 24); ctx.lineTo(14, 24); ctx.fill();
        fillCircle(0, -18, 7, '#ffccaa');
        
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -20, 9, Math.PI, 0); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 7, Math.PI, 0); ctx.stroke();
        
        if(d==='front') {
            rect(-3, -5, 6, 18, '#ffdd44'); rect(-8, 0, 16, 6, '#ffdd44');
            rect(-4, -19, 2, 2, '#000'); rect(2, -19, 2, 2, '#000');
        }
    }
    else if (id === 'yeti') {
        const furGrad = gradient(-20, 20, '#ddffff', '#88ccff');
        fillCircle(0, 0, 16, furGrad); // Body
        fillCircle(-10, -10, 8, furGrad); fillCircle(10, -10, 8, furGrad);
        fillCircle(-8, 12, 8, furGrad); fillCircle(8, 12, 8, furGrad);
        fillCircle(0, -20, 10, furGrad); // Kopf
        
        if(d==='front') {
            fillCircle(0, -18, 6, '#004488'); // Gesicht
            rect(-4, -20, 3, 3, '#fff'); rect(1, -20, 3, 3, '#fff');
            rect(-3, -15, 2, 3, '#fff'); rect(1, -15, 2, 3, '#fff');
        }
    }

    // ============================================================
    // 2. NEUE PROMIS (Detaillierter Vektor-Stil)
    // ============================================================
    else {
        const drawBody = (skinColor, shirtGrad, pantsColor, shoeColor, widthMod = 1) => {
            // Beine
            ctx.fillStyle = pantsColor;
            if (d === 'side') rect(-5, 12, 10, 12, pantsColor);
            else { rect(-9 * widthMod, 12, 8 * widthMod, 12, pantsColor); rect(1 * widthMod, 12, 8 * widthMod, 12, pantsColor); }
            // Schuhe
            ctx.fillStyle = shoeColor;
            if (d === 'side') rect(-5, 22, 12, 4, shoeColor);
            else { rect(-9 * widthMod, 22, 8 * widthMod, 4, shoeColor); rect(1 * widthMod, 22, 8 * widthMod, 4, shoeColor); }
            // Torso (Trapez)
            ctx.fillStyle = shirtGrad;
            ctx.beginPath(); 
            ctx.moveTo(-12 * widthMod, -18); ctx.lineTo(12 * widthMod, -18); 
            ctx.lineTo(10 * widthMod, 12); ctx.lineTo(-10 * widthMod, 12); 
            ctx.fill();
            // Kopf
            fillCircle(0, -22, 10, skinColor);
            // Arme
            if (d !== 'side') {
                ctx.fillStyle = shirtGrad; 
                ctx.beginPath(); ctx.ellipse(-15 * widthMod, -6, 5, 12, 0.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(15 * widthMod, -6, 5, 12, -0.2, 0, Math.PI*2); ctx.fill();
                fillCircle(-16 * widthMod, 6, 4, skinColor);
                fillCircle(16 * widthMod, 6, 4, skinColor);
            }
        };

        const drawFace = (glasses=false, beard=false) => {
            if (d !== 'front') return;
            if (!glasses) {
                fillCircle(-4, -22, 3, '#fff'); fillCircle(4, -22, 3, '#fff');
                fillCircle(-4, -22, 1.5, '#000'); fillCircle(4, -22, 1.5, '#000');
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(-9, -25, 18, 6);
            }
            if (beard) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 10, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            const jersey = gradient(-14, 12, '#ff3333', '#cc0000');
            drawBody('#d2b48c', jersey, '#fff', '#fff');
            if (d === 'front') { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, 5); }
            ctx.fillStyle = '#221100'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); // Haare
            ctx.fillRect(-10, -32, 20, 8); 
            drawFace();
        }
        else if (id === 'hitman') {
            const suit = gradient(-14, 12, '#333', '#000');
            drawBody('#ffe0bd', suit, '#111', '#000');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(6, -18); ctx.lineTo(0, -6); ctx.fill();
                rect(-2, -16, 4, 14, '#cc0000');
            }
            drawFace();
            if (d === 'back') { rect(-3, -20, 6, 2, '#000'); }
        }
        else if (id === 'elon') {
            const shirt = gradient(-14, 12, '#222', '#111');
            drawBody('#f0d5be', shirt, '#111', '#333');
            if (d === 'front') {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.lineTo(0, -12); ctx.fill(); 
            }
            ctx.fillStyle = '#332211'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); 
            drawFace();
        }
        else if (id === 'mj') {
            const jacket = gradient(-14, 12, '#222', '#000');
            drawBody('#8d5524', jacket, '#111', '#000', 0.9);
            rect(-9, 20, 8, 2, '#fff'); rect(1, 20, 8, 2, '#fff'); // Socken
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -18); ctx.lineTo(0, -10); ctx.fill();
                rect(13, 4, 6, 6, '#fff'); // Handschuh
            }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -30, 14, 3, 0, 0, Math.PI*2); ctx.fill(); // Hut Krempe
            rect(-9, -38, 18, 8, '#111'); // Hut Top
            rect(-9, -34, 18, 2, '#fff'); // Hut Band
            drawFace();
        }
        else if (id === 'dua') {
            const skin = '#f0d5be';
            drawBody(skin, '#111', '#111', '#111', 0.9);
            rect(-10, -4, 20, 6, skin); // Bauchfrei
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, 0); ctx.fill(); // Haare
            if(d!=='back') { rect(-12, -24, 6, 22, '#000'); rect(6, -24, 6, 22, '#000'); }
            else rect(-11, -24, 22, 22, '#000');
            drawFace();
        }
        else if (id === 'lebron') {
            const jersey = gradient(-14, 12, '#fdb927', '#552583');
            drawBody('#5c3a1e', jersey, '#552583', '#fff', 1.1);
            if (d === 'front') { ctx.fillStyle = '#552583'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 5); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); // Hairline
            rect(-10, -20, 20, 10, '#111'); // Bart
            rect(-10, -28, 20, 3, '#fff'); // Stirnband
            drawFace();
        }
        else if (id === 'pam') {
            const skin = '#dca386';
            const swim = gradient(-20, 12, '#ff4444', '#cc0000');
            drawBody(skin, swim, skin, skin, 0.9); 
            ctx.fillStyle = swim; rect(-9, 10, 18, 6, swim); // Hüfte
            if(d==='front') rect(-4, -14, 8, 6, skin); 
            ctx.fillStyle = '#ffee88'; 
            ctx.beginPath(); ctx.arc(0, -26, 14, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -20, 8, 16, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10, -20, 8, 16, -0.2, 0, Math.PI*2); ctx.fill();
            drawFace();
        }
        else if (id === 'drizzy') {
            const hoodie = gradient(-20, 12, '#333', '#111');
            drawBody('#ac8b66', hoodie, '#222', '#fff');
            if (d === 'front') { fillCircle(0, -4, 5, '#ffd700'); } // Eule
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); 
            drawFace(false, true); // Bart
        }
        else if (id === '2pac') {
            drawBody('#7a4e32', '#fff', '#4466aa', '#fff'); 
            ctx.fillStyle = '#3366cc'; rect(-10, -28, 20, 6, '#3366cc');
            if (d === 'front') { ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(16, -32); ctx.lineTo(16, -20); ctx.fill(); }
            drawFace(false, true);
        }
        else if (id === 'gaga') {
            const suit = gradient(-20, 12, '#0088ff', '#0044aa');
            drawBody('#ffe0e0', suit, suit, '#fff', 0.9);
            ctx.fillStyle = '#eeeedd'; ctx.beginPath(); ctx.arc(0, -24, 12, Math.PI, 0); ctx.fill();
            if (d!=='back') { rect(-12, -24, 6, 22, '#eeeedd'); rect(6, -24, 6, 22, '#eeeedd'); }
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(-10, -38); ctx.lineTo(-10, -26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(10, -38); ctx.lineTo(10, -26); ctx.fill();
            drawFace(true); // Brille
        }
        else if (id === '007') {
            const suit = gradient(-20, 12, '#555', '#333');
            drawBody('#f0d5be', suit, '#333', '#000');
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(0,-8); ctx.lineTo(6,-18); ctx.fill();
                rect(-3, -16, 6, 4, '#000'); 
            }
            ctx.fillStyle='#ccaa88'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); 
            drawFace();
            if (d === 'side') { rect(8, 2, 8, 4, '#333'); } // Waffe
        }
    }

    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(-25, -35, 50, 60); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

// --- LEVEL CACHING ---
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

    const bgGrad = ctx.createRadialGradient(c.width/2, c.height/2, 100, c.width/2, c.height/2, c.width);
    bgGrad.addColorStop(0, levelDef.bg); bgGrad.addColorStop(1, '#000000'); 
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, c.width, c.height);

    // Details im Boden (Punkte, Sterne, etc.)
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

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for(let i=0; i<=GRID_W; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); }
    for(let i=0; i<=GRID_H; i++) { ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    if (state.grid) {
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const px = x * TILE_SIZE; const py = y * TILE_SIZE;
                const tile = state.grid[y][x];

                // Hard Walls
                if (tile === TYPES.WALL_HARD) {
                    ctx.fillStyle = levelDef.wallHard;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px, py+44, 48, 4); ctx.fillRect(px+44, py, 4, 48);
                    
                    if (levelDef.id === 'hell') {
                        ctx.fillStyle = '#220000'; ctx.fillRect(px+10, py+10, 28, 28); 
                        ctx.strokeStyle = '#440000'; ctx.strokeRect(px+12, py+12, 24, 24);
                    } else if (levelDef.id === 'stone') {
                        ctx.strokeStyle = '#555'; ctx.lineWidth=2; ctx.strokeRect(px+8, py+8, 32, 32);
                        ctx.fillStyle = '#333'; ctx.fillRect(px+14, py+14, 20, 20);
                    } else if (levelDef.id === 'jungle') {
                        ctx.fillStyle = '#446644'; ctx.beginPath(); ctx.arc(px+10, py+10, 8, 0, Math.PI*2); ctx.fill();
                    }
                } 
                // Wasser / Boden-Objekte
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

                // Pads
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
                
                // HELL CENTER
                if (levelDef.hasCentralFire && x===HELL_CENTER.x && y===HELL_CENTER.y) {
                    ctx.fillStyle = '#1a0000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#550000'; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
    return c;
}

export function draw(ctx, canvas) {
    if (!state.currentLevel) return;

    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // Dynamische Objekte (Items, Soft Walls)
    for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];
            const item = state.items[y][x];

            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) drawItem(ctx, item, px, py);

            if (tile === TYPES.WALL_SOFT) {
                const lvl = state.currentLevel;
                ctx.fillStyle = lvl.wallSoft;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                
                // Muster
                ctx.fillStyle = lvl.wallSoftLight; 
                if (lvl.id === 'hell') {
                    // Lava Risse
                    ctx.fillStyle = '#cc4400'; 
                    ctx.beginPath(); ctx.moveTo(px+10, py+10); ctx.lineTo(px+30, py+20); ctx.lineTo(px+15, py+35); ctx.fill();
                } else if (lvl.id === 'ice') {
                    // Eisschollen Look
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(px+4, py+4, 10, 10); ctx.fillRect(px+20, py+20, 20, 5);
                } else if (lvl.id === 'jungle') {
                    // Holz/Kiste
                    ctx.fillStyle = '#664422'; ctx.fillRect(px+4, py+4, 40, 40);
                    ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(px+4, py+4); ctx.lineTo(px+44, py+44); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(px+44, py+4); ctx.lineTo(px+4, py+44); ctx.stroke();
                } else {
                    // Ziegel
                    ctx.fillRect(px+4, py+10, 18, 8); ctx.fillRect(px+26, py+10, 18, 8);
                    ctx.fillRect(px+4, py+28, 18, 8); ctx.fillRect(px+26, py+28, 18, 8);
                }
            }
        }
    }

    // Bomben
    state.bombs.forEach(b => {
        const bx = b.px + 24; const by = b.py + 24;
        const pulse = 1 + Math.sin(Date.now() * 0.015) * 0.1;
        ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
        ctx.fillStyle = b.napalm ? '#b00' : (b.isRolling ? '#557' : '#333');
        ctx.beginPath(); ctx.arc(bx, by, 18*pulse, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        const g = ctx.createRadialGradient(bx-6, by-6, 2, bx, by, 20);
        g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx-6, by-6, 8, 0, Math.PI*2); ctx.fill();
        if (b.napalm) { ctx.fillStyle='#fc0'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText('☢', bx, by+4); }
    });

    drawAllParticles(ctx);

    if (state.players) {
        [...state.players].sort((a,b) => a.y - b.y).forEach(p => p.draw());
    }
}

export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, lastDir = {x:0, y:1}) {
    let d = 'front';
    if (lastDir.y < 0) d = 'back';
    else if (lastDir.x !== 0) d = 'side';
    
    ctx.save();
    ctx.translate(x, y);
    if (lastDir.x < 0) ctx.scale(-1, 1); 

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const sprite = getCachedSprite(charDef, d, isCursed);
    // WICHTIG: Offset anpassen für 48x64 Canvas (Mitte bei 24,40)
    ctx.drawImage(sprite, -24, -40);
    
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