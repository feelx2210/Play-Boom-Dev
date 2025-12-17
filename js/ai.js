import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, HELL_CENTER, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';

// Richtungskonstanten
const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Lokale Helper (um Import-Probleme zu vermeiden)
function isSolidTile(gx, gy) {
    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
    const t = state.grid[gy][gx];
    // Bomben sind für die KI auch Hindernisse (außer sie steht drauf, das prüft die Logik anders)
    return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT || t === TYPES.BOMB;
}

function isValid(x, y) { return x>=0 && x<GRID_W && y>=0 && y<GRID_H; }

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. Analyse der Umgebung
    const dangerMap = getDangerMap(); // Wo explodiert es gleich?
    const amInDanger = dangerMap[gy][gx];
    const isHardMode = (state.difficulty === 2); // 2 = HARD
    
    // Ziel: Ein lebender menschlicher Spieler oder irgendein anderer Bot
    const targetPlayer = state.players.find(p => !p.isBot && p.alive) || state.players.find(p => p !== bot && p.alive);
    
    // Cooldown für Richtungswechsel
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;

    // ------------------------------------------
    // PRIO 1: ÜBERLEBEN (FLUCHT)
    // ------------------------------------------
    if (amInDanger) {
        // Suche sofort den nächsten sicheren Fleck
        const safeMove = findSafeMove(gx, gy, dangerMap);
        executeMove(bot, safeMove);
        bot.changeDirTimer = 5; // Schnell reagieren
        return;
    }

    // ------------------------------------------
    // PRIO 2: KILLEN (Nur Hard Mode)
    // ------------------------------------------
    if (isHardMode && bot.activeBombs < bot.maxBombs) {
        if (shouldPlantBomb(bot, gx, gy, targetPlayer, dangerMap)) {
            // Simulieren: Wenn ich hier lege, kann ich dann noch fliehen?
            dangerMap[gy][gx] = true; // Simuliere Gefahr hier
            if (findSafeMove(gx, gy, dangerMap).x !== 0 || findSafeMove(gx, gy, dangerMap).y !== 0) {
                bot.plantBomb();
                const escapeMove = findSafeMove(gx, gy, dangerMap);
                executeMove(bot, escapeMove);
                return;
            } else {
                dangerMap[gy][gx] = false; // Fehlalarm, doch nicht legen
            }
        }
    }

    // ------------------------------------------
    // PRIO 3: JAGEN & FARMEN
    // ------------------------------------------
    // Nur entscheiden, wenn wir nicht gerade mitten in einer Bewegung sind (Timer)
    if (bot.changeDirTimer <= 0) {
        let bestMove = {x:0, y:0};

        // A) Items einsammeln (Greedy, Radius 8)
        const nearItem = findNearestItem(gx, gy, dangerMap, 8);
        
        if (nearItem) {
            bestMove = nearItem;
        }
        // B) Spieler jagen
        else if (targetPlayer) {
            const pgx = Math.round(targetPlayer.x / TILE_SIZE);
            const pgy = Math.round(targetPlayer.y / TILE_SIZE);
            // Pfad zum Spieler suchen (Limit 100 Schritte)
            const path = getPathBFS(gx, gy, pgx, pgy, dangerMap, 100);
            
            if (path) {
                bestMove = path;
            } else {
                // Kein Weg zum Spieler? Dann Kisten suchen
                bestMove = findNearestSoftWall(gx, gy, dangerMap) || findRandomSafeMove(gx, gy, dangerMap);
            }
        } 
        else {
            // C) Fallback: Irgendwas sprengen oder rumlaufen
            bestMove = findNearestSoftWall(gx, gy, dangerMap) || findRandomSafeMove(gx, gy, dangerMap);
        }

        bot.moveDir = bestMove;
        // Zufällige Dauer für diesen Move, damit es natürlicher wirkt
        bot.changeDirTimer = (bestMove.x===0 && bestMove.y===0) ? 5 : Math.floor(Math.random() * 10 + 5);
    }

    executeMove(bot, bot.moveDir || {x:0, y:0});
}

// --- LOGIK & TAKTIK ---

function shouldPlantBomb(bot, gx, gy, target, dangerMap) {
    if (!target) return false;
    
    const pgx = Math.round(target.x / TILE_SIZE);
    const pgy = Math.round(target.y / TILE_SIZE);
    const dist = Math.abs(gx - pgx) + Math.abs(gy - pgy);

    // Töten: Wenn nah dran oder in einer Linie
    if (dist <= bot.bombRange) {
        const onLine = (gx === pgx || gy === pgy);
        if (onLine) {
            // Wenn sehr nah oder Gegner in der Falle sitzt
            if (dist <= 2 || isPlayerTrapped(target, pgx, pgy)) return true;
        }
    }

    // Farmen: Wenn Kiste direkt daneben und sicher
    let softWallNear = false;
    DIRS.forEach(d => {
        const tx = gx + d.x; const ty = gy + d.y;
        if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) softWallNear = true;
    });
    
    // Nur farmen, wenn Gegner nicht ZU nah ist (Selbstmordgefahr)
    if (softWallNear && dist > 2) return true;

    return false;
}

function isPlayerTrapped(player, gx, gy) {
    let freeExits = 0;
    DIRS.forEach(d => {
        const nx = gx + d.x;
        const ny = gy + d.y;
        if (!isSolidTile(nx, ny)) freeExits++;
    });
    return freeExits <= 1; // 0 oder 1 Ausweg = Falle
}

// --- PFADFINDUNG & BEWEGUNG ---

function executeMove(bot, dir) {
    if (!dir) return;
    bot.move(dir.x * bot.speed, dir.y * bot.speed);
    
    // Blickrichtung speichern (für Grafik)
    if (dir.x !== 0) bot.lastDir = {x: Math.sign(dir.x), y: 0};
    if (dir.y !== 0) bot.lastDir = {x: 0, y: Math.sign(dir.y)};
}

function getPathBFS(sx, sy, tx, ty, dangerMap, limit) {
    const queue = [{x:sx, y:sy, path:null}];
    const visited = new Set([sx+','+sy]);
    let ops = 0;

    while(queue.length > 0) {
        if (ops++ > limit) break;
        const curr = queue.shift();

        if (curr.x === tx && curr.y === ty) return curr.path;

        for (let d of DIRS) {
            const nx = curr.x + d.x;
            const ny = curr.y + d.y;
            const key = nx+','+ny;

            if (isValid(nx, ny) && !visited.has(key)) {
                // Man kann auf das Zielfeld laufen (auch wenn da ein Spieler steht)
                const isTarget = (nx === tx && ny === ty);
                if ((!isSolidTile(nx, ny) || isTarget) && !dangerMap[ny][nx]) {
                    visited.add(key);
                    queue.push({x:nx, y:ny, path: curr.path || d});
                }
            }
        }
    }
    return null;
}

function findSafeMove(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, firstMove: null}];
    const visited = new Set([gx+','+gy]);
    
    // Wenn wir hier sicher sind -> Bleiben (oder null zurückgeben)
    if (!dangerMap[gy][gx]) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0) {
        if(ops++ > 200) break;
        const curr = queue.shift();

        if (!dangerMap[curr.y][curr.x]) return curr.firstMove;

        for (let d of DIRS) {
            const nx = curr.x + d.x; 
            const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolidTile(nx, ny) && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, firstMove: curr.firstMove || d});
            }
        }
    }
    return {x:0, y:0};
}

function findNearestItem(gx, gy, dangerMap, maxDist) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;
    
    while(queue.length > 0) {
        if(ops++ > 500) break;
        const curr = queue.shift();
        if (curr.dist > maxDist) continue;

        // Item gefunden? (Aber kein Skull!)
        if (state.items[curr.y] && state.items[curr.y][curr.x] !== ITEMS.NONE && state.items[curr.y][curr.x] !== ITEMS.SKULL) {
            return curr.move;
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolidTile(nx, ny) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
                if (state.items[ny][nx] === ITEMS.SKULL) continue; // Meide Skulls
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: curr.move || d, dist: curr.dist+1});
            }
        }
    }
    return null;
}

function findNearestSoftWall(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 300) {
        const curr = queue.shift();
        
        // Softwall benachbart?
        for (let d of DIRS) {
            const tx = curr.x + d.x; const ty = curr.y + d.y;
            if (isValid(tx, ty) && state.grid[ty][tx] === TYPES.WALL_SOFT) {
                return curr.move || {x:0, y:0};
            }
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolidTile(nx, ny) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: curr.move || d});
            }
        }
    }
    return null;
}

function findRandomSafeMove(gx, gy, dangerMap) {
    const valid = DIRS.filter(d => {
        const nx = gx + d.x; const ny = gy + d.y;
        return isValid(nx, ny) && !isSolidTile(nx, ny) && !dangerMap[ny][nx] && (state.items[ny] ? state.items[ny][nx] !== ITEMS.SKULL : true);
    });
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    return {x:0, y:0};
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    // Feuer
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = true; 
    });
    // Bomben
    state.bombs.forEach(b => {
        const r = b.range;
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