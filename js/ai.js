import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. GEFAHR-CHECK (Muss immer Vorrang haben)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    
    // Auf Hard prüfen wir öfter (jedes Frame), auf Easy seltener
    const reactionDelay = state.difficulty === DIFFICULTIES.HARD ? 0 : (state.difficulty === DIFFICULTIES.MEDIUM ? 10 : 30);
    
    if (bot.changeDirTimer > 0 && !amInDanger) {
        bot.changeDirTimer--;
        // Bewegung fortsetzen
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        return;
    }

    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT
        targetDir = findSafeMove(gx, gy, dangerMap);
        // Im Fluchtmodus: Timer kurz halten, um schnell auf neue Situationen zu reagieren
        bot.changeDirTimer = 2; 
    } else {
        // TAKTIK-MODUS
        let bestMove = null;
        let mode = 'IDLE';

        // --- ENTSCHEIDUNGS-MATRIX ---
        const nearestEnemy = findNearestPlayer(bot);
        // Distanz in Kacheln
        const distToEnemy = nearestEnemy ? Math.hypot(nearestEnemy.x - bot.x, nearestEnemy.y - bot.y) / TILE_SIZE : Infinity;
        
        // HARD: Immer Jagen, außer wir sind eingesperrt.
        if (state.difficulty === DIFFICULTIES.HARD) {
            mode = 'HUNT';
        } else if (state.difficulty === DIFFICULTIES.MEDIUM) {
            // Medium: Jagt nur, wenn Gegner nah (Sichtweite) oder Bot stark ist
            const isStrong = bot.activeBombs < bot.maxBombs && bot.bombRange > 1;
            mode = (distToEnemy < 6 || isStrong) ? 'HUNT' : 'FARM';
        } else {
            // Easy: Meistens Farmen oder Random
            mode = (Math.random() < 0.2) ? 'HUNT' : 'FARM';
        }

        // --- 1. HUNT LOGIC ---
        if (mode === 'HUNT' && nearestEnemy) {
            // Versuche Pfad zum Gegner zu finden
            bestMove = findPathToTarget(gx, gy, Math.round(nearestEnemy.x/TILE_SIZE), Math.round(nearestEnemy.y/TILE_SIZE), dangerMap);
            
            // Wenn kein Weg gefunden (z.B. eingemauert), dann fallback auf FARM (Wand sprengen)
            if (!bestMove) mode = 'FARM';
            else {
                // BOMBEN-LOGIK IM KAMPF
                if (bot.activeBombs < bot.maxBombs) {
                    // a) Gegner ist nah (Range-Check) und wir sind auf gleicher Linie?
                    const inRange = distToEnemy <= bot.bombRange;
                    const alignedX = Math.abs(nearestEnemy.x - bot.x) < TILE_SIZE/2;
                    const alignedY = Math.abs(nearestEnemy.y - bot.y) < TILE_SIZE/2;
                    
                    // b) Weg blockiert durch SoftWall?
                    const nextX = gx + bestMove.x; 
                    const nextY = gy + bestMove.y;
                    const blockedByWall = state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT;

                    // FEUER FREI?
                    // Auf Hard: Riskanter spielen. Legen, wenn Gegner nah ODER Weg blockiert.
                    if ((inRange && (alignedX || alignedY)) || blockedByWall || distToEnemy < 2) {
                        if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                            bot.plantBomb();
                            // Sofort Flucht berechnen!
                            bestMove = findSafeMove(gx, gy, getDangerMap()); 
                        }
                    }
                }
            }
        }

        // --- 2. FARM LOGIC (Fallback) ---
        if (mode === 'FARM' || !bestMove) {
            bestMove = findNearestLoot(gx, gy, dangerMap);
            
            if (bestMove) {
                const nextX = gx + bestMove.x; 
                const nextY = gy + bestMove.y;
                
                // Stehen wir vor einer Kiste?
                if (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT) {
                    if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        bestMove = findSafeMove(gx, gy, getDangerMap());
                    } else {
                        // Warten bis Bombe wieder da ist
                        bestMove = {x:0, y:0};
                    }
                }
            }
        }

        // --- 3. RANDOM ROAM (Notfall) ---
        if (!bestMove) {
            const safeNeighbors = DIRS.filter(d => {
                const nx = gx+d.x; const ny = gy+d.y;
                return !isSolid(nx, ny) && !dangerMap[ny][nx];
            });
            bestMove = safeNeighbors.length > 0 ? safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)] : {x:0, y:0};
        }

        targetDir = bestMove || {x:0, y:0};
        bot.changeDirTimer = reactionDelay;
    }

    // --- MOVEMENT EXECUTION ---
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
}

// --- PFADFINDUNG & LOGIK ---

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

// Pfadfinder: Ignoriert SoftWalls (will sie sprengen)
function findPathToTarget(sx, sy, tx, ty, dangerMap) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break; // Limit für Performance
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        // Optimierung: Auf Hard bewegen wir uns in Richtung Ziel zuerst
        // Wir sortieren die Nachbarn basierend auf Distanz zum Ziel
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => {
                const da = Math.abs(a.x - tx) + Math.abs(a.y - ty);
                const db = Math.abs(b.x - tx) + Math.abs(b.y - ty);
                return da - db;
            });

        for (let n of neighbors) {
            if (n.x >= 0 && n.x < GRID_W && n.y >= 0 && n.y < GRID_H) {
                if (visited.has(`${n.x},${n.y}`)) continue;
                
                // Hard Walls/Bomben sind Hindernisse. Gefahr auch.
                // Soft Walls sind KEINE Hindernisse für den Pathfinder (wir wollen ja hin um sie zu sprengen)
                const tile = state.grid[n.y][n.x];
                if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;

                visited.add(`${n.x},${n.y}`);
                queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
            }
        }
    }
    return null;
}

// Lootfinder (BFS)
function findNearestLoot(sx, sy, dangerMap) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 600) break;
        const curr = queue.shift();
        
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        // Ziel gefunden? (Item oder Softwall zum Sprengen)
        // Aber nicht Startposition
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstMove;
        }

        // Wenn Softwall, dann stoppen (können nicht durchlaufen)
        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue;

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
    
    // Feuer
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
    });

    // Bomben (Vorhersage der Explosion)
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
    
    // Level Hazards (Hellfire)
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

// Sicherer Move (Flucht)
function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    let ops = 0;
    while (queue.length > 0) {
        if (ops++ > 500) break;
        const current = queue.shift();
        
        // Sicher gefunden?
        if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
        if (current.dist > 15) continue; // Suchradius begrenzen

        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; 
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(`${nx},${ny}`)) {
                if (!isSolid(nx, ny)) { // Bei Flucht nur auf wirklich freie Felder
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    // Panik: Stehenbleiben ist meistens Tod, also lieber random laufen
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Simuliert: Wenn Bombe hier wäre, gibt es einen sicheren Nachbarn?
    // Achtung: Wir müssen die Bombe "virtuell" zur DangerMap hinzufügen für diesen Check
    // Einfachheitshalber prüfen wir nur, ob ein Nachbarfeld sicher UND frei ist.
    // Ein wirklich smarter Bot würde Rekursion nutzen, aber das frisst Performance.
    
    // Check: Gibt es einen freien Nachbarn, der NICHT gefährlich ist?
    const safeMoves = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return false;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    
    return safeMoves.length > 0;
}