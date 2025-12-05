import { LEVELS } from './constants.js';

export const state = {
    grid: [],
    items: [],
    bombs: [],
    particles: [],
    players: [],
    currentLevel: LEVELS.hell,
    selectedCharIndex: 0,
    selectedLevelKey: 'hell',
    menuState: 0,
    isGameOver: false,
    isPaused: false,
    hellFireTimer: 0,
    hellFirePhase: 'IDLE', 
    hellFireActive: false,
    keys: {},
    
    // --- NEU: ICE LEVEL LOGIK ---
    iceTimer: 0,            // Zählt hoch, wie lange wir schon spielen
    iceSpawnCountdown: 0    // Zählt runter bis zum nächsten "Freeze"
};
