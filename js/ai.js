import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. GEFAHREN-CHECK (Überleben hat Priorität)
    const dangerMap = getDangerMap();
    if (dangerMap[gy][gx]) {
        const safeDir = findSafeMove(gx, gy, dangerMap);
        bot.botDir = safeDir;
        if (safeDir.x !== 0) bot.lastDir = { x: Math.sign(safeDir.x), y: 0 };
        else if (safeDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(safeDir.y) };
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        bot.changeDirTimer = 2;
        return;
    }

    // Reaktionszeit
    const reactionDelay = state.difficulty === DIFFICULTIES.HARD ? 0 : (state.difficulty === DIFFICULTIES.MEDIUM ? 10 : 30);
    
    if (bot.changeDirTimer > 0) {
        bot.changeDirTimer--;
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        return;
    }

    // --- ANTI-STACKING CHECK (Neu) ---
    // Wenn wir quasi "in" einem anderen Bot stehen, müssen wir uns trennen.
    const stackingBot = state.players.find(p => p !== bot && p.alive && Math.abs(p.x - bot.x) < 10 && Math.abs(p.y - bot.y) < 10);
    if (stackingBot) {
        // Der Bot mit der höheren ID weicht aus / wartet kurz
        if (bot.id > stackingBot.id) {
            bot.changeDirTimer = 10;
            // Versuch, in eine zufällige Richtung wegzugehen
            const escape = DIRS[Math.floor(Math.random()*DIRS.length)];
            if (!isSolid(gx+escape.x, gy+escape.y)) {
                bot.move(escape.x * bot.speed, escape.y * bot.speed);
                return;
            }
        }
    }

    // --- TAKTISCHE ENTSCHEIDUNG ---
    
    let targetDir = {x:0, y:0};
    
    // ZIEL-AUSWAHL
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    
    if (state.difficulty === DIFFICULTIES.HARD && human) {
        enemy = human; // Fokus auf Mensch
    } else {
        enemy = findNearestEnemy(bot); // Jeder gegen Jeden
    }

    const isStrong = bot.maxBombs >= 2 && bot.bombRange >= 2;
    const distToEnemy = enemy ? Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE : Infinity;
    
    // Pfad berechnen (unter Berücksichtigung anderer Bots als Hindernis!)
    const directPath = enemy ? findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false, bot.id) : null;
    
    let mode = 'IDLE';

    if (state.difficulty === DIFFICULTIES.HARD) {
        if (directPath) mode = 'HUNT';
        else if (isStrong) mode = 'BREACH';
        else mode = 'FARM';
    } else {
        mode = (distToEnemy < 6 || isStrong) ? 'HUNT' : 'FARM';
        if (state.difficulty === DIFFICULTIES.EASY && Math.random() < 0.3) mode = 'RANDOM';
    }

    // --- AUSFÜHRUNG ---

    let bestMove = null;

    // 1. HUNT
    if (mode === 'HUNT' && enemy) {
        bestMove = directPath; 
        
        if (bot.activeBombs < bot.maxBombs) {
            if (distToEnemy <= bot.bombRange && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                 if (state.difficulty === DIFFICULTIES.HARD && Math.random() < 0.3) bot.plantBomb();
                 else if ((Math.abs(enemy.x - bot.x) < TILE_SIZE || Math.abs(enemy.y - bot.y) < TILE_SIZE)) bot.plantBomb();
            }
        }
    }

    // 2. BREACH
    if (mode === 'BREACH' && enemy) {
        bestMove = findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true, bot.id);
        if (bestMove) {
            const nextX = gx + bestMove.x;
            const nextY = gy + bestMove.y;
            if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    bestMove = findSafeMove(gx, gy, getDangerMap()); 
                } else {
                    bestMove = {x:0, y:0};
                }
            }
        }
    }

    // 3. FARM
    if (mode === 'FARM' || (mode === 'BREACH' && !bestMove)) {
        bestMove = findNearestLoot(gx, gy, dangerMap, bot.id);
        if (bestMove) {
            const nextX = gx + bestMove.x;
            const nextY = gy + bestMove.y;
            if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    bestMove = findSafeMove(gx, gy, getDangerMap());
                } else {
                    bestMove = {x:0, y:0};
                }
            }
        }
    }

    // 4. RANDOM
    if (!bestMove) {
        const safeNeighbors = DIRS.filter(d => !isSolid(gx+d.x, gy+d.y) && !dangerMap[gy+d.y][gx+d.x] && !isOccupiedByBot(gx+d.x, gy+d.y, bot.id));
        bestMove = safeNeighbors.length > 0 ? safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)] : {x:0, y:0};
    }

    targetDir = bestMove || {x:0, y:0};
    bot.changeDirTimer = reactionDelay;

    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
}

// --- HELPER FUNKTIONEN ---

function isOccupiedByBot(gx, gy, selfId) {
    return state.players.some(p => p.id !== selfId && p.alive && Math.round(p.x / TILE_SIZE) === gx && Math.round(p.y / TILE_SIZE) === gy);
}

function findNearestEnemy(bot) {
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x - bot.x)**2 + (p.y - bot.y)**2;
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

// Pfadsuche mit Bot-Vermeidung
function findPathToTarget(sx, sy, tx, ty, dangerMap, allowSoftWalls, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        // Sortieren (A* light)
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x >= 0 && n.x < GRID_W && n.y >= 0 && n.y < GRID_H) {
                if (visited.has(`${n.x},${n.y}`)) continue;
                
                const tile = state.grid[n.y][n.x];
                if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;
                if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;

                // NEU: Betrachte andere Bots als Hindernis (außer es ist das Ziel selbst)
                if (isOccupiedByBot(n.x, n.y, selfId) && (n.x !== tx || n.y !== ty)) continue;

                visited.add(`${n.x},${n.y}`);
                queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
            }
        }
    }
    return null;
}

// Lootfinder mit Bot-Vermeidung
function findNearestLoot(sx, sy, dangerMap, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 500) break;
        const curr = queue.shift();
        
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstMove;
        }

        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                const t = state.grid[ny][nx];
                if (t === TYPES.WALL_HARD || t === TYPES.BOMB || dangerMap[ny][nx]) continue;
                
                // NEU: Bot-Vermeidung beim Looten
                if (isOccupiedByBot(nx, ny, selfId)) continue;
                
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    return null;
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
        if (current.dist > 15) continue;

        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; 
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(`${nx},${ny}`)) {
                if (!isSolid(nx, ny)) { 
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    const safeMoves = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return false;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return safeMoves.length > 0;
}