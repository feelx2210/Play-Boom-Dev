// js/constants.js

export const TILE_SIZE = 48; 
export const GRID_W = 15;
export const GRID_H = 15;

// NEU: Schwierigkeitsgrade
export const DIFFICULTIES = {
    EASY: 0,   // Zufällig, selten Bomben
    MEDIUM: 1, // Zerstört Wände, weicht aus
    HARD: 2    // Jagt Spieler, legt Fallen, aggressiv
};

export const COLORS = {
    EXPLOSION_CORE: '#ffffcc'
};

export const keyBindings = {
    UP: 'ArrowUp',
    DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    BOMB: 'Space',
    CHANGE: 'KeyX'
};

export const BOOST_PADS = [
    {x: 5, y: 5}, {x: 9, y: 5}, {x: 5, y: 9}, {x: 9, y: 9}
];

export const DIRECTION_PADS = [
    { x: 3, y: 3, dir: {x: 1, y: 0} },    
    { x: 11, y: 3, dir: {x: 0, y: 1} },   
    { x: 11, y: 11, dir: {x: -1, y: 0} }, 
    { x: 3, y: 11, dir: {x: 0, y: -1} }   
];

export const OIL_PADS = [
    {x: 3, y: 5}, {x: 3, y: 6}, {x: 3, y: 7}, {x: 3, y: 8}, {x: 3, y: 9},
    {x: 4, y: 9}, {x: 6, y: 9}, {x: 7, y: 9}, {x: 8, y: 9},
    {x: 11, y: 9}, {x: 11, y: 8}, {x: 11, y: 7}, {x: 11, y: 6}, {x: 11, y: 5},
    {x: 10, y: 5}, {x: 8, y: 5}, {x: 7, y: 5}, {x: 6, y: 5}, {x: 4, y: 5}
];

export const HELL_CENTER = { x: 7, y: 7 };

export const CHARACTERS = [
    { id: 'rambo', name: 'Rambo', color: '#44aa44', accent: '#aa0000' }, 
    { id: 'lucifer', name: 'Lucifer', color: '#ff0000', accent: '#000000' }, 
    { id: 'nun', name: 'Nun', color: '#eeeeee', accent: '#000000' }, 
    { id: 'yeti', name: 'Yeti', color: '#00ccff', accent: '#ffffff' }
];

export const LEVELS = {
    hell: { id: 'hell', name: 'Hell', bg: '#3b1e1e', wallHard: '#333333', wallSoft: '#aa0000', wallSoftLight: '#cc3333', grid: '#220a0a', glow: '#ff0000', border: '#550000', hasCentralFire: true },
    ice: { id: 'ice', name: 'Ice', bg: '#000044', wallHard: '#4466ff', wallSoft: '#88ccff', wallSoftLight: '#ccffff', grid: '#000066', glow: '#00ccff', border: '#004488' },
    jungle: { id: 'jungle', name: 'Jungle', bg: '#4a3b2a', wallHard: '#666666', wallSoft: '#228822', wallSoftLight: '#44aa44', grid: '#3a2b1a', glow: '#22aa22', border: '#114411', hasRiver: true },
    stone: { id: 'stone', name: 'Stone', bg: '#1a1a1a', wallHard: '#444444', wallSoft: '#888888', wallSoftLight: '#aaaaaa', grid: '#222222', glow: '#aaaaaa', border: '#666666' }
};

export const TYPES = { EMPTY: 0, WALL_HARD: 1, WALL_SOFT: 2, BOMB: 3, WATER: 5, BRIDGE: 6, OIL: 7 };
export const ITEMS = { NONE: 0, BOMB_UP: 1, RANGE_UP: 2, SPEED_UP: 3, SKULL: 4, NAPALM: 5, ROLLING: 6 };
export const BOMB_MODES = { STANDARD: 0, NAPALM: 1, ROLLING: 2 };