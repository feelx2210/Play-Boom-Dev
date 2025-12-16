import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, BOMB_MODES, CHARACTERS } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas'); 

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    // FIX: Canvas höher machen, damit Köpfe nicht abgeschnitten werden
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    // FIX: Mittelpunkt nach unten verschieben (von 24 auf 40), 
    // damit nach oben mehr Platz für Hüte/Haare ist (Y-Koordinaten sind negativ).
    ctx.translate(24, 40);

    // --- HELPER ---
    const fillCircle = (x, y, r, col) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); };
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const gradient = (y1, y2, c1, c2) => { 
        const g = ctx.createLinearGradient(0, y1, 0, y2); 
        g.addColorStop(0, c1); g.addColorStop(1, c2); 
        return g; 
    };

    const id = charDef.id;

    // ============================================================
    // 1. ORIGINAL CHARACTERS (High Detail Restore)
    // ============================================================
    
    if (id === 'lucifer') {
        const skinGrad = gradient(-24, 10, '#ff5555', '#aa0000');
        ctx.fillStyle = '#1a0505'; 
        if (d==='side') { ctx.fillRect(-4, 14, 8, 10); } 
        else { ctx.fillRect(-8, 14, 6, 10); ctx.fillRect(2, 14, 6, 10); }
        ctx.fillStyle = skinGrad;
        ctx.beginPath(); ctx.ellipse(0, -5, 12, 18, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -20, 10, 0, Math.PI*2); ctx.fill();
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
        ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#cc0000'; ctx.fillRect(-10, -28, 20, 6);
        if(d==='back' || d==='side') { ctx.beginPath(); ctx.moveTo(8, -25); ctx.quadraticCurveTo(16, -20, 14, -10); ctx.lineTo(10, -22); ctx.fill(); } 
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
        if(d==='front') {
            rect(-7, -24, 5, 4, '#fff'); rect(2, -24, 5, 4, '#fff');
            rect(-5, -23, 2, 2, '#000'); rect(3, -23, 2, 2, '#000');
        }
    }
    else if (id === 'nun') {
        const robeGrad = gradient(-20, 20, '#333', '#000');
        ctx.fillStyle = robeGrad;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-14, 24); ctx.lineTo(14, 24); ctx.fill();
        ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -18, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -20, 9, Math.PI, 0); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 7, Math.PI, 0); ctx.stroke();
        if(d==='front') {
            rect(-3, -5, 6, 18, '#ffdd44'); rect(-8, 0, 16, 6, '#ffdd44');
            rect(-4, -19, 2, 2, '#000'); rect(2, -19, 2, 2, '#000');
        }
    }
    else if (id === 'yeti') {
        const furGrad = gradient(-20, 20, '#ddffff', '#88ccff');
        ctx.fillStyle = furGrad;
        fillCircle(0, 0, 16, furGrad);
        fillCircle(-10, -10, 8, furGrad); fillCircle(10, -10, 8, furGrad);
        fillCircle(-8, 12, 8, furGrad); fillCircle(8, 12, 8, furGrad);
        fillCircle(0, -20, 10, furGrad);
        if(d==='front') {
            ctx.fillStyle='#004488'; ctx.beginPath(); ctx.arc(0, -18, 6, 0, Math.PI*2); ctx.fill(); 
            rect(-4, -20, 3, 3, '#fff'); rect(1, -20, 3, 3, '#fff');
            rect(-3, -15, 2, 3, '#fff'); rect(1, -15, 2, 3, '#fff');
        }
    }

    // ============================================================
    // 2. NEW CELEBRITIES (Custom High-Detail)
    // ============================================================
    else {
        const drawBody = (skinColor, shirtGrad, pantsColor, shoeColor) => {
            // Beine
            ctx.fillStyle = pantsColor;
            if (d === 'side') ctx.fillRect(-5, 12, 10, 12);
            else { ctx.fillRect(-9, 12, 8, 12); ctx.fillRect(1, 12, 8, 12); }
            // Schuhe
            ctx.fillStyle = shoeColor;
            if (d === 'side') ctx.fillRect(-5, 22, 12, 4);
            else { ctx.fillRect(-9, 22, 8, 4); ctx.fillRect(1, 22, 8, 4); }
            // Torso
            ctx.fillStyle = shirtGrad;
            ctx.beginPath(); 
            ctx.moveTo(-11, -14); ctx.lineTo(11, -14); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); 
            ctx.fill();
            // Kopf
            ctx.fillStyle = skinColor;
            ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI*2); ctx.fill();
            // Arme
            if (d !== 'side') {
                ctx.fillStyle = shirtGrad; 
                ctx.beginPath(); ctx.ellipse(-14, -6, 4, 10, 0.2, 0, Math.PI*2); ctx.fill(); // L
                ctx.beginPath(); ctx.ellipse(14, -6, 4, 10, -0.2, 0, Math.PI*2); ctx.fill(); // R
                ctx.fillStyle = skinColor; 
                ctx.beginPath(); ctx.arc(-15, 4, 3, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15, 4, 3, 0, Math.PI*2); ctx.fill();
            }
        };

        const drawFace = (glasses=false, beard=false) => {
            if (d !== 'front') return;
            if (!glasses) {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -23, 2.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -23, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-4, -23, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -23, 1, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(-9, -25, 18, 5);
            }
            if (beard) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 10, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            const jersey = gradient(-14, 12, '#ff3333', '#cc0000');
            drawBody('#d2b48c', jersey, '#fff', '#fff');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, 5);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -8); ctx.fill();
            }
            ctx.fillStyle = '#221100'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill();
            ctx.fillRect(-10, -30, 20, 8); 
            drawFace();
        }
        else if (id === 'hitman') {
            const suit = gradient(-14, 12, '#333', '#000');
            drawBody('#ffe0bd', suit, '#111', '#000');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(6, -14); ctx.lineTo(0, -4); ctx.fill();
                ctx.fillStyle = '#cc0000'; ctx.fillRect(-2, -14, 4, 12);
            }
            drawFace();
            if (d === 'back') { ctx.fillStyle = '#000'; ctx.fillRect(-3, -20, 6, 2); }
        }
        else if (id === 'elon') {
            const shirt = gradient(-14, 12, '#222', '#111');
            drawBody('#f0d5be', shirt, '#111', '#333');
            if (d === 'front') {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.lineTo(0, -10); ctx.fill(); 
            }
            ctx.fillStyle = '#332211'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); 
            drawFace();
        }
        else if (id === 'mj') {
            const jacket = gradient(-14, 12, '#222', '#000');
            drawBody('#8d5524', jacket, '#111', '#000');
            ctx.fillStyle = '#fff'; ctx.fillRect(-9, 20, 8, 2); ctx.fillRect(1, 20, 8, 2);
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -8); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(13, 4, 6, 6);
            }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -28, 14, 3, 0, 0, Math.PI*2); ctx.fill(); 
            ctx.fillRect(-9, -36, 18, 8); 
            ctx.fillStyle = '#fff'; ctx.fillRect(-9, -32, 18, 2); 
            drawFace();
        }
        else if (id === 'dua') {
            const skin = '#f0d5be';
            drawBody(skin, '#111', '#111', '#111');
            ctx.fillStyle = skin; ctx.fillRect(-12, -2, 24, 6); 
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, 0); ctx.fill(); 
            if(d!=='back') { ctx.fillRect(-12, -24, 6, 22); ctx.fillRect(6, -24, 6, 22); }
            else ctx.fillRect(-11, -24, 22, 22);
            drawFace();
        }
        else if (id === 'lebron') {
            const jersey = gradient(-14, 12, '#fdb927', '#552583');
            drawBody('#5c3a1e', jersey, '#552583', '#fff');
            if (d === 'front') { ctx.fillStyle = '#552583'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 5); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); 
            ctx.fillRect(-10, -20, 20, 10); 
            ctx.fillStyle = '#fff'; ctx.fillRect(-10, -28, 20, 3);
            drawFace();
        }
        else if (id === 'pam') {
            const skin = '#dca386';
            const swim = gradient(-14, 12, '#ff4444', '#cc0000');
            drawBody(skin, swim, skin, skin); 
            ctx.fillStyle = swim; ctx.fillRect(-10, 10, 20, 6); 
            if(d==='front') { ctx.fillStyle=skin; ctx.fillRect(-4, -14, 8, 6); } 
            ctx.fillStyle = '#ffee88'; 
            ctx.beginPath(); ctx.arc(0, -26, 14, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -20, 8, 16, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10, -20, 8, 16, -0.2, 0, Math.PI*2); ctx.fill();
            drawFace();
        }
        else if (id === 'drizzy') {
            const hoodie = gradient(-14, 12, '#333', '#111');
            drawBody('#ac8b66', hoodie, '#222', '#fff');
            if (d === 'front') { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI*2); ctx.fill(); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); 
            drawFace(false, true); 
        }
        else if (id === '2pac') {
            drawBody('#7a4e32', '#fff', '#4466aa', '#fff'); 
            ctx.fillStyle = '#3366cc'; ctx.fillRect(-10, -28, 20, 6);
            if (d === 'front') { ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(16, -32); ctx.lineTo(16, -20); ctx.fill(); }
            drawFace(false, true);
        }
        else if (id === 'gaga') {
            const suit = gradient(-14, 12, '#0088ff', '#0044aa');
            drawBody('#ffe0e0', suit, suit, '#fff');
            ctx.fillStyle = '#eeeedd'; ctx.beginPath(); ctx.arc(0, -24, 12, Math.PI, 0); ctx.fill();
            if (d!=='back') { ctx.fillRect(-12, -24, 6, 22); ctx.fillRect(6, -24, 6, 22); }
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(-10, -38); ctx.lineTo(-10, -26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(10, -38); ctx.lineTo(10, -26); ctx.fill();
            drawFace(true); 
        }
        else if (id === '007') {
            const suit = gradient(-14, 12, '#555', '#333');
            drawBody('#f0d5be', suit, '#333', '#000');
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(0,-4); ctx.lineTo(6,-14); ctx.fill();
                ctx.fillStyle='#000'; ctx.fillRect(-3, -14, 6, 4); 
            }
            ctx.fillStyle='#ccaa88'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); 
            drawFace();
            if (d === 'side') { ctx.fillStyle='#333'; ctx.fillRect(8, 2, 8, 4); } 
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

// --- LEVEL PREVIEW ---
export function drawLevelPreview(ctx, w, h, levelDef) {
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = levelDef.wallHard; 
    const s = w/5;
    ctx.fillRect(0, 0, w, s); ctx.fillRect(0, h-s, w, s);
    ctx.fillRect(0, 0, s, h); ctx.fillRect(w-s, 0, s, h);
    ctx.fillStyle = levelDef.wallSoft;
    ctx.fillRect(w/2 - s/2, h/2 - s/2, s, s);
    
    if(levelDef.id === 'hell') {
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.beginPath(); ctx.arc(w/2, h/2, w/3, 0, Math.PI*2); ctx.fill();
    }
}

// --- MAIN DRAW ---
let cachedLevelCanvas = null;
let lastLevelId = null;

export function clearLevelCache() {
    cachedLevelCanvas = null;
    lastLevelId = null;
}

function bakeStaticLevel(levelDef) {
    const c = document.createElement('canvas');
    c.width = 15 * TILE_SIZE; c.height = 15 * TILE_SIZE;
    const ctx = c.getContext('2d');

    const bgGrad = ctx.createRadialGradient(c.width/2, c.height/2, 100, c.width/2, c.height/2, c.width);
    bgGrad.addColorStop(0, levelDef.bg); bgGrad.addColorStop(1, '#000000'); 
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for(let i=0; i<=15; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    if (state.grid) {
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const px = x * TILE_SIZE; const py = y * TILE_SIZE;
                const tile = state.grid[y][x];

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
                    }
                } 
                else if (levelDef.hasCentralFire && x===HELL_CENTER.x && y===HELL_CENTER.y) {
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

    for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];
            const item = state.items[y][x];

            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) {
                const bob = Math.sin(Date.now() * 0.005) * 3;
                const grad = ctx.createRadialGradient(px+24, py+24+bob, 5, px+24, py+24+bob, 20);
                grad.addColorStop(0, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px+24, py+24+bob, 20, 0, Math.PI*2); ctx.fill();

                ctx.font = '22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                let txt = '?'; let col = '#fff';
                if (item === ITEMS.BOMB_UP) { txt='💣'; col='#444'; }
                else if (item === ITEMS.RANGE_UP) { txt='🔥'; col='#f40'; }
                else if (item === ITEMS.SPEED_UP) { txt='⚡'; col='#08f'; }
                else if (item === ITEMS.SKULL) { txt='☠️'; col='#f0f'; }
                else if (item === ITEMS.NAPALM) { txt='☢️'; col='#f00'; }
                else if (item === ITEMS.ROLLING) { txt='🎳'; col='#fff'; }
                ctx.fillStyle = col; ctx.fillText(txt, px+24, py+24+bob);
            }

            if (tile === TYPES.WALL_SOFT) {
                const lvl = state.currentLevel;
                ctx.fillStyle = lvl.wallSoft;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = lvl.wallSoftLight; 
                if (lvl.id === 'hell') {
                    ctx.fillStyle = '#cc4400'; ctx.beginPath(); ctx.moveTo(px+10, py+10); ctx.lineTo(px+30, py+20); ctx.lineTo(px+15, py+35); ctx.fill();
                } else if (lvl.id === 'ice') {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px+4, py+4, 10, 10); ctx.fillRect(px+20, py+20, 20, 5);
                } else {
                    ctx.fillRect(px+4, py+10, 18, 8); ctx.fillRect(px+26, py+10, 18, 8);
                    ctx.fillRect(px+4, py+28, 18, 8); ctx.fillRect(px+26, py+28, 18, 8);
                }
            }
        }
    }

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

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const sprite = getCachedSprite(charDef, d, isCursed);
    // Draw with offset for new taller sprite format (48x64)
    ctx.drawImage(sprite, -24, -40);
    
    ctx.restore();
}