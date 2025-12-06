import { CHARACTERS, LEVELS, keyBindings, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawCharacterSprite, drawLevelPreview } from './graphics.js';

let remappingAction = null;

// --- HUD UPDATE (aus Player Klasse ausgelagert) ---
export function updateHud(player) {
    const elType = document.getElementById('bomb-type');
    if (elType) {
        switch(player.currentBombMode) {
            case BOMB_MODES.STANDARD: elType.innerText = '⚫'; break;
            case BOMB_MODES.NAPALM: elType.innerText = '☢️'; break;
            case BOMB_MODES.ROLLING: elType.innerText = '🎳'; break;
        }
    }
    const elBombs = document.getElementById('hud-bombs');
    if (elBombs) elBombs.innerText = `💣 ${player.maxBombs}`;
    const elFire = document.getElementById('hud-fire');
    if (elFire) elFire.innerText = `🔥 ${player.bombRange}`;
}

// --- MENÜ STEUERUNG ---
export function initMenu() {
    const charContainer = document.getElementById('char-select');
    charContainer.innerHTML = '';
    const levelContainer = document.getElementById('level-select');
    levelContainer.innerHTML = '';
    
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
        
        const pCanvas = document.createElement('canvas'); 
        pCanvas.width=48; pCanvas.height=48; 
        pCanvas.className='preview-canvas';
        drawCharacterSprite(pCanvas.getContext('2d'), 24, 36, char);
        
        div.appendChild(pCanvas);
        const label = document.createElement('div'); 
        label.className = 'card-label'; 
        label.innerText = char.name;
        div.appendChild(label);
        charContainer.appendChild(div);
    });

    Object.keys(LEVELS).forEach((key) => {
        const lvl = LEVELS[key];
        const div = document.createElement('div');
        const isSelected = key === state.selectedLevelKey;
        div.className = `option-card ${isSelected ? 'selected' : ''}`;
        div.onclick = () => { state.menuState = 1; state.selectedLevelKey = key; initMenu(); };
        
        const lCanvas = document.createElement('canvas'); 
        lCanvas.width=48; lCanvas.height=48; 
        lCanvas.className='preview-canvas';
        drawLevelPreview(lCanvas.getContext('2d'), 48, 48, lvl);
        
        div.appendChild(lCanvas);
        const label = document.createElement('div'); 
        label.className = 'card-label'; 
        label.innerText = lvl.name;
        div.appendChild(label);
        levelContainer.appendChild(div);
    });
}

export function handleMenuInput(code) {
    const levelKeys = Object.keys(LEVELS);
    const currentLevelIndex = levelKeys.indexOf(state.selectedLevelKey);

    if (state.menuState === 0) {
        if (code === 'ArrowLeft') { state.selectedCharIndex = (state.selectedCharIndex - 1 + CHARACTERS.length) % CHARACTERS.length; initMenu(); }
        else if (code === 'ArrowRight') { state.selectedCharIndex = (state.selectedCharIndex + 1) % CHARACTERS.length; initMenu(); }
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 1; initMenu(); }
    } else if (state.menuState === 1) {
        if (code === 'ArrowLeft') { state.selectedLevelKey = levelKeys[(currentLevelIndex - 1 + levelKeys.length) % levelKeys.length]; initMenu(); }
        else if (code === 'ArrowRight') { state.selectedLevelKey = levelKeys[(currentLevelIndex + 1) % levelKeys.length]; initMenu(); }
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 2; initMenu(); }
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 0; initMenu(); }
    } else if (state.menuState === 2) {
        if (code === 'Enter' || code === 'Space') {
            if (window.startGame) window.startGame();
        }
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 1; initMenu(); }
    }
}

export function showMenu() {
    // UI Reset
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    state.menuState = 0;
    initMenu();
}

// --- PAUSE & GAME OVER UI ---
export function togglePause() {
    if (state.isGameOver) { showMenu(); return; }
    if (!document.getElementById('main-menu').classList.contains('hidden')) return;
    
    state.isPaused = !state.isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !state.isPaused);
}

export function quitGame() {
    state.isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    showMenu();
}

// ANPASSUNG: Neuer Parameter 'winner' hinzugefügt
export function endGame(msg, winner) {
    if (state.isGameOver) return; 
    state.isGameOver = true; 
    setTimeout(() => {
        const titleEl = document.getElementById('go-title');
        
        // Prüfen, ob es einen Gewinner gibt und ob dieser die ID 1 (Spieler 1) hat
        if (winner && winner.id === 1) {
            titleEl.innerText = "YOU WON";
            titleEl.style.color = "#00ff00"; // Grün
            titleEl.style.textShadow = "4px 4px 0 #005500"; // Passender Schatten
        } else {
            // Standard wiederherstellen (wichtig für Neustarts)
            titleEl.innerText = "GAME OVER";
            titleEl.style.color = "#ff0000"; // Rot
            titleEl.style.textShadow = "4px 4px 0 #550000";
        }

        document.getElementById('go-message').innerText = msg;
        document.getElementById('game-over').classList.remove('hidden');
    }, 3000);
}

// --- CONTROLS MENU ---
export function showControls() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('controls-menu').classList.remove('hidden');
    initControlsMenu();
}

function initControlsMenu() {
    const container = document.getElementById('controls-list');
    container.innerHTML = '';
    const formatKey = (code) => code.replace('Key', '').replace('Arrow', '').replace('Space', 'SPACE').toUpperCase();
    
    Object.keys(keyBindings).forEach(action => {
        const row = document.createElement('div');
        row.className = 'control-row';
        
        const label = document.createElement('span');
        label.innerText = action;
        
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        btn.innerText = remappingAction === action ? 'PRESS KEY...' : formatKey(keyBindings[action]);
        if (remappingAction === action) btn.classList.add('active');
        
        btn.onclick = () => startRemap(action);
        
        row.appendChild(label);
        row.appendChild(btn);
        container.appendChild(row);
    });
}

function startRemap(action) {
    remappingAction = action;
    initControlsMenu(); 
}

// Globale Funktionen ans Fenster hängen, damit HTML-Buttons funktionieren
window.showControls = showControls;
window.togglePause = togglePause;
window.quitGame = quitGame;
window.showMenu = showMenu;

// Event Listener für Key-Remapping (global, aber hier verwaltet)
window.addEventListener('keydown', e => {
    if (remappingAction) {
        e.preventDefault();
        keyBindings[remappingAction] = e.code;
        remappingAction = null;
        initControlsMenu();
    }
});
