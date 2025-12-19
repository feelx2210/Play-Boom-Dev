export const TILE_SIZE = 48;
export const GRID_W = 15;
export const GRID_H = 15;

export const HELL_CENTER = { x: 7, y: 7 };

// Objekt für einfache Abfragen in der KI
export const DIFFICULTIES = {
    EASY: 0,
    NORMAL: 1,
    HARD: 2
};

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

export const CHARACTERS = [
    // --- ORIGINAL 4 (SAFE PARODIES) ---
    { id: 'commando', name: 'Commando', color: '#228822', accent: '#ff0000' }, 
    { id: 'devil', name: 'The Devil', color: '#ff0000', accent: '#ffff00' },   
    { id: 'nun', name: 'The Nun', color: '#000000', accent: '#ffffff' },       
    { id: 'yeti', name: 'Snow Beast', color: '#ffffff', accent: '#00ccff' },   
    
    // --- NEW 11 (SAFE PARODIES) ---
    { id: 'striker', name: 'Striker', color: '#ff0000', accent: '#ffffff' },   
    { id: 'agent', name: 'The Agent', color: '#000000', accent: '#ff0000' },   
    { id: 'techie', name: 'Tech CEO', color: '#333333', accent: '#aaaaaa' },   
    { id: 'moonwalker', name: 'Moonwalker', color: '#ffffff', accent: '#000000' }, 
    { id: 'baller', name: 'Baller', color: '#fdb927', accent: '#552583' }, 
    { id: 'lifeguard', name: 'Lifeguard', color: '#ff2222', accent: '#ffff88' }, 
    { id: 'rapper', name: 'Rapper', color: '#000000', accent: '#ffd700' }, 
    { id: 'rap_icon', name: 'Rap Icon', color: '#ffffff', accent: '#3366cc' },     
    { id: 'diva', name: 'Pop Diva', color: '#ffb6c1', accent: '#000000' },     
    { id: 'star', name: 'Pop Star', color: '#0000ff', accent: '#eeeeee' },     
    { id: 'spy', name: 'The Spy', color: '#555555', accent: '#000000' }        
];

// Die guten, alten Level-Designs
export const LEVELS = {
    stone: { id: 'stone', name: 'STONE CASTLE', bg: '#222', wallHard: '#555', wallSoft: '#777', wallSoftLight: '#888', grid: '#333', border: '#777', glow: '#fff', hasCentralFire: false },
    jungle: { id: 'jungle', name: 'JUNGLE', bg: '#001100', wallHard: '#1a1', wallSoft: '#582f0e', wallSoftLight: '#6f4e37', grid: '#030', border: '#2e2', glow: '#4f4', hasCentralFire: false },
    ice: { id: 'ice', name: 'ICE', bg: '#001133', wallHard: '#336699', wallSoft: '#66ccff', wallSoftLight: '#99ddff', grid: '#002244', border: '#6cf', glow: '#0af', hasCentralFire: false },
    hell: { id: 'hell', name: 'HELL', bg: '#220000', wallHard: '#440000', wallSoft: '#662222', wallSoftLight: '#883333', grid: '#400', border: '#f00', glow: '#f00', hasCentralFire: true }
};

// Maximale Explosionsfelder (Boost Pads) an den neuen Positionen
export const BOOST_PADS = [
    {x:5, y:4}, {x:5, y:8}, 
    {x:9, y:4}, {x:9, y:8}
];

export const OIL_PADS = [{x:4, y:4}, {x:10, y:4}, {x:4, y:10}, {x:10, y:10}];

// Richtungsfelder (Direction Pads) an den neuen Positionen mit korrekter Ausrichtung
export const DIRECTION_PADS = [
    {x:3, y:3, dir:{x:0, y:-1}},   // Oben Links -> Pfeil nach OBEN
    {x:3, y:11, dir:{x:1, y:0}},   // Unten Links -> Pfeil nach RECHTS
    {x:11, y:11, dir:{x:0, y:1}},  // Unten Rechts -> Pfeil nach UNTEN
    {x:11, y:3, dir:{x:-1, y:0}}   // Oben Rechts -> Pfeil nach LINKS
];

// WICHTIG: Die korrekten Tastenbelegungen für Player 1 & 2
export const keyBindings = {
    P1_UP: 'ArrowUp', P1_DOWN: 'ArrowDown', P1_LEFT: 'ArrowLeft', P1_RIGHT: 'ArrowRight', P1_BOMB: 'Space', P1_CHANGE: 'ShiftLeft',
    P2_UP: 'KeyW', P2_DOWN: 'KeyS', P2_LEFT: 'KeyA', P2_RIGHT: 'KeyD', P2_BOMB: 'KeyF', P2_CHANGE: 'KeyE'
};