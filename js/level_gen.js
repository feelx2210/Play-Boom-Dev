import { GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, DIRECTION_PADS, OIL_PADS, HELL_CENTER } from './constants.js';
import { state } from './state.js';

export function initLevel() {
    state.grid = []; 
    state.items = [];
    
    // 1. Grid erstellen
    for (let y = 0; y < GRID_H; y++) {
        let row = []; 
        let itemRow = [];
        for (let x = 0; x < GRID_W; x++) {
            // Rand-Mauern
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
                row.push(TYPES.WALL_HARD);
            }
            // Feste Säulen (jedes 2. Feld)
            else if (x % 2 === 0 && y % 2 === 0) {
                row.push(TYPES.WALL_HARD);
            }
            // Jungle Features (Brücke/Wasser)
            else if (state.currentLevel.id === 'jungle' && y === 7) {
                if (x === 3 || x === 7 || x === 11) row.push(TYPES.BRIDGE);
                else row.push(TYPES.WATER);
            }
            // Spezial-Pads (Boost/Direction) -> Immer frei
            else if ((state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                row.push(TYPES.EMPTY);
            }
            else if (DIRECTION_PADS.some(p => p.x === x && p.y === y)) {
                row.push(TYPES.EMPTY);
            }
            // Zufällige Soft Walls
            else if (Math.random() < 0.7) {
                row.push(TYPES.WALL_SOFT);
            }
            else {
                row.push(TYPES.EMPTY);
            }
            itemRow.push(ITEMS.NONE);
        }
        state.grid.push(row); 
        state.items.push(itemRow);
    }

    // 2. Level-Spezifische Anpassungen (Öl)
    if (state.currentLevel.id === 'hell') {
        OIL_PADS.forEach(oil => { 
            if(state.grid[oil.y][oil.x] !== TYPES.WALL_HARD) {
                state.grid[oil.y][oil.x] = TYPES.OIL; 
                state.items[oil.y][oil.x] = ITEMS.NONE;
            } 
        });
    }

    // 3. Start-Ecken freiräumen (für Spieler)
    const corners = [
        {x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1}, 
        {x: GRID_W-2, y: 1}, {x: GRID_W-2, y: 2}, {x: GRID_W-3, y: 1}, 
        {x: 1, y: GRID_H-2}, {x: 1, y: GRID_H-3}, {x: 2, y: GRID_H-2}, 
        {x: GRID_W-2, y: GRID_H-2}, {x: GRID_W-3, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-3}
    ];
    corners.forEach(p => state.grid[p.y][p.x] = TYPES.EMPTY);

    // Jungle Wasser bereinigen
    if (state.currentLevel.id === 'jungle') {
        for(let x=1; x<GRID_W-1; x++) state.items[7][x] = ITEMS.NONE; 
    }
    
    // Hell Center freiräumen
    if (state.currentLevel.hasCentralFire) { 
        state.grid[HELL_CENTER.y][HELL_CENTER.x] = TYPES.EMPTY; 
        state.items[HELL_CENTER.y][HELL_CENTER.x] = ITEMS.NONE; 
    }
    
    // 4. Items verteilen
    distributeItems();
}

function distributeItems() {
    let softWalls = [];
    for(let y=0; y<GRID_H; y++) {
        for(let x=0; x<GRID_W; x++) {
            if (state.grid[y][x] === TYPES.WALL_SOFT) softWalls.push({x,y});
        }
    }
    
    // Mischen
    softWalls.sort(() => Math.random() - 0.5);
    
    const itemCounts = [ 
        {type: ITEMS.BOMB_UP, count: 8}, 
        {type: ITEMS.RANGE_UP, count: 8}, 
        {type: ITEMS.SPEED_UP, count: 4}, 
        {type: ITEMS.NAPALM, count: 2}, 
        {type: ITEMS.ROLLING, count: 3}, 
        {type: ITEMS.SKULL, count: 4} 
    ];
    
    let idx = 0;
    itemCounts.forEach(def => {
        for(let i=0; i<def.count; i++) {
            if (idx < softWalls.length) { 
                state.items[softWalls[idx].y][softWalls[idx].x] = def.type; 
                idx++; 
            }
        }
    });
}