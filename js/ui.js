import { CHARACTERS, LEVELS, keyBindings, BOMB_MODES, DIFFICULTIES } from './constants.js';
import { state } from './state.js';
import { drawCharacterSprite, drawLevelPreview } from './graphics.js';

let remappingAction = null;
let settingsIndex = 0; 
let carouselInterval = null; 

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

// --- MENU NAVIGATION ---
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

function setupArrowEvents(el, type, dir) {
    const startScroll = (e) => {
        e.preventDefault(); 
        changeSelection(type, dir); 
        if (carouselInterval) clearInterval(carouselInterval);
        carouselInterval = setInterval(() => {
            changeSelection(type, dir);
        }, 150); 
    };
    
    const stopScroll = () => {
        if (carouselInterval) {
            clearInterval(carouselInterval);
            carouselInterval = null;
        }
    };

    el.onmousedown = startScroll;
    el.onmouseup = stopScroll;
    el.onmouseleave = stopScroll;
    
    el.ontouchstart = startScroll;
    el.ontouchend = stopScroll;
}

// --- MAIN MENU RENDER ---
export function initMenu() {
    const charContainer = document.getElementById('char-select');
    const levelContainer = document.getElementById('level-select');
    const startBtn = document.getElementById('start-game-btn');
    const footer = document.querySelector('.menu-footer');
    
    // Settings Button Logic
    let settingsBtn = document.getElementById('settings-btn-main');
    if (!settingsBtn) {
        const oldBtns = footer.querySelectorAll('.btn-secondary');
        oldBtns.forEach(b => { if(b.innerText === "SETTINGS" || b.innerText === "CONTROLS") b.remove(); });
        settingsBtn = document.createElement('button');
        settingsBtn.id = 'settings-btn-main';
        settingsBtn.className = 'btn-secondary';
        footer.appendChild(settingsBtn);
    }
    settingsBtn.classList.remove('desktop-only', 'hidden');
    settingsBtn.style.display = 'block'; 
    settingsBtn.innerText = "SETTINGS";
    settingsBtn.onclick = showSettings;
    settingsBtn.style.border = "2px solid transparent";
    settingsBtn.style.marginTop = "15px";

    updateMobileLabels();

    // Focus / Active States
    charContainer.parentElement.classList.remove('active-group', 'inactive-group');
    levelContainer.parentElement.classList.remove('active-group', 'inactive-group'); // Fix: Parent!
    startBtn.classList.remove('focused');
    settingsBtn.classList.remove('focused');
    settingsBtn.style.borderColor = "transparent"; 

    if (state.menuState === 0) { 
        charContainer.parentElement.classList.add('active-group'); 
        levelContainer.parentElement.classList.add('inactive-group');
    } else if (state.menuState === 1) { 
        charContainer.parentElement.classList.add('inactive-group'); 
        levelContainer.parentElement.classList.add('active-group');
    } else if (state.menuState === 2) { 
        charContainer.parentElement.classList.add('inactive-group'); 
        levelContainer.parentElement.classList.add('inactive-group');
        startBtn.classList.add('focused');
    } else if (state.menuState === 3) { 
        charContainer.parentElement.classList.add('inactive-group'); 
        levelContainer.parentElement.classList.add('inactive-group');
        settingsBtn.classList.add('focused');
        settingsBtn.style.borderColor = "#ffffff"; 
    }

    // Helper Card Creation
    const createCard = (type, index, data, isSelected) => {
        const div = document.createElement('div');
        div.className = `option-card ${isSelected ? 'selected' : ''}`;
        
        div.onclick = (e) => {
            e.stopPropagation();
            if (type === 'char') {
                state.menuState = 0;
                state.selectedCharIndex = index;
            } else {
                state.menuState = 1;
                state.selectedLevelKey = Object.keys(LEVELS)[index];
            }
            initMenu();
        };

        const pCanvas = document.createElement('canvas'); 
        pCanvas.className = 'preview-canvas';
        const ctx = pCanvas.getContext('2d');

        if (type === 'char') {
            pCanvas.width = 48; 
            pCanvas.height = 64; 
            drawCharacterSprite(ctx, 24, 44, data);
        } else {
            pCanvas.width = 48; 
            pCanvas.height = 48; 
            drawLevelPreview(ctx, 48, 48, data);
        }

        div.appendChild(pCanvas);
        const label = document.createElement('div');
        label.className = 'card-label'; label.innerText = data.name;
        div.appendChild(label);
        return div;
    };

    // --- CAROUSEL RENDERER ---
    const renderCarousel = (container, type, dataArray, selectedIndex) => {
        container.innerHTML = '';
        const len = dataArray.length;
        const indicesToShow = [];
        const offset = selectedIndex - 1;

        // Zeige 4 Items (Previous, Current, Next, Next+1)
        for(let i=0; i<4; i++) {
            let idx = (offset + i) % len;
            if (idx < 0) idx += len;
            indicesToShow.push(idx);
        }

        const leftArrow = document.createElement('div');
        leftArrow.className = 'nav-arrow left';
        leftArrow.innerText = '◀';
        setupArrowEvents(leftArrow, type, -1);
        container.appendChild(leftArrow);

        indicesToShow.forEach(idx => {
            const data = dataArray[idx];
            const isSel = (idx === selectedIndex);
            // Für Levels müssen wir den Key übergeben, aber createCard erwartet Index
            const card = createCard(type, idx, data, isSel);
            container.appendChild(card);
        });

        const rightArrow = document.createElement('div');
        rightArrow.className = 'nav-arrow right';
        rightArrow.innerText = '▶';
        setupArrowEvents(rightArrow, type, 1);
        container.appendChild(rightArrow);
    };

    // Render Chars
    renderCarousel(charContainer, 'char', CHARACTERS, state.selectedCharIndex);

    // Render Levels
    const levelKeys = Object.keys(LEVELS);
    const levelData = levelKeys.map(k => LEVELS[k]);
    const selLevIdx = levelKeys.indexOf(state.selectedLevelKey);
    renderCarousel(levelContainer, 'level', levelData, selLevIdx);
}

// --- INPUT HANDLING ---
export function handleMenuInput(code) {
    if (state.menuState === 4 || state.menuState === 5 || state.menuState === 99) return;

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
        else if (code === 'ArrowDown') { state.menuState = 3; initMenu(); } 
        else if (code === 'ArrowUp' || code === 'Escape') { state.menuState = 1; initMenu(); }
    } else if (state.menuState === 3) { 
        if (code === 'Enter' || code === 'Space') { showSettings(); }
        else if (code === 'ArrowUp') { state.menuState = 2; initMenu(); } 
        else if (code === 'Escape') { state.menuState = 1; initMenu(); }
    }
}

function handleSettingsInput(code) {
    if (code === 'ArrowUp') {
        settingsIndex = (settingsIndex - 1 + 4) % 4; 
        updateSettingsFocus();
    } else if (code === 'ArrowDown') {
        settingsIndex = (settingsIndex + 1) % 4;
        updateSettingsFocus();
    } else if (code === 'Enter' || code === 'Space') {
        triggerSettingsAction();
    } else if (code === 'Escape') {
        showMenu();
    }
}

function handleStatsInput(code) {
    if (code === 'Escape' || code === 'Enter' || code === 'Space') {
        showSettings(); 
    }
}

export function showSettings() {
    document.getElementById('main-menu').classList.add('hidden');
    
    const oldStats = document.getElementById('stats-menu');
    if (oldStats) oldStats.remove();

    const oldMenu = document.getElementById('settings-menu');
    if (oldMenu) oldMenu.remove();

    const settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    settingsMenu.className = 'screen'; 
    
    state.menuState = 4; 
    settingsIndex = 0; 

    settingsMenu.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
            <h1 style="margin-bottom:40px;">SETTINGS</h1>
            
            <div style="margin-bottom: 25px; text-align:center;">
                <h2 style="font-size:14px; margin-bottom:8px; color:#aaa;">DIFFICULTY</h2>
                <button id="btn-diff" class="main-btn" style="font-size:18px; width:220px; border:2px solid rgba(0,0,0,0.3);">NORMAL</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:15px; align-items:center;">
                <button id="btn-controls" class="btn-secondary" style="width:220px; border:2px solid rgba(0,0,0,0.3);">CONTROLS</button>
                <button id="btn-stats" class="btn-secondary" style="width:220px; border:2px solid rgba(0,0,0,0.3);">STATISTICS</button>
                <button id="btn-back" class="btn-secondary" style="width:220px; margin-top:30px; border:2px solid rgba(0,0,0,0.3);">BACK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(settingsMenu);

    updateDifficultyBtn();
    updateSettingsFocus();

    const bindMouse = (id, idx, isAction) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.onmouseenter = () => { settingsIndex = idx; updateSettingsFocus(); };
        el.onclick = (e) => { 
            e.stopPropagation();
            settingsIndex = idx; 
            updateSettingsFocus(); 
            if(isAction) triggerSettingsAction(); 
        };
    };
    bindMouse('btn-diff', 0, true);
    bindMouse('btn-controls', 1, true);
    bindMouse('btn-stats', 2, true);
    bindMouse('btn-back', 3, true);
}

export function showStatistics() {
    try {
        const oldSet = document.getElementById('settings-menu');
        if (oldSet) oldSet.remove();

        const statsMenu = document.createElement('div');
        statsMenu.id = 'stats-menu';
        statsMenu.className = 'screen';
        
        state.menuState = 5; 

        const s = state.statistics;
        
        const games = s ? (s.gamesPlayed || 0) : 0;
        const wins = s ? (s.wins || 0) : 0;
        const draws = s ? (s.draws || 0) : 0;
        const losses = s ? (s.losses || 0) : 0;

        let bestCharId = '-';
        let maxWins = -1;
        if (s && s.winsByChar) {
            Object.keys(s.winsByChar).forEach(id => {
                if (s.winsByChar[id] > maxWins) {
                    maxWins = s.winsByChar[id];
                    bestCharId = id;
                }
            });
        }
        
        const bestCharObj = CHARACTERS.find(c => c.id === bestCharId);
        const bestCharName = bestCharObj ? bestCharObj.name.toUpperCase() : (maxWins > 0 ? bestCharId.toUpperCase() : "NONE");

        statsMenu.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
                <h1 style="margin-bottom:30px; color:#aaa;">STATISTICS</h1>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; text-align:left; font-size:16px; margin-bottom:40px; background:rgba(0,0,0,0.5); padding:20px; border:2px solid #333;">
                    <div style="color:#888;">GAMES PLAYED:</div> <div style="color:#fff; text-align:right;">${games}</div>
                    <div style="color:#00ff00;">TOTAL WINS:</div> <div style="color:#fff; text-align:right;">${wins}</div>
                    <div style="color:#ffff00;">DRAWS:</div> <div style="color:#fff; text-align:right;">${draws}</div>
                    <div style="color:#ff0000;">LOSSES:</div> <div style="color:#fff; text-align:right;">${losses}</div>
                    
                    <div style="grid-column: 1 / -1; height:1px; background:#444; margin:10px 0;"></div>
                    
                    <div style="color:#00ccff;">MOST WINS WITH:</div> <div style="color:#fff; text-align:right;">${bestCharName}</div>
                </div>

                <button id="btn-stats-back" class="btn-secondary" style="width:200px; border:2px solid #fff; cursor:pointer;">BACK</button>
            </div>
        `;

        document.body.appendChild(statsMenu);
        
        const btn = document.getElementById('btn-stats-back');
        btn.onclick = (e) => { 
            e.stopPropagation();
            showSettings(); 
        };

    } catch(e) {
        console.error("Stats Error:", e);
        showSettings(); 
    }
}

function updateSettingsFocus() {
    const ids = ['btn-diff', 'btn-controls', 'btn-stats', 'btn-back'];
    ids.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            if (idx === settingsIndex) {
                el.style.border = "2px solid #fff";
                el.style.transform = "scale(1.05)";
                el.style.boxShadow = "0 0 10px rgba(255,255,255,0.2)";
            } else {
                el.style.border = "2px solid rgba(0,0,0,0.3)";
                el.style.transform = "scale(1)";
                el.style.boxShadow = "none";
            }
        }
    });
}

function triggerSettingsAction() {
    if (settingsIndex === 0) { 
        state.difficulty = (state.difficulty + 1) % 3;
        updateDifficultyBtn();
    } else if (settingsIndex === 1) { 
        document.getElementById('settings-menu').remove();
        showControls();
    } else if (settingsIndex === 2) { 
        showStatistics(); 
    } else if (settingsIndex === 3) { 
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

export function showMenu() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    // NEU: Imprint Menü schließen
    const imprintMenu = document.getElementById('imprint-menu');
    if (imprintMenu) imprintMenu.classList.add('hidden');
    
    const oldSet = document.getElementById('settings-menu');
    if (oldSet) oldSet.remove();
    const oldStats = document.getElementById('stats-menu');
    if (oldStats) oldStats.remove();
    
    const mobControls = document.getElementById('mobile-controls');
    if (mobControls) mobControls.classList.add('hidden');
    
    state.menuState = 0;
    initMenu();
}

// NEU: Imprint Logik
export function showImprint() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('imprint-menu').classList.remove('hidden');
    state.menuState = 99; // 99 = Imprint State (Input blockieren)
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
    
    const s = state.statistics;
    if (s) {
        s.gamesPlayed++;
        if (winner) {
            if (winner.id === 1) {
                s.wins++;
                if (winner.charDef && winner.charDef.id) {
                    if (!s.winsByChar[winner.charDef.id]) s.winsByChar[winner.charDef.id] = 0;
                    s.winsByChar[winner.charDef.id]++;
                }
            } else {
                s.losses++;
            }
        } else {
            s.draws++;
        }
        localStorage.setItem('boom_stats', JSON.stringify(s));
    }

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
    
    // FILTER: Nur P1 Controls anzeigen (P1_...)
    Object.keys(keyBindings).filter(k => k.startsWith('P1_')).forEach(action => {
        const row = document.createElement('div'); row.className = 'control-row';
        
        // LABEL CLEANUP: "P1_UP" -> "UP"
        const displayLabel = action.replace('P1_', '');
        const label = document.createElement('span'); label.innerText = displayLabel;
        
        const btn = document.createElement('button'); btn.className = 'key-btn';
        btn.innerText = remappingAction === action ? 'PRESS KEY...' : formatKey(keyBindings[action]);
        if (remappingAction === action) btn.classList.add('active');
        btn.onclick = () => startRemap(action);
        row.appendChild(label); row.appendChild(btn); container.appendChild(row);
    });
}

function startRemap(action) { remappingAction = action; initControlsMenu(); }

export function showSuddenDeathMessage() {
    const el = document.createElement('div');
    el.innerText = "LAST MAN STANDING!";
    el.style.position = "absolute";
    el.style.top = "40%";
    el.style.left = "50%";
    el.style.transform = "translate(-50%, -50%) scale(0)";
    
    el.style.color = "#ff0000"; 
    el.style.fontSize = "40px"; 
    el.style.fontFamily = "'Press Start 2P', cursive";
    el.style.textShadow = "4px 4px 0 #550000"; 
    el.style.textAlign = "center";
    el.style.width = "100%";
    el.style.zIndex = "1000";
    el.style.transition = "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    el.style.pointerEvents = "none";
    
    document.body.appendChild(el);

    requestAnimationFrame(() => {
        el.style.transform = "translate(-50%, -50%) scale(1)";
    });

    setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 500);
    }, 1500);
}

window.showControls = showControls;
window.showSettings = showSettings; 
window.togglePause = togglePause;
window.quitGame = quitGame;
window.showMenu = showMenu;
window.restartGame = restartGame; 
window.updateHud = updateHud;
// NEU: Global verfügbar machen
window.showImprint = showImprint;

window.addEventListener('keydown', e => {
    if (remappingAction) {
        e.preventDefault();
        keyBindings[remappingAction] = e.code;
        remappingAction = null;
        initControlsMenu();
        return;
    }
    if (state.menuState === 4) {
        e.preventDefault();
        handleSettingsInput(e.code);
        return;
    }
    if (state.menuState === 5) {
        e.preventDefault();
        handleStatsInput(e.code);
        return;
    }
});