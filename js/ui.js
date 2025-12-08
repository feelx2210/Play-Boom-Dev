import { CHARACTERS, LEVELS, keyBindings, BOMB_MODES } from './constants.js';
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

// Helper: Zyklisches Navigieren
function changeSelection(type, dir) {
    if (type === 'char') {
        const len = CHARACTERS.length;
        state.selectedCharIndex = (state.selectedCharIndex + dir + len) % len;
    } else {
        const keys = Object.keys(LEVELS);
        const currentIndex = keys.indexOf(state.selectedLevelKey);
        const len = keys.length;
        const newIndex = (currentIndex + dir + len) % len;
        state.selectedLevelKey = keys[newIndex];
    }
    initMenu();
}

// --- TOUCH SWIPE SUPPORT ---
function addSwipeSupport(element, type) {
    let touchStartX = 0;
    let touchEndX = 0;
    
    element.ontouchstart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
    };
    
    element.ontouchend = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    };
    
    function handleSwipe() {
        const threshold = 30;
        if (touchEndX < touchStartX - threshold) changeSelection(type, 1); // Swipe Left -> Next
        if (touchEndX > touchStartX + threshold) changeSelection(type, -1); // Swipe Right -> Prev
    }
}

// --- MENÜ STEUERUNG (CAROUSEL LOGIC) ---
export function initMenu() {
    renderCarousel('char');
    renderCarousel('level');
}

function renderCarousel(type) {
    const container = document.getElementById(type === 'char' ? 'char-select' : 'level-select');
    const nameDisplay = document.getElementById(type === 'char' ? 'char-name-display' : 'level-name-display');
    container.innerHTML = '';

    // Swipe Listener nur einmal hinzufügen (eigentlich müsste man das checken, aber hier ok)
    container.ontouchstart = null; 
    addSwipeSupport(container, type);

    // Daten ermitteln
    let items = [];
    let selectedIndex = 0;

    if (type === 'char') {
        items = CHARACTERS;
        selectedIndex = state.selectedCharIndex;
        nameDisplay.innerText = items[selectedIndex].name.toUpperCase();
    } else {
        const keys = Object.keys(LEVELS);
        items = keys.map(k => LEVELS[k]);
        selectedIndex = keys.indexOf(state.selectedLevelKey);
        nameDisplay.innerText = items[selectedIndex].name.toUpperCase();
    }

    const len = items.length;
    const prevIndex = (selectedIndex - 1 + len) % len;
    const nextIndex = (selectedIndex + 1) % len;

    // Wir rendern alle Items, aber weisen Klassen basierend auf Position zu
    items.forEach((item, index) => {
        const div = document.createElement('div');
        let cssClass = 'option-card hidden-option'; // Default: unsichtbar

        if (index === selectedIndex) cssClass = 'option-card selected';
        else if (index === prevIndex) cssClass = 'option-card prev';
        else if (index === nextIndex) cssClass = 'option-card next';

        div.className = cssClass;
        
        // Klick auf Prev/Next wechselt Auswahl
        if (index === prevIndex) div.onclick = () => changeSelection(type, -1);
        if (index === nextIndex) div.onclick = () => changeSelection(type, 1);

        const pCanvas = document.createElement('canvas'); 
        pCanvas.width = 48; pCanvas.height = 48; 
        pCanvas.className = 'preview-canvas';
        const ctx = pCanvas.getContext('2d');

        if (type === 'char') {
            drawCharacterSprite(ctx, 24, 36, item);
        } else {
            drawLevelPreview(ctx, 48, 48, item);
        }
        
        div.appendChild(pCanvas);
        container.appendChild(div);
    });
}

export function handleMenuInput(code) {
    if (state.menuState !== 0) { // Einfaches Menü ohne tiefen State für Mobile
        if (code === 'ArrowLeft') changeSelection('char', -1); // Einfachheitshalber steuert Keyboard Char
        if (code === 'ArrowRight') changeSelection('char', 1);
        if (code === 'ArrowUp') changeSelection('level', -1);
        if (code === 'ArrowDown') changeSelection('level', 1);
        if (code === 'Enter' || code === 'Space') {
            if (window.startGame) window.startGame();
        }
    }
}

export function showMenu() {
    // Menüs sichtbar machen
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    // UI Layer und Game Controls verstecken
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('mobile-controls').classList.add('hidden');
    
    // Spiel-Container verstecken (damit Menü vollen Fokus hat und Hintergrund schwarz ist)
    document.getElementById('game-container').classList.add('hidden');

    state.menuState = 1; // Aktiv
    initMenu();
}

export function togglePause() {
    if (state.isGameOver) { showMenu(); return; }
    
    // Check ob wir im Menü sind
    const menu = document.getElementById('main-menu');
    if (menu && !menu.classList.contains('hidden')) return;
    
    state.isPaused = !state.isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !state.isPaused);
    
    // Mobile Controls ausblenden bei Pause
    const controls = document.getElementById('mobile-controls');
    if (state.isPaused) controls.classList.add('hidden');
    else controls.classList.remove('hidden');
}

export function quitGame() {
    state.isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    showMenu();
}

export function endGame(msg, winner) {
    if (state.isGameOver) return; 
    state.isGameOver = true; 
    setTimeout(() => {
        const titleEl = document.getElementById('go-title');
        if (winner && winner.id === 1) {
            titleEl.innerText = "YOU WON";
            titleEl.style.color = "#00ff00"; 
            titleEl.style.textShadow = "4px 4px 0 #005500"; 
        } else {
            titleEl.innerText = "GAME OVER";
            titleEl.style.color = "#ff0000"; 
            titleEl.style.textShadow = "4px 4px 0 #550000";
        }
        document.getElementById('go-message').innerText = msg;
        
        // Mobile Controls ausblenden
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('game-over').classList.remove('hidden');
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

// Globals
window.showControls = showControls;
window.togglePause = togglePause;
window.quitGame = quitGame;
window.showMenu = showMenu;

window.addEventListener('keydown', e => {
    if (remappingAction) {
        e.preventDefault();
        keyBindings[remappingAction] = e.code;
        remappingAction = null;
        initControlsMenu();
    }
});
