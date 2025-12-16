import { TILE_SIZE, TYPES, LEVELS, HELL_CENTER, CHARACTERS, BOMB_MODES, ITEMS, BOOST_PADS, DIRECTION_PADS, OIL_PADS } from './constants.js'; // Imports angepasst
import { state } from './state.js';

// --- CHARACTER DRAWING ---
export function drawCharacter(ctx, p) {
    const x = p.x + TILE_SIZE/2;
    const y = p.y + TILE_SIZE/2;
    // Fallback falls charDef fehlt
    const charDef = p.charDef || CHARACTERS[0];
    
    // Bestimme die Blickrichtung
    let dirKey = 'down';
    if (p.lastDir.x > 0) dirKey = 'right';
    else if (p.lastDir.x < 0) dirKey = 'left';
    else if (p.lastDir.y < 0) dirKey = 'up';
    else if (p.lastDir.y > 0) dirKey = 'down';

    // Animations-Frame (0, 1, 2)
    const frameIndex = Math.floor(p.step) % 3;

    drawProceduralCharacter(ctx, x, y, charDef, dirKey, frameIndex, p.isDead);
}

// Draw preview for menu
export function drawCharacterSprite(ctx, x, y, charDef, isSelected = false, lastDir = {x:0, y:1}) {
    // Für das Menü simulieren wir einen Frame
    drawProceduralCharacter(ctx, x, y, charDef, 'down', 0, false);
}


function drawProceduralCharacter(ctx, x, y, charDef, dir, frame, isDead) {
    ctx.save();
    ctx.translate(x, y);
    if (isDead) ctx.globalAlpha = 0.5;

    const id = charDef.id;
    const bodyColor = charDef.color;
    const accentColor = charDef.accent;

    // --- BASIS KÖRPER FORM ---
    // Beine Animation
    ctx.fillStyle = (id === 'pam' || id === 'dua') ? '#ffccaa' : '#222'; // Hautfarbe Beine bei Pam/Dua, sonst Hose/Schuhe dunkel
    
    if (id === 'cristiano' || id === 'lebron') ctx.fillStyle = '#fff'; // Weiße Socken/Schuhe
    if (id === '2pac' || id === 'elon') ctx.fillStyle = '#334455'; // Jeans
    if (id === 'rambo') ctx.fillStyle = '#334433'; 
    if (id === 'yeti') ctx.fillStyle = '#ddddff'; 
    if (id === 'mj') ctx.fillStyle = '#111'; // Schwarze Hose

    // Beine zeichnen
    if (frame % 2 === 0) {
        ctx.fillRect(-8, 6, 6, 10); // Links
        ctx.fillRect(2, 6, 6, 10);  // Rechts
    } else {
        ctx.fillRect(-8, 4, 6, 10);
        ctx.fillRect(2, 8, 6, 8);
    }

    // Oberkörper (Shirt/Anzug)
    ctx.fillStyle = bodyColor;
    
    // Spezielle Körperformen
    if (id === 'pam' || id === 'dua' || id === 'gaga') {
        // Weiblicher Torso (etwas schmaler)
        ctx.fillRect(-10, -14, 20, 20);
    } else {
        // Standard Torso
        ctx.fillRect(-12, -14, 24, 20);
    }

    // --- DETAILS JE NACH CHARAKTER ---

    if (id === 'hitman' || id === '007' || id === 'mj') {
        // Anzug Details (Weißes Hemd Dreieck)
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -6); ctx.fill();
        // Krawatte
        if (id === 'hitman') { ctx.fillStyle = '#ff0000'; ctx.fillRect(-1, -14, 2, 8); } // Rote Krawatte
        if (id === '007') { ctx.fillStyle = '#333'; ctx.fillRect(-1, -14, 2, 8); } // Dunkle Krawatte
    }

    if (id === 'cristiano') {
        // Nr 7 (ganz grob)
        if (dir === 'down') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -10, 4, 1); ctx.fillRect(1, -10, 1, 6); // Eine 7
        }
    }
    
    if (id === 'lebron') {
        // Trikot Nummer / Lakers Lila
        if (dir === 'down') {
            ctx.fillStyle = '#fdb927'; // Gold
            ctx.fillRect(-4, -10, 8, 8); // Block
        }
    }

    if (id === '2pac') {
        // Weißes Unterhemd (Tanktop)
        ctx.fillStyle = '#fff';
        ctx.fillRect(-8, -14, 16, 18);
    }

    // --- KOPF ---
    let skinColor = '#ffccaa'; // Standard
    if (id === 'lucifer') skinColor = '#ff0000';
    if (id === 'yeti') skinColor = '#eeeeff';
    if (id === 'mj' || id === 'lebron' || id === '2pac' || id === 'drizzy') skinColor = '#8d5524'; // Dunkle Haut

    ctx.fillStyle = skinColor;
    ctx.fillRect(-9, -26, 18, 12); // Kopf Basis

    // --- HAARE / KOPFBEDECKUNG ---

    // Frisuren Logik
    if (id === 'hitman' || id === 'lebron' || id === '2pac') {
        // Glatze oder sehr kurz -> Nichts oder wenig
        if (id === 'lebron') {
            ctx.fillStyle = '#111'; // Bart / Kurze Haare
            ctx.fillRect(-9, -26, 18, 3); // Hairline
            ctx.fillRect(-9, -18, 18, 4); // Bart
        }
    } 
    else if (id === 'mj') {
        // Hut (Fedora)
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -28, 24, 4); // Krempe
        ctx.fillRect(-9, -32, 18, 6);  // Top
        // Haarsträhne
        ctx.fillStyle = '#000';
        ctx.fillRect(4, -24, 2, 6);
    }
    else if (id === '2pac') {
        // Bandana
        ctx.fillStyle = '#3366cc'; // Blaues Bandana
        ctx.fillRect(-10, -28, 20, 6); // Stirnband
        ctx.fillRect(6, -26, 4, 4); // Knoten rechts
    }
    else if (id === 'dua' || id === 'pam' || id === 'gaga') {
        // Lange Haare
        ctx.fillStyle = (id === 'pam' || id === 'gaga') ? '#ffeeaa' : '#111'; // Blond oder Schwarz
        ctx.fillRect(-10, -30, 20, 8); // Oben
        ctx.fillRect(-11, -26, 4, 18); // Seite L
        ctx.fillRect(7, -26, 4, 18);  // Seite R
    }
    else if (id === 'drizzy') {
        // Kurze Haare + Bart
        ctx.fillStyle = '#111';
        ctx.fillRect(-9, -28, 18, 4);
        ctx.fillRect(-9, -18, 18, 4); // Bart
    }
    else if (id === 'elon') {
        // Elon Frisur
        ctx.fillStyle = '#332211';
        ctx.fillRect(-9, -28, 18, 5);
        if (dir === 'right') ctx.fillRect(4, -28, 4, 4);
    }
    else if (id === 'cristiano') {
        // Gestylt
        ctx.fillStyle = '#221100';
        ctx.fillRect(-9, -29, 18, 5);
    }
    else if (id === 'rambo') {
        // Stirnband rot + Schwarze Haare
        ctx.fillStyle = '#111';
        ctx.fillRect(-10, -29, 20, 10); // Haare wild
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-10, -26, 20, 3); // Band
    }
    else if (id === 'nun') {
        // Nonnenhaube
        ctx.fillStyle = '#111';
        ctx.fillRect(-10, -30, 20, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9, -28, 18, 4); // Weißer Rand
    }
    else {
        // Standard Haare (007, etc)
        ctx.fillStyle = (id === '007') ? '#ccaa88' : '#332200'; // Blond für Bond
        ctx.fillRect(-9, -29, 18, 5);
    }

    // --- GESICHT (AUGEN) ---
    ctx.fillStyle = '#000';
    let eyeOff = 0;
    if (dir === 'left') eyeOff = -3;
    if (dir === 'right') eyeOff = 3;
    
    // Sonnenbrille?
    if (id === '2pac' || id === 'hitman' || id === '007') {
        // Nein, aber vielleicht coole Augen.
        // Hitman Barcode hinten? Zu klein.
    }
    
    if (id === 'gaga') {
        // Pokerface Brille?
        ctx.fillStyle = '#111';
        ctx.fillRect(-6 + eyeOff, -22, 12, 4);
    } else {
        // Normale Augen
        ctx.fillRect(-5 + eyeOff, -22, 2, 2);
        ctx.fillRect(3 + eyeOff, -22, 2, 2);
    }

    ctx.restore();
}

// --- LEVEL DRAWING ---
export function drawLevel(ctx) {
    const level = state.currentLevel;
    if(!level) return;

    ctx.fillStyle = level.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Grid Lines
    ctx.strokeStyle = level.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=15; i++) { // GRID_W/H Hardcoded or imported
        ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, 15*TILE_SIZE);
    }
    for(let i=0; i<=15; i++) {
        ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(15*TILE_SIZE, i*TILE_SIZE);
    }
    ctx.stroke();

    // Pads
    if (level.id === 'hell' || level.id === 'ice') {
        ctx.fillStyle = level.glow;
        if (level.id === 'ice') ctx.fillStyle = '#00ffff';
        BOOST_PADS.forEach(p => {
            ctx.globalAlpha = 0.4;
            ctx.fillRect(p.x*TILE_SIZE, p.y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = level.glow; ctx.lineWidth = 3;
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
            // Pfeilspitze vereinfacht
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

// --- OBJECTS & PARTICLES (Items, Walls, Bombs) ---
export function drawObjects(ctx) {
    if(!state.grid) return;
    
    for(let y=0; y<15; y++) {
        for(let x=0; x<15; x++) {
            const tile = state.grid[y][x];
            const item = state.items[y][x];
            const X = x*TILE_SIZE, Y = y*TILE_SIZE;
            const level = state.currentLevel;

            // Water / Bridge
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
                // 3D Effekt Light
                ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, Y, TILE_SIZE, 4); ctx.fillRect(X, Y, 4, TILE_SIZE);
            } 
            else if (tile === TYPES.WALL_SOFT) {
                ctx.fillStyle = level.wallSoft;
                ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = level.wallSoftLight;
                ctx.fillRect(X+4, Y+4, TILE_SIZE-8, TILE_SIZE-8);
                // Ziegel-Muster
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(X, Y+12, TILE_SIZE, 2);
                ctx.fillRect(X, Y+36, TILE_SIZE, 2);
                ctx.fillRect(X+24, Y+12, 2, 24);
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
                
                // Item Background Bubble
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
        const bx = b.px + TILE_SIZE/2, by = b.py + TILE_SIZE/2; // Nutzen px/py für Smoothness bei Rolling
        
        // Pulsieren kurz vor Explosion
        const timePercent = b.timer / 200; // ca 200 ticks
        const pulseSpeed = timePercent < 0.3 ? 0.8 : 0.2;
        const pulse = 1 + Math.sin(Date.now() * 0.01 * (1/pulseSpeed)) * 0.1;
        
        let color = '#222';
        if (b.napalm) color = '#aa0000';
        if (b.isRolling) color = '#555577';

        // Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(bx, by+10, 16, 6, 0, 0, Math.PI*2); ctx.fill();

        // Bomb Body
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(bx, by, (TILE_SIZE/2.5)*pulse, 0, Math.PI*2); ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(bx-6, by-6, 6*pulse, 0, Math.PI*2); ctx.fill();

        // Zünder / Icons
        if (b.napalm) {
            ctx.fillStyle = '#ffcc00'; ctx.font='12px sans-serif'; ctx.textAlign='center'; 
            ctx.fillText('☢', bx, by+4);
        } else if (b.isRolling) {
             ctx.strokeStyle = '#fff'; ctx.lineWidth=2;
             ctx.beginPath(); ctx.moveTo(bx-6, by); ctx.lineTo(bx+6, by); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(bx, by-6); ctx.lineTo(bx, by+6); ctx.stroke();
        }
        
        // Lunte (wackelt)
        const wickX = bx + Math.sin(Date.now()*0.02)*2;
        ctx.strokeStyle = '#aa8855'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx, by-15); ctx.lineTo(wickX, by-22); ctx.stroke();
        
        // Funke
        ctx.fillStyle = `hsl(${Math.random()*60}, 100%, 50%)`;
        ctx.beginPath(); ctx.arc(wickX, by-22, 3, 0, Math.PI*2); ctx.fill();
    });
}

export function drawParticles(ctx) {
    state.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        
        if (p.isFire) {
             // Feuer Effekt
             const size = TILE_SIZE * (0.6 + (p.life/p.maxLife)*0.4);
             // Farbe variiert von Weiß (Kern) zu Gelb zu Rot
             const lifeP = p.life / p.maxLife;
             let color = p.isNapalm ? `rgba(50, 255, 50, ${lifeP})` : `rgba(255, ${Math.floor(lifeP*255)}, 0, ${lifeP})`;
             if(p.isNapalm) color = `rgb(${Math.floor(50+Math.random()*100)}, ${Math.floor(200+Math.random()*55)}, 50)`; // Giftgrün für Napalm? Oder Lila? Constant sagt Rot. Machen wir es heiß.
             if(p.isNapalm) color = `rgb(255, ${Math.floor(Math.random()*100)}, 0)`; // Napalm Glut

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
    
    // Hell Center Effekt
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