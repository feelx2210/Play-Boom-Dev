import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. GEFAHREN-CHECK (Überleben hat immer Priorität)
    const dangerMap = getDangerMap();
    if (dangerMap[gy][gx]) {
        // FLUCHT
        const safeDir = findSafeMove(gx, gy, dangerMap);
        bot.botDir = safeDir;
        if (safeDir.x !== 0) bot.lastDir = { x: Math.sign(safeDir.x), y: 0 };
        else if (safeDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(safeDir.y) };
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        bot.changeDirTimer = 2; // Schnell reagieren
        return;
    }

    // Reaktionszeit simulieren (0 auf Hard = Frame Perfect)
    const reactionDelay = state.difficulty === DIFFICULTIES.HARD ? 0 : (state.difficulty === DIFFICULTIES.MEDIUM ? 10 : 30);
    
    if (bot.changeDirTimer > 0) {
        bot.changeDirTimer--;
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        return;
    }

    // --- TAKTISCHE ENTSCHEIDUNG ---
    
    let targetDir = {x:0, y:0};
    
    // ZIEL-AUSWAHL: Auf Hard ist der Mensch (P1) das primäre Ziel ("Teamwork")
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    
    if (state.difficulty === DIFFICULTIES.HARD && human) {
        enemy = human; // Alle Bots gegen Einen
    } else {
        enemy = findNearestEnemy(bot); // Jeder gegen Jeden
    }

    // STATUS-ANALYSE
    const isStrong = bot.maxBombs >= 2 && bot.bombRange >= 2;
    const distToEnemy = enemy ? Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE : Infinity;
    
    // Kann ich den Gegner direkt erreichen? (Pfad ohne Softwalls)
    // Wenn 'path' null ist, ist der Weg blockiert -> Wir müssen graben!
    const directPath = enemy ? findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false) : null;
    
    let mode = 'IDLE';

    // MODUS-WAHL
    if (state.difficulty === DIFFICULTIES.HARD) {
        if (directPath) {
            // Weg ist frei -> ANGRIFF!
            mode = 'HUNT';
        } else if (isStrong) {
            // Stark, aber Weg versperrt -> DURCHBRECHEN (Tunnel graben)
            mode = 'BREACH';
        } else {
            // Schwach -> FARMEN & STÄRKER WERDEN
            mode = 'FARM';
        }
    } else {
        // Medium/Easy Logik (Simplere Zustände)
        mode = (distToEnemy < 6 || isStrong) ? 'HUNT' : 'FARM';
        if (state.difficulty === DIFFICULTIES.EASY && Math.random() < 0.3) mode = 'RANDOM';
    }

    // --- AUSFÜHRUNG ---

    let bestMove = null;

    // 1. HUNT (Direkter Angriff)
    if (mode === 'HUNT' && enemy) {
        bestMove = directPath; // Pfad ist ja schon berechnet
        
        // Bomben-Logik im Nahkampf
        if (bot.activeBombs < bot.maxBombs) {
            // Lege Bombe wenn Gegner nah ist oder wir ihn einkesseln wollen
            if (distToEnemy <= bot.bombRange && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                 // Auf Hard: Vorhersage-Bomben (Lauer-Taktik) - 30% Chance
                 if (state.difficulty === DIFFICULTIES.HARD && Math.random() < 0.3) bot.plantBomb();
                 // Oder direkte Treffer
                 else if ((Math.abs(enemy.x - bot.x) < TILE_SIZE || Math.abs(enemy.y - bot.y) < TILE_SIZE)) bot.plantBomb();
            }
        }
    }

    // 2. BREACH (Weg zum Gegner freisprengen)
    if (mode === 'BREACH' && enemy) {
        // Suche Pfad zum Gegner, der auch durch Softwalls geht
        bestMove = findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true);
        
        // Wenn der nächste Schritt in eine Wand führt -> SPRENGEN
        if (bestMove) {
            const nextX = gx + bestMove.x;
            const nextY = gy + bestMove.y;
            if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Weglaufen!
                    bestMove = findSafeMove(gx, gy, getDangerMap()); 
                } else {
                    bestMove = {x:0, y:0}; // Warten
                }
            }
        }
    }

    // 3. FARM (Loot suchen und Wände sprengen)
    if (mode === 'FARM' || (mode === 'BREACH' && !bestMove)) {
        // BFS zur nächsten Kiste/Item
        bestMove = findNearestLoot(gx, gy, dangerMap);
        
        if (bestMove) {
            const nextX = gx + bestMove.x;
            const nextY = gy + bestMove.y;
            // Wenn Kiste im Weg -> Sprengen
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

    // 4. RANDOM (Notfall)
    if (!bestMove) {
        const safeNeighbors = DIRS.filter(d => !isSolid(gx+d.x, gy+d.y) && !dangerMap[gy+d.y][gx+d.x]);
        bestMove = safeNeighbors.length > 0 ? safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)] : {x:0, y:0};
    }

    targetDir = bestMove || {x:0, y:0};
    bot.changeDirTimer = reactionDelay;

    // Movement anwenden
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
}


// --- HELPER FUNKTIONEN ---

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

// Pfadsuche A* / BFS
// allowSoftWalls: Wenn true, werden Softwalls als "begehbar" (bzw. zerstörbar) angesehen -> Für BREACH Modus
function findPathToTarget(sx, sy, tx, ty, dangerMap, allowSoftWalls) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        // Sortieren für A*-ähnliches Verhalten (Greedy Best-First)
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x >= 0 && n.x < GRID_W && n.y >= 0 && n.y < GRID_H) {
                if (visited.has(`${n.x},${n.y}`)) continue;
                
                const tile = state.grid[n.y][n.x];
                // Hard Walls und Gefahren sind immer tabu
                if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;

                // Soft Walls sind nur erlaubt, wenn wir "graben" wollen
                if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;

                visited.add(`${n.x},${n.y}`);
                queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
            }
        }
    }
    return null;
}

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
        
        // Gefunden?
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstMove;
        }

        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue; // Nicht durchlaufen

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                const t = state.grid[ny][nx];
                if (t === TYPES.WALL_HARD || t === TYPES.BOMB || dangerMap[ny][nx]) continue;
                
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    return null;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // Aktive Explosionen
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
    });

    // Bomben-Explosionsradius
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        map[b.gy][b.gx] = true; // Bombe selbst
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
    
    // Level Gefahren
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
    // Einfacher Check: Gibt es mindestens einen freien, sicheren Nachbarn?
    const safeMoves = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return false;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return safeMoves.length > 0;
}