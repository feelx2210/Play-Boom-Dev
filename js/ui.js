import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Prüfen, ob Bot "mittig" auf der Kachel steht (Toleranzbereich 4px)
    // Das verhindert das Zappeln zwischen Entscheidungen.
    const isAlignedX = Math.abs(bot.x - gx * TILE_SIZE) < 4;
    const isAlignedY = Math.abs(bot.y - gy * TILE_SIZE) < 4;
    const isAligned = isAlignedX && isAlignedY;

    // 1. GEFAHREN-CHECK (Überleben hat absolute Priorität!)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];

    // Wenn in Gefahr: SOFORT reagieren, egal wo wir stehen.
    if (amInDanger) {
        const safeDir = findSafeMove(gx, gy, dangerMap);
        
        // Richtung setzen
        bot.botDir = safeDir;
        if (safeDir.x !== 0) bot.lastDir = { x: Math.sign(safeDir.x), y: 0 };
        else if (safeDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(safeDir.y) };
        
        // Bewegen
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        return;
    }

    // Wenn wir NICHT in Gefahr sind und NICHT mittig stehen:
    // Lauf einfach weiter in die alte Richtung bis zur nächsten Kachel-Mitte.
    // Das eliminiert das "Zappeln".
    if (!isAligned && bot.botDir.x !== 0 || !isAligned && bot.botDir.y !== 0) {
        // Prüfen ob wir gegen eine Wand laufen würden, falls ja -> Stop
        const nextGx = gx + bot.botDir.x;
        const nextGy = gy + bot.botDir.y;
        if (isSolid(nextGx, nextGy)) {
            // Ausrichten erzwingen um nicht an Ecken hängen zu bleiben
            const targetX = gx * TILE_SIZE;
            const targetY = gy * TILE_SIZE;
            const dx = targetX - bot.x;
            const dy = targetY - bot.y;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                bot.move(Math.sign(dx)*bot.speed, Math.sign(dy)*bot.speed);
            }
        } else {
            bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        }
        return;
    }

    // --- ENTSCHEIDUNG TREFFEN (Nur wenn aligned und sicher) ---

    // Anti-Stacking: Steht ein anderer Bot auf mir?
    const stackingBot = state.players.find(p => p !== bot && p.alive && Math.abs(p.x - bot.x) < 5 && Math.abs(p.y - bot.y) < 5);
    if (stackingBot && bot.id > stackingBot.id) {
        // Warte kurz
        return; 
    }

    let targetDir = {x:0, y:0};
    
    // ZIEL: Menschen jagen (HARD) oder Nächsten (EASY/MID)
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    const isStrong = bot.maxBombs >= 2 && bot.bombRange >= 2;
    // Kann ich Gegner erreichen?
    const directPath = enemy ? findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false, bot.id) : null;
    
    let mode = 'IDLE';

    if (state.difficulty === DIFFICULTIES.HARD) {
        if (directPath) mode = 'HUNT';
        else if (isStrong) mode = 'BREACH'; // Tunnel graben
        else mode = 'FARM'; // Powerups holen
    } else {
        mode = (enemy && Math.hypot(enemy.x-bot.x, enemy.y-bot.y)/TILE_SIZE < 6) ? 'HUNT' : 'FARM';
    }

    let bestMove = null;

    // 1. HUNT
    if (mode === 'HUNT' && enemy) {
        bestMove = directPath;
        
        // Bomben-Check
        if (bot.activeBombs < bot.maxBombs) {
            const dist = Math.hypot(enemy.x-bot.x, enemy.y-bot.y)/TILE_SIZE;
            
            // Lege Bombe, wenn nah genug UND sicher
            // NEU: Strict Safety Check
            if (dist <= bot.bombRange && isSafeToPlant(gx, gy, dangerMap)) {
                 // Auf Hard legen wir auch Fallen (Random)
                 if (state.difficulty === DIFFICULTIES.HARD && Math.random() < 0.4) bot.plantBomb();
                 // Oder wenn wir direkt auf gleicher Höhe sind
                 else if ((Math.abs(enemy.x - bot.x) < 10 || Math.abs(enemy.y - bot.y) < 10)) bot.plantBomb();
            }
        }
    }

    // 2. BREACH (Durch Wände graben)
    if (mode === 'BREACH' && enemy) {
        bestMove = findPathToTarget(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true, bot.id);
        
        // Stehen wir vor einer Softwall?
        if (bestMove) {
            const nextX = gx + bestMove.x;
            const nextY = gy + bestMove.y;
            if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                if (bot.activeBombs < bot.maxBombs && isSafeToPlant(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // SOFORT: Fluchtweg berechnen und in diese Richtung starten (nicht warten!)
                    const escapeMove = findSafeMove(gx, gy, getDangerMap()); // DangerMap neu holen inkl. virtueller Bombe
                    targetDir = escapeMove;
                    bot.botDir = targetDir;
                    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
                    return;
                } else {
                    bestMove = {x:0, y:0}; // Warten (Sicherheitsabstand)
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
                if (bot.activeBombs < bot.maxBombs && isSafeToPlant(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    const escapeMove = findSafeMove(gx, gy, getDangerMap());
                    targetDir = escapeMove;
                    bot.botDir = targetDir;
                    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
                    return;
                } else {
                    bestMove = {x:0, y:0};
                }
            }
        }
    }

    // 4. IDLE / RANDOM
    if (!bestMove) {
        // Wenn ich sicher stehe, bleib stehen! Nicht zappeln.
        bestMove = {x:0, y:0}; 
        
        // Nur selten random laufen, wenn wirklich nichts zu tun ist
        if (Math.random() < 0.05) {
             const safeNeighbors = DIRS.filter(d => !isSolid(gx+d.x, gy+d.y) && !dangerMap[gy+d.y][gx+d.x] && !isOccupiedByBot(gx+d.x, gy+d.y, bot.id));
             if (safeNeighbors.length > 0) bestMove = safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)];
        }
    }

    targetDir = bestMove;

    // Bewegung ausführen
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    } else {
        // Explizit stehen bleiben (Snap to Grid)
        // Hilft beim "Ruhe bewahren"
        const dx = (gx * TILE_SIZE) - bot.x;
        const dy = (gy * TILE_SIZE) - bot.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
             bot.move(Math.sign(dx), Math.sign(dy)); // Langsam zentrieren
        }
    }
}

// --- INTELLIGENTE SAFETY CHECKS ---

// Prüft rekursiv, ob eine Bombe hier sicher wäre (Fluchtweg-Tiefe: 3 Schritte)
function isSafeToPlant(gx, gy, currentDangerMap) {
    // 1. Simuliere Bombe an aktueller Position
    // Wir tun so, als wäre das aktuelle Feld + Kreuz gefährlich
    const simulatedDanger = currentDangerMap.map(row => [...row]); // Deep copy
    simulatedDanger[gy][gx] = true; // Bombe selbst
    // Wir vereinfachen und markieren die Nachbarn als Gefahr (konservativ)
    DIRS.forEach(d => {
        if (gy+d.y >= 0 && gy+d.y < GRID_H && gx+d.x >= 0 && gx+d.x < GRID_W)
            simulatedDanger[gy+d.y][gx+d.x] = true;
    });

    // 2. Suche Fluchtweg (BFS)
    // Start bei einem sicheren Nachbarn. Wenn KEIN Nachbar sicher ist -> Nicht legen.
    const startNeighbors = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) return false;
        // Nachbar muss begehbar sein UND (aktuell) sicher
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });

    if (startNeighbors.length === 0) return false; // Sackgasse

    // 3. Prüfen, ob der Nachbar "Luft" hat (mindestens 2 weitere freie Felder erreichbar)
    // Das verhindert, dass er in eine 1-Feld-Sackgasse läuft
    for (let startNode of startNeighbors) {
        const sx = gx + startNode.x;
        const sy = gy + startNode.y;
        
        let freeTilesCount = 0;
        // Zähle freie Felder um den Startknoten (Tiefe 1)
        DIRS.forEach(d => {
            const nx = sx + d.x; const ny = sy + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (!isSolid(nx, ny) && !simulatedDanger[ny][nx]) freeTilesCount++;
            }
        });
        
        // Wenn wir in eine Richtung laufen können, wo es weiter geht -> OK
        if (freeTilesCount >= 1) return true;
    }

    return false; // Zu riskant
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

function isOccupiedByBot(gx, gy, selfId) {
    return state.players.some(p => p.id !== selfId && p.alive && Math.round(p.x / TILE_SIZE) === gx && Math.round(p.y / TILE_SIZE) === gy);
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
        
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x >= 0 && n.x < GRID_W && n.y >= 0 && n.y < GRID_H) {
                if (visited.has(`${n.x},${n.y}`)) continue;
                const tile = state.grid[n.y][n.x];
                if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;
                if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;
                if (isOccupiedByBot(n.x, n.y, selfId) && (n.x !== tx || n.y !== ty)) continue;
                visited.add(`${n.x},${n.y}`);
                queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
            }
        }
    }
    return null;
}

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
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) return curr.firstMove;
        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue; 
        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                const t = state.grid[ny][nx];
                if (t === TYPES.WALL_HARD || t === TYPES.BOMB || dangerMap[ny][nx]) continue;
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

// Sicherer Move (Flucht) - Sucht den nächsten SICHEREN Fleck
function findSafeMove(gx, gy, dangerMap) {
    // Wenn wir schon sicher stehen, bleib stehen!
    if (!dangerMap[gy][gx]) return {x:0, y:0};

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