import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // 1. STATE INITIALISIERUNG
    if (!bot.ai) {
        bot.ai = {
            state: 'DECIDING', 
            targetX: null, targetY: null,
            waitTimer: 0
        };
    }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // --- PRIORITY 1: ÜBERLEBEN (FLEEING) ---
    if (currentDanger > 0) {
        bot.ai.state = 'FLEEING';
        
        // Suche den allernächsten sicheren Fleck
        const safeTile = findSafeTileBFS(gx, gy, dangerMap);
        
        if (safeTile) {
            moveToPixel(bot, safeTile.x * TILE_SIZE, safeTile.y * TILE_SIZE);
        } else {
            moveRandomly(bot); // Panik
        }
        return; 
    }

    // Reset nach Flucht
    if (bot.ai.state === 'FLEEING' && currentDanger === 0) {
        snapToGrid(bot);
        bot.ai.state = 'DECIDING';
    }

    // --- PRIORITY 2: BEWEGUNG (MOVING) ---
    if (bot.ai.state === 'MOVING') {
        const tx = bot.ai.targetX;
        const ty = bot.ai.targetY;

        // Ziel-Validierung: Ist es noch sicher und frei?
        if (isSolid(tx, ty) || dangerMap[ty][tx] > 0) {
            bot.ai.state = 'DECIDING';
            return;
        }

        if (hasReachedGrid(bot, tx, ty)) {
            bot.x = tx * TILE_SIZE; 
            bot.y = ty * TILE_SIZE; 
            bot.ai.state = 'DECIDING';
        } else {
            moveToPixel(bot, tx * TILE_SIZE, ty * TILE_SIZE);
        }
        return;
    }

    // --- PRIORITY 3: ENTSCHEIDUNG (DECIDING) ---
    if (bot.ai.state === 'DECIDING') {
        if (bot.ai.waitTimer > 0) {
            bot.ai.waitTimer--;
            return;
        }

        // A) BOMBE LEGEN?
        if (bot.activeBombs < bot.maxBombs) {
            // HARD-Modus: Aggressiveres Bomben
            const aggressiveness = state.difficulty === DIFFICULTIES.HARD ? 0.8 : 0.4;
            
            if (shouldPlantBomb(bot, gx, gy, aggressiveness)) {
                // Sicherheits-Check: Simuliere Explosion
                if (canEscapeFromBomb(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    return; // Nächster Frame -> Flucht
                }
            }
        }

        // B) ZIEL SUCHEN
        const target = pickNextTarget(bot, gx, gy, dangerMap);
        
        if (target) {
            bot.ai.state = 'MOVING';
            bot.ai.targetX = target.x;
            bot.ai.targetY = target.y;
        } else {
            bot.ai.waitTimer = 5 + Math.random() * 10; // Kurze Pause
        }
    }
}

// ================= LOGIK FUNKTIONEN =================

function pickNextTarget(bot, gx, gy, dangerMap) {
    // 1. SITUATIONSANALYSE
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    
    // Auf Hard & Medium ist der Mensch das Hauptziel
    if (state.difficulty !== DIFFICULTIES.EASY && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    // Bin ich stark genug für den Kampf? (Loot-Phase vs. Kill-Phase)
    // Auf HARD wollen wir erst farmen, bis wir min. 2 Bomben oder 2 Range haben.
    const isStrong = (bot.maxBombs >= 2 || bot.bombRange >= 2);
    const forceHunt = (state.difficulty === DIFFICULTIES.HARD && isStrong);

    // 2. STRATEGIE WAHL
    let mode = 'FARM';
    let path = null;

    // A) JAGEN (HUNT)
    // Wenn wir stark sind (HARD) oder der Gegner nah ist (MEDIUM)
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const huntThreshold = (state.difficulty === DIFFICULTIES.HARD) ? 999 : 6; // Hard: Immer jagen (wenn strong)

        if ((forceHunt || dist < huntThreshold) && Math.random() < 0.8) {
            // Breach-Mode: Auf Hard dürfen wir Pfade durch Softwalls planen
            const canBreach = (state.difficulty === DIFFICULTIES.HARD);
            path = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
            if (path) mode = 'HUNT';
        }
    }

    // B) FARMEN (LOOT)
    // Wenn kein Jagd-Pfad gefunden wurde oder wir noch schwach sind
    if (!path) {
        path = findNearestLoot(gx, gy, dangerMap);
        mode = 'FARM';
    }

    // C) RANDOM (Notfall)
    if (!path) {
        const safeNeighbors = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
            .filter(n => !isSolid(n.x, n.y) && dangerMap[n.y][n.x] === 0);
        if (safeNeighbors.length > 0) return safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)];
    }

    return path;
}

function shouldPlantBomb(bot, gx, gy, aggressiveness) {
    // 1. Gegner Check
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        // Auf Hard legen wir auch auf Distanz, um Wege abzuschneiden
        const rangeCheck = (state.difficulty === DIFFICULTIES.HARD) ? bot.bombRange + 2 : bot.bombRange;
        
        if (dist <= rangeCheck && Math.random() < aggressiveness) {
            // Stehen wir auf einer Linie (X oder Y)?
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            // Toleranz für "auf einer Linie"
            if (dx < 1 || dy < 1) return true;
        }
    }

    // 2. Kisten Check (Farming)
    // Wenn eine Kiste direkt nebenan ist -> Sprengen
    return DIRS.some(d => {
        const ny = gy + d.y; const nx = gx + d.x;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });
}

// --- SICHERHEITS CHECK (ANTI-SUIZID) ---
function canEscapeFromBomb(gx, gy, currentDangerMap, range) {
    // 1. Virtuelle Explosion berechnen
    const virtualDanger = new Set();
    virtualDanger.add(`${gx},${gy}`);

    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; // Hardwall stoppt
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Softwall stoppt
        }
    });

    // 2. Fluchtweg suchen (BFS)
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([`${gx},${gy}`]);

    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 250) break;
        const curr = queue.shift();

        // Safe Spot gefunden?
        const key = `${curr.x},${curr.y}`;
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return true;
        }

        if (curr.dist > 6) continue;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Wir dürfen nicht in Wände oder existierende Gefahr (andere Bomben) laufen
            if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, dist:curr.dist+1});
            }
        }
    }
    return false;
}

// --- MOVEMENT HELPERS ---

function moveToPixel(bot, targetX, targetY) {
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.hypot(dx, dy);
    const moveSpeed = Math.min(dist, bot.speed);

    if (dist > 1) {
        const mx = (dx / dist) * moveSpeed;
        const my = (dy / dist) * moveSpeed;
        bot.move(mx, my);
        // Animation
        if (Math.abs(mx) > Math.abs(my)) bot.lastDir = {x: Math.sign(mx), y: 0};
        else bot.lastDir = {x: 0, y: Math.sign(my)};
    }
}

function snapToGrid(bot) {
    bot.x = Math.round(bot.x / TILE_SIZE) * TILE_SIZE;
    bot.y = Math.round(bot.y / TILE_SIZE) * TILE_SIZE;
}

function hasReachedGrid(bot, gx, gy) {
    const px = gx * TILE_SIZE;
    const py = gy * TILE_SIZE;
    return Math.abs(bot.x - px) <= 4 && Math.abs(bot.y - py) <= 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!isSolid(Math.round((bot.x + d.x*16)/TILE_SIZE), Math.round((bot.y + d.y*16)/TILE_SIZE))) {
        bot.move(d.x * bot.speed, d.y * bot.speed);
    }
}

function findNearestEnemy(bot) {
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

// --- PFADFINDUNG (A* / BFS) ---

function findSafeTileBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 300) break;
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (!isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny});
            }
        }
    }
    return null;
}

function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls) {
    const queue = [{x:sx, y:sy, firstStep:null}];
    const visited = new Set([`${sx},${sy}`]);
    let iterations = 0;

    while(queue.length > 0) {
        if (iterations++ > 500) break;
        const curr = queue.shift();

        if (curr.x === tx && curr.y === ty) return curr.firstStep;

        const neighbors = DIRS.map(d => ({x:curr.x+d.x, y:curr.y+d.y}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            const tile = state.grid[n.y] ? state.grid[n.y][n.x] : TYPES.WALL_HARD;
            let blocked = false;
            
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB) blocked = true;
            // Breach: Softwall ist erlaubt (wird weggesprengt)
            if (tile === TYPES.WALL_SOFT && !allowSoftWalls) blocked = true;
            if (dangerMap[n.y][n.x] > 0) blocked = true;

            if (!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, firstStep: curr.firstStep || {x:n.x, y:n.y}});
            }
        }
    }
    return null;
}

function findNearestLoot(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, firstStep:null}];
    const visited = new Set([`${gx},${gy}`]);
    let iterations = 0;

    while(queue.length > 0) {
        if (iterations++ > 400) break;
        const curr = queue.shift();

        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        // Loot gefunden (Softwall oder Item)
        if ((curr.x !== gx || curr.y !== gy) && (t === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstStep;
        }

        if (t === TYPES.WALL_SOFT) continue; // Durch Wände können wir nicht sehen

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, firstStep: curr.firstStep || {x:nx, y:ny}});
            }
        }
    }
    return null;
}

// BERECHNET GEFAHRENKARTE
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        // Effektive Range (Öl/Boost) berücksichtigen
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = state.grid[b.gy] && state.grid[b.gy][b.gx] === TYPES.OIL;
        const r = (isBoost || isOil) ? 15 : b.range;

        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isSolid(tx, ty, true)) break; 
                map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isSolid(tx,ty,true)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}