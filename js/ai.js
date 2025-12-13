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
            lockedPath: null    // Fester Pfad für Flucht
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap(); // 0=Safe, 1=DangerZone, 2=Deadly
    const currentDanger = dangerMap[gy][gx];

    // ---------------------------------------------------------
    // 1. SURVIVAL MODE (Absoluter Vorrang)
    // ---------------------------------------------------------
    if (currentDanger > 0 || mem.state === 'SURVIVING') {
        mem.state = 'SURVIVING';
        mem.target = null; // Vergiss normales Ziel

        // FIX: Prüfen, ob der Pfad leer/abgearbeitet ist
        const pathFinished = (!mem.lockedPath || mem.lockedPath.length === 0);

        // Wenn wir sicher stehen UND fertig sind -> Modus beenden
        if (currentDanger === 0 && pathFinished) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            mem.lockedPath = null;
            return; // Nächster Frame entscheidet neu
        }

        // Wenn wir keinen Pfad haben (oder er leer ist), aber noch in Gefahr sind -> Suchen
        if (pathFinished) {
            const escapePath = findEscapePathBFS(gx, gy, dangerMap);
            if (escapePath && escapePath.length > 0) {
                mem.lockedPath = escapePath;
            } else {
                // Panik: Random Move (besser als Stillstand)
                moveRandomly(bot);
                return;
            }
        }

        // Dem Rettungsweg folgen
        if (mem.lockedPath && mem.lockedPath.length > 0) {
            const nextStep = mem.lockedPath[0];
            
            // Sind wir da?
            if (hasReachedPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE)) {
                mem.lockedPath.shift(); // Schritt entfernen
                // Keine Bewegung mehr in diesem Frame, erst neuen Schritt prüfen
            } else {
                // Hinlaufen
                moveToPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
            }
        }
        return; // Keine weiteren Aktionen im Survival Mode
    }

    // ---------------------------------------------------------
    // 2. MOVEMENT (Ziel anlaufen)
    // ---------------------------------------------------------
    if (mem.state === 'MOVING' && mem.target) {
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);

        // Validierung: Ziel noch sicher?
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
    // 3. ENTSCHEIDUNG (Brain)
    // ---------------------------------------------------------
    if (mem.state === 'IDLE') {
        
        // A) BOMBEN CHECK
        if (bot.activeBombs < bot.maxBombs) {
            const analysis = analyzePosition(bot, gx, gy, state.difficulty, dangerMap);
            
            if (analysis.shouldPlant) {
                // Simulation: Können wir flüchten?
                const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
                const escapePath = simulateBombAndFindEscape(gx, gy, dangerMap, realRange);

                if (escapePath) {
                    bot.plantBomb();
                    
                    // SOFORT in den Survival Mode wechseln
                    mem.state = 'SURVIVING';
                    mem.lockedPath = escapePath;
                    
                    // Ersten Schritt sofort ausführen
                    if (escapePath.length > 0) {
                        const first = escapePath[0];
                        moveToPixel(bot, first.x * TILE_SIZE, first.y * TILE_SIZE);
                    }
                    return;
                }
            }
        }

        // B) NEUES ZIEL SUCHEN
        const nextTarget = pickSmartTarget(bot, gx, gy, dangerMap);
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
    // 1. Gegner Check (Kill hat Vorrang)
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const rangeNeeded = (difficulty === DIFFICULTIES.HARD) ? bot.bombRange + 2 : bot.bombRange;
        
        if (dist <= rangeNeeded) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            // Wenn in Linie -> Feuer frei!
            if (dx < 1 || dy < 1) return { shouldPlant: true };
        }
    }

    // 2. Kisten Check (Effizienz)
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    
    if (wallsHit === 0) return { shouldPlant: false };

    // Wenn wir viele Kisten treffen -> Immer gut
    if (wallsHit >= 2) return { shouldPlant: true };

    // Wenn nur 1 Kiste: Prüfen ob ein Nachbarfeld BESSER ist
    // Auf HARD suchen wir aktiv nach "Sweet Spots"
    if (difficulty === DIFFICULTIES.HARD) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        // Wenn ein Nachbarfeld mehr trifft als wir hier -> Warten und hingehen
        if (bestNeighborHits > wallsHit) {
            return { shouldPlant: false }; 
        }
    }

    // Sonst legen (50% Chance um nicht zu robotisch zu wirken)
    return { shouldPlant: Math.random() < 0.5 };
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
        // Nur begehbare, sichere Nachbarn prüfen
        if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0) {
            const hits = countDestroyableWalls(nx, ny, range);
            if (hits > maxHits) maxHits = hits;
        }
    });
    return maxHits;
}

function pickSmartTarget(bot, gx, gy, dangerMap) {
    // A) Suche "Sweet Spot" (Viele Kisten) in direkter Nähe (HARD)
    if (state.difficulty === DIFFICULTIES.HARD) {
        let bestSpot = null;
        let maxHits = 0;
        
        DIRS.forEach(d => {
            const nx = gx+d.x; const ny = gy+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0) {
                const hits = countDestroyableWalls(nx, ny, bot.bombRange);
                // Wenn wir einen Spot mit >= 2 Kisten finden, gehen wir hin!
                if (hits >= 2 && hits > maxHits) {
                    maxHits = hits;
                    bestSpot = {x: nx, y: ny};
                }
            }
        });
        if (bestSpot) return bestSpot;
    }

    // B) Gegner jagen (Breach auf Hard)
    const enemy = findNearestEnemy(bot);
    const canBreach = (state.difficulty === DIFFICULTIES.HARD && bot.maxBombs >= 2);
    
    if (enemy && (state.difficulty === DIFFICULTIES.HARD || Math.random() < 0.5)) {
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (pathStep) {
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null; // Warten & Sprengen
            return pathStep;
        }
    }

    // C) Loot / Kisten suchen
    const lootStep = findNearestLootBFS(gx, gy, dangerMap);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

    // D) Random Safe Neighbor
    return getRandomSafeNeighbor(gx, gy, dangerMap);
}

// ==========================================
//              SAFETY & SIMULATION
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

    const queue = [{x: gx, y: gy, path: []}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return curr.path; 
        }

        if (curr.path.length > 8) continue; 

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0) {
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
                // Bei Flucht akzeptieren wir Radius-Gefahr (1), meiden aber Feuer (2)
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
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

        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || item!==ITEMS.NONE)) {
            return curr.first || {x:curr.x, y:curr.y};
        }
        if (t===TYPES.WALL_SOFT) continue;

        for(let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if(!isSolid(nx, ny) && dangerMap[ny][nx]===0 && !visited.has(`${nx},${ny}`)) {
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