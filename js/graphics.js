import { TILE_SIZE, TYPES, ITEMS, BOOST_PADS, DIRECTION_PADS, OIL_PADS, HELL_CENTER, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
// Wir speichern die generierten Bilder zwischen, damit das Spiel flüssig läuft.
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const ctx = c.getContext('2d');
    
    // Zentrieren: 0,0 ist nun die Mitte des Charakters (24,24)
    ctx.translate(24, 24);

    // --- HELPER FÜR PIXEL-STYLE ---
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const circle = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); };

    // --- CHARAKTER ZEICHENLOGIK ---
    const id = charDef.id;

    // 1. ORIGINAL CHARACTERS (Wiederhergestellt)
    if (id === 'lucifer') {
        const cBase = '#e62020'; const cDark = '#aa0000'; const cLite = '#ff5555'; const cHoof = '#1a0505'; 
        if (d === 'side') { rect(2, 12, 6, 10, cDark); rect(2, 20, 6, 4, cHoof); rect(-6, 12, 6, 10, cBase); rect(-6, 20, 6, 4, cHoof); } 
        else { rect(-8, 12, 6, 10, cBase); rect(2, 12, 6, 10, cBase); rect(-8, 20, 6, 4, cHoof); rect(2, 20, 6, 4, cHoof); }
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 10); bodyGrad.addColorStop(0, '#ff4444'); bodyGrad.addColorStop(1, '#aa0000'); ctx.fillStyle = bodyGrad; ctx.fillRect(-8, -18, 16, 30);
        if (d === 'front') { rect(-1, -14, 2, 16, cDark); rect(-7, -8, 6, 2, cDark); rect(1, -8, 6, 2, cDark); rect(-9, -18, 4, 4, cLite); rect(5, -18, 4, 4, cLite); }
        const headGrad = ctx.createLinearGradient(0, -24, 0, -10); headGrad.addColorStop(0, '#ff5555'); headGrad.addColorStop(1, '#cc0000'); ctx.fillStyle = headGrad; ctx.fillRect(-9, -24, 18, 15); ctx.fillRect(-6, -10, 12, 4);
        
        // Hörner
        ctx.fillStyle = '#ddd';
        if (d === 'front' || d === 'back') { 
            ctx.beginPath(); ctx.moveTo(-7, -24); ctx.quadraticCurveTo(-18, -30, -14, -38); ctx.lineTo(-5, -26); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(7, -24); ctx.quadraticCurveTo(18, -30, 14, -38); ctx.lineTo(5, -26); ctx.fill(); 
        }
        if (d === 'front') { 
            rect(-8, -20, 5, 4, '#ffff00'); rect(3, -20, 5, 4, '#ffff00'); // Augen
            rect(-6, -19, 2, 2, '#000'); rect(5, -19, 2, 2, '#000'); 
            ctx.fillStyle = '#440000'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(0, -6, 6, -10); ctx.lineTo(0, -8); ctx.fill(); // Mund
        }
    } 
    else if (id === 'rambo') {
        const cGreen = '#226622'; const cSkin = '#ffccaa'; const cBandana = '#dd0000';
        if(d==='side') { rect(-5, 12, 8, 8, cGreen); rect(-5, 20, 9, 4, '#111'); } else { rect(-10, 12, 8, 8, cGreen); rect(2, 12, 8, 8, cGreen); rect(-10, 20, 8, 4, '#111'); rect(2, 20, 8, 4, '#111'); }
        rect(-12, -20, 24, 32, '#448844'); // Body Camo
        rect(-10, -16, 6, 4, '#113311'); rect(4, -8, 6, 4, '#113311'); 
        
        if (d === 'front') { 
            rect(-19, -18, 7, 18, cSkin); rect(12, -18, 7, 18, cSkin); // Arme
            rect(-10, -26, 20, 16, cSkin); // Kopf
            rect(-12, -26, 24, 6, cBandana); rect(10, -24, 6, 6, cBandana); // Bandana
            rect(-8, -18, 7, 7, '#fff'); rect(1, -18, 7, 7, '#fff'); // Augen Weiß
            rect(-5, -16, 2, 2, '#000'); rect(3, -16, 2, 2, '#000'); // Pupillen
            rect(-10, -14, 20, 4, 'rgba(0,0,0,0.1)'); // Bartschatten
        }
    }
    else if (id === 'nun') {
        rect(-7, 14, 6, 4, '#111'); rect(1, 14, 6, 4, '#111'); // Schuhe
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-16, 14); ctx.lineTo(16, 14); ctx.fill(); // Robe
        
        if (d === 'front') {
            rect(-3, -6, 6, 16, '#ffdd44'); rect(-8, -2, 16, 6, '#ffdd44'); // Goldkreuz
            circle(0, -16, 7, '#ffccaa'); // Gesicht
            rect(-4, -17, 2, 2, '#000'); rect(2, -17, 2, 2, '#000'); // Augen
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0, -19, 10, Math.PI, 0); ctx.fill(); // Haube
        }
    }
    else if (id === 'yeti') {
        const fur = '#00ccff'; const furDark = '#0088bb';
        rect(-16, -24, 32, 36, fur); // Body
        rect(-10, 12, 8, 10, furDark); rect(2, 12, 8, 10, furDark); // Beine
        if (d === 'front') {
            rect(-22, -16, 8, 26, fur); rect(14, -16, 8, 26, fur); // Arme
            rect(-12, -20, 24, 14, '#005599'); // Gesichtshintergrund
            rect(-8, -17, 6, 6, '#fff'); rect(2, -17, 6, 6, '#fff'); // Augen
            rect(-6, -16, 2, 2, '#000'); rect(4, -16, 2, 2, '#000');
            rect(-6, -8, 3, 4, '#fff'); rect(3, -8, 3, 4, '#fff'); // Zähne
        }
    }

    // 2. NEUE PROMI-CHARAKTERE (Detaillierte Pixel-Karikaturen)
    else {
        // Basis-Setup für Menschen
        const drawHuman = (skin, pants, shirt, shoes) => {
            // Beine
            if (d === 'side') {
                rect(-4, 12, 8, 12, pants); rect(-4, 20, 10, 4, shoes);
            } else {
                rect(-9, 12, 8, 12, pants); rect(1, 12, 8, 12, pants);
                rect(-9, 20, 8, 4, shoes); rect(1, 20, 8, 4, shoes);
            }
            // Torso
            rect(-11, -14, 22, 26, shirt);
            // Kopf
            rect(-9, -26, 18, 14, skin);
            // Arme (Front/Back)
            if (d !== 'side') {
                rect(-17, -12, 6, 18, shirt); rect(-17, 2, 6, 4, skin); // Links
                rect(11, -12, 6, 18, shirt); rect(11, 2, 6, 4, skin);   // Rechts
            }
        };

        const drawFace = (eyes = true, beard = false, glasses = false) => {
            if (d !== 'front') return;
            if (eyes && !glasses) {
                rect(-5, -20, 3, 3, '#fff'); rect(2, -20, 3, 3, '#fff'); // Augapfel
                rect(-4, -20, 2, 2, '#000'); rect(3, -20, 2, 2, '#000'); // Pupille
            }
            if (glasses) {
                rect(-7, -21, 14, 4, '#111'); // Brille
            }
            if (beard) {
                rect(-9, -16, 18, 4, 'rgba(0,0,0,0.2)'); // Bartschatten
                rect(-3, -14, 6, 2, '#000'); // Goatee
            }
        };

        // --- CRISTIANO ---
        if (id === 'cristiano') {
            const skin = '#d2b48c'; 
            drawHuman(skin, '#fff', '#da291c', '#fff'); // Weiß Hose, Rot Trikot (ManUtd/Portugal)
            if (d === 'front') {
                rect(-2, -8, 4, 10, '#fff'); // "7"
                rect(-2, -8, 6, 2, '#fff');
            }
            drawFace(true, false);
            // Haare: Gestylt
            rect(-10, -30, 20, 6, '#221100'); rect(4, -30, 2, 2, '#221100');
            rect(-2, -18, 4, 2, '#fff'); // Zähne/Grinsen
        }

        // --- HITMAN ---
        else if (id === 'hitman') {
            drawHuman('#ffe0bd', '#111', '#111', '#000'); // Anzug schwarz
            // Weißes Hemd V
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(6,-14); ctx.lineTo(0,-4); ctx.fill();
                rect(-2, -14, 4, 12, '#cc0000'); // Rote Krawatte
            }
            drawFace(true);
            // Glatze -> Keine Haare
            if (d === 'back') {
                rect(-2, -20, 4, 2, '#000'); // Barcode
            }
            // Pistolen
            rect(-19, 0, 4, 8, '#999'); rect(15, 0, 4, 8, '#999');
        }

        // --- ELON ---
        else if (id === 'elon') {
            drawHuman('#f0d5be', '#222', '#111', '#333'); // Alles schwarz/dunkel
            if (d === 'front') {
                // Cybertruck Logo (Dreieck)
                ctx.fillStyle='#888'; ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.lineTo(0,-6); ctx.fill();
            }
            drawFace(true);
            // Haare: Braun, leicht wellig
            rect(-10, -28, 20, 6, '#443322'); 
        }

        // --- MJ ---
        else if (id === 'mj') {
            const skin = '#8d5524';
            drawHuman(skin, '#111', '#111', '#000'); // Anzug
            // Weiße Socken
            rect(-9, 18, 8, 2, '#fff'); rect(1, 18, 8, 2, '#fff');
            // Weißes Shirt V
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-4,-14); ctx.lineTo(4,-14); ctx.lineTo(0,-8); ctx.fill();
                // Handschuh (Rechts)
                rect(11, 2, 6, 6, '#fff');
            }
            drawFace(true);
            // Hut
            rect(-12, -28, 24, 4, '#111'); // Krempe
            rect(-9, -34, 18, 8, '#111');  // Top
            rect(-9, -30, 18, 2, '#fff');  // Weißes Band
            // Locke
            rect(4, -24, 2, 6, '#000');
        }

        // --- DUA ---
        else if (id === 'dua') {
            const skin = '#f0d5be';
            // Haut zeigen (Bauchfrei)
            drawHuman(skin, '#111', '#111', '#111'); // Shorts/Top
            rect(-11, -2, 22, 6, skin); // Bauch
            drawFace(true);
            // Lange schwarze Haare
            rect(-10, -30, 20, 8, '#000');
            rect(-12, -24, 4, 20, '#000'); rect(8, -24, 4, 20, '#000');
        }

        // --- LEBRON ---
        else if (id === 'lebron') {
            const skin = '#5c3a1e';
            drawHuman(skin, '#fdb927', '#552583', '#fff'); // Lakers Gelb/Lila
            // Trikot Details
            if (d === 'front') {
                rect(-5, -8, 10, 8, '#fdb927'); // "23" Block
            }
            drawFace(true, true); // Mit Bart
            // Haare & Headband
            rect(-9, -28, 18, 4, '#111');
            rect(-10, -26, 20, 2, '#fff'); // Headband
        }

        // --- PAM ---
        else if (id === 'pam') {
            const skin = '#dca386'; // Gebräunt
            // Badeanzug Rot
            rect(-9, 12, 8, 12, skin); rect(1, 12, 8, 12, skin); // Beine nackt
            rect(-11, -14, 22, 26, '#ff2222'); // Anzug
            // Dekolleté
            if (d === 'front') {
                rect(-4, -14, 8, 4, skin);
            }
            drawFace(true);
            // Riesige blonde Haare
            rect(-12, -32, 24, 10, '#ffeeaa');
            rect(-14, -24, 6, 20, '#ffeeaa'); rect(8, -24, 6, 20, '#ffeeaa');
        }

        // --- DRIZZY ---
        else if (id === 'drizzy') {
            const skin = '#ac8b66';
            drawHuman(skin, '#333', '#000', '#fff'); // OVO Style
            // Eule Logo
            if (d === 'front') {
                circle(0, -4, 4, '#ffd700'); 
            }
            drawFace(true, true); // Bart
            // Haare kurz
            rect(-9, -28, 18, 4, '#111');
        }

        // --- 2PAC ---
        else if (id === '2pac') {
            const skin = '#7a4e32';
            drawHuman(skin, '#4466aa', '#fff', '#ddd'); // Jeans, Unterhemd weiß
            // Unterhemd Ausschnitt
            if (d === 'front') {
                rect(-4, -14, 8, 4, skin);
            }
            drawFace(true, true);
            // Bandana (Blau)
            rect(-10, -28, 20, 6, '#3366cc');
            rect(6, -26, 4, 4, '#3366cc'); // Knoten
        }

        // --- GAGA ---
        else if (id === 'gaga') {
            const skin = '#ffe0e0';
            drawHuman(skin, '#0099ff', '#0099ff', '#fff'); // Pokerface Blau
            // Ausschnitt / Design
            if (d === 'front') {
                rect(-2, -14, 4, 14, '#111'); // Reißverschluss
            }
            drawFace(false, false, true); // Brille!
            // Haare: Blond mit Schleife
            rect(-10, -32, 20, 10, '#eeeedd');
            rect(-4, -36, 8, 4, '#eeeedd'); // Bow
        }

        // --- 007 ---
        else if (id === '007') {
            drawHuman('#f0d5be', '#333', '#333', '#000'); // Grauer Anzug
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(6,-14); ctx.lineTo(0,-4); ctx.fill();
                rect(-2, -14, 4, 4, '#000'); // Fliege
            }
            drawFace(true);
            // Haare: Blond/Braun (Craig)
            rect(-10, -28, 20, 5, '#ccaa88');
            // Waffe
            if (d === 'side') rect(6, 4, 6, 2, '#333');
        }
    }

    // Curse Effect Overlay (Blinken)
    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(-24, -24, 48, 48); 
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

// Erstellt das statische Level-Bild einmalig (Performance!)
function bakeStaticLevel(levelDef) {
    const c = document.createElement('canvas');
    c.width = 15 * TILE_SIZE; // GRID_W
    c.height = 15 * TILE_SIZE; // GRID_H
    const ctx = c.getContext('2d');

    // 1. Hintergrund
    ctx.fillStyle = levelDef.bg;
    ctx.fillRect(0, 0, c.width, c.height);

    // 2. Grid Lines
    ctx.strokeStyle = levelDef.grid; ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=15; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); }
    for(let i=0; i<=15; i++) { ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    // 3. Statische Elemente (Hard Walls, Boden)
    // Wir iterieren über das Grid (state.grid muss existieren)
    if (state.grid) {
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const px = x * TILE_SIZE; const py = y * TILE_SIZE;
                const tile = state.grid[y][x];

                // HARD WALLS (Statisch)
                if (tile === TYPES.WALL_HARD) {
                    ctx.fillStyle = levelDef.wallHard;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    // 3D Effekt
                    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px, py+TILE_SIZE-4, TILE_SIZE, 4);
                    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(px, py, TILE_SIZE, 4);
                    
                    // Level Details
                    if (levelDef.id === 'hell') {
                        ctx.fillStyle = '#111'; ctx.fillRect(px+6, py+6, 4, 4); ctx.fillRect(px+38, py+38, 4, 4);
                    }
                } 
                // SPEZIAL PADS (Statisch)
                else if ((levelDef.id === 'hell' || levelDef.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                    ctx.fillStyle = (levelDef.id==='ice') ? '#004488' : '#440000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = levelDef.glow; ctx.lineWidth=2; ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                }
                // DIRECTION PADS
                else if (DIRECTION_PADS.some(p => p.x === x && p.y === y)) {
                    const dirPad = DIRECTION_PADS.find(p => p.x === x && p.y === y);
                    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#aaa'; 
                    // Pfeil zeichnen (vereinfacht)
                    const cx = px+TILE_SIZE/2, cy=py+TILE_SIZE/2;
                    ctx.beginPath(); ctx.arc(cx + dirPad.dir.x*10, cy + dirPad.dir.y*10, 4, 0, Math.PI*2); ctx.fill();
                }
                // HELL CENTER
                else if (levelDef.hasCentralFire && x===HELL_CENTER.x && y===HELL_CENTER.y) {
                    ctx.fillStyle = '#1a0505'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
    return c;
}

// --- MAIN DRAW FUNCTION ---
export function draw(ctx, canvas) {
    if (!state.currentLevel) return;

    // 1. Hintergrund (Cached)
    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // 2. Dynamische Objekte (Soft Walls, Items, Bomben)
    drawDynamicObjects(ctx);

    // 3. Spieler
    if (state.players) {
        // Sortieren nach Y für korrekte Überlappung
        const sorted = [...state.players].sort((a,b) => a.y - b.y);
        sorted.forEach(p => p.draw());
    }

    // 4. Partikel
    drawAllParticles(ctx);
}

function drawDynamicObjects(ctx) {
    if(!state.grid) return;
    const level = state.currentLevel;

    for(let y=0; y<15; y++) {
        for(let x=0; x<15; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];
            const item = state.items[y][x];

            // Items
            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) {
                // Item Hintergrund
                const floatY = Math.sin(Date.now()*0.005)*2;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.arc(px+24, py+24+floatY, 16, 0, Math.PI*2); ctx.fill();
                
                // Icon
                ctx.font = '20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                let txt = '?'; let col = '#fff';
                if (item === ITEMS.BOMB_UP) { txt='💣'; col='#444'; }
                else if (item === ITEMS.RANGE_UP) { txt='🔥'; col='#f40'; }
                else if (item === ITEMS.SPEED_UP) { txt='⚡'; col='#08f'; }
                else if (item === ITEMS.SKULL) { txt='☠️'; col='#f0f'; }
                else if (item === ITEMS.NAPALM) { txt='☢️'; col='#f00'; }
                else if (item === ITEMS.ROLLING) { txt='🎳'; col='#fff'; }
                ctx.fillStyle = col; ctx.fillText(txt, px+24, py+24+floatY);
            }

            // Soft Walls
            if (tile === TYPES.WALL_SOFT) {
                ctx.fillStyle = level.wallSoft;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = level.wallSoftLight;
                ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                // Detail
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(px+22, py+4, 4, TILE_SIZE-8);
                ctx.fillRect(px+4, py+22, TILE_SIZE-8, 4);
            }
        }
    }

    // Bomben
    state.bombs.forEach(b => {
        const bx = b.px + 24; const by = b.py + 24;
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        
        // Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(bx, by+10, 14, 5, 0, 0, Math.PI*2); ctx.fill();

        // Körper
        let col = '#333';
        if (b.napalm) col = '#a00';
        if (b.isRolling) col = '#557';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(bx, by, 18*pulse, 0, Math.PI*2); ctx.fill();

        // Glanz
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(bx-5, by-5, 6, 0, Math.PI*2); ctx.fill();

        // Icon/Lunte
        if (b.napalm) { ctx.fillStyle='#fc0'; ctx.font='12px sans-serif'; ctx.fillText('☢', bx, by+4); }
        
        const wx = bx + Math.sin(Date.now()*0.02)*3;
        ctx.strokeStyle = '#a85'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(bx, by-15); ctx.lineTo(wx, by-22); ctx.stroke();
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(wx, by-22, 2, 0, Math.PI*2); ctx.fill();
    });

    // Hell Center Effekt (Active)
    if (state.currentLevel.hasCentralFire && state.hellFireActive) {
        const cx = HELL_CENTER.x * TILE_SIZE + 24; const cy = HELL_CENTER.y * TILE_SIZE + 24;
        const size = (state.hellFirePhase === 'WARNING') ? 40 : 60;
        const col = (state.hellFirePhase === 'WARNING') ? 'rgba(255,0,0,0.3)' : 'rgba(255,100,0,0.8)';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cx, cy, size * (0.8 + Math.random()*0.2), 0, Math.PI*2); ctx.fill();
    }
}

// Wrapper für Player.js
export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, lastDir = {x:0, y:1}) {
    let d = 'front';
    if (lastDir.y < 0) d = 'back';
    else if (lastDir.x !== 0) d = 'side';
    
    // Side Flipping
    ctx.save();
    ctx.translate(x, y);
    if (lastDir.x < 0) ctx.scale(-1, 1); // Spiegeln für links

    const sprite = getCachedSprite(charDef, d, isCursed);
    // Sprite ist 48x48, wir zeichnen es zentriert bei 0,0 (durch translate)
    ctx.drawImage(sprite, -24, -24);
    
    ctx.restore();
}

// Level Preview für Menü
export function drawLevelPreview(ctx, w, h, levelDef) {
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = levelDef.wallHard; 
    const s = w/5; // Grobe Blöcke
    ctx.fillRect(0, 0, w, s); ctx.fillRect(0, h-s, w, s);
    ctx.fillRect(0, 0, s, h); ctx.fillRect(w-s, 0, s, h);
    ctx.fillStyle = levelDef.wallSoft;
    ctx.fillRect(w/2 - s/2, h/2 - s/2, s, s);
}