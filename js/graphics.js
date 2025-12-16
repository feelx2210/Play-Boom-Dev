import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas'); // Safety

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; c.height = 48; // Original Größe
    const ctx = c.getContext('2d');
    ctx.translate(24, 24);

    // --- ORIGINAL LOGIK (UNVERÄNDERT) ---
    if (charDef.id === 'lucifer') {
        const cBase = '#e62020'; const cDark = '#aa0000'; const cLite = '#ff5555'; const cHoof = '#1a0505'; 
        if (d === 'side') { ctx.fillStyle = cDark; ctx.fillRect(2, 12, 6, 10); ctx.fillStyle = cHoof; ctx.fillRect(2, 20, 6, 4); ctx.fillStyle = cBase; ctx.fillRect(-6, 12, 6, 10); ctx.fillStyle = cHoof; ctx.fillRect(-6, 20, 6, 4); } 
        else { ctx.fillStyle = cBase; ctx.fillRect(-8, 12, 6, 10); ctx.fillRect(2, 12, 6, 10); ctx.fillStyle = cHoof; ctx.fillRect(-8, 20, 6, 4); ctx.fillRect(2, 20, 6, 4); }
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 10); bodyGrad.addColorStop(0, '#ff4444'); bodyGrad.addColorStop(1, '#aa0000'); ctx.fillStyle = bodyGrad; ctx.fillRect(-8, -18, 16, 30);
        if (d === 'front') { ctx.fillStyle = cDark; ctx.fillRect(-1, -14, 2, 16); ctx.fillRect(-7, -8, 6, 2); ctx.fillRect(1, -8, 6, 2); ctx.fillStyle = cLite; ctx.fillRect(-9, -18, 4, 4); ctx.fillRect(5, -18, 4, 4); }
        const headGrad = ctx.createLinearGradient(0, -24, 0, -10); headGrad.addColorStop(0, '#ff5555'); headGrad.addColorStop(1, '#cc0000'); ctx.fillStyle = headGrad; ctx.fillRect(-9, -24, 18, 15); ctx.fillRect(-6, -10, 12, 4);
        const hornGrad = ctx.createLinearGradient(0, -35, 0, -20); hornGrad.addColorStop(0, '#ffffff'); hornGrad.addColorStop(1, '#bbbbbb'); ctx.fillStyle = hornGrad;
        if (d === 'front') { ctx.fillStyle = cBase; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-16, -24); ctx.lineTo(-10, -16); ctx.fill(); ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(16, -24); ctx.lineTo(10, -16); ctx.fill(); ctx.fillStyle = hornGrad; ctx.beginPath(); ctx.moveTo(-7, -24); ctx.quadraticCurveTo(-18, -30, -14, -38); ctx.lineTo(-5, -26); ctx.fill(); ctx.beginPath(); ctx.moveTo(7, -24); ctx.quadraticCurveTo(18, -30, 14, -38); ctx.lineTo(5, -26); ctx.fill(); ctx.fillStyle = '#ffff00'; ctx.fillRect(-8, -20, 5, 4); ctx.fillRect(3, -20, 5, 4); ctx.fillStyle = '#000'; ctx.fillRect(-6, -19, 2, 2); ctx.fillRect(5, -19, 2, 2); ctx.fillStyle = cDark; ctx.fillRect(-2, -16, 4, 2); ctx.fillStyle = '#440000'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(0, -6, 6, -10); ctx.lineTo(0, -8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-5, -10, 2, 2); ctx.fillRect(3, -10, 2, 2); ctx.fillStyle = cBase; ctx.fillRect(-14, -16, 5, 18); ctx.fillRect(9, -16, 5, 18); ctx.fillStyle = cDark; ctx.fillRect(-14, -2, 5, 4); ctx.fillRect(9, -2, 5, 4); } 
        else if (d === 'back') { ctx.fillStyle = cDark; ctx.fillRect(-4, -18, 8, 30); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(-7, -24); ctx.quadraticCurveTo(-18, -30, -14, -38); ctx.lineTo(-5, -26); ctx.fill(); ctx.beginPath(); ctx.moveTo(7, -24); ctx.quadraticCurveTo(18, -30, 14, -38); ctx.lineTo(5, -26); ctx.fill(); ctx.strokeStyle = '#aa0000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(16, 22, 8, 30); ctx.stroke(); ctx.fillStyle = '#aa0000'; ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(12, 34); ctx.lineTo(4, 34); ctx.fill(); ctx.fillStyle = cBase; ctx.fillRect(-14, -16, 5, 18); ctx.fillRect(9, -16, 5, 18); } 
        else if (d === 'side') { ctx.fillStyle = hornGrad; ctx.beginPath(); ctx.moveTo(2, -24); ctx.quadraticCurveTo(10, -30, 12, -38); ctx.lineTo(8, -24); ctx.fill(); ctx.fillStyle = '#ffff00'; ctx.fillRect(4, -19, 4, 4); ctx.fillStyle = cDark; ctx.fillRect(8, -16, 4, 2); ctx.fillStyle = cBase; ctx.fillRect(0, -12, 5, 16); ctx.fillStyle = cDark; ctx.fillRect(0, 0, 6, 4); ctx.strokeStyle = '#aa0000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(-16, 20, -12, 26); ctx.stroke(); }
    } else if (charDef.id === 'rambo') {
        const cGreen = '#226622'; const cDarkG = '#113311'; const cLiteG = '#448844'; const cSkin  = '#ffccaa'; const cSkinS = '#ddaa88'; const cBandana = '#dd0000';
        ctx.fillStyle = cGreen; if (d === 'side') { ctx.fillRect(-5, 12, 8, 8); ctx.fillStyle = '#111'; ctx.fillRect(-5, 20, 9, 4); } else { ctx.fillRect(-10, 12, 8, 8); ctx.fillRect(2, 12, 8, 8); ctx.fillStyle = '#111'; ctx.fillRect(-10, 20, 8, 4); ctx.fillRect(2, 20, 8, 4); }
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 12); bodyGrad.addColorStop(0, '#448844'); bodyGrad.addColorStop(1, '#225522'); ctx.fillStyle = bodyGrad; ctx.fillRect(-12, -20, 24, 32);
        ctx.fillStyle = cDarkG; ctx.fillRect(-10, -16, 6, 4); ctx.fillRect(4, -8, 6, 4); ctx.fillRect(-6, 4, 6, 4); ctx.fillStyle = cLiteG; ctx.fillRect(6, -18, 4, 4); ctx.fillRect(-8, 0, 4, 4); ctx.fillRect(2, 10, 4, 4);
        if (d === 'front') { ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18); ctx.fillStyle = cSkinS; ctx.fillRect(-19, -18, 2, 18); ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(12, 12); ctx.lineTo(6, 12); ctx.lineTo(-12, -14); ctx.fill(); ctx.fillStyle = '#ffcc00'; ctx.fillRect(-9, -18, 3, 5); ctx.fillRect(-3, -10, 3, 5); ctx.fillRect(3, -2, 3, 5); ctx.fillStyle = cSkin; ctx.fillRect(-10, -26, 20, 16); ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(10, -24, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -18, 7, 7); ctx.fillRect(1, -18, 7, 7); ctx.fillStyle = '#000'; ctx.fillRect(-5, -16, 2, 2); ctx.fillRect(3, -16, 2, 2); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(-10, -14, 20, 4); } 
        else if (d === 'back') { ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18); ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(-12, 12); ctx.lineTo(-6, 12); ctx.lineTo(12, -14); ctx.fill(); ctx.fillStyle = '#ffcc00'; ctx.fillRect(8, -16, 4, 6); ctx.fillRect(2, -8, 4, 6); ctx.fillRect(-4, 0, 4, 6); ctx.fillStyle = '#111'; ctx.fillRect(-10, -26, 20, 16); ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(-4, -26, 8, 12); } 
        else if (d === 'side') { ctx.fillStyle = '#553311'; ctx.fillRect(-6, -18, 12, 28); ctx.fillStyle = cSkin; ctx.fillRect(-7, -26, 16, 16); ctx.fillStyle = '#111'; ctx.fillRect(-9, -26, 4, 16); ctx.fillStyle = cBandana; ctx.fillRect(-9, -26, 20, 6); ctx.fillRect(-13, -24, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(4, -18, 5, 6); ctx.fillStyle = '#000'; ctx.fillRect(7, -16, 2, 2); ctx.fillStyle = cSkin; ctx.fillRect(0, -12, 7, 20); ctx.fillStyle = cGreen; ctx.fillRect(0, -16, 7, 4); }
    }
    else if (charDef.id === 'nun') {
        ctx.fillStyle = '#111'; if (d === 'side') ctx.fillRect(-5, 14, 10, 4); else { ctx.fillRect(-7, 14, 6, 4); ctx.fillRect(1, 14, 6, 4); }
        const robeGrad = ctx.createLinearGradient(0, -20, 0, 14); robeGrad.addColorStop(0, '#333'); robeGrad.addColorStop(1, '#000');
        if (d === 'front') { ctx.fillStyle = robeGrad; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(-12, 0, -10, 14); ctx.stroke(); ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(12, 0, 10, 14); ctx.stroke(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(-14, -24, -16, -8); ctx.lineTo(16, -8); ctx.quadraticCurveTo(14, -24, 0, -26); ctx.fill(); ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-4, -17, 2, 2); ctx.fillRect(2, -17, 2, 2); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -19, 10, Math.PI, 0); ctx.fill(); const gold = ctx.createLinearGradient(0,-6,0,10); gold.addColorStop(0,'#ffdd44'); gold.addColorStop(1,'#aa7700'); ctx.fillStyle = gold; ctx.fillRect(-3, -6, 6, 16); ctx.fillRect(-8, -2, 16, 6); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-1, -6, 1, 16); ctx.fillStyle = '#111'; ctx.fillRect(-20, -12, 8, 18); ctx.fillRect(12, -12, 8, 18); ctx.fillStyle = '#ffccaa'; ctx.fillRect(-18, 4, 4, 4); ctx.fillRect(14, 4, 4, 4); } 
        else if (d === 'back') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(-14, -10, -12, 10); ctx.lineTo(12, 10); ctx.quadraticCurveTo(14, -10, 0, -28); ctx.fill(); ctx.fillStyle = '#eee'; ctx.fillRect(-8, -24, 16, 2); ctx.fillStyle = robeGrad; ctx.fillRect(-18, -12, 6, 18); ctx.fillRect(12, -12, 6, 18); } 
        else if (d === 'side') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-14, -10, -12, 14); ctx.lineTo(10, 14); ctx.quadraticCurveTo(12, -10, 0, -24); ctx.fill(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(-8, -26); ctx.lineTo(-10, -8); ctx.lineTo(4, -8); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.quadraticCurveTo(-14, -16, -12, 10); ctx.lineTo(-6, 10); ctx.quadraticCurveTo(-8, -16, -4, -26); ctx.fill(); ctx.fillStyle = '#ffccaa'; ctx.fillRect(2, -22, 6, 12); ctx.fillStyle = '#000'; ctx.fillRect(6, -18, 2, 2); ctx.fillStyle = '#cc9922'; ctx.fillRect(4, 0, 4, 10); ctx.fillRect(2, 2, 8, 4); ctx.fillStyle = '#111'; ctx.fillRect(-2, -12, 10, 18); ctx.fillStyle = '#ffccaa'; ctx.fillRect(-2, 4, 8, 4); }
    }
    else if (charDef.id === 'yeti') {
        const furBase = '#00ccff'; const furDark = '#0088bb'; const furLite = '#e0ffff'; 
        ctx.fillStyle = furBase; if (d === 'side') { ctx.fillRect(-6, 12, 12, 10); } else { ctx.fillRect(-10, 12, 8, 10); ctx.fillRect(2, 12, 8, 10); }
        const furGrad = ctx.createLinearGradient(0, -24, 0, 12); furGrad.addColorStop(0, furBase); furGrad.addColorStop(1, furDark); ctx.fillStyle = furGrad; ctx.fillRect(-16, -24, 32, 36); 
        ctx.fillStyle = furDark; ctx.fillRect(-16, 0, 8, 8); ctx.fillRect(8, -8, 8, 8); ctx.fillRect(-4, 20, 8, 8); ctx.fillStyle = furLite; ctx.fillRect(-12, -20, 4, 4); ctx.fillRect(4, -16, 4, 4); ctx.fillRect(10, 4, 4, 4);
        if (d === 'front') { ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26); ctx.fillStyle = furLite; ctx.fillRect(-22, -16, 8, 4); ctx.fillRect(14, -16, 8, 4); ctx.fillStyle = '#005599'; ctx.fillRect(-12, -20, 24, 14); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -17, 6, 6); ctx.fillRect(2, -17, 6, 6); ctx.fillStyle = '#000'; ctx.fillRect(-6, -16, 2, 2); ctx.fillRect(4, -16, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -8, 3, 4); ctx.fillRect(3, -8, 3, 4); } 
        else if (d === 'back') { ctx.fillStyle = furDark; ctx.fillRect(-10, -14, 20, 24); ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26); } 
        else if (d === 'side') { ctx.fillStyle = '#005599'; ctx.fillRect(6, -20, 10, 14); ctx.fillStyle = '#fff'; ctx.fillRect(10, -17, 4, 6); ctx.fillStyle = '#000'; ctx.fillRect(12, -16, 2, 2); ctx.fillStyle = furBase; ctx.fillRect(-4, -14, 12, 26); ctx.fillStyle = furLite; ctx.fillRect(-4, -14, 12, 4); }
    }
    
    // --- NEUE CHARAKTERE (Detail-Stil, angepasst) ---
    else {
        const fillCircle = (x, y, r, col) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); };
        const gradient = (y1, y2, c1, c2) => { const g = ctx.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };
        
        const id = charDef.id;
        
        // Body Base
        const drawBase = (skin, topCol, botCol, shoes, wMod=1) => {
            // Legs
            ctx.fillStyle = botCol;
            if(d==='side') ctx.fillRect(-5, 12, 10, 12);
            else { ctx.fillRect(-9*wMod, 12, 8*wMod, 12); ctx.fillRect(1*wMod, 12, 8*wMod, 12); }
            // Shoes
            ctx.fillStyle = shoes;
            if(d==='side') ctx.fillRect(-5, 22, 12, 4);
            else { ctx.fillRect(-9*wMod, 22, 8*wMod, 4); ctx.fillRect(1*wMod, 22, 8*wMod, 4); }
            // Torso
            ctx.fillStyle = topCol;
            ctx.beginPath(); 
            ctx.moveTo(-12*wMod, -18); ctx.lineTo(12*wMod, -18); 
            ctx.lineTo(10*wMod, 12); ctx.lineTo(-10*wMod, 12); 
            ctx.fill();
            // Head
            fillCircle(0, -22, 10, skin);
            // Arms
            if(d!=='side') {
                ctx.fillStyle = topCol;
                ctx.beginPath(); ctx.ellipse(-15*wMod, -6, 5, 12, 0.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(15*wMod, -6, 5, 12, -0.2, 0, Math.PI*2); ctx.fill();
                fillCircle(-16*wMod, 6, 4, skin); fillCircle(16*wMod, 6, 4, skin);
            }
        };

        const drawFace = (glass=false, beard=false) => {
            if(d!=='front') return;
            if(!glass) {
                fillCircle(-4, -22, 3, '#fff'); fillCircle(4, -22, 3, '#fff');
                fillCircle(-4, -22, 1.5, '#000'); fillCircle(4, -22, 1.5, '#000');
            } else {
                ctx.fillStyle='#111'; ctx.fillRect(-9, -25, 18, 6);
            }
            if(beard) {
                ctx.fillStyle='rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 10, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            drawBase('#d2b48c', gradient(-14,12,'#f33','#c00'), '#fff', '#fff');
            if(d==='front') { ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('7',0,5); }
            ctx.fillStyle='#210'; ctx.beginPath(); ctx.arc(0,-25,11,Math.PI,0); ctx.fill(); ctx.fillRect(-10,-32,20,8);
            drawFace();
        } else if (id === 'hitman') {
            drawBase('#ffe0bd', gradient(-14,12,'#333','#000'), '#111', '#000');
            if(d==='front') { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(6,-18); ctx.lineTo(0,-6); ctx.fill(); ctx.fillStyle='#c00'; ctx.fillRect(-2,-16,4,14); }
            drawFace();
            if(d==='back') { ctx.fillStyle='#000'; ctx.fillRect(-3,-20,6,2); }
        } else if (id === 'elon') {
            drawBase('#f0d5be', gradient(-14,12,'#222','#111'), '#111', '#333');
            if(d==='front') { ctx.fillStyle='#888'; ctx.beginPath(); ctx.moveTo(-6,-4); ctx.lineTo(6,-4); ctx.lineTo(0,-12); ctx.fill(); }
            ctx.fillStyle='#321'; ctx.beginPath(); ctx.arc(0,-25,11,Math.PI,0); ctx.fill();
            drawFace();
        } else if (id === 'mj') {
            drawBase('#8d5524', gradient(-14,12,'#222','#000'), '#111', '#000', 0.9);
            ctx.fillStyle='#fff'; ctx.fillRect(-9,20,8,2); ctx.fillRect(1,20,8,2);
            if(d==='front') { ctx.fillStyle='#fff'; ctx.fillRect(13,4,6,6); }
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.ellipse(0,-30,14,3,0,0,Math.PI*2); ctx.fill(); ctx.fillRect(-9,-38,18,8); ctx.fillStyle='#fff'; ctx.fillRect(-9,-34,18,2);
            drawFace();
        } else if (id === 'dua') {
            drawBase('#f0d5be', '#111', '#111', '#111', 0.9);
            ctx.fillStyle='#f0d5be'; ctx.fillRect(-10,-4,20,6);
            ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0,-24,11,Math.PI,0); ctx.fill();
            if(d!=='back') { ctx.fillRect(-12,-24,6,22); ctx.fillRect(6,-24,6,22); } else ctx.fillRect(-11,-24,22,22);
            drawFace();
        } else if (id === 'lebron') {
            drawBase('#5c3a1e', gradient(-14,12,'#fb2','#528'), '#528', '#fff', 1.1);
            if(d==='front') { ctx.fillStyle='#528'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('23',0,5); }
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0,-23,10,0,Math.PI*2); ctx.stroke(); ctx.fillRect(-10,-20,20,10);
            ctx.fillStyle='#fff'; ctx.fillRect(-10,-28,20,3);
            drawFace();
        } else if (id === 'pam') {
            const s='#dca386'; drawBase(s, gradient(-14,12,'#f44','#c00'), s, s, 0.9);
            ctx.fillStyle='#f44'; ctx.fillRect(-9,10,18,6); if(d==='front') ctx.fillRect(-4,-14,8,6);
            ctx.fillStyle='#fe8'; ctx.beginPath(); ctx.arc(0,-26,14,Math.PI,0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10,-20,8,16,0.2,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10,-20,8,16,-0.2,0,Math.PI*2); ctx.fill();
            drawFace();
        } else if (id === 'drizzy') {
            drawBase('#ac8b66', gradient(-14,12,'#333','#111'), '#222', '#fff');
            if(d==='front') fillCircle(0,-4,5,'#fd0');
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0,-24,10,Math.PI,0); ctx.fill();
            drawFace(false, true);
        } else if (id === '2pac') {
            drawBase('#7a4e32', '#fff', '#46a', '#fff');
            ctx.fillStyle='#36c'; ctx.fillRect(-10,-28,20,6); if(d==='front') { ctx.beginPath(); ctx.moveTo(8,-26); ctx.lineTo(16,-32); ctx.lineTo(16,-20); ctx.fill(); }
            drawFace(false, true);
        } else if (id === 'gaga') {
            const s=gradient(-14,12,'#08f','#04a'); drawBase('#fee', s, s, '#fff', 0.9);
            ctx.fillStyle='#eed'; ctx.beginPath(); ctx.arc(0,-24,12,Math.PI,0); ctx.fill();
            if(d!=='back') { ctx.fillRect(-12,-24,6,22); ctx.fillRect(6,-24,6,22); }
            ctx.beginPath(); ctx.moveTo(0,-32); ctx.lineTo(-10,-38); ctx.lineTo(-10,-26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0,-32); ctx.lineTo(10,-38); ctx.lineTo(10,-26); ctx.fill();
            drawFace(true);
        } else if (id === '007') {
            drawBase('#f0d5be', gradient(-14,12,'#555','#333'), '#333', '#000');
            if(d==='front') { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-18); ctx.lineTo(0,-8); ctx.lineTo(6,-18); ctx.fill(); ctx.fillStyle='#000'; ctx.fillRect(-3,-16,6,4); }
            ctx.fillStyle='#ca8'; ctx.beginPath(); ctx.arc(0,-24,10,Math.PI,0); ctx.fill();
            drawFace();
        }
    }
    
    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(-25, -35, 50, 60); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

// --- LEVEL CACHING ---
let cachedLevelCanvas = null;
let lastLevelId = null;

export function clearLevelCache() {
    cachedLevelCanvas = null;
    lastLevelId = null;
}

function bakeStaticLevel(levelDef) {
    const c = document.createElement('canvas');
    c.width = GRID_W * TILE_SIZE;
    c.height = GRID_H * TILE_SIZE;
    const ctx = c.getContext('2d');

    // 1. Hintergrund
    ctx.fillStyle = levelDef.bg;
    ctx.fillRect(0, 0, c.width, c.height);

    // 2. Boden-Details
    if (levelDef.id === 'hell') {
         ctx.fillStyle = 'rgba(80, 60, 60, 0.2)';
         for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                if (Math.random() < 0.2) ctx.fillRect(x * TILE_SIZE + Math.random()*40, y * TILE_SIZE + Math.random()*40, 3, 3);
            }
         }
    } else if (levelDef.id === 'ice') {
        for (let i = 0; i < 50; i++) {
             let sx = (Math.sin(i * 123.45) * 43758.5453) % 1 * c.width;
             let sy = (Math.cos(i * 678.90) * 12345.6789) % 1 * c.height;
             if (sx < 0) sx *= -1; if (sy < 0) sy *= -1;
             ctx.fillStyle = i % 2 === 0 ? '#6688aa' : '#ffffff'; ctx.fillRect(sx, sy, 2, 2);
        }
    }

    // 3. Grid Lines
    ctx.strokeStyle = levelDef.grid; ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=GRID_W; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, c.height); }
    for(let i=0; i<=GRID_H; i++) { ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(c.width, i*TILE_SIZE); }
    ctx.stroke();

    // 4. Statische Elemente
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];

            // HARD WALLS (ORIGINAL CODE)
            if (tile === TYPES.WALL_HARD) {
                if (levelDef.id === 'ice') {
                    ctx.fillStyle = '#4466ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#6688ff'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = '#2244aa'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                    ctx.fillStyle = '#ccffff'; ctx.fillRect(px + 8, py + 8, 8, 8);
                } else if (levelDef.id === 'jungle') {
                    ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, TILE_SIZE/2-2, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2-5, py+TILE_SIZE/2-5, 10, 0, Math.PI*2); ctx.fill();
                } else if (levelDef.id === 'hell') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#222'; ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#111'; ctx.fillRect(px+6, py+6, 4, 4); ctx.fillRect(px+38, py+6, 4, 4); ctx.fillRect(px+6, py+38, 4, 4); ctx.fillRect(px+38, py+38, 4, 4);
                } else if (levelDef.id === 'stone') {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#333'; ctx.fillRect(px+10, py+10, TILE_SIZE-20, TILE_SIZE-20);
                } else {
                    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                }
            } 
            // Boden-Objekte
            else if (tile === TYPES.WATER) {
                ctx.fillStyle = '#3366ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#6699ff'; ctx.lineWidth = 2; const offset = Math.sin(x) * 4; ctx.beginPath(); ctx.moveTo(px + 4, py + 16 + offset); ctx.bezierCurveTo(px+16, py+8+offset, px+32, py+24+offset, px+44, py+16+offset); ctx.stroke();
            } else if (tile === TYPES.BRIDGE) {
                ctx.fillStyle = '#4a3b2a'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px+2, py, 44, TILE_SIZE);
                ctx.strokeStyle = '#5c3c1e'; ctx.lineWidth = 2; for(let i=0; i<TILE_SIZE; i+=8) { ctx.beginPath(); ctx.moveTo(px+2, py+i); ctx.lineTo(px+46, py+i); ctx.stroke(); }
            } else if (tile === TYPES.OIL) {
                const cx = px + TILE_SIZE / 2; const cy = py + TILE_SIZE / 2;
                ctx.fillStyle = '#7a6a6a'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#050202'; ctx.beginPath(); ctx.ellipse(cx, cy, TILE_SIZE*0.38, TILE_SIZE*0.32, Math.PI*0.1, 0, Math.PI*2); ctx.fill();
                const varyX = (x % 5 - 2) * 3; const varyY = (y % 5 - 2) * 3;
                ctx.beginPath(); ctx.arc(cx - 12 + varyX, cy + 8 + varyY, 10, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 10 - varyY, cy - 10 + varyX, 9, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
                ctx.beginPath(); ctx.ellipse(cx - 8, cy - 12, 10, 5, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx + 12, cy + 12, 4, 2, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
            }

            // Pads
            if ((levelDef.id === 'hell' || levelDef.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                ctx.fillStyle = '#440000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#ff0000'; ctx.fillRect(px + 20, py + 8, 8, 32);
                ctx.beginPath(); ctx.moveTo(px+24, py+2); ctx.lineTo(px+30, py+10); ctx.lineTo(px+18, py+10); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+24, py+46); ctx.lineTo(px+30, py+38); ctx.lineTo(px+18, py+38); ctx.fill(); 
                ctx.fillRect(px + 8, py + 20, 32, 8);
                ctx.beginPath(); ctx.moveTo(px+2, py+24); ctx.lineTo(px+10, py+18); ctx.lineTo(px+10, py+30); ctx.fill(); 
                ctx.beginPath(); ctx.moveTo(px+46, py+24); ctx.lineTo(px+38, py+18); ctx.lineTo(px+38, py+30); ctx.fill(); 
            }
            const dirPad = DIRECTION_PADS.find(p => p.x === x && p.y === y);
            if (dirPad) {
                const cx = px + TILE_SIZE/2; const cy = py + TILE_SIZE/2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#aaaaaa'; ctx.beginPath(); const size = 8; 
                if (dirPad.dir.y === -1) { ctx.moveTo(cx, cy - size - 2); ctx.lineTo(cx - size, cy + size - 2); ctx.lineTo(cx + size, cy + size - 2); } 
                else if (dirPad.dir.x === 1) { ctx.moveTo(cx + size + 2, cy); ctx.lineTo(cx - size + 2, cy - size); ctx.lineTo(cx - size + 2, cy + size); } 
                else if (dirPad.dir.y === 1) { ctx.moveTo(cx, cy + size + 2); ctx.lineTo(cx - size, cy - size + 2); ctx.lineTo(cx + size, cy - size + 2); } 
                else if (dirPad.dir.x === -1) { ctx.moveTo(cx - size - 2, cy); ctx.lineTo(cx + size - 2, cy - size); ctx.lineTo(cx + size - 2, cy + size); }
                ctx.fill();
            }
        }
    }

    if (levelDef.hasCentralFire) {
        const cx = HELL_CENTER.x * TILE_SIZE; const cy = HELL_CENTER.y * TILE_SIZE;
        ctx.fillStyle = '#0a0505'; ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);
    }

    return c;
}

// --- EXPORTIERTE DRAW FUNKTION (ORIGINAL) ---
export function draw(ctx, canvas) {
    if (!state.currentLevel) return;

    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // Dynamische Objekte (Items, Soft Walls)
    for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const tile = state.grid[y][x];
            const item = state.items[y][x];

            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) drawItem(ctx, item, px, py);

            if (tile === TYPES.WALL_SOFT) {
                const lvl = state.currentLevel;
                ctx.fillStyle = lvl.wallSoft;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = lvl.wallSoftLight; 
                if (lvl.id === 'hell') {
                    ctx.beginPath(); ctx.moveTo(px+10, py+10); ctx.lineTo(px+30, py+20); ctx.lineTo(px+15, py+35); ctx.fill();
                } else if (lvl.id === 'ice') {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px+4, py+4, 10, 10); ctx.fillRect(px+20, py+20, 20, 5);
                } else if (lvl.id === 'jungle') {
                    ctx.fillStyle = '#664422'; ctx.fillRect(px+4, py+4, 40, 40);
                    ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(px+4, py+4); ctx.lineTo(px+44, py+44); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px+44, py+4); ctx.lineTo(px+4, py+44); ctx.stroke();
                } else {
                    ctx.fillRect(px+4, py+10, 18, 8); ctx.fillRect(px+26, py+10, 18, 8);
                    ctx.fillRect(px+4, py+28, 18, 8); ctx.fillRect(px+26, py+28, 18, 8);
                }
            }
        }
    }

    state.bombs.forEach(b => {
        const bx = b.px + 24; const by = b.py + 24;
        const pulse = 1 + Math.sin(Date.now() * 0.015) * 0.1;
        ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
        ctx.fillStyle = b.napalm ? '#b00' : (b.isRolling ? '#557' : '#333');
        ctx.beginPath(); ctx.arc(bx, by, 18*pulse, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        const g = ctx.createRadialGradient(bx-6, by-6, 2, bx, by, 20);
        g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx-6, by-6, 8, 0, Math.PI*2); ctx.fill();
        if (b.napalm) { ctx.fillStyle='#fc0'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText('☢', bx, by+4); }
    });

    drawAllParticles(ctx);

    if (state.players) {
        [...state.players].sort((a,b) => a.y - b.y).forEach(p => p.draw());
    }
}

export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, lastDir = {x:0, y:1}) {
    let d = 'front';
    if (lastDir.y < 0) d = 'back';
    else if (lastDir.x !== 0) d = 'side';
    
    ctx.save();
    ctx.translate(x, y);
    if (lastDir.x < 0) ctx.scale(-1, 1); 

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const sprite = getCachedSprite(charDef, d, isCursed);
    // Offset für 48x64 Canvas
    ctx.drawImage(sprite, -24, -40);
    
    ctx.restore();
}

export function drawLevelPreview(ctx, w, h, levelDef) {
    const tileSize = w / 3; 
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    const drawBlock = (x, y, type) => {
        const px = x * tileSize; const py = y * tileSize;
        if (type === TYPES.WALL_HARD) {
             ctx.fillStyle = levelDef.wallHard; ctx.fillRect(px, py, tileSize, tileSize);
             ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px+tileSize-2, py, 2, tileSize); ctx.fillRect(px, py+tileSize-2, tileSize, 2);
        } else if (type === TYPES.WALL_SOFT) {
             ctx.fillStyle = levelDef.wallSoft; ctx.fillRect(px, py, tileSize, tileSize);
             ctx.fillStyle = levelDef.wallSoftLight; ctx.fillRect(px+2, py+2, tileSize-4, tileSize-4);
        }
    };
    drawBlock(0, 0, TYPES.WALL_HARD); drawBlock(1, 0, TYPES.WALL_SOFT); drawBlock(2, 0, TYPES.WALL_HARD);
    drawBlock(0, 1, TYPES.WALL_SOFT); drawBlock(2, 1, TYPES.WALL_SOFT);
    drawBlock(0, 2, TYPES.WALL_HARD); drawBlock(1, 2, TYPES.WALL_SOFT); drawBlock(2, 2, TYPES.WALL_HARD);
}

export function drawItem(ctx, type, x, y) {
    const pad = 2; const size = TILE_SIZE - pad*2;
    ctx.fillStyle = '#442222'; ctx.fillRect(x+pad, y+pad, size, size);
    ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 2; ctx.strokeRect(x+pad, y+pad, size, size);
    const cx = x + TILE_SIZE/2; const cy = y + TILE_SIZE/2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '24px sans-serif';
    switch(type) {
        case ITEMS.BOMB_UP: ctx.fillStyle = '#0088ff'; ctx.fillText('💣', cx, cy); break; 
        case ITEMS.RANGE_UP: ctx.fillStyle = '#ffaa00'; ctx.fillText('🔥', cx, cy); break; 
        case ITEMS.SPEED_UP: ctx.fillStyle = '#ffff00'; ctx.fillText('👟', cx, cy); break; 
        case ITEMS.NAPALM: ctx.fillStyle = '#ff0000'; ctx.fillText('☢️', cx, cy); break;   
        case ITEMS.ROLLING: ctx.fillStyle = '#ffffff'; ctx.fillText('🎳', cx, cy); break; 
        case ITEMS.SKULL: ctx.fillStyle = '#cccccc'; ctx.fillText('💀', cx, cy); break;   
    }
}