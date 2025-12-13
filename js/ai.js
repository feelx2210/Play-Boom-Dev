import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globaler Cache für "schlechte Bombenspots" pro Bot
// Key: bot.id, Value: Array of {x, y, timestamp}
const plantCooldowns = {};

export function updateBotLogic(bot) {
    // 0. INIT & STATE MANAGEMENT
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }
    if (!plantCooldowns[bot.id]) plantCooldowns[bot.id] = [];
    
    // Cooldowns aufräumen (alte Einträge löschen nach 3 Sekunden)
    const now = Date.now();
    plantCooldowns[bot.id] = plantCooldowns[bot.id].filter(e => now - e.time < 3000);

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentUnsafe = dangerMap[gy][gx] > 0;

    // 1. NOTFALL-FLUCHT (Override alles)
    if (currentUnsafe) {
        bot.aiTargetX = null; // Ziel vergessen
        const escapeDir = findEscapeRoute(gx, gy, dangerMap);
        
        if (escapeDir.x !== 0 || escapeDir.y !== 0) {
            // Sofortige Bewegung ohne Grid-Lock
            bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
            if (escapeDir.x !== 0) bot.lastDir = {x:Math.sign(escapeDir.x), y:0};
            else bot.lastDir = {x:0, y:Math.sign(escapeDir.y)};
        }
        return; 
    }

    // 2. BEWEGUNG ZUM ZIEL (Grid Movement)
    if (bot.aiTargetX !== null) {
        // Ist Ziel plötzlich blockiert oder gefährlich?
        if (isWall(bot.aiTargetX, bot.aiTargetY) || dangerMap[bot.aiTargetY][bot.aiTargetX] > 0) {
            bot.aiTargetX = null; // Abbruch
        } else {
            const tPx = bot.aiTargetX * TILE_SIZE;
            const tPy = bot.aiTargetY * TILE_SIZE;
            const dx = tPx - bot.x;
            const dy = tPy - bot.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Sind wir nah genug für "Arrival"?
            if (dist <= bot.speed) {
                bot.x = tPx; bot.y = tPy; // Snap
                bot.aiTargetX = null;     // Entscheidung anfordern
            } else {
                // Weiterlaufen
                const mx = Math.sign(dx)*bot.speed;
                const my = Math.sign(dy)*bot.speed;
                if(mx) bot.lastDir={x:Math.sign(mx), y:0};
                else if(my) bot.lastDir={x:0, y:Math.sign(my)};
                bot.move(mx, my);
                return; // Keine neue Entscheidung während Lauf
            }
        }
    }

    // 3. ENTSCHEIDUNG (Im Stillstand)
    let nextMove = {x:0, y:0};
    let triedToPlantButFailed = false;

    // A) Kann ich HIER UND JETZT etwas sprengen?
    // Checke alle 4 Richtungen auf Softwalls oder Gegner
    if (bot.activeBombs < bot.maxBombs && !isLocationIgnored(bot.id, gx, gy)) {
        const hasTarget = DIRS.some(d => {
            const tx = gx+d.x; const ty = gy+d.y;
            // Kiste?
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) return true;
            // Gegner?
            const enemy = state.players.find(p => p !== bot && p.alive && Math.round(p.x/TILE_SIZE)===tx && Math.round(p.y/TILE_SIZE)===ty);
            return !!enemy;
        });

        if (hasTarget) {
            if (canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                bot.plantBomb();
                // Sofort Flucht im selben Frame!
                const esc = findEscapeRoute(gx, gy, getDangerMap());
                bot.move(esc.x*bot.speed, esc.y*bot.speed);
                return;
            } else {
                // Merken: Hier ist Bombenlegen doof.
                triedToPlantButFailed = true;
                ignoreLocation(bot.id, gx, gy);
            }
        }
    }

    // B) Neues Ziel suchen
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    let mode = 'FARM';
    // Pfad zum Gegner
    const pathToEnemy = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false) : null;

    if (state.difficulty === DIFFICULTIES.HARD) {
        if (pathToEnemy) mode = 'HUNT';
        else if (bot.maxBombs >= 2 && enemy) mode = 'BREACH';
    } else {
        if (pathToEnemy && Math.random() < 0.5) mode = 'HUNT';
    }

    // Wenn wir gerade hier gescheitert sind, zwingen wir den Bot zum FARMEN/WANDERN
    if (triedToPlantButFailed) mode = 'FARM';

    let targetPath = null;

    if (mode === 'HUNT' && pathToEnemy) {
        targetPath = pathToEnemy;
    } 
    else if (mode === 'BREACH' && enemy) {
        targetPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true);
    }
    
    // Fallback FARM: Sucht nächste Kiste, die NICHT auf der Ignore-Liste steht
    if (!targetPath || mode === 'FARM') {
        targetPath = findNearestLoot(gx, gy, dangerMap, bot.id);
    }

    if (targetPath) {
        nextMove = targetPath;
    } else {
        // Wirklich nichts zu tun? Random walk.
        if (Math.random() < 0.2) nextMove = getRandomSafeDir(gx, gy, dangerMap);
    }

    // 4. BEFEHL AUSFÜHREN
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        
        // Ist das Feld eine Softwall? (Breach Mode)
        if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) {
            // Wir stehen davor. Versuchen zu legen.
            if (bot.activeBombs < bot.maxBombs && canPlantAndEscape(gx, gy, dangerMap, bot.bombRange) && !isLocationIgnored(bot.id, gx, gy)) {
                bot.plantBomb();
                const esc = findEscapeRoute(gx, gy, getDangerMap());
                bot.move(esc.x*bot.speed, esc.y*bot.speed);
                return;
            } else {
                // Können nicht legen -> Ignorieren und woanders hin
                ignoreLocation(bot.id, gx, gy);
                // Warten/Umdrehen
            }
        } else if (!isWall(tx, ty) && !isOccupiedByBot(tx, ty, bot.id)) {
            // Freies Feld -> Gehen
            bot.aiTargetX = tx; 
            bot.aiTargetY = ty;
        }
    }
}

// --- COOLDOWN SYSTEM ---
function ignoreLocation(botId, x, y) {
    plantCooldowns[botId].push({x, y, time: Date.now()});
}
function isLocationIgnored(botId, x, y) {
    return plantCooldowns[botId].some(e => e.x === x && e.y === y);
}

// --- HELPERS ---

function isWall(x, y) {
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    const t = state.grid[y][x];
    return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT; 
}

function canPlantAndEscape(gx, gy, currentDangerMap, range) {
    const blast = new Set();
    blast.add(`${gx},${gy}`);
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isWall(tx, ty)) break;
            blast.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // BFS Suche nach sicherem Feld
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 300) break;
        const curr = queue.shift();
        
        if (!blast.has(`${curr.x},${curr.y}`) && currentDangerMap[curr.y][curr.x] === 0) {
            return true;
        }
        if (curr.dist > 6) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
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
            if (!isWall(nx, ny) && !visited.has(`${nx},${ny}`)) {
                // Flucht: Meide Feuer (2) und Bots
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
        if (iterations++ > 400) break;
        const curr = queue.shift();
        if (curr.x===tx && curr.y===ty) return curr.firstMove;
        
        const neighbors = DIRS.map(d=>({x:curr.x+d.x, y:curr.y+d.y, dir:d}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (isWall(n.x, n.y)) {
                if (!allowSoftWalls || state.grid[n.y][n.x] === TYPES.WALL_HARD) continue;
            }
            if (visited.has(`${n.x},${n.y}`)) continue;
            if (dangerMap[n.y][n.x] > 0) continue;
            
            visited.add(`${n.x},${n.y}`);
            queue.push({x:n.x, y:n.y, firstMove: curr.firstMove || n.dir});
        }
    }
    return null;
}

function findNearestLoot(sx, sy, dangerMap, botId) {
    const queue = [{x:sx, y:sy, firstMove:null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 600) break;
        const curr = queue.shift();
        
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        // Ziel gefunden UND nicht ignoriert
        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || item!==ITEMS.NONE)) {
            // Wenn es eine Softwall ist, prüfen wir, ob sie auf der Ignore-Liste steht (weil wir da nicht sicher bomben können)
            if (t===TYPES.WALL_SOFT && isLocationIgnored(botId, curr.x, curr.y)) {
                // Ignoriertes Ziel -> weitersuchen
            } else {
                return curr.firstMove;
            }
        }
        
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

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    state.particles.forEach(p => { if (p.isFire) map[p.gy][p.gx] = 2; });
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 1; 
        DIRS.forEach(d => {
            for (let i = 1; i <= b.range; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isWall(tx, ty)) break;
                map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
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