import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Prüft, ob der Spieler verwundbar in einer Linie steht ("Sniper"-Schuss).
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
 * Bewertet Bombenpositionen. Im Angriffsmodus extrem aggressiv.
 */
function calculateBombScore(gx, gy, range, isAggro, targetPlayer) {
    let score = 0;
    
    // 1. SNIPER-CHECK (Tötet sofort)
    if (targetPlayer && isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer)) {
        return 9999; 
    }

    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 2. ZONE CONTROL (Den Spieler einsperren)
    // Wenn wir im Aggro-Modus sind, ist jede Bombe in der Nähe des Spielers gut.
    if (isAggro) {
        // Sehr nah: "Panic Bombing" / Trap
        if (distToPlayer <= 2) score += 300;
        // Mittel: "Zoning" (Weg abschneiden)
        else if (distToPlayer <= 6) score += 100;
    }

    // 3. STANDARD-ZIELE
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
            
            // SKULLS ZERSTÖREN
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
 * Sucht Pfad zum Spieler. Ignoriert Skulls.
 * Findet den Weg auch über weite Distanzen, wenn der Weg frei ist.
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
        if (++ops > 1000) break; // Erhöhtes Limit für weite Wege
        const current = queue.shift();
        
        // Ziel erreicht (oder benachbart)
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        // Distanzlimit erhöht: Bots sehen dich jetzt fast überall
        if (current.dist > 30) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Skulls sind Wände für die Wegfindung
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                
                // Wir laufen nicht in Gefahr und nicht in Wände
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
        if (++ops > 400) break;
        const current = queue.shift();
        
        const item = state.items[current.y][current.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) {
            return current.firstMove;
        }
        
        if (current.dist > 10) continue;
        
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
    
    // Status-Check
    let dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    let distToPlayer = 999;
    if (targetPlayer) {
        distToPlayer = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
    }

    let targetDir = {x:0, y:0};

    // ----------------------------------------------------------------
    // 1. FLUCHT (Prio 1)
    // ----------------------------------------------------------------
    if (amInDanger) {
        // Counter-Attack: Wenn wir flüchten müssen, aber der Spieler nah ist, Bombe legen!
        if (isHardMode && distToPlayer <= 3 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                dangerMap = getDangerMap(); 
            }
        }
        targetDir = findSafeMove(gx, gy, dangerMap);
    } 
    // ----------------------------------------------------------------
    // 2. HARD MODE: KILLER LOGIK
    // ----------------------------------------------------------------
    else if (isHardMode) {
        
        // --- BLUTRAUSCH-ERKENNUNG ---
        // Wann ist der Bot im "Tötungsmodus"?
        // 1. Wenn der Weg zum Spieler frei ist (Pathfinding findet was)
        // 2. ODER wenn der Spieler einen Fluch hat (schwach ist)
        // 3. ODER wenn wir nah dran sind
        
        // Prüfen, ob wir einen Weg zum Spieler haben (ignoriert Items auf dem Weg)
        const killPath = findPathToPlayer(gx, gy, dangerMap);
        
        // Prüfen auf Flüche (wenn Property existiert)
        const playerIsWeak = targetPlayer && (targetPlayer.hasCurse || targetPlayer.noBombs); 
        
        // Aggro-Trigger: Haben wir einen Weg? -> ATTACKE!
        // Wir ignorieren Items, wenn wir einen Weg zum Spieler haben.
        const isAggro = (killPath !== null) || playerIsWeak;

        // A) BOMBEN LEGEN (Offensive)
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = calculateBombScore(gx, gy, bot.range, isAggro, targetPlayer);
            // Im Aggro-Modus reicht 1 Punkt (Hauptsache Druck machen)
            const threshold = isAggro ? 1 : 15; 
            
            if (bombScore >= threshold) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Sofort wegrennen nach dem Legen
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                }
            }
        }

        // B) BEWEGUNG ZUM ZIEL
        if (targetDir.x === 0 && targetDir.y === 0) {
            
            // PRIO A: TÖTEN (Wenn Aggro aktiv)
            if (isAggro && killPath) {
                // Wir haben einen Weg zum Spieler -> Nimm ihn!
                // Keine Ablenkung durch Items.
                targetDir = killPath;
            }
            // PRIO B: GREEDY ITEMS (Nur wenn wir NICHT im Blutrausch sind oder keinen Weg zum Spieler finden)
            else {
                // Quick-Check: Liegt ein Item direkt nebenan?
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
                } else {
                    // Items suchen (weit)
                    let itemMove = findGoodItemMove(gx, gy, dangerMap);
                    if (itemMove) targetDir = itemMove;
                    
                    // Wenn keine Items da sind -> Versuch trotzdem zum Spieler zu kommen (Fallback)
                    else if (killPath) targetDir = killPath;
                }
            }

            // Fallback: Random Movement (Skull-Free)
            if (!targetDir.x && !targetDir.y) {
                 const safeNeighbors = DIRS.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    if (state.items[ny][nx] === ITEMS.SKULL) return false;
                    return !dangerMap[ny][nx]; 
                 });
                 if (safeNeighbors.length > 0) {
                    targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                 }
            }
        }

        // C) SKULL SCHUTZ (Überschreibt alles)
        if (targetDir.x !== 0 || targetDir.y !== 0) {
            const nx = gx + targetDir.x; const ny = gy + targetDir.y;
            if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb(); 
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                } else {
                    targetDir = {x:0, y:0}; 
                }
            }
        }

    } 
    // ----------------------------------------------------------------
    // 3. EASY/MEDIUM LOGIK
    // ----------------------------------------------------------------
    else {
        // ... (Original Code bleibt hier, sicherheitshalber gekürzt für Übersicht)
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

        if (targetDir.x === 0 && targetDir.y === 0) {
             if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE))) {
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

    // Ausführen
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