import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap(); // Enthält Bomben-Radien + Feuer
    const fireMap = getFireMap();     // Enthält NUR aktives Feuer (unbetretbar)

    // 1. NOTBREMSE (Aktuelle Gefahr)
    const currentUnsafe = dangerMap[gy][gx];
    
    if (bot.aiTargetX !== null) {
        // Ziel ungültig (Feuer, Wand oder Gefahr)?
        if (dangerMap[bot.aiTargetY][bot.aiTargetX] || isSolid(bot.aiTargetX, bot.aiTargetY)) {
            bot.aiTargetX = null;
        }
    }
    if (currentUnsafe) bot.aiTargetX = null;

    // 2. GRID MOVEMENT (Gegen Zappeln)
    if (bot.aiTargetX !== null && !currentUnsafe) {
        const targetPx = bot.aiTargetX * TILE_SIZE;
        const targetPy = bot.aiTargetY * TILE_SIZE;
        const dx = targetPx - bot.x;
        const dy = targetPy - bot.y;
        
        if (Math.sqrt(dx*dx + dy*dy) <= bot.speed) {
            bot.x = targetPx; bot.y = targetPy;
            bot.aiTargetX = null; // Angekommen
        } else {
            const mx = Math.sign(dx) * bot.speed;
            const my = Math.sign(dy) * bot.speed;
            if (mx!==0) bot.lastDir = {x:Math.sign(mx), y:0};
            else if (my!==0) bot.lastDir = {x:0, y:Math.sign(my)};
            
            // Kollisions-Check während der Bewegung
            const nextGx = Math.round((bot.x + mx*2) / TILE_SIZE);
            const nextGy = Math.round((bot.y + my*2) / TILE_SIZE);
            if (!isSolid(nextGx, nextGy) && !fireMap[nextGy][nextGx]) {
                bot.move(mx, my);
            } else {
                bot.aiTargetX = null; // Blockiert
            }
            return;
        }
    }

    // 3. KI ENTSCHEIDUNG (Im Stillstand)
    let nextMove = {x:0, y:0};

    if (currentUnsafe) {
        // FLUCHT: Weg von der Gefahr (Darf durch 'wird explodieren' laufen, aber nicht durch Feuer)
        nextMove = findSafeMove(gx, gy, dangerMap, fireMap);
    } else {
        // TAKTIK
        let enemy = null;
        const human = state.players.find(p => p.id === 1 && p.alive);
        if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
        else enemy = findNearestEnemy(bot);

        let mode = 'FARM';
        // Pfad zum Gegner berechnen (weicht Feuer aus)
        const directPath = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), fireMap, false, bot.id) : null;
        
        if (state.difficulty === DIFFICULTIES.HARD) {
            if (directPath) mode = 'HUNT';
            else if (bot.maxBombs >= 2 && enemy) mode = 'BREACH';
        } else {
            if (directPath && Math.random() < 0.5) mode = 'HUNT';
        }

        // A) HUNT (Angriff)
        if (mode === 'HUNT' && enemy) {
            nextMove = directPath || {x:0, y:0};
            
            if (bot.activeBombs < bot.maxBombs) {
                const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
                const aligned = (Math.abs(enemy.x - bot.x) < 15 || Math.abs(enemy.y - bot.y) < 15);
                
                // Bombe legen & flüchten
                if (dist <= bot.bombRange && aligned && isSafeToPlant(gx, gy, dangerMap, fireMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Nächster Frame triggert Fluchtlogik
                    return; 
                }
            }
        } 
        // B) BREACH (Graben)
        else if (mode === 'BREACH' && enemy) {
            const breachPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), fireMap, true, bot.id);
            if (breachPath) handleInteraction(bot, gx, gy, breachPath, dangerMap, fireMap, ref => nextMove = ref);
            else mode = 'FARM';
        }
        
        // C) FARM (Looten)
        if (mode === 'FARM' || (nextMove.x === 0 && nextMove.y === 0)) {
            const lootDir = findNearestLoot(gx, gy, fireMap, bot.id);
            if (lootDir) handleInteraction(bot, gx, gy, lootDir, dangerMap, fireMap, ref => nextMove = ref);
            else if (Math.random() < 0.1) nextMove = getRandomSafeDir(gx, gy, dangerMap);
        }
    }

    // 4. BEFEHL AUSFÜHREN
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        // WICHTIG: Ziel darf keine Wand, kein Bot und kein aktives Feuer sein
        if (!isSolid(tx, ty) && !isOccupiedByBot(tx, ty, bot.id) && !fireMap[ty][tx]) {
            bot.aiTargetX = tx; bot.aiTargetY = ty;
        }
    }
}

// --- LOGIK HELPERS ---

function handleInteraction(bot, gx, gy, dir, dangerMap, fireMap, setMoveCallback) {
    const nx = gx + dir.x;
    const ny = gy + dir.y;
    // Softwall im Weg?
    if (state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT) {
        // Safe Check: Kann ich legen und wegrennen?
        if (bot.activeBombs < bot.maxBombs && isSafeToPlant(gx, gy, dangerMap, fireMap, bot.bombRange)) {
            bot.plantBomb();
        } else {
            // Wenn unsicher, nicht legen. Aber auch nicht reinlaufen.
            // Stehenbleiben (und warten auf besseren Moment)
        }
    } else {
        setMoveCallback(dir);
    }
}

// Mächtiger Check: Simuliert Explosion und sucht Fluchtweg (auch um Ecken!)
function isSafeToPlant(gx, gy, currentDangerMap, fireMap, range) {
    // 1. Virtuelle Explosion berechnen
    const blastZone = new Set();
    blastZone.add(`${gx},${gy}`);
    
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x * i;
            const ty = gy + d.y * i;
            if (tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
            blastZone.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // 2. Pfadsuche zu einem sicheren Feld
    // Start bei mir (in Gefahr). Ziel: Irgendein Feld NICHT in blastZone.
    // Wir DÜRFEN durch blastZone laufen (Zeit reicht), aber NICHT durch fireMap oder Wände.
    
    const queue = [{x: gx, y: gy, dist: 0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 150) break;
        const curr = queue.shift();
        
        const key = `${curr.x},${curr.y}`;
        const willExplode = blastZone.has(key);
        const isCurrentDanger = currentDangerMap[curr.y][curr.x]; // z.B. andere Bomben
        
        // HABEN WIR EINEN SICHEREN HAFEN?
        // - Nicht in meiner geplanten Explosion
        // - Nicht in aktueller Gefahr (andere Bomben)
        // - Kein Feuer
        if (!willExplode && !isCurrentDanger && !fireMap[curr.y][curr.x]) return true;

        if (curr.dist > 6) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x;
            const ny = curr.y + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                if (!isSolid(nx, ny) && !fireMap[ny][nx]) { // Nur begehbar & kein Feuer
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
                }
            }
        }
    }
    return false; // Sackgasse oder Falle
}

function findSafeMove(gx, gy, dangerMap, fireMap) {
    if (!dangerMap[gy][gx]) return {x:0, y:0}; // Schon sicher

    const queue = [{x: gx, y: gy, firstMove: null}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    let ops = 0;
    while (queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        
        // Ziel gefunden (keine Gefahr)
        if (!dangerMap[curr.y][curr.x] && !fireMap[curr.y][curr.x]) {
            return curr.firstMove || {x:0, y:0};
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx<0 || nx>=GRID_W || ny<0 || ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            
            // Flucht: Nur auf freie Felder, kein aktives Feuer
            if (!isSolid(nx, ny) && !fireMap[ny][nx]) {
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    // Panik: Random
    return getRandomSafeDir(gx, gy, dangerMap);
}

// Pfadfinder (nutzt fireMap statt dangerMap für Hindernisse -> mutiger)
function findPath(sx, sy, tx, ty, fireMap, allowSoftWalls, selfId) {
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
            if (n.x<0||n.x>=GRID_W||n.y<0||n.y>=GRID_H) continue;
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            const tile = state.grid[n.y][n.x];
            // Hard Walls, Bomben und FEUER sind Hindernisse
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB || fireMap[n.y][n.x]) continue;
            
            if (!allowSoftWalls && tile === TYPES.WALL_SOFT) continue;
            if (isOccupiedByBot(n.x, n.y, selfId) && (n.x!==tx || n.y!==ty)) continue;

            visited.add(`${n.x},${n.y}`);
            queue.push({ x: n.x, y: n.y, firstMove: curr.firstMove || n.dir });
        }
    }
    return null;
}

function findNearestLoot(sx, sy, fireMap, selfId) {
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
            if (nx<0||nx>=GRID_W||ny<0||ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            const t = state.grid[ny][nx];
            if (t === TYPES.WALL_HARD || t === TYPES.BOMB || fireMap[ny][nx]) continue;
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

// Map 1: Alles was gefährlich ist oder gleich sein wird (für Flucht & Entscheidungen)
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    state.particles.forEach(p => { if (p.isFire) map[p.gy][p.gx] = true; });
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = true;
        DIRS.forEach(d => {
            for (let i = 1; i <= b.range; i++) {
                const tx=b.gx+(d.x*i), ty=b.gy+(d.y*i);
                if (tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+(d.x*i), ty=HELL_CENTER.y+(d.y*i);
            if (tx<0||tx>=GRID_W||ty<0||ty>=GRID_H||state.grid[ty][tx]===TYPES.WALL_HARD) break;
            map[ty][tx] = true;
            if (state.grid[ty][tx]===TYPES.WALL_SOFT) break;
        }});
    }
    return map;
}

// Map 2: Nur aktives Feuer (für Pfadfindung - durch Bombenradius darf man laufen!)
function getFireMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    state.particles.forEach(p => { if (p.isFire) map[p.gy][p.gx] = true; });
    return map;
}