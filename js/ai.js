import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [
    {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}
];

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Status & Umgebung
    const isHardMode = (state.difficulty === DIFFICULTIES.HARD);
    const dangerMap = getDangerMap(); // Aktuelle Gefahr (Bomben/Feuer)
    const amInDanger = dangerMap[gy][gx] > 0;
    
    // Ziel-Auswahl: Wolfsrudel (Menschen > Bots > Items)
    let target = state.players.find(p => !p.isBot && p.alive);
    if (!target) target = state.players.find(p => p !== bot && p.alive); // Fallback auf Bots

    // Cooldown runterzählen
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;

    let nextMove = null;

    // ============================================================
    // PRIO 1: ÜBERLEBEN (FLUCHT)
    // ============================================================
    if (amInDanger) {
        // Wir stehen im Feuer/Bombenradius -> SOFORT RAUS
        nextMove = findSafestPath(gx, gy, dangerMap);
        bot.changeDirTimer = 0;
    }

    // ============================================================
    // PRIO 2: ANGRIFF & TAKTIK (Wenn wir sicher stehen)
    // ============================================================
    else {
        // Entscheidung treffen (nicht jeden Frame, außer bei Stillstand)
        if (bot.changeDirTimer <= 0 || (bot.botDir.x === 0 && bot.botDir.y === 0)) {
            
            // --- BOMBE LEGEN? ---
            let shouldBomb = false;
            
            if (bot.activeBombs < bot.maxBombs) {
                // Bewertung der Position
                const bombScore = evaluateBombSpot(bot, gx, gy, target);
                
                // Schwellenwert: Auf HARD legen wir für fast jeden Vorteil (Score > 5)
                const threshold = isHardMode ? 5 : 15;

                if (bombScore > threshold) {
                    // SIMULATION: Überlebe ich meine eigene Bombe?
                    if (isSafeToPlant(bot, gx, gy, dangerMap)) {
                        shouldBomb = true;
                    }
                }
            }

            // --- HANDLUNG ---
            if (shouldBomb) {
                // Modus wählen
                if (bot.hasNapalm) bot.currentBombMode = BOMB_MODES.NAPALM;
                
                bot.plantBomb();
                
                // Sofort Flucht berechnen (mit der neuen Gefahr)
                const newDangerMap = getDangerMap(); // Map inkl. meiner neuen Bombe
                nextMove = findSafestPath(gx, gy, newDangerMap);
                bot.changeDirTimer = 5;
            } 
            else {
                // --- BEWEGUNG ---
                
                // A. Items einsammeln (Sehr wichtig für Stärke)
                const itemMove = findPathToBestItem(gx, gy, dangerMap);
                
                // B. Angriff (Spieler jagen)
                let attackMove = null;
                if (target && isHardMode) {
                    // Pfad zum Spieler suchen
                    const path = findPathToTarget(gx, gy, Math.round(target.x/TILE_SIZE), Math.round(target.y/TILE_SIZE), dangerMap);
                    if (path) attackMove = path;
                    else {
                        // Wenn kein direkter Weg -> Farmen um Weg freizumachen
                        attackMove = findBestFarmingSpot(gx, gy, dangerMap, bot);
                    }
                }

                // Entscheidung
                if (itemMove) {
                    nextMove = itemMove; // Gier
                    bot.changeDirTimer = 2;
                } else if (attackMove) {
                    nextMove = attackMove; // Jagd
                    bot.changeDirTimer = 8;
                } else {
                    // C. Farmen / Erkunden
                    nextMove = findBestFarmingSpot(gx, gy, dangerMap, bot) || findRandomSafeMove(gx, gy, dangerMap);
                    bot.changeDirTimer = 15;
                }
            }
        } else {
            // Richtung beibehalten
            nextMove = bot.botDir;
            
            // Check: Ist der Weg noch frei?
            const nx = gx + nextMove.x; 
            const ny = gy + nextMove.y;
            if (isSolid(nx, ny) || dangerMap[ny][nx] > 0 || state.items[ny][nx] === ITEMS.SKULL) {
                nextMove = null; // Stopp, neu denken
                bot.changeDirTimer = 0;
            }
        }
    }

    // ============================================================
    // AUSFÜHRUNG
    // ============================================================
    if (nextMove && (nextMove.x !== 0 || nextMove.y !== 0)) {
        bot.botDir = nextMove;
        
        if (nextMove.x !== 0) bot.lastDir = {x: Math.sign(nextMove.x), y: 0};
        else if (nextMove.y !== 0) bot.lastDir = {x: 0, y: Math.sign(nextMove.y)};
        
        bot.move(nextMove.x * bot.speed, nextMove.y * bot.speed);
        
        // Anti-Stuck: Wenn wir gegen Wand laufen, zentrieren
        const centerX = (Math.round(bot.x / TILE_SIZE) * TILE_SIZE);
        const centerY = (Math.round(bot.y / TILE_SIZE) * TILE_SIZE);
        const drift = bot.speed * 0.5;
        
        if (nextMove.x !== 0 && Math.abs(bot.y - centerY) > 4) {
            if (bot.y < centerY) bot.y += drift; else bot.y -= drift;
        } else if (nextMove.y !== 0 && Math.abs(bot.x - centerX) > 4) {
            if (bot.x < centerX) bot.x += drift; else bot.x -= drift;
        }
    }
}

// -----------------------------------------------------------------
// LOGIK & SIMULATION
// -----------------------------------------------------------------

/**
 * Simuliert, ob der Bot nach dem Legen einer Bombe entkommen kann.
 */
function isSafeToPlant(bot, gx, gy, currentDangerMap) {
    // 1. Erstelle eine hypothetische DangerMap mit der NEUEN Bombe
    const futureMap = currentDangerMap.map(row => [...row]); // Deep Copy light
    
    // Simuliere Explosionsradius der neuen Bombe
    const r = bot.bombRange;
    futureMap[gy][gx] = 180; // Timer (hier egal, hauptsache > 0)
    
    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
            
            futureMap[ty][tx] = 180; // Markiere als Gefahr
            
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Explosion stoppt an Softwall
        }
    });

    // 2. Suche einen Weg von (gx, gy) zu einem Feld, das in futureMap SICHER (0) ist.
    // Wir nehmen an, wir haben 3 Sekunden Zeit. Das reicht für ca 10-15 Felder.
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([gx+','+gy]);

    while(queue.length > 0) {
        const c = queue.shift();
        
        // Haben wir ein sicheres Feld erreicht?
        if (futureMap[c.y][c.x] === 0) return true; // JA! Wir können entkommen.

        if (c.dist > 10) continue; // Zu weit weg, gilt als "unsicher"

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            // Wir dürfen beim ersten Schritt "durch" die eigene Bombe laufen (Startfeld)
            const isStart = (nx === gx && ny === gy);
            
            if (isValid(nx, ny) && !visited.has(nx+','+ny)) {
                // Weg muss begehbar sein. WICHTIG: Wir dürfen NICHT in *altes* Feuer laufen (currentDangerMap)
                if ((!isSolid(nx, ny) || isStart) && currentDangerMap[ny][nx] === 0) {
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, dist: c.dist+1});
                }
            }
        }
    }
    
    return false; // Kein sicherer Weg gefunden -> SUIZID VERMEIDEN
}

function evaluateBombSpot(bot, gx, gy, target) {
    let score = 0;
    const r = bot.bombRange;

    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x * i; const ty = gy + d.y * i;
            if (!isValid(tx, ty)) break;
            const tile = state.grid[ty][tx];

            if (tile === TYPES.WALL_HARD) break;
            if (tile === TYPES.WALL_SOFT) { score += 20; break; } // Kiste!
            if (state.items[ty][tx] === ITEMS.SKULL) { score += 50; break; } // Skull weg!

            // Gegner treffen?
            state.players.forEach(p => {
                if (p.alive && Math.round(p.x/TILE_SIZE)===tx && Math.round(p.y/TILE_SIZE)===ty) {
                    if (p === bot) return;
                    if (p.isBot) score -= 100; // Andere Bots ignorieren (Wolfsrudel)
                    else score += 500; // MENSCH TREFFEN = PRIO 1
                }
            });
        }
    });

    // Taktik: Wenn Gegner nah ist, Druck machen
    if (target) {
        const dist = Math.abs(gx - Math.round(target.x/TILE_SIZE)) + Math.abs(gy - Math.round(target.y/TILE_SIZE));
        if (dist <= 3) score += 10;
        // Falle (Sackgasse)
        if (dist <= 2 && isDeadEnd(Math.round(target.x/TILE_SIZE), Math.round(target.y/TILE_SIZE))) score += 1000;
    }

    return score;
}

// -----------------------------------------------------------------
// PFADFINDUNG (BFS)
// -----------------------------------------------------------------

function findSafestPath(gx, gy, dangerMap) {
    // Suche Weg zu dangerMap == 0
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    
    // Wenn wir schon sicher sind, null (oder stehenbleiben)
    if (dangerMap[gy][gx] === 0) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        
        if (dangerMap[c.y][c.x] === 0) return c.move || {x:0, y:0};

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                // Bei Flucht ist alles erlaubt, was nicht solide ist. 
                // Wir nehmen den kürzesten Weg raus.
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return {x:0, y:0}; // RIP
}

function findPathToTarget(sx, sy, target, dangerMap) {
    const tx = Math.round(target.x/TILE_SIZE);
    const ty = Math.round(target.y/TILE_SIZE);
    
    const queue = [{x:sx, y:sy, move:null}];
    const visited = new Set([sx+','+sy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 400) {
        const c = queue.shift();
        if (c.x === tx && c.y === ty) return c.move;

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            const isTarget = (nx === tx && ny === ty);
            
            if (isValid(nx, ny) && !visited.has(nx+','+ny)) {
                // Sicherer Weg: Kein DangerMap > 0, kein Skull, nicht solide (außer Ziel)
                if (dangerMap[ny][nx] === 0 && (!isSolid(nx, ny) || isTarget) && state.items[ny][nx] !== ITEMS.SKULL) {
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, move: c.move || d});
                }
            }
        }
    }
    return null;
}

function findPathToBestItem(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        if (c.dist > 10) continue;

        const item = state.items[c.y][c.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL && dangerMap[c.y][c.x] === 0) return c.move;

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

function findBestFarmingSpot(gx, gy, dangerMap, bot) {
    // Suche Spot, von dem aus man eine Mauer sprengen kann
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 200) {
        const c = queue.shift();
        if (c.dist > 8) continue;

        // Wenn hier sicher ist und wir was sprengen können -> Hin da!
        if (dangerMap[c.y][c.x] === 0) {
            let hits = 0;
            DIRS.forEach(d => {
                const tx = c.x + d.x; const ty = c.y + d.y;
                if (isValid(tx, ty) && state.grid[ty][tx] === TYPES.WALL_SOFT) hits++;
            });
            if (hits > 0) return c.move || {x:0, y:0};
        }

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && dangerMap[ny][nx] === 0 && !visited.has(nx+','+ny)) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return findRandomSafeMove(gx, gy, dangerMap);
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        return isValid(nx, ny) && !isSolid(nx, ny) && dangerMap[ny][nx] === 0 && state.items[ny][nx] !== ITEMS.SKULL;
    });
    if (valid.length > 0) return valid[Math.floor(Math.random()*valid.length)];
    return {x:0, y:0};
}

// -----------------------------------------------------------------
// HELPER
// -----------------------------------------------------------------

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    // Feuer (sofort tot)
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = 1; 
    });
    // Bomben (zukünftig tot)
    state.bombs.forEach(b => {
        const t = b.timer > 0 ? b.timer : 1;
        map[b.gy][b.gx] = t;
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                if (map[ty][tx] === 0 || map[ty][tx] > t) map[ty][tx] = t;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    return map;
}

function isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }

function isDeadEnd(x, y) {
    let free = 0;
    DIRS.forEach(d => {
        if (isValid(x+d.x, y+d.y) && !isSolid(x+d.x, y+d.y)) free++;
    });
    return free <= 1;
}