import { LEVELS } from './constants.js';

export const state = {
    // Spielfeld-Daten
    grid: [],
    items: [],
    bombs: [],
    particles: [],
    players: [],
    
    // Level-Status
    currentLevel: LEVELS.hell,
    selectedCharIndex: 0,
    selectedLevelKey: 'hell',
    
    // Game-Flow Status
    menuState: 0,       // 0: Char, 1: Level, 2: Start
    isGameOver: false,
    isPaused: false,
    
    // Level-Spezifische Timer
    hellFireTimer: 0,
    hellFirePhase: 'IDLE', 
    hellFireActive: false,
    
    iceTimer: 0,
    iceSpawnCountdown: 0
    
    // HINWEIS: 'keys' wurde entfernt -> Nutzt jetzt InputHandler
};