import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globales Gedächtnis
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { 
            state: 'IDLE',      
            target: null,       
            patience: 0,
            lockedPath: null,
            lastPos: {x: -1, y: -1},
            stuckTimer: 0
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Stuck Detection (Gegen Einfrieren am Start)
    if (Math.abs(bot.x - mem.lastPos.x) < 2 && Math.abs(bot.y - mem.lastPos.y) < 2) {
        mem.stuckTimer++;
    } else {
        mem.stuckTimer = 0;
        mem.lastPos = {x: bot.x, y: bot.y};
    }
    if (mem.stuckTimer > 60) { // 1 Sekunde Stillstand -> Reset
        mem.state = 'IDLE';
        mem.target = null;
        mem.lockedPath = null;
        moveRandomly(bot); 
        mem.stuckTimer = 0;
        return;
    }

    const dangerMap = getDangerMap(); 
    const currentDanger = dangerMap[gy][gx];

    // ---------------------------------------------------------
    // 1. SURVIVAL MODE (Absoluter Vorrang)
    // ---------------------------------------------------------
    if (currentDanger > 0 || mem.state === 'SURVIVING') {
        mem.state = 'SURVIVING';
        mem.target = null; 

        const pathFinished = (!mem.lockedPath || mem.lockedPath.length === 0);

        if (currentDanger === 0 && pathFinished) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            mem.lockedPath = null;
            return; 
        }

        if (pathFinished) {
            const escapePath = findEscapePathBFS(gx, gy, dangerMap);
            if (escapePath && escapePath.length > 0) {
                mem.lockedPath = escapePath;
            } else {
                moveRandomly(bot); 
                return;
            }
        }

        if (mem.lockedPath && mem.lockedPath.length > 0) {
            const nextStep = mem.lockedPath[0];
            if (hasReachedPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE)) {
                mem.lockedPath.shift(); 
            } else {
                moveToPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
            }
        }
        return; 
    }

    // ---------------------------------------------------------
    // 2. MOVEMENT
    // ---------------------------------------------------------
    if (mem.state === 'MOVING' && mem.target) {
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);

        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
            mem.state = 'IDLE'; 
            mem.target = null;
        } else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            snapToGrid(bot);
            mem.state = 'IDLE'; 
            mem.target = null;
        } else {
            moveToPixel(bot, mem.target.x, mem.target.y);
            return;
        }
    }

    // ---------------------------------------------------------
    // 3. ENTSCHEIDUNG
    // ---------------------------------------------------------
    if (mem.state === 'IDLE') {
        
        // A) BOMBEN CHECK
        if (bot.activeBombs < bot.maxBombs) {
            const analysis = analyzePosition(bot, gx, gy, state.difficulty, dangerMap);
            
            if (analysis.shouldPlant) {
                const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
                const escapePath = simulateBombAndFindEscape(gx, gy, dangerMap, realRange);

                if (escapePath) {
                    bot.plantBomb();
                    mem.state = 'SURVIVING';
                    mem.lockedPath = escapePath;
                    
                    if (escapePath.length > 0) {
                        const first = escapePath[0];
                        moveToPixel(bot, first.x * TILE_SIZE, first.y * TILE_SIZE);
                    }
                    return;
                }
            }
        }

        // B) ZIEL SUCHE
        const nextTarget = pickSmartTarget(bot, gx, gy, dangerMap);
        if (nextTarget) {
            mem.state = 'MOVING';
            mem.target = { x: nextTarget.x * TILE_SIZE, y: nextTarget.y * TILE_SIZE };
            moveToPixel(bot, mem.target.x, mem.target.y);
        } else {
            if (Math.random() < 0.2) moveRandomly(bot);
        }
    }
}

// ==========================================
//              STRATEGIE LOGIK
// ==========================================

function analyzePosition(bot, gx, gy, difficulty, dangerMap) {
    const isHard = difficulty === DIFFICULTIES.HARD;
    const enemy = findTargetEnemy(bot, isHard);

    // 1. TRAP CHECK (Hard)
    // Wenn wir den Gegner einsperren können -> Sofort zünden!
    if (isHard && enemy && enemy.id === 1) {
        if (isTrapOpportunity(bot, gx, gy, enemy)) {
            return { shouldPlant: true, reason: 'trap' };
        }
    }

    // 2. KILL CHECK
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const rangeNeeded = isHard ? bot.bombRange + 3 : bot.bombRange;
        
        if (dist <= rangeNeeded) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            
            if (dx < 1 || dy < 1) {
                // Team-Check auf Hard: Grillen wir einen Freund? (Außer er steht eh im Feuer)
                if (isHard && isTeammateInFireline(gx, gy, bot.bombRange, bot.id)) {
                    return { shouldPlant: false }; 
                }
                return { shouldPlant: true, reason: 'kill' };
            }
        }
    }

    // 3. FARM CHECK (Effizienz)
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    
    if (wallsHit === 0) return { shouldPlant: false };

    // Wenn >= 2 Kisten -> Immer gut
    if (wallsHit >= 2) return { shouldPlant: true };

    // Wenn nur 1 Kiste: Auf HARD prüfen wir, ob ein Nachbarfeld besser ist.
    if (isHard && wallsHit === 1) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        // Wenn ein Nachbarfeld 2+ Kisten trifft -> Warten und hingehen
        if (bestNeighborHits > 1) {
            return { shouldPlant: false }; 
        }
        // Wenn Nachbar auch nur 1 trifft, ist es egal -> Zünden
    }

    return { shouldPlant: Math.random() < 0.7 };
}

function pickSmartTarget(bot, gx, gy, dangerMap) {
    const isHard = state.difficulty === DIFFICULTIES.HARD;

    // A) SWEET SPOTS (Viele Kisten)
    // Scanne Umgebung nach einem Feld mit vielen Kisten (nur auf Hard)
    if (isHard) {
        const sweetSpot = findMultiWallSpot(gx, gy, dangerMap, bot.bombRange);
        if (sweetSpot) return sweetSpot;
    }

    // B) JAGEN (Team vs Player 1)
    const enemy = findTargetEnemy(bot, isHard);
    const canBreach = (isHard && bot.maxBombs >= 2); 
    
    if (enemy && (isHard || Math.random() < 0.5)) {
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (pathStep) {
            // Wenn der Schritt auf eine Kiste führt -> Stehenbleiben (Bomb Logic greift)
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null;
            return pathStep;
        }
    }

    // C) LOOT
    const lootStep = findNearestLootBFS(gx, gy, dangerMap);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

    return getRandomSafeNeighbor(gx, gy, dangerMap);
}

// ==========================================
//              ALGORITHMEN
// ==========================================

function findMultiWallSpot(gx, gy, dangerMap, range) {
    let bestSpot = null;
    let maxHits = 1; // Wir suchen Spots die besser als 1 sind

    // Scan Radius 6
    for (let y = Math.max(1, gy-6); y < Math.min(GRID_H-1, gy+6); y++) {
        for (let x = Math.max(1, gx-6); x < Math.min(GRID_W-1, gx+6); x++) {
            if (!isSolid(x, y) && dangerMap[y][x] === 0) {
                const hits = countDestroyableWalls(x, y, range);
                if (hits > maxHits) {
                    maxHits = hits;
                    bestSpot = {x, y};
                }
            }
        }
    }
    
    if (bestSpot) {
        // Pfad dorthin berechnen. Skulls meiden auf Hard!
        const isHard = (state.difficulty === DIFFICULTIES.HARD);
        // Note: avoidSkulls flag is checked inside A* if passed? 
        // We'll update findNextStepAStar signature below to handle skull avoidance.
        return findNextStepAStar(gx, gy, bestSpot.x, bestSpot.y, dangerMap, false); 
    }
    return null;
}

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

    const queue = [{x: gx, y: gy, path: []}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) return curr.path; 
        if (curr.path.length > 8) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                let blocked = isSolid(nx, ny);
                
                // Skull Check im Fluchtweg (Hard)
                if (state.difficulty === DIFFICULTIES.HARD && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) blocked = true;

                if (!blocked && currentDangerMap[ny][nx] === 0) {
                    visited.add(`${nx},${ny}`);
                    const newPath = [...curr.path, {x:nx, y:ny}];
                    queue.push({x:nx, y:ny, path:newPath});
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
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
            }
        }
    }
    return null;
}

// --- STANDARD PFADFINDUNG ---

function findNextStepAStar(sx, sy, tx, ty, dangerMap, canBreach) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        if(curr.x===tx && curr.y===ty) return curr.first;

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
            
            // Hard: Avoid Skulls
            if (state.difficulty === DIFFICULTIES.HARD && state.items[n.y] && state.items[n.y][n.x] === ITEMS.SKULL) blocked = true;

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, first: curr.first || n});
            }
        }
    }
    return null;
}

function findNearestLootBFS(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        // Found Loot?
        // Hard Bots meiden Skulls (SKULL ist kein Loot)
        const isSkull = (item === ITEMS.SKULL);
        const avoidSkull = (state.difficulty === DIFFICULTIES.HARD);
        const validItem = (item !== ITEMS.NONE && (!avoidSkull || !isSkull));

        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || validItem)) {
            return curr.first || {x:curr.x, y:curr.y};
        }
        if (t===TYPES.WALL_SOFT) continue;

        for(let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Path check: Avoid Skulls on Hard
            let blocked = isSolid(nx, ny);
            if (avoidSkull && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) blocked = true;

            if(!blocked && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || {x:nx, y:ny}});
            }
        }
    }
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

function findNearestEnemy(bot) {
    // For Logic Checks (not targeting)
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

function isTrapOpportunity(bot, gx, gy, target) {
    const tx = Math.round(target.x / TILE_SIZE);
    const ty = Math.round(target.y / TILE_SIZE);
    const dist = Math.abs(gx - tx) + Math.abs(gy - ty);
    if (dist > 5) return false;

    let freeExits = [];
    DIRS.forEach(d => {
        const nx = tx + d.x; const ny = ty + d.y;
        if (!isSolid(nx, ny) && !isHazard(nx, ny)) freeExits.push({x: nx, y: ny});
    });

    if (freeExits.length > 0 && freeExits.length <= 2) {
        const range = bot.bombRange;
        const allExitsCovered = freeExits.every(exit => {
            const onX = (exit.y === gy && Math.abs(exit.x - gx) <= range);
            const onY = (exit.x === gx && Math.abs(exit.y - gy) <= range);
            return onX || onY;
        });
        if (allExitsCovered) return true; 
    }
    return false;
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

function getBestNeighborSpot(gx, gy, range, dangerMap) {
    let maxHits = 0;
    DIRS.forEach(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0) {
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

function isHazard(x, y) {
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    const tile = state.grid[y][x];
    if (tile === TYPES.BOMB) return true;
    return state.particles.some(p => p.isFire && p.gx === x && p.gy === y);
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