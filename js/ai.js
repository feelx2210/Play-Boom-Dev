import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES, DIRECTION_PADS } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globales Gedächtnis
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { 
            state: 'IDLE',      // IDLE, MOVING, SURVIVING, KICKING
            target: null,       
            patience: 0,
            lockedPath: null
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // DangerMap inkl. Rolling-Bomb-Projection
    const dangerMap = getDangerMap(); 
    const currentDanger = dangerMap[gy][gx];

    // ---------------------------------------------------------
    // 1. SURVIVAL MODE (Absoluter Vorrang)
    // ---------------------------------------------------------
    // Flucht, wenn in Gefahr. Ausnahme: Wir sind im "KICKING" Modus und stehen sicher (die Bombe vor uns ist keine Gefahr, solange wir sie kicken)
    if (currentDanger > 0 || mem.state === 'SURVIVING') {
        // Wenn wir gerade kicken wollen, aber das Feld plötzlich tödlich ist (z.B. andere Explosion), abbrechen!
        if (mem.state === 'KICKING' && currentDanger > 0) {
            mem.state = 'SURVIVING'; // Kick abbrechen, Flucht!
        }

        if (mem.state !== 'KICKING') {
            mem.state = 'SURVIVING';
            mem.target = null;

            // Pfad fertig?
            const pathFinished = (!mem.lockedPath || mem.lockedPath.length === 0);

            // Entwarnung?
            if (currentDanger === 0 && pathFinished) {
                snapToGrid(bot);
                mem.state = 'IDLE';
                mem.lockedPath = null;
                return; 
            }

            // Neuen Pfad suchen
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
                } else {
                    moveToPixel(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
                }
            }
            return;
        }
    }

    // ---------------------------------------------------------
    // 2. MOVEMENT (Ziel anlaufen)
    // ---------------------------------------------------------
    if ((mem.state === 'MOVING' || mem.state === 'KICKING') && mem.target) {
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);

        // Validierung: Ziel noch sicher? (Beim Kicken ist das Ziel die Bombe, das ist ok)
        const isKickTarget = (mem.state === 'KICKING');
        
        // Prüfe Hindernisse (außer wir kicken gerade eine Bombe weg)
        let blocked = isSolid(tx, ty);
        if (isKickTarget && state.grid[ty][tx] === TYPES.BOMB) blocked = false; // Bombe ist kein Hindernis beim Kicken

        if (dangerMap[ty][tx] > 0 || blocked) {
            mem.state = 'IDLE';
            mem.target = null;
        } else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            // Wenn wir gekickt haben, bleiben wir nicht stehen, sondern suchen sofort Schutz/neues Ziel
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
        
        const isHard = state.difficulty === DIFFICULTIES.HARD;

        // A) KICK CHECK (Nur wenn Rolling Item aktiv)
        if (bot.hasRolling && isHard) {
            const kickTarget = checkForKickOpportunity(bot, gx, gy);
            if (kickTarget) {
                mem.state = 'KICKING';
                mem.target = { x: kickTarget.x * TILE_SIZE, y: kickTarget.y * TILE_SIZE };
                moveToPixel(bot, mem.target.x, mem.target.y);
                return;
            }
        }

        // B) BOMBEN CHECK
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

        // C) NEUES ZIEL SUCHEN
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
//              TACTICS & INTELLIGENCE
// ==========================================

// Prüft, ob man eine Bombe kicken kann, um jemanden zu treffen
function checkForKickOpportunity(bot, gx, gy) {
    // Suche angrenzende Bomben
    for (let d of DIRS) {
        const bx = gx + d.x;
        const by = gy + d.y;
        
        // Ist da eine Bombe?
        if (state.grid[by] && state.grid[by][bx] === TYPES.BOMB) {
            // Simulieren: Wohin würde sie rollen?
            // Wir kicken in Richtung 'd'
            const hitEnemy = simulateRollingBomb(bx, by, d);
            if (hitEnemy) {
                // Treffer! Wir wollen zu dieser Bombe laufen (und sie damit kicken)
                return { x: bx, y: by };
            }
        }
    }
    return null;
}

function simulateRollingBomb(startGx, startGy, dir) {
    let currX = startGx;
    let currY = startGy;
    let currDir = dir;
    let steps = 0;

    // Simuliere den Pfad der Bombe
    while (steps < 20) { // Max Distanz
        // Nächste Kachel prüfen
        // Richtungs-Pads berücksichtigen
        const pad = DIRECTION_PADS.find(p => p.x === currX && p.y === currY);
        if (pad) currDir = pad.dir;

        const nextX = currX + currDir.x;
        const nextY = currY + currDir.y;

        // Kollision? (Wand, andere Bombe, Softwall)
        if (isSolidWall(nextX, nextY) || (state.grid[nextY] && state.grid[nextY][nextX] === TYPES.WALL_SOFT)) {
            return false; // Stoppt an Wand
        }

        // Treffer? (Gegner)
        const hitEnemy = state.players.find(p => p.alive && p.id !== 1 && Math.round(p.x/TILE_SIZE) === nextX && Math.round(p.y/TILE_SIZE) === nextY);
        // Oder den Spieler (ID 1)
        const hitPlayer = state.players.find(p => p.id === 1 && p.alive && Math.round(p.x/TILE_SIZE) === nextX && Math.round(p.y/TILE_SIZE) === nextY);

        if (hitPlayer || hitEnemy) return true; // JA!

        currX = nextX;
        currY = nextY;
        steps++;
    }
    return false;
}

function analyzePosition(bot, gx, gy, difficulty, dangerMap) {
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        const rangeNeeded = (difficulty === DIFFICULTIES.HARD) ? bot.bombRange + 2 : bot.bombRange;
        
        if (dist <= rangeNeeded) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            if (dx < 1 || dy < 1) return { shouldPlant: true };
        }
    }

    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    if (wallsHit === 0) return { shouldPlant: false };
    if (wallsHit >= 2) return { shouldPlant: true };

    if (difficulty === DIFFICULTIES.HARD) {
        const bestNeighborHits = getBestNeighborSpot(gx, gy, bot.bombRange, dangerMap);
        if (bestNeighborHits > wallsHit) return { shouldPlant: false }; 
    }

    return { shouldPlant: Math.random() < 0.5 };
}

function pickSmartTarget(bot, gx, gy, dangerMap) {
    // 1. ITEMS (Greedy: Sammle alles ein was nah ist)
    // Sucht im Radius von 6 Tiles nach Items
    const itemStep = findNearestItemBFS(gx, gy, dangerMap, 6);
    if (itemStep) return itemStep;

    // 2. HARD MODE: Sweet Spots & Jagen
    if (state.difficulty === DIFFICULTIES.HARD) {
        // Suche Spot mit vielen Kisten
        const sweetSpot = findSweetSpot(gx, gy, dangerMap, bot.bombRange);
        if (sweetSpot) return sweetSpot;
    }

    // 3. GEGNER JAGEN
    const enemy = findNearestEnemy(bot);
    const canBreach = (state.difficulty === DIFFICULTIES.HARD && bot.maxBombs >= 2);
    
    if (enemy && (state.difficulty === DIFFICULTIES.HARD || Math.random() < 0.5)) {
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (pathStep) {
            if (state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) return null; 
            return pathStep;
        }
    }

    // 4. LOOT (Kisten)
    const lootStep = findNearestLootBFS(gx, gy, dangerMap);
    if (lootStep) {
        if (state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) return null;
        return lootStep;
    }

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

        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) return curr.path; 
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
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, path:[...curr.path, {x:nx, y:ny}]});
                }
            }
        }
    }
    return null;
}

// ==========================================
//              HELPERS & FINDERS
// ==========================================

function findNearestItemBFS(sx, sy, dangerMap, limitRange) {
    const queue = [{x:sx, y:sy, first:null, dist:0}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 200) {
        const curr = queue.shift();
        if (curr.dist > limitRange) continue;

        // Item gefunden?
        if (state.items[curr.y][curr.x] !== ITEMS.NONE) {
            return curr.first || {x:curr.x, y:curr.y}; // Sofort hin!
        }

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

function findSweetSpot(gx, gy, dangerMap, range) {
    // Sucht in der Nähe nach einem Feld, wo man >= 2 Kisten sprengen kann
    // (Vereinfachte Suche in Nachbarschaft)
    let best = null;
    let maxHits = 1;

    // Wir scannen einfach einen Radius von 5
    for(let y=Math.max(1, gy-5); y<Math.min(GRID_H-1, gy+5); y++) {
        for(let x=Math.max(1, gx-5); x<Math.min(GRID_W-1, gx+5); x++) {
            if (!isSolid(x, y) && dangerMap[y][x] === 0) {
                const hits = countDestroyableWalls(x, y, range);
                if (hits > maxHits) {
                    maxHits = hits;
                    best = {x, y};
                }
            }
        }
    }
    // Pfad dorthin prüfen? Das würde hier zu teuer.
    // Wir geben es nur zurück, wenn es "nah genug" ist (Manhattan Dist < 5)
    if (best && (Math.abs(best.x-gx) + Math.abs(best.y-gy)) < 5) return findNextStepAStar(gx, gy, best.x, best.y, dangerMap, false);
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

function getEffectiveBlastRange(gx, gy, baseRange) {
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === gx && p.y === gy);
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;
    if (isBoost || isOil) return 15;
    return baseRange;
}

function getDangerMap() {
    // 0=Safe, 1=Radius, 2=Deadly
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        const r = getEffectiveBlastRange(b.gx, b.gy, b.range);
        
        // ROLLENDE BOMBEN PROJEKTION (Dodge Line)
        if (b.isRolling) {
            let cx = b.gx; let cy = b.gy;
            for(let k=0; k<10; k++) { // Projiziere 10 Felder voraus
                cx += b.rollDir.x; cy += b.rollDir.y;
                if(isSolid(cx, cy)) break;
                map[cy][cx] = 1; // "Gefahr" - Bot weicht aus
            }
        }

        // Explosionsradius
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