import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

// Konstanten für Richtungen, um Array-Erzeugung zu sparen
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. Gefahr erkennen
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        // FLUCHT-MODUS
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        // ANGRIFFS-MODUS
        const nearTarget = DIRS.some(d => {
            const tx = gx + d.x; const ty = gy + d.y;
            if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
            return state.grid[ty][tx] === TYPES.WALL_SOFT; // Bot will Wände sprengen
        });

        // Soll ich eine Bombe legen?
        if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
            // Nur legen, wenn ein Fluchtweg existiert!
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                // Sofort neuen Fluchtweg berechnen (Simulation: Bombe ist jetzt da)
                targetDir = findSafeMove(gx, gy, getDangerMap()); 
            }
        }

        // Bewegung (Zufall oder Item-Suche)
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
                    // Priorität: Items einsammeln
                    const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
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

    // Bewegung ausführen
    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

// Erstellt eine Karte aller gefährlichen Kacheln (Feuer oder gleich explodierende Bomben)
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // 1. Aktives Feuer
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) {
            map[p.gy][p.gx] = true; 
        }
    });

    // 2. Bomben-Explosionsradien
    state.bombs.forEach(b => {
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        const range = (isBoost || isOil) ? 15 : b.range;
        
        map[b.gy][b.gx] = true; // Bombe selbst ist Gefahr
        
        DIRS.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                
                map[ty][tx] = true; 
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Feuer stoppt hier
            }
        });
    });

    // 3. Höllenfeuer
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

// Breitensuche zum nächsten sicheren Feld
function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    
    let ops = 0;
    while (queue.length > 0) {
        if (++ops > 500) break; // Performance Notbremse
        
        const current = queue.shift();
        
        // Ziel erreicht: Sicheres Feld
        if (!dangerMap[current.y][current.x]) {
            return current.firstMove || {x:0, y:0}; 
        }
        
        if (current.dist > 12) continue; // Suche abbrechen wenn zu weit

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
    // Panik: Zufällige Richtung wenn kein Ausweg
    return DIRS[Math.floor(Math.random()*DIRS.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Gibt es mindestens ein freies, sicheres Nachbarfeld?
    const neighbors = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return neighbors.length > 0;
}