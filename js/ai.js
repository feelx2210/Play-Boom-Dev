// js/ai.js
import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. Gefahr erkennen (Prio 1)
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    // --- ENTSCHEIDUNGSBAUM ---

    if (amInDanger) {
        // FLUCHT-MODUS: Sofort sicherste Kachel suchen
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        // ANGRIFFS- & FARM-MODUS (Nur wenn sicher)
        
        // Zwinge Richtungswechsel seltener, damit er nicht "zittert", 
        // es sei denn, wir sind im Hard Mode (schnellere Reaktion)
        const reactionSpeed = state.difficulty === DIFFICULTIES.HARD ? 5 : 20;
        
        // Sollte der Bot eine neue Entscheidung treffen?
        if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE))) {
            
            let bestMove = null;

            // STRATEGIE A: Spieler jagen (Nur HARD/MEDIUM)
            if (state.difficulty >= DIFFICULTIES.MEDIUM) {
                const targetPlayer = findNearestPlayer(bot);
                if (targetPlayer) {
                    // Prüfen: Soll ich ihn sprengen?
                    const dist = Math.hypot(targetPlayer.x - bot.x, targetPlayer.y - bot.y) / TILE_SIZE;
                    
                    // HARD MODE: Sehr aggressives Bombenlegen
                    if (state.difficulty === DIFFICULTIES.HARD && bot.activeBombs < bot.maxBombs) {
                        // Wenn nah dran ODER wenn er durch SoftWall blockiert ist und wir ihn erreichen wollen
                        if (dist < 4 && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                            // Zufallselement rausnehmen -> Tödlicher
                            if (Math.random() < 0.8) bot.plantBomb();
                        }
                    }

                    // Pfad zum Spieler berechnen
                    // Im Hardmode versuchen wir, den Spieler direkt anzusteuern
                    bestMove = findNextStepToTarget(gx, gy, Math.round(targetPlayer.x/TILE_SIZE), Math.round(targetPlayer.y/TILE_SIZE), dangerMap);
                }
            }

            // STRATEGIE B: Items farmen / Wände sprengen (Fallback)
            if (!bestMove || (bestMove.x === 0 && bestMove.y === 0)) {
                // Suche nächstbestes Item oder SoftWall
                bestMove = findFarmMove(gx, gy, dangerMap);
                
                // Wenn wir vor einer Wand stehen und nichts tun -> Sprengen
                const nextX = gx + (bestMove ? bestMove.x : 0);
                const nextY = gy + (bestMove ? bestMove.y : 0);
                if (nextX >= 0 && nextY >= 0 && nextX < GRID_W && nextY < GRID_H) {
                    if (state.grid[nextY][nextX] === TYPES.WALL_SOFT && bot.activeBombs < bot.maxBombs) {
                        if (canEscapeAfterPlanting(gx, gy, dangerMap)) bot.plantBomb();
                    }
                }
            }

            targetDir = bestMove || {x:0, y:0};
            
            // Timer resetten
            bot.changeDirTimer = reactionSpeed + Math.random() * 10;
        } else {
            // Behalte Richtung bei
            targetDir = bot.botDir || {x:0, y:0};
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

// --- HELPER FUNCTIONS ---

function findNearestPlayer(bot) {
    let nearest = null;
    let minDist = Infinity;
    
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x - bot.x)**2 + (p.y - bot.y)**2;
        if (d < minDist) {
            minDist = d;
            nearest = p;
        }
    });
    return nearest;
}

// Sucht den nächsten Schritt zum Ziel (Breadth-First Search)
// Weicht Gefahren aus, aber ignoriert SoftWalls (da wir sie sprengen können)
function findNextStepToTarget(sx, sy, tx, ty, dangerMap) {
    const queue = [{x: sx, y: sy, firstMove: null}];
    const visited = new Set();
    visited.add(`${sx},${sy}`);
    
    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 200) break; // Performance Limit
        const curr = queue.shift();
        
        if (curr.x === tx && curr.y === ty) return curr.firstMove;
        
        for (let d of DIRS) {
            const nx = curr.x + d.x;
            const ny = curr.y + d.y;
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                if (visited.has(`${nx},${ny}`)) continue;
                
                // Hard Mode Bot ist mutig: Er plant Pfade auch durch SoftWalls (um sie zu sprengen)
                const isSoftWall = state.grid[ny][nx] === TYPES.WALL_SOFT;
                const isHardWall = state.grid[ny][nx] === TYPES.WALL_HARD || state.grid[ny][nx] === TYPES.BOMB;
                const isDangerous = dangerMap[ny][nx];

                if (!isHardWall && !isDangerous) {
                    visited.add(`${nx},${ny}`);
                    // Wenn es eine Softwall ist, ist das ein valides Ziel (um davor stehen zu bleiben und zu bomben)
                    // Wir fügen es zur Queue hinzu, aber wir gehen davon aus, dass wir dorthin "wollen"
                    queue.push({
                        x: nx, y: ny, 
                        firstMove: curr.firstMove || d
                    });
                }
            }
        }
    }
    return null; // Kein Weg gefunden
}

function findFarmMove(gx, gy, dangerMap) {
    // Einfache Logik: Suche zufälliges freies Feld oder Item
    const safeNeighbors = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) return false;
        if (isSolid(nx, ny) && state.grid[ny][nx] !== TYPES.WALL_SOFT) return false; // Hard walls/bombs block
        return !dangerMap[ny][nx];
    });

    if (safeNeighbors.length > 0) {
        // Priorität: Items
        const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
        if (itemMove) return itemMove;
        
        // Priorität: Soft Walls (zum Sprengen)
        const wallMove = safeNeighbors.find(d => state.grid[gy+d.y][gx+d.x] === TYPES.WALL_SOFT);
        if (wallMove) return wallMove;

        return safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
    }
    return null;
}

// Erstellt eine Karte aller gefährlichen Kacheln
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

// Breitensuche zum nächsten sicheren Feld (Flucht)
function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(`${gx},${gy}`);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break;
        const current = queue.shift();
        
        if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
        if (current.dist > 12) continue;

        for (let d of DIRS) {
            const nx = current.x + d.x; 
            const ny = current.y + d.y; 
            
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(`${nx},${ny}`)) {
                // Bei Flucht: Keine SoftWalls, da wir nicht warten können bis Bombe explodiert
                if (!isSolid(nx, ny)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Simuliere: Wenn ich hier eine Bombe lege, ist das Feld (und Kreuz) gefährlich.
    // Kann ich dann noch einen Schritt auf ein sicheres Feld machen?
    // Vereinfacht: Ist mindestens 1 Nachbarfeld aktuell sicher und KEINE Sackgasse?
    const safeNeighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return false;
        // Das Nachbarfeld muss begehbar sein UND aktuell sicher
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return safeNeighbors.length > 0;
}