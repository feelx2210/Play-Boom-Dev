import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, LEVELS, CHARACTERS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, keyBindings } from './constants.js';
import { state } from './state.js';
import { createFloatingText, isSolid } from './utils.js';
import { draw, drawLevelPreview, drawCharacterSprite, clearLevelCache } from './graphics.js';
import { Player } from './player.js';
import { endGame, showMenu, handleMenuInput, togglePause } from './ui.js';
import { explodeBomb, triggerHellFire, killPlayer, spawnRandomIce } from './mechanics.js';
import { InputHandler } from './InputHandler.js'; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = GRID_W * TILE_SIZE;
canvas.height = GRID_H * TILE_SIZE;

let gameLoopId;

// NEU: Zentrale Input-Instanz
const input = new InputHandler();

// --- RESPONSIVE SCALING (SMART CROP) ---
function resizeGame() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const fullSize = GRID_W * TILE_SIZE; 
    const playableSize = (GRID_W - 2) * TILE_SIZE; 

    const scaleFull = Math.min((winW - 20) / fullSize, (winH - 20) / fullSize);
    const scaleCrop = Math.min(winW / playableSize, winH / playableSize);

    let finalScale = scaleFull;
    if (scaleFull < 1) finalScale = scaleCrop;

    container.style.transform = `scale(${finalScale})`;
}
window.addEventListener('resize', resizeGame);
resizeGame();

// --- SPIEL STARTEN ---
window.startGame = function() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden'); 
    
    // Controls sichtbar machen (InputHandler bindet Events automatisch)
    document.getElementById('mobile-controls').classList.remove('hidden');

    resizeGame(); 

    // NEU: Cache leeren & Inputs resetten
    clearLevelCache();
    input.reset();

    const userChar = CHARACTERS[state.selectedCharIndex];
    state.currentLevel = LEVELS[state.selectedLevelKey];
    
    const container = document.getElementById('game-container');
    container.style.boxShadow = `0 0 20px ${state.currentLevel.glow}`;
    container.style.borderColor = state.currentLevel.border;
    document.getElementById('p1-name').innerText = userChar.name.toUpperCase();

    // Reset State
    state.grid = []; 
    state.items = []; 
    state.bombs = []; 
    state.particles = []; 
    state.players = [];
    state.isGameOver = false; 
    state.isPaused = false;
    state.hellFireTimer = 0; 
    state.hellFirePhase = 'IDLE'; 
    state.hellFireActive = false; 
    state.iceTimer = 0; 
    state.iceSpawnCountdown = 1200; 

    // Level Generierung
    for (let y = 0; y < GRID_H; y++) {
        let row = []; let itemRow = [];
        for (let x = 0; x < GRID_W; x++) {
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) row.push(TYPES.WALL_HARD);
            else if (x % 2 === 0 && y % 2 === 0) row.push(TYPES.WALL_HARD);
            else if (state.currentLevel.id === 'jungle' && y === 7 && (x===3||x===7||x===11)) row.push(TYPES.BRIDGE);
            else if (state.currentLevel.id === 'jungle' && y === 7) row.push(TYPES.WATER);
            else if ((state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) row.push(TYPES.EMPTY);
            else if (DIRECTION_PADS.some(p => p.x === x && p.y === y)) row.push(TYPES.EMPTY);
            else if (Math.random() < 0.7) row.push(TYPES.WALL_SOFT);
            else row.push(TYPES.EMPTY);
            itemRow.push(ITEMS.NONE);
        }
        state.grid.push(row); state.items.push(itemRow);
    }

    if (state.currentLevel.id === 'hell') OIL_PADS.forEach(oil => { if(state.grid[oil.y][oil.x]!==TYPES.WALL_HARD) {state.grid[oil.y][oil.x]=TYPES.OIL; state.items[oil.y][oil.x]=ITEMS.NONE;} });
    const corners = [{x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1}, {x: GRID_W-2, y: 1}, {x: GRID_W-2, y: 2}, {x: GRID_W-3, y: 1}, {x: 1, y: GRID_H-2}, {x: 1, y: GRID_H-3}, {x: 2, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-2}, {x: GRID_W-3, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-3}];
    corners.forEach(p => state.grid[p.y][p.x] = TYPES.EMPTY);
    if (state.currentLevel.id === 'jungle') for(let x=1; x<GRID_W-1; x++) state.items[7][x] = ITEMS.NONE; 
    if (state.currentLevel.hasCentralFire) { state.grid[HELL_CENTER.y][HELL_CENTER.x] = TYPES.EMPTY; state.items[HELL_CENTER.y][HELL_CENTER.x] = ITEMS.NONE; }
    
    distributeItems();

    state.players.push(new Player(1, 1, 1, userChar, false));
    const availableChars = CHARACTERS.filter(c => c.id !== userChar.id);
    state.players.push(new Player(2, GRID_W-2, GRID_H-2, availableChars[0] || CHARACTERS[1], true));
    state.players.push(new Player(3, GRID_W-2, 1, availableChars[1] || CHARACTERS[2], true));
    state.players.push(new Player(4, 1, GRID_H-2, availableChars[2] || CHARACTERS[3], true));

    document.getElementById('bomb-type').innerText = '⚫';
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
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

// Global Listener (für Menü & Pause & Debug)
window.addEventListener('keydown', e => {
    // Menü Steuerung
    if (!document.getElementById('main-menu').classList.contains('hidden')) { 
        handleMenuInput(e.code); 
        return; 
    }
    // Pause / Globales
    if (e.key.toLowerCase() === 'p' || e.code === 'Escape') togglePause();
    
    // Fallback: Bomben-Wechsel via Keyboard (Optional, könnte auch in InputHandler)
    if (e.code === keyBindings.CHANGE && state.players[0]) state.players[0].cycleBombType();
});

function update() {
    if (state.isGameOver) return;
    
    state.players.forEach(p => p.inFire = false);
    
    // Hell Fire
    if (state.currentLevel.hasCentralFire) {
        if (!state.hellFireActive) { if (state.particles.some(p => p.isFire && p.gx === HELL_CENTER.x && p.gy === HELL_CENTER.y)) { state.hellFireActive = true; state.hellFirePhase = 'WARNING'; state.hellFireTimer = 0; createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "ACTIVATED!", "#ff0000"); } } 
        else { state.hellFireTimer++; if (state.hellFirePhase === 'IDLE' && state.hellFireTimer >= 2200) { state.hellFireTimer = 0; state.hellFirePhase = 'WARNING'; createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "!", "#ff0000"); } else if (state.hellFirePhase === 'WARNING' && state.hellFireTimer >= 225) { state.hellFireTimer = 0; state.hellFirePhase = 'IDLE'; triggerHellFire(); } }
    }
    
    // Ice Spawn
    if (state.currentLevel.id === 'ice') { state.iceTimer++; if (state.iceTimer > 1200) { state.iceSpawnCountdown--; if (state.iceSpawnCountdown <= 0) { spawnRandomIce(); spawnRandomIce(); state.iceSpawnCountdown = 1200; } } }
    
    // Bombs
    for (let i = state.bombs.length - 1; i >= 0; i--) {
        let b = state.bombs[i]; b.timer--;
        if (b.isRolling) {
            const dirPad = DIRECTION_PADS.find(p => p.x === b.gx && p.y === b.gy);
            if (dirPad && (b.rollDir.x !== dirPad.dir.x || b.rollDir.y !== dirPad.dir.y)) {
                const centerX = b.gx * TILE_SIZE; const centerY = b.gy * TILE_SIZE;
                if ((b.px - centerX) ** 2 + (b.py - centerY) ** 2 < 25) { b.px = centerX; b.py = centerY; b.rollDir = dirPad.dir; }
            }
            b.px += b.rollDir.x * b.rollSpeed; b.py += b.rollDir.y * b.rollSpeed;
            const nextGx = Math.floor((b.px + TILE_SIZE/2) / TILE_SIZE); const nextGy = Math.floor((b.py + TILE_SIZE/2) / TILE_SIZE);
            if (state.particles.some(p => p.isFire && p.gx === nextGx && p.gy === nextGy)) { b.isRolling = false; b.gx = nextGx; b.gy = nextGy; b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; b.timer = 0; }
            else {
                let collision = false;
                if (nextGx < 0 || nextGx >= GRID_W || nextGy < 0 || nextGy >= GRID_H) collision = true;
                else if (state.grid[nextGy][nextGx] === TYPES.WALL_HARD || state.grid[nextGy][nextGx] === TYPES.WALL_SOFT || state.grid[nextGy][nextGx] === TYPES.BOMB) collision = true;
                if (!collision) { const bRect = { l: b.px, r: b.px + TILE_SIZE, t: b.py, b: b.py + TILE_SIZE }; const hitPlayer = state.players.find(p => { if (!p.alive) return false; if (b.walkableIds.includes(p.id)) return false; const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; const pRect = { l: p.x + offset, r: p.x + size + offset, t: p.y + offset, b: p.y + size + offset }; return (bRect.l < pRect.r && bRect.r > pRect.l && bRect.t < pRect.b && bRect.b > pRect.t); }); if (hitPlayer) collision = true; }
                if (collision) { b.isRolling = false; b.gx = Math.round(b.px / TILE_SIZE); b.gy = Math.round(b.py / TILE_SIZE); let occupied = state.players.some(p => { if (!p.alive) return false; const pGx = Math.round(p.x / TILE_SIZE); const pGy = Math.round(p.y / TILE_SIZE); return pGx === b.gx && pGy === b.gy && !b.walkableIds.includes(p.id); }); if (state.grid[b.gy][b.gx] !== TYPES.EMPTY && state.grid[b.gy][b.gx] !== TYPES.OIL && state.grid[b.gy][b.gx] !== TYPES.WATER && state.grid[b.gy][b.gx] !== TYPES.BRIDGE) { b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; } else if (occupied) { b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; } b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; b.underlyingTile = state.grid[b.gy][b.gx]; state.grid[b.gy][b.gx] = TYPES.BOMB; } else { b.gx = nextGx; b.gy = nextGy; }
            }
        }
        b.walkableIds = b.walkableIds.filter(pid => { const p = state.players.find(pl => pl.id === pid); if (!p) return false; const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; const pLeft = p.x + offset; const pRight = pLeft + size; const pTop = p.y + offset; const pBottom = pTop + size; const bLeft = b.px; const bRight = bLeft + TILE_SIZE; const bTop = b.py; const bBottom = bTop + TILE_SIZE; return (pLeft < bRight && pRight > bLeft && pTop < bBottom && pBottom > bTop); });
        if (b.timer <= 0) { explodeBomb(b); state.bombs.splice(i, 1); }
    }
    
    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; p.life--; if (p.text) p.y += p.vy;
        if (p.isFire) {
            const fireX = p.gx * TILE_SIZE; const fireY = p.gy * TILE_SIZE; const tolerance = 6; const fkLeft = fireX + tolerance; const fkRight = fireX + TILE_SIZE - tolerance; const fkTop = fireY + tolerance; const fkBottom = fireY + TILE_SIZE - tolerance;
            state.players.forEach(pl => { if (!pl.alive) return; const hurtSize = 24; const pCx = pl.x + TILE_SIZE/2; const pCy = pl.y + TILE_SIZE/2; const plLeft = pCx - hurtSize/2; const plRight = pCx + hurtSize/2; const plTop = pCy - hurtSize/2; const plBottom = pCy + hurtSize/2; if (plLeft < fkRight && plRight > fkLeft && plTop < fkBottom && plBottom > fkTop) pl.inFire = true; });
            const hitBombIndex = state.bombs.findIndex(b => b.gx === p.gx && b.gy === p.gy); if (hitBombIndex !== -1) { const chainedBomb = state.bombs[hitBombIndex]; if (chainedBomb.timer > 1) { if(chainedBomb.isRolling) { chainedBomb.isRolling = false; chainedBomb.px = chainedBomb.gx * TILE_SIZE; chainedBomb.py = chainedBomb.gy * TILE_SIZE; chainedBomb.underlyingTile = state.grid[chainedBomb.gy][chainedBomb.gx]; } chainedBomb.timer = 0; } }
        }
        if (p.type === 'freezing' && p.life <= 0) { state.grid[p.gy][p.gx] = TYPES.WALL_SOFT; if (Math.random() < 0.3) { const itemPool = [ITEMS.BOMB_UP, ITEMS.BOMB_UP, ITEMS.BOMB_UP, ITEMS.RANGE_UP, ITEMS.RANGE_UP, ITEMS.RANGE_UP, ITEMS.SPEED_UP, ITEMS.SPEED_UP, ITEMS.SKULL, ITEMS.ROLLING, ITEMS.NAPALM]; state.items[p.gy][p.gx] = itemPool[Math.floor(Math.random() * itemPool.length)]; } }
        if (p.life <= 0) state.particles.splice(i, 1);
    }
    
    // Players (mit neuem Input Handler)
    state.players.forEach(p => { 
        if (p.inFire) { p.fireTimer++; if (p.fireTimer >= 30) { killPlayer(p); p.fireTimer = 0; } } else p.fireTimer = 0; 
    });
    
    let aliveCount = 0; let livingPlayers = []; 
    // NEU: Input durchreichen
    state.players.forEach(p => { p.update(input); if (p.alive) { aliveCount++; livingPlayers.push(p); } });

    // Infection
    for (let i = 0; i < livingPlayers.length; i++) {
        for (let j = i + 1; j < livingPlayers.length; j++) {
            const p1 = livingPlayers[i]; const p2 = livingPlayers[j]; const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < TILE_SIZE * 0.8) {
                if (p1.activeCurses.length > 0 && p2.activeCurses.length === 0) { p1.activeCurses.forEach(c => p2.addCurse(c.type)); createFloatingText(p2.x, p2.y, "INFECTED!", "#ff00ff"); }
                else if (p2.activeCurses.length > 0 && p1.activeCurses.length === 0) { p2.activeCurses.forEach(c => p1.addCurse(c.type)); createFloatingText(p1.x, p1.y, "INFECTED!", "#ff00ff"); }
            }
        }
    }
    if (state.players.length > 1 && aliveCount <= 1) { const winner = livingPlayers.length > 0 ? livingPlayers[0] : null; endGame(winner ? winner.name + " WINS!" : "DRAW!", winner); }
}

function gameLoop() {
    if (!document.getElementById('main-menu').classList.contains('hidden')) { } 
    else if (!state.isPaused) { try { update(); draw(ctx, canvas); } catch (error) { console.error("Game Crashed:", error); state.isPaused = true; alert("Game Crashed! Check Console for details.\n" + error.message); } }
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Initial Menu Start
showMenu();