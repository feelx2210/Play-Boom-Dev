import { LEVELS, DIFFICULTY } from './constants.js';

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
    menuState: 0,       
    isGameOver: false,
    isPaused: false,
    
    // Settings & Stats
    difficulty: DIFFICULTY.MEDIUM, // Standard: Medium
    stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        bestChar: '-'
    },

    // Level-Spezifische Timer
    hellFireTimer: 0,
    hellFirePhase: 'IDLE', 
    hellFireActive: false,
    
    iceTimer: 0,
    iceSpawnCountdown: 0
};