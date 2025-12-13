import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // State-Initialisierung
    if (bot.aiTargetX === undefined) { bot.aiTargetX = null; bot.aiTargetY = null; }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. GEFAHRENANALYSE (Das Wichtigste zuerst!)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];

    // NOTFALL-MODUS: Wenn wir in Gefahr sind, vergiss alles andere.
    if (amInDanger) {
        bot.aiTargetX = null; // Aktuelles Ziel verwerfen
        
        // Suche das nächste sichere Feld
        const escapeDir = findEscapeRoute(gx, gy, dangerMap);
        
        // Bewegen (ohne Grid-Snap, Hauptsache weg!)
        if (escapeDir.x !== 0 || escapeDir.y !== 0) {
            bot.move(escapeDir.x * bot.speed, escapeDir.y * bot.speed);
            
            // Animation setzen
            if (escapeDir.x !== 0) bot.lastDir = { x: Math.sign(escapeDir.x), y: 0 };
            else bot.lastDir = { x: 0, y: Math.sign(escapeDir.y) };
        }
        return; // Frame beenden
    }

    // 2. GRID MOVEMENT (Raster-Bewegung für ruhiges Laufen)
    // Wenn wir ein Ziel haben und NICHT in Gefahr sind -> Laufen.
    if (bot.aiTargetX !== null) {
        // Prüfen: Ist das Ziel plötzlich blockiert oder gefährlich geworden?
        if (isSolid(bot.aiTargetX, bot.aiTargetY) || dangerMap[bot.aiTargetY][bot.aiTargetX]) {
            bot.aiTargetX = null; // Abbruch
        } else {
            // Distanz-Check
            const targetPx = bot.aiTargetX * TILE_SIZE;
            const targetPy = bot.aiTargetY * TILE_SIZE;
            const dx = targetPx - bot.x;
            const dy = targetPy - bot.y;
            
            if (Math.sqrt(dx*dx + dy*dy) <= bot.speed) {
                // Angekommen -> Snap & Hirn einschalten
                bot.x = targetPx; 
                bot.y = targetPy;
                bot.aiTargetX = null; 
            } else {
                // Weiterlaufen
                const mx = Math.sign(dx) * bot.speed;
                const my = Math.sign(dy) * bot.speed;
                if (mx!==0) bot.lastDir = {x:Math.sign(mx), y:0};
                else if (my!==0) bot.lastDir = {x:0, y:Math.sign(my)};
                bot.move(mx, my);
                return; // Keine neuen Entscheidungen während Bewegung
            }
        }
    }

    // 3. KI ENTSCHEIDUNG (Nur wenn wir stillstehen)
    // Hier entscheiden wir, was als nächstes passiert.
    
    let nextMove = {x:0, y:0};
    
    // Zielwahl (Mensch oder Bot)
    let enemy = null;
    const human = state.players.find(p => p.id === 1 && p.alive);
    if (state.difficulty === DIFFICULTIES.HARD && human) enemy = human;
    else enemy = findNearestEnemy(bot);

    // Modus-Wahl
    let mode = 'FARM';
    const pathToEnemy = enemy ? findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false, bot.id) : null;

    if (state.difficulty === DIFFICULTIES.HARD) {
        if (pathToEnemy) mode = 'HUNT';
        else if (bot.maxBombs >= 2) mode = 'BREACH'; // Tunnel graben
    } else {
        if (pathToEnemy && Math.random() < 0.5) mode = 'HUNT';
    }

    // --- TAKTIK AUSFÜHRUNG ---

    // A) HUNT: Gegner jagen und töten
    if (mode === 'HUNT' && enemy) {
        nextMove = pathToEnemy || {x:0, y:0};
        
        // Bomben-Check
        if (bot.activeBombs < bot.maxBombs) {
            const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
            
            // Lege Bombe, wenn...
            // 1. Gegner nah genug ist
            // 2. Wir auf einer Linie sind (X oder Y gleich)
            // 3. WICHTIG: Wir einen sicheren Fluchtweg HABEN
            const aligned = (Math.abs(enemy.x - bot.x) < 15 || Math.abs(enemy.y - bot.y) < 15);
            
            if (dist <= bot.bombRange && aligned) {
                if (canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // SOFORTIGE FLUCHT EINLEITEN (nicht warten!)
                    const escape = findEscapeRoute(gx, gy, getDangerMap()); // Map neu holen inkl. eigener Bombe
                    if (escape.x !== 0 || escape.y !== 0) {
                        bot.move(escape.x * bot.speed, escape.y * bot.speed);
                    }
                    return;
                }
            }
        }
    } 
    // B) BREACH / FARM: Kisten suchen und sprengen
    else if (mode === 'BREACH' || mode === 'FARM') {
        let targetPath = null;
        
        // Breach sucht Weg zum Gegner durch Wände
        if (mode === 'BREACH' && enemy) {
            targetPath = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true, bot.id);
        }
        // Fallback Farm: Sucht nächste Kiste
        if (!targetPath) {
            targetPath = findNearestLoot(gx, gy, dangerMap, bot.id);
        }

        if (targetPath) {
            const nx = gx + targetPath.x;
            const ny = gy + targetPath.y;
            
            // Stehen wir vor einer Softwall?
            if (state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT) {
                // Sprengen?
                if (bot.activeBombs < bot.maxBombs && canPlantAndEscape(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Sofort weg!
                    const escape = findEscapeRoute(gx, gy, getDangerMap());
                    bot.move(escape.x * bot.speed, escape.y * bot.speed);
                    return;
                }
                // Wenn wir nicht sprengen können, warten wir hier (nicht reinlaufen!)
                nextMove = {x:0, y:0}; 
            } else {
                nextMove = targetPath;
            }
        } else {
            // Nichts zu tun? Random walk (selten)
            if (Math.random() < 0.1) nextMove = getRandomSafeDir(gx, gy, dangerMap);
        }
    }

    // 4. MOVING
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const tx = gx + nextMove.x;
        const ty = gy + nextMove.y;
        
        // Ziel speichern (Grid Lock)
        // WICHTIG: Nicht in andere Bots laufen
        if (!isSolid(tx, ty) && !isOccupiedByBot(tx, ty, bot.id)) {
            bot.aiTargetX = tx; 
            bot.aiTargetY = ty;
        }
    }
}

// --- HELPER FUNCTIONS ---

// Prüft, ob nach dem Legen einer Bombe an (gx,gy) ein sicheres Feld erreichbar ist
function canPlantAndEscape(gx, gy, currentDangerMap, range) {
    // 1. Simuliere die Explosion (Virtuelle DangerMap)
    // Wir erstellen ein Set von "verbrannten" Koordinaten
    const simulatedDanger = new Set();
    
    // Bombe selbst
    simulatedDanger.add(`${gx},${gy}`);
    
    // Strahlen
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x * i;
            const ty = gy + d.y * i;
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H || state.grid[ty][tx] === TYPES.WALL_HARD) break;
            
            simulatedDanger.add(`${tx},${ty}`);
            
            // Softwalls blockieren den Strahl, verbrennen aber selbst
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // 2. Suche per BFS einen Weg zu einem sicheren Feld
    // Ein Feld ist sicher, wenn es NICHT in 'simulatedDanger' und NICHT in 'currentDangerMap' ist.
    // Man darf DURCH die simulierte Danger-Zone laufen, solange man am Ende sicher steht.
    // (In der Realität läuft man weg, BEVOR es knallt).
    
    const queue = [{x: gx, y: gy, dist: 0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 150) break; // Performance Limit
        const curr = queue.shift();
        
        const key = `${curr.x},${curr.y}`;
        // Ist DIESES Feld sicher? (Außerhalb der Simulation UND keine andere Gefahr)
        if (!simulatedDanger.has(key) && !currentDangerMap[curr.y][curr.x]) {
            return true; // Ja, wir haben einen Zufluchtsort gefunden!
        }

        // Limitieren der Suche (wir rennen nicht über die halbe Map weg)
        if (curr.dist > 5) continue;

        for (let d of DIRS) {
            const nx = curr.x + d.x;
            const ny = curr.y + d.y;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                
                // Wir können nur über begehbare Felder flüchten
                if (!isSolid(nx, ny)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
                }
            }
        }
    }
    
    return false; // Kein sicherer Ort erreichbar -> Selbstmord!
}

function findEscapeRoute(gx, gy, dangerMap) {
    // BFS zum nächsten sicheren Feld
    // Bevorzugt Felder, die NICHT dangerMap markiert sind
    if (!dangerMap[gy][gx]) return {x:0, y:0};

    const queue = [{x: gx, y: gy, firstMove: null}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        
        if (!dangerMap[curr.y][curr.x]) {
            return curr.firstMove || {x:0, y:0};
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx<0||nx>=GRID_W||ny<0||ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            if (!isSolid(nx, ny)) {
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny, firstMove: curr.firstMove || d });
            }
        }
    }
    // Wenn kein Ausweg: Random (besser als Stillstand)
    return getRandomSafeDir(gx, gy, dangerMap);
}

// --- STANDARD PFADFINDUNG ---

function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls, selfId) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    let ops = 0;
    while(queue.length > 0) {
        if (ops++ > 400) break;
        const curr = queue.shift();
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        // Greedy Sortierung (Richtung Ziel)
        const neighbors = DIRS.map(d => ({ x: curr.x + d.x, y: curr.y + d.y, dir: d }))
            .sort((a, b) => (Math.abs(a.x - tx) + Math.abs(a.y - ty)) - (Math.abs(b.x - tx) + Math.abs(b.y - ty)));

        for (let n of neighbors) {
            if (n.x<0||n.x>=GRID_W||n.y<0||n.y>=GRID_H) continue;
            if (visited.has(`${n.x},${n.y}`)) continue;
            const tile = state.grid[n.y][n.x];
            if (tile===TYPES.WALL_HARD||tile===TYPES.BOMB||dangerMap[n.y][n.x]) continue;
            if (!allowSoftWalls && tile===TYPES.WALL_SOFT) continue;
            if (isOccupiedByBot(n.x, n.y, selfId) && (n.x!==tx || n.y!==ty)) continue; // Bot ausweichen
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
        if ((curr.x!==sx || curr.y!==sy) && (tile===TYPES.WALL_SOFT || item!==ITEMS.NONE)) return curr.firstMove;
        if (tile===TYPES.WALL_SOFT && (curr.x!==sx || curr.y!==sy)) continue;
        for (let d of DIRS) {
            const nx=curr.x+d.x, ny=curr.y+d.y;
            if (nx<0||nx>=GRID_W||ny<0||ny>=GRID_H) continue;
            if (visited.has(`${nx},${ny}`)) continue;
            const t = state.grid[ny][nx];
            if (t===TYPES.WALL_HARD||t===TYPES.BOMB||dangerMap[ny][nx]) continue;
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

// DangerMap inkl. Bomben-Explosionsradien und Feuer
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