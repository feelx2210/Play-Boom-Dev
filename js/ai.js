import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Gedächtnis für Bots
const botMemory = {};

export function updateBotLogic(bot) {
    // 1. INIT
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = {
            state: 'IDLE',      // IDLE, MOVING, FLEEING
            target: null,       // {x, y} Pixel-Ziel
            escapePath: [],     // Liste von {x,y} Kacheln für die Flucht
            patience: 0
        };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // --- 1. FLUCHT MODUS (Absolut vorrangig) ---
    // Wenn wir einen festen Fluchtweg haben ODER in Gefahr sind
    if (mem.escapePath.length > 0 || currentDanger > 0) {
        mem.state = 'FLEEING';
        mem.target = null; // Normales Ziel vergessen

        // Haben wir noch Schritte im Plan?
        if (mem.escapePath.length > 0) {
            const nextStep = mem.escapePath[0];
            // Sind wir da?
            if (gx === nextStep.x && gy === nextStep.y) {
                mem.escapePath.shift(); // Schritt erledigt
                // Rekursiver Aufruf für sofortige Reaktion
                return updateBotLogic(bot); 
            }
            // Bewegen zum nächsten Schritt im Plan
            moveTowards(bot, nextStep.x * TILE_SIZE, nextStep.y * TILE_SIZE);
            return;
        } 
        
        // Kein Plan, aber Gefahr? -> Notfall-Suche (Panic Mode)
        if (currentDanger > 0) {
            const safeTile = findSafeTileBFS(gx, gy, dangerMap);
            if (safeTile) {
                moveTowards(bot, safeTile.x * TILE_SIZE, safeTile.y * TILE_SIZE);
            } else {
                moveRandomly(bot); // Panik
            }
            return;
        }
        
        // Sicher und Plan leer -> Reset
        mem.state = 'IDLE';
    }

    // --- 2. GRID MOVEMENT (Normales Laufen) ---
    if (mem.target) {
        // Zielvalidierung: Ist das Ziel sicher?
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);
        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
            mem.target = null; // Abbruch
        } else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            bot.x = mem.target.x; bot.y = mem.target.y; // Snap
            mem.target = null; // Angekommen
        } else {
            moveTowards(bot, mem.target.x, mem.target.y);
            return;
        }
    }

    // --- 3. ENTSCHEIDUNG (Nur im Stillstand & Sicher) ---
    // Hier wird das nächste Ziel oder eine Bombe geplant
    
    // Settings
    let huntProb = 0.2;
    if (state.difficulty === DIFFICULTIES.MEDIUM) huntProb = 0.5;
    if (state.difficulty === DIFFICULTIES.HARD) huntProb = 0.9;

    // A) BOMBEN CHECK
    // Nur wenn wir mittig stehen und eine Bombe haben
    const isAligned = Math.abs(bot.x - gx*TILE_SIZE) < 4 && Math.abs(bot.y - gy*TILE_SIZE) < 4;
    
    if (isAligned && bot.activeBombs < bot.maxBombs) {
        if (shouldPlantBomb(bot, gx, gy, huntProb)) {
            // CRUCIAL: Berechne den Fluchtweg BEVOR wir legen!
            // Wir simulieren MAXIMALE Gefahr (Range 15 bei Öl, sonst normal)
            const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
            const escapeRoute = calculateEscapePath(gx, gy, dangerMap, realRange);

            if (escapeRoute) {
                // Wir haben einen validen Plan!
                bot.plantBomb();
                mem.escapePath = escapeRoute; // Plan speichern
                mem.state = 'FLEEING';
                
                // Sofort den ersten Schritt machen
                const firstStep = mem.escapePath[0];
                moveTowards(bot, firstStep.x * TILE_SIZE, firstStep.y * TILE_SIZE);
                return;
            }
        }
    }

    // B) ZIELSUCHE (Navigation)
    let nextTile = pickNextTile(bot, gx, gy, dangerMap, huntProb);
    if (nextTile) {
        mem.target = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE };
        moveTowards(bot, mem.target.x, mem.target.y);
    } else {
        // Fallback: Random Safe Move gegen Einfrieren
        if (Math.random() < 0.1) moveRandomly(bot);
    }
}

// ================= LOGIK KERN =================

// Berechnet eine Liste von Koordinaten [ {x,y}, {x,y} ] um in Sicherheit zu kommen
function calculateEscapePath(gx, gy, currentDangerMap, range) {
    // 1. Virtuelle Explosion
    const virtualDanger = new Set();
    virtualDanger.add(`${gx},${gy}`);
    
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; // Hardwall
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Softwall
        }
    });

    // 2. BFS Suche nach sicherem Feld
    // Node Struktur: { x, y, path: [] }
    const queue = [{ x: gx, y: gy, path: [] }];
    const visited = new Set([`${gx},${gy}`]);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 300) break;
        const curr = queue.shift();
        
        const key = `${curr.x},${curr.y}`;
        
        // Ist dies ein sicherer Hafen?
        // - Nicht in der virtuellen Explosion
        // - Nicht in aktueller Gefahr (andere Bomben)
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return curr.path; // Pfad gefunden! (Kann leer sein, wenn wir schon sicher sind, aber hier unwahrscheinlich da start=bomb)
        }

        if (curr.path.length > 6) continue; // Zu weit

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            
            // Bewegung nur auf freien Feldern
            // WICHTIG: Wir dürfen NICHT in echte Gefahr laufen (currentDangerMap > 0)
            if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                // Pfad kopieren und erweitern
                const newPath = [...curr.path, {x: nx, y: ny}];
                queue.push({ x: nx, y: ny, path: newPath });
            }
        }
    }
    return null; // Kein Weg gefunden
}

function shouldPlantBomb(bot, gx, gy, huntProb) {
    const enemy = findNearestEnemy(bot);
    
    // 1. Angriff
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        // Auf Hard legen wir aggressiver, auch wenn Gegner etwas weiter weg ist
        if (dist <= bot.bombRange && Math.random() < huntProb) {
            // Nur legen, wenn wir grob auf einer Linie sind (Sniping)
            if (Math.abs(enemy.x - bot.x) < 20 || Math.abs(enemy.y - bot.y) < 20) return true;
        }
    }

    // 2. Farming (Kiste zerstören)
    return DIRS.some(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });
}

function pickNextTile(bot, gx, gy, dangerMap, huntProb) {
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    // Ziel: Gegner oder Loot
    let target = null;
    let mode = 'FARM';

    if (enemy && Math.random() < huntProb) {
        // Versuch Pfad zum Gegner
        const canBreach = (state.difficulty === DIFFICULTIES.HARD && bot.maxBombs >= 2);
        target = findPathNextStep(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (target) mode = 'HUNT';
    }

    if (!target) {
        target = findNearestLootStep(gx, gy, dangerMap);
    }

    return target;
}

// --- STANDARD HELPERS ---

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

function hasReachedPixel(bot, px, py) {
    return Math.abs(bot.x - px) < 4 && Math.abs(bot.y - py) < 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!isSolid(Math.round((bot.x+d.x*16)/TILE_SIZE), Math.round((bot.y+d.y*16)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
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

function getEffectiveBlastRange(gx, gy, baseRange) {
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === gx && p.y === gy);
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;
    if (isBoost || isOil) return 15;
    return baseRange;
}

// --- PFADFINDUNG (BFS) ---

function findSafeTileBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    while(queue.length > 0) {
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr; // Gefunden
        
        for(let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            if(!isSolid(nx, ny) && !visited.has(`${nx},${ny}`) && dangerMap[ny][nx] < 2) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny}); // Step by step
            }
        }
    }
    return null;
}

function findPathNextStep(sx, sy, tx, ty, dangerMap, canBreach) {
    const queue = [{x:sx, y:sy, step:null}];
    const visited = new Set([`${sx},${sy}`]);
    while(queue.length > 0) {
        const curr = queue.shift();
        if(curr.x===tx && curr.y===ty) return curr.step;
        
        const neighbors = DIRS.map(d=>({x:curr.x+d.x, y:curr.y+d.y, dir:d}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for(let n of neighbors) {
            if(visited.has(`${n.x},${n.y}`)) continue;
            
            let blocked = false;
            const t = state.grid[n.y] ? state.grid[n.y][n.x] : TYPES.WALL_HARD;
            if(t === TYPES.WALL_HARD || t === TYPES.BOMB) blocked = true;
            if(t === TYPES.WALL_SOFT && !canBreach) blocked = true;
            if(dangerMap[n.y][n.x] > 0) blocked = true;

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, step: curr.step || {x:n.x, y:n.y}});
            }
        }
    }
    return null;
}

function findNearestLootStep(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, step:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        
        if ((curr.x!==sx || curr.y!==sy) && (t===TYPES.WALL_SOFT || item!==ITEMS.NONE)) return curr.step;
        if (t===TYPES.WALL_SOFT) continue;

        for(let d of DIRS) {
            const nx=curr.x+d.x, ny=curr.y+d.y;
            if(!isSolid(nx, ny) && !visited.has(`${nx},${ny}`) && dangerMap[ny][nx]===0) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, step:curr.step||{x:nx,y:ny}});
            }
        }
    }
    return null;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        const r = getEffectiveBlastRange(b.gx, b.gy, b.range);
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i, ty=b.gy+d.y*i;
                if(isSolid(tx, ty, true)) break; 
                if(map[ty][tx] < 1) map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    // Hellfire
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