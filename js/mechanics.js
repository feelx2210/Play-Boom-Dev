import { state } from './state.js';
import { TYPES, ITEMS, BOOST_PADS, HELL_CENTER, TILE_SIZE, GRID_W, GRID_H, DIRECTION_PADS } from './constants.js';
import { createFloatingText, isSolid } from './utils.js';

const DIRS = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

// --- UPDATE LOOPS ---

export function updateHellFire() {
    if (!state.currentLevel.hasCentralFire) return;

    if (!state.hellFireActive) { 
        if (state.particles.some(p => p.isFire && p.gx === HELL_CENTER.x && p.gy === HELL_CENTER.y)) { 
            state.hellFireActive = true; 
            state.hellFirePhase = 'WARNING'; 
            state.hellFireTimer = 0; 
            createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "ACTIVATED!", "#ff0000"); 
        } 
    } else { 
        state.hellFireTimer++; 
        if (state.hellFirePhase === 'IDLE' && state.hellFireTimer >= 2200) { 
            state.hellFireTimer = 0; 
            state.hellFirePhase = 'WARNING'; 
            createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "!", "#ff0000"); 
        } else if (state.hellFirePhase === 'WARNING' && state.hellFireTimer >= 225) { 
            state.hellFireTimer = 0; 
            state.hellFirePhase = 'IDLE'; 
            triggerHellFire(); 
        } 
    }
}

export function updateIce() {
    if (state.currentLevel.id !== 'ice') return;
    state.iceTimer++; 
    if (state.iceTimer > 1200) { 
        state.iceSpawnCountdown--; 
        if (state.iceSpawnCountdown <= 0) { 
            spawnRandomIce(); 
            spawnRandomIce(); 
            state.iceSpawnCountdown = 1200; 
        } 
    }
}

export function updateBombs() {
    for (let i = state.bombs.length - 1; i >= 0; i--) {
        let b = state.bombs[i]; 
        b.timer--;
        
        // Rolling Logic
        if (b.isRolling) {
            const dirPad = DIRECTION_PADS.find(p => p.x === b.gx && p.y === b.gy);
            if (dirPad && (b.rollDir.x !== dirPad.dir.x || b.rollDir.y !== dirPad.dir.y)) {
                const centerX = b.gx * TILE_SIZE; const centerY = b.gy * TILE_SIZE;
                if ((b.px - centerX) ** 2 + (b.py - centerY) ** 2 < 25) { 
                    b.px = centerX; b.py = centerY; 
                    b.rollDir = dirPad.dir; 
                }
            }
            
            b.px += b.rollDir.x * b.rollSpeed; 
            b.py += b.rollDir.y * b.rollSpeed;
            
            const nextGx = Math.floor((b.px + TILE_SIZE/2) / TILE_SIZE); 
            const nextGy = Math.floor((b.py + TILE_SIZE/2) / TILE_SIZE);
            
            if (state.particles.some(p => p.isFire && p.gx === nextGx && p.gy === nextGy)) { 
                b.isRolling = false; b.gx = nextGx; b.gy = nextGy; b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; b.timer = 0; 
            }
            else {
                let collision = false;
                if (nextGx < 0 || nextGx >= GRID_W || nextGy < 0 || nextGy >= GRID_H) collision = true;
                else if (state.grid[nextGy][nextGx] === TYPES.WALL_HARD || state.grid[nextGy][nextGx] === TYPES.WALL_SOFT || state.grid[nextGy][nextGx] === TYPES.BOMB) collision = true;
                
                if (!collision) { 
                    const bRect = { l: b.px, r: b.px + TILE_SIZE, t: b.py, b: b.py + TILE_SIZE }; 
                    const hitPlayer = state.players.find(p => { 
                        if (!p.alive) return false; 
                        if (b.walkableIds.includes(p.id)) return false; 
                        const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; 
                        const pRect = { l: p.x + offset, r: p.x + size + offset, t: p.y + offset, b: p.y + size + offset }; 
                        return (bRect.l < pRect.r && bRect.r > pRect.l && bRect.t < pRect.b && bRect.b > pRect.t); 
                    }); 
                    if (hitPlayer) collision = true; 
                }
                
                if (collision) { 
                    b.isRolling = false; 
                    b.gx = Math.round(b.px / TILE_SIZE); b.gy = Math.round(b.py / TILE_SIZE); 
                    
                    let occupied = state.players.some(p => { 
                        if (!p.alive) return false; 
                        const pGx = Math.round(p.x / TILE_SIZE); const pGy = Math.round(p.y / TILE_SIZE); 
                        return pGx === b.gx && pGy === b.gy && !b.walkableIds.includes(p.id); 
                    }); 
                    
                    if (state.grid[b.gy][b.gx] !== TYPES.EMPTY && state.grid[b.gy][b.gx] !== TYPES.OIL && state.grid[b.gy][b.gx] !== TYPES.WATER && state.grid[b.gy][b.gx] !== TYPES.BRIDGE) { 
                        b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; 
                    } else if (occupied) { 
                        b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; 
                    } 
                    
                    b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE; 
                    b.underlyingTile = state.grid[b.gy][b.gx]; 
                    state.grid[b.gy][b.gx] = TYPES.BOMB; 
                } else { 
                    b.gx = nextGx; b.gy = nextGy; 
                }
            }
        }
        
        b.walkableIds = b.walkableIds.filter(pid => { 
            const p = state.players.find(pl => pl.id === pid); 
            if (!p) return false; 
            const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2; 
            const pLeft = p.x + offset; const pRight = pLeft + size; const pTop = p.y + offset; const pBottom = pTop + size; 
            const bLeft = b.px; const bRight = bLeft + TILE_SIZE; const bTop = b.py; const bBottom = bTop + TILE_SIZE; 
            return (pLeft < bRight && pRight > bLeft && pTop < bBottom && pBottom > bTop); 
        });
        
        if (b.timer <= 0) { 
            explodeBomb(b); 
            state.bombs.splice(i, 1); 
        }
    }
}

export function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; 
        p.life--; 
        if (p.text) p.y += p.vy; 
        
        if (p.isFire) {
            const fireX = p.gx * TILE_SIZE; const fireY = p.gy * TILE_SIZE; const tolerance = 6; 
            const fkLeft = fireX + tolerance; const fkRight = fireX + TILE_SIZE - tolerance; 
            const fkTop = fireY + tolerance; const fkBottom = fireY + TILE_SIZE - tolerance;
            
            // Spieler Hit
            state.players.forEach(pl => { 
                if (!pl.alive) return; 
                const hurtSize = 24; 
                const pCx = pl.x + TILE_SIZE/2; const pCy = pl.y + TILE_SIZE/2; 
                const plLeft = pCx - hurtSize/2; const plRight = pCx + hurtSize/2; 
                const plTop = pCy - hurtSize/2; const plBottom = pCy + hurtSize/2; 
                
                if (plLeft < fkRight && plRight > fkLeft && plTop < fkBottom && plBottom > fkTop) {
                    pl.inFire = true;
                    
                    // NEU: Napalm ist heißer/klebriger!
                    // Fügt zusätzlichen Hitzeschaden hinzu.
                    // Normaler Speed (2) ist zu langsam und stirbt.
                    // Schneller Speed (>2) kommt schnell genug durch.
                    if (p.isNapalm) {
                        pl.fireTimer = (pl.fireTimer || 0) + 1; // Extra Tick pro Frame
                    }
                }
            });
            
            // Bomben Kettenreaktion
            const hitBombIndex = state.bombs.findIndex(b => b.gx === p.gx && b.gy === p.gy); 
            if (hitBombIndex !== -1) { 
                const chainedBomb = state.bombs[hitBombIndex]; 
                if (chainedBomb.timer > 1) { 
                    if(chainedBomb.isRolling) { 
                        chainedBomb.isRolling = false; 
                        chainedBomb.px = chainedBomb.gx * TILE_SIZE; 
                        chainedBomb.py = chainedBomb.gy * TILE_SIZE; 
                        chainedBomb.underlyingTile = state.grid[chainedBomb.gy][chainedBomb.gx]; 
                    } 
                    chainedBomb.timer = 0; 
                } 
            }
        }
        
        if (p.type === 'freezing' && p.life <= 0) { 
            state.grid[p.gy][p.gx] = TYPES.WALL_SOFT; 
            if (Math.random() < 0.3) { 
                const itemPool = [ITEMS.BOMB_UP, ITEMS.BOMB_UP, ITEMS.BOMB_UP, ITEMS.RANGE_UP, ITEMS.RANGE_UP, ITEMS.RANGE_UP, ITEMS.SPEED_UP, ITEMS.SPEED_UP, ITEMS.SKULL, ITEMS.ROLLING, ITEMS.NAPALM]; 
                state.items[p.gy][p.gx] = itemPool[Math.floor(Math.random() * itemPool.length)]; 
            } 
        }
        
        if (p.life <= 0) state.particles.splice(i, 1);
    }
}

export function handleInfection() {
    const livingPlayers = state.players.filter(p => p.alive);
    for (let i = 0; i < livingPlayers.length; i++) {
        for (let j = i + 1; j < livingPlayers.length; j++) {
            const p1 = livingPlayers[i]; 
            const p2 = livingPlayers[j]; 
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            
            if (dist < TILE_SIZE * 0.8) {
                if (p1.activeCurses.length > 0 && p2.activeCurses.length === 0) { 
                    p1.activeCurses.forEach(c => p2.addCurse(c.type)); 
                    createFloatingText(p2.x, p2.y, "INFECTED!", "#ff00ff"); 
                }
                else if (p2.activeCurses.length > 0 && p1.activeCurses.length === 0) { 
                    p2.activeCurses.forEach(c => p1.addCurse(c.type)); 
                    createFloatingText(p1.x, p1.y, "INFECTED!", "#ff00ff"); 
                }
            }
        }
    }
}

// --- HELPER ---

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
                break; 
            } else { 
                destroyItem(tx, ty); 
                createFire(tx, ty, duration, false, type, d); 
            }
        }
    });
}

export function explodeBomb(b) {
    b.owner.activeBombs--; 
    
    if (!b.isRolling) {
        state.grid[b.gy][b.gx] = (b.underlyingTile !== undefined) ? b.underlyingTile : TYPES.EMPTY;
    }
    
    const isBoostPad = (state.currentLevel.id === 'hell' || state.currentLevel.id === 'ice') && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
    const isOilSource = (b.underlyingTile === TYPES.OIL);
    const range = (isBoostPad || isOilSource) ? 15 : b.range; 
    
    let centerDur = (isOilSource || b.napalm) ? 720 : 60;
    if (b.underlyingTile === TYPES.WATER) centerDur = 60; 

    destroyItem(b.gx, b.gy); 
    extinguishNapalm(b.gx, b.gy); 
    createFire(b.gx, b.gy, centerDur, b.napalm, 'center', null, isOilSource);
    
    DIRS.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = b.gx + (d.x * i); 
            const ty = b.gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = state.grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;

            const isTileOil = (tile === TYPES.OIL);
            let dur = (isTileOil || b.napalm) ? 720 : 60;
            let useNapalm = b.napalm;
            
            if (tile === TYPES.WATER) { useNapalm = false; dur = 60; }

            const type = (i === range) ? 'end' : 'middle';

            if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, dur, useNapalm, 'end', d, isTileOil); 
                break; 
            } else { 
                destroyItem(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, dur, useNapalm, type, d, isTileOil); 
            }
        }
    });
}

export function extinguishNapalm(gx, gy) { 
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