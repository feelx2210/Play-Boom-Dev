import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Globales Gedächtnis
const botMemory = {};

export function updateBotLogic(bot) {
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { state: 'IDLE', target: null, patience: 0 };
    }
    const mem = botMemory[bot.id];
    
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // --- 1. SURVIVAL (ABSOLUTE PRIORITÄT) ---
    // Wenn wir in Gefahr sind, rennen wir um unser Leben.
    if (currentDanger > 0) {
        mem.state = 'FLEEING';
        mem.target = null;
        
        // Suche sicheren Platz
        const escapeNode = findSafeTileBFS(gx, gy, dangerMap);
        if (escapeNode) {
            moveToPixel(bot, escapeNode.x * TILE_SIZE, escapeNode.y * TILE_SIZE);
        } else {
            // Panik: Keine sichere Kachel gefunden? Random Move ist besser als Stehenbleiben.
            moveRandomly(bot);
        }
        return; 
    }

    // Wenn wir sicher sind, aber Status noch 'FLEEING' ist -> Reset
    if (mem.state === 'FLEEING' && currentDanger === 0) {
        snapToGrid(bot); // Sauber ausrichten
        mem.state = 'IDLE';
    }

    // --- 2. GRID MOVEMENT (ZIEL ANSTEUERN) ---
    // Wenn wir ein valides Ziel haben, laufen wir dorthin bis zum "Einrasten".
    if (mem.target) {
        // Prüfen: Ist das Ziel noch sicher und frei?
        const tx = Math.round(mem.target.x / TILE_SIZE);
        const ty = Math.round(mem.target.y / TILE_SIZE);
        
        if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
            mem.target = null; // Ziel ungültig -> Neu entscheiden
        } else if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            bot.x = mem.target.x; bot.y = mem.target.y; // Snap
            mem.target = null; // Angekommen -> Neu entscheiden
        } else {
            moveToPixel(bot, mem.target.x, mem.target.y);
            return; // Wir sind beschäftigt
        }
    }

    // --- 3. ENTSCHEIDUNG (NUR WENN WIR STEHEN) ---
    // Hier schlägt das "Gehirn" zu.
    
    // Config laden
    const difficulty = state.difficulty;
    const isHard = difficulty === DIFFICULTIES.HARD;
    const isMedium = difficulty === DIFFICULTIES.MEDIUM;
    
    // A) BOMBEN CHECK (Angriff & Breach)
    if (bot.activeBombs < bot.maxBombs) {
        const bombAction = evaluateBombing(bot, gx, gy, isHard, isMedium);
        if (bombAction.shouldPlant) {
            // SICHERHEITS-SIMULATION
            // Bevor wir legen: Können wir vor der EIGENEN Bombe fliehen?
            const realRange = getEffectiveBlastRange(gx, gy, bot.bombRange);
            const escapePath = calculateEscapePath(gx, gy, dangerMap, realRange);
            
            if (escapePath) {
                bot.plantBomb();
                // Trick: Wir zwingen den Bot sofort in den Fluchtmodus entlang des berechneten Pfades
                // Das spart einen Frame Reaktionszeit
                const firstStep = escapePath[0];
                moveToPixel(bot, firstStep.x * TILE_SIZE, firstStep.y * TILE_SIZE);
                mem.state = 'FLEEING'; // Modus wechseln
                return;
            }
        }
    }

    // B) ZIEL SUCHE (Navigation)
    const nextTile = decideNextMove(bot, gx, gy, dangerMap, isHard, isMedium);
    
    if (nextTile) {
        mem.target = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE };
        moveToPixel(bot, mem.target.x, mem.target.y);
        mem.state = 'MOVING';
    } else {
        // Nichts zu tun? Random wackeln, damit er nicht "tot" aussieht
        if (Math.random() < 0.1) moveRandomly(bot);
    }
}

// ==========================================
//              LOGIK KERNE
// ==========================================

function evaluateBombing(bot, gx, gy, isHard, isMedium) {
    // 1. Gegneranalyse
    const enemy = findPrimaryTarget(bot, isHard);
    
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        
        // ATTACKE: Wenn Gegner nah und in Linie
        // Hard: Aggressiver (Range + 2), Medium: Range
        const rangeThreshold = isHard ? bot.bombRange + 2 : bot.bombRange;
        
        if (dist <= rangeThreshold) {
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            
            // Toleranz für "in Schusslinie"
            if (dx < 1 || dy < 1) {
                return { shouldPlant: true, reason: 'attack' };
            }
        }
    }

    // 2. Breach / Farm (Kiste im Weg?)
    // Prüfe alle 4 Nachbarn
    const boxNearby = DIRS.some(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });

    if (boxNearby) {
        // Auf Hard: Immer sprengen wenn wir zum Gegner wollen oder Looten
        // Auf Easy: Nur selten
        const chance = isHard ? 0.9 : (isMedium ? 0.5 : 0.1);
        if (Math.random() < chance) return { shouldPlant: true, reason: 'farm' };
    }

    return { shouldPlant: false };
}

function decideNextMove(bot, gx, gy, dangerMap, isHard, isMedium) {
    // ZIELPRIORITÄT:
    // 1. Gegner (Wenn Hard oder Medium & Nah)
    // 2. PowerUp (Wenn schwach oder auf dem Weg)
    // 3. Random / Campen

    const enemy = findPrimaryTarget(bot, isHard);
    const amWeak = bot.maxBombs < 2 || bot.bombRange < 2;
    
    // PFAD ZUM GEGNER (Breach Mode für Hard)
    // Hard Bots dürfen Pfade durch Softwalls planen ("Breaching")
    if (enemy && (isHard || (isMedium && amWeak === false))) {
        const canBreach = isHard; 
        const pathStep = findNextStepAStar(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, canBreach);
        
        if (pathStep) {
            // Check: Ist der nächste Schritt eine Kiste? (Breach)
            // Wenn ja -> Wir können nicht reinlaufen -> Return null (damit er stehen bleibt und bombt)
            if (state.grid[pathStep.y] && state.grid[pathStep.y][pathStep.x] === TYPES.WALL_SOFT) {
                return null; // Warte hier, Bomb Logic übernimmt im nächsten Frame
            }
            return pathStep;
        }
    }

    // PFAD ZUM LOOT
    // Wenn kein Gegnerweg oder wir schwach sind -> Farmen
    const lootStep = findNearestLootBFS(gx, gy, dangerMap);
    if (lootStep) {
        // Gleiches Spiel: Wenn Kiste im Weg, davor stehen bleiben
        if (state.grid[lootStep.y] && state.grid[lootStep.y][lootStep.x] === TYPES.WALL_SOFT) {
            return null;
        }
        return lootStep;
    }

    // Wenn gar nichts geht: Random Safe Tile
    return getRandomSafeNeighbor(gx, gy, dangerMap);
}

// ==========================================
//              ALGORITHMEN
// ==========================================

// Sucht den nächsten Schritt Richtung Ziel (A*)
// canBreach: Wenn true, werden SoftWalls als begehbar (Kosten erhöht) angesehen
function findNextStepAStar(sx, sy, tx, ty, dangerMap, canBreach) {
    // Einfache BFS/Greedy ist oft performanter für kleine Grids
    const queue = [{x: sx, y: sy, first: null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.first;

        // Sortiere Nachbarn nach Distanz zum Ziel (Heuristik)
        const neighbors = DIRS.map(d => ({x: curr.x+d.x, y: curr.y+d.y}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            // Bounds
            if (n.x<0 || n.x>=GRID_W || n.y<0 || n.y>=GRID_H) continue;

            const tile = state.grid[n.y][n.x];
            let blocked = false;

            // Hard Hindernisse
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB) blocked = true;
            // Soft Hindernisse (wenn kein Breach)
            if (tile === TYPES.WALL_SOFT && !canBreach) blocked = true;
            // Gefahr
            if (dangerMap[n.y][n.x] > 0) blocked = true;

            if (!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x: n.x, y: n.y, first: curr.first || n});
            }
        }
    }
    return null;
}

function findNearestLootBFS(sx, sy, dangerMap) {
    const queue = [{x: sx, y: sy, first: null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        // Found Loot? (Aber nicht Startposition)
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            // Wenn es eine Softwall ist, können wir nicht hindurch, also ist das Ziel erreicht
            // Wenn first null ist, ist das Ziel direkt neben uns -> return target
            return curr.first || {x: curr.x, y: curr.y}; 
        }

        // Durch Softwalls kann man nicht hindurchsehen/laufen beim Farmen
        if (tile === TYPES.WALL_SOFT) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`) && dangerMap[ny][nx] === 0 && !isSolid(nx, ny)) {
                visited.add(`${nx},${ny}`);
                queue.push({x: nx, y: ny, first: curr.first || {x: nx, y: ny}});
            }
        }
    }
    return null;
}

// Simulierte Explosion und Fluchtwegsuche (Anti-Suizid)
function calculateEscapePath(gx, gy, currentDangerMap, range) {
    // 1. Virtuelle Blast Zone
    const blastZone = new Set();
    blastZone.add(`${gx},${gy}`); // Ursprung
    
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; // Hardwall stoppt Strahl
            blastZone.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Softwall stoppt Strahl
        }
    });

    // 2. BFS: Suche sicheres Feld
    const queue = [{x:gx, y:gy, path:[]}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 500) {
        const curr = queue.shift();
        const key = `${curr.x},${curr.y}`;

        // SAFE SPOT?
        // Feld ist sicher, wenn es nicht im virtuellen Blast liegt UND keine bestehende Gefahr hat.
        if (!blastZone.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return curr.path.length > 0 ? curr.path : null; // Pfad zurückgeben
        }

        if (curr.path.length > 8) continue; // Max Fluchtweglänge

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            
            // Valid Movement?
            // - Innerhalb Grid
            // - Keine Wand (Soft oder Hard)
            // - Keine Bombe
            // - Keine EXISTIERENDE Gefahr (andere Bomben).
            // - Wir dürfen aber durch die 'blastZone' laufen, um rauszukommen!
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`) && !isSolid(nx, ny) && currentDangerMap[ny][nx] === 0) {
                // Bots blockieren sich gegenseitig? Hier ignorieren wir Bots für die Planung,
                // sonst legen sie keine Bombe, weil ein anderer Bot im Weg steht (zu defensiv).
                // Die Physik/Movement regelt Kollisionen.
                visited.add(`${nx},${ny}`);
                const newPath = [...curr.path, {x: nx, y: ny}];
                queue.push({x: nx, y: ny, path: newPath});
            }
        }
    }
    return null; // Kein Ausweg
}

function findSafeTileBFS(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 200) {
        const curr = queue.shift();
        if (dangerMap[curr.y][curr.x] === 0) return curr;
        
        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Flucht nur auf freie Felder
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny});
            }
        }
    }
    return null;
}

// ==========================================
//              HELPERS
// ==========================================

function findPrimaryTarget(bot, isHard) {
    // Hard: Immer den Menschen (ID 1)
    if (isHard) {
        const human = state.players.find(p => p.id === 1 && p.alive);
        if (human) return human;
    }
    // Sonst: Nächster Gegner
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

function getEffectiveBlastRange(gx, gy, baseRange) {
    // Öl und Boost Check
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === gx && p.y === gy);
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;
    if (isBoost || isOil) return 15;
    return baseRange;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    // Feuer (2 = Tödlich)
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    // Bomben (1 = Gefahr, 2 = Tödlich wenn drauf)
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        const r = getEffectiveBlastRange(b.gx, b.gy, b.range);
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isSolid(tx, ty, true)) break; 
                if(map[ty][tx] < 1) map[ty][tx] = 1;
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    
    // Level Hazards
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isSolid(tx,ty,true)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}

function moveToPixel(bot, tx, ty) {
    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.min(dist, bot.speed);
    
    if (dist > 0) {
        const mx = (dx/dist) * speed;
        const my = (dy/dist) * speed;
        bot.move(mx, my);
        if(Math.abs(mx) > Math.abs(my)) bot.lastDir = {x:Math.sign(mx), y:0};
        else bot.lastDir = {x:0, y:Math.sign(my)};
    }
}

function snapToGrid(bot) {
    bot.x = Math.round(bot.x / TILE_SIZE) * TILE_SIZE;
    bot.y = Math.round(bot.y / TILE_SIZE) * TILE_SIZE;
}

function hasReachedPixel(bot, px, py) {
    return Math.abs(bot.x - px) < 4 && Math.abs(bot.y - py) < 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!isSolid(Math.round((bot.x + d.x*16)/TILE_SIZE), Math.round((bot.y + d.y*16)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
}

function getRandomSafeNeighbor(gx, gy, dangerMap) {
    const valid = DIRS.map(d => ({x:gx+d.x, y:gy+d.y}))
        .filter(n => n.x>=0 && n.x<GRID_W && n.y>=0 && n.y<GRID_H && !isSolid(n.x, n.y) && dangerMap[n.y][n.x]===0);
    if(valid.length > 0) return valid[Math.floor(Math.random()*valid.length)];
    return null;
}