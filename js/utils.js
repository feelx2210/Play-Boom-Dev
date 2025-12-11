import { state } from './state.js';
import { GRID_W, GRID_H, TYPES } from './constants.js';

// Prüft, ob ein Feld blockiert ist (Wand oder Bombe)
export function isSolid(x, y) {
    // Außerhalb des Grids ist immer "fest"
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return true;
    
    const t = state.grid[y][x];
    return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT || t === TYPES.BOMB;
}

// Erzeugt schwebenden Text (für Punkte oder Status-Effekte)
export function createFloatingText(x, y, text, color='#ffffff') {
    state.particles.push({
        x: x, 
        y: y, 
        text: text, 
        life: 60, 
        color: color, 
        vy: -1 // Steigt nach oben
    });
}