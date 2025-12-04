// FIX: BOOST_PADS und TYPES importiert
import { TILE_SIZE, GRID_W, GRID_H, TYPES, BOMB_MODES, ITEMS, keyBindings, BOOST_PADS } from './constants.js';
import { state } from './state.js';
import { isSolid, createFloatingText } from './utils.js';
import { drawCharacterSprite } from './graphics.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

export class Player {
    constructor(id, x, y, charDef, isBot = false) {
        this.id = id;
        this.charDef = charDef; 
        this.name = charDef.name;
        this.startX = x * TILE_SIZE;
        this.startY = y * TILE_SIZE;
        this.x = this.startX; 
        this.y = this.startY;
        this.gridX = x; this.gridY = y;
        this.isBot = isBot;
        this.alive = true;
        this.invincibleTimer = 0;
        this.fireTimer = 0;
        this.speed = 2; 
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.bombRange = 1;
        this.hasNapalm = false; this.napalmTimer = 0;
        this.hasRolling = false; this.rollingTimer = 0;
        this.currentBombMode = BOMB_MODES.STANDARD;
        this.lastDir = {x: 0, y: 1}; 
        this.skullEffect = null; this.skullTimer = 0;
        this.targetX = x; this.targetY = y; this.changeDirTimer = 0; 
        this.bobTimer = 0;
        this.deathTimer = 0;
    }

    update() {
        if (!this.alive) {
            if (this.deathTimer > 0) this.deathTimer--;
            return;
        }

        if (this.id === 1) this.updateHud();

        this.bobTimer += 0.2;

        if (this.hasRolling) {
            this.rollingTimer--;
            if (this.rollingTimer <= 0) {
                this.hasRolling = false;
                if (this.currentBombMode === BOMB_MODES.ROLLING) this.currentBombMode = BOMB_MODES.STANDARD;
                createFloatingText(this.x, this.y, "ROLLING LOST", "#cccccc");
            }
        }
        if (this.hasNapalm) {
            this.napalmTimer--;
            if (this.napalmTimer <= 0) {
                this.hasNapalm = false;
                if (this.currentBombMode === BOMB_MODES.NAPALM) this.currentBombMode = BOMB_MODES.STANDARD;
                createFloatingText(this.x, this.y, "NAPALM LOST", "#cccccc");
            }
        }
        
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        let currentSpeed = this.speed;

        if (this.skullEffect) {
            this.skullTimer--;
            if (this.skullTimer <= 0) {
                this.skullEffect = null;
                createFloatingText(this.x, this.y, "CURED!", "#00ff00");
            } else {
                if (this.skullEffect === 'sickness') {
                    if (Math.random() < 0.05) this.plantBomb();
                } else if (this.skullEffect === 'speed_rush') {
                    currentSpeed *= 2;
                } else if (this.skullEffect === 'slow') {
                    currentSpeed *= 0.5;
                }
            }
        }

        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            if (state.grid[gy][gx] === TYPES.WATER) {
                currentSpeed *= 0.5; 
            }
        }

        let dx = 0, dy = 0;
        if (this.isBot) {
            this.updateBot(currentSpeed);
        } else {
            if (state.keys[keyBindings.UP]) dy = -currentSpeed;
            if (state.keys[keyBindings.DOWN]) dy = currentSpeed;
            if (state.keys[keyBindings.LEFT]) dx = -currentSpeed;
            if (state.keys[keyBindings.RIGHT]) dx = currentSpeed;
            
            if (dx !== 0 || dy !== 0) {
                if (Math.abs(dx) > Math.abs(dy)) this.lastDir = {x: Math.sign(dx), y: 0};
                else this.lastDir = {x: 0, y: Math.sign(dy)};
            }
            
            if (state.keys[keyBindings.BOMB]) { this.plantBomb(); state.keys[keyBindings.BOMB] = false; } 
            
            const size = TILE_SIZE * 0.85; 
            const offset = (TILE_SIZE - size) / 2;

            const check = (x, y) => {
                const gx = Math.floor(x / TILE_SIZE);
                const gy = Math.floor(y / TILE_SIZE);
                if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
                if (state.grid[gy][gx] === TYPES.WALL_HARD || state.grid[gy][gx] === TYPES.WALL_SOFT) return true;
                const bomb = state.bombs.find(b => b.gx === gx && b.gy === gy);
                if (bomb && !bomb.walkableIds.includes(this.id)) return true;
                return false;
            };

            if (dx !== 0) {
                const nextX = this.x + dx;
                const xEdge = dx > 0 ? nextX + size + offset : nextX + offset;
                const topY = this.y + offset;
                const bottomY = this.y + size + offset;
                if (!check(xEdge, topY) && !check(xEdge, bottomY)) this.x = nextX;
                else if (check(xEdge, topY) && !check(xEdge, bottomY)) this.y += this.speed;
                else if (!check(xEdge, topY) && check(xEdge, bottomY)) this.y -= this.speed;
            }
            if (dy !== 0) {
                const nextY = this.y + dy;
                const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
                const leftX = this.x + offset;
                const rightX = this.x + size + offset;
                if (!check(leftX, yEdge) && !check(rightX, yEdge)) this.y = nextY;
                else if (check(leftX, yEdge) && !check(rightX, yEdge)) this.x += this.speed;
                else if (!check(leftX, yEdge) && check(rightX, yEdge)) this.x -= this.speed;
            }
            this.gridX = Math.round(this.x / TILE_SIZE);
            this.gridY = Math.round(this.y / TILE_SIZE);
        }

        this.checkItem();
    }

    updateBot(speed) {
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        const dangerMap = this.getDangerMap();
        const amInDanger = dangerMap[gy][gx];
        let targetDir = {x:0, y:0};

        if (amInDanger) {
            targetDir = this.findSafeMove(gx, gy, dangerMap);
        } else {
            const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
            const nearTarget = neighbors.some(d => {
                const tx = gx + d.x; const ty = gy + d.y;
                if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
                return state.grid[ty][tx] === TYPES.WALL_SOFT; 
            });

            if (nearTarget && Math.random() < 0.05 && this.activeBombs < this.maxBombs) {
                if (this.canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    this.plantBomb();
                    targetDir = this.findSafeMove(gx, gy, this.getDangerMap()); 
                }
            }

            if (targetDir.x === 0 && targetDir.y === 0) {
                if (this.changeDirTimer <= 0 || isSolid(Math.round((this.x + this.botDir.x*20)/TILE_SIZE), Math.round((this.y + this.botDir.y*20)/TILE_SIZE))) {
                    const safeNeighbors = neighbors.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx];
                    });
                    
                    if (safeNeighbors.length > 0) {
                        const itemMove = safeNeighbors.find(d => state.items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else {
                        targetDir = {x:0, y:0};
                    }
                    this.changeDirTimer = 15 + Math.random() * 30;
                } else {
                    targetDir = this.botDir;
                }
            }
        }

        if (targetDir.x !== 0 || targetDir.y !== 0) {
            this.botDir = targetDir;
            if (this.botDir.x !== 0) this.botDir.y = 0;
            this.lastDir = { x: Math.sign(this.botDir.x), y: Math.sign(this.botDir.y) };
        }
        this.move(this.botDir.x * speed, this.botDir.y * speed);
        this.changeDirTimer--;
    }

    getDangerMap() {
        const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
        state.particles.forEach(p => { if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; });
        state.bombs.forEach(b => {
            const isBoost = state.currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
            const range = isBoost ? 15 : b.range;
            map[b.gy][b.gx] = true; 
            const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
            dirs.forEach(d => {
                for (let i = 1; i <= range; i++) {
                    const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                    if (state.grid[ty][tx] === TYPES.WALL_HARD) break;
                    map[ty][tx] = true;
                    if (state.grid[ty][tx] === TYPES.WALL_SOFT) break; 
                }
            });
        });
        if (state.currentLevel.hasCentralFire && state.hellFirePhase !== 'IDLE') {
            const range = 5; const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
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

    findSafeMove(gx, gy, dangerMap) {
        const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
        const visited = new Set();
        visited.add(gx + "," + gy);
        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        
        let ops = 0;
        while (queue.length > 0) {
            ops++;
            if (ops > 500) break; 
            
            const current = queue.shift();
            if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
            if (current.dist > 10) continue;
            for (let d of dirs) {
                const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
                if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                    const isBlocked = isSolid(nx, ny);
                    if (!isBlocked) {
                        visited.add(key);
                        queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                    }
                }
            }
        }
        return dirs[Math.floor(Math.random()*dirs.length)];
    }

    canEscapeAfterPlanting(gx, gy, currentDangerMap) {
        const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        const openNeighbors = neighbors.filter(d => {
            const nx = gx+d.x; const ny = gy+d.y;
            return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
        });
        return openNeighbors.length > 0;
    }

    move(dx, dy) {
        const size = TILE_SIZE * 0.85; 
        const offset = (TILE_SIZE - size) / 2;
        const check = (x, y) => {
            const gx = Math.floor(x / TILE_SIZE);
            const gy = Math.floor(y / TILE_SIZE);
            if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
            if (state.grid[gy][gx] === TYPES.WALL_HARD || state.grid[gy][gx] === TYPES.WALL_SOFT) return true;
            const bomb = state.bombs.find(b => b.gx === gx && b.gy === gy);
            if (bomb && !bomb.walkableIds.includes(this.id)) return true;
            return false;
        };
        if (dx !== 0) {
            const nextX = this.x + dx;
            const xEdge = dx > 0 ? nextX + size + offset : nextX + offset;
            const topY = this.y + offset;
            const bottomY = this.y + size + offset;
            if (!check(xEdge, topY) && !check(xEdge, bottomY)) this.x = nextX;
        }
        if (dy !== 0) {
            const nextY = this.y + dy;
            const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
            const leftX = this.x + offset;
            const rightX = this.x + size + offset;
            if (!check(leftX, yEdge) && !check(rightX, yEdge)) this.y = nextY;
        }
        this.gridX = Math.round(this.x / TILE_SIZE);
        this.gridY = Math.round(this.y / TILE_SIZE);
    }

    cycleBombType() {
        const modes = [BOMB_MODES.STANDARD];
        if (this.hasNapalm) modes.push(BOMB_MODES.NAPALM);
        if (this.hasRolling) modes.push(BOMB_MODES.ROLLING);
        let idx = modes.indexOf(this.currentBombMode);
        if (idx === -1) idx = 0;
        this.currentBombMode = modes[(idx + 1) % modes.length];
        this.updateHud();
    }

    updateHud() {
        if (this.id !== 1) return;
        const el = document.getElementById('bomb-type');
        switch(this.currentBombMode) {
            case BOMB_MODES.STANDARD: el.innerText = '⚫'; break;
            case BOMB_MODES.NAPALM: el.innerText = '☢️'; break;
            case BOMB_MODES.ROLLING: el.innerText = '🎳'; break;
        }
        const elBombs = document.getElementById('hud-bombs');
        if (elBombs) elBombs.innerText = `💣 ${this.maxBombs}`;
        const elFire = document.getElementById('hud-fire');
        if (elFire) elFire.innerText = `🔥 ${this.bombRange}`;
    }

    plantBomb() {
        const rollingBomb = state.bombs.find(b => b.owner === this && b.isRolling);
        if (rollingBomb) {
            rollingBomb.isRolling = false;
            rollingBomb.gx = Math.round(rollingBomb.px / TILE_SIZE);
            rollingBomb.gy = Math.round(rollingBomb.py / TILE_SIZE);
            rollingBomb.px = rollingBomb.gx * TILE_SIZE;
            rollingBomb.py = rollingBomb.gy * TILE_SIZE;
            
            rollingBomb.underlyingTile = state.grid[rollingBomb.gy][rollingBomb.gx];
            
            state.grid[rollingBomb.gy][rollingBomb.gx] = TYPES.BOMB;
            return;
        }

        if (this.skullEffect === 'cant_plant') return;
        if (this.activeBombs >= this.maxBombs) return;
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        const tile = state.grid[gy][gx];

        let canPlant = (tile === TYPES.EMPTY);
        if (state.currentLevel.id === 'jungle') {
            if (tile === TYPES.WATER || tile === TYPES.BRIDGE) canPlant = true;
        }
        
        // --- NEU: Auf Ölfeldern darf auch gelegt werden ---
        if (tile === TYPES.OIL) canPlant = true;
        // -------------------------------------------------

        if (!canPlant) return; 

        let isRolling = (this.currentBombMode === BOMB_MODES.ROLLING);
        let isNapalm = (this.currentBombMode === BOMB_MODES.NAPALM);

        const bomb = {
            owner: this,
            gx: gx, gy: gy,
            px: gx * TILE_SIZE, py: gy * TILE_SIZE,
            timer: 200, 
            range: this.bombRange, 
            napalm: isNapalm,
            isRolling: isRolling,
            isBlue: isRolling, 
            underlyingTile: tile,
            walkableIds: state.players.filter(p => {
                const pGx = Math.round(p.x / TILE_SIZE);
                const pGy = Math.round(p.y / TILE_SIZE);
                return pGx === gx && pGy === gy;
            }).map(p => p.id)
        };

        if (isRolling) {
            bomb.rollDir = {...this.lastDir};
            bomb.rollSpeed = 4;
        } else {
            state.grid[gy][gx] = TYPES.BOMB;
        }
        state.bombs.push(bomb);
        this.activeBombs++;
    }

    checkItem() {
        const gx = Math.floor((this.x + TILE_SIZE/2) / TILE_SIZE);
        const gy = Math.floor((this.y + TILE_SIZE/2) / TILE_SIZE);
        if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            if (state.items[gy][gx] !== ITEMS.NONE) {
                this.applyItem(state.items[gy][gx]);
                state.items[gy][gx] = ITEMS.NONE;
            }
        }
    }

    applyItem(type) {
        switch(type) {
            case ITEMS.BOMB_UP: this.maxBombs++; createFloatingText(this.x, this.y, "+1 BOMB"); break;
            case ITEMS.RANGE_UP: this.bombRange++; createFloatingText(this.x, this.y, "FIRE UP"); break;
            case ITEMS.SPEED_UP: this.speed = Math.min(this.speed+1, 8); createFloatingText(this.x, this.y, "SPEED UP"); break;
            case ITEMS.NAPALM: this.hasNapalm = true; this.napalmTimer = 3600; createFloatingText(this.x, this.y, "NAPALM!", "#ff0000"); break;
            case ITEMS.ROLLING: this.hasRolling = true; this.rollingTimer = 3600; createFloatingText(this.x, this.y, "ROLLING!", "#ffffff"); break;
            case ITEMS.SKULL: 
                const effects = ['sickness', 'speed_rush', 'slow', 'cant_plant'];
                const effect = effects[Math.floor(Math.random()*effects.length)];
                this.skullEffect = effect; this.skullTimer = 600;
                createFloatingText(this.x, this.y, "CURSED: "+effect.toUpperCase(), '#ff00ff'); break;
        }
    }

    draw() {
        if (!this.alive && this.deathTimer <= 0) return; 
        
        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;
        
        ctx.save();
        
        if (!this.alive && this.deathTimer > 0) {
            const progress = 1 - (this.deathTimer / 90); 
            ctx.filter = `grayscale(100%) brightness(${Math.max(0, 0.5 - progress * 0.5)})`;
            ctx.globalAlpha = Math.max(0, 1 - progress);
        }

        const bob = Math.sin(this.bobTimer) * 2; 
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(this.x + TILE_SIZE/2, this.y + TILE_SIZE - 5, 10, 5, 0, 0, Math.PI*2); ctx.fill();
        drawCharacterSprite(ctx, this.x + TILE_SIZE/2, this.y + TILE_SIZE/2 + bob, this.charDef, !!this.skullEffect, this.lastDir);
        
        ctx.restore();
    }
}
