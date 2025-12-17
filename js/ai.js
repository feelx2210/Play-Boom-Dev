import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS } from './constants.js';
import { state } from './state.js';

// Richtungskonstanten
const DIRS = [
    { x: 0, y: -1, move: 'UP' },
    { x: 0, y: 1, move: 'DOWN' },
    { x: -1, y: 0, move: 'LEFT' },
    { x: 1, y: 0, move: 'RIGHT' },
    { x: 0, y: 0, move: 'STAY' }
];

export const AI = {
    // Cache für Pfadfindung pro Frame, um Performance zu sparen
    dangerMap: [],

    // Hauptfunktion, die vom Player aufgerufen wird
    getCommand(bot) {
        // 1. Grid-Koordinaten bestimmen
        const gx = Math.round(bot.x / TILE_SIZE);
        const gy = Math.round(bot.y / TILE_SIZE);

        // 2. Gefahrenkarte aktualisieren (Wo explodiert es gleich?)
        this.updateDangerMap();

        // 3. Wenn wir in Gefahr sind -> SOFORT FLIEHEN
        if (this.isDangerous(gx, gy)) {
            return this.findSafeSpot(gx, gy);
        }

        // 4. Entscheidung basierend auf Schwierigkeit
        // HARD: Aggressiv jagen
        if (state.difficulty === 2) {
            return this.aggressiveBehavior(bot, gx, gy);
        } 
        // NORMAL: Mix aus Farmen und Jagen
        else if (state.difficulty === 1) {
            return Math.random() < 0.6 ? this.farmBehavior(bot, gx, gy) : this.aggressiveBehavior(bot, gx, gy);
        }
        // EASY: Zufällig / Farmen
        else {
            return this.farmBehavior(bot, gx, gy);
        }
    },

    // --- VERHALTENS-LOGIK ---

    aggressiveBehavior(bot, gx, gy) {
        // A. Ziel: Nächster Gegner
        const target = this.findNearestPlayer(bot);
        if (!target) return this.farmBehavior(bot, gx, gy); // Fallback

        const dist = Math.abs(target.gx - gx) + Math.abs(target.gy - gy);

        // B. Bomben-Logik (Töten)
        // Wenn nah genug, Bombe bereit ist UND wir einen Fluchtweg haben
        if (dist <= bot.bombRange && bot.activeBombs < bot.maxBombs) {
            // Simulieren: Wenn ich hier Bombe lege, bin ich dann tot?
            if (this.isSafeToPlaceBomb(gx, gy, bot)) {
                return { action: 'BOMB' };
            }
        }

        // C. Jagen (Pfad zum Gegner)
        const nextMove = this.bfsMove(gx, gy, target.gx, target.gy);
        if (nextMove) return nextMove;

        // D. Wenn Weg blockiert (durch Soft Wall), dann sprengen
        return this.farmBehavior(bot, gx, gy);
    },

    farmBehavior(bot, gx, gy) {
        // Suche nächste Soft Wall oder Item
        const target = this.findNearestBlockOrItem(gx, gy);
        if (!target) return this.randomMove(gx, gy);

        // Wenn wir direkt davor stehen -> Bombe (wenn sicher)
        const dist = Math.abs(target.x - gx) + Math.abs(target.y - gy);
        if (dist === 1 && state.grid[target.y][target.x] === TYPES.WALL_SOFT) {
            if (bot.activeBombs < bot.maxBombs && this.isSafeToPlaceBomb(gx, gy, bot)) {
                return { action: 'BOMB' };
            }
        }

        // Sonst hingehen
        const move = this.bfsMove(gx, gy, target.x, target.y);
        if (move) return move;
        
        return { action: 'STAY' };
    },

    // --- TAKTISCHE ENTSCHEIDUNGEN ---

    isSafeToPlaceBomb(gx, gy, bot) {
        // Simuliere Bombe an aktueller Position
        // Wir tun so, als ob hier jetzt Gefahr wäre. 
        // Finden wir von hier aus in 1-2 Schritten ein sicheres Feld?
        
        // Einfache Heuristik: Ist ein Nachbarfeld sicher und leer?
        for (let d of DIRS) {
            if (d.move === 'STAY') continue;
            const nx = gx + d.x;
            const ny = gy + d.y;
            if (this.isValid(nx, ny) && !this.isSolid(nx, ny) && !this.isDangerous(nx, ny)) {
                return true; // Ja, wir können wegrennen
            }
        }
        return false; // Falle! Nicht legen.
    },

    findSafeSpot(gx, gy) {
        // BFS Suche nach dem nächsten Feld, das NICHT in dangerMap ist
        const queue = [{ x: gx, y: gy, path: [] }];
        const visited = new Set([`${gx},${gy}`]);

        while (queue.length > 0) {
            const curr = queue.shift();

            // Ist das hier sicher?
            if (!this.isDangerous(curr.x, curr.y)) {
                return curr.path.length > 0 ? curr.path[0] : { action: 'STAY' };
            }

            // Nachbarn checken
            for (let d of DIRS) {
                if (d.move === 'STAY') continue;
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;
                
                if (this.isValid(nx, ny) && !this.isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                    visited.add(`${nx},${ny}`);
                    const newPath = [...curr.path, { action: d.move }];
                    queue.push({ x: nx, y: ny, path: newPath });
                }
            }
        }
        return { action: 'STAY' }; // Panik!
    },

    // --- PFADFINDUNG (BFS) ---
    bfsMove(sx, sy, tx, ty) {
        const queue = [{ x: sx, y: sy, path: [] }];
        const visited = new Set([`${sx},${sy}`]);

        // Limit für Performance (nicht das ganze Grid suchen wenn unerreichbar)
        let steps = 0; 

        while (queue.length > 0 && steps < 100) {
            steps++;
            const curr = queue.shift();

            if (curr.x === tx && curr.y === ty) {
                return curr.path.length > 0 ? curr.path[0] : null;
            }

            for (let d of DIRS) {
                if (d.move === 'STAY') continue;
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;

                // Wichtig: Wir laufen nicht in Gefahrenzonen, außer wir sind schon drin!
                const isSafe = !this.isDangerous(nx, ny);
                // Wenn wir schon in Gefahr sind, ist "Sicherheit" egal, wir müssen raus. 
                // Aber hier suchen wir einen Weg zum Ziel. Also nur sichere Wege nehmen.
                
                if (this.isValid(nx, ny) && !this.isSolid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                    // Auf HARD meiden wir unsichere Felder strikt.
                    if (state.difficulty === 2 && !isSafe) continue;

                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, path: [...curr.path, { action: d.move }] });
                }
            }
        }
        return null;
    },

    // --- ANALYSE ---

    updateDangerMap() {
        // Erstellt ein 2D Array mit "true" wo gleich Feuer sein wird
        this.dangerMap = Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(false));

        state.bombs.forEach(b => {
            // Mitte
            this.markDanger(b.gx, b.gy);
            // Strahlen
            const range = b.range;
            [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}].forEach(dir => {
                for(let i=1; i<=range; i++) {
                    const tx = b.gx + dir.x * i;
                    const ty = b.gy + dir.y * i;
                    if (!this.isValid(tx, ty) || state.grid[ty][tx] === TYPES.WALL_HARD) break;
                    this.markDanger(tx, ty);
                    if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; // Feuer stoppt hier
                }
            });
        });
    },

    markDanger(x, y) {
        if (this.isValid(x, y)) this.dangerMap[y][x] = true;
    },

    isDangerous(x, y) {
        if (!this.isValid(x, y)) return true;
        return this.dangerMap[y][x];
    },

    findNearestPlayer(bot) {
        let nearest = null;
        let minDist = Infinity;
        state.players.forEach(p => {
            if (p !== bot && p.alive) {
                const pgx = Math.round(p.x / TILE_SIZE);
                const pgy = Math.round(p.y / TILE_SIZE);
                const d = Math.abs(pgx - Math.round(bot.x/TILE_SIZE)) + Math.abs(pgy - Math.round(bot.y/TILE_SIZE));
                if (d < minDist) {
                    minDist = d;
                    nearest = { gx: pgx, gy: pgy };
                }
            }
        });
        return nearest;
    },

    findNearestBlockOrItem(gx, gy) {
        // Suche nach Items oder Soft Walls (BFS)
        const queue = [{ x: gx, y: gy }];
        const visited = new Set([`${gx},${gy}`]);
        
        while(queue.length > 0) {
            const curr = queue.shift();
            const tile = state.grid[curr.y][curr.x];
            
            // Ziel gefunden? (Soft Wall oder Item)
            if (tile === TYPES.WALL_SOFT || state.items[curr.y][curr.x] !== ITEMS.NONE) {
                return curr;
            }

            for (let d of DIRS) {
                if (d.move === 'STAY') continue;
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;
                if(this.isValid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                    // Wir können nicht durch Wände sehen/gehen beim Suchen
                    if (state.grid[ny][nx] !== TYPES.WALL_HARD) {
                        visited.add(`${nx},${ny}`);
                        queue.push({x:nx, y:ny});
                    }
                }
            }
        }
        return null;
    },

    randomMove(gx, gy) {
        const possible = DIRS.filter(d => {
            const nx = gx + d.x;
            const ny = gy + d.y;
            return this.isValid(nx, ny) && !this.isSolid(nx, ny) && !this.isDangerous(nx, ny);
        });
        if (possible.length > 0) {
            const pick = possible[Math.floor(Math.random() * possible.length)];
            return { action: pick.move };
        }
        return { action: 'STAY' };
    },

    isValid(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; },
    isSolid(x, y) { 
        const t = state.grid[y][x]; 
        return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT || t === TYPES.BOMB; 
    }
};