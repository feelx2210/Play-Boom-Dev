import { TILE_SIZE, TYPES, ITEMS, BOOST_PADS, DIRECTION_PADS, OIL_PADS, HELL_CENTER, BOMB_MODES, CHARACTERS } from './constants.js';
import { state } from './state.js';

// --- MAIN DRAW FUNCTION ---
// Diese Funktion fehlte und wird von game.js aufgerufen
export function draw(ctx, canvas) {
    // 1. Hintergrund & Level
    drawLevel(ctx);
    
    // 2. Objekte (Wände, Items, Bomben)
    drawObjects(ctx);
    
    // 3. Spieler
    // Die Spieler zeichnen sich selbst (via player.js -> p.draw()), 
    // was wiederum drawCharacterSprite hier aufruft.
    if (state.players) {
        state.players.forEach(p => p.draw());
    }
    
    // 4. Partikel & Effekte
    drawParticles(ctx);
}

// Dummy für Cache-Clear (wird von game.js aufgerufen)
export function clearLevelCache() {
    // Da wir prozedural zeichnen, brauchen wir keinen Cache-Clear.
    // Die Funktion muss aber existieren, damit game.js nicht abstürzt.
}

// --- CHARACTER DRAWING ---

// Wrapper für player.js Aufrufe
// player.js ruft auf: drawCharacterSprite(ctx, x, y, charDef, isCursed, lastDir)
export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, lastDir = {x:0, y:1}) {
    // Richtung bestimmen
    let dir = 'down';
    if (lastDir.x > 0) dir = 'right';
    else if (lastDir.x < 0) dir = 'left';
    else if (lastDir.y < 0) dir = 'up';

    // Animation: Wir nutzen die globale Zeit für den Schritt-Zyklus
    // Da player.js den "bob" (Hüpfen) im Y-Wert schon drin hat, wirkt es lebendig.
    // Wir variieren zusätzlich die Beine basierend auf der Zeit.
    const frame = Math.floor(Date.now() / 150) % 2; 

    // Prozedurales Zeichnen aufrufen
    drawProceduralCharacter(ctx, x, y, charDef, dir, frame, false);
}

// Die eigentliche Zeichenlogik für die Promis
function drawProceduralCharacter(ctx, x, y, charDef, dir, frame, isDead) {
    ctx.save();
    ctx.translate(x, y); // x,y ist die Mitte des Sprites
    
    if (isDead) ctx.globalAlpha = 0.5;

    // Fallback falls charDef undefiniert (Startbildschirm Fehlervermeidung)
    const id = charDef ? charDef.id : 'rambo';
    const bodyColor = charDef ? charDef.color : '#44aa44';

    // --- BASIS KÖRPER ---
    
    // Beine / Hose
    ctx.fillStyle = (id === 'pam' || id === 'dua') ? '#ffccaa' : '#222'; // Haut bei Pam/Dua, sonst dunkel
    if (id === 'cristiano' || id === 'lebron') ctx.fillStyle = '#fff'; // Weiße Stutzen/Schuhe
    if (id === '2pac' || id === 'elon') ctx.fillStyle = '#334455'; // Jeans
    if (id === 'mj') ctx.fillStyle = '#111'; // Schwarze Anzughose
    
    // Bein-Animation
    if (frame === 0) {
        ctx.fillRect(-8, 6, 6, 10); // Bein L
        ctx.fillRect(2, 6, 6, 10);  // Bein R
    } else {
        ctx.fillRect(-8, 5, 6, 9);
        ctx.fillRect(2, 7, 6, 9);
    }

    // Oberkörper
    ctx.fillStyle = bodyColor;
    
    // Spezielle Torsos
    if (id === 'pam' || id === 'dua' || id === 'gaga') {
        ctx.fillRect(-10, -14, 20, 20); // Schmaler / Weiblich
    } else {
        ctx.fillRect(-12, -14, 24, 20); // Breit / Männlich
    }

    // --- OBERKÖRPER DETAILS ---
    
    // Anzug (Hitman, 007, MJ) - Weißes Hemd Dreieck
    if (id === 'hitman' || id === '007' || id === 'mj') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -6); ctx.fill();
        // Krawatte
        if (id === 'hitman') { ctx.fillStyle = '#ff0000'; ctx.fillRect(-1, -14, 2, 8); }
        if (id === '007') { ctx.fillStyle = '#333'; ctx.fillRect(-1, -14, 2, 8); }
    }

    // Trikots (CR7, Lebron)
    if (dir === 'down') { // Nur von vorne sichtbar
        if (id === 'cristiano') {
            ctx.fillStyle = '#fff'; // Nr 7 Andeutung
            ctx.fillRect(-2, -10, 4, 1); ctx.fillRect(1, -10, 1, 6); 
        }
        if (id === 'lebron') {
            ctx.fillStyle = '#fdb927'; // Lakers Gold Nummer
            ctx.fillRect(-4, -10, 8, 8);
        }
    }
    
    // 2Pac Unterhemd
    if (id === '2pac') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-8, -14, 16, 18);
    }

    // --- KOPF ---
    let skinColor = '#ffccaa'; // Standard Haut
    if (id === 'lucifer') skinColor = '#ff0000';
    if (id === 'yeti') skinColor = '#eeeeff';
    if (id === 'mj' || id === 'lebron' || id === '2pac' || id === 'drizzy') skinColor = '#8d5524'; // Dunkel

    ctx.fillStyle = skinColor;
    ctx.fillRect(-9, -26, 18, 12); // Kopf

    // --- HAARE & KOPFBEDECKUNG ---

    if (id === 'mj') {
        // Fedora Hut
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -28, 24, 4); // Krempe
        ctx.fillRect(-9, -32, 18, 6);  // Krone
        ctx.fillStyle = '#fff'; // Socke/Handschuh Detail? Nein, Haarsträhne
        ctx.fillStyle = '#000'; ctx.fillRect(4, -24, 2, 6);
    }
    else if (id === '2pac') {
        // Bandana (Blau)
        ctx.fillStyle = '#3366cc';
        ctx.fillRect(-10, -28, 20, 6); 
        ctx.fillRect(6, -26, 4, 4); // Knoten
    }
    else if (id === 'dua' || id === 'pam' || id === 'gaga') {
        // Lange Haare
        ctx.fillStyle = (id === 'pam' || id === 'gaga') ? '#ffeeaa' : '#111';
        ctx.fillRect(-10, -30, 20, 8); // Top
        ctx.fillRect(-11, -26, 4, 18); // Links
        ctx.fillRect(7, -26, 4, 18);   // Rechts
    }
    else if (id === 'lebron') {
        ctx.fillStyle = '#111'; 
        ctx.fillRect(-9, -26, 18, 3); // Hairline
        ctx.fillRect(-9, -18, 18, 4); // Bart
    }
    else if (id === 'drizzy') {
        ctx.fillStyle = '#111';
        ctx.fillRect(-9, -28, 18, 4); // Kurz
        ctx.fillRect(-9, -18, 18, 4); // Bart
    }
    else if (id === 'rambo') {
        ctx.fillStyle = '#111'; ctx.fillRect(-10, -29, 20, 10);
        ctx.fillStyle = '#ff0000'; ctx.fillRect(-10, -26, 20, 3); // Bandana Rot
    }
    else if (id === 'nun') {
        ctx.fillStyle = '#111'; ctx.fillRect(-10, -30, 20, 12);
        ctx.fillStyle = '#fff'; ctx.fillRect(-9, -28, 18, 4);
    }
    else if (id === 'hitman') {
        // Glatze -> Nichts zeichnen
    }
    else {
        // Standard Frisur (Elon, CR7, 007, etc)
        ctx.fillStyle = (id === '007') ? '#ccaa88' : '#221100';
        ctx.fillRect(-9, -29, 18, 5);
    }

    // --- GESICHT ---
    ctx.fillStyle = '#000';
    let eyeOff = 0;
    if (dir === 'left') eyeOff = -3;
    if (dir === 'right') eyeOff = 3;

    // Brille bei Gaga
    if (id === 'gaga') {
        ctx.fillRect(-6 + eyeOff, -22, 12, 4);
    } else {
        // Augen
        ctx.fillRect(-5 + eyeOff, -22, 2, 2);
        ctx.fillRect(3 + eyeOff, -22, 2, 2);
    }

    ctx.restore();
}

// --- LEVEL PREVIEW (Für Menü) ---
export function drawLevelPreview(ctx, w, h, level) {
    ctx.fillStyle = level.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = level.wallHard; 
    const s = w/15;
    ctx.fillRect(0, 0, w, s); ctx.fillRect(0, h-s, w, s);
    ctx.fillRect(0, 0, s, h); ctx.fillRect(w-s, 0, s, h);
    
    ctx.fillStyle = level.wallSoft;
    ctx.fillRect(w/2 - s, h/2 - s, s*2, s*2);
    
    if(level.id === 'hell') {
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.beginPath(); ctx.arc(w/2, h/2, w/3, 0, Math.PI*2); ctx.fill();
    }
}

// --- LEVEL DRAWING (Hintergrund) ---
export function drawLevel(ctx) {
    const level = state.currentLevel;
    if(!level) return;

    ctx.fillStyle = level.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Grid
    ctx.strokeStyle = level.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=15; i++) {
        const p = i * TILE_SIZE;
        ctx.moveTo(p, 0); ctx.lineTo(p, 15*TILE_SIZE);
        ctx.moveTo(0, p); ctx.lineTo(15*TILE_SIZE, p);
    }
    ctx.stroke();

    // Spezial-Pads (Hell/Ice/Jungle)
    if (level.id === 'hell' || level.id === 'ice') {
        ctx.fillStyle = (level.id === 'ice') ? '#00ffff' : level.glow;
        BOOST_PADS.forEach(p => {
            ctx.globalAlpha = 0.4;
            ctx.fillRect(p.x*TILE_SIZE, p.y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = (level.id === 'ice') ? '#00ffff' : level.glow; 
            ctx.lineWidth = 3;
            ctx.strokeRect(p.x*TILE_SIZE+4, p.y*TILE_SIZE+4, TILE_SIZE-8, TILE_SIZE-8);
        });
    }

    if (level.id === 'jungle') {
        DIRECTION_PADS.forEach(p => {
            ctx.fillStyle = 'rgba(50, 200, 50, 0.4)';
            ctx.fillRect(p.x*TILE_SIZE, p.y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#44aa44';
            ctx.beginPath();
            const cx = (p.x+0.5)*TILE_SIZE, cy = (p.y+0.5)*TILE_SIZE;
            ctx.moveTo(cx - p.dir.x*10, cy - p.dir.y*10);
            ctx.lineTo(cx + p.dir.x*10, cy + p.dir.y*10);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(cx + p.dir.x*10, cy + p.dir.y*10, 3, 0, Math.PI*2); ctx.fill();
        });
    }

    if (level.id === 'stone') {
        ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
        OIL_PADS.forEach(p => {
            ctx.fillRect(p.x*TILE_SIZE, p.y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            for(let i=0; i<3; i++) {
                 ctx.beginPath();
                 ctx.arc(p.x*TILE_SIZE + Math.random()*TILE_SIZE, p.y*TILE_SIZE + Math.random()*TILE_SIZE, 2+Math.random()*3, 0, Math.PI*2);
                 ctx.fill();
            }
            ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
        });
    }
}

// --- OBJECTS (Walls, Items, Bombs) ---
export function drawObjects(ctx) {
    if(!state.grid) return;
    const level = state.currentLevel;

    for(let y=0; y<15; y++) {
        for(let x=0; x<15; x++) {
            const tile = state.grid[y][x];
            const item = state.items[y][x];
            const X = x*TILE_SIZE, Y = y*TILE_SIZE;

            // River / Bridge
            if (level.hasRiver && tile === TYPES.WATER) {
                ctx.fillStyle = '#3366cc'; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
            }
            else if (level.hasRiver && tile === TYPES.BRIDGE) {
                 ctx.fillStyle = '#664422'; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                 ctx.fillStyle = '#442211';
                 for(let i=0; i<4; i++) ctx.fillRect(X+i*12, Y, 2, TILE_SIZE);
            }
            // Walls
            else if (tile === TYPES.WALL_HARD) {
                ctx.fillStyle = level.wallHard;
                ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X, Y+TILE_SIZE-4, TILE_SIZE, 4);
                ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, Y, TILE_SIZE, 4); ctx.fillRect(X, Y, 4, TILE_SIZE);
            } 
            else if (tile === TYPES.WALL_SOFT) {
                ctx.fillStyle = level.wallSoft;
                ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = level.wallSoftLight;
                ctx.fillRect(X+4, Y+4, TILE_SIZE-8, TILE_SIZE-8);
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(X, Y+12, TILE_SIZE, 2); ctx.fillRect(X, Y+36, TILE_SIZE, 2); ctx.fillRect(X+24, Y+12, 2, 24);
            }

            // Items
            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) {
                let color = '#fff', text = '?';
                if (item === ITEMS.BOMB_UP) { color='#444444'; text='💣'; }
                else if (item === ITEMS.RANGE_UP) { color='#ff4400'; text='🔥'; }
                else if (item === ITEMS.SPEED_UP) { color='#0088ff'; text='⚡'; }
                else if (item === ITEMS.SKULL) { color='#ff00ff'; text='☠️'; }
                else if (item === ITEMS.NAPALM) { color='#ff0000'; text='☢️'; }
                else if (item === ITEMS.ROLLING) { color='#888888'; text='🎳'; }
                
                // Schwebe-Effekt
                const floatY = Math.sin(Date.now() * 0.005) * 3;
                ctx.shadowColor = color; ctx.shadowBlur = 10;
                ctx.fillStyle = 'rgba(20,20,20,0.8)';
                ctx.beginPath(); ctx.arc(X+TILE_SIZE/2, Y+TILE_SIZE/2 + floatY, TILE_SIZE/2.5, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.fillStyle = color; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(text, X+TILE_SIZE/2, Y+TILE_SIZE/2 + floatY + 2);
            }
        }
    }

    // Bombs
    state.bombs.forEach(b => {
        // px/py nutzen für flüssige Bewegung bei Rolling Bombs
        const bx = b.px + TILE_SIZE/2; 
        const by = b.py + TILE_SIZE/2;
        
        const timePercent = b.timer / 200;
        const pulseSpeed = timePercent < 0.3 ? 0.8 : 0.2;
        const pulse = 1 + Math.sin(Date.now() * 0.01 * (1/pulseSpeed)) * 0.1;
        
        let color = '#222';
        if (b.napalm) color = '#aa0000';
        if (b.isRolling) color = '#555577';

        // Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(bx, by+10, 16, 6, 0, 0, Math.PI*2); ctx.fill();

        // Bombe
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(bx, by, (TILE_SIZE/2.5)*pulse, 0, Math.PI*2); ctx.fill();
        
        // Glanz
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(bx-6, by-6, 6*pulse, 0, Math.PI*2); ctx.fill();

        // Icons
        if (b.napalm) {
            ctx.fillStyle = '#ffcc00'; ctx.font='12px sans-serif'; ctx.textAlign='center'; 
            ctx.fillText('☢', bx, by+4);
        } else if (b.isRolling) {
             ctx.strokeStyle = '#fff'; ctx.lineWidth=2;
             ctx.beginPath(); ctx.moveTo(bx-6, by); ctx.lineTo(bx+6, by); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(bx, by-6); ctx.lineTo(bx, by+6); ctx.stroke();
        }
        
        // Lunte
        const wickX = bx + Math.sin(Date.now()*0.02)*2;
        ctx.strokeStyle = '#aa8855'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx, by-15); ctx.lineTo(wickX, by-22); ctx.stroke();
        
        // Funke
        ctx.fillStyle = `hsl(${Math.random()*60}, 100%, 50%)`;
        ctx.beginPath(); ctx.arc(wickX, by-22, 3, 0, Math.PI*2); ctx.fill();
    });
}

// --- PARTICLES ---
export function drawParticles(ctx) {
    state.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        
        if (p.isFire) {
             const size = TILE_SIZE * (0.6 + (p.life/p.maxLife)*0.4);
             let color = p.isNapalm ? `rgb(255, ${Math.floor(Math.random()*100)}, 0)` : `rgba(255, ${Math.floor((p.life/p.maxLife)*255)}, 0, ${p.life/p.maxLife})`;
             
             ctx.fillStyle = color;
             ctx.fillRect(p.gx*TILE_SIZE + (TILE_SIZE-size)/2, p.gy*TILE_SIZE + (TILE_SIZE-size)/2, size, size);
             
             // Core
             ctx.fillStyle = '#ffffaa';
             ctx.fillRect(p.gx*TILE_SIZE + TILE_SIZE/2 - 5, p.gy*TILE_SIZE + TILE_SIZE/2 - 5, 10, 10);
        } else {
             // Debris / Smoke
             ctx.fillStyle = p.color || '#fff';
             ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI*2); ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
    
    // Central Fire Effect
    if (state.currentLevel.hasCentralFire) {
        const center = { x: (HELL_CENTER.x+0.5)*TILE_SIZE, y: (HELL_CENTER.y+0.5)*TILE_SIZE };
        if (state.hellFirePhase === 'WARNING') {
             ctx.globalAlpha = 0.3 + Math.sin(Date.now()*0.02)*0.2;
             ctx.fillStyle = '#ff0000';
             ctx.beginPath(); ctx.arc(center.x, center.y, TILE_SIZE*2, 0, Math.PI*2); ctx.fill();
        } else if (state.hellFirePhase === 'ACTIVE') {
             const size = TILE_SIZE*3 * (0.9 + Math.random()*0.1);
             const grad = ctx.createRadialGradient(center.x, center.y, size*0.2, center.x, center.y, size);
             grad.addColorStop(0, '#ffff00');
             grad.addColorStop(0.5, '#ff4400');
             grad.addColorStop(1, 'rgba(255,0,0,0)');
             ctx.fillStyle = grad;
             ctx.beginPath(); ctx.arc(center.x, center.y, size, 0, Math.PI*2); ctx.fill();
        }
    }
}