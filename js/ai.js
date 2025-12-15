import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

/**
 * Wählt den besten Bombenmodus basierend auf der Situation.
 */
function selectBestBombMode(bot, distToPlayer, isOpenArea) {
    // 1. Napalm: Gut für Gebietskontrolle oder um Sackgassen dauerhaft zu versperren.
    // Nicht nutzen, wenn man selbst eingesperrt ist.
    if (bot.hasNapalm) {
        // Wenn wir Platz haben oder den Spieler einsperren wollen -> Napalm
        if (isOpenArea || distToPlayer <= 3) {
            bot.currentBombMode = BOMB_MODES.NAPALM;
            return;
        }
    }
    
    // 2. Rolling: Nur auf Distanz und wenn freie Bahn (Sniper).
    if (bot.hasRolling && distToPlayer > 4 && isOpenArea) {
        bot.currentBombMode = BOMB_MODES.ROLLING;
        return;
    }

    // 3. Standard: Immer solide.
    bot.currentBombMode = BOMB_MODES.STANDARD;
}

/**
 * Prüft, ob der Spieler in einer Sackgasse sitzt.
 * Eine Sackgasse ist definiert als Position mit <= 1 Fluchtweg.
 */
function isPlayerTrapped(player, botGx, botGy) {
    if (!player) return false;
    const pgx = Math.round(player.x / TILE_SIZE);
    const pgy = Math.round(player.y / TILE_SIZE);
    
    // Distanz-Check: Wir müssen nah sein, um die Falle zuschnappen zu lassen
    const dist = Math.abs(pgx - botGx) + Math.abs(pgy - botGy);
    if (dist > 2) return false;

    // Zähle freie Nachbarn des Spielers
    let freeExits = 0;
    DIRS.forEach(d => {
        const nx = pgx + d.x;
        const ny = pgy + d.y;
        // Ist das Feld begehbar?
        // ACHTUNG: Wir zählen das Feld, auf dem der BOT steht, als "nicht frei",
        // weil der Bot gleich eine Bombe legen wird!
        const isBotPos = (nx === botGx && ny === botGy);
        
        if (!isSolid(nx, ny) && !isBotPos) {
            freeExits++;
        }
    });

    // Wenn der Spieler 0 oder 1 Ausweg hat, sitzt er in der Falle.
    return freeExits <= 1;
}

/**
 * Bewertet, ob hier eine Bombe gelegt werden soll.
 */
function evaluateBombPosition(bot, gx, gy, dangerMap) {
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    if (!targetPlayer) return 0;

    const pgx = Math.round(targetPlayer.x / TILE_SIZE);
    const pgy = Math.round(targetPlayer.y / TILE_SIZE);
    const distToPlayer = Math.abs(gx - pgx) + Math.abs(gy - pgy);
    
    let score = 0;

    // 1. DIE FALLE (Sackgasse) - Höchste Priorität
    if (isPlayerTrapped(targetPlayer, gx, gy)) {
        return 100000; // Sofort töten!
    }

    // 2. NAHKAMPF (Kuscheln)
    if (distToPlayer <= 1) return 50000; // Face-to-Face Bombing
    
    // 3. SKULL ZERSTÖREN (Sicherheit)
    // Suche nach Skulls in Reichweite
    let skullFound = false;
    DIRS.forEach(d => {
        for(let i=1; i<=bot.range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolid(tx, ty) && state.grid[ty][tx] !== TYPES.WALL_SOFT) break;
            if (state.items[ty] && state.items[ty][tx] === ITEMS.SKULL) {
                skullFound = true; break;
            }
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });
    if (skullFound) score += 2000;

    // 4. AGGRESSION (Zone Control / Spam)
    // Wenn wir nah sind (< 6 Felder), legen wir Bomben, um den Weg abzuschneiden.
    if (distToPlayer <= 6) {
        score += 200;
    }

    // 5. FARMING (Soft Walls)
    // Bevorzuge Stellen mit MEHREREN Wänden
    let softWallsHit = 0;
    DIRS.forEach(d => {
        for(let i=1; i<=bot.range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) {
                softWallsHit++;
                break;
            }
        }
    });
    score += softWallsHit * 50; // Jede Wand 50 Punkte

    return score;
}

/**
 * Pathfinding: Sucht den nächsten Weg zum Ziel.
 * Ignoriert strikt Skulls und Gefahren.
 */
function getPath(gx, gy, targetGx, targetGy, dangerMap, maxDist = 20) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 1000) break;
        const current = queue.shift();
        
        // Ziel erreicht (oder benachbart)
        if (Math.abs(current.x - targetGx) + Math.abs(current.y - targetGy) <= 0) {
            return current.firstMove;
        }

        if (current.dist >= maxDist) continue;

        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y;
            const key = nx + "," + ny;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                // STRIKTE REGELN:
                // 1. Nicht durch Wände/Bomben (isSolid)
                // 2. Nicht in Explosionen (dangerMap)
                // 3. NIEMALS durch Skulls (ITEMS.SKULL)
                const isSkull = state.items[ny] && state.items[ny][nx] === ITEMS.SKULL;
                
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && !isSkull) {
                    visited.add(key);
                    queue.push({
                        x: nx, y: ny, 
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
 * Findet das nächste "gute" Item (kein Skull).
 */
function findNearestItem(gx, gy, dangerMap) {
    // Greedy Check: Liegt was direkt nebenan? (Radius 1-2)
    // Das verhindert das "Vorbeilaufen".
    for(let r=1; r<=3; r++) {
         // Spiral or simple box search could work, simple BFS is safer for walls
    }

    // BFS Suche nach Items
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 600) break;
        const current = queue.shift();
        
        const item = state.items[current.y][current.x];
        // Positiv-Check: Item da, kein Skull, keine Gefahr
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) {
            return current.firstMove;
        }

        if (current.dist > 15) continue;

        for (let d of DIRS) {
            const nx = current.x + d.x; const ny = current.y + d.y;
            const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                const isSkull = state.items[ny][nx] === ITEMS.SKULL;
                if (!isSolid(nx, ny) && !dangerMap[ny][nx] && !isSkull) {
                    visited.add(key);
                    queue.push({x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1});
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
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    const targetPlayer = state.players.find(p => p.isHuman && !p.isDead);
    
    // Distanz zum Spieler
    let distToPlayer = 999;
    if (targetPlayer) {
        distToPlayer = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
    }

    let nextMove = {x:0, y:0};

    // -------------------------------------------------------------
    // PRIORITÄT 1: ÜBERLEBEN (Flucht)
    // -------------------------------------------------------------
    if (amInDanger) {
        // "Counter-Bomb": Wenn wir eh rennen müssen, legen wir noch eine, 
        // um den Verfolger zu ärgern (wenn wir sicher entkommen können).
        if (isHardMode && bot.activeBombs < bot.maxBombs && distToPlayer <= 4) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                // DangerMap muss neu berechnet werden, da jetzt eine Bombe liegt
                // (wird im nächsten Frame oder durch Escape-Funktion behandelt)
            }
        }
        nextMove = findSafeMove(gx, gy, dangerMap);
        bot.changeDirTimer = 0; // Sofort reagieren
    }
    
    // -------------------------------------------------------------
    // PRIORITÄT 2: HARD MODE LOGIK
    // -------------------------------------------------------------
    else if (isHardMode) {
        
        // A) CHECK: BOMBE LEGEN? (Jeden Frame prüfen!)
        // ---------------------------------------------
        if (bot.activeBombs < bot.maxBombs) {
            const score = evaluateBombPosition(bot, gx, gy, dangerMap);
            // Schwelle: 1 (sehr aggressiv). Sobald es IRGENDEINEN Grund gibt -> Bumm.
            if (score > 0) {
                if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    // Wähle passenden Bomben-Modus (Napalm/Rolling)
                    // Wir prüfen: Sind wir im offenen Feld? (Weniger als 2 Wände um uns)
                    let wallCount = 0;
                    DIRS.forEach(d => {
                        if (state.grid[gy+d.y] && state.grid[gy+d.y][gx+d.x] !== TYPES.EMPTY) wallCount++;
                    });
                    selectBestBombMode(bot, distToPlayer, wallCount < 2);

                    bot.plantBomb();
                    
                    // Nach dem Legen: FLUCHT!
                    nextMove = findSafeMove(gx, gy, getDangerMap());
                    bot.changeDirTimer = 0; 
                }
            }
        }

        // B) BEWEGUNG (Nur wenn wir nicht gerade fliehen)
        // -----------------------------------------------
        if (nextMove.x === 0 && nextMove.y === 0) {
            
            // 1. GREEDY ITEM (Sofort einsammeln, wenn benachbart)
            // Das überschreibt alles, außer Flucht.
            let bestItemMove = null;
            for(let d of DIRS) {
                const nx = gx + d.x; const ny = gy + d.y;
                if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H) {
                    const item = state.items[ny][nx];
                    if (item !== ITEMS.NONE && item !== ITEMS.SKULL && !dangerMap[ny][nx] && !isSolid(nx, ny)) {
                        bestItemMove = d; break; 
                    }
                }
            }

            if (bestItemMove) {
                nextMove = bestItemMove;
                bot.changeDirTimer = 0; // Sofort hin da!
            }
            // 2. ANGRIFF (Wenn kein Item direkt vor der Nase)
            else if (targetPlayer) {
                // Pfad zum Spieler suchen
                const path = getPath(gx, gy, Math.round(targetPlayer.x/TILE_SIZE), Math.round(targetPlayer.y/TILE_SIZE), dangerMap, 50);
                
                if (path) {
                    nextMove = path; // Jage den Spieler
                } else {
                    // Kein Weg zum Spieler? Suche Items weiter weg.
                    const itemPath = findNearestItem(gx, gy, dangerMap);
                    if (itemPath) {
                        nextMove = itemPath;
                    } else {
                        // Weder Spieler erreichbar noch Items -> Farmen (Random)
                        nextMove = findRandomSafeMove(gx, gy, dangerMap);
                    }
                }
            } else {
                 nextMove = findRandomSafeMove(gx, gy, dangerMap);
            }
        }
    }
    
    // -------------------------------------------------------------
    // PRIORITÄT 3: EASY/MEDIUM (Legacy)
    // -------------------------------------------------------------
    else {
        // Einfache Logik für schwache Bots
        // ... (Platzhalter für Original-Logik, verkürzt dargestellt)
        const nearTarget = DIRS.some(d => {
            const tx = gx+d.x; const ty = gy+d.y;
            return state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT;
        });
        if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                nextMove = findSafeMove(gx, gy, getDangerMap());
            }
        }
        if (nextMove.x === 0 && nextMove.y === 0) {
            // Einfaches Wandern
            if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE))) {
               nextMove = findRandomSafeMove(gx, gy, dangerMap);
               bot.changeDirTimer = 30;
            } else {
               nextMove = bot.botDir;
            }
        }
    }

    // -------------------------------------------------------------
    // AUSFÜHRUNG
    // -------------------------------------------------------------
    
    // Letzter Check: Führt nextMove auf einen Skull?
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        const nx = gx + nextMove.x; 
        const ny = gy + nextMove.y;
        if (state.items[ny] && state.items[ny][nx] === ITEMS.SKULL) {
            // Skull erkannt! Nicht betreten.
            // Bombe legen, um ihn zu zerstören?
            if (bot.activeBombs < bot.maxBombs && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                nextMove = findSafeMove(gx, gy, getDangerMap());
            } else {
                nextMove = {x:0, y:0}; // Stehen bleiben ist besser als Skull
            }
        }
    }

    if (nextMove.x !== 0 || nextMove.y !== 0) {
        bot.botDir = nextMove;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;
}

// ---------------- HELPER FUNCTIONS ----------------

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    // Feuer
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; 
    });
    // Bomben
    state.bombs.forEach(b => {
        const range = b.range + 1; // +1 Sicherheitsabstand für Bots
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
    return map;
}

function findSafeMove(gx, gy, dangerMap) {
    // BFS zum nächsten sicheren Feld
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    let ops = 0;
    while(queue.length > 0 && ops++ < 500) {
        const c = queue.shift();
        if (!dangerMap[c.y][c.x]) return c.firstMove || {x:0, y:0};
        
        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(nx+","+ny)) {
                if(!isSolid(nx, ny)) {
                    visited.add(nx+","+ny);
                    queue.push({x:nx, y:ny, firstMove: c.firstMove||d, dist: c.dist+1});
                }
            }
        }
    }
    return {x:0, y:0}; // Panic
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const safeNeighbors = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        if (isSolid(nx, ny)) return false;
        if (state.items[ny][nx] === ITEMS.SKULL) return false;
        return !dangerMap[ny][nx]; 
    });
    if (safeNeighbors.length > 0) {
        return safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
    }
    return {x:0, y:0};
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Prüfe: Gibt es NACH dem Legen (und damit Sperren von gx,gy) noch einen sicheren Nachbarn?
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}