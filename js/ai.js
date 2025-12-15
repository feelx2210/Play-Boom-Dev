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
        mem.target = null; 

        // Check: Ist der Pfad abgearbeitet?
        const pathFinished = (!mem.lockedPath || mem.lockedPath.length === 0);

        // Wenn sicher und fertig -> Modus beenden
        if (currentDanger === 0 && pathFinished) {
            snapToGrid(bot);
            mem.state = 'IDLE';
            mem.lockedPath = null;
            return; 
        }

        // Wenn kein Pfad, aber Gefahr -> Suchen
        if (pathFinished) {
            const escapePath = findEscapePathBFS(gx, gy, dangerMap);
            if (escapePath && escapePath.length > 0) {
                mem.lockedPath = escapePath;
            } else {
                moveRandomly(bot); // Panik
                return;
            }
        }

        // Pfad folgen
        if (mem.lockedPath && mem.lockedPath.length > 0) {
            const nextStep = mem.lockedPath[0];
            if (hasReachedPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE)) {
                mem.lockedPath.shift(); 
                // Nicht snapToGrid hier, um flüssig zu bleiben
            } else {
                moveToPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
            }
        }
        return; 
    }

    // ---------------------------------------------------------
    // 2. MOVEMENT (Ziel anlaufen)
    // ---------------------------------------------------------
    if (mem.state === 'MOVING' && mem.target) {
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);

        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
            mem.state = 'IDLE'; // Ziel blockiert/gefährlich
            mem.target = null;
        } else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            snapToGrid(bot);
            mem.state = 'IDLE'; // Angekommen
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
        
        // A) BOMBEN CHECK (Angriff, Falle, Farmen)
        if (bot.activeBombs < bot.maxBombs) {
            const analysis = analyzePosition(bot, gx, gy, state.difficulty, dangerMap);
            
            if (analysis.shouldPlant) {
                // Safety Simulation
                const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
                const escapePath = simulateBombAndFindEscape(gx, gy, dangerMap, realRange);

                if (escapePath) {
                    bot.plantBomb();
                    mem.state = 'SURVIVING';
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
//              STRATEGIE LOGIK (UPDATED)
// ==========================================

function analyzePosition(bot, gx, gy, difficulty, dangerMap) {
    const isHard = difficulty === DIFFICULTIES.HARD;
    const human = state.players.find(p => p.id === 1 && p.alive);

    // 1. TRAP CHECK (Fallensteller - NUR HARD)
    // Wenn der Spieler in einer Sackgasse ist und wir den Ausgang blockieren
    if (isHard && human) {
        if (isTrapOpportunity(bot, gx, gy, human)) {
            return { shouldPlant: true, reason: 'trap' };
        }
    }

    // 2. KILL CHECK (Direkter Angriff)
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const rangeNeeded = isHard ? bot.bombRange + 3 : bot.bombRange; // Hard sniped weite Distanzen
        
        if (dist <= rangeNeeded) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            // In Schusslinie?
            if (dx < 1 || dy < 1) return { shouldPlant: true, reason: 'kill' };
        }
    }

    // 3. FARM CHECK (Effizienz)
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    
    if (wallsHit === 0) return { shouldPlant: false };

    // Wenn wir viele Kisten treffen (>= 2), oder auf EASY/MEDIUM sind -> Legen
    if (wallsHit >= 2 || !isHard) return { shouldPlant: true };

    // Auf HARD: Optimierung!
    // Wenn wir nur 1 Kiste treffen, schauen wir, ob ein Nachbarfeld besser ist.
    if (isHard && wallsHit === 1) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        // Wenn ein Nachbar mehr trifft -> Warten und dort hingehen
        if (bestNeighborHits > wallsHit) {
            return { shouldPlant: false }; 
        }
    }

    // Zufallsfaktor damit sie nicht sofort bei jeder einzelnen Kiste zünden
    return { shouldPlant: Math.random() < 0.6 };
}

// NEU: Erkennt, ob der Bot den Spieler einsperren kann
function isTrapOpportunity(bot, gx, gy, target) {
    const tx = Math.round(target.x / TILE_SIZE);
    const ty = Math.round(target.y / TILE_SIZE);
    const dist = Math.abs(gx - tx) + Math.abs(gy - ty);

    // Nur versuchen, wenn wir relativ nah sind (sonst ist der Spieler längst weg)
    if (dist > 5) return false;

    // 1. Analyse der Spieler-Umgebung: Wie viele Auswege hat er?
    let freeExits = [];
    DIRS.forEach(d => {
        const nx = tx + d.x; const ny = ty + d.y;
        if (!isSolid(nx, ny) && !isHazard(nx, ny)) {
            freeExits.push({x: nx, y: ny});
        }
    });

    // Wenn der Spieler fast eingesperrt ist (nur 1 oder 2 Auswege)
    if (freeExits.length > 0 && freeExits.length <= 2) {
        // 2. Simuliere unsere Bombe an (gx, gy)
        // Deckt unsere Bombe ALLE verbleibenden Auswege ab?
        const range = bot.bombRange;
        
        // Checken wir, ob jeder Exit von der Explosion getroffen würde
        const allExitsCovered = freeExits.every(exit => {
            // Ist Exit auf gleicher X-Achse und in Reichweite?
            const onX = (exit.y === gy && Math.abs(exit.x - gx) <= range);
            // Ist Exit auf gleicher Y-Achse und in Reichweite?
            const onY = (exit.x === gx && Math.abs(exit.y - gy) <= range);
            
            // Sichtlinie prüfen (keine Hardwall dazwischen)
            // (Vereinfacht: Wir gehen davon aus, dass in engen Gängen meist Sichtlinie besteht)
            return onX || onY;
        });

        if (allExitsCovered) return true; // FALLE ZUSCHNAPPEN LASSEN!
    }
    return false;
}

function pickSmartTarget(bot, gx, gy, dangerMap) {
    const isHard = state.difficulty === DIFFICULTIES.HARD;

    // A) SWEET SPOTS (Viele Kisten) - Auf Hard bevorzugt
    if (isHard) {
        // Scanne Umgebung nach einem Spot, der viele Kisten sprengt
        const sweetSpot = findMultiWallSpot(gx, gy, dangerMap, bot.bombRange);
        if (sweetSpot) return sweetSpot;
    }

    // B) GEGNER JAGEN
    const enemy = findNearestEnemy(bot);
    const canBreach = (isHard && bot.maxBombs >= 2); // Durch Wände graben
    
    if (enemy && (isHard || Math.random() < 0.5)) {
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (pathStep) {
            // Wenn der Schritt auf eine Kiste führt -> Stehenbleiben (damit Bomb-Logic greift)
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null;
            return pathStep;
        }
    }

    // C) LOOT SUCHEN
    const lootStep = findNearestLootBFS(gx, gy, dangerMap);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

    // D) Random Safe Neighbor
    return getRandomSafeNeighbor(gx, gy, dangerMap);
}

// ==========================================
//              ALGORITHMEN & SIMULATION
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

function findMultiWallSpot(gx, gy, dangerMap, range) {
    // Sucht im Radius 5 nach einem Feld, wo man >= 2 Kisten trifft
    let bestSpot = null;
    let bestHits = 1;

    for (let y = Math.max(1, gy-5); y < Math.min(GRID_H-1, gy+5); y++) {
        for (let x = Math.max(1, gx-5); x < Math.min(GRID_W-1, gx+5); x++) {
            // Ist das Feld erreichbar und sicher?
            if (!isSolid(x, y) && dangerMap[y][x] === 0) {
                const hits = countDestroyableWalls(x, y, range);
                if (hits > bestHits) {
                    bestHits = hits;
                    bestSpot = {x, y};
                }
            }
        }
    }
    
    // Wenn wir einen Super-Spot gefunden haben, Pfad dorthin berechnen
    if (bestSpot) {
        // Ist er nah genug?
        return findNextStepAStar(gx, gy, bestSpot.x, bestSpot.y, dangerMap, false);
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
    // Checkt ob Feld generell gefährlich ist (Bombe, Feuer)
    // Wird für die Trapping-Analyse verwendet
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    const tile = state.grid[y][x];
    if (tile === TYPES.BOMB) return true;
    // Partikel check
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