export const state = {
    currentLevel: null,
    grid: [],
    items: [],
    players: [],
    bombs: [],
    particles: [],
    
    // Game Flow
    isPaused: false,
    isGameOver: false,
    gameStartTime: 0,
    
    // Menu
    menuState: 0, 
    selectedCharIndex: 0,
    selectedLevelKey: 'stone',
    difficulty: 1, 
    
    // Mechanics
    hellFireTimer: 0,
    hellFirePhase: 'IDLE', 
    hellFireActive: false,
    
    iceTimer: 0,
    iceSpawnCountdown: 1200,

    // NEU: Sudden Death Flag
    isSuddenDeath: false,
    
    statistics: JSON.parse(localStorage.getItem('boom_stats')) || {
        gamesPlayed: 0, wins: 0, draws: 0, losses: 0, winsByChar: {}
    }
};