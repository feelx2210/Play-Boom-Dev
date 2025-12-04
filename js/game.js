import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, LEVELS, CHARACTERS, BOOST_PADS, HELL_CENTER, keyBindings } from './constants.js';
import { state } from './state.js';
import { createFloatingText, isSolid } from './utils.js';
import { draw, drawLevelPreview, drawCharacterSprite } from './graphics.js';
import { Player } from './player.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GRID_W * TILE_SIZE;
canvas.height = GRID_H * TILE_SIZE;

let gameLoopId;

// --- MENU LOGIC ---
function initMenu() {
    const charContainer = document.getElementById('char-select');
    charContainer.innerHTML = '';
    const levelContainer = document.getElementById('level-select');
    levelContainer.innerHTML = '';
    
    // Setup Active Classes
    if (state.menuState === 0) {
        charContainer.classList.add('active-group'); charContainer.classList.remove('inactive-group');
        levelContainer.classList.add('inactive-group'); levelContainer.classList.remove('active-group');
        document.getElementById('start-game-btn').classList.remove('focused');
    } else if (state.menuState === 1) {
        charContainer.classList.add('inactive-group'); charContainer.classList.remove('active-group');
        levelContainer.classList.add('active-group'); levelContainer.classList.remove('inactive-group');
        document.getElementById('start-game-btn').classList.remove('focused');
    } else if (state.menuState === 2) {
        charContainer.classList.add('inactive-group'); levelContainer.classList.add('inactive-group');
        document.getElementById('start-game-btn').classList.add('focused');
    }

    CHARACTERS.forEach((char, index) => {
        const div = document.createElement('div');
        div.className = `option-card ${index === state.selectedCharIndex ? 'selected' : ''}`;
        div.onclick = () => { state.menuState = 0; state.selectedCharIndex = index; initMenu(); };
        const pCanvas = document.createElement('canvas'); pCanvas.width=48; pCanvas.height=48; pCanvas.className='preview-canvas';
        drawCharacterSprite(pCanvas.getContext('2d'), 24, 36, char);
        div.appendChild(pCanvas);
        const label = document.createElement('div'); label.className = 'card-label'; label.innerText = char.name;
        div.appendChild(label);
        charContainer.appendChild(div);
    });

    Object.keys(LEVELS).forEach((key) => {
        const lvl = LEVELS[key];
        const div = document.createElement('div');
        const isSelected = key === state.selectedLevelKey;
        div.className = `option-card ${isSelected ? 'selected' : ''}`;
        div.onclick = () => { state.menuState = 1; state.selectedLevelKey = key; initMenu(); };
        const lCanvas = document.createElement('canvas'); lCanvas.width=48; lCanvas.height=48; lCanvas.className='preview-canvas';
        drawLevelPreview(lCanvas.getContext('2d'), 48, 48, lvl);
        div.appendChild(lCanvas);
        const label = document.createElement('div'); label.className = 'card-label'; label.innerText = lvl.name;
        div.appendChild(label);
        levelContainer.appendChild(div);
    });
}

// Global functions for HTML access
window.startGame = function() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden'); 

    const userChar = CHARACTERS[state.selectedCharIndex];
    state.currentLevel = LEVELS[state.selectedLevelKey];
    
    const container = document.getElementById('game-container');
    container.style.boxShadow = `0 0 20px ${state.currentLevel.glow}`;
    container.style.borderColor = state.currentLevel.border;
    document.getElementById('p1-name').innerText = userChar.name.toUpperCase();

    // Reset State
    state.grid = []; state.items = []; state.bombs = []; state.particles = []; state.players = [];
    state.isGameOver = false; state.isPaused = false;
    state.hellFireTimer = 0; state.hellFirePhase = 'IDLE'; state.hellFireActive = false;

    for (let y = 0; y < GRID_H; y++) {
        let row = []; let itemRow = [];
        for (let x = 0; x < GRID_W; x++) {
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) row.push(TYPES.WALL_HARD);
            else if (state.currentLevel.id === 'jungle' && y === 7 && (x === 3 || x === 7 || x === 11)) row.push(TYPES.BRIDGE);
            else if (state.currentLevel.id === 'jungle' && y === 7) row.push(TYPES.WATER);
            else if (x % 2 === 0 && y % 2 === 0) row.push(TYPES.WALL_HARD);
            else if (state.currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === x && p.y === y)) row.push(TYPES.EMPTY); 
            else if (Math.random() < 0.7) row.push(TYPES.WALL_SOFT);
            else row.push(TYPES.EMPTY);
            itemRow.push(ITEMS.NONE);
        }
        state.grid.push(row); state.items.push(itemRow);
    }
    const corners = [{x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1}, {x: GRID_W-2, y: 1}, {x: GRID_W-2, y: 2}, {x: GRID_W-3, y: 1}, {x: 1, y: GRID_H-2}, {x: 1, y: GRID_H-3}, {x: 2, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-2}, {x: GRID_W-3, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-3}];
    if (state.currentLevel.id === 'jungle') for(let x=1; x<GRID_W-1; x++) state.items[7][x] = ITEMS.NONE; 
    corners.forEach(p => state.grid[p.y][p.x] = TYPES.EMPTY);
    if (state.currentLevel.hasCentralFire) { state.grid[HELL_CENTER.y][HELL_CENTER.x] = TYPES.EMPTY; state.items[HELL_CENTER.y][HELL_CENTER.x] = ITEMS.NONE; }

    distributeItems();

    state.players.push(new Player(1, 1, 1, userChar, false));
    const availableChars = CHARACTERS.filter(c => c.id !== userChar.id);
    state.players.push(new Player(2, GRID_W-2, GRID_H-2, availableChars[0] || CHARACTERS[1], true));
    state.players.push(new Player(3, GRID_W-2, 1, availableChars[1] || CHARACTERS[2], true));
    state.players.push(new Player(4, 1, GRID_H-2, availableChars[2] || CHARACTERS[3], true));

    document.getElementById('bomb-type').innerText = '⚫';
    gameLoopId = requestAnimationFrame(gameLoop);
};

function distributeItems() {
    let softWalls = [];
    for(let y=0; y<GRID_H; y++) for(let x=0; x<GRID_W; x++) if (state.grid[y][x] === TYPES.WALL_SOFT) softWalls.push({x,y});
    softWalls.sort(() => Math.random() - 0.5);
    const itemCounts = [ {type: ITEMS.BOMB_UP, count: 8}, {type: ITEMS.RANGE_UP, count: 8}, {type: ITEMS.SPEED_UP, count: 4}, {type: ITEMS.NAPALM, count: 2}, {type: ITEMS.ROLLING, count: 3}, {type: ITEMS.SKULL, count: 4} ];
    let idx = 0;
    itemCounts.forEach(def => {
        for(let i=0; i<def.count; i++) if (idx < softWalls.length) { state.items[softWalls[idx].y][softWalls[idx].x] = def.type; idx++; }
    });
}

window.togglePause = function() {
    if (state.isGameOver || !document.getElementById('main-menu').classList.contains('hidden')) return;
    state.isPaused = !state.isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !state.isPaused);
};

window.quitGame = function() {
    state.isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    window.showMenu();
};

window.showMenu = function() {
    cancelAnimationFrame(gameLoopId);
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    state.menuState = 0;
    initMenu();
};

// ... Input Event Listeners ...
window.addEventListener('keydown', e => {
    if (!document.getElementById('main-menu').classList.contains('hidden')) {
        const levelKeys = Object.keys(LEVELS);
        const currentLevelIndex = levelKeys.indexOf(state.selectedLevelKey);
        if (state.menuState === 0) {
            if (e.code === 'ArrowLeft') { state.selectedCharIndex = (state.selectedCharIndex - 1 + CHARACTERS.length) % CHARACTERS.length; initMenu(); }
            else if (e.code === 'ArrowRight') { state.selectedCharIndex = (state.selectedCharIndex + 1) % CHARACTERS.length; initMenu(); }
            else if (e.code === 'Enter' || e.code === 'Space') { state.menuState = 1; initMenu(); }
        } else if (state.menuState === 1) {
            if (e.code === 'ArrowLeft') { state.selectedLevelKey = levelKeys[(currentLevelIndex - 1 + levelKeys.length) % levelKeys.length]; initMenu(); }
            else if (e.code === 'ArrowRight') { state.selectedLevelKey = levelKeys[(currentLevelIndex + 1) % levelKeys.length]; initMenu(); }
            else if (e.code === 'Enter' || e.code === 'Space') { state.menuState = 2; initMenu(); }
        } else if (state.menuState === 2) {
            if (e.code === 'Enter' || e.code === 'Space') window.startGame();
            else if (e.code === 'ArrowUp') { state.menuState = 1; initMenu(); }
        }
        return;
    }
    state.keys[e.code] = true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (e.code === keyBindings.CHANGE && state.players[0]) state.players[0].cycleBombType();
    if (e.key.toLowerCase() === 'p') window.togglePause();
});
window.addEventListener('keyup', e => { state.keys[e.code] = false; });

// --- GAME LOGIC ---

function update() {
    if (state.isGameOver) return;
    state.players.forEach(p => p.inFire = false);

    // Hellfire Logic
    if (state.currentLevel.hasCentralFire) {
        if (!state.hellFireActive) {
            if (state.particles.some(p => p.isFire && p.gx === HELL_CENTER.x && p.gy === HELL_CENTER.y)) {
                state.hellFireActive = true; state.hellFirePhase = 'WARNING'; state.hellFireTimer = 0;
                createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "ACTIVATED!", "#ff0000");
            }
        } else {
            state.hellFireTimer++;
            if (state.hellFirePhase === 'IDLE' && state.hellFireTimer >= 1800) { state.hellFireTimer = 0; state.hellFirePhase = 'WARNING'; createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "!", "#ff0000"); }
            else if (state.hellFirePhase === 'WARNING' && state.hellFireTimer >= 180) { state.hellFireTimer = 0; state.hellFirePhase = 'IDLE'; triggerHellFire(); }
        }
    }

    // Bombs
    for (let i = state.bombs.length - 1; i >= 0; i--) {
        let b = state.bombs[i]; b.timer--;
        if (b.isRolling) {
            b.px += b.rollDir.x * b.rollSpeed; b.py += b.rollDir.y * b.rollSpeed;
            const nextGx = Math.floor((b.px + TILE_SIZE/2) / TILE_SIZE);
            const nextGy = Math.floor((b.py + TILE_SIZE/2) / TILE_SIZE);
            const hitFire = state.particles.some(p => p.isFire && p.gx === nextGx && p.gy === nextGy);
            if (hitFire) { b.isRolling = false; b.gx = nextGx; b.gy = nextGy; b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; b.timer = 0; }
            else {
                let collision = false;
                if (nextGx < 0 || nextGx >= GRID_W || nextGy < 0 || nextGy >= GRID_H) collision = true;
                else if (state.grid[nextGy][nextGx] === TYPES.WALL_HARD || state.grid[nextGy][nextGx] === TYPES.WALL_SOFT || state.grid[nextGy][nextGx] === TYPES.BOMB) collision = true;
                if (!collision) {
                     const bRect = { l: b.px, r: b.px + TILE_SIZE, t: b.py, b: b.py + TILE_SIZE };
                     const hitPlayer = state.players.find(p => { if (!p.alive) return false; if (b.walkableIds.includes(p.id)) return false; const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; const pRect = { l: p.x + offset, r: p.x + size + offset, t: p.y + offset, b: p.y + size + offset }; return (bRect.l < pRect.r && bRect.r > pRect.l && bRect.t < pRect.b && bRect.b > pRect.t); });
                     if (hitPlayer) collision = true;
                }
                if (collision) {
                    b.isRolling = false; b.gx = Math.round(b.px / TILE_SIZE); b.gy = Math.round(b.py / TILE_SIZE);
                    let occupied = state.players.some(p => { if (!p.alive) return false; const pGx = Math.round(p.x / TILE_SIZE); const pGy = Math.round(p.y / TILE_SIZE); return pGx === b.gx && pGy === b.gy && !b.walkableIds.includes(p.id); });
                    if (isSolid(b.gx, b.gy) || occupied) { b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; }
                    b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; state.grid[b.gy][b.gx] = TYPES.BOMB;
                } else { b.gx = nextGx; b.gy = nextGy; }
            }
        }
        b.walkableIds = b.walkableIds.filter(pid => { const p = state.players.find(pl => pl.id === pid); if (!p) return false; const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; const pLeft = p.x + offset; const pRight = pLeft + size; const pTop = p.y + offset; const pBottom = pTop + size; const bLeft = b.px; const bRight = bLeft + TILE_SIZE; const bTop = b.py; const bBottom = bTop + TILE_SIZE; return (pLeft < bRight && pRight > bLeft && pTop < bBottom && pBottom > bTop); });
        if (b.timer <= 0) { explodeBomb(b); state.bombs.splice(i, 1); }
    }

    // Particles / Fire
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; p.life--;
        if (p.text) p.y += p.vy;
        if (p.isFire) {
            const fireX = p.gx * TILE_SIZE; const fireY = p.gy * TILE_SIZE;
            const tolerance = 6; const fkLeft = fireX + tolerance; const fkRight = fireX + TILE_SIZE - tolerance; const fkTop = fireY + tolerance; const fkBottom = fireY + TILE_SIZE - tolerance;
            state.players.forEach(pl => {
                if (!pl.alive) return;
                const hurtSize = 24; const pCx = pl.x + TILE_SIZE/2; const pCy = pl.y + TILE_SIZE/2;
                const plLeft = pCx - hurtSize/2; const plRight = pCx + hurtSize/2; const plTop = pCy - hurtSize/2; const plBottom = pCy + hurtSize/2;
                if (plLeft < fkRight && plRight > fkLeft && plTop < fkBottom && plBottom > fkTop) pl.inFire = true;
            });
            const hitBombIndex = state.bombs.findIndex(b => b.gx === p.gx && b.gy === p.gy);
            if (hitBombIndex !== -1) { const chainedBomb = state.bombs[hitBombIndex]; if (chainedBomb.timer > 1) { if(chainedBomb.isRolling) { chainedBomb.isRolling = false; chainedBomb.px = chainedBomb.gx * TILE_SIZE; chainedBomb.py = chainedBomb.gy * TILE_SIZE; } chainedBomb.timer = 0; } }
        }
        if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Player Damage
    state.players.forEach(p => { if (p.inFire) { p.fireTimer++; if (p.fireTimer >= 12) { killPlayer(p); p.fireTimer = 0; } } else p.fireTimer = 0; });

    // Updates
    let aliveCount = 0; let livingPlayers = [];
    state.players.forEach(p => { p.update(); if (p.alive) { aliveCount++; livingPlayers.push(p); } });

    // Infection
    for (let i = 0; i < livingPlayers.length; i++) {
        for (let j = i + 1; j < livingPlayers.length; j++) {
            const p1 = livingPlayers[i]; const p2 = livingPlayers[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < TILE_SIZE * 0.8) {
                if (p1.skullEffect && !p2.skullEffect) { p2.skullEffect = p1.skullEffect; p2.skullTimer = 600; createFloatingText(p2.x, p2.y, "INFECTED!", "#ff00ff"); }
                else if (p2.skullEffect && !p1.skullEffect) { p1.skullEffect = p2.skullEffect; p1.skullTimer = 600; createFloatingText(p1.x, p1.y, "INFECTED!", "#ff00ff"); }
            }
        }
    }
    if (state.players.length > 1 && aliveCount <= 1) { const winner = livingPlayers.length > 0 ? livingPlayers[0] : null; endGame(winner ? winner.name + " WINS!" : "DRAW!"); }
}

function triggerHellFire() {
    const duration = 30; const range = 5; 
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { destroyWall(tx, ty); createFire(tx, ty, duration); break; } 
            else { destroyItem(tx, ty); createFire(tx, ty, duration); }
        }
    });
}

// --- HIER IST DIE GEÄNDERTE EXPLODE FUNKTION ---
function explodeBomb(b) {
    b.owner.activeBombs--; 
    // Grid wiederherstellen (Wasser, Brücke oder Leer)
    if (!b.isRolling) {
        state.grid[b.gy][b.gx] = (b.underlyingTile !== undefined) ? b.underlyingTile : TYPES.EMPTY;
    }
    
    const isBoostPad = state.currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
    const range = isBoostPad ? 15 : b.range; 
    
    // Prüfen, ob die Bombe selbst auf Wasser liegt
    let centerNapalm = b.napalm;
    let centerDuration = b.napalm ? 600 : 30;
    if (b.underlyingTile === TYPES.WATER) {
        centerNapalm = false;
        centerDuration = 30;
    }

    destroyItem(b.gx, b.gy); 
    extinguishNapalm(b.gx, b.gy); 
    // Hier war der Tippfehler 'centerIsNapalm' -> 'centerNapalm'
    createFire(b.gx, b.gy, centerDuration, centerNapalm);
    
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = state.grid[ty][tx];
            
            // Prüfen, ob das Zielfeld Wasser ist -> Dann kein Napalm
            let tileNapalm = b.napalm;
            let tileDuration = b.napalm ? 600 : 30;
            if (tile === TYPES.WATER) {
                tileNapalm = false;
                tileDuration = 30;
            }

            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, tileDuration, tileNapalm); 
                break; 
            } else { 
                destroyItem(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, tileDuration, tileNapalm); 
            }
        }
    });
}
// -----------------------------------------------

function extinguishNapalm(gx, gy) { state.particles.forEach(p => { if (p.isFire && p.isNapalm && p.gx === gx && p.gy === gy) p.life = 0; }); }
function destroyItem(x, y) { if (state.items[y][x] !== ITEMS.NONE) { state.items[y][x] = ITEMS.NONE; createFloatingText(x * TILE_SIZE, y * TILE_SIZE, "ASHES", "#555555"); for(let i=0; i<5; i++) state.particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 30, color: '#333333', size: Math.random()*3 }); } }
function createFire(gx, gy, duration, isNapalm = false) { state.particles.push({ gx: gx, gy: gy, isFire: true, isNapalm: isNapalm, life: duration, color: duration > 60 ? '#ff4400' : '#ffaa00' }); }
function destroyWall(x, y) { state.grid[y][x] = TYPES.EMPTY; for(let i=0; i<5; i++) state.particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 20, color: '#882222', size: Math.random()*5 }); }
function killPlayer(p) { if (p.invincibleTimer > 0 || !p.alive) return; p.alive = false; createFloatingText(p.x, p.y, "ELIMINATED", "#ff0000"); for(let i=0; i<15; i++) state.particles.push({ x: p.x + 24, y: p.y + 24, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 60, color: p.color, size: 5 }); }
function endGame(msg) { if (state.isGameOver) return; state.isGameOver = true; setTimeout(() => { document.getElementById('go-message').innerText = msg; document.getElementById('game-over').classList.remove('hidden'); }, 3000); }

function gameLoop() {
    if (!document.getElementById('main-menu').classList.contains('hidden')) { } 
    else if (!state.isPaused) { update(); draw(ctx, canvas); }
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Start
window.showMenu();
