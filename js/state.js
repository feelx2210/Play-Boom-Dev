import { LEVELS, DIFFICULTIES } from './constants.js';

// Stats laden oder Defaultwerte setzen
const savedStats = localStorage.getItem('boom_stats');
const defaultStats = {
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    // Zählt Siege pro Charakter-ID (rambo, lucifer, etc.)
    winsByChar: { rambo: 0, lucifer: 0, nun: 0, yeti: 0 } 
};

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
    
    // Difficulty
    difficulty: DIFFICULTIES.HARD, // Standard auf Hard, da du es so magst ;)

    // Statistik (Persistent)
    statistics: savedStats ? JSON.parse(savedStats) : defaultStats,

    // Game-Flow Status
    // 0: Char, 1: Level, 2: Start, 3: SettingsBtn, 4: SettingsMenu, 5: StatsMenu
    menuState: 0,       
    isGameOver: false,
    isPaused: false,
    
    // Level-Spezifische Timer
    hellFireTimer: 0,
    hellFirePhase: 'IDLE', 
    hellFireActive: false,
    
    iceTimer: 0,
    iceSpawnCountdown: 0
};