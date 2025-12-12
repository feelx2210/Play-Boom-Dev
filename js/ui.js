import { CHARACTERS, LEVELS, keyBindings, BOMB_MODES, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { drawCharacterSprite, drawLevelPreview } from './graphics.js';

let remappingAction = null;

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

function updateMobileLabels() {
    const charNameEl = document.getElementById('char-name-display');
    if (charNameEl) charNameEl.innerText = CHARACTERS[state.selectedCharIndex].name;
    const levelNameEl = document.getElementById('level-name-display');
    if (levelNameEl) levelNameEl.innerText = LEVELS[state.selectedLevelKey].name;
}

function changeSelection(type, dir) {
    if (type === 'char') {
        const len = CHARACTERS.length;
        state.selectedCharIndex = (state.selectedCharIndex + dir + len) % len;
    } else if (type === 'level') {
        const keys = Object.keys(LEVELS);
        const currentIndex = keys.indexOf(state.selectedLevelKey);
        const len = keys.length;
        const newIndex = (currentIndex + dir + len) % len;
        state.selectedLevelKey = keys[newIndex];
    }
    initMenu(); 
}

export function initMenu() {
    const charContainer = document.getElementById('char-select');
    const levelContainer = document.getElementById('level-select');
    const startBtn = document.getElementById('start-game-btn');
    
    charContainer.innerHTML = '';
    levelContainer.innerHTML = '';
    
    updateMobileLabels();

    // VISUAL FEEDBACK (Original Flow: Char -> Level -> Start)
    if (state.menuState === 0) { 
        charContainer.classList.add('active-group'); charContainer.classList.remove('inactive-group');
        levelContainer.classList.add('inactive-group'); levelContainer.classList.remove('active-group');
        startBtn.classList.remove('focused');
    } else if (state.menuState === 1) { 
        charContainer.classList.add('inactive-group'); charContainer.classList.remove('active-group');
        levelContainer.classList.add('active-group'); levelContainer.classList.remove('inactive-group');
        startBtn.classList.remove('focused');
    } else if (state.menuState === 2) { 
        charContainer.classList.add('inactive-group'); 
        levelContainer.classList.add('inactive-group');
        startBtn.classList.add('focused');
    }

    const renderCard = (container, type, index, data, isSelected) => {
        const div = document.createElement('div');
        div.className = `option-card ${isSelected ? 'selected' : ''}`;
        
        div.onclick = (e) => {
            e.stopPropagation();
            if (type === 'char') state.menuState = 0;
            if (type === 'level') state.menuState = 1;
            
            if (index !== (type==='char' ? state.selectedCharIndex : Object.keys(LEVELS).indexOf(state.selectedLevelKey))) {
                if (type === 'char') state.selectedCharIndex = index;
                else state.selectedLevelKey = Object.keys(LEVELS)[index];
                initMenu();
            }
        };

        const pCanvas = document.createElement('canvas'); 
        pCanvas.width=48; pCanvas.height=48; 
        pCanvas.className='preview-canvas';
        const ctx = pCanvas.getContext('2d');
        
        if (type === 'char') {
            drawCharacterSprite(ctx, 24, 36, data);
            div.appendChild(pCanvas);
            const label = document.createElement('div');
            label.className = 'card-label'; label.innerText = data.name;
            div.appendChild(label);
        } else {
            drawLevelPreview(ctx, 48, 48, data);
            div.appendChild(pCanvas);
            const label = document.createElement('div');
            label.className = 'card-label'; label.innerText = data.name;
            div.appendChild(label);
        }

        container.appendChild(div);
    };

    CHARACTERS.forEach((char, idx) => {
        renderCard(charContainer, 'char', idx, char, idx === state.selectedCharIndex);
    });

    const levelKeys = Object.keys(LEVELS);
    levelKeys.forEach((key, idx) => {
        renderCard(levelContainer, 'level', idx, LEVELS[key], key === state.selectedLevelKey);
    });
}

export function handleMenuInput(code) {
    // Falls Settings offen sind (Escape -> Zurück zum Menü)
    if (document.getElementById('settings-menu')) {
        if (code === 'Escape') showMenu();
        return;
    }

    if (state.menuState === 0) {
        if (code === 'ArrowLeft') changeSelection('char', -1);
        else if (code === 'ArrowRight') changeSelection('char', 1);
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 1; initMenu(); }
    } else if (state.menuState === 1) {
        if (code === 'ArrowLeft') changeSelection('level', -1);
        else if (code === 'ArrowRight') changeSelection('level', 1);
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 2; initMenu(); }
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 0; initMenu(); }
    } else if (state.menuState === 2) {
        if (code === 'Enter' || code === 'Space') { if (window.startGame) window.startGame(); }
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 1; initMenu(); }
    }
}

export function showMenu() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    // Altes Settings Menu entfernen, falls vorhanden
    const oldSet = document.getElementById('settings-menu');
    if (oldSet) oldSet.remove();
    
    const mobControls = document.getElementById('mobile-controls');
    if (mobControls) mobControls.classList.add('hidden');
    
    state.menuState = 0;
    initMenu();
}

// NEU: Settings Menu (Robuste Version)
export function showSettings() {
    document.getElementById('main-menu').classList.add('hidden');
    
    // 1. Altes Menü sicher entfernen (Fix für "Geister-Elemente")
    const oldMenu = document.getElementById('settings-menu');
    if (oldMenu) oldMenu.remove();

    // 2. Neues Menü erstellen
    const settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    settingsMenu.className = 'screen';
    
    settingsMenu.innerHTML = `
        <h1>SETTINGS</h1>
        <div class="menu-section">
            <h2>DIFFICULTY</h2>
            <button id="btn-diff" class="main-btn" style="margin-top:10px; font-size:16px;">NORMAL</button>
        </div>
        <button class="btn-secondary" onclick="showMenu()">BACK</button>
    `;
    
    // 3. Erst hinzufügen, dann suchen
    document.body.appendChild(settingsMenu);
    
    // 4. Button sicher im neuen Element suchen
    const btnDiff = settingsMenu.querySelector('#btn-diff');
    
    if (!btnDiff) {
        console.error("Fehler: Difficulty-Button konnte nicht erstellt werden.");
        return;
    }

    const updateLabel = () => {
        const labels = ["EASY", "MEDIUM", "HARD"];
        const colors = ["#44aa44", "#ff8800", "#ff0000"];
        
        // Safety: Stelle sicher, dass difficulty im gültigen Bereich ist
        const safeDiff = Math.max(0, Math.min(state.difficulty, 2));
        
        btnDiff.innerText = labels[safeDiff];
        btnDiff.style.color = colors[safeDiff];
        btnDiff.style.borderColor = colors[safeDiff];
    };
    
    updateLabel();
    
    btnDiff.onclick = () => {
        state.difficulty = (state.difficulty + 1) % 3;
        updateLabel();
    };
}

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

export function restartGame() {
    document.getElementById('pause-menu').classList.add('hidden');
    state.isPaused = false;
    if (window.startGame) window.startGame();
}

export function endGame(msg, winner) {
    if (state.isGameOver) return; 
    state.isGameOver = true; 
    setTimeout(() => {
        const titleEl = document.getElementById('go-title');
        if (winner && winner.id === 1) {
            titleEl.innerText = "YOU WON"; titleEl.style.color = "#00ff00"; titleEl.style.textShadow = "4px 4px 0 #005500"; 
        } else {
            titleEl.innerText = "GAME OVER"; titleEl.style.color = "#ff0000"; titleEl.style.textShadow = "4px 4px 0 #550000";
        }
        document.getElementById('go-message').innerText = msg;
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
    }, 3000);
}

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
        const row = document.createElement('div'); row.className = 'control-row';
        const label = document.createElement('span'); label.innerText = action;
        const btn = document.createElement('button'); btn.className = 'key-btn';
        btn.innerText = remappingAction === action ? 'PRESS KEY...' : formatKey(keyBindings[action]);
        if (remappingAction === action) btn.classList.add('active');
        btn.onclick = () => startRemap(action);
        row.appendChild(label); row.appendChild(btn); container.appendChild(row);
    });
}

function startRemap(action) { remappingAction = action; initControlsMenu(); }

// Global Exports
window.showControls = showControls;
window.showSettings = showSettings; 
window.togglePause = togglePause;
window.quitGame = quitGame;
window.showMenu = showMenu;
window.restartGame = restartGame; 

window.addEventListener('keydown', e => {
    if (remappingAction) { e.preventDefault(); keyBindings[remappingAction] = e.code; remappingAction = null; initControlsMenu(); }
});