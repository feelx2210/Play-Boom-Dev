import { TILE_SIZE, GRID_W, GRID_H, TYPES, BOMB_MODES, ITEMS } from './constants.js';
import { state } from './state.js';
import { createFloatingText } from './utils.js';
import { drawCharacterSprite } from './char_sprites.js';
import { updateBotLogic } from './ai.js'; 

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
        this.gridX = x; 
        this.gridY = y;
        
        this.isBot = isBot;
        this.alive = true;
        this.invincibleTimer = 0;
        this.deathTimer = 0;
        
        this.speed = 2; 
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.bombRange = 1;
        
        this.speedMultiplier = 1; 
        this.speedTimer = 0;

        this.hasNapalm = false; this.napalmTimer = 0;
        this.hasRolling = false; this.rollingTimer = 0;
        this.currentBombMode = BOMB_MODES.STANDARD;
        
        this.activeCurses = []; 

        this.lastDir = {x: 0, y: 1}; 
        this.bobTimer = 0;
        
        this.bombLock = false;
        this.changeLock = false;

        // Bot Variablen
        this.targetX = x; this.targetY = y; 
        this.changeDirTimer = 0; 
        this.botDir = {x:0, y:0};
    }

    activateSpeedBoost(multiplier, duration, label) {
        // NEU: Im Sudden Death Modus Speed-Änderungen blockieren
        if (state.isSuddenDeath) return;

        if (this.hasCurse('slow')) {
            this.activeCurses = this.activeCurses.filter(c => c.type !== 'slow');
            createFloatingText(this.x, this.y, "NORMALIZED!", "#ffffff");
        }

        if (this.speedTimer > 0) {
            this.speedTimer += duration;
            createFloatingText(this.x, this.y, "EXTENDED!", "#ffff00");
        } else {
            this.speedMultiplier = multiplier;
            this.speedTimer = duration;
            createFloatingText(this.x, this.y, label, "#ffff00");
        }
    }

    addCurse(type) {
        if (type === 'speed_rush') {
            // NEU: Kein Speed-Curse im Sudden Death
            if (state.isSuddenDeath) return;
            
            this.activateSpeedBoost(2.5, 900, "SPEED CURSE!"); 
            return;
        }

        let showedText = false;

        if (type === 'slow') {
            if (this.speedTimer > 0) {
                this.speedTimer = 0;
                this.speedMultiplier = 1;
                createFloatingText(this.x, this.y, "SLOWED DOWN!", "#cccccc");
                showedText = true;
            }
        }

        const existing = this.activeCurses.find(c => c.type === type);
        if (existing) {
            existing.timer = 900; 
            if (!showedText) createFloatingText(this.x, this.y, "CURSE EXTENDED!", "#ff00ff");
        } else {
            this.activeCurses.push({ type: type, timer: 900 }); 
            if (!showedText) createFloatingText(this.x, this.y, "CURSED: " + type.toUpperCase(), "#ff00ff");
        }
    }

    hasCurse(type) {
        return this.activeCurses.some(c => c.type === type);
    }

    update(input) {
        if (!this.alive) {
            if (this.deathTimer > 0) this.deathTimer--;
            return;
        }

        if (this.id === 1 && window.updateHud) window.updateHud(this);
        
        this.bobTimer += 0.2;
        this.updateTimers();

        let currentSpeed = this.speed * this.speedMultiplier;
        
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        if (state.grid[gy] && state.grid[gy][gx] === TYPES.WATER) currentSpeed *= 0.5;
        
        if (this.hasCurse('slow')) currentSpeed *= 0.5;

        if (this.isBot) {
            updateBotLogic(this); 
        } else if (input) {
            this.handleInput(input, currentSpeed);
        }

        this.checkItem();
    }

    updateTimers() {
        // Im Sudden Death laufen Napalm/Rolling nicht ab (Timer sind riesig),
        // aber die Logik hier stört nicht.
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
        
        if (this.speedTimer > 0) {
            this.speedTimer--;
            if (this.speedTimer <= 0) {
                this.speedMultiplier = 1;
                createFloatingText(this.x, this.y, "SPEED NORMAL", "#cccccc");
            }
        }

        if (this.invincibleTimer > 0) this.invincibleTimer--;

        if (this.activeCurses.length > 0) {
            this.activeCurses.forEach(c => c.timer--);
            const prevCount = this.activeCurses.length;
            this.activeCurses = this.activeCurses.filter(c => c.timer > 0);
            if (prevCount > 0 && this.activeCurses.length === 0) createFloatingText(this.x, this.y, "CURED!", "#00ff00");
            
            if (this.hasCurse('sickness') && Math.random() < 0.05) this.plantBomb();
        }
    }

    handleInput(input, speed) {
        let dx = 0, dy = 0;

        // Keys basierend auf Spieler-ID
        const kUp = this.id === 1 ? 'P1_UP' : 'P2_UP';
        const kDown = this.id === 1 ? 'P1_DOWN' : 'P2_DOWN';
        const kLeft = this.id === 1 ? 'P1_LEFT' : 'P2_LEFT';
        const kRight = this.id === 1 ? 'P1_RIGHT' : 'P2_RIGHT';
        const kBomb = this.id === 1 ? 'P1_BOMB' : 'P2_BOMB';
        const kChange = this.id === 1 ? 'P1_CHANGE' : 'P2_CHANGE';

        if (input.isDown(kUp)) dy = -speed;
        if (input.isDown(kDown)) dy = speed;
        if (input.isDown(kLeft)) dx = -speed;
        if (input.isDown(kRight)) dx = speed;
        
        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dx) > Math.abs(dy)) this.lastDir = {x: Math.sign(dx), y: 0};
            else this.lastDir = {x: 0, y: Math.sign(dy)};
            this.move(dx, dy);
        }

        if (input.isDown(kBomb)) {
            if (!this.bombLock) {
                this.plantBomb();
                this.bombLock = true;
            }
        } else {
            this.bombLock = false;
        }

        // Bomb Switch (Change)
        if (input.isDown(kChange)) {
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

        const isBlocked = (x, y) => {
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
            if (!isBlocked(xEdge, topY) && !isBlocked(xEdge, bottomY)) {
                this.x = nextX;
            } else {
                if (isBlocked(xEdge, topY) && !isBlocked(xEdge, bottomY)) this.y += this.speed; 
                else if (!isBlocked(xEdge, topY) && isBlocked(xEdge, bottomY)) this.y -= this.speed;
            }
        }

        if (dy !== 0) {
            const nextY = this.y + dy;
            const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
            const leftX = this.x + offset;
            const rightX = this.x + size + offset;
            if (!isBlocked(leftX, yEdge) && !isBlocked(rightX, yEdge)) {
                this.y = nextY;
            } else {
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
        
        // Visuelles Feedback
        let modeName = "STANDARD";
        if (this.currentBombMode === BOMB_MODES.NAPALM) modeName = "NAPALM";
        if (this.currentBombMode === BOMB_MODES.ROLLING) modeName = "ROLLING";
        createFloatingText(this.x, this.y, modeName, "#ffffff");
    }

    plantBomb() {
        // Trigger rolling bombs if exist
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

        if (this.hasCurse('cant_plant')) return;
        if (this.activeBombs >= this.maxBombs) return;
        
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        const tile = state.grid[gy][gx];

        let canPlant = (tile === TYPES.EMPTY || tile === TYPES.OIL);
    // KORRIGIERTE ZEILE:
        if ((state.currentLevel.id === 'jungle' || state.currentLevel.id === 'beach') && (tile === TYPES.WATER || tile === TYPES.BRIDGE)) canPlant = true;

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
            case ITEMS.SPEED_UP: this.activateSpeedBoost(2, 1800, "SPEED UP"); break;
            
            case ITEMS.NAPALM: 
                this.hasNapalm = true; this.napalmTimer = 1800; 
                createFloatingText(this.x, this.y, "NAPALM!", "#ff0000"); 
                break;
            case ITEMS.ROLLING: 
                this.hasRolling = true; this.rollingTimer = 1800; 
                createFloatingText(this.x, this.y, "ROLLING!", "#ffffff"); 
                break;
                
            case ITEMS.SKULL: 
                const effects = ['sickness', 'speed_rush', 'slow', 'cant_plant'];
                const effect = effects[Math.floor(Math.random()*effects.length)];
                this.addCurse(effect);
                break;
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
        
        drawCharacterSprite(ctx, this.x + TILE_SIZE/2, this.y + TILE_SIZE/2 + bob, this.charDef, this.activeCurses.length > 0, this.lastDir);
        ctx.restore();
    }
}