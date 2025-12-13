import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

export function updateBotLogic(bot) {
    // 1. STATE INITIALISIERUNG
    // Wir speichern den State direkt am Bot-Objekt, um Sync-Probleme zu vermeiden
    if (!bot.ai) {
        bot.ai = {
            state: 'DECIDING', // DECIDING, MOVING, FLEEING
            targetX: null,     // Grid-X Ziel
            targetY: null,     // Grid-Y Ziel
            nextMoveDir: null, // {x, y} für flüssige Bewegung
            waitTimer: 0       // Um Zappeln zu verhindern, wenn kein Weg da ist
        };
    }

    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);
    const dangerMap = getDangerMap();
    const currentDanger = dangerMap[gy][gx];

    // --- PRIORITY 1: ÜBERLEBEN (FLEEING) ---
    // Wenn wir in Gefahr sind (oder das Ziel gefährlich wurde), brechen wir alles ab.
    if (currentDanger > 0) {
        bot.ai.state = 'FLEEING';
        
        // Suche den allernächsten sicheren Fleck
        const safeTile = findSafeTile(gx, gy, dangerMap);
        
        if (safeTile) {
            // Im Fluchtmodus bewegen wir uns pixelgenau, kein Grid-Snap Zwang
            moveToPixel(bot, safeTile.x * TILE_SIZE, safeTile.y * TILE_SIZE);
        } else {
            // Panik: Wenn kein sicherer Weg, lauf random (besser als stehenbleiben)
            moveRandomly(bot);
        }
        return; // Keine weitere Logik in diesem Frame
    }

    // Wenn wir gerade geflohen sind und jetzt sicher sind -> Reset
    if (bot.ai.state === 'FLEEING' && currentDanger === 0) {
        // Snap to Grid um wieder sauber ausgerichtet zu sein
        snapToGrid(bot);
        bot.ai.state = 'DECIDING';
    }

    // --- PRIORITY 2: BEWEGUNG AUSFÜHREN (MOVING) ---
    // Wenn wir ein Ziel haben, laufen wir dorthin bis wir ankommen.
    if (bot.ai.state === 'MOVING') {
        const tx = bot.ai.targetX;
        const ty = bot.ai.targetY;

        // Sicherheitscheck: Ist das Ziel plötzlich blockiert (z.B. andere Bombe gelegt)?
        if (isSolid(tx, ty) || dangerMap[ty][tx] > 0) {
            bot.ai.state = 'DECIDING'; // Abbruch, neu denken
            return;
        }

        // Bewegung
        if (hasReachedGrid(bot, tx, ty)) {
            bot.x = tx * TILE_SIZE; 
            bot.y = ty * TILE_SIZE; // Hard Snap
            bot.ai.state = 'DECIDING';
        } else {
            moveToPixel(bot, tx * TILE_SIZE, ty * TILE_SIZE);
        }
        return;
    }

    // --- PRIORITY 3: ENTSCHEIDUNG TREFFEN (DECIDING) ---
    if (bot.ai.state === 'DECIDING') {
        // Kurze Denkpause wenn wir gewartet haben
        if (bot.ai.waitTimer > 0) {
            bot.ai.waitTimer--;
            return;
        }

        // A) BOMBE LEGEN?
        // Nur wenn wir eine Bombe haben UND es strategisch Sinn macht UND sicher ist
        if (bot.activeBombs < bot.maxBombs) {
            if (shouldPlantBomb(bot, gx, gy)) {
                // WICHTIG: Simuliere Explosion. Habe ich DANACH einen Fluchtweg?
                // Wir übergeben eine temporäre DangerMap, in der die neue Bombe eingetragen ist.
                if (canEscapeFromBomb(gx, gy, dangerMap, bot.bombRange)) {
                    bot.plantBomb();
                    // Sofort in den Fluchtmodus wechseln, damit wir im nächsten Frame wegrennen
                    // Wir verlassen uns auf Priority 1 im nächsten Loop
                    return;
                }
            }
        }

        // B) NÄCHSTES ZIEL WÄHLEN
        const target = pickNextTarget(bot, gx, gy, dangerMap);
        
        if (target) {
            bot.ai.state = 'MOVING';
            bot.ai.targetX = target.x;
            bot.ai.targetY = target.y;
        } else {
            // Kein Ziel gefunden (z.B. eingemauert)? Warte kurz.
            bot.ai.waitTimer = 10 + Math.random() * 20;
        }
    }
}

// ================= LOGIK FUNKTIONEN =================

function moveToPixel(bot, targetX, targetY) {
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.hypot(dx, dy);
    
    // Geschwindigkeit drosseln, um nicht über das Ziel hinaus zu schießen
    const moveSpeed = Math.min(dist, bot.speed);

    if (dist > 1) {
        const mx = (dx / dist) * moveSpeed;
        const my = (dy / dist) * moveSpeed;
        
        bot.move(mx, my);
        
        // Animation
        if (Math.abs(mx) > Math.abs(my)) bot.lastDir = {x: Math.sign(mx), y: 0};
        else bot.lastDir = {x: 0, y: Math.sign(my)};
    }
}

function snapToGrid(bot) {
    bot.x = Math.round(bot.x / TILE_SIZE) * TILE_SIZE;
    bot.y = Math.round(bot.y / TILE_SIZE) * TILE_SIZE;
}

function hasReachedGrid(bot, gx, gy) {
    // Toleranzbereich von 2 Pixeln
    const px = gx * TILE_SIZE;
    const py = gy * TILE_SIZE;
    return Math.abs(bot.x - px) <= 4 && Math.abs(bot.y - py) <= 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    // Prüfen ob Wand
    if (!isSolid(Math.round((bot.x + d.x*16)/TILE_SIZE), Math.round((bot.y + d.y*16)/TILE_SIZE))) {
        bot.move(d.x * bot.speed, d.y * bot.speed);
    }
}

// --- STRATEGIE ---

function pickNextTarget(bot, gx, gy, dangerMap) {
    // 1. ZIEL: GEGNER (HARD/MEDIUM)
    const enemy = findNearestEnemy(bot);
    
    // Auf Hard: Aggressive Pfadsuche (A*)
    if (state.difficulty === DIFFICULTIES.HARD && enemy) {
        // Modus "Breach": Gehe zum Gegner, auch wenn Soft Walls im Weg sind (um sie zu sprengen)
        const path = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, true); // true = allowSoftWalls
        if (path) return path;
    }

    // Auf Medium: Nur jagen wenn nah
    if (state.difficulty === DIFFICULTIES.MEDIUM && enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        if (dist < 6) {
            const path = findPath(gx, gy, Math.round(enemy.x/TILE_SIZE), Math.round(enemy.y/TILE_SIZE), dangerMap, false);
            if (path) return path;
        }
    }

    // 2. ZIEL: LOOT / KISTEN (Alle Schwierigkeitsgrade)
    // Suche die nächste erreichbare Kiste oder Item
    const loot = findNearestLoot(gx, gy, dangerMap);
    if (loot) return loot;

    // 3. FALLBACK: ZUFALL (Damit sie sich bewegen)
    // Suche ein zufälliges freies Nachbarfeld
    const validMoves = DIRS.map(d => ({x: gx+d.x, y: gy+d.y}))
        .filter(p => !isSolid(p.x, p.y) && dangerMap[p.y][p.x] === 0);
    
    if (validMoves.length > 0) {
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    return null; // Nichts zu tun
}

function shouldPlantBomb(bot, gx, gy) {
    // EASY bots legen nur zufällig Bomben
    if (state.difficulty === DIFFICULTIES.EASY) {
        return Math.random() < 0.05;
    }

    // 1. Ist eine Kiste nebenan?
    const hasBox = DIRS.some(d => {
        const ny = gy + d.y; const nx = gx + d.x;
        return state.grid[ny] && state.grid[ny][nx] === TYPES.WALL_SOFT;
    });

    if (hasBox) return true;

    // 2. Ist ein Gegner in Reichweite? (Nur Medium/Hard)
    const enemy = findNearestEnemy(bot);
    if (enemy) {
        const dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y) / TILE_SIZE;
        if (dist <= bot.bombRange) {
            // Check ob wir in einer Linie stehen
            const dx = Math.abs(Math.round(enemy.x/TILE_SIZE) - gx);
            const dy = Math.abs(Math.round(enemy.y/TILE_SIZE) - gy);
            if (dx === 0 || dy === 0) return true;
        }
    }

    return false;
}

// --- SICHERHEITS CHECKS ---

function canEscapeFromBomb(gx, gy, currentDangerMap, range) {
    // 1. Erstelle eine "Virtuelle Gefahr", als ob die Bombe schon liegen würde
    const virtualDanger = new Set();
    virtualDanger.add(`${gx},${gy}`); // Bombenposition

    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolid(tx, ty, true)) break; // Hardwall stoppt
            virtualDanger.add(`${tx},${ty}`);
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Softwall stoppt
        }
    });

    // 2. BFS: Suche einen Weg zu einem Feld, das NICHT in virtualDanger ist
    // Wir dürfen durch virtualDanger laufen (Flucht), aber das Ziel muss sicher sein.
    
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([`${gx},${gy}`]);

    let iterations = 0;
    while(queue.length > 0) {
        if (iterations++ > 200) break;
        const curr = queue.shift();

        // Ist dieses Feld sicher?
        const key = `${curr.x},${curr.y}`;
        // Sicher = Nicht in virtueller Explosion UND nicht in alter Gefahr
        if (!virtualDanger.has(key) && currentDangerMap[curr.y][curr.x] === 0) {
            return true; // Ja, wir können entkommen!
        }

        if (curr.dist > 5) continue; // Zu weit weg suchen macht keinen Sinn

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Wir können nur auf freie Felder laufen
            // WICHTIG: Wir dürfen NICHT in existierende Gefahr laufen (z.B. andere Bomben)
            if (!isSolid(nx, ny) && currentDangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, dist:curr.dist+1});
            }
        }
    }
    return false; // Kein Ausweg gefunden -> Bombe verboten
}

function findSafeTile(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    let iterations = 0;

    while(queue.length > 0) {
        if (iterations++ > 300) break;
        const curr = queue.shift();

        // Ziel: Feld ohne Gefahr
        if (dangerMap[curr.y][curr.x] === 0) return curr;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            // Lauf nur auf freie Felder
            if (!isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny});
            }
        }
    }
    return null;
}

// --- PFADFINDUNG ---

function findPath(sx, sy, tx, ty, dangerMap, allowSoftWalls) {
    const queue = [{x:sx, y:sy, firstStep:null}];
    const visited = new Set([`${sx},${sy}`]);
    let iterations = 0;

    while(queue.length > 0) {
        if (iterations++ > 500) break;
        const curr = queue.shift();

        if (curr.x === tx && curr.y === ty) return curr.firstStep;

        // Greedy Heuristik: Sortiere Nachbarn nach Distanz zum Ziel
        const neighbors = DIRS.map(d => ({x:curr.x+d.x, y:curr.y+d.y}))
            .sort((a,b) => (Math.abs(a.x-tx)+Math.abs(a.y-ty)) - (Math.abs(b.x-tx)+Math.abs(b.y-ty)));

        for (let n of neighbors) {
            if (visited.has(`${n.x},${n.y}`)) continue;
            
            const tile = state.grid[n.y] ? state.grid[n.y][n.x] : TYPES.WALL_HARD;
            
            // Hindernis Check
            let blocked = false;
            if (tile === TYPES.WALL_HARD || tile === TYPES.BOMB) blocked = true;
            // Bei "Breach" (allowSoftWalls) dürfen wir Kisten als Weg betrachten (Ziel ist davor)
            if (tile === TYPES.WALL_SOFT && !allowSoftWalls) blocked = true;
            // Meide Gefahr
            if (dangerMap[n.y][n.x] > 0) blocked = true;

            if (!blocked) {
                visited.add(`${n.x},${n.y}`);
                queue.push({x:n.x, y:n.y, firstStep: curr.firstStep || {x:n.x, y:n.y}});
            }
        }
    }
    return null;
}

function findNearestLoot(sx, sy, dangerMap) {
    const queue = [{x:sx, y:sy, firstStep:null}];
    const visited = new Set([`${sx},${sy}`]);
    let iterations = 0;

    while(queue.length > 0) {
        if (iterations++ > 400) break;
        const curr = queue.shift();

        const t = state.grid[curr.y][curr.x];
        const item = state.items[curr.y][curr.x];

        // Ziel gefunden (aber nicht Startfeld)
        if ((curr.x !== sx || curr.y !== sy) && (t === TYPES.WALL_SOFT || item !== ITEMS.NONE)) {
            // Wenn es eine Softwall ist, können wir nicht hindurch, also ist das Ziel erreicht
            return curr.firstStep; 
        }

        // Softwalls blockieren den Weg (außer sie sind das Ziel)
        if (t === TYPES.WALL_SOFT) continue;

        for (let d of DIRS) {
            const nx = curr.x+d.x; const ny = curr.y+d.y;
            if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({x:nx, y:ny, firstStep: curr.firstStep || {x:nx, y:ny}});
            }
        }
    }
    return null;
}

// --- UTIL HELPERS ---

function findNearestEnemy(bot) {
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if (p === bot || !p.alive) return;
        const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
}

function getEffectiveBlastRange(gx, gy, baseRange) {
    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === gx && p.y === gy);
    const isOil = state.grid[gy] && state.grid[gy][gx] === TYPES.OIL;
    if (isBoost || isOil) return 15;
    return baseRange;
}

function getDangerMap() {
    // 0=Safe, 1=Danger
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    // Feuer
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    // Bomben
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; // Bombe selbst
        const r = getEffectiveBlastRange(b.gx, b.gy, b.range);
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if (isSolid(tx, ty, true)) break; 
                map[ty][tx] = 1;
                if (state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    
    // Level Hazard
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isSolid(tx,ty,true)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}