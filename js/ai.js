import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Wählt die fieseste verfügbare Bombe.
 */
function botPlantBomb(bot) {
    if (bot.hasNapalm) {
        bot.currentBombMode = BOMB_MODES.NAPALM;
    } else if (bot.hasRolling) {
        bot.currentBombMode = BOMB_MODES.ROLLING;
    } else {
        bot.currentBombMode = BOMB_MODES.STANDARD;
    }
    bot.plantBomb();
}

/**
 * Prüft auf "Sniper"-Möglichkeiten (Gerade Linie).
 */
function isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer) {
    if (!targetPlayer) return false;
    const pgx = Math.round(targetPlayer.x / TILE_SIZE);
    const pgy = Math.round(targetPlayer.y / TILE_SIZE);

    if (pgx !== gx && pgy !== gy) return false;
    
    const dist = Math.abs(pgx - gx) + Math.abs(pgy - gy);
    if (dist > range) return false;

    const dx = Math.sign(pgx - gx);
    const dy = Math.sign(pgy - gy);
    
    for (let i = 1; i < dist; i++) {
        const tx = gx + (dx * i);
        const ty = gy + (dy * i);
        if (state.grid[ty][tx] === TYPES.WALL_HARD || state.grid[ty][tx] === TYPES.WALL_SOFT) {
            return false;
        }
    }
    return true;
}

/**
 * Bewertet Bombenpositionen. 
 * NEU: Extrem aggressiv bei Nachbarschaft.
 */
function calculateBombScore(gx, gy, range, isAggro, targetPlayer) {
    let score = 0;
    
    // 1. SNIPER (Fernkampf)
    if (targetPlayer && isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer)) {
        return 9999; 
    }

    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 2. NAHKAMPF & FALLE (Das löst das Sackgassen-Problem)
    // Wenn wir direkt neben dem Spieler stehen: BOMBE. Immer.
    // Das tötet ihn in der Sackgasse und stresst ihn im Offenen.
    if (targetPlayer && distToPlayer <= 1) {
        score += 50000; // Höchste Priorität
    }
    // Wenn wir sehr nah sind (2 Felder), machen wir Druck
    else if (targetPlayer && distToPlayer <= 2) {
        score += 500;
    }

    // 3. ZONE CONTROL (Endgame)
    if (isAggro && distToPlayer <= 6) {
        score += 100;
    }

    // 4. FARMING (Standard)
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            if (tile === TYPES.WALL_SOFT) {
                score += 20;
                break; 
            }
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 500; 
                 break; 
            }
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Findet den Spieler. Zwingt den Bot, in die Sackgasse zu laufen.
 */
function findPathToPlayer(gx, gy, dangerMap) {
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead); 
    if (!targetPlayer) return null;

    const targetGx = Math.round(targetPlayer.x / TILE_SIZE);
    const targetGy = Math.round(targetPlayer.y / TILE_SIZE);

    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 1500) break; // Weite Suche erlauben
        const current = queue.shift();
        
        // Ziel: Direktes Nachbarfeld des Spielers
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        // Keine Distanzbegrenzung im Hard Mode mehr, damit sie dich überall finden
        if (current.dist > 40) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Skulls ignorieren, Gefahr ignorieren WENN es der einzige Weg zum Kill ist? 
                // Nein, lieber sicher spielen.
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && !isSkull) {
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

function findGoodItemMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break;
        const current = queue.shift();
        
        const item = state.items[current.y][current.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) {
            return current.firstMove;
        }
        
        if (current.dist > 15) continue;
        
        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return null;
}

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const isHardMode = (bot.difficulty === DIFFICULTIES.HARD);
    
    let dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    let distToPlayer = 999;
    if (targetPlayer) {
        distToPlayer = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
    }

    let targetDir = {x:0, y:0};
    
    // Bestehende Bewegung übernehmen (Smoothness), aber Interrupts erlauben
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) {
        targetDir = bot.botDir;
    }

    // -----------------------------------------------------------
    // 1. FLUCHT (PRIO 1)
    // -----------------------------------------------------------
    if (amInDanger) {
        // Counter-Bomb: "Wenn ich eh rennen muss, hinterlasse ich Chaos"
        if (isHardMode && distToPlayer <= 3 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                botPlantBomb(bot);
                dangerMap = getDangerMap(); 
            }
        }
        targetDir = findSafeMove(gx, gy, dangerMap);
        bot.changeDirTimer = 0; 
    } 
    // -----------------------------------------------------------
    // 2. HARD MODE LOGIK (KILLER)
    // -----------------------------------------------------------
    else if (isHardMode) {
        
        const killPath = findPathToPlayer(gx, gy, dangerMap);
        // Wir sind "Aggro", wenn wir den Spieler erreichen können.
        const isAggro = (killPath !== null) || (distToPlayer < 10);

        // A) INTERRUPT: BOMBE LEGEN?
        // Check JEDEN FRAME, ob wir eine perfekte Gelegenheit haben (z.B. Sackgasse)
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = calculateBombScore(gx, gy, bot.range, isAggro, targetPlayer);
            const threshold = isAggro ? 1 : 15; 
            
            if (bombScore >= threshold) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    botPlantBomb(bot);
                    // Nach dem Legen SOFORT in Fluchtmodus wechseln
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0;
                }
            }
        }

        // B) BEWEGUNG PLANEN
        // Wenn wir sicher sind und nicht gerade gebombt haben: Wohin?
        const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
        const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
        const isBlocked = isSolid(nextX, nextY);
        
        // Wir entscheiden neu, wenn: Wir stehen, wir blockiert sind, oder der Timer abgelaufen ist
        if ((targetDir.x === 0 && targetDir.y === 0) || isBlocked || bot.changeDirTimer <= 0) {
            
            // STRATEGIE:
            // 1. Wenn Weg zum Spieler frei -> KILL (Prio!)
            // 2. Wenn Items nah -> Nimm sie
            // 3. Wenn kein Weg zum Spieler -> Such Items weit weg
            
            if (killPath) {
                // Konsequente Verfolgung
                targetDir = killPath;
                // Kurzer Timer, damit er auf Bewegungen des Spielers reagiert
                bot.changeDirTimer = 5; 
            } else {
                // Kein Weg zum Spieler? Items suchen.
                // Erst greedy (direkt daneben)
                let greedyMove = null;
                for (let d of DIRS) {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                        const item = state.items[ny][nx];
                        if (item !== ITEMS.NONE && item !== ITEMS.SKULL && !dangerMap[ny][nx] && !isSolid(nx, ny)) {
                            greedyMove = d; break;
                        }
                    }
                }
                
                if (greedyMove) {
                    targetDir = greedyMove;
                    bot.changeDirTimer = 5;
                } else {
                    // Weite Suche nach Items
                    let itemMove = findGoodItemMove(gx, gy, dangerMap);
                    if (itemMove) {
                        targetDir = itemMove;
                        bot.changeDirTimer = 15;
                    } else {
                        // Fallback: Lauf einfach irgendwie zum Spieler (Luftlinie minimieren),
                        // auch wenn kein Pfad da ist (vielleicht wird einer frei)
                        const safeNeighbors = DIRS.filter(d => {
                             const nx = gx + d.x; const ny = gy + d.y;
                             if (isSolid(nx, ny)) return false;
                             if (state.items[ny][nx] === ITEMS.SKULL) return false;
                             return !dangerMap[ny][nx]; 
                        });
                        // Wähle den Nachbarn, der die Distanz zum Spieler minimiert
                        if (targetPlayer && safeNeighbors.length > 0) {
                             safeNeighbors.sort((a, b) => {
                                 const distA = Math.abs((gx+a.x) - targetGx) + Math.abs((gy+a.y) - targetGy);
                                 const distB = Math.abs((gx+b.x) - targetGx) + Math.abs((gy+b.y) - targetGy);
                                 return distA - distB;
                             });
                             targetDir = safeNeighbors[0];
                             bot.changeDirTimer = 10;
                        } else if (safeNeighbors.length > 0) {
                             targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                             bot.changeDirTimer = 20;
                        }
                    }
                }
            }
        }
        
        // C) SKULL SCHUTZ
        if (targetDir.x !== 0 || targetDir.y !== 0) {
            const nx = gx + targetDir.x; const ny = gy + targetDir.y;
            if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    botPlantBomb(bot); 
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0;
                } else {
                    targetDir = {x:0, y:0};
                    bot.changeDirTimer = 0;
                }
            }
        }
    } 
    // -----------------------------------------------------------
    // 3. EASY/MEDIUM LOGIK
    // -----------------------------------------------------------
    else {
        // Original-Verhalten
        const nearTarget = DIRS.some(d => {
            const tx = gx + d.x; const ty = gy + d.y;
            if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
            return state.grid[ty][tx] === TYPES.WALL_SOFT; 
        });

        if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                botPlantBomb(bot); 
                targetDir = findSafeMove(gx, gy, getDangerMap()); 
            }
        }

        if (targetDir.x === 0 && targetDir.y === 0 || bot.changeDirTimer <= 0) {
            const nextX = Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE);
            const nextY = Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE);
             if (bot.changeDirTimer <= 0 || isSolid(nextX, nextY)) {
                const safeNeighbors = DIRS.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    return !dangerMap[ny][nx]; 
                });
                if (safeNeighbors.length > 0) {
                    const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                    targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                } else { targetDir = {x:0, y:0}; }
                bot.changeDirTimer = 15 + Math.random() * 30;
             } else { targetDir = bot.botDir || {x:0, y:0}; }
        }
    }

    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

// ---------------- HELPER ----------------

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) {
            map[p.gy][p.gx] = true; 
        }
    });
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        map[b.gy][b.gx] = true; 
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
            }
        });
    });
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

function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break; 
        const current = queue.shift();
        if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
        if (current.dist > 12) continue; 
        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}