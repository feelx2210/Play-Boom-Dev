import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Hilfsspeicher für Bot-Zustände
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { state: 'IDLE', target: null, gridTarget: null, reactionTimer: 0 };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Globale Gefahrenkarte (berücksichtigt jetzt Öl/Boost!)
    const dangerMap = getDangerMap();

    // Settings je nach Schwierigkeit
    let reactionSpeed = 0; 
    let huntProbability = 0.0;
    
    if (state.difficulty === DIFFICULTIES.EASY) {
        reactionSpeed = 15; huntProbability = 0.2;
    } else if (state.difficulty === DIFFICULTIES.MEDIUM) {
        reactionSpeed = 5; huntProbability = 0.5;
    } else { // HARD
        reactionSpeed = 0; huntProbability = 0.9;
    }

    // --- 1. SURVIVAL (Höchste Priorität) ---
    // Ist mein aktuelles Feld gefährlich?
    if (dangerMap[gy][gx] > 0) {
        // Reaktionszeit simulieren
        if (mem.state !== 'FLEEING' && mem.reactionTimer > 0) {
            mem.reactionTimer--; return;
        }

        mem.state = 'FLEEING';
        mem.target = null;

        // Suche sicheren Hafen
        const escapeNode = findSafeTileBFS(gx, gy, dangerMap);
        
        if (escapeNode) {
            // Renn um dein Leben!
            moveTowards(bot, escapeNode.x * TILE_SIZE, escapeNode.y * TILE_SIZE);
        } else {
            moveRandomly(bot); // Panik
        }
        return; 
    } else {
        mem.reactionTimer = reactionSpeed;
    }

    // --- 2. BOMBING (Nur wenn sicher & mittig) ---
    const isAligned = Math.abs(bot.x - gx*TILE_SIZE) < 4 && Math.abs(bot.y - gy*TILE_SIZE) < 4;
    
    if (isAligned && bot.activeBombs < bot.maxBombs) {
        // Lohnt es sich?
        if (shouldPlantBomb(bot, gx, gy, huntProbability)) {
            
            // CHECK: Wie groß wird die Explosion WIRKLICH?
            // (Berücksichtigt Öl, Boost-Pads und Items)
            const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);

            // Habe ich einen Fluchtweg vor DIESER Explosion?
            if (canPlantAndEscape(gx, gy, dangerMap, realRange)) {
                bot.plantBomb();
                mem.state = 'FLEEING'; // Sofort wegrennen erzwingen
                return;
            }
        }
    }

    // --- 3. NAVIGATION ---
    
    // Ziel erreicht oder keins vorhanden? -> Neues suchen
    if (!mem.target || hasReachedTarget(bot, mem.target)) {
        const nextGridInfo = pickNextTile(bot, gx, gy, dangerMap, huntProbability);
        
        if (nextGridInfo) {
            mem.state = 'MOVING';
            mem.gridTarget = nextGridInfo;
            mem.target = { x: nextGridInfo.x * TILE_SIZE, y: nextGridInfo.y * TILE_SIZE };
        } else {
            mem.state = 'IDLE';
            mem.target = null;
        }
    }

    // Bewegen
    if (mem.target) {
        // Ist der Weg noch sicher?
        if (mem.gridTarget && dangerMap[mem.gridTarget.y][mem.gridTarget.x] > 0) {
            mem.target = null; // Abbruch
        } else {
            moveTowards(bot, mem.target.x, mem.target.y);
        }
    }
}

// ================= LOGIK FUNKTIONEN =================

// Berechnet die TATSÄCHLICHE Reichweite einer Bombe an Position x,y
function getEffectiveBlastRange(gx, gy, baseRange) {
    // 1. Level-Specials (Boost Pads)
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && 
                    BOOST_PADS.some(p => p.x === gx && p.y === gy);
    
    // 2. Öl-Feld (Grid Check)
    // Achtung: Wenn Bot drauf steht, ist es evtl. nur im Grid gespeichert, nicht als Item
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;

    if (isBoost || isOil) return 15; // Maximale Map-Größe
    return baseRange;
}

function moveTowards(bot, targetX, targetY) {
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > bot.speed) {
        const mx = (dx / dist) * bot.speed;
        const my = (dy / dist) * bot.speed;
        bot.move(mx, my);
        
        if (Math.abs(mx) > Math.abs(my)) bot.lastDir = {x: Math.sign(mx), y: 0};
        else bot.lastDir = {x: 0, y: Math.sign(my)};
    } else {
        bot.x = targetX; bot.y = targetY; // Snap
    }
}

function hasReachedTarget(bot, target) {
    return Math.abs(bot.x - target.x) < 2 && Math.abs(bot.y - target.y) < 2;
}

function moveRandomly(bot) {
    const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
    const d = dirs[Math.floor(Math.random()*dirs.length)];
    if (!isSolid(Math.round((bot.x+d.x*10)/TILE_SIZE), Math.round((bot.y+d.y*10)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
}

function pickNextTile(bot, gx, gy, dangerMap, huntProb) {
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    let path = null;

    // JAGEN?
    if (enemy && Math.random() < huntProb) {
        const canBreach = (state.difficulty === DIFFICULTIES.HARD && bot.maxBombs >= 2);
        path = findNextStep(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
    }

    // FARMEN? (Fallback)
    if (!path) {
        path = findNearestLootStep(gx, gy, dangerMap);
    }

    // RANDOM SAFE (Notfall)
    if (!path) {
        const safeNeighbors = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
            .filter(n => !isSolid(n.x, n.y) && dangerMap[n.y][n.x] === 0);
        if (safeNeighbors.length > 0) return safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)];
    }

    return path;
}

function shouldPlantBomb(bot, gx, gy, huntProb) {
    // 1. Gegner nah?
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        if (dist <= bot.bombRange && Math.random() < huntProb) {
            // Stehen wir auf einer Linie?
            if (Math.abs(enemy.x - bot.x) < 20 || Math.abs(enemy.y - bot.y) < 20) return true;
        }
    }
    // 2. Kiste im Weg?
    return DIRS.some(d => {
        const nx = gx+d.x, ny = gy+d.y;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });
}

function canPlantAndEscape(gx, gy, currentDangerMap, range) {
    // 1. Simuliere Explosion (mit KORREKTER Reichweite!)
    const virtualDanger = new Set();
    virtualDanger.add(`${gx},${gy}`);
    
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i, ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; 
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });

    // 2. Suche Fluchtweg (BFS)
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([`${gx},${gy}`]);

    while(queue.length > 0) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        // SAFE SPOT? (Nicht in virtueller Explosion & Nicht in echter Gefahr)
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return true; 
        }

        if (curr.dist > 10) continue; // Erhöhtes Limit für lange Tunnel

        for (let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            // Lauf nur auf freie Felder (auch durch virtuelle Gefahr hindurch, um zu entkommen)
            // Aber NIEMALS in echte Gefahr (andere Bomben)
            if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, dist:curr.dist+1});
            }
        }
    }
    return false;
}

function findSafeTileBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, firstStep: null}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr.firstStep || {x:curr.x, y:curr.y};

        for (let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            if (!isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                // Meide Feuer (2), lauf durch Radius (1) wenn nötig
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x:nx, y:ny, firstStep: curr.firstStep || {x:nx, y:ny} });
                }
            }
        }
    }
    return null;
}

function findNextStep(sx, sy, tx, ty, dangerMap, canBreach) {
    const queue = [{x:sx, y:sy, firstStep: null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (curr.x === tx && curr.y === ty) return curr.firstStep;

        const neighbors = DIRS.map(d => ({x:curr.x+d.x, y:curr.y+d.y}))
             .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            const tile = state.grid[n.y] ? state.grid[n.y][n.x] : TYPES.WALL_HARD;
            let blocked = false;
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB) blocked = true;
            if (tile === TYPES.WALL_SOFT && !canBreach) blocked = true;
            if (dangerMap[n.y][n.x] > 0) blocked = true;

            if (!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, firstStep: curr.firstStep || n});
            }
        }
    }
    return null;
}

function findNearestLootStep(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, firstStep:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        if ((curr.x!==sx || curr.y!==sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstStep;
        }
        
        if (tile === TYPES.WALL_SOFT) continue;

        for (let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, firstStep: curr.firstStep || {x:nx, y:ny}});
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

// BERECHNET GEFAHRENKARTE (Inklusive Special-Ranges!)
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        
        // WICHTIG: Effektive Range nutzen!
        // Hier prüfen wir das 'underlyingTile' der Bombe, da sie jetzt auf dem Grid liegt
        const effectiveRange = getEffectiveBlastRange(b.gx, b.gy, b.range);

        DIRS.forEach(d => {
            for(let i=1; i<=effectiveRange; i++) {
                const tx=b.gx+d.x*i, ty=b.gy+d.y*i;
                if(isSolid(tx, ty, true)) break; 
                if(map[ty][tx] < 1) map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i, ty=HELL_CENTER.y+d.y*i;
            if(isSolid(tx,ty,true)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}