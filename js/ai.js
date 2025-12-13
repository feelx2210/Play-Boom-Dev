import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js'; // Wird nur noch für Wände genutzt

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // DangerMap: 2 = Tödlich (Feuer/Bombe), 1 = Gefährlich (Explosionsradius)
    const dangerMap = getDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // 1. NOTFALL-FLUCHT (Override alles)
    if (currentDanger > 0) {
        bot.aiTargetX = null; // Ziel vergessen
        const escapeDir = findEscapeRoute(gx, gy, dangerMap);
        
        // Sofort bewegen (kein Grid Snap)
        if (escapeDir.x !== 0 || escapeDir.y !== 0) {
            bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
            
            // Animation
            if (escapeDir.x !== 0) bot.lastDir = {x:Math.sign(escapeDir.x), y:0};
            else bot.lastDir = {x:0, y:Math.sign(escapeDir.y)};
        }
        return; 
    }

    // 2. GRID MOVEMENT (Ruhige Bewegung)
    if (bot.aiTargetX !== null) {
        // Ziel prüfen
        if (isWall(bot.aiTargetX, bot.aiTargetY) || dangerMap[bot.aiTargetY][bot.aiTargetX] > 0) {
            bot.aiTargetX = null; // Abbruch
        } else {
            const tPx = bot.aiTargetX * TILE_SIZE;
            const tPy = bot.aiTargetY * TILE_SIZE;
            const dx = tPx - bot.x;
            const dy = tPy - bot.y;
            
            if (Math.sqrt(dx*dx + dy*dy) <= bot.speed) {
                bot.x = tPx; bot.y = tPy;
                bot.aiTargetX = null; // Angekommen
            } else {
                const mx = Math.sign(dx)*bot.speed;
                const my = Math.sign(dy)*bot.speed;
                if(mx) bot.lastDir={x:Math.sign(mx), y:0};
                else if(my) bot.lastDir={x:0, y:Math.sign(my)};
                
                bot.move(mx, my);
                return;
            }
        }
    }

    // 3. ENTSCHEIDUNG (Im Stillstand)
    let nextMove = {x:0, y:0};
    
    // Zielwahl
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    // Modus
    let mode = 'FARM';
    // Pfadberechnung: Ignoriert Bomben als Hindernis (wir haben ja DangerMap)
    const pathToEnemy = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false) : null;

    if (state.difficulty === DIFFICULTIES.HARD) {
        if (pathToEnemy) mode = 'HUNT';
        else if (bot.maxBombs >= 2 && enemy) mode = 'BREACH';
    } else {
        if (pathToEnemy && Math.random() < 0.5) mode = 'HUNT';
    }

    // A) HUNT
    if (mode === 'HUNT' && enemy) {
        nextMove = pathToEnemy || {x:0, y:0};
        
        // Aggressives Bomben
        if (bot.activeBombs < bot.maxBombs) {
            const dist = Math.hypot(enemy.x-bot.x, enemy.y-bot.y) / TILE_SIZE;
            const aligned = (Math.abs(enemy.x-bot.x)<12 || Math.abs(enemy.y-bot.y)<12);
            
            // Lege Bombe wenn:
            // 1. Gegner in Reichweite
            // 2. Sicherer Fluchtweg existiert
            if (dist <= bot.bombRange && aligned) {
                if (canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Sofort Flucht im selben Frame
                    const esc = findEscapeRoute(gx, gy, getDangerMap());
                    bot.move(esc.x*bot.speed, esc.y*bot.speed);
                    return;
                }
            }
        }
    }
    // B) BREACH / FARM
    else if (mode === 'BREACH' || mode === 'FARM') {
        let targetPath = null;
        if (mode === 'BREACH' && enemy) {
            targetPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true);
        }
        if (!targetPath) {
            targetPath = findNearestLoot(gx, gy, dangerMap);
        }

        if (targetPath) {
            const nx = gx + targetPath.x;
            const ny = gy + targetPath.y;
            // Softwall im Weg?
            if (state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT) {
                if (bot.activeBombs < bot.maxBombs && canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    const esc = findEscapeRoute(gx, gy, getDangerMap());
                    bot.move(esc.x*bot.speed, esc.y*bot.speed);
                    return;
                }
                nextMove = {x:0, y:0}; // Warten
            } else {
                nextMove = targetPath;
            }
        } else {
            if (Math.random()<0.1) nextMove = getRandomSafeDir(gx, gy, dangerMap);
        }
    }

    // 4. AUSFÜHRUNG
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        if (!isWall(tx, ty) && !isOccupiedByBot(tx, ty, bot.id)) {
            bot.aiTargetX = tx; bot.aiTargetY = ty;
        }
    }
}

// --- CORE HELPERS ---

// Eigener Check: Bomben sind KEINE Wände für die KI (Physik regelt das, KI muss planen)
function isWall(x, y) {
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    const t = state.grid[y][x];
    return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT; // Bomben ignoriert!
}

function canPlantAndEscape(gx, gy, currentDangerMap, range) {
    // Simuliere Explosion
    const blast = new Set();
    blast.add(`${gx},${gy}`);
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isWall(tx, ty)) break; // Wall stop
            blast.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // Suche sicheren Hafen (BFS)
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 200) break;
        const curr = queue.shift();
        
        // Ist Feld sicher? (Nicht in Blast und keine alte Gefahr)
        if (!blast.has(`${curr.x},${curr.y}`) && currentDangerMap[curr.y][curr.x] === 0) {
            return true;
        }
        if (curr.dist > 5) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            // WICHTIG: Wir dürfen durch "werdende Explosionen" laufen, um zu entkommen
            if (!isWall(nx, ny) && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, dist:curr.dist+1});
            }
        }
    }
    return false;
}

function findEscapeRoute(gx, gy, dangerMap) {
    if (dangerMap[gy][gx] === 0) return {x:0, y:0};

    const queue = [{x:gx, y:gy, firstMove:null}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 300) break;
        const curr = queue.shift();
        
        if (dangerMap[curr.y][curr.x] === 0) return curr.firstMove || {x:0, y:0};

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            // Flucht nur auf freie Felder, die KEIN Feuer sind (Gefahr=2)
            // Durch Gefahr=1 (Radius) dürfen wir laufen
            if (!isWall(nx, ny) && !visited.has(`${nx},${ny}`)) {
                // Vermeide aktives Feuer (2) und andere Bots
                if (dangerMap[ny][nx] < 2 && !isOccupiedByBot(nx, ny, -1)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, firstMove: curr.firstMove || d});
                }
            }
        }
    }
    return getRandomSafeDir(gx, gy, dangerMap);
}

function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls) {
    const queue = [{x:sx, y:sy, firstMove:null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 500) break;
        const curr = queue.shift();
        if (curr.x===tx && curr.y===ty) return curr.firstMove;
        
        // Greedy Sort
        const neighbors = DIRS.map(d=>({x:curr.x+d.x, y:curr.y+d.y, dir:d}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (isWall(n.x, n.y)) {
                // Breach Mode: Softwall ist okay
                if (!allowSoftWalls || state.grid[n.y][n.x] === TYPES.WALL_HARD) continue;
            }
            if (visited.has(`${n.x},${n.y}`)) continue;
            // DangerMap > 0 vermeiden
            if (dangerMap[n.y][n.x] > 0) continue;
            
            visited.add(`${n.x},${n.y}`);
            queue.push({x:n.x, y:n.y, firstMove: curr.firstMove || n.dir});
        }
    }
    return null;
}

function findNearestLoot(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, firstMove:null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 600) break;
        const curr = queue.shift();
        
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        // Ziel gefunden
        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || item!==ITEMS.NONE)) return curr.firstMove;
        
        if (t===TYPES.WALL_SOFT && (curr.x!==sx || curr.y!==sy)) continue;

        for (let d of DIRS) {
            const nx=curr.x+d.x; const ny=curr.y+d.y;
            if (!isWall(nx, ny) && !visited.has(`${nx},${ny}`) && dangerMap[ny][nx]===0) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, firstMove:curr.firstMove||d});
            }
        }
    }
    return null;
}

// --- UTILS ---

function getDangerMap() {
    // 0=Safe, 1=Radius (noch sicher, aber gleich tot), 2=Tödlich (Feuer)
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 1; 
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isWall(tx, ty)) break;
                map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    // Hellfire
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isWall(tx,ty)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}

function findNearestEnemy(bot) {
    let nearest=null, minDist=Infinity;
    state.players.forEach(p => {
        if(p===bot || !p.alive) return;
        const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
        if(d<minDist){ minDist=d; nearest=p; }
    });
    return nearest;
}

function isOccupiedByBot(gx, gy, selfId) {
    return state.players.some(p => p.id!==selfId && p.alive && Math.round(p.x/TILE_SIZE)===gx && Math.round(p.y/TILE_SIZE)===gy);
}

function getRandomSafeDir(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => !isWall(gx+d.x, gy+d.y) && dangerMap[gy+d.y][gx+d.x]===0);
    return valid.length>0 ? valid[Math.floor(Math.random()*valid.length)] : {x:0,y:0};
}