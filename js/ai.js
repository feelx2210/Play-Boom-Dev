import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globales Gedächtnis für Bots
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { 
            state: 'IDLE',      // IDLE, MOVING, FLEEING
            target: null,       // {x, y} Pixel-Koordinaten
            gridTarget: null,   // {x, y} Grid-Koordinaten (Wichtig für Fokus!)
            lockedPath: null,   // Pfad für Flucht
            patience: 0
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    const dangerMap = getDangerMap(); 
    const currentDanger = dangerMap[gy][gx];

    // =========================================================
    // 1. ÜBERLEBEN (PRIORITÄT: HOCH)
    // =========================================================
    // Wenn wir in Gefahr sind oder fliehen müssen -> Alles andere egal
    if (currentDanger > 0 || mem.state === 'FLEEING') {
        mem.state = 'FLEEING';
        mem.target = null;
        mem.gridTarget = null; // Altes Ziel vergessen

        // Sind wir sicher?
        if (currentDanger === 0 && (!mem.lockedPath || mem.lockedPath.length === 0)) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            return;
        }

        // Brauchen wir einen Fluchtweg?
        if (!mem.lockedPath || mem.lockedPath.length === 0) {
            const escapePath = findEscapePathBFS(gx, gy, dangerMap);
            if (escapePath && escapePath.length > 0) {
                mem.lockedPath = escapePath;
            } else {
                moveRandomly(bot); // Panik
                return;
            }
        }

        // Pfad ablaufen
        if (mem.lockedPath.length > 0) {
            const nextStep = mem.lockedPath[0];
            if (hasReachedPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE)) {
                mem.lockedPath.shift();
            } else {
                moveToPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
            }
        }
        return;
    }

    // =========================================================
    // 2. BEWEGUNG (PRIORITÄT: MITTEL)
    // =========================================================
    // Wenn wir ein Ziel haben, bleiben wir dabei! (Verhindert Zittern)
    if (mem.state === 'MOVING' && mem.gridTarget) {
        const tx = mem.gridTarget.x;
        const ty = mem.gridTarget.y;

        // Validierung: Ist der Weg/Ziel plötzlich tödlich oder blockiert?
        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
            mem.state = 'IDLE'; // Abbruch
            mem.gridTarget = null;
        } 
        // Angekommen?
        else if (gx === tx && gy === ty && hasReachedPixel(bot, tx * TILE_SIZE, ty * TILE_SIZE)) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            mem.gridTarget = null;
        } 
        else {
            // Weiterlaufen! Nicht neu entscheiden!
            moveToPixel(bot, tx * TILE_SIZE, ty * TILE_SIZE);
            return;
        }
    }

    // =========================================================
    // 3. ENTSCHEIDUNG (PRIORITÄT: NIEDRIG - Nur wenn IDLE)
    // =========================================================
    if (mem.state === 'IDLE') {
        
        // Settings je nach Difficulty
        const isHard = state.difficulty === DIFFICULTIES.HARD;
        const isMedium = state.difficulty === DIFFICULTIES.MEDIUM;
        const isEasy = state.difficulty === DIFFICULTIES.EASY;

        // A) BOMBEN CHECK
        // Auf Easy: Selten (20%), Medium: Oft (60%), Hard: Immer wenn sinnvoll
        const plantChance = isHard ? 1.0 : (isMedium ? 0.6 : 0.2);
        
        if (bot.activeBombs < bot.maxBombs && Math.random() < plantChance) {
            const bombDecision = analyzePosition(bot, gx, gy, isHard);
            
            if (bombDecision.shouldPlant) {
                // Safety Check: Können wir danach fliehen?
                const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
                const escapePath = simulateBombAndFindEscape(gx, gy, dangerMap, realRange);

                if (escapePath) {
                    bot.plantBomb();
                    mem.state = 'FLEEING';
                    mem.lockedPath = escapePath;
                    
                    // Sofort loslaufen
                    if (escapePath.length > 0) {
                        const first = escapePath[0];
                        moveToPixel(bot, first.x * TILE_SIZE, first.y * TILE_SIZE);
                    }
                    return;
                }
            }
        }

        // B) ZIEL SUCHE
        const target = pickNextTarget(bot, gx, gy, dangerMap, isHard, isMedium);
        
        if (target) {
            mem.state = 'MOVING';
            mem.gridTarget = target; // Wir merken uns das Grid-Ziel -> Fester Fokus!
            moveToPixel(bot, target.x * TILE_SIZE, target.y * TILE_SIZE);
        } else {
            // Wenn gar nichts zu tun ist: Random Walk, damit er nicht einfriert
            if (Math.random() < 0.2) moveRandomly(bot);
        }
    }
}

// ==========================================
//              LOGIK KERNE
// ==========================================

function analyzePosition(bot, gx, gy, isHard) {
    // 0. SAFETY: Nicht legen, wenn wir ein PowerUp zerstören würden!
    if (willDestroyPowerUp(gx, gy, bot.bombRange)) return { shouldPlant: false };

    // 1. GEGNER (Kill)
    const enemy = findTargetEnemy(bot, isHard);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const range = isHard ? bot.bombRange + 3 : bot.bombRange;
        
        if (dist <= range) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            // In Schusslinie?
            if (dx < 1 || dy < 1) {
                // Friendly Fire Check auf Hard
                if (isHard && isTeammateInFireline(gx, gy, bot.bombRange, bot.id)) return { shouldPlant: false };
                return { shouldPlant: true };
            }
        }
    }

    // 2. KISTEN (Farm)
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    if (wallsHit > 0) {
        // Auf Hard nur legen, wenn es sich lohnt (>= 2 Kisten) oder keine bessere Option nah ist
        if (isHard && wallsHit === 1) {
            // Prüfe kurz die Nachbarn: Gibt es einen 2er Spot?
            const bestNeighbor = getBestNeighborSpot(gx, gy, bot.bombRange);
            if (bestNeighbor > 1) return { shouldPlant: false }; // Warte und geh zum besseren Spot
        }
        return { shouldPlant: true };
    }

    return { shouldPlant: false };
}

function pickNextTarget(bot, gx, gy, dangerMap, isHard, isMedium) {
    // 1. ITEMS (Sammeln hat Prio, wenn sicher)
    const itemTarget = findNearestItemBFS(gx, gy, dangerMap, 8);
    if (itemTarget) return itemTarget;

    // 2. SWEET SPOTS (Hard Only: Suche Positionen für Multikills/Multifarm)
    if (isHard) {
        const sweetSpot = findMultiWallSpot(gx, gy, dangerMap, bot.bombRange);
        if (sweetSpot) return sweetSpot; // Geh zum perfekten Bombenplatz
    }

    // 3. GEGNER JAGEN (Hard & Medium)
    const enemy = findTargetEnemy(bot, isHard);
    if (enemy && (isHard || (isMedium && Math.random() < 0.5))) {
        // Auf Hard: Breach Mode (Durch Wände rechnen)
        const canBreach = isHard && bot.maxBombs >= 1; 
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        
        if (pathStep) {
            // Wenn der nächste Schritt eine Kiste ist -> Davor stehen bleiben (damit Bomb-Check greift)
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null;
            return pathStep;
        }
    }

    // 4. FARMEN (Kisten suchen)
    const lootTarget = findNearestLootBFS(gx, gy, dangerMap);
    if (lootTarget) {
        if (state.grid[lootTarget.y][lootTarget.x] === TYPES.WALL_SOFT) return null; // Davor stehenbleiben
        return lootTarget;
    }

    // 5. RANDOM SAFE
    return getRandomSafeNeighbor(gx, gy, dangerMap);
}

// ==========================================
//              PFADFINDUNG & SIMULATION
// ==========================================

function simulateBombAndFindEscape(gx, gy, currentDangerMap, range) {
    const virtualDanger = new Set();
    virtualDanger.add(`${gx},${gy}`); 
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break; 
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });

    // BFS Suche nach Safe Spot
    const queue = [{x: gx, y: gy, path: []}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 500) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        // SAFE? (Nicht im neuen Blast UND nicht in alter Gefahr)
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) return curr.path; 
        if (curr.path.length > 8) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                // Wir dürfen durch die virtuelle Explosion laufen um zu entkommen
                // Aber nicht durch Wände oder echte Gefahr
                if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
            }
        }
    }
    return null; 
}

function findEscapePathBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, path:[]}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr.path;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if(!isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                // Bei Flucht Radius akzeptieren, Feuer meiden
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
            }
        }
    }
    return null;
}

// A* für gezielte Bewegung
function findNextStepAStar(sx, sy, tx, ty, dangerMap, canBreach) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        if(curr.x===tx && curr.y===ty) return curr.first;

        // Greedy Sortierung
        const neighbors = DIRS.map(d=>({x:curr.x+d.x, y:curr.y+d.y}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for(let n of neighbors) {
            if(visited.has(`${n.x},${n.y}`)) continue;
            if(n.x<0||n.x>=GRID_W||n.y<0||n.y>=GRID_H) continue;

            let blocked = isSolidWall(n.x, n.y);
            const tile = state.grid[n.y][n.x];
            
            if(tile === TYPES.BOMB) blocked = true;
            if(tile === TYPES.WALL_SOFT && !canBreach) blocked = true;
            if(dangerMap[n.y][n.x] > 0) blocked = true;

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, first: curr.first || n});
            }
        }
    }
    return null;
}

// Findet das nächste Item (greift nach PowerUps)
function findNearestItemBFS(sx, sy, dangerMap, limit) {
    const queue = [{x:sx, y:sy, first:null, dist:0}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (curr.dist > limit) continue;

        if (isPowerUp(curr.x, curr.y)) return curr.first || {x:curr.x, y:curr.y};

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || {x:nx, y:ny}, dist: curr.dist+1});
            }
        }
    }
    return null;
}

// Findet nächste Kiste zum Sprengen
function findNearestLootBFS(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        const t = state.grid[curr.y][curr.x];
        
        // Ziel: Ein leeres Feld vor einer Kiste (NICHT die Kiste selbst)
        // Check neighbors for Soft Wall
        const nextToBox = DIRS.some(d => {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
        });

        if (nextToBox && (curr.x!==sx || curr.y!==sy)) {
            return curr.first || {x:curr.x, y:curr.y};
        }

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if(!isSolid(nx, ny) && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || {x:nx, y:ny}});
            }
        }
    }
    return null;
}

// Sucht nach Positionen mit viel Zerstörungspotential
function findMultiWallSpot(gx, gy, dangerMap, range) {
    let bestSpot = null;
    let maxHits = 1;

    for (let y = Math.max(1, gy-5); y < Math.min(GRID_H-1, gy+5); y++) {
        for (let x = Math.max(1, gx-5); x < Math.min(GRID_W-1, gx+5); x++) {
            if (!isSolid(x, y) && dangerMap[y][x] === 0) {
                const hits = countDestroyableWalls(x, y, range);
                if (hits > maxHits) {
                    maxHits = hits;
                    bestSpot = {x, y};
                }
            }
        }
    }
    if (bestSpot) return findNextStepAStar(gx, gy, bestSpot.x, bestSpot.y, dangerMap, false);
    return null;
}

// --- UTILS ---

function moveToPixel(bot, tx, ty) {
    const dx = tx - bot.x; const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.min(dist, bot.speed);
    if(dist>1) {
        const mx = (dx/dist)*speed; const my = (dy/dist)*speed;
        bot.move(mx, my);
        if(Math.abs(mx)>Math.abs(my)) bot.lastDir = {x:Math.sign(mx), y:0};
        else bot.lastDir = {x:0, y:Math.sign(my)};
    }
}

function snapToGrid(bot) {
    bot.x = Math.round(bot.x / TILE_SIZE) * TILE_SIZE;
    bot.y = Math.round(bot.y / TILE_SIZE) * TILE_SIZE;
}

function hasReachedPixel(bot, px, py) {
    return Math.abs(bot.x - px) <= 4 && Math.abs(bot.y - py) <= 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!isSolid(Math.round((bot.x+d.x*10)/TILE_SIZE), Math.round((bot.y+d.y*10)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
}

function getRandomSafeNeighbor(gx, gy, dangerMap) {
    const valid = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
        .filter(n => n.x>=0 && n.x<GRID_W && n.y>=0 && n.y<GRID_H && !isSolid(n.x, n.y) && dangerMap[n.y][n.x]===0);
    return valid.length > 0 ? valid[Math.floor(Math.random()*valid.length)] : null;
}

// Auf Hard: Fokus auf Player 1
function findTargetEnemy(bot, isHard) {
    if (isHard) {
        const p1 = state.players.find(p => p.id === 1 && p.alive);
        if (p1) return p1;
    }
    let nearest=null, minDist=Infinity;
    state.players.forEach(p => {
        if(p!==bot && p.alive) {
            const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
            if(d<minDist){ minDist=d; nearest=p; }
        }
    });
    return nearest;
}

function isTeammateInFireline(gx, gy, range, selfId) {
    let hit = false;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty) || (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT)) break;
            const ally = state.players.find(p => p.id !== 1 && p.id !== selfId && p.alive && Math.round(p.x/TILE_SIZE)===tx && Math.round(p.y/TILE_SIZE)===ty);
            if (ally) hit = true;
        }
    });
    return hit;
}

function willDestroyPowerUp(gx, gy, range) {
    if (isPowerUp(gx, gy)) return true;
    let destroys = false;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break; 
            if (isPowerUp(tx, ty)) destroys = true; 
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    return destroys;
}

function isPowerUp(x, y) {
    if (x<0 || y<0 || x>=GRID_W || y>=GRID_H) return false;
    const item = state.items[y][x];
    // Skulls sind okay zu zerstören
    return (item !== ITEMS.NONE && item !== ITEMS.SKULL);
}

function countDestroyableWalls(gx, gy, range) {
    let count = 0;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break; 
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) {
                count++;
                break; 
            }
        }
    });
    return count;
}

function getBestNeighborSpot(gx, gy, range) {
    let maxHits = 0;
    DIRS.forEach(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (!isSolid(nx, ny)) {
            const hits = countDestroyableWalls(nx, ny, range);
            if (hits > maxHits) maxHits = hits;
        }
    });
    return maxHits;
}

function isSolidWall(x, y) {
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    return state.grid[y][x] === TYPES.WALL_HARD;
}

function getEffectiveBlastRange(gx, gy, baseRange) {
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === gx && p.y === gy);
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;
    if (isBoost || isOil) return 15;
    return baseRange;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        const r = getEffectiveBlastRange(b.gx, b.gy, b.range);
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isSolidWall(tx, ty)) break; 
                if(map[ty][tx] < 1) map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isSolidWall(tx,ty)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}