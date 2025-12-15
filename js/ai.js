import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

// Konstanten für Richtungen
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // Init Properties falls undefined (verhindert "nur einer bewegt sich")
    if (bot.changeDirTimer === undefined) bot.changeDirTimer = 0;
    if (!bot.botDir) bot.botDir = {x:0, y:0};

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. GEFAHR ERKENNEN
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT-MODUS (Priorität 1)
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        // ANGRIFFS-MODUS
        
        // Soll ich eine Bombe legen?
        if (bot.activeBombs < bot.maxBombs) {
            const shouldPlant = evaluateBombing(bot, gx, gy, state.difficulty);
            
            if (shouldPlant) {
                // WICHTIG: Sicherheits-Check mit Simulation (Nicht nur Nachbarn prüfen!)
                if (canEscapeAfterPlantingSmart(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Sofort flüchten
                    targetDir = findSafeMove(gx, gy, getDangerMap()); 
                }
            }
        }

        // Bewegung
        if (targetDir.x === 0 && targetDir.y === 0) {
            
            // --- HARD MODE INTELLIGENZ ---
            // Wenn Hard: Versuche gezielt zu jagen statt random zu laufen
            if (state.difficulty === DIFFICULTIES.HARD) {
                targetDir = getHardModeMove(bot, gx, gy, dangerMap);
            }

            // --- STANDARD WANDER LOGIK (Fallback & Easy/Medium) ---
            // Wenn wir kein smartes Ziel haben (oder nicht Hard sind), nutzen wir deine Wander-Logik
            if (targetDir.x === 0 && targetDir.y === 0) {
                // Richtungswechsel nur alle paar Frames oder wenn blockiert
                const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
                const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
                
                if (bot.changeDirTimer <= 0 || isSolid(nextX, nextY)) {
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx]; // Nicht in Gefahr laufen
                    });
                    
                    if (safeNeighbors.length > 0) {
                        // Priorität: Items einsammeln (im direkten Umfeld)
                        const itemMove = safeNeighbors.find(d => {
                            const item = state.items[gy+d.y][gx+d.x];
                            // Auf Hard keine Skulls sammeln!
                            if (state.difficulty === DIFFICULTIES.HARD && item === ITEMS.SKULL) return false;
                            return item !== ITEMS.NONE;
                        });
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else {
                        targetDir = {x:0, y:0}; // Sackgasse
                    }
                    bot.changeDirTimer = 15 + Math.random() * 30;
                } else {
                    targetDir = bot.botDir || {x:0, y:0}; // Geradeaus weiter
                }
            }
        }
    }

    // Bewegung ausführen
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;
}

// ==========================================
//           HARD MODE ADD-ONS
// ==========================================

function getHardModeMove(bot, gx, gy, dangerMap) {
    // 1. Priorität: Player 1 jagen
    const player = state.players.find(p => p.id === 1 && p.alive);
    if (player) {
        // Pfad zum Spieler suchen (ignoriert Softwalls für den "Breach"-Effekt)
        const move = findNextStepBFS(gx, gy, Math.round(player.x/TILE_SIZE), Math.round(player.y/TILE_SIZE), dangerMap);
        if (move) return move;
    }

    // 2. Priorität: Nächste Kiste suchen (zum Farmen)
    const loot = findNearestBox(gx, gy, dangerMap);
    if (loot) {
        return loot; // Richtung zur Kiste
    }

    return {x:0, y:0}; // Nichts gefunden -> Fallback auf Wander
}

function evaluateBombing(bot, gx, gy, difficulty) {
    // 1. Zerstöre ich ein Item? -> NIEMALS (außer Skull)
    if (willDestroyItem(gx, gy, bot.bombRange)) return false;

    // 2. Gegner Check (Kill)
    const enemy = state.players.find(p => p.id === 1 && p.alive); // Fokus auf Player 1
    if (enemy) {
        const ex = Math.round(enemy.x/TILE_SIZE);
        const ey = Math.round(enemy.y/TILE_SIZE);
        const dist = Math.abs(gx-ex) + Math.abs(gy-ey);
        
        // Wenn Gegner nah (Hard: Radius+2, sonst Radius)
        const range = (difficulty === DIFFICULTIES.HARD) ? bot.bombRange + 2 : bot.bombRange;
        if (dist <= range) {
            // Sind wir auf einer Linie?
            const onLine = (gx === ex || gy === ey);
            if (onLine && hasLineOfSight(gx, gy, ex, ey)) return true;
        }
    }

    // 3. Kisten Check (Farm)
    const wallsHit = countDestroyableWalls(gx, gy, bot.bombRange);
    
    if (wallsHit === 0) return false;
    
    // Hard: Nur legen, wenn es sich lohnt (oder keine bessere Option nah ist)
    if (difficulty === DIFFICULTIES.HARD) {
        if (wallsHit >= 2) return true; // Super Spot
        // Wenn nur 1 Kiste: Zufall (damit sie nicht ewig warten)
        return Math.random() < 0.3;
    }

    // Easy/Medium: Einfach legen wenn Kiste da
    return Math.random() < 0.05;
}

// ==========================================
//           STANDARD LOGIK (Optimiert)
// ==========================================

function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, move: null}];
    const visited = new Set([`${gx},${gy}`]);
    
    let ops = 0;
    while (queue.length > 0 && ops++ < 200) {
        const curr = queue.shift();
        
        if (!dangerMap[curr.y][curr.x]) return curr.move || {x:0,y:0}; // Safe!

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`) && !isSolid(nx, ny)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, move: curr.move || d});
            }
        }
    }
    // Notfall: Random
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

// Verbesserter Safety Check: Simuliert die Explosion
function canEscapeAfterPlantingSmart(gx, gy, dangerMap, range) {
    // 1. Virtuelle Gefahr hinzufügen
    const vMap = dangerMap.map(row => [...row]); // Copy
    vMap[gy][gx] = true;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx=gx+d.x*i; const ty=gy+d.y*i;
            if(isSolidWall(tx, ty)) break;
            if(tx>=0 && tx<GRID_W && ty>=0 && ty<GRID_H) vMap[ty][tx] = true;
            if(state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // 2. Suche Weg ins Sichere (Start bei Bombe ist erlaubt)
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        if (!vMap[curr.y][curr.x]) return true; // Ausweg gefunden!

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Wir dürfen durch die "werdende" Explosion laufen, um zu entkommen
            // Aber nicht durch Wände
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`) && !isSolid(nx, ny)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny});
            }
        }
    }
    return false;
}

// Findet den nächsten Schritt zum Ziel (BFS)
function findNextStepBFS(sx, sy, tx, ty, dangerMap) {
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 400) {
        const curr = queue.shift();
        if(curr.x === tx && curr.y === ty) return curr.first; // Ziel erreicht (oder davor)

        // Sortiere Nachbarn nach Distanz (Greedy)
        const neighbors = DIRS.map(d=>({x:curr.x+d.x, y:curr.y+d.y, dir:d}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for(let n of neighbors) {
            if(visited.has(`${n.x},${n.y}`)) continue;
            if(n.x<0||n.x>=GRID_W||n.y<0||n.y>=GRID_H) continue;
            
            // Auf dem Weg zum Gegner weichen wir Gefahren aus
            if(dangerMap[n.y][n.x]) continue;

            // Hindernis?
            let blocked = isSolid(n.x, n.y);
            // Breach: Wir tun so, als ob Softwalls keine Hindernisse sind (wir bomben sie ja weg)
            // Wenn wir direkt vor einer Softwall stehen, geben wir diesen Schritt zurück (Bot läuft davor)
            if (state.grid[n.y][n.x] === TYPES.WALL_SOFT) {
                if (!curr.first) return n.dir; // Wir stehen direkt davor -> hingehen
                continue; // Sonst ist es ein Hindernis für den Pfadfinder
            }

            if(!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, first: curr.first || n.dir});
            }
        }
    }
    return null;
}

function findNearestBox(sx, sy, dangerMap) {
    // Suche nächste Kiste (BFS)
    const queue = [{x:sx, y:sy, first:null}];
    const visited = new Set([`${sx},${sy}`]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        
        // Ist hier eine Kiste nebenan?
        const boxDir = DIRS.find(d => {
            const bx = curr.x+d.x; const by = curr.y+d.y;
            return state.grid[by] && state.grid[by][bx] === TYPES.WALL_SOFT;
        });
        
        if (boxDir) return curr.first || boxDir; // Geh in Position

        for(let d of DIRS) {
            const nx=curr.x+d.x; const ny=curr.y+d.y;
            if(nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`) && !isSolid(nx, ny) && !dangerMap[ny][nx]) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, first: curr.first || d});
            }
        }
    }
    return null;
}

// ---------------- HELPER ----------------

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // Feuer
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
    });

    // Bomben
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        
        map[b.gy][b.gx] = true;
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (isSolidWall(tx, ty)) break;
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });

    // Hellfire
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        const range = 5; 
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        DIRS.forEach(d => {
            for(let i=1; i<=range; i++) {
                const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
                if (isSolidWall(tx, ty)) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    }
    return map;
}

function countDestroyableWalls(gx, gy, range) {
    let count = 0;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break;
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) { count++; break; }
        }
    });
    return count;
}

function willDestroyItem(gx, gy, range) {
    let destroys = false;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break;
            const item = state.items[ty][tx];
            if (item !== ITEMS.NONE && item !== ITEMS.SKULL) destroys = true;
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });
    return destroys;
}

function isSolidWall(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return true;
    return state.grid[y][x] === TYPES.WALL_HARD;
}

function hasLineOfSight(x1, y1, x2, y2) {
    if (x1 === x2) { 
        const start = Math.min(y1, y2); const end = Math.max(y1, y2);
        for(let y=start+1; y<end; y++) if (isSolid(x1, y)) return false;
    } else { 
        const start = Math.min(x1, x2); const end = Math.max(x1, x2);
        for(let x=start+1; x<end; x++) if (isSolid(x, y1)) return false;
    }
    return true;
}