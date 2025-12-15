import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globales Gedächtnis
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { 
            state: 'IDLE',      // IDLE, MOVING, SURVIVING
            target: null,       // Aktuelles Pixel-Ziel
            gridTarget: null,   // {x, y} Ziel im Grid (für Persistenz)
            patience: 0,
            lockedPath: null,
            lastPos: {x: -1, y: -1},
            stuckTimer: 0,
            badSpots: []
        };
    }
    const mem = botMemory[bot.id];
    const now = Date.now();

    // Bad Spots aufräumen
    mem.badSpots = mem.badSpots.filter(s => now - s.time < 3000);
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // --- STUCK DETECTION ---
    if (Math.abs(bot.x - mem.lastPos.x) < 1 && Math.abs(bot.y - mem.lastPos.y) < 1 && mem.state === 'MOVING') {
        mem.stuckTimer++;
    } else {
        mem.stuckTimer = 0;
        mem.lastPos = {x: bot.x, y: bot.y};
    }
    if (mem.stuckTimer > 40) { // ~0.7 Sekunden Stillstand
        // Reset Logic
        mem.state = 'IDLE';
        mem.target = null;
        mem.gridTarget = null;
        mem.stuckTimer = 0;
        // Kleiner Zufalls-Move um sich zu lösen
        moveRandomly(bot);
        return;
    }

    const dangerMap = getDangerMap(); 
    const currentDanger = dangerMap[gy][gx];

    // ---------------------------------------------------------
    // 1. SURVIVAL (PRIO 1)
    // ---------------------------------------------------------
    if (currentDanger > 0 || mem.state === 'SURVIVING') {
        mem.state = 'SURVIVING';
        mem.target = null; 
        mem.gridTarget = null; // Ziel vergessen beim Überleben

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
    // 2. MOVEMENT (Ziel anlaufen mit Persistenz)
    // ---------------------------------------------------------
    if (mem.state === 'MOVING' && mem.target) {
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);

        // ABBRUCH-BEDINGUNGEN:
        // 1. Ziel ist jetzt gefährlich
        // 2. Ziel ist blockiert (Wand/Bombe)
        // 3. Wir stehen auf einem "Bad Spot" (wollten legen, ging nicht)
        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty) || isBadSpot(mem, tx, ty)) {
            mem.state = 'IDLE';
            mem.target = null;
            mem.gridTarget = null;
        } 
        // ANGEKOMMEN?
        else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            mem.target = null;
            // gridTarget behalten wir NICHT, wir entscheiden neu, wenn wir da sind
            mem.gridTarget = null; 
        } 
        else {
            // WEITERLAUFEN (Nicht neu entscheiden!)
            moveToPixel(bot, mem.target.x, mem.target.y);
            return;
        }
    }

    // ---------------------------------------------------------
    // 3. ENTSCHEIDUNG (IDLE - Nur hier wird nachgedacht!)
    // ---------------------------------------------------------
    if (mem.state === 'IDLE') {
        
        // A) BOMBEN CHECK
        if (bot.activeBombs < bot.maxBombs) {
            // Nur bomben wenn KEIN BadSpot
            if (!isBadSpot(mem, gx, gy)) {
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
                    } else {
                        // Sackgasse erkannt -> Spot merken und weggehen
                        mem.badSpots.push({x: gx, y: gy, time: Date.now()});
                    }
                }
            }
        }

        // B) ZIEL SUCHE
        // Hier geben wir das alte Ziel mit, um "Springen" zu verhindern
        const nextTarget = pickSmartTarget(bot, gx, gy, dangerMap, mem);
        
        if (nextTarget) {
            mem.state = 'MOVING';
            mem.target = { x: nextTarget.x * TILE_SIZE, y: nextTarget.y * TILE_SIZE };
            mem.gridTarget = nextTarget; // Logisches Ziel merken
            moveToPixel(bot, mem.target.x, mem.target.y);
        } else {
            // Kein sinnvolles Ziel? Wanderlust.
            // Suche irgendein freies Feld in der Nähe, um nicht einzuschlafen
            const wanderTarget = findRandomWanderTarget(gx, gy, dangerMap);
            if (wanderTarget) {
                mem.state = 'MOVING';
                mem.target = { x: wanderTarget.x * TILE_SIZE, y: wanderTarget.y * TILE_SIZE };
                moveToPixel(bot, mem.target.x, mem.target.y);
            } else {
                moveRandomly(bot);
            }
        }
    }
}

// ==========================================
//              STRATEGIE LOGIK
// ==========================================

function isBadSpot(mem, x, y) {
    return mem.badSpots.some(s => s.x === x && s.y === y);
}

function analyzePosition(bot, gx, gy, difficulty, dangerMap) {
    const isHard = difficulty === DIFFICULTIES.HARD;
    const enemy = findTargetEnemy(bot, isHard);

    // 0. ITEM SCHUTZ
    if (willDestroyPowerUp(gx, gy, bot.bombRange)) return { shouldPlant: false };

    // 1. TRAP CHECK (Hard)
    if (isHard && enemy && enemy.id === 1) {
        if (isTrapOpportunity(bot, gx, gy, enemy)) return { shouldPlant: true };
    }

    // 2. KILL CHECK
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const rangeNeeded = isHard ? bot.bombRange + 3 : bot.bombRange;
        if (dist <= rangeNeeded) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            if (dx < 1 || dy < 1) {
                if (isHard && isTeammateInFireline(gx, gy, bot.bombRange, bot.id)) return { shouldPlant: false }; 
                return { shouldPlant: true };
            }
        }
    }

    // 3. FARM CHECK
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    if (wallsHit === 0) return { shouldPlant: false };
    if (wallsHit >= 2) return { shouldPlant: true };

    // Smart Wait: Wenn Nachbar besser ist, warte
    if (isHard && wallsHit === 1) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        if (bestNeighborHits > 1) return { shouldPlant: false }; 
    }

    // Wenn wir hier sind, treffen wir 1 Kiste und es gibt keine bessere Option in der Nähe
    return { shouldPlant: Math.random() < 0.8 };
}

function pickSmartTarget(bot, gx, gy, dangerMap, mem) {
    const isHard = state.difficulty === DIFFICULTIES.HARD;

    // Wenn wir schon ein valides Grid-Target haben und noch nicht dort sind -> Behalten!
    // (Verhindert das "Umentscheiden" auf halbem Weg)
    if (mem.gridTarget) {
        const tx = mem.gridTarget.x;
        const ty = mem.gridTarget.y;
        // Ist das alte Ziel noch valide/sicher?
        if (dangerMap[ty][tx] === 0 && !isSolid(tx, ty) && !isBadSpot(mem, tx, ty)) {
            // Sind wir schon da?
            if (gx !== tx || gy !== ty) {
                return mem.gridTarget; // Weiterlaufen!
            }
        }
    }

    // 1. ITEMS (Greedy)
    const itemStep = findNearestItemBFS(gx, gy, dangerMap, 10, mem);
    if (itemStep) return itemStep;

    // 2. SWEET SPOTS (Hard)
    if (isHard) {
        const sweetSpot = findMultiWallSpot(gx, gy, dangerMap, bot.bombRange, mem);
        if (sweetSpot) return sweetSpot;
    }

    // 3. JAGEN
    const enemy = findTargetEnemy(bot, isHard);
    const canBreach = (isHard && bot.maxBombs >= 2); 
    
    if (enemy && (isHard || Math.random() < 0.6)) {
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (pathStep) {
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null; // Davor stehenbleiben
            return pathStep;
        }
    }

    // 4. LOOT
    const lootStep = findNearestLootBFS(gx, gy, dangerMap, mem);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

    return null; // Kein spezifisches Ziel gefunden -> Fallback auf Wander
}

// ==========================================
//              ALGORITHMEN
// ==========================================

function findMultiWallSpot(gx, gy, dangerMap, range, mem) {
    let bestSpot = null;
    let maxHits = 1;

    // Wir suchen im Radius 6
    for (let y = Math.max(1, gy-6); y < Math.min(GRID_H-1, gy+6); y++) {
        for (let x = Math.max(1, gx-6); x < Math.min(GRID_W-1, gx+6); x++) {
            if (isBadSpot(mem, x, y)) continue;

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

    while(queue.length > 0 && ops++ < 500) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) return curr.path; 
        if (curr.path.length > 10) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                let blocked = isSolid(nx, ny);
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

function findNearestItemBFS(sx, sy, dangerMap, limit, mem) {
    const queue = [{x:sx, y:sy, first:null, dist:0}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (curr.dist > limit) continue;

        if (isPowerUp(curr.x, curr.y) && !isBadSpot(mem, curr.x, curr.y)) return curr.first || {x:curr.x, y:curr.y};

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
                if (state.difficulty === DIFFICULTIES.HARD && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || {x:nx, y:ny}, dist: curr.dist+1});
            }
        }
    }
    return null;
}

function findNearestLootBFS(sx, sy, dangerMap, mem) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        const isSkull = (item === ITEMS.SKULL);
        const avoidSkull = (state.difficulty === DIFFICULTIES.HARD);
        const validItem = (item !== ITEMS.NONE && (!avoidSkull || !isSkull));

        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || validItem)) {
            if (isBadSpot(mem, curr.x, curr.y)) continue;
            return curr.first || {x:curr.x, y:curr.y};
        }
        if (t===TYPES.WALL_SOFT) continue;

        for(let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
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
            if (state.difficulty === DIFFICULTIES.HARD && state.items[n.y] && state.items[n.y][n.x] === ITEMS.SKULL) blocked = true;

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, first: curr.first || n});
            }
        }
    }
    return null;
}

function findRandomWanderTarget(sx, sy, dangerMap) {
    // Sucht ein zufälliges sicheres Feld im Radius 4, um Bewegung zu erzwingen
    const candidates = [];
    for(let y=Math.max(1, sy-4); y<Math.min(GRID_H-1, sy+4); y++) {
        for(let x=Math.max(1, sx-4); x<Math.min(GRID_W-1, sx+4); x++) {
            if(!isSolid(x, y) && dangerMap[y][x]===0 && (x!==sx || y!==sy)) {
                candidates.push({x, y});
            }
        }
    }
    if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return null;
}

// --- UTILS & CHECKS ---

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
    return (item !== ITEMS.NONE && item !== ITEMS.SKULL);
}

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