import { state } from './state.js';
import { TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, TILE_SIZE, GRID_W, GRID_H } from './constants.js';
import { createFloatingText } from './utils.js';

// --- HILFSFUNKTIONEN FÜR SPIELMECHANIK ---

export function triggerHellFire() {
    const duration = 100; 
    const range = 5; 
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = state.grid[ty][tx];
            let type = (i === range) ? 'end' : 'middle';
            
            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { 
                type = 'end';
                destroyWall(tx, ty); 
                createFire(tx, ty, duration, false, type, d); 
                break; 
            } 
            else { 
                destroyItem(tx, ty); 
                createFire(tx, ty, duration, false, type, d); 
            }
        }
    });
}

export function explodeBomb(b) {
    b.owner.activeBombs--; 
    if (!b.isRolling) {
        const fallbackTile = TYPES.EMPTY;
        state.grid[b.gy][b.gx] = (b.underlyingTile !== undefined) ? b.underlyingTile : fallbackTile;
    }
    
    const isBoostPad = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
    const isOilSource = (b.underlyingTile === TYPES.OIL);
    const range = (isBoostPad || isOilSource) ? 15 : b.range; 
    
    let centerNapalm = b.napalm;
    let centerIsOil = isOilSource;
    let centerDuration = 100;

    if (isOilSource) centerDuration = 820; 
    else if (b.napalm) centerDuration = 820; 

    if (b.underlyingTile === TYPES.WATER) {
        centerNapalm = false;
        centerIsOil = false;
        centerDuration = 100;
    }

    destroyItem(b.gx, b.gy); 
    extinguishNapalm(b.gx, b.gy); 
    createFire(b.gx, b.gy, centerDuration, centerNapalm, 'center', null, centerIsOil);
    
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = state.grid[ty][tx];
            
            let tileIsOil = (tile === TYPES.OIL);
            let tileNapalm = b.napalm;
            let tileIsOilFire = tileIsOil; 
            
            let tileDuration = 100; 
            if (tileIsOil) tileDuration = 820; 
            else if (tileNapalm) tileDuration = 820; 

            if (tile === TYPES.WATER) {
                tileNapalm = false;
                tileIsOilFire = false;
                tileDuration = 100;
            }

            let type = (i === range) ? 'end' : 'middle';

            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { 
                type = 'end';
                destroyWall(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, tileDuration, tileNapalm, type, d, tileIsOilFire); 
                break; 
            } else { 
                destroyItem(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, tileDuration, tileNapalm, type, d, tileIsOilFire); 
            }
        }
    });
}

export function extinguishNapalm(gx, gy) { 
    state.particles.forEach(p => { 
        if (p.isFire && p.isNapalm && p.gx === gx && p.gy === gy) p.life = 0; 
    }); 
}

export function destroyItem(x, y) { 
    if (state.items[y][x] !== ITEMS.NONE) { 
        state.items[y][x] = ITEMS.NONE; 
        createFloatingText(x * TILE_SIZE, y * TILE_SIZE, "ASHES", "#555555"); 
        for(let i=0; i<5; i++) state.particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 30, color: '#333333', size: Math.random()*3 }); 
    } 
}

export function createFire(gx, gy, duration, isNapalm = false, type = 'center', dir = null, isOilFire = false) { 
    state.particles.push({ 
        gx: gx, 
        gy: gy, 
        isFire: true, 
        isNapalm: isNapalm, 
        isOilFire: isOilFire, 
        life: duration, 
        maxLife: duration,
        type: type, 
        dir: dir    
    }); 
}

export function destroyWall(x, y) { 
    state.grid[y][x] = TYPES.EMPTY; 
    for(let i=0; i<5; i++) state.particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 20, color: '#882222', size: Math.random()*5 }); 
}

export function killPlayer(p) { 
    if (p.invincibleTimer > 0 || !p.alive) return; 
    p.alive = false; 
    p.deathTimer = 90; 
    createFloatingText(p.x, p.y, "ELIMINATED", "#ff0000"); 
    for(let i=0; i<15; i++) { 
        state.particles.push({ x: p.x + 24, y: p.y + 24, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 60, color: '#666666', size: 4 }); 
    }
}
