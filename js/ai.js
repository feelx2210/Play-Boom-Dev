import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, HELL_CENTER, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// --- HAUPTFUNKTION ---
export function updateBotLogic(bot) {
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // 1. Analyse
    const dangerMap = getDangerMap(); // Wo knallt es gleich?
    const amInDanger = dangerMap[gy][gx];
    const isHardMode = (state.difficulty === 2); // 2 = HARD
    
    // Ziel finden (Spieler oder Item)
    const targetPlayer = state.players.find(p => !p.isBot && p.alive) || state.players.find(p => p !== bot && p.alive);
    
    // Cooldown runterzählen
    if (bot.changeDirTimer > 0) bot.changeDirTimer--;

    // ------------------------------------------
    // PRIO 1: ÜBERLEBEN (FLUCHT)
    // ------------------------------------------
    if (amInDanger) {
        const safeMove = findSafeMove(gx, gy, dangerMap);
        bot.moveDir = safeMove;
        executeMove(bot, safeMove);
        return;
    }

    // ------------------------------------------
    // PRIO 2: KILLEN (Nur Hard/Medium)
    // ------------------------------------------
    if (isHardMode && bot.activeBombs < bot.maxBombs) {
        // Prüfen: Lohnt sich eine Bombe hier?
        if (shouldPlantBomb(bot, gx, gy, targetPlayer, dangerMap)) {
            // Simulieren: Kann ich fliehen, wenn ich hier lege?
            // Wir tun so, als ob hier jetzt Gefahr wäre
            dangerMap[gy][gx] = true; 
            if (findSafeMove(gx, gy, dangerMap) !== null) {
                bot.plantBomb();
                // Sofort Flucht einleiten
                const escapeMove = findSafeMove(gx, gy, dangerMap);
                executeMove(bot, escapeMove);
                return;
            } else {
                dangerMap[gy][gx] = false; // Doch nicht legen, Selbstmord
            }
        }
    }

    // ------------------------------------------
    // PRIO 3: JAGEN & FARMEN
    // ------------------------------------------
    
    // Entscheidung nur alle paar Frames oder wenn wir stehen
    if (bot.changeDirTimer <= 0) {
        let bestMove = {x:0, y:0};

        // A) Items in direkter Nähe? (Greedy)
        const nearItem = findNearestItem(gx, gy, dangerMap, 5);
        
        // B) Spieler jagen (Aggro)
        if (targetPlayer && !nearItem) {
            const pgx = Math.round(targetPlayer.x / TILE_SIZE);
            const pgy = Math.round(targetPlayer.y / TILE_SIZE);
            // Pfad zum Spieler
            const path = getPathBFS(gx, gy, pgx, pgy, dangerMap, 20);
            if (path) bestMove = path;
            else bestMove = findNearestSoftWall(gx, gy, dangerMap) || findRandomSafeMove(gx, gy, dangerMap);
        } 
        else if (nearItem) {
            bestMove = nearItem;
        }
        else {
            // C) Farmen (Kisten suchen)
            bestMove = findNearestSoftWall(gx, gy, dangerMap) || findRandomSafeMove(gx, gy, dangerMap);
        }

        bot.moveDir = bestMove;
        bot.changeDirTimer = 10; // Kurzer Cooldown für Entscheidung
    }

    executeMove(bot, bot.moveDir || {x:0, y:0});
}

// --- LOGIK & TAKTIK ---

function shouldPlantBomb(bot, gx, gy, target, dangerMap) {
    if (!target) return false;
    
    const pgx = Math.round(target.x / TILE_SIZE);
    const pgy = Math.round(target.y / TILE_SIZE);
    const dist = Math.abs(gx - pgx) + Math.abs(gy - pgy);

    // 1. TÖTEN: Gegner in Sackgasse oder sehr nah
    if (dist <= bot.bombRange) {
        // Ist der Gegner in einer Linie?
        const onLine = (gx === pgx || gy === pgy);
        if (onLine) {
            // Check: Ist der Gegner "eingesperrt" oder bewegungsunfähig?
            if (isPlayerTrapped(target, pgx, pgy)) return true;
            // Einfach aggressiv legen wenn nah
            if (dist <= 2) return true;
        }
    }

    // 2. FARMEN: Kiste direkt daneben
    let softWallNear = false;
    DIRS.forEach(d => {
        const tx = gx + d.x; const ty = gy + d.y;
        if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) softWallNear = true;
    });
    
    // Nur farmen, wenn kein Gegner extrem nah ist (sonst tötet man sich selbst)
    if (softWallNear && dist > 2) return true;

    return false;
}

function isPlayerTrapped(player, gx, gy) {
    // Zähle freie Felder um den Spieler
    let freeExits = 0;
    DIRS.forEach(d => {
        const nx = gx + d.x;
        const ny = gy + d.y;
        if (!isSolid(nx, ny) && !isDangerousTile(nx, ny)) freeExits++;
    });
    return freeExits <= 1; // 0 oder 1 Ausweg = Falle
}

// --- PFADFINDUNG & BEWEGUNG ---

function executeMove(bot, dir) {
    if (!dir) return;
    const speed = bot.speed;
    bot.move(dir.x * speed, dir.y * speed);
    
    // Blickrichtung updaten
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
                // Spieler ist nicht solid, aber Mauern/Bomben schon
                // ACHTUNG: Wir wollen zum Spieler, also ist das Zielfeld (tx,ty) begehbar, auch wenn da ein Spieler steht.
                const isTarget = (nx === tx && ny === ty);
                if ((!isSolid(nx, ny) || isTarget) && !dangerMap[ny][nx]) {
                    visited.add(key);
                    queue.push({x:nx, y:ny, path: curr.path || d});
                }
            }
        }
    }
    return null;
}

function findSafeMove(gx, gy, dangerMap) {
    // BFS zum nächsten sicheren Feld
    const queue = [{x:gx, y:gy, firstMove: null}];
    const visited = new Set([gx+','+gy]);
    
    // Wenn wir schon sicher sind, bleib hier (oder bewege dich taktisch, hier vereinfacht: bleib)
    if (!dangerMap[gy][gx]) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0) {
        if(ops++ > 100) break;
        const curr = queue.shift();

        if (!dangerMap[curr.y][curr.x]) return curr.firstMove;

        for (let d of DIRS) {
            const nx = curr.x + d.x; 
            const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, firstMove: curr.firstMove || d});
            }
        }
    }
    return {x:0, y:0}; // Keine Rettung gefunden... RIP
}

function findNearestItem(gx, gy, dangerMap, maxDist) {
    // BFS nach Items
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    
    while(queue.length > 0) {
        const curr = queue.shift();
        if (curr.dist > maxDist) continue;

        const item = state.items[curr.y][curr.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) return curr.move;

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
                // Meide Skulls aktiv beim Laufen
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: curr.move || d, dist: curr.dist+1});
            }
        }
    }
    return null;
}

function findNearestSoftWall(gx, gy, dangerMap) {
    // Suche eine Softwall zum Sprengen
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 200) {
        const curr = queue.shift();
        
        // Prüfen ob benachbart zu Softwall
        for (let d of DIRS) {
            const tx = curr.x + d.x; const ty = curr.y + d.y;
            if (isValid(tx, ty) && state.grid[ty][tx] === TYPES.WALL_SOFT) {
                // Gefunden! Gehe zu curr.x/y um Bombe zu legen
                return curr.move || {x:0, y:0};
            }
        }

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
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
        return isValid(nx, ny) && !isSolid(nx, ny) && !dangerMap[ny][nx] && state.items[ny][nx] !== ITEMS.SKULL;
    });
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    return {x:0, y:0};
}

// --- HELPER ---
function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
    // 1. Feuer (Sofortiger Tod)
    state.particles.forEach(p => { 
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = true; 
    });
    // 2. Bomben (Gleich Tod)
    state.bombs.forEach(b => {
        const r = b.range;
        map[b.gy][b.gx] = true; // Bombe selbst
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                map[ty][tx] = true;
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Feuer stoppt hier, aber Feld ist gefährlich
            }
        });
    });
    return map;
}

function isValid(x, y) { return x>=0 && x<GRID_W && y>=0 && y<GRID_H; }
function isDangerousTile(x, y) { 
    // Schnellcheck ohne komplette Map
    if (state.grid[y][x] === TYPES.BOMB) return true;
    return false; // Vereinfacht
}