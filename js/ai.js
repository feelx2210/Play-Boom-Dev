import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Prüft, ob der Spieler in einer direkten Feuerlinie steht (für "Sniper"-Schüsse).
 */
function isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer) {
    if (!targetPlayer) return false;
    const pgx = Math.round(targetPlayer.x / TILE_SIZE);
    const pgy = Math.round(targetPlayer.y / TILE_SIZE);

    // Nicht auf der gleichen Linie?
    if (pgx !== gx && pgy !== gy) return false;
    
    // Zu weit weg?
    const dist = Math.abs(pgx - gx) + Math.abs(pgy - gy);
    if (dist > range) return false;

    // Ist eine Wand dazwischen?
    const dx = Math.sign(pgx - gx);
    const dy = Math.sign(pgy - gy);
    
    for (let i = 1; i < dist; i++) {
        const tx = gx + (dx * i);
        const ty = gy + (dy * i);
        // Hard Wall oder Soft Wall blockiert das Feuer
        if (state.grid[ty][tx] === TYPES.WALL_HARD || state.grid[ty][tx] === TYPES.WALL_SOFT) {
            return false;
        }
    }
    return true;
}

/**
 * Bewertet, ob eine Bombe an der aktuellen Position sinnvoll ist.
 */
function calculateBombScore(gx, gy, range, isEndgame, targetPlayer) {
    let score = 0;
    
    // 1. KILL-CHECK (Höchste Prio): Steht der Spieler in der Schusslinie?
    if (targetPlayer && isPlayerAlignedAndVulnerable(gx, gy, range, targetPlayer)) {
        return 9999; // SOFORT FEUERN!
    }

    // Distanz für Nahkampf-Entscheidungen
    let distToPlayer = 999;
    if (targetPlayer) {
        const pgx = Math.round(targetPlayer.x / TILE_SIZE);
        const pgy = Math.round(targetPlayer.y / TILE_SIZE);
        distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    }

    // 2. AGGRESSION IM ENDGAME (Zone Control)
    if (isEndgame) {
        // Wenn wir nah dran sind, Bombe legen um ihn einzuschränken
        if (distToPlayer <= 4) score += 50;
        // Wenn wir sehr nah sind ("Kuscheln"), Bombe legen (Trap)
        if (distToPlayer <= 1) score += 200;
    }

    // 3. FARMING (Wände & Items & Skulls)
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
            
            // SKULLS ZERSTÖREN!
            if (state.items[ty][tx] === ITEMS.SKULL) {
                 score += 1000; // Sehr wichtig
                 break; 
            }

            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });
    
    return score;
}

/**
 * Findet den Weg zum Spieler (Aggressive Verfolgung).
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
        if (++ops > 600) break;
        const current = queue.shift();
        
        // Ziel erreicht (oder benachbart)
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 1) {
             return current.firstMove;
        }
        
        // Im Endgame suchen wir weiter (ganze Map), sonst begrenzen wir die Suche
        if (current.dist > 25) continue; 

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                // Wichtig: dangerMap checken, ABER wenn das Ziel sicher ist, ignorieren wir Pfad-Gefahr manchmal (Risiko)? Nein, sicher bleiben.
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
 * Sucht Items auf der ganzen Karte (Fallback).
 */
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
        
        if (current.dist > 15) continue;
        
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
    
    const softWallsLeft = state.grid.flat().filter(t => t === TYPES.WALL_SOFT).length;
    const isEndgame = (softWallsLeft < 5);

    let targetDir = {x:0, y:0};

    // ----------------------------------------------------------------
    // 1. FLUCHT (Überleben ist Prio 1)
    // ----------------------------------------------------------------
    if (amInDanger) {
        // Defensive Bombe ("Counter-Attack"), wenn Gegner nah ist und wir flüchten
        if (isHardMode && isEndgame && distToPlayer <= 3 && bot.activeBombs < bot.maxBombs) {
             if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                 bot.plantBomb();
                 dangerMap = getDangerMap(); // Map update für Fluchtweg
             }
        }
        targetDir = findSafeMove(gx, gy, dangerMap);
    } 
    // ----------------------------------------------------------------
    // 2. HARD MODE LOGIK (Attacke & Items)
    // ----------------------------------------------------------------
    else if (isHardMode) {
        
        // A) "GREEDY" ITEM GRAB (Löst das "Vorbeilaufen"-Problem)
        // Checke direkte Nachbarn. Wenn da ein Item liegt -> Nimm es sofort!
        let greedyItemMove = null;
        for (let d of DIRS) {
            const nx = gx + d.x; const ny = gy + d.y;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                const item = state.items[ny][nx];
                // Ist da ein gutes Item, ist es sicher und keine Wand?
                if (item !== ITEMS.NONE && item !== ITEMS.SKULL && !dangerMap[ny][nx] && !isSolid(nx, ny)) {
                    greedyItemMove = d;
                    break; // Sofort nehmen!
                }
            }
        }
        if (greedyItemMove) {
            targetDir = greedyItemMove;
        }

        // B) BOMBEN LEGEN (Wenn kein Greedy Item Move ansteht, oder um zu töten)
        // Wir prüfen das VOR der normalen Bewegung, damit wir stehen bleiben und legen können.
        if ((!targetDir.x && !targetDir.y) && bot.activeBombs < bot.maxBombs) {
            const bombScore = calculateBombScore(gx, gy, bot.range, isEndgame, targetPlayer);
            const threshold = isEndgame ? 1 : 10; // Im Endgame sehr aggressiv (1 Punkt reicht)
            
            if (bombScore >= threshold) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb();
                    // Sofort Flucht einleiten
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                }
            }
        }

        // C) TAKTISCHE BEWEGUNG (Wenn nicht gebombt oder Item genommen)
        if (targetDir.x === 0 && targetDir.y === 0) {
            
            let move = null;

            // Logik:
            // 1. Wenn Endgame -> Immer Spieler jagen (es gibt sonst nichts zu tun)
            // 2. Wenn Spieler nah -> Spieler jagen
            // 3. Sonst -> Items suchen -> Spieler suchen
            
            if (isEndgame || distToPlayer <= 8) {
                // Modus: JÄGER
                move = findPathToPlayer(gx, gy, dangerMap);
                // Wenn Jäger keinen Weg findet (eingesperrt?), such Items
                if (!move) move = findGoodItemMove(gx, gy, dangerMap);
            } else {
                // Modus: SAMMLER
                move = findGoodItemMove(gx, gy, dangerMap);
                // Wenn Sammler nichts findet, such Spieler
                if (!move) move = findPathToPlayer(gx, gy, dangerMap);
            }
            
            if (move) {
                targetDir = move;
            } else {
                // Fallback: Random (ohne Skulls)
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

        // D) SKULL PROTECTION (Letzte Instanz)
        if (targetDir.x !== 0 || targetDir.y !== 0) {
            const nx = gx + targetDir.x; const ny = gy + targetDir.y;
            if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
                // Bewegung abbrechen!
                if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    bot.plantBomb(); // Wegsprengen
                    targetDir = findSafeMove(gx, gy, getDangerMap());
                } else {
                    targetDir = {x:0, y:0}; // Stehen bleiben
                }
            }
        }

    } 
    // ----------------------------------------------------------------
    // 3. EASY/MEDIUM LOGIK
    // ----------------------------------------------------------------
    else {
        // ... (Original Code für Easy/Medium, unverändert sicher und simpel)
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
                    // Auch dumme Bots mögen Items
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
    // Check neighbors: Gibt es ein Feld, das sicher ist?
    // Die Bombe macht (gx,gy) gefährlich. Wir brauchen einen sicheren Nachbarn.
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}