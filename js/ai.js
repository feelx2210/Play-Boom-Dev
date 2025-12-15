import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Entscheidet taktisch, welcher Bomben-Modus genutzt werden soll.
 */
function decideAndPlant(bot, gx, gy, distToPlayer, isAligned) {
    let selectedMode = BOMB_MODES.STANDARD;

    // Analyse der Umgebung (Wände in direkter Nachbarschaft)
    let wallCount = 0;
    DIRS.forEach(d => {
        if (state.grid[gy+d.y] && (state.grid[gy+d.y][gx+d.x] === TYPES.WALL_HARD || state.grid[gy+d.y][gx+d.x] === TYPES.WALL_SOFT)) {
            wallCount++;
        }
    });
    
    // Hat der Bot Napalm?
    if (bot.hasNapalm) {
        // REGEL: Kein Napalm in engen Ecken (Farming-Phase), sonst sperrt man sich ein.
        // Ausnahme: Wir wollen den Spieler im Nahkampf töten (Selbstmord-Risiko in Kauf nehmen oder Falle).
        const isCramped = wallCount >= 2;
        const trapIntent = distToPlayer <= 2;
        
        if (!isCramped || trapIntent) {
            selectedMode = BOMB_MODES.NAPALM; // Feuer frei zur Gebietskontrolle
        }
    }

    // Hat der Bot Rolling Bombs? (Überschreibt Napalm ggf. für Fernkampf)
    if (bot.hasRolling) {
        // REGEL: Rolling Bombs nur auf Distanz und wenn Platz ist.
        // Sniper-Schuss oder wir sind auf freiem Feld.
        const longRange = distToPlayer > 4;
        const openField = wallCount === 0; // Keine Wände direkt daneben
        
        if ((isAligned && longRange) || (openField && longRange)) {
            selectedMode = BOMB_MODES.ROLLING;
        } else if (selectedMode === BOMB_MODES.ROLLING) {
             // Fallback, falls wir Rolling gewählt hätten aber die Bedingungen schlecht sind
             selectedMode = BOMB_MODES.STANDARD; 
             if (bot.hasNapalm && (!wallCount >= 2)) selectedMode = BOMB_MODES.NAPALM;
        }
    }

    bot.currentBombMode = selectedMode;
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
    if (dist > range * 1.5) return false; // Etwas mehr Range Check für Rolling

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
 */
function calculateBombScore(gx, gy, range, isAggro, targetPlayer) {
    let score = 0;
    
    // 1. SNIPER (Fernkampf)
    if (targetPlayer && isPlayerAlignedAndVulnerable(gx, gy, 10, targetPlayer)) {
        return 9999; 
    }

    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 2. NAHKAMPF & FALLE
    if (targetPlayer && distToPlayer <= 1) score += 50000;
    else if (targetPlayer && distToPlayer <= 2) score += 500;

    // 3. ZONE CONTROL (Endgame)
    if (isAggro && distToPlayer <= 6) score += 100;
    
    // 4. MULTI-BOMB (SPAM)
    // Wenn wir aggressiv sind und noch Bomben übrig haben: RAUS DAMIT!
    if (isAggro && score > 0) {
        score += 50; // Bonus um die Schwelle sicher zu knacken
    }

    // 5. FARMING
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            if (tile === TYPES.WALL_SOFT) { score += 20; break; }
            if (state.items[ty][tx] === ITEMS.SKULL) { score += 500; break; }
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Findet den Spieler.
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
        if (++ops > 1500) break; 
        const current = queue.shift();
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) return current.firstMove;
        if (current.dist > 40) continue; 
        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && !isSkull) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
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
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) return current.firstMove;
        if (current.dist > 15) continue;
        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
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
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) targetDir = bot.botDir;

    // 1. FLUCHT (PRIO 1)
    if (amInDanger) {
        if (isHardMode && distToPlayer <= 3 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                // Taktische Entscheidung auch bei Flucht-Bomben
                decideAndPlant(bot, gx, gy, distToPlayer, false);
                dangerMap = getDangerMap(); 
            }
        }
        targetDir = findSafeMove(gx, gy, dangerMap);
        bot.changeDirTimer = 0; 
    } 
    // 2. HARD MODE LOGIK
    else if (isHardMode) {
        const killPath = findPathToPlayer(gx, gy, dangerMap);
        const isAligned = isPlayerAlignedAndVulnerable(gx, gy, 15, targetPlayer); // Weite Sicht für Rolling
        const isAggro = (killPath !== null) || (distToPlayer < 10) || isAligned;

        // A) INTERRUPT: BOMBE LEGEN?
        // Checken wir JEDEN Frame. Wenn wir Aggro sind und Bomben haben: Legen!
        // Nicht warten bis man steht.
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = calculateBombScore(gx, gy, bot.range, isAggro, targetPlayer);
            // Schwelle im Aggro-Modus extrem niedrig (1), damit er "alle Bomben legt"
            const threshold = isAggro ? 1 : 15; 
            
            if (bombScore >= threshold) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    decideAndPlant(bot, gx, gy, distToPlayer, isAligned);
                    // Flucht
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0;
                }
            }
        }

        // B) BEWEGUNG
        const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
        const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
        const isBlocked = isSolid(nextX, nextY);
        
        if ((targetDir.x === 0 && targetDir.y === 0) || isBlocked || bot.changeDirTimer <= 0) {
            if (killPath) {
                targetDir = killPath;
                bot.changeDirTimer = 5; 
            } else {
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
                    let itemMove = findGoodItemMove(gx, gy, dangerMap);
                    if (itemMove) {
                        targetDir = itemMove;
                        bot.changeDirTimer = 15;
                    } else {
                        // Fallback: Lauf zum Spieler (Luftlinie), auch ohne Pfad
                        const safeNeighbors = DIRS.filter(d => {
                             const nx = gx + d.x; const ny = gy + d.y;
                             if (isSolid(nx, ny)) return false;
                             if (state.items[ny][nx] === ITEMS.SKULL) return false;
                             return !dangerMap[ny][nx]; 
                        });
                        if (targetPlayer && safeNeighbors.length > 0) {
                             const targetGx = Math.round(targetPlayer.x/TILE_SIZE);
                             const targetGy = Math.round(targetPlayer.y/TILE_SIZE);
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
                    bot.currentBombMode = BOMB_MODES.STANDARD; // Normale Bombe zum Zerstören
                    bot.plantBomb(); 
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0;
                } else {
                    targetDir = {x:0, y:0};
                    bot.changeDirTimer = 0;
                }
            }
        }
    } 
    // 3. EASY/MEDIUM LOGIK
    else {
        const nearTarget = DIRS.some(d => {
            const tx = gx + d.x; const ty = gy + d.y;
            if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
            return state.grid[ty][tx] === TYPES.WALL_SOFT; 
        });

        if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb(); 
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