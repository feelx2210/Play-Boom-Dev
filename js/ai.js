import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Prüft, ob der Spieler verwundbar in einer Linie steht ("Sniper"-Schuss).
 */
function isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer) {
    if (!targetPlayer) return false;
    const pgx = Math.round(targetPlayer.x / TILE_SIZE);
    const pgy = Math.round(targetPlayer.y / TILE_SIZE);

    if (pgx !== gx && pgy !== gy) return false; // Nicht auf einer Linie
    
    const dist = Math.abs(pgx - gx) + Math.abs(pgy - gy);
    if (dist > range) return false;

    const dx = Math.sign(pgx - gx);
    const dy = Math.sign(pgy - gy);
    
    // Prüfen, ob Wände im Weg sind
    for (let i = 1; i < dist; i++) {
        const tx = gx + (dx * i);
        const ty = gy + (dy * i);
        if (state.grid[ty][tx] === TYPES.WALL_HARD || state.grid[ty][tx] === TYPES.WALL_SOFT) {
            return false;
        }
    }
    return true;
}

/**
 * Bewertet Bombenpositionen. 
 * Erkennt Sackgassen, direkte Treffer und taktische Positionen.
 */
function calculateBombScore(gx, gy, range, isAggro, targetPlayer) {
    let score = 0;
    
    // 1. SNIPER-CHECK (Tötet sofort)
    if (targetPlayer && isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer)) {
        return 9999; 
    }

    let distToPlayer = 999;
    let pgx = -1, pgy = -1;
    if (targetPlayer) {
        pgx = Math.round(targetPlayer.x / TILE_SIZE);
        pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 2. SACKGASSEN-FALLE (CHOKE POINT)
    // Wenn der Spieler nur einen Ausweg hat und wir genau darauf stehen -> BOMB!
    if (targetPlayer && distToPlayer <= 2) { // Nur prüfen, wenn wir nah sind
        let freeNeighbors = 0;
        DIRS.forEach(d => {
            const nx = pgx + d.x; const ny = pgy + d.y;
            // Ist das Feld begehbar (keine Hard Wall, keine Soft Wall, keine Bombe)?
            if (!isSolid(nx, ny) && state.grid[ny][nx] !== TYPES.WALL_SOFT) {
                 freeNeighbors++;
            }
        });
        
        // Wenn der Spieler in einer Sackgasse (1 Weg) oder einem Schlauch (2 Wege, aber wir blockieren einen) ist.
        // Vereinfacht: Wenn er wenig Freiheit hat und wir nah sind.
        if (freeNeighbors <= 1 && distToPlayer === 1) {
            // Wir stehen direkt daneben und er hat kaum Platz. Das ist eine Falle.
            score += 20000; 
        }
    }

    // 3. ZONE CONTROL (Den Spieler einsperren)
    if (isAggro) {
        if (distToPlayer <= 2) score += 300; // Panic Bombing
        else if (distToPlayer <= 6) score += 100; // Zoning
    }

    // 4. STANDARD-ZIELE (Wände, Skulls)
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = gx + (d.x * i); const ty = gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            if (tile === TYPES.WALL_SOFT) {
                score += 20;
                break; 
            }
            
            // SKULLS ZERSTÖREN (Wichtig!)
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 500; 
                 break; 
            }

            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Sucht Pfad zum Spieler. Ignoriert Skulls.
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
        if (++ops > 1000) break; 
        const current = queue.shift();
        
        // Ziel erreicht (oder benachbart)
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        if (current.dist > 30) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
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
        if (++ops > 400) break;
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
    
    // Status-Check
    let dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    let distToPlayer = 999;
    if (targetPlayer) {
        distToPlayer = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
    }

    let targetDir = {x:0, y:0};
    
    // Falls wir bereits eine Bewegung haben (vom letzten Frame), übernehmen wir sie erst mal.
    // ABER: Das Bomben-System darf sie gleich überschreiben!
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) {
        targetDir = bot.botDir;
    }

    // ----------------------------------------------------------------
    // 1. FLUCHT (Prio 1)
    // ----------------------------------------------------------------
    if (amInDanger) {
        // Counter-Attack: Schnell noch eine legen beim Wegrennen?
        if (isHardMode && distToPlayer <= 3 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                dangerMap = getDangerMap(); 
            }
        }
        targetDir = findSafeMove(gx, gy, dangerMap);
        // Reset Timer bei Flucht, damit wir nicht in die falsche Richtung weitermachen
        bot.changeDirTimer = 0; 
    } 
    // ----------------------------------------------------------------
    // 2. HARD MODE: KILLER LOGIK
    // ----------------------------------------------------------------
    else if (isHardMode) {
        
        // --- AGGRO STATUS ---
        const killPath = findPathToPlayer(gx, gy, dangerMap);
        const playerIsWeak = targetPlayer && (targetPlayer.hasCurse || targetPlayer.noBombs); 
        // Wir sind Aggro, wenn der Spieler nah ist (< 8) oder wir einen direkten Weg haben oder er schwach ist.
        const isAggro = (distToPlayer < 8) || (killPath !== null) || playerIsWeak;

        // A) BOMBEN LEGEN (INTERRUPT!)
        // WICHTIG: Das passiert JETZT, auch wenn wir uns eigentlich bewegen wollten.
        // Damit fangen wir das "Vorbeilaufen am Ausgang" ab.
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = calculateBombScore(gx, gy, bot.range, isAggro, targetPlayer);
            const threshold = isAggro ? 1 : 15; 
            
            if (bombScore >= threshold) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // SOFORT FLUCHTWEG BERECHNEN UND BEWEGUNG ÜBERSCHREIBEN
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0; // Richtungswechsel erzwingen
                }
            }
        }

        // B) BEWEGUNG PLANEN (Nur wenn wir nicht gerade gebombt/geflüchtet sind)
        // Wir prüfen, ob wir unsere Richtung ändern wollen (Timer) oder müssen (Kollision/Stop)
        const nextX = Math.round((bot.x + bot.botDir.x * 20) / TILE_SIZE);
        const nextY = Math.round((bot.y + bot.botDir.y * 20) / TILE_SIZE);
        const isBlocked = isSolid(nextX, nextY);
        
        // Wenn wir keine aktive Bewegung haben ODER blockiert sind ODER der Timer abgelaufen ist:
        if ((targetDir.x === 0 && targetDir.y === 0) || isBlocked || bot.changeDirTimer <= 0) {
            
            // PRIO A: TÖTEN (Wenn Aggro aktiv)
            if (isAggro && killPath) {
                targetDir = killPath;
                // Kleiner Timer, damit er sich schnell anpasst, wenn der Spieler sich bewegt
                bot.changeDirTimer = 5; 
            }
            // PRIO B: GREEDY ITEMS (Nur wenn nicht Ultra-Aggro)
            else {
                // Quick-Check: Liegt ein Item direkt daneben?
                let greedyMove = null;
                for (let d of DIRS) {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                        const item = state.items[ny][nx];
                        if (item !== ITEMS.NONE && item !== ITEMS.SKULL && !dangerMap[ny][nx] && !isSolid(nx, ny)) {
                            greedyMove = d; break;
                        }
                    }
                }
                
                if (greedyMove) {
                    targetDir = greedyMove;
                    bot.changeDirTimer = 5;
                } else {
                    // Weit suchen
                    let itemMove = findGoodItemMove(gx, gy, dangerMap);
                    if (itemMove) {
                        targetDir = itemMove;
                         bot.changeDirTimer = 15;
                    }
                    else if (killPath) {
                        // Fallback: Spieler suchen, auch wenn weit weg
                        targetDir = killPath;
                        bot.changeDirTimer = 10;
                    }
                }
            }

            // Fallback: Random Movement
            if (!targetDir.x && !targetDir.y) {
                 const safeNeighbors = DIRS.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    if (state.items[ny][nx] === ITEMS.SKULL) return false;
                    return !dangerMap[ny][nx]; 
                 });
                 if (safeNeighbors.length > 0) {
                    targetDir = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                 }
                 bot.changeDirTimer = 15 + Math.random() * 30;
            }
        }
        
        // C) SKULL SCHUTZ (Überschreibt alles außer Flucht)
        if (targetDir.x !== 0 || targetDir.y !== 0) {
            const nx = gx + targetDir.x; const ny = gy + targetDir.y;
            if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb(); 
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0;
                } else {
                    targetDir = {x:0, y:0}; // Stop!
                    bot.changeDirTimer = 0;
                }
            }
        }
    } 
    // ----------------------------------------------------------------
    // 3. EASY/MEDIUM LOGIK
    // ----------------------------------------------------------------
    else {
        // Original-Logik beibehalten
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

        if (targetDir.x === 0 && targetDir.y === 0 || bot.changeDirTimer <= 0) {
            const nextX = Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE);
            const nextY = Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE);
             if (bot.changeDirTimer <= 0 || isSolid(nextX, nextY)) {
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

    // Bewegung ausführen
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

// ---------------- HELPER ----------------

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
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}