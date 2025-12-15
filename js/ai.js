import { GRID_W, GRID_H, TYPES, ITEMS, TILE_SIZE, BOOST_PADS, HELL_CENTER, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Kleiner Speicher, um Jitter zu verhindern (Ziele beibehalten)
const botMemory = {};

export function updateBotLogic(bot) {
    // Init Memory
    if (!botMemory[bot.id]) {
        botMemory[bot.id] = { target: null, patience: 0, lastPos: {x:-1, y:-1} };
    }
    const mem = botMemory[bot.id];

    // Position im Grid
    const gx = Math.round(bot.x / TILE_SIZE);
    const gy = Math.round(bot.y / TILE_SIZE);

    // 1. DANGER MAP BERECHNEN (Wo knallt es gleich?)
    const dangerMap = getDangerMap();
    const isSafeHere = dangerMap[gy][gx] === 0;

    // ------------------------------------------------------------------------
    // SCHRITT 1: ÜBERLEBEN (Notfall-Modus)
    // ------------------------------------------------------------------------
    if (!isSafeHere) {
        // Wir stehen im Feuer/Radius! Sofort zum nächsten sicheren Feld rennen.
        const safeTile = findNearestSafeTile(gx, gy, dangerMap);
        if (safeTile) {
            mem.target = null; // Altes Ziel vergessen
            moveToPixel(bot, safeTile.x * TILE_SIZE, safeTile.y * TILE_SIZE);
        } else {
            // Keine Rettung? Panik-Move (besser als stehenbleiben)
            moveRandomly(bot);
        }
        return;
    }

    // ------------------------------------------------------------------------
    // SCHRITT 2: BOMBE LEGEN? (Offensive)
    // ------------------------------------------------------------------------
    // Nur legen, wenn wir sicher stehen, Munition haben und es Sinn macht
    if (bot.activeBombs < bot.maxBombs) {
        if (shouldPlantBomb(bot, gx, gy, dangerMap)) {
            // WICHTIG: Prüfen, ob wir NACH dem Legen noch entkommen können!
            if (canEscapeAfterPlanting(gx, gy, dangerMap, bot.bombRange)) {
                bot.plantBomb();
                return; // Bombe gelegt -> im nächsten Frame flüchten wir automatisch (Schritt 1 greift)
            }
        }
    }

    // ------------------------------------------------------------------------
    // SCHRITT 3: ZIELSUCHE (Utility / Score Based)
    // ------------------------------------------------------------------------
    
    // Wenn wir schon ein Ziel haben und es noch valide ist, behalten wir es (gegen Jitter)
    if (mem.target) {
        if (hasReachedPixel(bot, mem.target.x, mem.target.y)) {
            mem.target = null; // Angekommen
        } else {
            const tx = Math.round(mem.target.x / TILE_SIZE);
            const ty = Math.round(mem.target.y / TILE_SIZE);
            // Ziel ist plötzlich gefährlich oder blockiert? -> Abbrechen
            if (dangerMap[ty][tx] > 0 || isSolid(tx, ty)) {
                mem.target = null;
            } else {
                // Weiterlaufen
                moveToPixel(bot, mem.target.x, mem.target.y);
                return;
            }
        }
    }

    // Neues Ziel berechnen
    const bestMove = findBestMove(bot, gx, gy, dangerMap);
    if (bestMove) {
        mem.target = { x: bestMove.x * TILE_SIZE, y: bestMove.y * TILE_SIZE };
        moveToPixel(bot, mem.target.x, mem.target.y);
    } else {
        // Nichts zu tun? Random wackeln oder zur Mitte laufen (Campen verhindern)
        moveRandomly(bot);
    }
}

// ======================================================================
//                              KERN-LOGIK
// ======================================================================

// Bewertet alle erreichbaren Felder und findet das beste
function findBestMove(bot, gx, gy, dangerMap) {
    const queue = [{ x: gx, y: gy, dist: 0, firstStep: null }];
    const visited = new Set([`${gx},${gy}`]);
    
    let bestTile = null;
    let maxScore = -Infinity;

    // Wie aggressiv/intelligent sind wir?
    const isHard = state.difficulty === DIFFICULTIES.HARD;
    const isMedium = state.difficulty === DIFFICULTIES.MEDIUM;

    let loops = 0;
    while(queue.length > 0) {
        if (loops++ > 400) break; // Performance Limit
        const curr = queue.shift();

        // 1. SCORE BERECHNEN FÜR DIESES FELD
        let score = 0;

        // Distanz-Malus (lieber nahe Ziele)
        score -= curr.dist * 0.5;

        // Item Bonus
        const item = state.items[curr.y][curr.x];
        if (item !== ITEMS.NONE) {
            if (isHard && item === ITEMS.SKULL) score -= 500; // Hard Bots meiden Skulls
            else score += 100; // Powerups sind super
        }

        // Strategische Position (Neben Softwall)
        // Wir prüfen, ob wir von HIER aus eine Kiste sprengen könnten
        const potentialDamage = countDestroyableWalls(curr.x, curr.y, bot.bombRange);
        if (potentialDamage > 0) {
            score += potentialDamage * 15; // Jede Kiste ist wertvoll
        }

        // Gegner Jagen (Hard)
        if (isHard) {
            const enemy = findTargetEnemy(bot);
            if (enemy) {
                const distToEnemy = Math.abs(curr.x - Math.round(enemy.x/TILE_SIZE)) + Math.abs(curr.y - Math.round(enemy.y/TILE_SIZE));
                // Wir wollen nah ran, aber nicht kuscheln (Abstand 3-5 ist gut)
                if (distToEnemy < 8) score += (10 - distToEnemy) * 2;
            }
        }

        // Ist das der neue Highscore?
        if (score > maxScore) {
            maxScore = score;
            // WICHTIG: Wir speichern den ERSTEN Schritt, um dorthin zu kommen
            bestTile = curr.firstStep || {x: curr.x, y: curr.y}; 
        }

        // 2. NACHBARN ERKUNDEN
        // Nur weiterlaufen, wenn Distanz nicht zu groß
        if (curr.dist < 15) {
            for (let d of DIRS) {
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;
                
                // Valid Check: Im Grid, nicht besucht, keine Wand, keine Gefahr
                if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                    if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0) {
                        visited.add(`${nx},${ny}`);
                        queue.push({
                            x: nx, y: ny, 
                            dist: curr.dist + 1, 
                            firstStep: curr.firstStep || {x: nx, y: ny} 
                        });
                    }
                }
            }
        }
    }

    return bestTile;
}

function shouldPlantBomb(bot, gx, gy, dangerMap) {
    // 1. Zerstören wir Items? -> NEIN!
    if (willDestroyPowerUp(gx, gy, bot.bombRange)) return false;

    const isHard = state.difficulty === DIFFICULTIES.HARD;

    // 2. Gegner in Reichweite? (KILL)
    const enemy = findTargetEnemy(bot); // Auf Hard: Player 1
    if (enemy) {
        const ex = Math.round(enemy.x / TILE_SIZE);
        const ey = Math.round(enemy.y / TILE_SIZE);
        
        // Sind wir auf einer Achse?
        const onX = (gy === ey && Math.abs(gx - ex) <= bot.bombRange);
        const onY = (gx === ex && Math.abs(gy - ey) <= bot.bombRange);
        
        if ((onX || onY) && hasLineOfSight(gx, gy, ex, ey)) {
            // Hard Bots legen sofort, andere zögern
            return isHard || Math.random() < 0.5;
        }
    }

    // 3. Kisten zerstören (FARM)
    const walls = countDestroyableWalls(gx, gy, bot.bombRange);
    if (walls > 0) {
        // Auf Hard: Warten wir auf einen besseren Spot?
        if (isHard && walls === 1) {
            // Simpler Check: Gibt es einen Nachbarn, der 2+ schafft?
            // Wenn ja, legen wir hier NICHT, sondern lassen die Bewegungslogik uns dorthin führen (Utility Score ist dort höher)
            if (hasBetterNeighbor(gx, gy, bot.bombRange, dangerMap)) return false;
        }
        return true;
    }

    return false;
}

// ======================================================================
//                              HELPER
// ======================================================================

function findNearestSafeTile(gx, gy, dangerMap) {
    const queue = [{x:gx, y:gy}];
    const visited = new Set([`${gx},${gy}`]);
    
    // BFS für den kürzesten Weg ins Sichere
    while(queue.length > 0) {
        const curr = queue.shift();
        
        if (dangerMap[curr.y][curr.x] === 0) return curr; // Gefunden!

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                // Bei Flucht dürfen wir nicht durch Wände
                // Aber wir dürfen durch "Gefahr" laufen, um zu "Sicherheit" zu kommen (wenn es der einzige Weg ist)
                // Hier vereinfacht: Nur begehbare Felder
                if (!isSolid(nx, ny)) { 
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny});
                }
            }
        }
    }
    return null;
}

// Simuliert: Wenn ich hier lege, komme ich dann noch weg?
function canEscapeAfterPlanting(gx, gy, dangerMap, range) {
    // 1. Virtuelle Gefahr erstellen
    const virtualMap = JSON.parse(JSON.stringify(dangerMap)); // Deep copy simple array
    
    // Bombe eintragen
    virtualMap[gy][gx] = 2;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break;
            virtualMap[ty][tx] = 2; // Tödlich
            if (state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });

    // 2. Suche Weg zu einem Feld mit danger=0
    // Wichtig: Wir starten BEI DER BOMBE. Wir dürfen durch die Explosion laufen (da sie erst in 3s kommt),
    // ABER wir müssen am Ende auf einem sicheren Feld stehen.
    const queue = [{x:gx, y:gy, dist:0}];
    const visited = new Set([`${gx},${gy}`]);

    while(queue.length > 0) {
        const curr = queue.shift();
        if (curr.dist > 10) continue; // Limit

        // Ist dieses Feld sicher?
        if (virtualMap[curr.y][curr.x] === 0) return true;

        for (let d of DIRS) {
            const nx = curr.x + d.x; const ny = curr.y + d.y;
            if (nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited.has(`${nx},${ny}`)) {
                if (!isSolid(nx, ny)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({x:nx, y:ny, dist: curr.dist+1});
                }
            }
        }
    }
    return false;
}

function countDestroyableWalls(gx, gy, range) {
    let count = 0;
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break;
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) {
                count++;
                break;
            }
        }
    });
    return count;
}

function hasBetterNeighbor(gx, gy, range, dangerMap) {
    const currentHits = countDestroyableWalls(gx, gy, range);
    return DIRS.some(d => {
        const nx = gx+d.x; const ny = gy+d.y;
        if (!isSolid(nx, ny) && dangerMap[ny][nx] === 0) {
            return countDestroyableWalls(nx, ny, range) > currentHits;
        }
        return false;
    });
}

function hasLineOfSight(x1, y1, x2, y2) {
    // Einfacher Bresenham oder Step-Check, da wir nur X oder Y Achse prüfen
    if (x1 === x2) { // Vertikal
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        for(let y=start+1; y<end; y++) if (isSolid(x1, y)) return false;
    } else { // Horizontal
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        for(let x=start+1; x<end; x++) if (isSolid(x, y1)) return false;
    }
    return true;
}

function willDestroyPowerUp(gx, gy, range) {
    let destroys = false;
    // Check Center
    if (isPowerUp(gx, gy)) destroys = true;
    
    // Check Rays
    DIRS.forEach(d => {
        for(let i=1; i<=range; i++) {
            const tx = gx + d.x*i; const ty = gy + d.y*i;
            if (isSolidWall(tx, ty)) break;
            if (isPowerUp(tx, ty)) destroys = true;
            if (state.grid[ty] && state.grid[ty][tx] === TYPES.WALL_SOFT) break;
        }
    });
    return destroys;
}

function isPowerUp(x, y) {
    if (x<0||y<0||x>=GRID_W||y>=GRID_H) return false;
    const item = state.items[y][x];
    return (item !== ITEMS.NONE && item !== ITEMS.SKULL);
}

function findTargetEnemy(bot) {
    // Hard: Player 1 Fokus
    if (state.difficulty === DIFFICULTIES.HARD) {
        const p1 = state.players.find(p => p.id === 1 && p.alive);
        if (p1) return p1;
    }
    // Sonst: Nächster
    let nearest = null;
    let minDist = Infinity;
    state.players.forEach(p => {
        if(p!==bot && p.alive) {
            const d = (p.x-bot.x)**2 + (p.y-bot.y)**2;
            if(d<minDist){ minDist=d; nearest=p; }
        }
    });
    return nearest;
}

// --- STANDARD UTILS ---

function moveToPixel(bot, tx, ty) {
    const dx = tx - bot.x; const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.min(dist, bot.speed);
    
    if (dist > 1) {
        const mx = (dx/dist)*speed; const my = (dy/dist)*speed;
        bot.move(mx, my);
        if(Math.abs(mx)>Math.abs(my)) bot.lastDir = {x:Math.sign(mx), y:0};
        else bot.lastDir = {x:0, y:Math.sign(my)};
    }
}

function snapToGrid(bot) {
    bot.x = Math.round(bot.x / TILE_SIZE) * TILE_SIZE;
    bot.y = Math.round(bot.y / TILE_SIZE) * TILE_SIZE;
}

function hasReachedPixel(bot, px, py) {
    return Math.abs(bot.x - px) <= 4 && Math.abs(bot.y - py) <= 4;
}

function moveRandomly(bot) {
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!isSolid(Math.round((bot.x+d.x*10)/TILE_SIZE), Math.round((bot.y+d.y*10)/TILE_SIZE))) {
        bot.move(d.x*bot.speed, d.y*bot.speed);
    }
}

function isSolidWall(x, y) {
    if (x<0 || x>=GRID_W || y<0 || y>=GRID_H) return true;
    return state.grid[y][x] === TYPES.WALL_HARD;
}

function getDangerMap() {
    const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0));
    
    // Feuer
    state.particles.forEach(p => { if(p.isFire) map[p.gy][p.gx] = 2; });
    
    // Bomben
    state.bombs.forEach(b => {
        map[b.gy][b.gx] = 2; 
        
        // Range berechnen (ink. Öl/Boost)
        const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
        const isOil = state.grid[b.gy] && state.grid[b.gy][b.gx] === TYPES.OIL;
        const r = (isBoost||isOil) ? 15 : b.range;

        // Strahlen
        DIRS.forEach(d => {
            for(let i=1; i<=r; i++) {
                const tx=b.gx+d.x*i; const ty=b.gy+d.y*i;
                if(isSolidWall(tx, ty)) break;
                map[ty][tx] = 1; // Gefahrzone
                if(state.grid[ty][tx]===TYPES.WALL_SOFT) break;
            }
        });
    });
    
    // Level Hazard
    if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
        map[HELL_CENTER.y][HELL_CENTER.x] = 2;
        DIRS.forEach(d => { for(let i=1; i<=5; i++) {
            const tx=HELL_CENTER.x+d.x*i; const ty=HELL_CENTER.y+d.y*i;
            if(isSolidWall(tx,ty)) break;
            map[ty][tx] = 2;
        }});
    }
    return map;
}