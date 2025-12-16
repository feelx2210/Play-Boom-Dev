import { TILE_SIZE, TYPES, ITEMS, BOOST_PADS, DIRECTION_PADS, OIL_PADS, HELL_CENTER, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.translate(24, 24); // Zentrum

    // --- HELPER ---
    const fillCircle = (x, y, r, col) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); };
    const gradient = (y1, y2, c1, c2) => { const g = ctx.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

    const id = charDef.id;

    // ==========================================
    // 1. ORIGINAL CHARACTERS (High Detail Restore)
    // ==========================================
    
    if (id === 'lucifer') {
        const skinGrad = gradient(-24, 10, '#ff5555', '#aa0000');
        // Beine (Hufe)
        ctx.fillStyle = '#1a0505'; 
        if (d==='side') { ctx.fillRect(-4, 14, 8, 10); } 
        else { ctx.fillRect(-8, 14, 6, 10); ctx.fillRect(2, 14, 6, 10); }
        // Körper
        ctx.fillStyle = skinGrad;
        ctx.beginPath(); ctx.ellipse(0, -5, 12, 18, 0, 0, Math.PI*2); ctx.fill();
        // Kopf
        ctx.beginPath(); ctx.arc(0, -20, 10, 0, Math.PI*2); ctx.fill();
        // Hörner
        const hornGrad = gradient(-35, -20, '#ffffff', '#bbbbbb');
        ctx.fillStyle = hornGrad;
        if(d!=='back') {
            ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(-14, -32, -10, -40); ctx.lineTo(-4, -28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(6, -26); ctx.quadraticCurveTo(14, -32, 10, -40); ctx.lineTo(4, -28); ctx.fill();
        }
        // Gesicht
        if(d==='front') {
            ctx.fillStyle='#ffff00'; ctx.fillRect(-7, -22, 5, 4); ctx.fillRect(2, -22, 5, 4); // Augen
            ctx.fillStyle='#000'; ctx.fillRect(-5, -21, 2, 2); ctx.fillRect(3, -21, 2, 2);
            ctx.fillStyle='#330000'; ctx.beginPath(); ctx.arc(0, -14, 4, 0, Math.PI, false); ctx.fill(); // Mund
        }
    }
    else if (id === 'rambo') {
        const skin = '#ffccaa'; const skinShadow = '#eebba0';
        // Hose (Camo)
        ctx.fillStyle = '#226622'; 
        if(d==='side') { ctx.fillRect(-5, 10, 10, 14); } else { ctx.fillRect(-9, 10, 8, 14); ctx.fillRect(1, 10, 8, 14); }
        // Muskel-Körper (Nackt)
        const bodyGrad = gradient(-15, 10, skin, skinShadow);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-14, 0, -8, 10); ctx.lineTo(8, 10); ctx.quadraticCurveTo(14, 0, 12, -18); ctx.fill();
        // Bandolier
        ctx.strokeStyle = '#442200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(10, 10); ctx.stroke();
        // Kopf
        ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI*2); ctx.fill();
        // Bandana
        ctx.fillStyle = '#cc0000'; ctx.fillRect(-10, -28, 20, 6);
        if(d==='back' || d==='side') { ctx.beginPath(); ctx.moveTo(8, -25); ctx.quadraticCurveTo(16, -20, 14, -10); ctx.lineTo(10, -22); ctx.fill(); }
        // Haare
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
        // Gesicht
        if(d==='front') {
            ctx.fillStyle='#fff'; ctx.fillRect(-7, -24, 5, 4); ctx.fillRect(2, -24, 5, 4);
            ctx.fillStyle='#000'; ctx.fillRect(-5, -23, 2, 2); ctx.fillRect(3, -23, 2, 2);
        }
    }
    else if (id === 'nun') {
        // Robe
        const robeGrad = gradient(-20, 20, '#333', '#000');
        ctx.fillStyle = robeGrad;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-14, 24); ctx.lineTo(14, 24); ctx.fill();
        // Kopf
        ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -18, 7, 0, Math.PI*2); ctx.fill();
        // Haube
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -20, 9, Math.PI, 0); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 7, Math.PI, 0); ctx.stroke();
        // Kreuz
        if(d==='front') {
            ctx.fillStyle='#ffcc00'; ctx.fillRect(-3, -5, 6, 18); ctx.fillRect(-8, 0, 16, 6);
            // Augen
            ctx.fillStyle='#000'; ctx.fillRect(-4, -19, 2, 2); ctx.fillRect(2, -19, 2, 2);
        }
    }
    else if (id === 'yeti') {
        const furGrad = gradient(-20, 20, '#ddffff', '#88ccff');
        ctx.fillStyle = furGrad;
        // Zotteliger Körper (Kreise)
        fillCircle(0, 0, 16, furGrad);
        fillCircle(-10, -10, 8, furGrad); fillCircle(10, -10, 8, furGrad); // Schultern
        fillCircle(-8, 12, 8, furGrad); fillCircle(8, 12, 8, furGrad); // Beine
        // Kopf
        fillCircle(0, -20, 10, furGrad);
        // Gesicht Blau
        if(d==='front') {
            ctx.fillStyle='#004488'; ctx.beginPath(); ctx.arc(0, -18, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#fff'; ctx.fillRect(-4, -20, 3, 3); ctx.fillRect(1, -20, 3, 3);
            ctx.fillStyle='#fff'; ctx.fillRect(-3, -15, 2, 3); ctx.fillRect(1, -15, 2, 3); // Zähne
        }
    }

    // ==========================================
    // 2. NEW CELEBRITIES (High Detail Style)
    // ==========================================
    else {
        const drawBody = (skin, topCol, botCol, shoesCol) => {
            // Beine
            ctx.fillStyle = botCol;
            if(d==='side') { ctx.fillRect(-5, 10, 10, 14); } 
            else { ctx.fillRect(-9, 10, 8, 14); ctx.fillRect(1, 10, 8, 14); }
            // Schuhe
            ctx.fillStyle = shoesCol;
            if(d==='side') { ctx.fillRect(-5, 20, 12, 4); } 
            else { ctx.fillRect(-9, 20, 8, 4); ctx.fillRect(1, 20, 8, 4); }
            
            // Torso
            ctx.fillStyle = topCol;
            ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(11, -14); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); ctx.fill();
            
            // Arme (Haut)
            if(d!=='side') {
                ctx.fillStyle = skin;
                ctx.beginPath(); ctx.arc(-14, -8, 4, 0, Math.PI*2); ctx.fill(); ctx.fillRect(-16, -8, 4, 12);
                ctx.beginPath(); ctx.arc(14, -8, 4, 0, Math.PI*2); ctx.fill(); ctx.fillRect(12, -8, 4, 12);
            }
            
            // Kopf
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI*2); ctx.fill();
        };

        const addFace = (glasses=false, beard=false) => {
            if(d!=='front') return;
            // Augen
            if(!glasses) {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(-4, -23, 3, 2, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(4, -23, 3, 2, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(-4, -23, 1, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(4, -23, 1, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle='#111'; ctx.fillRect(-8, -25, 16, 5); // Sonnenbrille
            }
            // Bart
            if(beard) {
                ctx.fillStyle='rgba(0,0,0,0.15)';
                ctx.beginPath(); ctx.arc(0, -22, 9, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            drawBody('#d2b48c', '#da291c', '#fff', '#fff'); // ManUtd Rot, Weiße Hose
            if(d==='front') { ctx.fillStyle='#fff'; ctx.font='bold 10px sans-serif'; ctx.fillText('7', -3, 5); } // Nr 7
            // Haare
            ctx.fillStyle='#221100'; ctx.beginPath(); ctx.moveTo(-10, -26); ctx.quadraticCurveTo(0, -34, 10, -26); ctx.lineTo(10, -20); ctx.lineTo(-10, -20); ctx.fill();
            addFace();
            if(d==='front') { ctx.fillStyle='#fff'; ctx.fillRect(-3, -18, 6, 2); } // Lächeln
        }
        else if (id === 'hitman') {
            const suitGrad = gradient(-20, 10, '#333', '#000');
            drawBody('#ffe0bd', suitGrad, '#111', '#000');
            if(d==='front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(0,-4); ctx.lineTo(6,-14); ctx.fill(); // Hemd
                ctx.fillStyle='#cc0000'; ctx.fillRect(-2, -14, 4, 12); // Krawatte
            }
            addFace(); // Glatze (Keine Haare)
            if(d==='back') { ctx.fillStyle='#000'; ctx.fillRect(-3, -20, 6, 2); } // Barcode
        }
        else if (id === 'elon') {
            drawBody('#f0d5be', '#111', '#111', '#333'); // Black on Black
            if(d==='front') {
                ctx.fillStyle='#888'; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(6, -5); ctx.lineTo(0, 5); ctx.fill(); // Logo
            }
            // Haare
            ctx.fillStyle='#332211'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill();
            addFace();
        }
        else if (id === 'mj') {
            drawBody('#8d5524', '#222', '#111', '#000'); // Dunkler Anzug
            // Weiße Socken
            ctx.fillStyle='#fff'; ctx.fillRect(-9, 18, 8, 2); ctx.fillRect(1, 18, 8, 2);
            // Hut
            ctx.fillStyle='#111';
            ctx.beginPath(); ctx.ellipse(0, -28, 12, 3, 0, 0, Math.PI*2); ctx.fill(); // Krempe
            ctx.fillRect(-8, -34, 16, 6); // Krone
            ctx.fillStyle='#fff'; ctx.fillRect(-8, -30, 16, 1); // Band
            // Locke
            ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(5, -22, 2, 0, Math.PI*2); ctx.fill();
            addFace();
        }
        else if (id === 'dua') {
            // Hautfarben Bauch
            drawBody('#f0d5be', '#111', '#111', '#111');
            ctx.fillStyle='#f0d5be'; ctx.fillRect(-10, -2, 20, 6); // Bauchfrei
            // Haare (Lang Schwarz)
            ctx.fillStyle='#000';
            ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill();
            if(d!=='back') { ctx.fillRect(-11, -24, 4, 20); ctx.fillRect(7, -24, 4, 20); }
            else { ctx.fillRect(-10, -24, 20, 20); }
            addFace();
        }
        else if (id === 'lebron') {
            drawBody('#5c3a1e', '#fdb927', '#552583', '#fff'); // Lakers Gelb/Lila
            if(d==='front') { ctx.fillStyle='#552583'; ctx.font='bold 10px sans-serif'; ctx.fillText('23', -6, 5); }
            // Bart & Haare
            ctx.fillStyle='#111';
            ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI*2); ctx.stroke(); // Hairline
            ctx.fillRect(-9, -20, 18, 8); // Bart um Kinn
            addFace(false, true);
        }
        else if (id === 'pam') {
            const skin = '#dca386';
            // Roter Badeanzug
            drawBody(skin, '#ff2222', skin, skin); // Beine Haut
            ctx.fillStyle='#ff2222'; ctx.fillRect(-10, 8, 20, 6); // Hüfte
            // Große Blonde Haare
            ctx.fillStyle='#ffee88';
            ctx.beginPath(); ctx.arc(0, -26, 12, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-8, -20, 6, 12, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(8, -20, 6, 12, -0.2, 0, Math.PI*2); ctx.fill();
            addFace();
        }
        else if (id === 'drizzy') {
            drawBody('#ac8b66', '#222', '#000', '#fff'); // OVO
            if(d==='front') { ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI*2); ctx.fill(); } // Eule
            // Haare & Bart
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
            addFace(false, true);
        }
        else if (id === '2pac') {
            drawBody('#7a4e32', '#fff', '#4466aa', '#fff'); // Weißes Tanktop, Jeans
            // Bandana
            ctx.fillStyle='#3366cc';
            ctx.fillRect(-10, -28, 20, 6);
            if(d==='front' || d==='right') { ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(14, -30); ctx.lineTo(14, -22); ctx.fill(); }
            addFace(false, true);
        }
        else if (id === 'gaga') {
            drawBody('#ffe0e0', '#0088ff', '#0088ff', '#fff'); // Blau
            // Haare Blond + Schleife
            ctx.fillStyle='#eeeedd';
            ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, 0); ctx.fill();
            if(d!=='back') { ctx.fillRect(-11, -24, 6, 20); ctx.fillRect(5, -24, 6, 20); }
            // Schleife
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(-8, -36); ctx.lineTo(-8, -28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(8, -36); ctx.lineTo(8, -28); ctx.fill();
            addFace(true); // Brille
        }
        else if (id === '007') {
            drawBody('#f0d5be', '#444', '#444', '#000'); // Grauer Anzug
            if(d==='front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(0,-4); ctx.lineTo(6,-14); ctx.fill();
                ctx.fillStyle='#000'; ctx.fillRect(-2, -14, 4, 4); // Fliege
            }
            ctx.fillStyle='#ccaa88'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
            addFace();
            if(d==='side') { ctx.fillStyle='#333'; ctx.fillRect(6, 0, 8, 4); } // Waffe
        }
    }

    // Curse Effect
    if (isCursed) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(-24, -24, 48, 48);
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

    // 1. Hintergrund (Textur)
    const bgGrad = ctx.createRadialGradient(c.width/2, c.height/2, 100, c.width/2, c.height/2, c.width);
    bgGrad.addColorStop(0, levelDef.bg);
    bgGrad.addColorStop(1, '#000000'); // Vignette
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, c.width, c.height);

    // Grid Overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for(let i=0; i<=15; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    // 2. Statische Elemente
    if (state.grid) {
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const px = x * TILE_SIZE; const py = y * TILE_SIZE;
                const tile = state.grid[y][x];

                if (tile === TYPES.WALL_HARD) {
                    ctx.fillStyle = levelDef.wallHard;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    // 3D Bevel
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px, py+44, 48, 4); ctx.fillRect(px+44, py, 4, 48);
                    
                    // Struktur Details
                    if (levelDef.id === 'hell') {
                        ctx.fillStyle = '#220000'; ctx.fillRect(px+10, py+10, 28, 28); // Innenblock
                    } else if (levelDef.id === 'stone') {
                        ctx.strokeStyle = '#555'; ctx.strokeRect(px+8, py+8, 32, 32);
                    }
                } 
                else if (levelDef.hasCentralFire && x===HELL_CENTER.x && y===HELL_CENTER.y) {
                    ctx.fillStyle = '#1a0000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
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

    // Dynamische Objekte
    for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];
            const item = state.items[y][x];

            // Items
            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) {
                const bob = Math.sin(Date.now() * 0.005) * 3;
                
                // Glow
                const grad = ctx.createRadialGradient(px+24, py+24+bob, 5, px+24, py+24+bob, 20);
                grad.addColorStop(0, 'rgba(255,255,255,0.8)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px+24, py+24+bob, 20, 0, Math.PI*2); ctx.fill();

                ctx.font = '22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                let txt = '?'; 
                if (item === ITEMS.BOMB_UP) txt='💣';
                else if (item === ITEMS.RANGE_UP) txt='🔥';
                else if (item === ITEMS.SPEED_UP) txt='⚡';
                else if (item === ITEMS.SKULL) txt='☠️';
                else if (item === ITEMS.NAPALM) txt='☢️';
                else if (item === ITEMS.ROLLING) txt='🎳';
                ctx.fillText(txt, px+24, py+24+bob);
            }

            // Soft Walls (Destructible)
            if (tile === TYPES.WALL_SOFT) {
                const lvl = state.currentLevel;
                ctx.fillStyle = lvl.wallSoft;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                
                // Muster
                ctx.fillStyle = lvl.wallSoftLight; // Hellere Fugen/Muster
                if (lvl.id === 'hell') {
                    ctx.fillRect(px+4, py+4, 18, 18); ctx.fillRect(px+26, py+26, 18, 18);
                } else if (lvl.id === 'ice') {
                    ctx.beginPath(); ctx.moveTo(px, py+48); ctx.lineTo(px+48, py); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.stroke();
                } else {
                    ctx.fillRect(px+6, py+6, 36, 36); // Block
                    ctx.fillStyle = lvl.wallSoft; ctx.fillRect(px+12, py+12, 24, 24); // Inner Hole
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

        // Glanz
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