import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Hilfsspeicher für Bot-Zustände (verhindert Zappeln)
const botMemory = {};

export function updateBotLogic(bot) {
    // 1. INIT MEMORY
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = {
            state: 'IDLE',      // IDLE, MOVING, FLEEING
            target: null,       // {x, y} in Pixeln
            gridTarget: null,   // {x, y} im Grid
            patience: 0,        // Zähler gegen Stuck-Sein
            reactionTimer: 0    // Reaktionsverzögerung
        };
    }
    const mem = botMemory[bot.id];
    
    // Grid Koordinaten
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Globale Gefahrenkarte holen (0=Sicher, 1=Radius, 2=Tödlich)
    const dangerMap = getDangerMap();

    // --- SCHWIERIGKEITSGRAD PARAMETER ---
    let reactionSpeed = 0; // Frames Verzögerung
    let huntProbability = 0.0;
    
    if (state.difficulty === DIFFICULTIES.EASY) {
        reactionSpeed = 15; // Sehr langsam
        huntProbability = 0.2;
    } else if (state.difficulty === DIFFICULTIES.MEDIUM) {
        reactionSpeed = 5;
        huntProbability = 0.5;
    } else { // HARD
        reactionSpeed = 0; // Sofort
        huntProbability = 0.9;
    }

    // --- 1. SURVIVAL CHECK (Höchste Priorität) ---
    // Stehen wir im Feuer oder in einer Bombe?
    const isInDanger = dangerMap[gy][gx] > 0;
    
    if (isInDanger) {
        // Reaktionszeit simulieren (nur wenn wir nicht eh schon flüchten)
        if (mem.state !== 'FLEEING' && mem.reactionTimer > 0) {
            mem.reactionTimer--;
            return; // Bot "bemerkt" die Gefahr noch nicht
        }

        // FLUCHT MODUS AKTIVIEREN
        mem.state = 'FLEEING';
        mem.target = null; // Grid-Movement abbrechen

        // Besten Fluchtweg suchen
        const escapeNode = findSafeTileBFS(gx, gy, dangerMap);
        
        if (escapeNode) {
            // Direktbewegung zum sicheren Tile (kein Grid-Snap, renn um dein Leben!)
            moveTowards(bot, escapeNode.x * TILE_SIZE, escapeNode.y * TILE_SIZE);
        } else {
            // Panik: Wenn kein sicheres Feld gefunden, lauf random weg
            moveRandomly(bot); 
        }
        return; // Keine weiteren Aktionen erlaubt
    } else {
        // Wir sind sicher -> Timer zurücksetzen
        mem.reactionTimer = reactionSpeed;
    }

    // --- 2. BOMBING LOGIC (Nur wenn sicher & Grid-Aligned) ---
    // Wir legen nur Bomben, wenn wir fast genau auf einer Kachel stehen
    const isAligned = Math.abs(bot.x - gx*TILE_SIZE) < 4 && Math.abs(bot.y - gy*TILE_SIZE) < 4;
    
    if (isAligned && bot.activeBombs < bot.maxBombs) {
        // Zielanalyse: Lohnt sich eine Bombe hier?
        if (shouldPlantBomb(bot, gx, gy, huntProbability)) {
            // SICHERHEITS-CHECK: Überleben wir das?
            if (canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                bot.plantBomb();
                // Nach dem Legen SOFORT in Fluchtmodus zwingen für 1 Frame
                // Damit er nicht stehen bleibt
                mem.state = 'FLEEING';
                return;
            }
        }
    }

    // --- 3. NAVIGATION (Wenn sicher) ---
    
    // Wenn wir gerade nirgendwohin laufen oder angekommen sind
    if (!mem.target || hasReachedTarget(bot, mem.target)) {
        // Neues Ziel suchen
        const nextGridInfo = pickNextTile(bot, gx, gy, dangerMap, huntProbability);
        
        if (nextGridInfo) {
            mem.state = 'MOVING';
            mem.gridTarget = nextGridInfo;
            mem.target = { 
                x: nextGridInfo.x * TILE_SIZE, 
                y: nextGridInfo.y * TILE_SIZE 
            };
        } else {
            mem.state = 'IDLE';
            mem.target = null;
        }
    }

    // Ausführung der Bewegung zum Ziel
    if (mem.target) {
        // Prüfen ob Ziel noch sicher ist (Dynamische Welt)
        if (mem.gridTarget && dangerMap[mem.gridTarget.y][mem.gridTarget.x] > 0) {
            mem.target = null; // Abbruch!
        } else {
            moveTowards(bot, mem.target.x, mem.target.y);
        }
    }
}

// ================= LOGIK FUNKTIONEN =================

function moveTowards(bot, targetX, targetY) {
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > bot.speed) {
        const mx = (dx / dist) * bot.speed;
        const my = (dy / dist) * bot.speed;
        bot.move(mx, my);
        
        // Animation direction update
        if (Math.abs(mx) > Math.abs(my)) bot.lastDir = {x: Math.sign(mx), y: 0};
        else bot.lastDir = {x: 0, y: Math.sign(my)};
    } else {
        // Snap
        bot.x = targetX;
        bot.y = targetY;
    }
}

function hasReachedTarget(bot, target) {
    return Math.abs(bot.x - target.x) < 2 && Math.abs(bot.y - target.y) < 2;
}

function moveRandomly(bot) {
    // Einfaches Zittern/Laufen, besser als nichts
    const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
    const d = dirs[Math.floor(Math.random()*dirs.length)];
    if (!isSolid(Math.round((bot.x+d.x*10)/TILE_SIZE), Math.round((bot.y+d.y*10)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
}

// Wählt das nächste Feld aus (Pfadfindung Light)
function pickNextTile(bot, gx, gy, dangerMap, huntProb) {
    // Ziele: Gegner (HUNT) oder Kiste/Item (FARM)
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    
    // Auf HARD immer den Menschen jagen, wenn möglich
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    let mode = 'FARM';
    let path = null;

    // Entscheiden: Jagen oder Farmen?
    if (enemy && Math.random() < huntProb) {
        // Versuch Pfad zum Gegner (Direkt oder Breach)
        const canBreach = (state.difficulty === DIFFICULTIES.HARD && bot.maxBombs >= 2);
        path = findNextStep(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        if (path) mode = 'HUNT';
    }

    if (!path) {
        // Fallback: Farmen (nächste Kiste oder Item)
        path = findNearestLootStep(gx, gy, dangerMap);
    }

    // Wenn immer noch kein Weg (eingesperrt?): Random Safe Tile
    if (!path) {
        const safeNeighbors = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
            .filter(n => !isSolid(n.x, n.y) && dangerMap[n.y][n.x] === 0);
        if (safeNeighbors.length > 0) return safeNeighbors[Math.floor(Math.random()*safeNeighbors.length)];
    }

    return path; // {x, y} des nächsten Feldes
}

function shouldPlantBomb(bot, gx, gy, huntProb) {
    // 1. Gegner in der Nähe?
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        // Lege Bombe, wenn Gegner nah ist und wir im Hunt-Modus sind
        if (dist <= bot.bombRange && Math.random() < huntProb) {
            // Check Alignment
            if (Math.abs(enemy.x - bot.x) < 20 || Math.abs(enemy.y - bot.y) < 20) return true;
        }
    }

    // 2. Kiste im Weg?
    return DIRS.some(d => {
        const nx = gx+d.x, ny = gy+d.y;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });
}

// DER FIX FÜR DEN START-SUIZID
function canPlantAndEscape(gx, gy, currentDangerMap, range) {
    // 1. Virtuelle Map erstellen: Wenn ich hier lege, wo ist dann Gefahr?
    const virtualDanger = new Set();
    // Die Bombe selbst
    virtualDanger.add(`${gx},${gy}`);
    
    // Strahlen berechnen
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i, ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; // Hardwall stoppt
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Softwall stoppt, brennt aber
        }
    });

    // 2. Suche: Komme ich von (gx,gy) zu einem Feld, das SICHER ist?
    // Sicher = Nicht in virtualDanger UND nicht in currentDangerMap
    // Wichtig: Wir dürfen DURCH virtualDanger laufen, um zu entkommen, 
    // aber das Ziel muss safe sein.
    
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([`${gx},${gy}`]);

    while(queue.length > 0) {
        const curr = queue.shift();

        // Check: Ist dieses Feld sicher?
        const key = `${curr.x},${curr.y}`;
        // Ein Feld ist sicher, wenn es NICHT von der neuen Bombe getroffen wird
        // UND keine alte Gefahr dort lauert.
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return true; // Ja, wir haben einen Fluchtweg!
        }

        if (curr.dist > 6) continue; // Zu weit weg suchen bringt nichts

        for (let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            // Wir können nur auf freie Felder laufen
            // ACHTUNG: Wir dürfen NICHT auf Felder laufen, die currentDangerMap > 0 haben (andere Bomben)
            if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, dist:curr.dist+1});
            }
        }
    }

    return false; // Kein sicherer Spot erreichbar -> NICHT LEGEN!
}

// --- STANDARD PFADFINDUNG (BFS) ---

function findSafeTileBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, firstStep: null}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 200) {
        const curr = queue.shift();

        // Ziel: Ein Feld ohne Gefahr
        if (dangerMap[curr.y][curr.x] === 0) {
            return curr.firstStep || {x:curr.x, y:curr.y}; // Sicheres Feld gefunden
        }

        for (let d of DIRS) {
            const nx = curr.x+d.x, ny = curr.y+d.y;
            if (!isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                // Wir meiden Feuer (2), aber laufen durch Radius (1) wenn nötig
                if (dangerMap[ny][nx] < 2) {
                    visited.add(`${nx},${ny}`);
                    queue.push({
                        x:nx, y:ny, 
                        firstStep: curr.firstStep || {x:nx, y:ny}
                    });
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

        // Greedy Sort für A*-ähnliches Verhalten
        const neighbors = DIRS.map(d => ({x:curr.x+d.x, y:curr.y+d.y}))
             .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            // Hindernis Check
            const tile = state.grid[n.y] ? state.grid[n.y][n.x] : TYPES.WALL_HARD;
            let blocked = false;

            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB) blocked = true;
            if (tile === TYPES.WALL_SOFT && !canBreach) blocked = true;
            if (dangerMap[n.y][n.x] > 0) blocked = true; // Meide Gefahr

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

        // Ziel gefunden (aber nicht Startpunkt)
        if ((curr.x!==sx || curr.y!==sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstStep;
        }
        
        // Durch Softwalls kann man nicht laufen (außer man will sie sprengen, dann ist das das Ziel)
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

// --- HELPERS ---

function findNearestEnemy(bot) {
    let nearest=null, minDist=Infinity;
    state.players.forEach(p => {
        if(p===bot || !p.alive) return;
        const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
        if(d<minDist){ minDist=d; nearest=p; }
    });
    return nearest;
}

function getDangerMap() {
    // 0=Safe, 1=Radius, 2=Deadly
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; // Bombe selbst ist Hindernis/Tödlich
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx=b.gx+d.x*i, ty=b.gy+d.y*i;
                if(isSolid(tx, ty, true)) break; // Hardwall stoppt
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