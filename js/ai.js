import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js'; // DIFFICULTIES hinzugefügt
import { state } from './state.js';
import { isSolid } from './utils.js';

// Konstanten für Richtungen
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Berechnet einen "Wert" für eine Bombenplatzierung: Anzahl der Soft Walls und
 * Skulls, die mit der Bombe in Reichweite zerstört werden können. (Regel 3 & 7)
 */
function calculateWallScore(gx, gy, range) {
    let score = 0;
    
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            
            if (tile === TYPES.WALL_HARD) break;
            
            if (tile === TYPES.WALL_SOFT) {
                score++;
                break; // Feuer stoppt hier nach Zerstörung
            }
            
            // Regel 7: Skull-Items wegsprengen - sehr hohe Priorität, um sie zu verhindern
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 100; 
            }
            
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Feuer stoppt hier
        }
    });
    return score;
}

/**
 * Führt eine Breitensuche (BFS) durch, um den besten ersten Zug zu einem guten Item zu finden.
 * Schädliche Items (ITEMS.SKULL) werden ignoriert. (Regel 2 & 7)
 * @returns {object | null} Die Richtung zum besten Item oder null.
 */
function findGoodItemMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        // Regel 2/7: Gutes Item gefunden
        if (state.items[current.y][current.x] !== ITEMS.NONE && state.items[current.y][current.x] !== ITEMS.SKULL) {
            return current.firstMove || {x: 0, y: 0};
        }
        
        if (current.dist > 10) continue; // Suche abbrechen wenn zu weit
        
        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Sicherstellen, dass der Weg nicht fest ist und nicht in Gefahr führt.
                if (!isSolid(nx, ny) && !dangerMap[ny][nx]) {
                    visited.add(key);
                    queue.push({ 
                        x: nx, 
                        y: ny, 
                        firstMove: current.firstMove || d, 
                        dist: current.dist + 1 
                    });
                }
            }
        }
    }
    return null;
}

/**
 * Führt eine Breitensuche (BFS) durch, um den besten ersten Zug zum menschlichen Player zu finden.
 * (Regel 5 & 6)
 * @returns {object | null} Die Richtung zum Player, ein Bombenspot-Signal oder null.
 */
function findPlayerMove(gx, gy, dangerMap) {
    // Suchen nach dem menschlichen Spieler (Annahme: p.isHuman)
    const targetPlayer = state.players.find(p => p.isHuman); 
    if (!targetPlayer || targetPlayer.isDead) return null;

    const targetGx = Math.round(targetPlayer.x / TILE_SIZE);
    const targetGy = Math.round(targetPlayer.y / TILE_SIZE);

    // Wenn der Bot direkt neben dem Player steht (Regel 6: Falle legen)
    if (Math.abs(gx - targetGx) + Math.abs(gy - targetGy) <= 1) {
        // Hier sollte die Logik zum Bomben/Einsperren stattfinden.
        // Signalisiere in der Rückgabe, dass dies der beste Platz zum Bomben ist.
        return {x: 0, y: 0, isBombSpot: true}; 
    }
    
    // Pathfinding zum Player
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.dist > 15) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Sicherstellen, dass der Weg nicht fest ist und nicht in Gefahr führt.
                if (!isSolid(nx, ny) && !dangerMap[ny][nx]) {
                    visited.add(key);
                    const isTarget = (nx === targetGx && ny === targetGy) || (Math.abs(nx - targetGx) + Math.abs(ny - targetGy) <= 1);
                    queue.push({ 
                        x: nx, 
                        y: ny, 
                        firstMove: current.firstMove || d, 
                        dist: current.dist + 1
                    });
                    if (isTarget) return current.firstMove || d; // Erste Richtung zum Player gefunden
                }
            }
        }
    }
    return null;
}

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Annahme: bot.difficulty existiert (z.B. bot.difficulty = DIFFICULTIES.HARD)
    const isHardMode = bot.difficulty === DIFFICULTIES.HARD;
    
    // 1. Gefahr erkennen (Regel 1: Keine Suizide begehen)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT-MODUS
        targetDir = findSafeMove(gx, gy, dangerMap);
        // Wenn kein Fluchtweg gefunden wird, bleibt targetDir {x:0, y:0}
    } else {
        // ANGRIFFS-MODUS
        
        if (isHardMode) {
            // --- HARD-MODE LOGIK: Aggressiv und Strategisch ---
            
            // 1. Regel 2/7: Items suchen und einsammeln (höchste Priorität)
            const itemMove = findGoodItemMove(gx, gy, dangerMap);
            if (itemMove) {
                targetDir = itemMove;
            }

            // 2. Regel 5/6: Spieler jagen/einsperren ODER Bombe strategisch legen (Regel 3/7)
            if (!targetDir.x && !targetDir.y) {
                
                let bestMove = null;
                
                // Vereinfachte Schätzung für den "Hunting"-Zustand (Regel 5):
                // Wenn weniger als 10 Soft Walls übrig sind, beginnt die Jagd.
                const softWallCount = state.grid.flat().filter(tile => tile === TYPES.WALL_SOFT).length;
                const isHuntingPhase = softWallCount < 10;

                if (isHuntingPhase) {
                    // Spieler jagen und Fallen stellen
                    bestMove = findPlayerMove(gx, gy, dangerMap);
                }
                
                // Strategische Bombenplatzierung/Falle
                if ((!bestMove || !bestMove.x && !bestMove.y) && bot.activeBombs < bot.maxBombs) {
                    let maxScore = 0;
                    const botRange = bot.range; 

                    // Überprüfe den aktuellen Standort (gx, gy) als Bombenspot
                    if (!isSolid(gx, gy) && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        let currentSpotScore = calculateWallScore(gx, gy, botRange);
                        
                        if (currentSpotScore > maxScore) { 
                            maxScore = currentSpotScore;
                            bestMove = { x: 0, y: 0, shouldPlant: true }; // Bleibe stehen und lege
                        }
                    }
                }
                
                // Führe die beste Bewegung/Bombenaktion aus
                if (bestMove) {
                    // Bombe legen (Spielerfalle oder strategisch)
                    if (bestMove.shouldPlant && bot.activeBombs < bot.maxBombs) {
                        
                        // Regel 4 (Kein Friendly Fire): Nur legen, wenn es nicht zu einem Selbstmord führt.
                        // Der check 'canEscapeAfterPlanting' und 'findSafeMove' nach dem Legen regelt dies (Regel 1).
                        // Vermeidung anderer Bots (Regel 4) ist hier implizit, da der Bot primär den Player angreift
                        // und nicht versucht, sich von anderen Bots zu entfernen, wenn er sich nicht im Fluchtmodus befindet.

                        bot.plantBomb();
                        // Nach dem Bomben sofort Fluchtweg suchen (Regel 1)
                        targetDir = findSafeMove(gx, gy, getDangerMap());
                    } else if (!bestMove.shouldPlant) {
                        // Bewegung zum Item oder Player
                        targetDir = bestMove;
                    }
                }
            }
            
            // 3. Fallback: Zufällige, sichere Bewegung
            if (!targetDir.x && !targetDir.y) {
                 const safeNeighbors = DIRS.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    return !dangerMap[ny][nx]; // Nicht in Gefahr laufen
                 });
                 if (safeNeighbors.length > 0) {
                    targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                 }
                 
                 // Beibehalten des Timers für den Richtungswechsel
                 bot.changeDirTimer = 15 + Math.random() * 30;
            }

        } else { 
            // --- ORIGINAL LOGIK (für MEDIUM/EASY) ---
            const nearTarget = DIRS.some(d => {
                const tx = gx + d.x; const ty = gy + d.y;
                if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
                return state.grid[ty][tx] === TYPES.WALL_SOFT; // Bot will Wände sprengen
            });

            // Soll ich eine Bombe legen?
            if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
                // Nur legen, wenn ein Fluchtweg existiert!
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Sofort neuen Fluchtweg berechnen (Simulation: Bombe ist jetzt da)
                    targetDir = findSafeMove(gx, gy, getDangerMap()); 
                }
            }

            // Bewegung (Zufall oder Item-Suche)
            if (targetDir.x === 0 && targetDir.y === 0) {
                // Richtungswechsel nur alle paar Frames oder wenn blockiert
                const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
                const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
                
                if (bot.changeDirTimer <= 0 || isSolid(nextX, nextY)) {
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx]; // Nicht in Gefahr laufen
                    });
                    
                    if (safeNeighbors.length > 0) {
                        // Priorität: Items einsammeln
                        const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else {
                        targetDir = {x:0, y:0}; // Sackgasse
                    }
                    bot.changeDirTimer = 15 + Math.random() * 30;
                } else {
                    targetDir = bot.botDir || {x:0, y:0}; // Geradeaus weiter
                }
            }
        }
    }

    // Bewegung ausführen
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

// Erstellt eine Karte aller gefährlichen Kacheln (Feuer oder gleich explodierende Bomben)
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // 1. Aktives Feuer
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) {
            map[p.gy][p.gx] = true; 
        }
    });

    // 2. Bomben-Explosionsradien
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        
        map[b.gy][b.gx] = true; // Bombe selbst ist Gefahr
        
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Feuer stoppt hier
            }
        });
    });

    // 3. Höllenfeuer
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        const range = 5; 
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        DIRS.forEach(d => {
            for(let i=1; i<=range; i++) {
                const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
                if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                    if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                    map[ty][tx] = true;
                    if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
                }
            }
        });
    }

    return map;
}

// Breitensuche zum nächsten sicheren Feld
function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break; // Performance Notbremse
        
        const current = queue.shift();
        
        // Ziel erreicht: Sicheres Feld
        if (!dangerMap[current.y][current.x]) {
            return current.firstMove || {x:0, y:0}; 
        }
        
        if (current.dist > 12) continue; // Suche abbrechen wenn zu weit

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    // Panik: Zufällige Richtung wenn kein Ausweg (Regel 1 Backup)
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Gibt es mindestens ein freies, sicheres Nachbarfeld?
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}