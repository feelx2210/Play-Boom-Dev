import { TILE_SIZE, GRID_W, GRID_H, TYPES, BOMB_MODES, ITEMS } from './constants.js';
import { state } from './state.js';
import { createFloatingText } from './utils.js';
import { drawCharacterSprite } from './graphics.js';
import { updateBotLogic } from './ai.js';
import { updateHud } from './ui.js';

// Globaler Canvas Context für Draw-Calls
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

export class Player {
    constructor(id, x, y, charDef, isBot = false) {
        this.id = id;
        this.charDef = charDef; 
        this.name = charDef.name;
        
        // Position
        this.startX = x * TILE_SIZE;
        this.startY = y * TILE_SIZE;
        this.x = this.startX; 
        this.y = this.startY;
        this.gridX = x; 
        this.gridY = y;
        
        // Status
        this.isBot = isBot;
        this.alive = true;
        this.invincibleTimer = 0;
        this.deathTimer = 0;
        
        // Stats
        this.speed = 2; 
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.bombRange = 1;
        
        // PowerUps
        this.hasNapalm = false; this.napalmTimer = 0;
        this.hasRolling = false; this.rollingTimer = 0;
        this.currentBombMode = BOMB_MODES.STANDARD;
        this.activeCurses = []; 

        // Animation / Movement
        this.lastDir = {x: 0, y: 1}; 
        this.bobTimer = 0;
        
        // Input Flags
        this.bombLock = false;   // Verhindert Dauerfeuer beim Gedrückthalten
        this.changeLock = false; // Verhindert schnelles Wechseln

        // Bot Stuff
        this.targetX = x; this.targetY = y; 
        this.changeDirTimer = 0; 
        this.botDir = {x:0, y:0};
    }

    addCurse(type) {
        if (type === 'speed_rush') this.activeCurses = this.activeCurses.filter(c => c.type !== 'slow');
        else if (type === 'slow') this.activeCurses = this.activeCurses.filter(c => c.type !== 'speed_rush');

        const existing = this.activeCurses.find(c => c.type === type);
        if (existing) existing.timer = 600;
        else this.activeCurses.push({ type: type, timer: 600 });
    }

    hasCurse(type) {
        return this.activeCurses.some(c => c.type === type);
    }

    // NEU: update() erhält das Input-Objekt aus game.js
    update(input) {
        if (!this.alive) {
            if (this.deathTimer > 0) this.deathTimer--;
            return;
        }

        if (this.id === 1) updateHud(this);
        this.bobTimer += 0.2;

        // --- TIMER UPDATE ---
        this.updateTimers();

        // --- MOVEMENT SPEED ---
        let currentSpeed = this.speed;
        if (this.hasCurse('speed_rush')) currentSpeed *= 2;
        else if (this.hasCurse('slow')) currentSpeed *= 0.5;

        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        if (state.grid[gy] && state.grid[gy][gx] === TYPES.WATER) currentSpeed *= 0.5;

        // --- INPUT / AI ---
        if (this.isBot) {
            updateBotLogic(this);
        } else if (input) {
            this.handleInput(input, currentSpeed);
        }

        this.checkItem();
    }

    updateTimers() {
        if (this.hasRolling && --this.rollingTimer <= 0) {
            this.hasRolling = false;
            if (this.currentBombMode === BOMB_MODES.ROLLING) this.currentBombMode = BOMB_MODES.STANDARD;
            createFloatingText(this.x, this.y, "ROLLING LOST", "#cccccc");
        }
        if (this.hasNapalm && --this.napalmTimer <= 0) {
            this.hasNapalm = false;
            if (this.currentBombMode === BOMB_MODES.NAPALM) this.currentBombMode = BOMB_MODES.STANDARD;
            createFloatingText(this.x, this.y, "NAPALM LOST", "#cccccc");
        }
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        // Curses
        if (this.activeCurses.length > 0) {
            this.activeCurses.forEach(c => c.timer--);
            const prevCount = this.activeCurses.length;
            this.activeCurses = this.activeCurses.filter(c => c.timer > 0);
            if (prevCount > 0 && this.activeCurses.length === 0) createFloatingText(this.x, this.y, "CURED!", "#00ff00");
            
            // Random Bomb Curse
            if (this.hasCurse('sickness') && Math.random() < 0.05) this.plantBomb();
        }
    }

    handleInput(input, speed) {
        let dx = 0, dy = 0;

        if (input.isDown('UP')) dy = -speed;
        if (input.isDown('DOWN')) dy = speed;
        if (input.isDown('LEFT')) dx = -speed;
        if (input.isDown('RIGHT')) dx = speed;
        
        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dx) > Math.abs(dy)) this.lastDir = {x: Math.sign(dx), y: 0};
            else this.lastDir = {x: 0, y: Math.sign(dy)};
            this.move(dx, dy);
        }

        // Bombe legen (mit Lock, damit man nicht aus Versehen spammt)
        if (input.isDown('BOMB')) {
            if (!this.bombLock) {
                this.plantBomb();
                this.bombLock = true;
            }
        } else {
            this.bombLock = false;
        }

        // Bomb Typ wechseln (Taste 'X' oder Button)
        if (input.isDown('CHANGE')) {
             if (!this.changeLock) {
                 this.cycleBombType();
                 this.changeLock = true;
             }
        } else {
            this.changeLock = false;
        }
    }

    move(dx, dy) {
        const size = TILE_SIZE * 0.85; 
        const offset = (TILE_SIZE - size) / 2;

        // Collision Check Helper
        const isBlocked = (x, y) => {
            const gx = Math.floor(x / TILE_SIZE);
            const gy = Math.floor(y / TILE_SIZE);
            if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
            
            // Wände blockieren
            if (state.grid[gy][gx] === TYPES.WALL_HARD || state.grid[gy][gx] === TYPES.WALL_SOFT) return true;
            
            // Bomben blockieren (außer man steht schon drauf/drin)
            const bomb = state.bombs.find(b => b.gx === gx && b.gy === gy);
            if (bomb && !bomb.walkableIds.includes(this.id)) return true;
            
            return false;
        };

        // X-Achse
        if (dx !== 0) {
            const nextX = this.x + dx;
            const xEdge = dx > 0 ? nextX + size + offset : nextX + offset;
            const topY = this.y + offset;
            const bottomY = this.y + size + offset;
            
            if (!isBlocked(xEdge, topY) && !isBlocked(xEdge, bottomY)) {
                this.x = nextX;
            } else {
                // Corner Sliding (Ecken-Rutschen)
                if (isBlocked(xEdge, topY) && !isBlocked(xEdge, bottomY)) this.y += this.speed; 
                else if (!isBlocked(xEdge, topY) && isBlocked(xEdge, bottomY)) this.y -= this.speed;
            }
        }

        // Y-Achse
        if (dy !== 0) {
            const nextY = this.y + dy;
            const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
            const leftX = this.x + offset;
            const rightX = this.x + size + offset;
            
            if (!isBlocked(leftX, yEdge) && !isBlocked(rightX, yEdge)) {
                this.y = nextY;
            } else {
                // Corner Sliding
                if (isBlocked(leftX, yEdge) && !isBlocked(rightX, yEdge)) this.x += this.speed;
                else if (!isBlocked(leftX, yEdge) && isBlocked(rightX, yEdge)) this.x -= this.speed;
            }
        }
        
        this.gridX = Math.round(this.x / TILE_SIZE);
        this.gridY = Math.round(this.y / TILE_SIZE);
    }

    cycleBombType() {
        const modes = [BOMB_MODES.STANDARD];
        if (this.hasNapalm) modes.push(BOMB_MODES.NAPALM);
        if (this.hasRolling) modes.push(BOMB_MODES.ROLLING);
        
        let idx = modes.indexOf(this.currentBombMode);
        this.currentBombMode = modes[(idx + 1) % modes.length];
    }

    plantBomb() {
        // Rollende Bombe stoppen?
        const rollingBomb = state.bombs.find(b => b.owner === this && b.isRolling);
        if (rollingBomb) {
            rollingBomb.isRolling = false;
            // Snap to Grid
            rollingBomb.gx = Math.round(rollingBomb.px / TILE_SIZE);
            rollingBomb.gy = Math.round(rollingBomb.py / TILE_SIZE);
            rollingBomb.px = rollingBomb.gx * TILE_SIZE;
            rollingBomb.py = rollingBomb.gy * TILE_SIZE;
            rollingBomb.underlyingTile = state.grid[rollingBomb.gy][rollingBomb.gx];
            state.grid[rollingBomb.gy][rollingBomb.gx] = TYPES.BOMB;
            return;
        }

        if (this.hasCurse('cant_plant')) return;
        if (this.activeBombs >= this.maxBombs) return;
        
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        const tile = state.grid[gy][gx];

        // Validierungs-Check: Darf hier eine Bombe hin?
        let canPlant = (tile === TYPES.EMPTY || tile === TYPES.OIL);
        if (state.currentLevel.id === 'jungle' && (tile === TYPES.WATER || tile === TYPES.BRIDGE)) canPlant = true;

        if (!canPlant) return; 

        let isRolling = (this.currentBombMode === BOMB_MODES.ROLLING);
        
        const bomb = {
            owner: this,
            gx: gx, gy: gy,
            px: gx * TILE_SIZE, py: gy * TILE_SIZE,
            timer: 200, 
            range: this.bombRange, 
            napalm: (this.currentBombMode === BOMB_MODES.NAPALM),
            isRolling: isRolling,
            isBlue: isRolling, 
            underlyingTile: tile,
            walkableIds: state.players.filter(p => {
                // Wer steht gerade drauf? Der darf noch weggehen.
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
        if (state.grid[gy] && state.items[gy]) {
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
                this.addCurse(effect);
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
        
        // Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(this.x + TILE_SIZE/2, this.y + TILE_SIZE - 5, 10, 5, 0, 0, Math.PI*2); ctx.fill();
        
        // Sprite
        drawCharacterSprite(ctx, this.x + TILE_SIZE/2, this.y + TILE_SIZE/2 + bob, this.charDef, this.activeCurses.length > 0, this.lastDir);
        ctx.restore();
    }
}