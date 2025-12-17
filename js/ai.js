import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, DIFFICULTIES, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [
    {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}
];

// Cache für Pfadfindung, um Performance zu sparen
const PATH_CACHE = new Map();

export function updateBotLogic(bot) {
    // 1. STATUS QUO
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    
    // Timer runterzählen
    if (bot.aiCooldown > 0) {
        bot.aiCooldown--;
        // Bewegung fortsetzen
        executeMove(bot);
        return;
    }

    // Gefahr-Analyse (Heatmap: 0=Sicher, >0=Gefahr in X Ticks)
    const dangerMap = calculateDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // Ziel-Auswahl (Wolfsrudel: Nur Menschen jagen!)
    const target = state.players.find(p => !p.isBot && p.alive) || state.players.find(p => p !== bot && p.alive);
    const isHard = state.difficulty === DIFFICULTIES.HARD;

    let nextMove = null;
    let shouldBomb = false;

    // --- ENTSCHEIDUNGSBAUM ---

    // 1. NOTFALL: FLUCHT (Prio A++)
    // Wenn wir auf einem Feld stehen, das bald explodiert -> RENNEN!
    if (currentDanger > 0) {
        nextMove = findSafestPath(gx, gy, dangerMap);
        bot.aiCooldown = 2; // Schnell reagieren
    } 
    
    // 2. SICHERER ZUSTAND: TAKTIK
    else {
        // A. Bombe legen?
        // Check: Haben wir Munition?
        if (bot.activeBombs < bot.maxBombs) {
            const bombScore = evaluateBombSpot(bot, gx, gy, target, dangerMap);
            
            // Auf HARD legen wir nur, wenn es sich lohnt (Score > X)
            // Auf EASY/MEDIUM sind wir trigger-happy
            const threshold = isHard ? 20 : 5;

            if (bombScore > threshold) {
                // WICHTIG: Suizid-Check!
                // Wenn ich hier lege, komme ich dann noch weg?
                if (canEscapeIfBombPlaced(gx, gy, dangerMap)) {
                    shouldBomb = true;
                }
            }
        }

        if (shouldBomb) {
            // Spezial-Bomben Logik (Napalm/Rolling)
            selectBombMode(bot, gx, gy);
            bot.plantBomb();
            
            // Nach dem Legen SOFORT Fluchtweg berechnen
            // Wir simulieren, dass hier jetzt eine Bombe liegt
            const tempMap = calculateDangerMap(); // Neu berechnen inkl. eigener neuer Bombe
            nextMove = findSafestPath(gx, gy, tempMap);
            bot.aiCooldown = 5;
        } 
        
        // B. Bewegen
        else {
            // 1. Items einsammeln (Hohe Prio, aber keine Skulls!)
            const itemPath = findPathToBestItem(gx, gy, dangerMap);
            if (itemPath) {
                nextMove = itemPath;
            }
            // 2. Angriff (Wolfsrudel)
            else if (target && isHard) {
                // Versuche den Spieler einzusperren oder zu erreichen
                const attackPath = findPathToTarget(gx, gy, Math.round(target.x/TILE_SIZE), Math.round(target.y/TILE_SIZE), dangerMap);
                if (attackPath) {
                    nextMove = attackPath;
                } else {
                    // Kein direkter Weg? Dann farmen wir uns einen Weg frei.
                    nextMove = findBestFarmingSpot(gx, gy, dangerMap);
                }
            }
            // 3. Farmen (Soft Walls zerstören)
            else {
                nextMove = findBestFarmingSpot(gx, gy, dangerMap);
            }
            
            // Cooldown etwas variieren für natürlicheres Verhalten
            bot.aiCooldown = 8 + Math.floor(Math.random() * 5);
        }
    }

    // --- AUSFÜHRUNG ---
    if (nextMove) {
        bot.botDir = nextMove;
        
        // Grafik-Ausrichtung
        if (nextMove.x !== 0) bot.lastDir = {x: Math.sign(nextMove.x), y: 0};
        else if (nextMove.y !== 0) bot.lastDir = {x: 0, y: Math.sign(nextMove.y)};
        
        executeMove(bot);
    } else {
        // Stehenbleiben (Idle)
        bot.botDir = {x:0, y:0};
    }
}

// --- CORE LOGIK ---

function executeMove(bot) {
    if (bot.botDir.x !== 0 || bot.botDir.y !== 0) {
        bot.move(bot.botDir.x * bot.speed, bot.botDir.y * bot.speed);
    }
}

/**
 * Bewertet die aktuelle Position für eine Bombe.
 * Gibt Punkte für: Soft Walls, Gegner (Menschen viel, Bots wenig/negativ), Items freilegen.
 */
function evaluateBombSpot(bot, gx, gy, target, dangerMap) {
    let score = 0;
    const r = bot.bombRange;

    // Simulation der Explosion in 4 Richtungen
    DIRS.forEach(d => {
        for(let i=1; i<=r; i++) {
            const tx = gx + d.x * i;
            const ty = gy + d.y * i;
            
            if (!isValid(tx, ty)) break;
            const tile = state.grid[ty][tx];

            // 1. Hindernis getroffen?
            if (tile === TYPES.WALL_HARD) break;
            if (tile === TYPES.WALL_SOFT) {
                score += 10; // Soft Wall Punkte
                // Bonus, wenn dahinter ein Item liegt (kennen wir eigentlich nicht, aber KI darf cheaten/erahnen)
                break; // Explosion stoppt hier
            }
            if (state.items[ty][tx] === ITEMS.SKULL) {
                score += 50; // Skull zerstören ist gut!
                break;
            }

            // 2. Gegner getroffen?
            state.players.forEach(p => {
                if (p.alive && Math.round(p.x/TILE_SIZE) === tx && Math.round(p.y/TILE_SIZE) === ty) {
                    if (p === bot) return; // Mich selbst ignorieren (Sicherheit prüft canEscape)
                    
                    if (!p.isBot) score += 100; // MENSCH: JACKPOT!
                    else score -= 50; // ANDERER BOT: NICHT SCHIESSEN (Wolfsrudel)!
                }
            });
        }
    });

    // 3. Situations-Boni
    if (target) {
        const pgx = Math.round(target.x/TILE_SIZE);
        const pgy = Math.round(target.y/TILE_SIZE);
        const dist = Math.abs(gx - pgx) + Math.abs(gy - pgy);
        
        // Wenn wir nah am Gegner sind, lohnt sich eine Bombe eher (Druck aufbauen)
        if (dist < 4) score += 5;
        
        // Falle stellen? (Wenn Gegner in Sackgasse)
        if (isDeadEnd(pgx, pgy) && dist <= 2) score += 200; 
    }

    return score;
}

/**
 * Findet den Weg zum nächstbesten Item (BFS).
 * Ignoriert Skulls!
 */
function findPathToBestItem(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);
    
    while(queue.length > 0) {
        const c = queue.shift();
        if (c.dist > 10) continue; // Nicht zu weit laufen

        const item = state.items[c.y][c.x];
        if (item !== ITEMS.NONE && item !== ITEMS.SKULL) {
            // Item gefunden und sicher?
            if (!dangerMap[c.y][c.x]) return c.move;
        }

        for (let d of DIRS) {
            const nx = c.x + d.x; const ny = c.y + d.y;
            if (isWalkable(nx, ny, dangerMap) && !visited.has(nx+','+ny)) {
                // Skulls sind wie Mauern, lauf nicht rein!
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return null;
}

/**
 * Findet die beste Position zum Farmen (Wo treffe ich die meisten Wände?)
 */
function findBestFarmingSpot(gx, gy, dangerMap) {
    // Wir suchen in der Nähe nach einem Spot mit hohem Bomb-Score
    let bestSpot = null;
    let maxScore = -1;

    // Einfache BFS Umgebungssuche
    const queue = [{x:gx, y:gy, move:null, dist:0}];
    const visited = new Set([gx+','+gy]);

    while(queue.length > 0) {
        const c = queue.shift();
        if (c.dist > 6) continue; // Radius

        // Bewerte diesen Spot (Simuliere, ich wäre dort)
        // Dummy-Bot für Bewertung an Position c.x/c.y
        const dummyBot = { ...state.players.find(p => Math.round(p.x/TILE_SIZE)===gx && Math.round(p.y/TILE_SIZE)===gy), bombRange: 3 }; 
        const score = evaluateBombSpot(dummyBot, c.x, c.y, null, dangerMap);

        if (score > maxScore && score > 0) {
            // WICHTIG: Nur hingehen, wenn der Weg sicher ist
            // Und wenn wir dort sicher eine Bombe legen KÖNNTEN
            // (Vereinfacht: Wir gehen erstmal hin)
            maxScore = score;
            bestSpot = c.move;
        }

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            if(isWalkable(nx, ny, dangerMap) && !visited.has(nx+','+ny)) {
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d, dist: c.dist+1});
            }
        }
    }
    return bestSpot;
}

/**
 * Findet den sichersten Weg aus der Gefahrenzone (BFS).
 */
function findSafestPath(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy, move:null}];
    const visited = new Set([gx+','+gy]);

    // Wenn wir schon sicher sind, bleiben wir hier (oder null)
    if (dangerMap[gy][gx] === 0) return {x:0, y:0};

    let ops = 0;
    while(queue.length > 0 && ops++ < 300) {
        const c = queue.shift();
        
        // Sicherer Ort gefunden?
        if (dangerMap[c.y][c.x] === 0) {
            return c.move || {x:0, y:0};
        }

        for (let d of DIRS) {
            const nx = c.x + d.x; const ny = c.y + d.y;
            // Bei Flucht ist "isWalkable" strikter: 
            // Wir dürfen in Felder laufen, die erst SPÄTER explodieren als unser aktuelles Feld?
            // Vereinfachung: Wir laufen nur in Felder, die begehbar sind.
            // Wichtig: Wir dürfen kurzzeitig durch "Gefahr" laufen, wenn es uns zum sicheren Ziel bringt,
            // aber das ist komplex. Hier: Suche nächstes freies Feld ohne Bombe drauf.
            
            if (isValid(nx, ny) && !isSolid(nx, ny) && !visited.has(nx+','+ny)) {
                // Sonderregel: Lauf nicht in eine Bombe rein, die gleich hochgeht (kleiner Timer)
                // dangerMap enthält Timer.
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return {x:0, y:0}; // Keine Rettung gefunden... Beten.
}

/**
 * Standard Pfadfindung zum Gegner
 */
function findPathToTarget(sx, sy, tx, ty, dangerMap) {
    const queue = [{x:sx, y:sy, move:null}];
    const visited = new Set([sx+','+sy]);
    let ops = 0;

    while(queue.length > 0 && ops++ < 500) {
        const c = queue.shift();
        if (c.x === tx && c.y === ty) return c.move; // Ziel erreicht (oder Nachbarfeld)

        for(let d of DIRS) {
            const nx = c.x+d.x; const ny = c.y+d.y;
            // Ziel (Spieler) ist begehbar für Pfadfindung
            const isTarget = (nx === tx && ny === ty);
            
            if (isValid(nx, ny) && (!isSolid(nx, ny) || isTarget) && !dangerMap[ny][nx] && !visited.has(nx+','+ny)) {
                // Skulls meiden
                if (state.items[ny][nx] === ITEMS.SKULL) continue;
                
                visited.add(nx+','+ny);
                queue.push({x:nx, y:ny, move: c.move || d});
            }
        }
    }
    return null;
}

// --- HELPER & SIMULATION ---

function canEscapeIfBombPlaced(gx, gy, currentDangerMap) {
    // Erstelle eine temporäre DangerMap, die die neue Bombe beinhaltet
    // (Vereinfacht: Wir prüfen nur, ob von (gx,gy) ein sicherer Nachbar erreichbar ist)
    
    // Nachbarn prüfen
    for (let d of DIRS) {
        const nx = gx + d.x;
        const ny = gy + d.y;
        // Ist der Nachbar begehbar UND sicher laut aktueller Map?
        if (isWalkable(nx, ny, currentDangerMap) && currentDangerMap[ny][nx] === 0) {
            return true;
        }
    }
    return false; // Eingesperrt
}

function calculateDangerMap() {
    // 0 = Sicher
    // 1..X = Gefahr (Ticks bis Explosion)
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));

    // 1. Existierende Explosionen (Feuer) -> SOFORT TÖDLICH (1)
    state.particles.forEach(p => {
        if (p.isFire && isValid(p.gx, p.gy)) map[p.gy][p.gx] = 1;
    });

    // 2. Bomben
    state.bombs.forEach(b => {
        const t = b.timer > 0 ? b.timer : 1; // Timer Wert
        // Bombe selbst
        map[b.gy][b.gx] = t;
        
        // Strahlen
        DIRS.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx = b.gx + d.x*i; const ty = b.gy + d.y*i;
                if (!isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                
                // Wir nehmen den kleinsten Timer (die baldeste Gefahr)
                if (map[ty][tx] === 0 || map[ty][tx] > t) {
                    map[ty][tx] = t;
                }
                
                if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
            }
        });
    });
    return map;
}

function isWalkable(x, y, dangerMap) {
    return isValid(x, y) && !isSolid(x, y) && (dangerMap ? dangerMap[y][x] === 0 : true);
}

function isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }

function isDeadEnd(x, y) {
    let free = 0;
    DIRS.forEach(d => {
        if (isValid(x+d.x, y+d.y) && !isSolid(x+d.x, y+d.y)) free++;
    });
    return free <= 1;
}

function selectBombMode(bot, gx, gy) {
    // Napalm nutzen, wenn wir viel Platz haben oder aggressiv sind
    if (bot.hasNapalm) bot.currentBombMode = BOMB_MODES.NAPALM;
    // Standard sonst
    else bot.currentBombMode = BOMB_MODES.STANDARD;
}