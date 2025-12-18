import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [
    {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}
];

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Status
    const isHardMode = (state.difficulty === DIFFICULTIES.HARD);
    const dangerMap = getDangerMap(); 
    const amInDanger = dangerMap[gy][gx] > 0;
    
    // Ziel finden
    let target = state.players.find(p => !p.isBot && p.alive);
    if (!target) target = state.players.find(p => p !== bot && p.alive);

    // Cooldown
    if (bot.changeDirTimer > 0) {
        bot.changeDirTimer--;
        executeMove(bot); 
        return;
    }

    let nextMove = {x:0, y:0};
    
    // ------------------------------------------
    // 1. FLUCHT (Prio A++)
    // ------------------------------------------
    if (amInDanger) {
        nextMove = findSafestPath(gx, gy, dangerMap);
        bot.changeDirTimer = 0; 
    }
    
    // ------------------------------------------
    // 2. TAKTIK (Wenn sicher)
    // ------------------------------------------
    else {
        let wantToBomb = false;

        // A) Bombe legen?
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = evaluateBombSpot(bot, gx, gy, target);
            const threshold = isHardMode ? 5 : 10;

            if (bombScore > threshold) {
                // SUIZID-CHECK
                if (isSafeToPlant(bot, gx, gy, dangerMap)) {
                    wantToBomb = true;
                }
            }
        }

        if (wantToBomb) {
            // --- BOMBEN-WAHL LOGIK ---
            // Standardmäßig normale Bombe (sicherer zum Farmen)
            bot.currentBombMode = BOMB_MODES.STANDARD;

            if (bot.hasNapalm) {
                // Check: Farmen wir gerade? (Ist eine Kiste direkt nebenan?)
                let isFarming = false;
                for (let d of DIRS) {
                    const tx = gx + d.x; const ty = gy + d.y;
                    if (isValid(tx, ty) && state.grid[ty][tx] === TYPES.WALL_SOFT) {
                        isFarming = true;
                        break;
                    }
                }

                // Check: Ist Gegner in Reichweite?
                let targetNear = false;
                if (target) {
                    const dist = Math.abs(gx - Math.round(target.x/TILE_SIZE)) + Math.abs(gy - Math.round(target.y/TILE_SIZE));
                    if (dist < 6) targetNear = true;
                }

                // Entscheidung: Napalm NUR nutzen, wenn wir NICHT farmen UND ein Gegner nah ist
                // Das verhindert Napalm in der eigenen Ecke.
                if (!isFarming && targetNear) {
                    bot.currentBombMode = BOMB_MODES.NAPALM;
                }
            }
            
            bot.plantBomb();
            
            // Flucht berechnen
            const newDangerMap = getDangerMap(); 
            nextMove = findSafestPath(gx, gy, newDangerMap);
            bot.changeDirTimer = 5; 
        } 
        else {
            // B) Bewegen
            const itemMove = findPathToBestItem(gx, gy, dangerMap);
            
            let attackMove = null;
            if (target && isHardMode) {
                const path = findPathToTarget(gx, gy, Math.round(target.x/TILE_SIZE), Math.round(target.y/TILE_SIZE), dangerMap);
                if (path) attackMove = path;
                else attackMove = findBestFarmingSpot(gx, gy, dangerMap, bot);
            }

            if (itemMove) {
                nextMove = itemMove;
                bot.changeDirTimer = 2;
            } else if (attackMove) {
                nextMove = attackMove;
                bot.changeDirTimer = 8;
            } else {
                nextMove = findBestFarmingSpot(gx, gy, dangerMap, bot) || findRandomSafeMove(gx, gy, dangerMap);
                bot.changeDirTimer = 10;
            }
        }
    }

    // Ausführung
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        bot.botDir = nextMove;
        
        if (nextMove.x !== 0) bot.lastDir = {x: Math.sign(nextMove.x), y: 0};
        else if (nextMove.y !== 0) bot.lastDir = {x: 0, y: Math.sign(nextMove.y)};
        
        executeMove(bot);
    } else {
        bot.botDir = {x:0, y:0};
    }
}

// -----------------------------------------------------------------
// LOGIK
// -----------------------------------------------------------------

function executeMove(bot) {
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) {
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
        
        // Anti-Stuck
        const centerX = (Math.round(bot.x / TILE_SIZE) * TILE_SIZE);
        const centerY = (Math.round(bot.y / TILE_SIZE) * TILE_SIZE);
        const drift = bot.speed * 0.5;
        
        if (bot.botDir.x !== 0) {
            if (Math.abs(bot.y - centerY) > 2) {
                if (bot.y < centerY) bot.y += drift; else bot.y -= drift;
            }
        } else if (bot.botDir.y !== 0) {
            if (Math.abs(bot.x - centerX) > 2) {
                if (bot.x < centerX) bot.x += drift; else bot.x -= drift;
            }
        }
    }
}

function isSafeToPlant(bot, gx, gy, currentDangerMap) {
    const futureMap = currentDangerMap.map(row => [...row]);
    const r = bot.bombRange;
    futureMap[gy][gx] = 180; 
    
    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
            futureMap[ty][tx] = 180; 
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
        }
    });

    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([gx+','+gy]);
    const MAX_DIST = 12;

    while(queue.length > 0) {
        const c = queue.shift();
        if (futureMap[c.y][c.x] === 0) return true; 
        if (c.dist >= MAX_DIST) continue; 

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !visited.has(nx+','+ny)) {
                const isStart = (nx === gx && ny === gy);
                if ((!isSolid(nx, ny) || isStart) && currentDangerMap[ny][nx] === 0) {
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, dist: c.dist+1});
                }
            }
        }
    }
    return false; 
}

function evaluateBombSpot(bot, gx, gy, target) {
    let score = 0;
    const r = bot.bombRange;

    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x * i; const ty = gy + d.y * i;
            if (!isValid(tx, ty)) break;
            const tile = state.grid[ty][tx];

            if (tile === TYPES.WALL_HARD) break;
            if (tile === TYPES.WALL_SOFT) { score += 15; break; }
            if (state.items[ty][tx] === ITEMS.SKULL) { score += 50; break; } 
            if (state.items[ty][tx] !== ITEMS.NONE) { score -= 200; break; } 

            state.players.forEach(p => {
                if (p.alive && Math.round(p.x/TILE_SIZE)===tx && Math.round(p.y/TILE_SIZE)===ty) {
                    if (p === bot) return;
                    if (p.isBot) score -= 100; 
                    else score += 300; 
                }
            });
        }
    });
    
    if (target) {
        const dist = Math.abs(gx - Math.round(target.x/TILE_SIZE)) + Math.abs(gy - Math.round(target.y/TILE_SIZE));
        if (dist <= 4) score += 10;
    }

    return score;
}

// -----------------------------------------------------------------
// PFADFINDUNG
// -----------------------------------------------------------------

function findSafestPath(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    if (dangerMap[gy][gx] === 0) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        if (dangerMap[c.y][c.x] === 0) return c.move || {x:0, y:0};

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return {x:0, y:0};
}

function findPathToTarget(sx, sy, tx, ty, dangerMap) {
    const queue = [{x:sx, y:sy, move:null}];
    const visited = new Set([sx+','+sy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 400) {
        const c = queue.shift();
        if (c.x === tx && c.y === ty) return c.move;

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            const isTarget = (nx === tx && ny === ty);
            if (isValid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                if ((!isSolid(nx, ny) || isTarget) && state.items[ny][nx] !== ITEMS.SKULL) {
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, move: c.move || d});
                }
            }
        }
    }
    return null;
}

function findPathToBestItem(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        if (c.dist > 15) continue;

        const item = state.items[c.y][c.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL && dangerMap[c.y][c.x] === 0) return c.move;

        for (let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny) && dangerMap[ny][nx] === 0) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

function findBestFarmingSpot(gx, gy, dangerMap, bot) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 200) {
        const c = queue.shift();
        if (c.dist > 10) continue;

        if (dangerMap[c.y][c.x] === 0) {
            let hits = 0;
            DIRS.forEach(d => {
                const tx = c.x + d.x; const ty = c.y + d.y;
                if (isValid(tx, ty) && state.grid[ty][tx] === TYPES.WALL_SOFT) hits++;
            });
            if (hits > 0) return c.move || {x:0, y:0};
        }

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && dangerMap[ny][nx] === 0 && !visited.has(nx+','+ny)) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        return isValid(nx, ny) && !isSolid(nx, ny) && dangerMap[ny][nx] === 0 && state.items[ny][nx] !== ITEMS.SKULL;
    });
    if (valid.length > 0) return valid[Math.floor(Math.random()*valid.length)];
    return {x:0, y:0};
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = 1; 
    });
    state.bombs.forEach(b => {
        const t = b.timer > 0 ? b.timer : 1;
        if (map[b.gy][b.gx] === 0 || map[b.gy][b.gx] > t) map[b.gy][b.gx] = t;
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                if (map[ty][tx] === 0 || map[ty][tx] > t) map[ty][tx] = t;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    return map;
}

function isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }