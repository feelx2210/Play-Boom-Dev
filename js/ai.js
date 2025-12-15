import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

// Konstanten für Richtungen
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Berechnet einen Score für das Legen einer Bombe an der aktuellen Position.
 * Berücksichtigt Soft Walls, Skulls und Gegner.
 */
function calculateBombScore(gx, gy, range, isEndgame, targetPlayer) {
    let score = 0;
    
    // Distanz zum Spieler (für Aggressivität)
    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 1. Gegner-Druck (Besonders im Endgame wichtig)
    if (isEndgame && distToPlayer <= 4) {
        // Je näher, desto höher der Score. 
        // Wir wollen bomben, um den Spieler zu treffen oder einzuschränken.
        score += (5 - distToPlayer) * 20;
    }

    // 2. Wände und Items zerstören
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            if (tile === TYPES.WALL_SOFT) {
                score += 10; // Soft Walls sind gut, aber im Endgame weniger wichtig
                break; 
            }
            
            // Regel: Skull-Items wegsprengen (Enorme Priorität)
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 500; 
                 break; 
            }
            
            // Wenn der Spieler in Reichweite der Explosion ist -> TÖTEN!
            if (targetPlayer) {
                const pgx = Math.round(targetPlayer.x / TILE_SIZE);
                const pgy = Math.round(targetPlayer.y / TILE_SIZE);
                if (tx === pgx && ty === pgy) {
                    score += 200; // Volltreffer-Chance
                }
            }

            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Findet den Weg zum Spieler.
 */
function findPathToPlayer(gx, gy, dangerMap) {
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead); 
    if (!targetPlayer) return null;

    const targetGx = Math.round(targetPlayer.x / TILE_SIZE);
    const targetGy = Math.round(targetPlayer.y / TILE_SIZE);

    // BFS zum Spieler
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 800) break; // Performance-Limit
        const current = queue.shift();
        
        // Sind wir beim Spieler oder direkt daneben?
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        if (current.dist > 20) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Pfad blockiert durch Wände, Gefahr ODER SKULLS
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && !isSkull) {
                    visited.add(key);
                    queue.push({ 
                        x: nx, 
                        y: ny, 
                        firstMove: current.firstMove || d, 
                        dist: current.dist + 1
                    });
                }
            }
        }
    }
    return null;
}

/**
 * Findet Weg zu Items (außer Skulls).
 */
function findGoodItemMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break;
        const current = queue.shift();
        
        // Item gefunden (kein Skull!)
        const item = state.items[current.y][current.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) {
            return current.firstMove;
        }
        
        if (current.dist > 12) continue;
        
        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return null;
}

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Prüfen ob HARD Mode
    const isHardMode = (bot.difficulty === DIFFICULTIES.HARD);

    // 1. Gefahr erkennen (Priorität 1: Überleben)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    // --- NOTFALL / FLUCHT ---
    if (amInDanger) {
        targetDir = findSafeMove(gx, gy, dangerMap);
    } 
    // --- AKTION ---
    else {
        if (isHardMode) {
            // === HARD MODE LOGIK ===
            
            const softWallsLeft = state.grid.flat().filter(t => t === TYPES.WALL_SOFT).length;
            const isEndgame = softWallsLeft < 5; // Wenig Wände -> Aggressiver PvP Modus
            
            const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
            
            // A) BOMBEN LEGEN?
            if (bot.activeBombs < bot.maxBombs) {
                // Score berechnen: Lohnt sich eine Bombe hier?
                // Im Endgame ist der Score auch hoch, wenn der Spieler nah ist (ohne Wände).
                const bombScore = calculateBombScore(gx, gy, bot.range, isEndgame, targetPlayer);
                
                // Schwellenwert: 1 Punkt reicht (z.B. Softwall oder Spieler-Druck)
                if (bombScore > 0) {
                    if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        // Sofort flüchten
                        targetDir = findSafeMove(gx, gy, getDangerMap());
                    }
                }
            }

            // B) BEWEGUNG (nur wenn nicht gerade gebombt/geflüchtet wurde)
            if (targetDir.x === 0 && targetDir.y === 0) {
                
                // 1. Zielwahl: Spieler jagen (Endgame/Nah) ODER Items farmen
                let move = null;
                
                // Im Endgame oder wenn Spieler nah ist: Jagen!
                let distToPlayer = 999;
                if (targetPlayer) distToPlayer = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
                
                if (isEndgame || distToPlayer <= 5) {
                    move = findPathToPlayer(gx, gy, dangerMap);
                }
                
                // Wenn nicht am jagen (oder kein Weg zum Spieler), dann Items suchen
                if (!move && !isEndgame) {
                    move = findGoodItemMove(gx, gy, dangerMap);
                }
                
                // Fallback: Wenn wir im Endgame sind und Weg zum Spieler blockiert ist, suche trotzdem Items
                if (!move && isEndgame) {
                    move = findGoodItemMove(gx, gy, dangerMap);
                }

                if (move) {
                    targetDir = move;
                } else {
                    // Random Movement (Skull-Free)
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        if (state.items[ny][nx] === ITEMS.SKULL) return false; // SKULL VERMEIDEN
                        return !dangerMap[ny][nx]; 
                    });
                    if (safeNeighbors.length > 0) {
                        targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    }
                }
            }
            
            // === STRIKTER SKULL CHECK (Regel-Durchsetzung) ===
            // Wenn der Bot im Begriff ist, auf einen Skull zu laufen -> STOPP & BOMBE
            if (targetDir.x !== 0 || targetDir.y !== 0) {
                const nx = gx + targetDir.x; 
                const ny = gy + targetDir.y;
                if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                    // Auf keinen Fall betreten!
                    
                    // Versuch den Skull wegzubomben
                    if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        targetDir = findSafeMove(gx, gy, getDangerMap());
                    } else {
                        // Notbremse: Stehenbleiben und warten (besser als Skull fressen)
                        targetDir = {x:0, y:0};
                        bot.changeDirTimer = 0; // Sofort neue Entscheidung nächstes Frame
                    }
                }
            }

        } else {
            // === EASY / MEDIUM LOGIK (Original, leicht angepasst für Safety) ===
            const nearTarget = DIRS.some(d => {
                const tx = gx + d.x; const ty = gy + d.y;
                if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
                return state.grid[ty][tx] === TYPES.WALL_SOFT; 
            });

            if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    targetDir = findSafeMove(gx, gy, getDangerMap()); 
                }
            }

            if (targetDir.x === 0 && targetDir.y === 0) {
                 // Einfaches Random Walking mit Item-Suche
                 if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE))) {
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx]; 
                    });
                    
                    if (safeNeighbors.length > 0) {
                        const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else { targetDir = {x:0, y:0}; }
                    bot.changeDirTimer = 15 + Math.random() * 30;
                 } else { targetDir = bot.botDir || {x:0, y:0}; }
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
    bot.changeDirTimer--;
}

// ---------------- HELPER FUNCTIONS ----------------

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) {
            map[p.gy][p.gx] = true; 
        }
    });

    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        
        map[b.gy][b.gx] = true; 
        
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
            }
        });
    });

    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        const range = 5; 
        map[HELL_CENTER.y][HELL_CENTER.x] = true;
        DIRS.forEach(d => {
            for(let i=1; i<=range; i++) {
                const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
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

function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break; 
        const current = queue.shift();
        
        if (!dangerMap[current.y][current.x]) {
            return current.firstMove || {x:0, y:0}; 
        }
        
        if (current.dist > 12) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    // Panik: Zufall
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Check: Haben wir NACH dem Legen der Bombe (die das aktuelle Feld unsicher macht) einen freien Nachbarn?
    // Die Bombe macht (gx,gy) gefährlich. Wir brauchen ein Nachbarfeld, das sicher ist (und nicht die Bombe selbst).
    // Da currentDangerMap noch keine Bombe an (gx, gy) kennt, müssen wir sicherstellen, dass der Nachbar sicher ist.
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        // Nachbar muss begehbar und sicher sein
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}