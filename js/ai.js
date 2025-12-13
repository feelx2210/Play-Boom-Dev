import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // Initialisierung
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }
    
    // Spawn-Schutz: Keine Bomben in den ersten 3 Sekunden (verhindert Instant-Suicide)
    const gameTime = performance.now(); // oder eine Frame-Zähler Logik
    if (!bot.spawnTime) bot.spawnTime = gameTime;
    const canBomb = (gameTime - bot.spawnTime > 3000);

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentUnsafe = dangerMap[gy][gx];

    // 1. NOTBREMSE (Sofortige Gefahr)
    // Wenn wir in Gefahr sind, MÜSSEN wir das aktuelle Ziel vergessen und flüchten.
    if (currentUnsafe) {
        bot.aiTargetX = null;
        
        // Fluchtweg berechnen
        const escapeDir = findSafeMove(gx, gy, dangerMap);
        
        // Sofort bewegen (Grid-Logik ignorieren für Flucht)
        if (escapeDir.x !== 0 || escapeDir.y !== 0) {
            bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
            // Animation anpassen
            if (escapeDir.x !== 0) bot.lastDir = { x: Math.sign(escapeDir.x), y: 0 };
            else bot.lastDir = { x: 0, y: Math.sign(escapeDir.y) };
        }
        return; // Keine weiteren Überlegungen
    }

    // 2. GRID MOVEMENT (Gegen Zappeln)
    // Wenn wir ein sicheres Ziel haben, laufen wir strikt dorthin.
    if (bot.aiTargetX !== null) {
        // Prüfen ob Ziel noch valide ist
        if (dangerMap[bot.aiTargetY][bot.aiTargetX] || isSolid(bot.aiTargetX, bot.aiTargetY)) {
            bot.aiTargetX = null; // Ziel blockiert/gefährlich -> Abbruch
        } else {
            const targetPx = bot.aiTargetX * TILE_SIZE;
            const targetPy = bot.aiTargetY * TILE_SIZE;
            const dx = targetPx - bot.x;
            const dy = targetPy - bot.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist <= bot.speed) {
                bot.x = targetPx; bot.y = targetPy;
                bot.aiTargetX = null; // Angekommen
            } else {
                bot.move(Math.sign(dx) * bot.speed, Math.sign(dy) * bot.speed);
                return; // Wir laufen, also Klappe halten Hirn
            }
        }
    }

    // 3. ENTSCHEIDUNG (Nur wenn wir stehen)
    let nextMove = {x:0, y:0};
    
    // ZIELWAHL
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    // MODUS
    let mode = 'FARM';
    // Pfad zum Gegner (durch Wände?)
    const directPath = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false, bot.id) : null;
    
    if (state.difficulty === DIFFICULTIES.HARD) {
        if (directPath) mode = 'HUNT';
        else if (bot.maxBombs >= 2 && enemy) mode = 'BREACH'; // Aggressiv graben
    } else {
        if (directPath && Math.random() < 0.6) mode = 'HUNT';
    }

    // A) HUNT
    if (mode === 'HUNT' && enemy) {
        nextMove = directPath || {x:0, y:0};
        
        if (canBomb && bot.activeBombs < bot.maxBombs) {
            const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
            const aligned = (Math.abs(enemy.x - bot.x) < 10 || Math.abs(enemy.y - bot.y) < 10);
            
            // Lege Bombe
            if (dist <= bot.bombRange && aligned && isSafeToPlant(gx, gy, dangerMap, bot.bombRange)) {
                bot.plantBomb();
                // WICHTIG: Sofort Flucht erzwingen! Nicht warten!
                const escapeDir = findSafeMove(gx, gy, getDangerMap()); // Map neu holen inkl. eigener Bombe
                if (escapeDir.x !== 0 || escapeDir.y !== 0) {
                    bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
                }
                return;
            }
        }
    } 
    // B) BREACH / FARM
    else if (mode === 'BREACH' || mode === 'FARM') {
        // Ziel suchen: Entweder Gegner (durch Wände) oder Loot
        let targetPath = null;
        if (mode === 'BREACH' && enemy) {
            targetPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true, bot.id);
        }
        if (!targetPath) {
            targetPath = findNearestLoot(gx, gy, dangerMap, bot.id);
        }

        if (targetPath) {
            const nx = gx + targetPath.x;
            const ny = gy + targetPath.y;
            // Wenn Softwall im Weg -> Sprengen
            if (state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT) {
                if (canBomb && bot.activeBombs < bot.maxBombs && isSafeToPlant(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Sofort Flucht!
                    const escapeDir = findSafeMove(gx, gy, getDangerMap());
                    bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
                    return;
                }
                // Wenn wir nicht bomben können, warten wir (nicht reinlaufen)
                nextMove = {x:0, y:0};
            } else {
                nextMove = targetPath;
            }
        } else {
            // Random Move gegen Einfrieren
            if (Math.random() < 0.1) nextMove = getRandomSafeDir(gx, gy, dangerMap);
        }
    }

    // 4. BEFEHL AUSFÜHREN
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        if (!isSolid(tx, ty) && !isOccupiedByBot(tx, ty, bot.id)) {
            bot.aiTargetX = tx; bot.aiTargetY = ty;
        }
    }
}

// --- ESSENTIAL HELPERS ---

function isSafeToPlant(gx, gy, currentDangerMap, range) {
    // Einfache, robuste Prüfung: Haben wir SOFORT einen freien, sicheren Nachbarn?
    // Keine komplexe Pfadsuche, die in Ecken versagt.
    
    // 1. Simuliere Explosion
    const unsafe = new Set();
    unsafe.add(`${gx},${gy}`); // Wir selbst sind unsicher
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if(tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
            unsafe.add(`${tx},${ty}`);
            if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
        }
    });

    // 2. Suche einen direkten Nachbarn, der NICHT in 'unsafe' ist UND begehbar ist
    // Wenn wir keinen direkten Ausweg haben -> NICHT LEGEN!
    for (let d of DIRS) {
        const nx = gx + d.x; 
        const ny = gy + d.y;
        
        // Valid & Walkable (keine Wand, keine Bombe)
        if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !isSolid(nx, ny)) {
            // Ist dieser Nachbar sicher vor der Explosion?
            if (!unsafe.has(`${nx},${ny}`) && !currentDangerMap[ny][nx]) {
                return true; // Ja, wir können hierhin flüchten
            }
        }
    }
    
    return false; // Kein direkter Ausweg -> Falle
}

function findSafeMove(gx, gy, dangerMap) {
    // BFS zum nächsten sicheren Feld
    const queue = [{x: gx, y: gy, firstMove: null}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    let ops = 0;
    while (queue.length > 0) {
        if (ops++ > 300) break;
        const curr = queue.shift();
        
        // Ziel: Ein Feld ohne Gefahr
        if (!dangerMap[curr.y][curr.x]) {
            return curr.firstMove || {x:0, y:0}; // Wenn wir schon sicher sind, stehen bleiben
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx<0 || nx>=GRID_W || ny<0 || ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            
            // WICHTIG: Flucht nur auf freie Felder!
            if (!isSolid(nx, ny)) {
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    // Panik: Random Move besser als Nichts
    return getRandomSafeDir(gx, gy, dangerMap);
}

// ... Restliche Helper (unverändert wichtig für Funktionalität) ...

function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x<0 || n.x>=GRID_W || n.y<0 || n.y>=GRID_H) continue;
            if (visited.has(`${n.x},${n.y}`)) continue;
            const tile = state.grid[n.y][n.x];
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;
            if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;
            if (isOccupiedByBot(n.x, n.y, selfId) && (n.x !== tx || n.y !== ty)) continue;
            visited.add(`${n.x},${n.y}`);
            queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
        }
    }
    return null;
}

function findNearestLoot(sx, sy, dangerMap, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 600) break;
        const curr = queue.shift();
        const tile = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) return curr.firstMove;
        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue;
        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx<0 || nx>=GRID_W || ny<0 || ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            const t = state.grid[ny][nx];
            if (t === TYPES.WALL_HARD || t === TYPES.BOMB || dangerMap[ny][nx]) continue;
            if (isOccupiedByBot(nx, ny, selfId)) continue;
            visited.add(`${nx},${ny}`);
            queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
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
    const valid = DIRS.filter(d => {
        const nx=gx+d.x, ny=gy+d.y;
        return nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !isSolid(nx, ny) && !dangerMap[ny][nx];
    });
    return valid.length>0 ? valid[Math.floor(Math.random()*valid.length)] : {x:0,y:0};
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    state.particles.forEach(p => { if (p.isFire) map[p.gy][p.gx] = true; });
    state.bombs.forEach(b => {
        const range = b.range; 
        map[b.gy][b.gx] = true;
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx=b.gx+(d.x*i), ty=b.gy+(d.y*i);
                if (tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        DIRS.forEach(d => {
            for(let i=1; i<=5; i++) {
                const tx=HELL_CENTER.x+(d.x*i), ty=HELL_CENTER.y+(d.y*i);
                if (tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    }
    return map;
}