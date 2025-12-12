import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. Gefahr erkennen (Höchste Priorität)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT: Weg von der Gefahr
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        // --- TAKTIK ---
        // Reaktionstimer: Bots "denken" nicht jeden Frame (außer auf Hard)
        const reactionDelay = state.difficulty === DIFFICULTIES.HARD ? 4 : (state.difficulty === DIFFICULTIES.MEDIUM ? 15 : 30);
        
        if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x * 20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y * 20)/TILE_SIZE))) {
            
            let bestMove = null;
            let mode = 'IDLE';

            // ENTSCHEIDUNG: LOOTEN ODER JAGEN?
            // Auf HARD: Erst Looten, dann Killen.
            // Bot fühlt sich "stark", wenn er > 1 Bombe und > 1 Range hat.
            const isStrong = bot.maxBombs >= 2 && bot.bombRange >= 2;
            const nearestEnemy = findNearestPlayer(bot);
            const distToEnemy = nearestEnemy ? Math.hypot(nearestEnemy.x - bot.x, nearestEnemy.y - bot.y) / TILE_SIZE : Infinity;

            // Zwingender Angriff, wenn Gegner extrem nah ist (Selbstverteidigung)
            const mustDefend = distToEnemy < 3; 

            if (state.difficulty === DIFFICULTIES.HARD) {
                if (mustDefend || isStrong) mode = 'HUNT';
                else mode = 'FARM';
            } else if (state.difficulty === DIFFICULTIES.MEDIUM) {
                // Medium Bots farmen meistens, jagen nur wenn zufällig nah
                mode = (Math.random() < 0.3) ? 'HUNT' : 'FARM';
            } else {
                mode = 'RANDOM';
            }

            // --- AUSFÜHRUNG ---

            // 1. HUNT MODE
            if (mode === 'HUNT' && nearestEnemy) {
                // Pfad zum Gegner suchen (auch durch weiche Wände)
                bestMove = findPathToTarget(gx, gy, Math.round(nearestEnemy.x/TILE_SIZE), Math.round(nearestEnemy.y/TILE_SIZE), dangerMap);
                
                // Aggressives Bombenlegen, wenn wir nah sind oder blockiert
                if (bot.activeBombs < bot.maxBombs) {
                    // Stehen wir vor einer Wand/Box auf dem Weg zum Ziel?
                    const nextX = gx + (bestMove ? bestMove.x : 0);
                    const nextY = gy + (bestMove ? bestMove.y : 0);
                    const blockedBySoftWall = (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT);
                    
                    if ((distToEnemy < 4 || blockedBySoftWall) && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        // Nach dem Legen sofort neuen Fluchtweg suchen
                        bestMove = findSafeMove(gx, gy, getDangerMap()); 
                    }
                }
            }

            // 2. FARM MODE (Fallback, falls kein Weg zum Gegner oder noch zu schwach)
            if (mode === 'FARM' || (mode === 'HUNT' && !bestMove)) {
                // Suche nächste Box oder Item (BFS über ganze Map)
                bestMove = findNearestLoot(gx, gy, dangerMap);

                // Wenn der Move in eine Soft-Wall führt -> Bombe legen
                const nextX = gx + (bestMove ? bestMove.x : 0);
                const nextY = gy + (bestMove ? bestMove.y : 0);
                
                if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                    if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        bestMove = findSafeMove(gx, gy, getDangerMap());
                    } else {
                        // Warten (nicht in die Wand laufen)
                        bestMove = {x:0, y:0};
                    }
                }
            }

            // 3. RANDOM / IDLE (Wenn gar nichts gefunden wurde)
            if (!bestMove) {
                // Laufe einfach irgendwohin, wo es sicher ist, statt stehenzubleiben
                const safeNeighbors = DIRS.filter(d => {
                     const nx = gx+d.x; const ny = gy+d.y;
                     return !isSolid(nx, ny) && !dangerMap[ny][nx];
                });
                if (safeNeighbors.length > 0) bestMove = safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)];
                else bestMove = {x:0, y:0};
            }

            targetDir = bestMove;
            bot.changeDirTimer = reactionDelay + Math.random() * 5;
        } else {
            targetDir = bot.botDir || {x:0, y:0};
        }
    }

    // Bewegung anwenden
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

// --- HELPERS ---

function findNearestPlayer(bot) {
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x - bot.x)**2 + (p.y - bot.y)**2;
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

// Sucht den Weg zu einer Zielkoordinate. Ignoriert SoftWalls als Hindernis (plant Weg hindurch).
function findPathToTarget(sx, sy, tx, ty, dangerMap) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                
                // Hard Walls und Gefahren sind tabu
                if (state.grid[ny][nx] === TYPES.WALL_HARD || state.grid[ny][nx] === TYPES.BOMB || dangerMap[ny][nx]) continue;

                visited.add(`${nx},${ny}`);
                // Soft Walls sind begehbar im Sinne der Pfadfindung (wir wollen sie ja sprengen)
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    return null;
}

// BFS Suche nach der NÄCHSTEN Kiste oder dem nächsten Item
function findNearestLoot(sx, sy, dangerMap) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 500) break;
        const curr = queue.shift();
        
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        // Haben wir Loot oder eine Kiste gefunden?
        // WICHTIG: Wenn es eine Kiste ist, muss sie das Ziel sein, nicht der Startpunkt.
        if ((tile === TYPES.WALL_SOFT || item !== ITEMS.NONE) && (curr.x !== sx || curr.y !== sy)) {
            return curr.firstMove;
        }

        // Wenn wir auf einer Kiste stehen (im Geiste der Pfadfindung), können wir nicht weiter hindurch gehen,
        // sondern sind am Ziel angekommen.
        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                
                // Nur begehbare Felder oder Softwalls betreten
                // Hard Walls, Bomben und Gefahr vermeiden
                if (state.grid[ny][nx] === TYPES.WALL_HARD || state.grid[ny][nx] === TYPES.BOMB || dangerMap[ny][nx]) continue;

                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    return null; // Nichts gefunden
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
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
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        // ... (Hellfire Radius Logic - kurzgefasst, da identisch zu vorher)
        const range = 5; 
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
    visited.add(`${gx},${gy}`);
    let ops = 0;
    while (queue.length > 0) {
        if (ops++ > 500) break;
        const current = queue.shift();
        if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
        if (current.dist > 12) continue;

        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; 
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(`${nx},${ny}`)) {
                if (!isSolid(nx, ny)) { // Flucht nur auf freie Felder
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    const safeNeighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return false;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return safeNeighbors.length > 0;
}