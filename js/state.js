// js/state.js
import { LEVELS, DIFFICULTIES } from './constants.js';

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
    
    // NEU: Schwierigkeit (0=Easy, 1=Mid, 2=Hard)
    difficulty: DIFFICULTIES.HARD,

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
};