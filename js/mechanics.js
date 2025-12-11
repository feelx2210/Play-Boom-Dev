import { state } from './state.js';
import { TYPES, ITEMS, BOOST_PADS, HELL_CENTER, TILE_SIZE, GRID_W, GRID_H } from './constants.js';
import { createFloatingText } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// Helper: Erzeugt Trümmer-Partikel (für Wände, Items, Spieler)
function spawnDebris(x, y, count, color, speed = 2, size = 3) {
    const cx = x * TILE_SIZE + TILE_SIZE/2;
    const cy = y * TILE_SIZE + TILE_SIZE/2;
    for(let i=0; i<count; i++) {
        state.particles.push({ 
            x: cx, y: cy, 
            vx: (Math.random()-0.5) * speed, 
            vy: (Math.random()-0.5) * speed, 
            life: 30 + Math.random() * 30, 
            color: color, 
            size: Math.random() * size 
        });
    }
}

export function triggerHellFire() {
    const duration = 100; 
    const range = 5; 
    
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = HELL_CENTER.x + (d.x * i); 
            const ty = HELL_CENTER.y + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            
            const type = (i === range) ? 'end' : 'middle';
            
            if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                createFire(tx, ty, duration, false, 'end', d); 
                break; // Feuer stoppt an Wand
            } else { 
                destroyItem(tx, ty); 
                createFire(tx, ty, duration, false, type, d); 
            }
        }
    });
}

export function explodeBomb(b) {
    b.owner.activeBombs--; 
    
    // Grid aufräumen (wenn Bombe nicht rollt, Kachel wiederherstellen)
    if (!b.isRolling) {
        state.grid[b.gy][b.gx] = (b.underlyingTile !== undefined) ? b.underlyingTile : TYPES.EMPTY;
    }
    
    const isBoostPad = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
    const isOilSource = (b.underlyingTile === TYPES.OIL);
    const range = (isBoostPad || isOilSource) ? 15 : b.range; 
    
    // Zentrum-Logik
    let centerDur = (isOilSource || b.napalm) ? 720 : 60;
    if (b.underlyingTile === TYPES.WATER) centerDur = 60; // Wasser löscht Napalm

    destroyItem(b.gx, b.gy); 
    extinguishNapalm(b.gx, b.gy); 
    createFire(b.gx, b.gy, centerDur, b.napalm, 'center', null, isOilSource);
    
    // Strahlen in 4 Richtungen
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = b.gx + (d.x * i); 
            const ty = b.gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;

            // Logik für Feuer-Art
            const isTileOil = (tile === TYPES.OIL);
            let dur = (isTileOil || b.napalm) ? 720 : 60;
            let useNapalm = b.napalm;
            
            if (tile === TYPES.WATER) { useNapalm = false; dur = 60; }

            const type = (i === range) ? 'end' : 'middle';

            if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, dur, useNapalm, 'end', d, isTileOil); 
                break; // Stoppt hier
            } else { 
                destroyItem(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, dur, useNapalm, type, d, isTileOil); 
            }
        }
    });
}

export function extinguishNapalm(gx, gy) { 
    // Sucht existierendes Napalm an dieser Stelle und löscht es
    const existing = state.particles.find(p => p.isFire && p.isNapalm && p.gx === gx && p.gy === gy);
    if (existing) existing.life = 0;
}

export function destroyItem(x, y) { 
    if (state.items[y][x] !== ITEMS.NONE) { 
        state.items[y][x] = ITEMS.NONE; 
        createFloatingText(x * TILE_SIZE, y * TILE_SIZE, "ASHES", "#555555"); 
        spawnDebris(x, y, 5, '#333333');
    } 
}

export function createFire(gx, gy, duration, isNapalm = false, type = 'center', dir = null, isOilFire = false) { 
    state.particles.push({ 
        gx, gy, 
        isFire: true, 
        isNapalm, 
        isOilFire, 
        life: duration, 
        maxLife: duration,
        type, dir    
    }); 
}

export function destroyWall(x, y) { 
    state.grid[y][x] = TYPES.EMPTY; 
    spawnDebris(x, y, 6, '#882222', 4, 5);
}

export function killPlayer(p) { 
    if (p.invincibleTimer > 0 || !p.alive) return; 
    p.alive = false; 
    p.deathTimer = 90; 
    createFloatingText(p.x, p.y, "ELIMINATED", "#ff0000"); 
    
    // Pixel-Blut/Trümmer an der genauen Pixel-Position des Spielers
    const cx = p.x + 24; const cy = p.y + 24;
    for(let i=0; i<15; i++) { 
        state.particles.push({ 
            x: cx, y: cy, 
            vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, 
            life: 60, color: '#666666', size: 4 
        }); 
    }
}

export function spawnRandomIce() {
    for(let i=0; i<50; i++) {
        let x = Math.floor(Math.random() * (GRID_W - 2)) + 1;
        let y = Math.floor(Math.random() * (GRID_H - 2)) + 1;

        if (state.grid[y][x] !== TYPES.EMPTY) continue;
        
        const blockedByEntity = state.players.some(p => Math.round(p.x/TILE_SIZE) === x && Math.round(p.y/TILE_SIZE) === y) ||
                                state.bombs.some(b => b.gx === x && b.gy === y) ||
                                state.particles.some(p => p.isFire && p.gx === x && p.gy === y);
                                
        if (blockedByEntity) continue;
        
        state.particles.push({ type: 'freezing', gx: x, gy: y, life: 60, maxLife: 60 });
        return;
    }
}