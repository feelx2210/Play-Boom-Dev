import { LEVELS, DIFFICULTIES } from './constants.js'; //

// Default Stats definieren
const defaultStats = {
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winsByChar: { rambo: 0, lucifer: 0, nun: 0, yeti: 0 } 
};

// Versuch, gespeicherte Stats zu laden
const savedData = localStorage.getItem('boom_stats');
let finalStats = defaultStats;

if (savedData) {
    try {
        const parsed = JSON.parse(savedData);
        // MERGE: Wir nehmen die gespeicherten Werte und füllen fehlende mit Defaults auf.
        // Das verhindert den Crash, wenn 'winsByChar' im alten Speicherstand fehlt.
        finalStats = { ...defaultStats, ...parsed };
        
        // Expliziter Check für Nested Objects
        if (!finalStats.winsByChar) finalStats.winsByChar = defaultStats.winsByChar;
        
    } catch (e) {
        console.error("Stats corrupted, resetting.", e);
        finalStats = defaultStats;
    }
}

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
    difficulty: DIFFICULTIES.HARD,

    // Statistik (Sicher geladen)
    statistics: finalStats,

    // Game-Flow Status
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