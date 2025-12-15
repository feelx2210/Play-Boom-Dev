import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Gedächtnis für Bots
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { 
            state: 'IDLE',      // IDLE, MOVING, SURVIVING
            target: null,       
            patience: 0,
            lockedPath: null
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap(); 
    const currentDanger = dangerMap[gy][gx];

    // Auf HARD vermeiden wir Skulls wie die Pest (Risikominimierung)
    const avoidSkulls = (state.difficulty === DIFFICULTIES.HARD);

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
            // Auch beim Flüchten Skulls vermeiden, wenn möglich
            const escapePath = findEscapePathBFS(gx, gy, dangerMap, avoidSkulls);
            if (escapePath && escapePath.length > 0) {
                mem.lockedPath = escapePath;
            } else {
                // Notfall: Wenn mit Skull-Avoidance kein Weg, versuche OHNE (lieber verflucht als tot)
                if (avoidSkulls) {
                    const emergencyPath = findEscapePathBFS(gx, gy, dangerMap, false);
                    if (emergencyPath && emergencyPath.length > 0) {
                        mem.lockedPath = emergencyPath;
                        return;
                    }
                }
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

        // Prüfen ob Weg durch Skull blockiert (wenn avoidSkulls aktiv)
        let blockedBySkull = false;
        if (avoidSkulls && state.items[ty] && state.items[ty][tx] === ITEMS.SKULL) blockedBySkull = true;

        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty) || blockedBySkull) {
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
                // Fluchtweg muss Skulls berücksichtigen!
                const escapePath = simulateBombAndFindEscape(gx, gy, dangerMap, realRange, avoidSkulls);

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
        const nextTarget = pickSmartTarget(bot, gx, gy, dangerMap, avoidSkulls);
        if (nextTarget) {
            mem.state = 'MOVING';
            mem.target = { x: nextTarget.x * TILE_SIZE, y: nextTarget.y * TILE_SIZE };
            moveToPixel(bot, mem.target.x, mem.target.y);
        } else {
            if (Math.random() < 0.1) moveRandomly(bot);
        }
    }
}

// ==========================================
//              STRATEGIE LOGIK
// ==========================================

function analyzePosition(bot, gx, gy, difficulty, dangerMap) {
    const isHard = difficulty === DIFFICULTIES.HARD;
    const enemy = findTargetEnemy(bot, isHard); // Holt Player 1 auf Hard

    // 1. TRAP CHECK (Hard)
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
                // TEAM-CHECK: Steht ein anderer Bot im Feuer?
                // Wir schießen nur, wenn wir keinen Freund grillen (außer es ist Player 1)
                if (isHard && isTeammateInFireline(gx, gy, bot.bombRange, bot.id)) {
                    return { shouldPlant: false }; // Friendly Fire vermeiden
                }
                return { shouldPlant: true, reason: 'kill' };
            }
        }
    }

    // 3. FARM CHECK
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    if (wallsHit === 0) return { shouldPlant: false };
    if (wallsHit >= 2 || !isHard) return { shouldPlant: true };

    if (isHard && wallsHit === 1) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        if (bestNeighborHits > wallsHit) return { shouldPlant: false }; 
    }

    return { shouldPlant: Math.random() < 0.6 };
}

// Sucht das Ziel: Auf HARD immer Player 1, sonst der nächste
function findTargetEnemy(bot, isHard) {
    if (isHard) {
        const player1 = state.players.find(p => p.id === 1 && p.alive);
        if (player1) return player1;
        // Wenn Player 1 tot ist, verhalten wir uns normal (Jeder gegen Jeden)
    }
    
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if (p !== bot && p.alive) {
            const d = (p.x - bot.x)**2 + (p.y - bot.y)**2;
            if (d < minDist) { minDist = d; nearest = p; }
        }
    });
    return nearest;
}

// Prüft, ob ein anderer Bot (Freund) in der Schusslinie steht
function isTeammateInFireline(gx, gy, range, selfId) {
    let teammateHit = false;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty) || (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT)) break;
            
            // Steht hier ein Bot?
            const botHere = state.players.find(p => p.id !== 1 && p.id !== selfId && p.alive && Math.round(p.x/TILE_SIZE) === tx && Math.round(p.y/TILE_SIZE) === ty);
            if (botHere) teammateHit = true;
        }
    });
    return teammateHit;
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

function pickSmartTarget(bot, gx, gy, dangerMap, avoidSkulls) {
    const isHard = state.difficulty === DIFFICULTIES.HARD;

    // A) SWEET SPOTS (HARD)
    if (isHard) {
        const sweetSpot = findMultiWallSpot(gx, gy, dangerMap, bot.bombRange, avoidSkulls);
        if (sweetSpot) return sweetSpot;
    }

    // B) JAGEN (Team vs Player 1)
    const enemy = findTargetEnemy(bot, isHard);
    const canBreach = (isHard && bot.maxBombs >= 2); 
    
    if (enemy && (isHard || Math.random() < 0.5)) {
        // Pfad zum Gegner (respektiert Skulls!)
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach, avoidSkulls);
        if (pathStep) {
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null;
            return pathStep;
        }
    }

    // C) LOOT
    const lootStep = findNearestLootBFS(gx, gy, dangerMap, avoidSkulls);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

    return getRandomSafeNeighbor(gx, gy, dangerMap, avoidSkulls);
}

// ==========================================
//              PFADFINDUNG & SIMULATION
// ==========================================

function simulateBombAndFindEscape(gx, gy, currentDangerMap, range, avoidSkulls) {
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
                
                // Hindernis Check
                let blocked = isSolid(nx, ny);
                if (avoidSkulls && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) blocked = true;

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

function findEscapePathBFS(gx, gy, dangerMap, avoidSkulls) {
    const queue = [{x:gx, y:gy, path:[]}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr.path;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            
            // Hindernis Check
            let blocked = isSolid(nx, ny);
            if (avoidSkulls && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) blocked = true;

            if(!blocked && !visited.has(`${nx},${ny}`)) {
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
            }
        }
    }
    return null;
}

function findNextStepAStar(sx, sy, tx, ty, dangerMap, canBreach, avoidSkulls) {
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
            // SKULL Check
            if(avoidSkulls && state.items[n.y] && state.items[n.y][n.x] === ITEMS.SKULL) blocked = true;

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, first: curr.first || n});
            }
        }
    }
    return null;
}

function findNearestLootBFS(sx, sy, dangerMap, avoidSkulls) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        // Found Loot?
        // WICHTIG: Wenn avoidSkulls=true, ist ein Skull KEIN Loot, sondern Luft (oder Hindernis)
        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || (item!==ITEMS.NONE && (!avoidSkulls || item !== ITEMS.SKULL)))) {
            return curr.first || {x:curr.x, y:curr.y};
        }
        if (t===TYPES.WALL_SOFT) continue;

        for(let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Skull Check für Weg
            let blocked = isSolid(nx, ny);
            if (avoidSkulls && state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) blocked = true;

            if(!blocked && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || {x:nx, y:ny}});
            }
        }
    }
    return null;
}

function findMultiWallSpot(gx, gy, dangerMap, range, avoidSkulls) {
    let bestSpot = null;
    let bestHits = 1;

    for (let y = Math.max(1, gy-5); y < Math.min(GRID_H-1, gy+5); y++) {
        for (let x = Math.max(1, gx-5); x < Math.min(GRID_W-1, gx+5); x++) {
            let blocked = isSolid(x, y);
            if (avoidSkulls && state.items[y] && state.items[y][x] === ITEMS.SKULL) blocked = true;

            if (!blocked && dangerMap[y][x] === 0) {
                const hits = countDestroyableWalls(x, y, range);
                if (hits > bestHits) {
                    bestHits = hits;
                    bestSpot = {x, y};
                }
            }
        }
    }
    
    if (bestSpot) {
        return findNextStepAStar(gx, gy, bestSpot.x, bestSpot.y, dangerMap, false, avoidSkulls);
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

function getRandomSafeNeighbor(gx, gy, dangerMap, avoidSkulls) {
    const valid = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
        .filter(n => {
            if (n.x<0||n.x>=GRID_W||n.y<0||n.y>=GRID_H) return false;
            let blocked = isSolid(n.x, n.y);
            if (avoidSkulls && state.items[n.y] && state.items[n.y][n.x] === ITEMS.SKULL) blocked = true;
            return !blocked && dangerMap[n.y][n.x]===0;
        });
    return valid.length > 0 ? valid[Math.floor(Math.random()*valid.length)] : null;
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

function findNearestEnemy(bot) {
    // Standard-Funktion für Analysen, wird durch findTargetEnemy ersetzt wenn es um das Ziel geht
    let nearest=null, minDist=Infinity;
    state.players.forEach(p => {
        if(p!==bot && p.alive) {
            const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
            if(d<minDist){ minDist=d; nearest=p; }
        }
    });
    return nearest;
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