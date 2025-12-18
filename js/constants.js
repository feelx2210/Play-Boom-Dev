export const TILE_SIZE = 48;
export const GRID_W = 15;
export const GRID_H = 15;

export const HELL_CENTER = { x: 7, y: 7 };

export const TYPES = {
    EMPTY: 0,
    WALL_HARD: 1,
    WALL_SOFT: 2,
    BOMB: 3,
    WATER: 4,
    BRIDGE: 5,
    OIL: 6
};

export const ITEMS = {
    NONE: 0,
    BOMB_UP: 1,
    RANGE_UP: 2,
    SPEED_UP: 3,
    SKULL: 4,
    NAPALM: 5,
    ROLLING: 6
};

export const BOMB_MODES = {
    STANDARD: 0,
    NAPALM: 1,
    ROLLING: 2
};

export const DIFFICULTIES = ["EASY", "NORMAL", "HARD"];

export const CHARACTERS = [
    // --- ORIGINAL 4 (RENAMED) ---
    { id: 'commando', name: 'Commando', color: '#228822', accent: '#ff0000' }, // War Rambo
    { id: 'devil', name: 'The Devil', color: '#ff0000', accent: '#ffff00' },   // War Lucifer
    { id: 'nun', name: 'The Nun', color: '#000000', accent: '#ffffff' },       // War Nun
    { id: 'yeti', name: 'Snow Beast', color: '#ffffff', accent: '#00ccff' },   // War Yeti
    
    // --- NEW 11 (SAFE NAMES) ---
    { id: 'striker', name: 'Striker', color: '#ff0000', accent: '#ffffff' },   // War Cristiano
    { id: 'agent', name: 'The Agent', color: '#000000', accent: '#ff0000' },   // War Hitman
    { id: 'techie', name: 'Tech CEO', color: '#333333', accent: '#aaaaaa' },   // War Elon
    { id: 'moonwalker', name: 'Moonwalker', color: '#ffffff', accent: '#000000' }, // War MJ
    { id: 'hoopster', name: 'Hoopster', color: '#fdb927', accent: '#552583' }, // War Lebron
    { id: 'lifeguard', name: 'Lifeguard', color: '#ff2222', accent: '#ffff88' }, // War Pam
    { id: 'vocalist', name: 'Vocalist', color: '#000000', accent: '#ffd700' }, // War Drizzy
    { id: 'rapper', name: 'Rapper', color: '#ffffff', accent: '#3366cc' },     // War 2Pac
    { id: 'diva', name: 'Pop Diva', color: '#ffb6c1', accent: '#000000' },     // War Dua
    { id: 'star', name: 'Pop Star', color: '#0000ff', accent: '#eeeeee' },     // War Gaga
    { id: 'spy', name: 'The Spy', color: '#555555', accent: '#000000' }        // War 007
];

export const LEVELS = {
    stone: { id: 'stone', name: 'STONE CASTLE', bg: '#222', wallHard: '#555', wallSoft: '#777', wallSoftLight: '#888', grid: '#333', border: '#777', glow: '#fff', hasCentralFire: false },
    jungle: { id: 'jungle', name: 'JUNGLE', bg: '#001100', wallHard: '#1a1', wallSoft: '#582f0e', wallSoftLight: '#6f4e37', grid: '#030', border: '#2e2', glow: '#4f4', hasCentralFire: false },
    ice: { id: 'ice', name: 'ICE', bg: '#001133', wallHard: '#336699', wallSoft: '#66ccff', wallSoftLight: '#99ddff', grid: '#002244', border: '#6cf', glow: '#0af', hasCentralFire: false },
    hell: { id: 'hell', name: 'HELL', bg: '#220000', wallHard: '#440000', wallSoft: '#662222', wallSoftLight: '#883333', grid: '#400', border: '#f00', glow: '#f00', hasCentralFire: true }
};

export const BOOST_PADS = [{x:3, y:3}, {x:11, y:3}, {x:3, y:11}, {x:11, y:11}];
export const OIL_PADS = [{x:4, y:4}, {x:10, y:4}, {x:4, y:10}, {x:10, y:10}];
export const DIRECTION_PADS = [
    {x:1, y:5, dir:{x:0, y:1}}, {x:13, y:9, dir:{x:0, y:-1}}, 
    {x:5, y:1, dir:{x:1, y:0}}, {x:9, y:13, dir:{x:-1, y:0}}
];

export const keyBindings = {
    P1_UP: 'ArrowUp', P1_DOWN: 'ArrowDown', P1_LEFT: 'ArrowLeft', P1_RIGHT: 'ArrowRight', P1_BOMB: 'Space'
};