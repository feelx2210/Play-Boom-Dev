import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

// Konstanten für Richtungen
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Berechnet einen "Wert" für eine Bombenplatzierung: Anzahl der Soft Walls und
 * Skulls, die mit der Bombe in Reichweite zerstört werden können.
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
                break; 
            }
            
            // Regel 7: Skull-Items wegsprengen - sehr hohe Priorität
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 100; 
                 break; 
            }
            
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    return score;
}

/**
 * Führt eine Breitensuche (BFS) durch, um den besten ersten Zug zu einem guten Item zu finden.
 * Schädliche Items (ITEMS.SKULL) werden ignoriert und blockieren den Weg.
 */
function findGoodItemMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        // Gutes Item gefunden
        if (state.items[current.y][current.x] !== ITEMS.NONE && state.items[current.y][current.x] !== ITEMS.SKULL) {
            return current.firstMove || {x: 0, y: 0};
        }
        
        if (current.dist > 15) continue; 
        
        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Skulls blockieren den Weg (wenn nicht Flucht)
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL) {
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
 * Skulls blockieren den Weg.
 */
function findPlayerMove(gx, gy, dangerMap) {
    const targetPlayer = state.players.find(p => p.isHuman); 
    if (!targetPlayer || targetPlayer.isDead) return null;

    const targetGx = Math.round(targetPlayer.x / TILE_SIZE);
    const targetGy = Math.round(targetPlayer.y / TILE_SIZE);

    const distToPlayer = Math.abs(gx - targetGx) + Math.abs(gy - targetGy);

    // KILLER-LOGIK (Regel 6): Wenn direkt daneben (Distanz 1), Bombe legen!
    if (distToPlayer <= 1) {
        return {x: 0, y: 0, isBombSpot: true}; 
    }
    
    // Pathfinding zum Player
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.dist > 20) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Skulls als Pfad-Blocker behandeln
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL) {
                    visited.add(key);
                    const isTarget = (Math.abs(nx - targetGx) + Math.abs(ny - targetGy) <= 1);
                    
                    if (isTarget) {
                        return current.firstMove || d;
                    }
                    
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

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const isHardMode = bot.difficulty === DIFFICULTIES.HARD;
    
    // 1. Gefahr erkennen (Oberste Priorität: Überleben)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT-MODUS (Regel 1)
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        // ANGRIFFS-MODUS
        
        if (isHardMode) {
            // --- HARD-MODE LOGIK ---
            
            const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
            let distToPlayer = 999;
            if (targetPlayer) {
                const tgx = Math.round(targetPlayer.x / TILE_SIZE);
                const tgy = Math.round(targetPlayer.y / TILE_SIZE);
                distToPlayer = Math.abs(gx - tgx) + Math.abs(gy - tgy);
            }

            // ENTSCHEIDUNG: AGGRO ODER ITEMS?
            const AGGRO_RANGE = 4;
            let bestMove = null;

            // 1. **SOFORTIGER KILL** (Regel 6) oder **ITEMS SAMMELN** (Regel 2)
            if (targetPlayer && distToPlayer <= AGGRO_RANGE) {
                // Spieler ist nah: Fokussiere auf Töten.
                bestMove = findPlayerMove(gx, gy, dangerMap);
            } 
            
            // Wenn kein Angriffszug gefunden (oder Spieler weit weg), dann Items suchen
            if (!bestMove || (!bestMove.x && !bestMove.y && !bestMove.shouldPlant && !bestMove.isBombSpot)) {
                 const itemMove = findGoodItemMove(gx, gy, dangerMap);
                 if (itemMove) {
                     targetDir = itemMove;
                 } else {
                     // Wenn keine Items, dann Spieler suchen (auch wenn weit weg)
                     if (!bestMove) bestMove = findPlayerMove(gx, gy, dangerMap);
                 }
            }

            // 2. Auswertung des bestMove (Angriff/Jagd/strategisches Bomben)
            if (!targetDir.x && !targetDir.y && bestMove) {
                if (bestMove.isBombSpot || bestMove.shouldPlant) {
                    // Wir stehen gut (z.B. neben dem Spieler) -> BOMBEN!
                    if (bot.activeBombs < bot.maxBombs) {
                        if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                            bot.plantBomb();
                            targetDir = findSafeMove(gx, gy, getDangerMap());
                        } else {
                            targetDir = {x:0, y:0};
                        }
                    }
                } else {
                    targetDir = bestMove;
                }
            }

            // 3. Strategische Bomben (Farming/Skulls sprengen), falls wir sonst nichts tun
            if (!targetDir.x && !targetDir.y && bot.activeBombs < bot.maxBombs) {
                const wallScore = calculateWallScore(gx, gy, bot.range);
                if (wallScore > 0 && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                     bot.plantBomb();
                     targetDir = findSafeMove(gx, gy, getDangerMap());
                }
            }
            
            // 4. ***ULTIMATIVE SKULL-VERMEIDUNG (Regel 7)***
            // Wenn der Bot im Angriffs-Modus eine Bewegung plant, die ihn auf einen Skull führt:
            if (!amInDanger && (targetDir.x !== 0 || targetDir.y !== 0)) {
                const nextGx = gx + targetDir.x;
                const nextGy = gy + targetDir.y;
                
                if (state.items[nextGy] && state.items[nextGy][nextGx] === ITEMS.SKULL) {
                    
                    // Höchste Priorität: Skull wegsprengen, statt ihn aufzuheben
                    if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        // Bombe gelegt, jetzt Fluchtweg suchen (Regel 1)
                        targetDir = findSafeMove(gx, gy, getDangerMap()); 
                    } else {
                        // KANN NICHT BOMBEN ODER NICHT FLÜCHTEN: Bewegung muss ABGEBROCHEN werden.
                        targetDir = {x:0, y:0}; 
                        // Wichtig: Timer zurücksetzen, damit im nächsten Frame eine neue, sichere Random-Richtung gesucht wird.
                        bot.changeDirTimer = 0; // STRIKTES RESET, ZWENGEN ZU NEUEM WEG!
                    }
                }
            }
            // 5. Fallback: Random Movement (Skull-frei)
            if (!targetDir.x && !targetDir.y) {
                 const safeNeighbors = DIRS.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    // Skull vermeiden!
                    if (state.items[ny][nx] === ITEMS.SKULL) return false;
                    return !dangerMap[ny][nx]; 
                 });
                 if (safeNeighbors.length > 0) {
                    targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                 } else {
                     targetDir = {x:0, y:0};
                 }
                 bot.changeDirTimer = 15 + Math.random() * 30;
            }

        } else { 
            // --- MEDIUM/EASY LOGIK ---
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
                const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
                const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
                
                if (bot.changeDirTimer <= 0 || isSolid(nextX, nextY)) {
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx]; 
                    });
                    
                    if (safeNeighbors.length > 0) {
                        const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else {
                        targetDir = {x:0, y:0}; 
                    }
                    bot.changeDirTimer = 15 + Math.random() * 30;
                } else {
                    targetDir = bot.botDir || {x:0, y:0}; 
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

// Breitensuche zum nächsten sicheren Feld (Nur für die Flucht)
function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break; 
        const current = queue.shift();
        if (!dangerMap[current.y][current.x]) {
            return current.firstMove || {x:0, y:0}; 
        }
        if (current.dist > 12) continue; 
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
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}