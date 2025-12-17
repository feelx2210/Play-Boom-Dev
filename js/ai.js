import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // FIX: Richtiger Zugriff auf Difficulty im State
    const isHardMode = (state.difficulty === DIFFICULTIES.HARD);
    
    // Analyse
    const dangerMap = getDangerMap();
    const amInDanger = dangerMap[gy][gx];
    
    // FIX: Korrekte Suche nach Gegnern (!isBot und alive)
    // Wir suchen primär echte Spieler, sonst andere Bots
    const targetPlayer = state.players.find(p => !p.isBot && p.alive) || state.players.find(p => p !== bot && p.alive);
    
    // Cooldown
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;

    let nextMove = {x:0, y:0};

    // ------------------------------------------
    // 1. FLUCHT (Höchste Priorität)
    // ------------------------------------------
    if (amInDanger) {
        // Wenn wir eine Bombe haben und fliehen, legen wir manchmal eine "Abschiedsbombe"
        if (isHardMode && bot.activeBombs < bot.maxBombs && targetPlayer) {
            const dist = Math.abs(gx - Math.round(targetPlayer.x/TILE_SIZE)) + Math.abs(gy - Math.round(targetPlayer.y/TILE_SIZE));
            if (dist <= 3 && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                bot.plantBomb();
                // Nach dem Legen müssen wir die DangerMap für die Fluchtberechnung aktualisieren (simuliert)
                dangerMap[gy][gx] = true; 
            }
        }
        
        nextMove = findSafeMove(gx, gy, dangerMap);
        bot.changeDirTimer = 0; // Sofort bewegen!
    }

    // ------------------------------------------
    // 2. ANGRIFF & FARMING (Wenn sicher)
    // ------------------------------------------
    else {
        // Entscheidung nur treffen, wenn Timer abgelaufen oder wir stehen
        if (bot.changeDirTimer <= 0 || (bot.botDir.x === 0 && bot.botDir.y === 0)) {
            
            // A) Bombe legen?
            let plantBomb = false;
            
            if (bot.activeBombs < bot.maxBombs) {
                // HARD MODE: Aggressiv töten
                if (isHardMode && targetPlayer) {
                    const score = evaluateBombPosition(bot, gx, gy, targetPlayer);
                    if (score > 0 && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        plantBomb = true;
                    }
                }
                
                // FARMING: Kisten zerstören (alle Schwierigkeitsgrade)
                if (!plantBomb) {
                    const nearSoftWall = DIRS.some(d => {
                        const tx = gx + d.x; const ty = gy + d.y;
                        return state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT;
                    });
                    if (nearSoftWall && canEscapeAfterPlanting(gx, gy, dangerMap)) {
                        plantBomb = true;
                    }
                }
            }

            if (plantBomb) {
                bot.plantBomb();
                // Nach dem Legen sofort Fluchtweg berechnen
                dangerMap[gy][gx] = true;
                nextMove = findSafeMove(gx, gy, dangerMap);
                bot.changeDirTimer = 5;
            } 
            // B) Bewegen
            else {
                // 1. Items in der Nähe?
                const itemMove = findNearestItem(gx, gy, dangerMap, 6);
                if (itemMove) {
                    nextMove = itemMove;
                }
                // 2. Jagen (Hard Mode)
                else if (isHardMode && targetPlayer) {
                    const pgx = Math.round(targetPlayer.x / TILE_SIZE);
                    const pgy = Math.round(targetPlayer.y / TILE_SIZE);
                    const pathMove = getPathBFS(gx, gy, pgx, pgy, dangerMap, 30);
                    
                    if (pathMove) nextMove = pathMove;
                    else nextMove = findRandomSafeMove(gx, gy, dangerMap);
                }
                // 3. Zufall / Erkunden
                else {
                    nextMove = findRandomSafeMove(gx, gy, dangerMap);
                }
                
                bot.changeDirTimer = Math.floor(Math.random() * 10 + 5);
            }
        } else {
            // Behalte Richtung bei, solange Timer läuft und Weg frei ist
            const nx = gx + bot.botDir.x;
            const ny = gy + bot.botDir.y;
            if (!isSolid(nx, ny) && !dangerMap[ny][nx]) {
                nextMove = bot.botDir;
            } else {
                // Weg blockiert -> Neuberechnung erzwingen
                bot.changeDirTimer = 0;
                nextMove = findSafeMove(gx, gy, dangerMap);
            }
        }
    }

    // Ausführung
    if (nextMove.x !== 0 || nextMove.y !== 0) {
        bot.botDir = nextMove;
        
        // Blickrichtung für Grafik
        if (nextMove.x !== 0) bot.lastDir = {x: Math.sign(nextMove.x), y: 0};
        else if (nextMove.y !== 0) bot.lastDir = {x: 0, y: Math.sign(nextMove.y)};
        
        bot.move(nextMove.x * bot.speed, nextMove.y * bot.speed);
    }
}

// --- LOGIK ---

function evaluateBombPosition(bot, gx, gy, target) {
    const pgx = Math.round(target.x / TILE_SIZE);
    const pgy = Math.round(target.y / TILE_SIZE);
    const dist = Math.abs(gx - pgx) + Math.abs(gy - pgy);

    // Wenn Gegner in Bombenreichweite und auf gleicher Achse
    if (dist <= bot.bombRange) {
        if (gx === pgx || gy === pgy) return 100; // Treffer möglich
    }
    return 0;
}

function canEscapeAfterPlanting(gx, gy, dangerMap) {
    // Simuliere: Wenn (gx,gy) blockiert ist (Bombe), gibt es einen sicheren Nachbarn?
    return DIRS.some(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        return isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx];
    });
}

function getPathBFS(sx, sy, tx, ty, dangerMap, limit) {
    const queue = [{x:sx, y:sy, path:null}];
    const visited = new Set([sx+','+sy]);
    let ops = 0;

    while(queue.length > 0) {
        if (ops++ > limit) break;
        const c = queue.shift();
        if (c.x === tx && c.y === ty) return c.path;

        for (let d of DIRS) {
            const nx = c.x + d.x; const ny = c.y + d.y;
            // Ziel ist begehbar (Spieler), sonst nur nicht-solide Felder
            const isTarget = (nx === tx && ny === ty);
            if (isValid(nx, ny) && !visited.has(nx+','+ny)) {
                if ((!isSolid(nx, ny) || isTarget) && !dangerMap[ny][nx]) {
                    visited.add(nx+','+ny);
                    queue.push({x:nx, y:ny, path: c.path || d});
                }
            }
        }
    }
    return null;
}

function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    
    // Wenn wir schon sicher sind, null zurückgeben (keine Flucht nötig)
    if (!dangerMap[gy][gx]) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0 && ops++ < 200) {
        const c = queue.shift();
        if (!dangerMap[c.y][c.x]) return c.move || {x:0, y:0};

        for(let d of DIRS) {
            const nx = c.x + d.x; const ny = c.y + d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return {x:0, y:0};
}

function findNearestItem(gx, gy, dangerMap, maxDist) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;
    while(queue.length > 0 && ops++ < 200) {
        const c = queue.shift();
        if (c.dist > maxDist) continue;
        
        const item = state.items[c.y][c.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) return c.move;

        for(let d of DIRS) {
            const nx = c.x + d.x; const ny = c.y + d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const safe = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        return isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL;
    });
    if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];
    return {x:0, y:0};
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    
    // Feuer
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = true; 
    });
    
    // Bomben (Vorausschau)
    state.bombs.forEach(b => {
        const r = b.range + 1; // Sicherheitsabstand
        map[b.gy][b.gx] = true;
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    return map;
}

function isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }