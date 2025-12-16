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
    // Canvas Höhe 64px für Details wie Hüte/Haare
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    // Einheitlicher Startpunkt: Füße bei Y=40, Körper wächst nach oben
    ctx.translate(24, 40);

    // --- VEKTOR HELPER ---
    const fillCircle = (x, y, r, col) => { 
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); 
    };
    const rect = (x, y, w, h, col) => { 
        ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); 
    };
    const gradient = (y1, y2, c1, c2) => { 
        const g = ctx.createLinearGradient(0, y1, 0, y2); 
        g.addColorStop(0, c1); g.addColorStop(1, c2); 
        return g; 
    };

    const id = charDef.id;

    // ============================================================
    // 1. ORIGINAL CHARACTERS (UNVERÄNDERTER VEKTOR-STIL)
    // ============================================================
    
    if (id === 'lucifer') {
        const skinGrad = gradient(-24, 10, '#ff5555', '#aa0000');
        ctx.fillStyle = '#1a0505'; // Hufe
        if (d==='side') { ctx.fillRect(-4, 14, 8, 10); } 
        else { ctx.fillRect(-8, 14, 6, 10); ctx.fillRect(2, 14, 6, 10); }
        
        ctx.fillStyle = skinGrad;
        ctx.beginPath(); ctx.ellipse(0, -5, 12, 18, 0, 0, Math.PI*2); ctx.fill(); // Körper Rund
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
        // Vektor-Muskelkörper
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
    // 2. NEUE PROMIS (JETZT AUCH IM Vektor-Stil!)
    // ============================================================
    else {
        // Standard Human Body Helper (Vektor-Basis)
        const drawHumanBody = (skinCol, topGrad, pantsCol, shoeCol) => {
            // Beine (Rechtecke)
            ctx.fillStyle = pantsCol;
            if (d === 'side') rect(-5, 12, 10, 12, pantsCol);
            else { rect(-9, 12, 8, 12, pantsCol); rect(1, 12, 8, 12, pantsCol); }
            // Schuhe (Rechtecke)
            ctx.fillStyle = shoeCol;
            if (d === 'side') rect(-5, 22, 12, 4, shoeCol);
            else { rect(-9, 22, 8, 4, shoeCol); rect(1, 22, 8, 4, shoeCol); }
            
            // Torso (Trapez-Form für Vektor-Look, wie Rambo)
            ctx.fillStyle = topGrad;
            ctx.beginPath(); 
            ctx.moveTo(-12, -18); ctx.lineTo(12, -18); 
            ctx.lineTo(10, 12); ctx.lineTo(-10, 12); 
            ctx.fill();
            
            // Kopf (Kreis)
            fillCircle(0, -22, 10, skinCol);
            
            // Arme (Abgerundet)
            if (d !== 'side') {
                ctx.fillStyle = topGrad; 
                ctx.beginPath(); ctx.ellipse(-15, -6, 5, 12, 0.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(15, -6, 5, 12, -0.2, 0, Math.PI*2); ctx.fill();
                fillCircle(-16, 6, 4, skinCol); // Hände
                fillCircle(16, 6, 4, skinCol);
            }
        };

        // Standard Gesicht Helper
        const drawHumanFace = (glasses=false, beard=false) => {
            if (d !== 'front') return;
            if (!glasses) {
                // Vektor Augen
                fillCircle(-4, -22, 3, '#fff'); fillCircle(4, -22, 3, '#fff');
                fillCircle(-4, -22, 1.5, '#000'); fillCircle(4, -22, 1.5, '#000');
            } else {
                // Vektor Brille
                ctx.fillStyle = '#111'; rect(-9, -25, 18, 6, '#111'); 
            }
            if (beard) {
                // Vektor Bart (Halbkreis)
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 10, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        // --- DEFINITIONEN DER NEUEN CHARAKTERE ---
        const skinLight = '#ffccaa'; const skinDark = '#8d5524';
        const suitGrad = gradient(-18, 12, '#444', '#111');

        if (id === 'cristiano') {
            drawHumanBody(skinLight, gradient(-18, 12, '#f00', '#a00'), '#fff', '#fff');
            if (d === 'front') { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, 5); }
            ctx.fillStyle = '#210'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); rect(-10,-32,20,8,'#210'); // Vektor Haare
            drawHumanFace();
        }
        else if (id === 'hitman') {
            drawHumanBody(skinLight, suitGrad, '#111', '#000');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(6, -18); ctx.lineTo(0, -6); ctx.fill(); // Hemd
                rect(-2, -16, 4, 14, '#c00'); // Krawatte
            }
            drawHumanFace();
            if (d === 'back') rect(-3, -20, 6, 2, '#000'); // Barcode
        }
        else if (id === 'elon') {
            drawHumanBody(skinLight, gradient(-18, 12, '#333', '#222'), '#111', '#333');
            if (d === 'front') {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(0, -14); ctx.fill(); // Logo
            }
            ctx.fillStyle = '#321'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); // Haare
            drawHumanFace();
        }
        else if (id === 'mj') {
            drawHumanBody(skinDark, gradient(-18, 12, '#222', '#000'), '#111', '#000');
            rect(-9, 20, 8, 2, '#fff'); rect(1, 20, 8, 2, '#fff'); // Socken
            if (d === 'front') rect(13, 4, 6, 6, '#fff'); // Handschuh
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -30, 14, 3, 0, 0, Math.PI*2); ctx.fill(); // Hut Krempe
            rect(-9, -38, 18, 8, '#111'); rect(-9, -34, 18, 2, '#fff'); // Hut Top & Band
            drawHumanFace();
        }
        else if (id === 'dua') {
            drawHumanBody(skinLight, '#111', '#111', '#111');
            rect(-10, -8, 20, 6, skinLight); // Bauchfrei
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, 0); ctx.fill(); // Haare Oben
            if(d!=='back') { rect(-12, -24, 6, 22, '#000'); rect(6, -24, 6, 22, '#000'); } // Haare Seiten
            else rect(-11, -24, 22, 22, '#000');
            drawHumanFace();
        }
        else if (id === 'lebron') {
            const jersey = gradient(-18, 12, '#fdb927', '#552583');
            drawHumanBody(skinDark, jersey, '#fff', '#fff');
            if (d === 'front') { ctx.fillStyle = '#552583'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 5); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); // Hairline
            rect(-10, -28, 20, 3, '#fff'); // Stirnband
            drawHumanFace(false, true); // Bart
        }
        else if (id === 'pam') {
            const swim = gradient(-20, 12, '#ff4444', '#cc0000');
            drawHumanBody(skinLight, swim, skinLight, skinLight); // Beine sind Haut
            rect(-9, 10, 18, 6, swim); // Hüfte
            if(d==='front') rect(-4, -14, 8, 6, skinLight); // Ausschnitt
            ctx.fillStyle = '#ffee88'; // Haare (Volumen mit Kreisen)
            ctx.beginPath(); ctx.arc(0, -28, 14, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -22, 8, 16, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10, -22, 8, 16, -0.2, 0, Math.PI*2); ctx.fill();
            drawHumanFace();
        }
        else if (id === 'drizzy') {
            drawHumanBody(skinDark, gradient(-18, 12, '#333', '#111'), '#222', '#fff');
            if (d === 'front') fillCircle(0, -6, 4, '#ffd700'); // Eule
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); // Haare
            drawHumanFace(false, true); // Bart
        }
        else if (id === '2pac') {
            drawHumanBody(skinDark, '#fff', '#46a', '#fff'); 
            ctx.fillStyle = '#3366cc'; rect(-10, -28, 20, 6, '#3366cc'); // Bandana
            if (d === 'front') { ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(16, -32); ctx.lineTo(16, -20); ctx.fill(); } // Knoten
            drawHumanFace(false, true);
        }
        else if (id === 'gaga') {
            const suit = gradient(-18, 12, '#0088ff', '#0044aa');
            drawHumanBody(skinLight, suit, suit, '#fff');
            ctx.fillStyle = '#eeeedd'; ctx.beginPath(); ctx.arc(0, -26, 12, Math.PI, 0); ctx.fill(); // Haare
            if (d!=='back') { rect(-12, -26, 6, 22, '#eeeedd'); rect(6, -26, 6, 22, '#eeeedd'); }
            // Schleife (Vektor)
            ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-10, -40); ctx.lineTo(-10, -28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(10, -40); ctx.lineTo(10, -28); ctx.fill();
            drawHumanFace(true); // Brille
        }
        else if (id === '007') {
            drawHumanBody(skinLight, suitGrad, '#333', '#000');
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(0,-8); ctx.lineTo(6,-18); ctx.fill();
                rect(-3, -16, 6, 4, '#000'); // Fliege
            }
            ctx.fillStyle='#ccaa88'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); 
            drawHumanFace();
        }
    }

    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(-24, -44, 48, 64); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

// --- LEVEL CACHING (Unverändert) ---
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

            // Hard Walls
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
            // Boden-Objekte
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

    // Vektor-Schatten (Ellipse)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    
    // Offset für 48x64 Canvas (Mitte bei 24, 40)
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

// --- OPTIMIERTE DRAW LOOP (Unverändert) ---
export function draw(ctx, canvas) {
    if (!state.currentLevel) return;

    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // Hell Center Fire Pit
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

    // Soft Walls & Items
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

    state.players.slice().sort((a,b) => a.y - b.y).forEach(p => p.draw());
}