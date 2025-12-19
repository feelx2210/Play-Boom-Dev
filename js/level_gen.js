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
            // A. Rand-Mauern
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
                row.push(TYPES.WALL_HARD);
            }
            // B. Feste Säulen (jedes 2. Feld)
            else if (x % 2 === 0 && y % 2 === 0) {
                row.push(TYPES.WALL_HARD);
            }
            // C. Level-Spezifische Böden
            else {
                let type = TYPES.EMPTY;
                
                // Jungle Features
                if (state.currentLevel.id === 'jungle' && y === 7) {
                    if (x === 3 || x === 7 || x === 11) type = TYPES.BRIDGE;
                    else type = TYPES.WATER;
                }
                // Beach Features (Sinus-Welle)
                else if (state.currentLevel.id === 'beach') {
                    // Welle schwappt um Spalte 10 (ca. 35% rechts)
                    const limit = 9 + Math.sin(y * 0.8) * 1.5; 
                    if (x > limit) type = TYPES.WATER;
                }

                // Wände setzen (wenn Boden leer ist)
                if (type === TYPES.EMPTY || (state.currentLevel.id === 'beach' && type === TYPES.WATER)) {
                    // Spezial-Pads freihalten
                    const isBoost = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y);
                    const isDir = DIRECTION_PADS.some(p => p.x === x && p.y === y);
                    const isBeachBoost = (state.currentLevel.id === 'beach' && BOOST_PADS.some(p => p.x === x && p.y === y));

                    if (!isBoost && !isDir && !isBeachBoost) {
                         if (Math.random() < 0.7) type = TYPES.WALL_SOFT;
                         else if (state.currentLevel.id === 'beach' && type === TYPES.WATER) type = TYPES.WATER; // Zurücksetzen auf reines Wasser wenn keine Wand
                    } else {
                        // Auf Pads muss der Boden-Typ erhalten bleiben (z.B. Wasser), 
                        // aber keine Wand drauf. Bei Beach Boost Pads im Wasser -> Wasser bleibt.
                        if (state.currentLevel.id === 'beach' && type === TYPES.WATER) type = TYPES.WATER; 
                        else type = TYPES.EMPTY;
                    }
                }
                
                // Falls wir im Beach-Wasser sind und eine Wand gesetzt wurde, bleibt es TYPES.WALL_SOFT.
                // Das Rendering unterscheidet später visuell, ob die Softwall im Wasser steht.
                
                row.push(type);
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

    // 3. Start-Ecken freiräumen
    const corners = [
        {x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1}, 
        {x: GRID_W-2, y: 1}, {x: GRID_W-2, y: 2}, {x: GRID_W-3, y: 1}, 
        {x: 1, y: GRID_H-2}, {x: 1, y: GRID_H-3}, {x: 2, y: GRID_H-2}, 
        {x: GRID_W-2, y: GRID_H-2}, {x: GRID_W-3, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-3}
    ];
    corners.forEach(p => {
        // Im Beach-Level: Wenn Ecke im Wasser ist, Wasser lassen, aber Wand weg
        if (state.currentLevel.id === 'beach' && state.grid[p.y][p.x] === TYPES.WALL_SOFT) {
             // Prüfen ob es Wasserbereich ist
             const limit = 9 + Math.sin(p.y * 0.8) * 1.5;
             if (p.x > limit) state.grid[p.y][p.x] = TYPES.WATER;
             else state.grid[p.y][p.x] = TYPES.EMPTY;
        } else {
             // Normalfall (Jungle Bridge/Water wird hier überschrieben zu Empty - ist ok für Start)
             if (state.currentLevel.id !== 'jungle' && state.currentLevel.id !== 'beach') state.grid[p.y][p.x] = TYPES.EMPTY;
             // Jungle Fix
             if (state.currentLevel.id === 'jungle' && state.grid[p.y][p.x] !== TYPES.WATER && state.grid[p.y][p.x] !== TYPES.BRIDGE) state.grid[p.y][p.x] = TYPES.EMPTY;
        }
    });

    // Jungle Wasser bereinigen (Start-Reihen Items weg)
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
        let placed = 0;
        let attempts = 0;
        
        while(placed < def.count && idx < softWalls.length) {
            const pos = softWalls[idx];
            idx++;
            
            // BEACH SPECIAL LOGIC: Keine Skulls im Wasser
            if (state.currentLevel.id === 'beach' && def.type === ITEMS.SKULL) {
                const limit = 9 + Math.sin(pos.y * 0.8) * 1.5;
                if (pos.x > limit) {
                    // Ist im Wasser -> Skull verboten!
                    // Wir geben dem Bot stattdessen was Nützliches (Speed oder Bomb)
                    const relief = Math.random() > 0.5 ? ITEMS.SPEED_UP : ITEMS.BOMB_UP;
                    state.items[pos.y][pos.x] = relief;
                    // Wir zählen den Skull nicht als "placed", weil wir ja keinen gesetzt haben.
                    // Aber wir haben die Wand "verbraucht".
                    // Das reduziert die Gesamtanzahl an Skulls im Level etwas, was ok ist.
                    continue; 
                }
            }
            
            state.items[pos.y][pos.x] = def.type;
            placed++;
        }
    });
}