export const TILE_SIZE = 48;
export const GRID_W = 15;
export const GRID_H = 15;

export const HELL_CENTER = { x: 7, y: 7 };

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

// --- CHARACTERS ---
export const CHARACTERS = [
    { id: 'commando', name: 'Commando', color: '#228822', accent: '#ff0000' }, 
    { id: 'rapper', name: 'Rapper', color: '#000000', accent: '#ffd700' }, 
    { id: 'yeti', name: 'Snow Beast', color: '#ffffff', accent: '#00ccff' },   
    { id: 'striker', name: 'Striker', color: '#ff0000', accent: '#ffffff' },   
    { id: 'nun', name: 'The Nun', color: '#000000', accent: '#ffffff' },       
    { id: 'baller', name: 'Baller', color: '#fdb927', accent: '#552583' }, 
    { id: 'agent', name: 'The Agent', color: '#000000', accent: '#ff0000' },   
    { id: 'diva', name: 'Pop Diva', color: '#ffb6c1', accent: '#000000' },     
    { id: 'techie', name: 'Tech CEO', color: '#333333', accent: '#aaaaaa' },   
    { id: 'rap_icon', name: 'Rap Icon', color: '#ffffff', accent: '#3366cc' }, 
    { id: 'devil', name: 'The Devil', color: '#ff0000', accent: '#ffff00' },   
    { id: 'moonwalker', name: 'Dancer', color: '#ffffff', accent: '#000000' }, 
    { id: 'lifeguard', name: 'Lifeguard', color: '#ff2222', accent: '#ffff88' }, 
    { id: 'spy', name: 'The Spy', color: '#555555', accent: '#000000' },        
    { id: 'star', name: 'Pop Star', color: '#0000ff', accent: '#eeeeee' }      
];

// LEVEL DEFINITIONEN
export const LEVELS = {
    hell: { id: 'hell', name: 'Hell', bg: '#3b1e1e', wallHard: '#333333', wallSoft: '#aa0000', wallSoftLight: '#cc3333', grid: '#220a0a', glow: '#ff0000', border: '#550000', hasCentralFire: true },
    ice: { id: 'ice', name: 'Ice', bg: '#000044', wallHard: '#4466ff', wallSoft: '#88ccff', wallSoftLight: '#ccffff', grid: '#000066', glow: '#00ccff', border: '#004488' },
    jungle: { id: 'jungle', name: 'Jungle', bg: '#4a3b2a', wallHard: '#666666', wallSoft: '#228822', wallSoftLight: '#44aa44', grid: '#3a2b1a', glow: '#22aa22', border: '#114411', hasRiver: true },
    stone: { id: 'stone', name: 'Stone', bg: '#1a1a1a', wallHard: '#444444', wallSoft: '#888888', wallSoftLight: '#aaaaaa', grid: '#222222', glow: '#aaaaaa', border: '#666666' },
};

export const BOOST_PADS = [
    {x:5, y:4}, {x:5, y:8}, 
    {x:9, y:4}, {x:9, y:8}
];

export const OIL_PADS = [{x:4, y:4}, {x:10, y:4}, {x:4, y:10}, {x:10, y:10}];

// RICHTUNGEN (Counter-Clockwise Canvas Coords)
export const DIRECTION_PADS = [
    {x:3, y:3, dir:{x:1, y:0}},    // RECHTS
    {x:3, y:11, dir:{x:0, y:-1}},  // OBEN
    {x:11, y:11, dir:{x:-1, y:0}}, // LINKS
    {x:11, y:3, dir:{x:0, y:1}}    // UNTEN
];

export const keyBindings = {
    P1_UP: 'ArrowUp', P1_DOWN: 'ArrowDown', P1_LEFT: 'ArrowLeft', P1_RIGHT: 'ArrowRight', P1_BOMB: 'Space', P1_CHANGE: 'KeyX',
    P2_UP: 'KeyW', P2_DOWN: 'KeyS', P2_LEFT: 'KeyA', P2_RIGHT: 'KeyD', P2_BOMB: 'KeyF', P2_CHANGE: 'KeyE'
};