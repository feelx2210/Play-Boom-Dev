import { LEVELS } from './constants.js';
//added for push
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
    keys: {}
};
