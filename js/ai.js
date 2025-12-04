import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    let targetDir = {x:0, y:0};

    if (amInDanger) {
        targetDir = findSafeMove(gx, gy, dangerMap);
    } else {
        const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        const nearTarget = neighbors.some(d => {
            const tx = gx + d.x; const ty = gy + d.y;
            if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
            // Bot will Wände sprengen
            return state.grid[ty][tx] === TYPES.WALL_SOFT; 
        });

        // Soll ich eine Bombe legen?
        if (nearTarget && Math.random() < 0.05 && bot.activeBombs < bot.maxBombs) {
            // Nur legen, wenn ich danach flüchten kann!
            if (canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                // Sofort neuen Fluchtweg berechnen (Simulation: Bombe ist jetzt da)
                // Wir simulieren die Gefahr der neuen Bombe für den nächsten Frame
                targetDir = findSafeMove(gx, gy, getDangerMap()); 
            }
        }

        // Wenn keine Gefahr und keine Bombe gelegt, bewege dich zufällig oder zum Ziel
        if (targetDir.x === 0 && targetDir.y === 0) {
            // Richtungswechsel nur alle paar Frames oder wenn blockiert
            if (bot.changeDirTimer <= 0 || isSolid(Math.round((bot.x + bot.botDir.x*20)/TILE_SIZE), Math.round((bot.y + bot.botDir.y*20)/TILE_SIZE))) {
                const safeNeighbors = neighbors.filter(d => {
                    const nx = gx + d.x; const ny = gy + d.y;
                    if (isSolid(nx, ny)) return false;
                    return !dangerMap[ny][nx];
                });
                
                if (safeNeighbors.length > 0) {
                    // Priorität: Items einsammeln
                    const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                    targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                } else {
                    targetDir = {x:0, y:0};
                }
                bot.changeDirTimer = 15 + Math.random() * 30;
            } else {
                targetDir = bot.botDir || {x:0, y:0};
            }
        }
    }

    if (targetDir.x !== 0 || targetDir.y !== 0) {
        bot.botDir = targetDir;
        // LastDir für Sprite-Ausrichtung aktualisieren
        if (bot.botDir.x !== 0) bot.lastDir = { x: Math.sign(bot.botDir.x), y: 0 };
        else if (bot.botDir.y !== 0) bot.lastDir = { x: 0, y: Math.sign(bot.botDir.y) };
    }
    
    bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    bot.changeDirTimer--;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // 1. Aktives Feuer ist gefährlich
    state.particles.forEach(p => { 
        if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) {
            map[p.gy][p.gx] = true; 
        }
    });

    // 2. Bomben-Explosionsradien berechnen
    state.bombs.forEach(b => {
        // Prüfen auf Boost Pads (Hell/Ice) oder Ölfelder (Hell)
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = (b.underlyingTile === TYPES.OIL);
        
        // Wenn Boost oder Öl -> Max Range (15)
        const range = (isBoost || isOil) ? 15 : b.range;
        
        map[b.gy][b.gx] = true; // Die Bombe selbst ist Danger Zone (gleich explodiert sie)
        
        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        dirs.forEach(d => {
            for (let i = 1; i <= range; i++) {
                const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                
                map[ty][tx] = true; // Dieses Feld wird brennen
                
                // Soft Wall stoppt die Explosion, ist aber selbst noch betroffen
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
            }
        });
    });

    // 3. Höllenfeuer-Zentrum (wenn aktiv)
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        const range = 5; 
        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        
        // Zentrum markieren
        map[HELL_CENTER.y][HELL_CENTER.x] = true;

        dirs.forEach(d => {
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
    // Breitensuche (BFS) um das nächste sichere Feld zu finden
    const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
    const visited = new Set();
    visited.add(gx + "," + gy);
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    
    let ops = 0;
    while (queue.length > 0) {
        ops++;
        if (ops > 500) break; // Notausstieg Performance
        
        const current = queue.shift();
        
        // Wenn dieses Feld sicher ist, nimm den Move, der uns hierher geführt hat
        if (!dangerMap[current.y][current.x]) {
            return current.firstMove || {x:0, y:0}; 
        }
        
        if (current.dist > 12) continue; // Nicht zu weit suchen

        for (let d of dirs) {
            const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                const isBlocked = isSolid(nx, ny);
                // Wir können durch Gefahr laufen, um zu Sicherheit zu kommen, aber nicht durch Wände
                if (!isBlocked) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                }
            }
        }
    }
    // Wenn kein Ausweg: Panik (Zufall)
    return dirs[Math.floor(Math.random()*dirs.length)];
}

function canEscapeAfterPlanting(gx, gy, currentDangerMap) {
    // Simuliere: Wenn ich hier eine Bombe lege, ist das Feld gefährlich. Komme ich weg?
    // Einfacher Check: Gibt es ein freies Nachbarfeld, das nicht gefährlich ist?
    // (Verbesserung: Man könnte hier auch rekursiv prüfen, aber für einfache Bots reicht das)
    const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    const openNeighbors = neighbors.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
    });
    return openNeighbors.length > 0;
}
