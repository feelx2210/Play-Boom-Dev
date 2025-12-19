import { TILE_SIZE, GRID_W, GRID_H, LEVELS, CHARACTERS, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { draw, clearLevelCache } from './graphics.js';
import { Player } from './player.js';
import { endGame, showMenu, handleMenuInput, togglePause, showSuddenDeathMessage, updateHud } from './ui.js';
import { killPlayer, updateHellFire, updateIce, updateBombs, updateParticles, handleInfection } from './mechanics.js';
import { initLevel } from './level_gen.js'; 
import { InputHandler } from './InputHandler.js'; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = GRID_W * TILE_SIZE;
canvas.height = GRID_H * TILE_SIZE;

let gameLoopId;
const input = new InputHandler();

// --- RESPONSIVE SCALING ---
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
    const isMobile = winW < 800 || ('ontouchstart' in window);

    if (isMobile) {
        finalScale = scaleCrop;
        container.style.border = 'none';
        container.style.boxShadow = 'none';
        container.classList.add('mobile-zoomed');
    } else {
        if (scaleFull < 1) finalScale = scaleCrop;
        if (state.currentLevel) {
             container.style.border = `4px solid ${state.currentLevel.border}`;
             container.style.boxShadow = `0 0 20px ${state.currentLevel.glow}`;
        }
        container.classList.remove('mobile-zoomed');
    }
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
    document.getElementById('mobile-controls').classList.remove('hidden');

    state.gameStartTime = Date.now();
    if (window.umami) umami.track('Game Started');

    const userChar = CHARACTERS[state.selectedCharIndex];
    state.currentLevel = LEVELS[state.selectedLevelKey];

    // Styles
    const container = document.getElementById('game-container');
    container.style.boxShadow = `0 0 20px ${state.currentLevel.glow}`;
    container.style.borderColor = state.currentLevel.border;
    resizeGame(); 

    clearLevelCache();
    input.reset();

    document.getElementById('p1-name').innerText = userChar.name.toUpperCase();

    // Reset State
    state.bombs = []; 
    state.particles = []; 
    state.players = [];
    state.isGameOver = false; 
    state.isPaused = false;
    state.isSuddenDeath = false;
    
    state.hellFireTimer = 0; state.hellFirePhase = 'IDLE'; state.hellFireActive = false; 
    state.iceTimer = 0; state.iceSpawnCountdown = 1200; 

    // Level Generierung
    initLevel();

    // Spieler erstellen
    state.players.push(new Player(1, 1, 1, userChar, false));
    
    // --- BOT ZUWEISUNG (ZUFÄLLIG) ---
    let availableChars = CHARACTERS.filter(c => c.id !== userChar.id);
    availableChars.sort(() => Math.random() - 0.5);

    state.players.push(new Player(2, GRID_W-2, GRID_H-2, availableChars[0], true));
    state.players.push(new Player(3, GRID_W-2, 1, availableChars[1], true));
    state.players.push(new Player(4, 1, GRID_H-2, availableChars[2], true));

    document.getElementById('bomb-type').innerText = '⚫';
    
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameLoop);
};

// --- GLOBAL LISTENER ---
window.addEventListener('keydown', e => {
    if (!document.getElementById('main-menu').classList.contains('hidden')) { 
        handleMenuInput(e.code); 
        return; 
    }
    if (!document.getElementById('game-over').classList.contains('hidden')) {
        if (e.code === 'Enter' || e.code === 'Space') {
            showMenu();
        }
        return;
    }
    if (e.key.toLowerCase() === 'p' || e.code === 'Escape') togglePause();
});

// --- SUDDEN DEATH LOGIC (FIXED SPEED) ---
function triggerSuddenDeath(survivors) {
    state.isSuddenDeath = true;
    showSuddenDeathMessage();
    
    // Kurze Schock-Pause
    state.isPaused = true;
    setTimeout(() => {
        state.isPaused = false;
    }, 500);

    survivors.forEach(p => {
        // Visuelles Aufleuchten
        for(let i=0; i<20; i++) {
            state.particles.push({
                x: p.x + TILE_SIZE/2, 
                y: p.y + TILE_SIZE/2,
                vx: (Math.random()-0.5)*10,
                vy: (Math.random()-0.5)*10,
                life: 45,
                color: '#ffff00', 
                size: 4
            });
        }
        
        // Upgrade Stats
        p.speed = 4; // Basis-Speed auf 4 setzen (entspricht Normal 2 * SpeedUp 2)
        
        // WICHTIG: Bestehende Multiplikatoren entfernen!
        // Sonst würde ein aktiver Speed-Buff (x2) den Speed auf 8 verdoppeln.
        p.speedMultiplier = 1;
        p.speedTimer = 0; 
        
        p.bombRange = 12;    
        p.maxBombs = 10;
        
        // Skills permanent freischalten
        p.hasNapalm = true; p.napalmTimer = 999999;
        p.hasRolling = true; p.rollingTimer = 999999;
        
        if (!p.isBot) updateHud(p);
    });
}

// --- UPDATE LOOP ---
function update() {
    if (state.isGameOver) return;
    
    state.players.forEach(p => p.inFire = false);
    
    updateHellFire();
    updateIce();
    updateBombs();
    updateParticles();
    
    state.players.forEach(p => { 
        if (p.inFire) { 
            p.fireTimer++; 
            if (p.fireTimer >= 30) { killPlayer(p); p.fireTimer = 0; } 
        } else p.fireTimer = 0; 
    });
    
    let aliveCount = 0; let livingPlayers = []; 
    state.players.forEach(p => { 
        p.update(input); 
        if (p.alive) { aliveCount++; livingPlayers.push(p); } 
    });

    // CHECK SUDDEN DEATH
    if (state.players.length > 2 && aliveCount === 2 && !state.isSuddenDeath) {
        triggerSuddenDeath(livingPlayers);
    }

    handleInfection();

    // Win Condition
    if (state.players.length > 1 && aliveCount <= 1) { 
        const winner = livingPlayers.length > 0 ? livingPlayers[0] : null; 
        endGame(winner ? winner.name + " WINS!" : "DRAW!", winner); 
    }
}

function gameLoop() {
    if (!document.getElementById('main-menu').classList.contains('hidden')) { } 
    else if (!state.isPaused) { 
        try { 
            update(); 
            draw(ctx, canvas); 
        } catch (error) { 
            console.error("Game Crashed:", error); 
            state.isPaused = true; 
            alert("Game Crashed! Check Console for details.\n" + error.message); 
        } 
    }
    else if (state.isPaused && state.isSuddenDeath) {
        draw(ctx, canvas);
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

showMenu();