import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // Initialisierung des Ziel-Speichers
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();

    // 1. NOTBREMSE (Emergency Interrupt)
    // Wenn das aktuelle Feld ODER das Zielfeld plötzlich gefährlich wird, sofort stoppen!
    const currentUnsafe = dangerMap[gy][gx];
    let targetUnsafe = false;
    if (bot.aiTargetX !== null) {
        // Ziel ist Gefahr oder plötzlich blockiert (z.B. durch Bombe)
        if (dangerMap[bot.aiTargetY][bot.aiTargetX] || isSolid(bot.aiTargetX, bot.aiTargetY)) {
            targetUnsafe = true;
        }
    }

    if (currentUnsafe || targetUnsafe) {
        bot.aiTargetX = null; // Lösche Ziel -> Erzwingt sofortige Neuentscheidung
    }

    // 2. BEWEGUNG AUSFÜHREN (Movement Execution)
    // Wenn wir ein valides Ziel haben, laufen wir dorthin – ohne Diskussion.
    if (bot.aiTargetX !== null) {
        const targetPx = bot.aiTargetX * TILE_SIZE;
        const targetPy = bot.aiTargetY * TILE_SIZE;
        
        const dx = targetPx - bot.x;
        const dy = targetPy - bot.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Sind wir da? (Toleranz = Geschwindigkeit)
        if (dist <= bot.speed) {
            // SNAP: Exakt auf die Mitte setzen
            bot.x = targetPx;
            bot.y = targetPy;
            bot.aiTargetX = null; // Ziel erreicht, Hirn wieder einschalten
        } else {
            // Weiterlaufen
            const moveX = Math.sign(dx) * bot.speed;
            const moveY = Math.sign(dy) * bot.speed;
            
            // Animation setzen
            if (moveX !== 0) bot.lastDir = { x: Math.sign(moveX), y: 0 };
            else if (moveY !== 0) bot.lastDir = { x: 0, y: Math.sign(moveY) };
            
            bot.move(moveX, moveY);
            return; // WICHTIG: Keine neue Entscheidung treffen, solange wir laufen!
        }
    }

    // 3. KI-HIRN (Decision Phase)
    // Dieser Code läuft nur, wenn der Bot stillsteht (mittig auf einer Kachel).
    
    let nextMove = {x:0, y:0}; // Relativer Move (z.B. 1, 0 für Rechts)

    if (currentUnsafe) {
        // FLUCHT: Suche sicherstes Nachbarfeld
        const safeDir = findSafeMove(gx, gy, dangerMap);
        nextMove = safeDir;
    } else {
        // STRATEGIE
        // Auf Hard: Fokus auf Mensch. Sonst: Nächster Gegner.
        let enemy = null;
        const human = state.players.find(p => p.id === 1 && p.alive);
        if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
        else enemy = findNearestEnemy(bot);

        // Modus bestimmen
        let mode = 'IDLE';
        // Pfad zum Gegner (ohne Wände zu zerstören)
        const directPath = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false, bot.id) : null;
        
        if (state.difficulty === DIFFICULTIES.HARD) {
            if (directPath) mode = 'HUNT';
            // Wenn stark genug, brich durch Wände
            else if (bot.maxBombs >= 2) mode = 'BREACH';
            else mode = 'FARM';
        } else {
            mode = (directPath && Math.random() < 0.6) ? 'HUNT' : 'FARM';
        }

        // --- TAKTIK AUSFÜHRUNG ---
        
        if (mode === 'HUNT' && enemy) {
            nextMove = directPath || {x:0, y:0};
            
            // Angriff?
            if (bot.activeBombs < bot.maxBombs) {
                const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
                // Bombe legen wenn nah oder gute Schusslinie
                const aligned = (Math.abs(enemy.x - bot.x) < 20 || Math.abs(enemy.y - bot.y) < 20);
                
                if (dist <= bot.bombRange && aligned && isSafeToPlant(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Nächster Frame kümmert sich um die Flucht (durch DangerMap Check oben)
                    return; 
                }
            }
        } 
        else if (mode === 'BREACH' && enemy) {
            // Pfad DURCH weiche Wände suchen
            const breachPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true, bot.id);
            if (breachPath) handleInteraction(bot, gx, gy, breachPath, dangerMap, ref => nextMove = ref);
            else mode = 'FARM';
        }
        
        // Farmen als Fallback oder Hauptmodus
        if (mode === 'FARM' || (nextMove.x === 0 && nextMove.y === 0)) {
            const lootDir = findNearestLoot(gx, gy, dangerMap, bot.id);
            if (lootDir) handleInteraction(bot, gx, gy, lootDir, dangerMap, ref => nextMove = ref);
            else {
                // Nichts zu tun? Random Move (selten), damit sie nicht einfrieren
                if (Math.random() < 0.05) nextMove = getRandomSafeDir(gx, gy, dangerMap);
            }
        }
    }

    // 4. BEFEHL SPEICHERN
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        
        // Double Check: Ist das Ziel wirklich frei?
        if (!isSolid(tx, ty) && !isOccupiedByBot(tx, ty, bot.id)) {
            bot.aiTargetX = tx;
            bot.aiTargetY = ty;
        }
    }
}

// --- LOGIK HELPERS ---

function handleInteraction(bot, gx, gy, dir, dangerMap, setMoveCallback) {
    const nx = gx + dir.x;
    const ny = gy + dir.y;
    
    // Wenn der Weg durch eine SoftWall blockiert ist -> SPRENGEN
    if (state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT) {
        if (bot.activeBombs < bot.maxBombs && isSafeToPlant(gx, gy, dangerMap)) {
            bot.plantBomb();
            // Stehen bleiben (nächster Frame flüchtet)
        }
        // Wenn wir nicht bomben können, warten wir
    } else {
        // Weg ist frei -> Gehen
        setMoveCallback(dir);
    }
}

function isSafeToPlant(gx, gy, currentDangerMap) {
    // Simulieren: Bombe hier + Kreuz
    // Checken: Gibt es noch einen Ausweg?
    const tempDanger = currentDangerMap.map(r => [...r]);
    tempDanger[gy][gx] = true;
    DIRS.forEach(d => {
        if (state.grid[gy+d.y] && state.grid[gy+d.y][gx+d.x] !== undefined) tempDanger[gy+d.y][gx+d.x] = true;
    });
    
    // Suche mindestens ein sicheres Feld in Reichweite 1
    const escape = DIRS.some(d => {
        const nx = gx+d.x, ny = gy+d.y;
        return !isSolid(nx, ny) && !tempDanger[ny][nx];
    });
    return escape;
}

// Pfadsuche (A* Light)
function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        // Sortierung nach Distanz zum Ziel (Greedy)
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x < 0 || n.x >= GRID_W || n.y < 0 || n.y >= GRID_H) continue;
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            const tile = state.grid[n.y][n.x];
            // Hard Walls/Bomben/Gefahr sind immer Hindernisse
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || dangerMap[n.y][n.x]) continue;
            
            // Softwalls sind Hindernisse, AUSSER wir sind im Breach-Modus
            if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;
            
            // Andere Bots sind Hindernisse
            if (isOccupiedByBot(n.x, n.y, selfId) && (n.x !== tx || n.y !== ty)) continue;

            visited.add(`${n.x},${n.y}`);
            queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
        }
    }
    return null;
}

// Breitensuche nach Loot (Items oder Softwalls)
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
        
        // Ziel: Item oder Softwall (aber nicht Startfeld)
        if ((curr.x !== sx || curr.y !== sy) && (tile === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            return curr.firstMove;
        }
        
        // Durch Softwalls kann man nicht "hindurchsehen" für Loot dahinter (erst sprengen)
        if (tile === TYPES.WALL_SOFT && (curr.x !== sx || curr.y !== sy)) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x, ny = curr.y + d.y;
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
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

function findSafeMove(gx, gy, dangerMap) {
    // Wenn aktuelles Feld sicher ist, bleiben wir stehen (Panik vermeiden)
    // Außer wir wollen explizit weg (wird hier nicht behandelt)
    // Hier suchen wir den nächsten sicheren Ort
    const queue = [{x: gx, y: gy, firstMove: null}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    let ops = 0;
    while (queue.length > 0) {
        if (ops++ > 300) break;
        const curr = queue.shift();
        
        if (!dangerMap[curr.y][curr.x]) return curr.firstMove || {x:0, y:0};

        for (let d of DIRS) {
            const nx = curr.x + d.x, ny = curr.y + d.y;
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            if (!isSolid(nx, ny)) { // Flucht nur auf freie Felder
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function findNearestEnemy(bot) {
    let nearest = null, minDist = Infinity;
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

function isOccupiedByBot(gx, gy, selfId) {
    return state.players.some(p => p.id !== selfId && p.alive && Math.round(p.x/TILE_SIZE)===gx && Math.round(p.y/TILE_SIZE)===gy);
}

function getRandomSafeDir(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => {
        const nx = gx+d.x, ny = gy+d.y;
        return nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !isSolid(nx, ny) && !dangerMap[ny][nx];
    });
    return valid.length > 0 ? valid[Math.floor(Math.random()*valid.length)] : {x:0, y:0};
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
    });
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        map[b.gy][b.gx] = true;
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i), ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        const range = 5; 
        DIRS.forEach(d => {
            for(let i=1; i<=range; i++) {
                const tx = HELL_CENTER.x + (d.x * i), ty = HELL_CENTER.y + (d.y * i);
                if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                    if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                    map[ty][tx] = true;
                    if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
                }
            }
        });
    }
    return map;
}