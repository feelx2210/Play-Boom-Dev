export const TILE_SIZE = 48;
export const GRID_W = 15;
export const GRID_H = 15;

export const HELL_CENTER = { x: 7, y: 7 };

// Für die KI
export const DIFFICULTIES = {
    EASY: 0,
    NORMAL: 1,
    HARD: 2
};

export const COLORS = {
    EXPLOSION_CORE: '#ffffcc'
};

export const TYPES = {
    EMPTY: 0,
    WALL_HARD: 1,
    WALL_SOFT: 2,
    BOMB: 3,
    WATER: 4,     // Korrigiert auf fortlaufende IDs für Sicherheit
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

// Deine gewünschten Richtungen & Pads
export const BOOST_PADS = [
    {x: 5, y: 5}, {x: 9, y: 5}, {x: 5, y: 9}, {x: 9, y: 9}
];

export const DIRECTION_PADS = [
    { x: 3, y: 3, dir: {x: 1, y: 0} },    // Oben Links -> Rechts
    { x: 11, y: 3, dir: {x: 0, y: 1} },   // Oben Rechts -> Unten
    { x: 11, y: 11, dir: {x: -1, y: 0} }, // Unten Rechts -> Links
    { x: 3, y: 11, dir: {x: 0, y: -1} }   // Unten Links -> Oben
];

export const OIL_PADS = [
    {x: 3, y: 5}, {x: 3, y: 6}, {x: 3, y: 7}, {x: 3, y: 8}, {x: 3, y: 9},
    {x: 4, y: 9}, {x: 6, y: 9}, {x: 7, y: 9}, {x: 8, y: 9},
    {x: 11, y: 9}, {x: 11, y: 8}, {x: 11, y: 7}, {x: 11, y: 6}, {x: 11, y: 5},
    {x: 10, y: 5}, {x: 8, y: 5}, {x: 7, y: 5}, {x: 6, y: 5}, {x: 4, y: 5}
];

// Charaktere mit SICHEREN IDs (damit char_sprites.js funktioniert), 
// aber deinen Farben aus dem Snippet.
export const CHARACTERS = [
    // Original 4
    { id: 'commando', name: 'Commando', color: '#44aa44', accent: '#aa0000' }, // War Rambo
    { id: 'devil', name: 'The Devil', color: '#ff0000', accent: '#000000' },   // War Lucifer
    { id: 'nun', name: 'The Nun', color: '#eeeeee', accent: '#000000' },       // War Nun
    { id: 'yeti', name: 'Snow Beast', color: '#00ccff', accent: '#ffffff' },   // War Yeti
    
    // New 11 (Safe)
    { id: 'striker', name: 'Striker', color: '#ff3333', accent: '#ffffff' },
    { id: 'agent', name: 'The Agent', color: '#111111', accent: '#cc0000' },
    { id: 'techie', name: 'Tech CEO', color: '#333333', accent: '#ffffff' },
    { id: 'moonwalker', name: 'Moonwalker', color: '#222222', accent: '#ffffff' },
    { id: 'hoopster', name: 'Hoopster', color: '#552583', accent: '#fdb927' },
    { id: 'lifeguard', name: 'Lifeguard', color: '#ff2222', accent: '#ffddaa' },
    { id: 'vocalist', name: 'Vocalist', color: '#444444', accent: '#ffffff' },
    { id: 'rapper', name: 'Rapper', color: '#ffffff', accent: '#222222' },
    { id: 'diva', name: 'Pop Diva', color: '#111111', accent: '#ff00ff' },
    { id: 'star', name: 'Pop Star', color: '#0099ff', accent: '#eeeeee' },
    { id: 'spy', name: 'The Spy', color: '#555555', accent: '#cccccc' }
];

// LEVEL DEFINITIONEN (Exakt dein Snippet!)
export const LEVELS = {
    hell: { id: 'hell', name: 'Hell', bg: '#3b1e1e', wallHard: '#333333', wallSoft: '#aa0000', wallSoftLight: '#cc3333', grid: '#220a0a', glow: '#ff0000', border: '#550000', hasCentralFire: true },
    ice: { id: 'ice', name: 'Ice', bg: '#000044', wallHard: '#4466ff', wallSoft: '#88ccff', wallSoftLight: '#ccffff', grid: '#000066', glow: '#00ccff', border: '#004488' },
    jungle: { id: 'jungle', name: 'Jungle', bg: '#4a3b2a', wallHard: '#666666', wallSoft: '#228822', wallSoftLight: '#44aa44', grid: '#3a2b1a', glow: '#22aa22', border: '#114411', hasRiver: true },
    stone: { id: 'stone', name: 'Stone', bg: '#1a1a1a', wallHard: '#444444', wallSoft: '#888888', wallSoftLight: '#aaaaaa', grid: '#222222', glow: '#aaaaaa', border: '#666666' }
};

// FIX: Tasten müssen P1_... heißen, damit player.js sie findet.
// Wir nehmen deine Belegung ('ArrowUp'), mappen sie aber auf den korrekten Key.
export const keyBindings = {
    P1_UP: 'ArrowUp', 
    P1_DOWN: 'ArrowDown', 
    P1_LEFT: 'ArrowLeft', 
    P1_RIGHT: 'ArrowRight', 
    P1_BOMB: 'Space', 
    P1_CHANGE: 'KeyX', // Dein 'Change' Key

    // Player 2 Fallback
    P2_UP: 'KeyW', P2_DOWN: 'KeyS', P2_LEFT: 'KeyA', P2_RIGHT: 'KeyD', P2_BOMB: 'KeyF', P2_CHANGE: 'KeyE'
};