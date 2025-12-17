import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [
    {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}
];

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    // Grid-Position (Mittelpunkt basierend)
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Status
    const isHardMode = (state.difficulty === DIFFICULTIES.HARD);
    const dangerMap = getDangerMap(); 
    const amInDanger = dangerMap[gy][gx];
    
    // Ziel: Nur MENSCHLICHE Spieler jagen (Wolfsrudel)
    // Wir ignorieren andere Bots als Primärziel, es sei denn, es gibt keine Menschen mehr.
    const targetPlayer = state.players.find(p => !p.isBot && p.alive) || state.players.find(p => p !== bot && p.alive);
    
    // Cooldown verarbeiten
    if (bot.changeDirTimer > 0) {
        bot.changeDirTimer--;
        executeMove(bot); // Bewegung fortsetzen
        return;
    }

    let nextMove = {x:0, y:0};
    let wantToBomb = false;

    // ============================================================
    // PRIO 1: ÜBERLEBEN (FLUCHT)
    // ============================================================
    if (amInDanger) {
        // Panik-Modus: Suche das nächste sichere Feld
        nextMove = findSafestPath(gx, gy, dangerMap);
        bot.changeDirTimer = 0; // Keine Pausen auf der Flucht
    }

    // ============================================================
    // PRIO 2: TAKTIK (Wenn sicher)
    // ============================================================
    else {
        // A) CHECK: BOMBE LEGEN?
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = evaluateBombSpot(bot, gx, gy, targetPlayer, dangerMap);
            
            // Schwellenwert: Auf HARD legen wir schneller (ab Score 10 = 1 Wand)
            const threshold = isHardMode ? 9 : 5; 

            if (bombScore > threshold) {
                // WICHTIG: Überlebens-Check
                // "Wenn ich hier lege, blockiere ich mein eigenes Feld (gx,gy). Komme ich dann noch weg?"
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    wantToBomb = true;
                }
            }
        }

        // B) HANDLUNG AUSWÄHLEN
        if (wantToBomb) {
            // Modus wählen (Napalm um Wege abzuschneiden)
            if (bot.hasNapalm && targetPlayer) {
                const dist = getDistance(gx, gy, targetPlayer);
                if (dist < 5) bot.currentBombMode = BOMB_MODES.NAPALM;
            }
            
            bot.plantBomb();
            
            // Sofort nach dem Legen den Fluchtweg einschlagen
            // (Wir simulieren die Gefahr der soeben gelegten Bombe)
            const tempDanger = getDangerMap(); // Neu berechnen inkl. meiner Bombe
            nextMove = findSafestPath(gx, gy, tempDanger);
            bot.changeDirTimer = 5;
        } 
        else {
            // C) BEWEGUNG (Keine Bombe gelegt)
            
            // 1. Items einsammeln (Höchste Prio, wenn sicher)
            const itemMove = findPathToBestItem(gx, gy, dangerMap);
            if (itemMove) {
                nextMove = itemMove;
                bot.changeDirTimer = 0; // Sprinten
            }
            // 2. Angriff (Wolfsrudel auf Spieler)
            else if (targetPlayer && isHardMode) {
                // Pfad zum Spieler
                const attackPath = findPathToTarget(gx, gy, targetPlayer, dangerMap);
                if (attackPath) {
                    nextMove = attackPath;
                } else {
                    // Spieler nicht erreichbar? Dann farmen (Wände sprengen)
                    nextMove = findBestFarmingSpot(gx, gy, dangerMap, bot);
                }
                bot.changeDirTimer = Math.floor(Math.random() * 8 + 2);
            }
            // 3. Farmen / Erkunden
            else {
                nextMove = findBestFarmingSpot(gx, gy, dangerMap, bot);
                bot.changeDirTimer = Math.floor(Math.random() * 10 + 5);
            }
        }
    }

    // ============================================================
    // AUSFÜHRUNG
    // ============================================================
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        bot.botDir = nextMove;
        
        // Blickrichtung speichern (für Grafik)
        if (nextMove.x !== 0) bot.lastDir = {x: Math.sign(nextMove.x), y: 0};
        else if (nextMove.y !== 0) bot.lastDir = {x: 0, y: Math.sign(nextMove.y)};
        
        executeMove(bot);
    } else {
        // Idle (evtl. in die Mitte des Tiles korrigieren)
        bot.botDir = {x:0, y:0};
    }
}

// -----------------------------------------------------------------
// LOGIK-FUNKTIONEN
// -----------------------------------------------------------------

function executeMove(bot) {
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) {
        // Bewegung ausführen
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        
        // Zentrierungshilfe: Wenn wir uns vertikal bewegen, richten wir uns horizontal mittig aus (und umgekehrt)
        // Das verhindert das Hängenbleiben an Ecken.
        const centerX = (Math.round(bot.x / TILE_SIZE) * TILE_SIZE);
        const centerY = (Math.round(bot.y / TILE_SIZE) * TILE_SIZE);
        const driftSpeed = bot.speed * 0.5;

        if (bot.botDir.x !== 0) { // Horizontal moving
            if (Math.abs(bot.y - centerY) > 2) {
                if (bot.y < centerY) bot.y += driftSpeed; else bot.y -= driftSpeed;
            }
        } else if (bot.botDir.y !== 0) { // Vertical moving
            if (Math.abs(bot.x - centerX) > 2) {
                if (bot.x < centerX) bot.x += driftSpeed; else bot.x -= driftSpeed;
            }
        }
    }
}

function evaluateBombSpot(bot, gx, gy, target, dangerMap) {
    let score = 0;
    const r = bot.bombRange;

    // Strahlen prüfen
    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x * i;
            const ty = gy + d.y * i;
            if (!isValid(tx, ty)) break;
            
            const tile = state.grid[ty][tx];
            
            // Hindernisse
            if (tile === TYPES.WALL_HARD) break;
            if (tile === TYPES.WALL_SOFT) {
                score += 15; // Soft Wall getroffen
                break; // Explosion stoppt
            }
            
            // Items (Skulls zerstören ist gut!)
            if (state.items[ty][tx] === ITEMS.SKULL) {
                score += 50; // Weg damit!
                break; 
            } else if (state.items[ty][tx] !== ITEMS.NONE) {
                score -= 1000; // Bloß keine guten Items zerstören!
                break;
            }

            // Gegner
            state.players.forEach(p => {
                if (p.alive && Math.round(p.x/TILE_SIZE) === tx && Math.round(p.y/TILE_SIZE) === ty) {
                    if (p === bot) return;
                    if (p.isBot) score -= 500; // KEIN FRIENDLY FIRE (Wolfsrudel)
                    else score += 150; // MENSCH: Feuer frei!
                }
            });
        }
    });

    // Taktik-Boni
    if (target) {
        const tGx = Math.round(target.x/TILE_SIZE);
        const tGy = Math.round(target.y/TILE_SIZE);
        const dist = Math.abs(gx - tGx) + Math.abs(gy - tGy);

        // Falle: Spieler in Sackgasse?
        if (dist <= 3 && isDeadEnd(tGx, tGy)) {
            score += 500; // TRAP HIM!
        }
    }

    return score;
}

// -----------------------------------------------------------------
// PFADFINDUNG (BFS)
// -----------------------------------------------------------------

function canEscapeAfterPlanting(gx, gy, currentDanger) {
    // 1. Markiere aktuelles Feld als Gefahr (Bombe liegt gleich hier)
    // 2. Suche Weg zu einem Feld, das im `currentDanger` (ohne die neue Bombe) sicher ist.
    // Vereinfacht: Wir prüfen, ob wir in max 4 Schritten ein Feld erreichen, das sicher ist.
    
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([gx+','+gy]);
    
    // Die Bombe selbst blockiert das Feld nicht für den Spieler, der drauf steht (WalkableId),
    // aber wir müssen sofort runter.
    
    while (queue.length > 0) {
        const c = queue.shift();
        
        // Wenn wir ein Feld erreichen, das aktuell sicher ist UND nicht das Startfeld ist
        if (currentDanger[c.y][c.x] === 0 && (c.x !== gx || c.y !== gy)) {
            return true;
        }
        
        if (c.dist >= 4) continue; // Wenn wir in 4 Schritten nicht sicher sind -> RIP

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            // Wir dürfen durch die eigene Bombe laufen (Startfeld), sonst nur durch freie Felder
            const startNode = (nx === gx && ny === gy);
            
            if (isValid(nx, ny) && !visited.has(nx+','+ny)) {
                if (!isSolid(nx, ny) || startNode) {
                    // ACHTUNG: Wir laufen nicht in existierendes Feuer (currentDanger > 0)
                    if (currentDanger[ny][nx] === 0) {
                        visited.add(nx+','+ny);
                        queue.push({x:nx, y:ny, dist: c.dist+1});
                    }
                }
            }
        }
    }
    return false;
}

function findSafestPath(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while (queue.length > 0 && ops++ < 400) {
        const c = queue.shift();
        
        // Ziel: Ein Feld ohne Gefahr
        if (dangerMap[c.y][c.x] === 0) {
            return c.move || {x:0, y:0};
        }

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                // Bei Flucht akzeptieren wir Felder mit geringerem Timer als "besser",
                // aber hier suchen wir strikt 0.
                // Wir laufen nicht in Bomben rein (dangerMap > 0), es sei denn wir sind schon drin.
                // Strategie: Breadth First findet kürzesten Weg raus.
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return {x:0, y:0}; // Keine Rettung...
}

function findPathToBestItem(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        if (c.dist > 15) continue; // Max Suchradius

        const item = state.items[c.y][c.x];
        // Ziel: Gutes Item, kein Skull, Sicher
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL && dangerMap[c.y][c.x] === 0) {
            return c.move;
        }

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                // Skull meiden wie eine Wand
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

function findPathToTarget(gx, gy, target, dangerMap) {
    const tGx = Math.round(target.x / TILE_SIZE);
    const tGy = Math.round(target.y / TILE_SIZE);
    
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 500) {
        const c = queue.shift();
        
        // Angekommen?
        if (c.x === tGx && c.y === tGy) return c.move;

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            // Ziel ist begehbar (Spieler), sonst nur leere Felder
            const isTargetPos = (nx === tGx && ny === tGy);
            
            if (isValid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                if (!isSolid(nx, ny) || isTargetPos) {
                    if (state.items[ny][nx] === ITEMS.SKULL) continue; // Skulls meiden
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, move: c.move || d});
                }
            }
        }
    }
    return null;
}

function findBestFarmingSpot(gx, gy, dangerMap, bot) {
    // Suche in der Nähe nach einem Spot, von dem aus wir eine Soft Wall sprengen können
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        if (c.dist > 10) continue;

        // Prüfen: Wenn wir hier stehen, können wir was sprengen?
        if (dangerMap[c.y][c.x] === 0) {
            // Simulieren wir die Bewertung an Position c.x/c.y
            // Wir tricksen: evaluateBombSpot braucht "bot", wir faken die Position
            const score = countSoftWallsInRange(c.x, c.y, bot.bombRange);
            if (score > 0) {
                // Wir haben einen Spot gefunden, wo man was sprengen kann.
                // Ist der Weg dorthin sicher? (Ja, BFS prüft dangerMap)
                // Ist es sicher, dort zu legen? (Wir nehmen an ja, sonst prüft der Main Loop nochmal)
                return c.move || {x:0, y:0};
            }
        }

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    // Wenn nichts gefunden, Zufallsbewegung (Idle)
    return findRandomSafeMove(gx, gy, dangerMap);
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
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
    // Feuer (Timer=1, sehr gefährlich)
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = 1; 
    });
    // Bomben
    state.bombs.forEach(b => {
        const t = b.timer > 0 ? b.timer : 1;
        map[b.gy][b.gx] = t;
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                // Wir nehmen den niedrigsten Timer (die früheste Explosion)
                if (map[ty][tx] === 0 || map[ty][tx] > t) map[ty][tx] = t;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    return map;
}

function countSoftWallsInRange(gx, gy, range) {
    let count = 0;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) {
                count++;
                break;
            }
        }
    });
    return count;
}

function isDeadEnd(gx, gy) {
    let exits = 0;
    DIRS.forEach(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        if (isValid(nx, ny) && !isSolid(nx, ny)) exits++;
    });
    return exits <= 1;
}

function getDistance(gx, gy, target) {
    return Math.abs(gx - Math.round(target.x/TILE_SIZE)) + Math.abs(gy - Math.round(target.y/TILE_SIZE));
}

function isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }