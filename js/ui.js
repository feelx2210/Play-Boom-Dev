import { CHARACTERS, LEVELS, keyBindings, BOMB_MODES, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { drawCharacterSprite, drawLevelPreview } from './graphics.js';

let remappingAction = null;
let settingsIndex = 0; // 0: Difficulty, 1: Controls, 2: Stats, 3: Back

// --- HUD UPDATE ---
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

// --- SELECTION LOGIC ---
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

// --- MAIN MENU RENDER ---
export function initMenu() {
    const charContainer = document.getElementById('char-select');
    const levelContainer = document.getElementById('level-select');
    const startBtn = document.getElementById('start-game-btn');
    const footer = document.querySelector('.menu-footer');
    
    // FIX: Settings Button robust erstellen/finden
    let settingsBtn = document.getElementById('settings-btn-main');
    if (!settingsBtn) {
        // Versuch, den alten Controls Button zu recyceln, um Duplikate zu vermeiden
        const existingSecondary = footer.querySelector('.btn-secondary');
        if (existingSecondary) {
            settingsBtn = existingSecondary;
            settingsBtn.id = 'settings-btn-main';
        } else {
            settingsBtn = document.createElement('button');
            settingsBtn.id = 'settings-btn-main';
            settingsBtn.className = 'btn-secondary';
            footer.appendChild(settingsBtn);
        }
    }

    // FIX: Zwingend sichtbar machen (entfernt 'desktop-only' Klasse)
    settingsBtn.classList.remove('desktop-only', 'hidden');
    settingsBtn.style.display = 'block'; 
    settingsBtn.innerText = "SETTINGS";
    settingsBtn.onclick = showSettings;

    // FIX: Fester transparenter Rahmen gegen das "Hüpfen"
    settingsBtn.style.border = "2px solid transparent";
    settingsBtn.style.marginTop = "15px";

    charContainer.innerHTML = '';
    levelContainer.innerHTML = '';
    
    updateMobileLabels();

    // VISUAL FEEDBACK STATES
    // 0: Char, 1: Level, 2: Start, 3: Settings
    
    // Reset All Styles
    charContainer.classList.remove('active-group', 'inactive-group');
    levelContainer.classList.remove('active-group', 'inactive-group');
    startBtn.classList.remove('focused');
    settingsBtn.classList.remove('focused');
    settingsBtn.style.borderColor = "transparent"; 

    if (state.menuState === 0) { 
        charContainer.classList.add('active-group'); levelContainer.classList.add('inactive-group');
    } else if (state.menuState === 1) { 
        charContainer.classList.add('inactive-group'); levelContainer.classList.add('active-group');
    } else if (state.menuState === 2) { 
        charContainer.classList.add('inactive-group'); levelContainer.classList.add('inactive-group');
        startBtn.classList.add('focused');
    } else if (state.menuState === 3) { 
        charContainer.classList.add('inactive-group'); levelContainer.classList.add('inactive-group');
        settingsBtn.classList.add('focused');
        settingsBtn.style.borderColor = "#ffffff"; // Nur Farbe ändern, Pixelbreite bleibt gleich
    }

    // Render Cards
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
        
        if (type === 'char') drawCharacterSprite(ctx, 24, 36, data);
        else drawLevelPreview(ctx, 48, 48, data);
        
        div.appendChild(pCanvas);
        const label = document.createElement('div');
        label.className = 'card-label'; label.innerText = data.name;
        div.appendChild(label);
        container.appendChild(div);
    };

    CHARACTERS.forEach((char, idx) => { renderCard(charContainer, 'char', idx, char, idx === state.selectedCharIndex); });
    const levelKeys = Object.keys(LEVELS);
    levelKeys.forEach((key, idx) => { renderCard(levelContainer, 'level', idx, LEVELS[key], key === state.selectedLevelKey); });
}

// --- INPUT HANDLING ---
export function handleMenuInput(code) {
    // 4 = Inside Settings Menu
    if (state.menuState === 4) {
        if (code === 'ArrowUp') {
            settingsIndex = (settingsIndex - 1 + 4) % 4; // 4 Items: Diff, Ctrl, Stats, Back
            updateSettingsFocus();
        } else if (code === 'ArrowDown') {
            settingsIndex = (settingsIndex + 1) % 4;
            updateSettingsFocus();
        } else if (code === 'Enter' || code === 'Space') {
            triggerSettingsAction();
        } else if (code === 'Escape') {
            showMenu();
        }
        return;
    }

    // Main Menu Navigation
    if (state.menuState === 0) { // Char
        if (code === 'ArrowLeft') changeSelection('char', -1);
        else if (code === 'ArrowRight') changeSelection('char', 1);
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 1; initMenu(); }
    } else if (state.menuState === 1) { // Level
        if (code === 'ArrowLeft') changeSelection('level', -1);
        else if (code === 'ArrowRight') changeSelection('level', 1);
        else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') { state.menuState = 2; initMenu(); }
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 0; initMenu(); }
    } else if (state.menuState === 2) { // Start Btn
        if (code === 'Enter' || code === 'Space') { if (window.startGame) window.startGame(); }
        else if (code === 'ArrowDown') { state.menuState = 3; initMenu(); } // Go Down to Settings
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 1; initMenu(); }
    } else if (state.menuState === 3) { // Settings Btn
        if (code === 'Enter' || code === 'Space') { showSettings(); }
        else if (code === 'ArrowUp') { state.menuState = 2; initMenu(); } // Go Up to Start
        else if (code === 'Escape') { state.menuState = 1; initMenu(); }
    }
}

export function showMenu() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    // Remove Settings Menu Overlay if exists
    const oldSet = document.getElementById('settings-menu');
    if (oldSet) oldSet.remove();
    
    const mobControls = document.getElementById('mobile-controls');
    if (mobControls) mobControls.classList.add('hidden');
    
    state.menuState = 0;
    initMenu();
}

// --- SETTINGS LOGIC ---
function updateSettingsFocus() {
    const ids = ['btn-diff', 'btn-controls', 'btn-stats', 'btn-back'];
    ids.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            if (idx === settingsIndex) {
                el.style.border = "2px solid #fff";
                el.style.transform = "scale(1.05)";
            } else {
                el.style.border = "2px solid rgba(0,0,0,0.3)";
                el.style.transform = "scale(1)";
            }
        }
    });
}

function triggerSettingsAction() {
    if (settingsIndex === 0) { // Difficulty
        state.difficulty = (state.difficulty + 1) % 3;
        updateDifficultyBtn();
    } else if (settingsIndex === 1) { // Controls
        document.getElementById('settings-menu').remove();
        showControls();
    } else if (settingsIndex === 3) { // Back
        showMenu();
    }
}

function updateDifficultyBtn() {
    const btn = document.getElementById('btn-diff');
    if (!btn) return;
    
    const labels = ["EASY", "MEDIUM", "HARD"];
    const colors = ["#44aa44", "#ff8800", "#ff0000"];
    
    if (state.difficulty === undefined) state.difficulty = 1;
    const safeDiff = Math.max(0, Math.min(state.difficulty, 2));

    btn.innerText = labels[safeDiff];
    btn.style.backgroundColor = colors[safeDiff];
    btn.style.color = "#ffffff";
    btn.style.textShadow = "1px 1px 0 #000";
}

export function showSettings() {
    document.getElementById('main-menu').classList.add('hidden');
    
    const oldMenu = document.getElementById('settings-menu');
    if (oldMenu) oldMenu.remove();

    const settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    settingsMenu.className = 'screen'; 
    // .screen hat bereits flex, center, center in style.css!
    
    state.menuState = 4; // Switch to Settings Input Mode
    settingsIndex = 0;   // Reset Selection

    settingsMenu.innerHTML = `
        <h1 style="margin-bottom:40px;">SETTINGS</h1>
        
        <div style="margin-bottom: 25px; text-align:center;">
            <h2 style="font-size:14px; margin-bottom:8px; color:#aaa;">DIFFICULTY</h2>
            <button id="btn-diff" class="main-btn" style="font-size:18px; width:220px; border:2px solid rgba(0,0,0,0.3);">NORMAL</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:15px; align-items:center;">
            <button id="btn-controls" class="btn-secondary" style="width:220px; border:2px solid rgba(0,0,0,0.3);">CONTROLS</button>
            <button id="btn-stats" class="btn-secondary" style="width:220px; opacity:0.5; border:2px solid rgba(0,0,0,0.3);">STATISTICS (WIP)</button>
            <button id="btn-back" class="btn-secondary" style="width:220px; margin-top:30px; border:2px solid rgba(0,0,0,0.3);">BACK</button>
        </div>
    `;
    
    document.body.appendChild(settingsMenu);

    updateDifficultyBtn();
    updateSettingsFocus();

    // Mouse Interactions
    const bindMouse = (id, idx, isAction) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.onmouseenter = () => { settingsIndex = idx; updateSettingsFocus(); };
        el.onclick = () => { 
            settingsIndex = idx; 
            updateSettingsFocus(); 
            if(isAction) triggerSettingsAction(); 
        };
    };

    bindMouse('btn-diff', 0, true);
    bindMouse('btn-controls', 1, true);
    bindMouse('btn-stats', 2, false);
    bindMouse('btn-back', 3, true);
}

// --- STANDARD EXPORTS ---
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