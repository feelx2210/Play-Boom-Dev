import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Bewertet, ob eine Bombe an der aktuellen Position sinnvoll ist.
 * Im Endgame ist dieser Score deutlich aggressiver.
 */
function calculateBombScore(gx, gy, range, isEndgame, targetPlayer) {
    let score = 0;
    
    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // --- ENDGAME / PvP LOGIK ---
    if (isEndgame) {
        // Zone Control: Wenn der Spieler nah ist (<= 5), ist JEDE Bombe gut, 
        // um ihn unter Druck zu setzen, auch wenn sie nicht direkt trifft.
        if (distToPlayer <= 5) {
            score += 50; 
        }
        
        // Trap: Wenn wir sehr nah sind (<= 2), fast immer legen!
        if (distToPlayer <= 2) {
            score += 200;
        }
    }

    // --- STANDARD LOGIK (Wände & Items) ---
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            // Soft Walls zerstören
            if (tile === TYPES.WALL_SOFT) {
                score += 10;
                break; 
            }
            
            // SKULLS ZERSTÖREN (Höchste Prio)
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 500; 
                 break; 
            }
            
            // Spieler treffen
            if (targetPlayer) {
                const pgx = Math.round(targetPlayer.x / TILE_SIZE);
                const pgy = Math.round(targetPlayer.y / TILE_SIZE);
                if (tx === pgx && ty === pgy) {
                    score += 1000; // Volltreffer
                }
            }

            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Findet den Weg zum Spieler (Aggressive Verfolgung).
 * Skulls werden wie Wände behandelt (unpassierbar).
 */
function findPathToPlayer(gx, gy, dangerMap) {
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead); 
    if (!targetPlayer) return null;

    const targetGx = Math.round(targetPlayer.x / TILE_SIZE);
    const targetGy = Math.round(targetPlayer.y / TILE_SIZE);

    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 800) break;
        const current = queue.shift();
        
        // Ziel erreicht (oder benachbart für Angriff)
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        if (current.dist > 20) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // Skulls sind Tabu!
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

function findGoodItemMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break;
        const current = queue.shift();
        
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
    const isHardMode = (bot.difficulty === DIFFICULTIES.HARD);
    
    // Aktuellen Status analysieren
    let dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    
    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }
    
    // Endgame-Erkennung: Wenig Softwalls oder 1v1 Situation
    const softWallsLeft = state.grid.flat().filter(t => t === TYPES.WALL_SOFT).length;
    const activeBots = state.players.filter(p => !p.isHuman && !p.isDead).length;
    // Wenn wenige Wände da sind ODER wir der letzte Bot sind -> Aggro Mode
    const isEndgame = (softWallsLeft < 10) || (activeBots === 1); 

    let targetDir = {x:0, y:0};

    // ----------------------------------------------------------------
    // 1. FLUCHT & DEFENSIVE (Wenn in Gefahr)
    // ----------------------------------------------------------------
    if (amInDanger) {
        if (isHardMode) {
            // DEFENSIVE BOMBE:
            // Wenn wir fliehen müssen, aber der Spieler nah ist (Verfolgung?), 
            // legen wir eine Bombe als Abschiedsgeschenk, falls wir danach noch wegkommen.
            if (bot.activeBombs < bot.maxBombs && distToPlayer <= 4) {
                // Prüfen: Wenn wir JETZT legen, kommen wir dann noch weg?
                // Da wir eh schon in Gefahr sind, müssen wir prüfen, ob ein Nachbarfeld sicher ist.
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Map updaten, da jetzt eine neue Bombe da ist
                    dangerMap = getDangerMap(); 
                }
            }
        }
        // Weglaufen
        targetDir = findSafeMove(gx, gy, dangerMap);
    } 
    // ----------------------------------------------------------------
    // 2. ANGRIFF & STRATEGIE (Wenn sicher)
    // ----------------------------------------------------------------
    else {
        if (isHardMode) {
            
            // A) AGGRESSIVES BOMBEN (Offensive)
            // Prüfen ob wir bomben wollen/sollten
            if (bot.activeBombs < bot.maxBombs) {
                const bombScore = calculateBombScore(gx, gy, bot.range, isEndgame, targetPlayer);
                
                // Im Endgame sind wir viel trigger-happyer (Score > 0 reicht)
                // Außerhalb Endgame wollen wir mind. eine Wand oder so treffen (Score > 10)
                const threshold = isEndgame ? 1 : 15;
                
                if (bombScore >= threshold) {
                    if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        // Nach dem Legen SOFORT Fluchtweg berechnen
                        targetDir = findSafeMove(gx, gy, getDangerMap());
                    }
                }
            }

            // B) BEWEGUNG (Falls noch nicht gebombt/geflüchtet)
            if (targetDir.x === 0 && targetDir.y === 0) {
                let move = null;
                
                // Prioritäten-Logik:
                // 1. Endgame/Nahkampf -> Spieler jagen!
                // 2. Normal -> Items sammeln -> Spieler jagen
                
                if (isEndgame || distToPlayer <= 6) {
                    // Fokus auf Spieler
                    move = findPathToPlayer(gx, gy, dangerMap);
                    
                    // Wenn kein Weg zum Spieler (eingemauert?), such Items
                    if (!move) move = findGoodItemMove(gx, gy, dangerMap);
                } else {
                    // Fokus auf Items / Farming
                    move = findGoodItemMove(gx, gy, dangerMap);
                    // Wenn keine Items, such Spieler
                    if (!move) move = findPathToPlayer(gx, gy, dangerMap);
                }
                
                if (move) {
                    targetDir = move;
                } else {
                    // Random Movement (Skull-Free)
                    const safeNeighbors = DIRS.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        if (state.items[ny][nx] === ITEMS.SKULL) return false;
                        return !dangerMap[ny][nx]; 
                    });
                    if (safeNeighbors.length > 0) {
                        targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    }
                }
            }
            
            // C) SKULL SCHUTZ (Letzte Instanz)
            // Wenn der gewählte Weg auf einen Skull führt -> STOPP & BOMBEN
            if (targetDir.x !== 0 || targetDir.y !== 0) {
                const nx = gx + targetDir.x; 
                const ny = gy + targetDir.y;
                if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                    // Skull im Weg! Wegbomben!
                    if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        bot.plantBomb();
                        targetDir = findSafeMove(gx, gy, getDangerMap());
                    } else {
                        targetDir = {x:0, y:0};
                        bot.changeDirTimer = 0; 
                    }
                }
            }

        } else {
            // === EASY / MEDIUM (Original) ===
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

    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

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
        if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
        if (current.dist > 12) continue; 
        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                if (!isSolid(nx, ny)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Nachbar muss begehbar und sicher sein (auf Basis der JETZIGEN DangerMap)
    // Die eigene Bombe ist in currentDangerMap noch nicht drin, aber das ist okay,
    // solange wir wissen, dass wir das Feld (gx,gy) verlassen können.
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}