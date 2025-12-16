import { TILE_SIZE, GRID_W, GRID_H, TYPES, ITEMS, BOOST_PADS, OIL_PADS, HELL_CENTER, DIRECTION_PADS, BOMB_MODES } from './constants.js';
import { state } from './state.js';
import { drawAllParticles } from './render_particles.js';

// --- SPRITE CACHING (Characters) ---
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.translate(24, 24);

    // Hilfsfunktionen für den detaillierten Stil
    const gradient = (y1, y2, c1, c2) => {
        const g = ctx.createLinearGradient(0, y1, 0, y2);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        return g;
    };

    // --- ORIGINAL CHARACTERS (WIEDERHERGESTELLT) ---
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

    // --- NEUE PROMI-CHARAKTERE (IM STIL DER ALTEN NACHGEBAUT) ---
    else {
        // Hilfsfunktionen für den detaillierten Vektor-Stil
        const drawBody = (skinColor, shirtGrad, pantsColor, shoeColor) => {
            // Beine
            ctx.fillStyle = pantsColor;
            if (d === 'side') ctx.fillRect(-5, 12, 10, 12);
            else { ctx.fillRect(-9, 12, 8, 12); ctx.fillRect(1, 12, 8, 12); }
            // Schuhe
            ctx.fillStyle = shoeColor;
            if (d === 'side') ctx.fillRect(-5, 22, 12, 4);
            else { ctx.fillRect(-9, 22, 8, 4); ctx.fillRect(1, 22, 8, 4); }
            // Torso
            ctx.fillStyle = shirtGrad;
            ctx.fillRect(-12, -14, 24, 26);
            // Kopf
            ctx.fillStyle = skinColor;
            ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI*2); ctx.fill();
            // Arme
            if (d !== 'side') {
                ctx.fillStyle = shirtGrad; ctx.fillRect(-18, -12, 6, 18); ctx.fillRect(12, -12, 6, 18); // Ärmel
                ctx.fillStyle = skinColor; ctx.fillRect(-18, 6, 6, 6); ctx.fillRect(12, 6, 6, 6); // Hände
            }
        };

        const drawFace = (glasses=false, beard=false) => {
            if (d !== 'front') return;
            if (!glasses) {
                ctx.fillStyle = '#fff'; ctx.fillRect(-5, -24, 3, 3); ctx.fillRect(2, -24, 3, 3);
                ctx.fillStyle = '#000'; ctx.fillRect(-4, -23, 2, 2); ctx.fillRect(3, -23, 2, 2);
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(-8, -25, 16, 5);
            }
            if (beard) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 10, 0.5, 2.6); ctx.lineTo(0, -18); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            const jersey = gradient(-14, 12, '#ff3333', '#cc0000');
            drawBody('#d2b48c', jersey, '#fff', '#fff');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, 5);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -8); ctx.fill(); // V-Neck
            }
            // Haare
            ctx.fillStyle = '#221100'; ctx.beginPath(); ctx.arc(0, -26, 11, Math.PI, 0); ctx.fill();
            ctx.fillRect(-10, -26, 20, 6);
            drawFace();
        }
        else if (id === 'hitman') {
            const suit = gradient(-14, 12, '#333', '#000');
            drawBody('#ffe0bd', suit, '#111', '#000');
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(6, -14); ctx.lineTo(0, -4); ctx.fill();
                ctx.fillStyle = '#cc0000'; ctx.fillRect(-2, -14, 4, 12);
            }
            drawFace();
            if (d === 'back') { ctx.fillStyle = '#000'; ctx.fillRect(-3, -20, 6, 2); } // Barcode
        }
        else if (id === 'elon') {
            const shirt = gradient(-14, 12, '#222', '#111');
            drawBody('#f0d5be', shirt, '#111', '#333');
            if (d === 'front') {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.lineTo(0, -10); ctx.fill(); // Cybertruck Shape
            }
            ctx.fillStyle = '#332211'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill(); // Haare
            drawFace();
        }
        else if (id === 'mj') {
            const jacket = gradient(-14, 12, '#222', '#000');
            drawBody('#8d5524', jacket, '#111', '#000');
            ctx.fillStyle = '#fff'; ctx.fillRect(-9, 20, 8, 2); ctx.fillRect(1, 20, 8, 2); // Socken
            if (d === 'front') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(0, -8); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(12, 6, 6, 6); // Handschuh
            }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -28, 14, 3, 0, 0, Math.PI*2); ctx.fill(); // Hut Krempe
            ctx.fillRect(-9, -36, 18, 8); // Hut Top
            ctx.fillStyle = '#fff'; ctx.fillRect(-9, -32, 18, 2); // Hut Band
            drawFace();
        }
        else if (id === 'dua') {
            const skin = '#f0d5be';
            drawBody(skin, '#111', '#111', '#111');
            ctx.fillStyle = skin; ctx.fillRect(-12, -2, 24, 6); // Bauchfrei
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -24, 11, Math.PI, 0); ctx.fill(); // Haare
            if(d!=='back') { ctx.fillRect(-12, -24, 6, 22); ctx.fillRect(6, -24, 6, 22); }
            else ctx.fillRect(-11, -24, 22, 22);
            drawFace();
        }
        else if (id === 'lebron') {
            const jersey = gradient(-14, 12, '#fdb927', '#552583');
            drawBody('#5c3a1e', jersey, '#552583', '#fff');
            if (d === 'front') { ctx.fillStyle = '#552583'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 5); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); // Hairline
            ctx.fillRect(-10, -20, 20, 10); // Bart
            ctx.fillStyle = '#fff'; ctx.fillRect(-10, -28, 20, 3); // Stirnband
            drawFace();
        }
        else if (id === 'pam') {
            const skin = '#dca386';
            const swim = gradient(-14, 12, '#ff4444', '#cc0000');
            drawBody(skin, swim, skin, skin); // Beine Haut
            ctx.fillStyle = swim; ctx.fillRect(-9, 10, 18, 6); // Hüfte
            // Blonde Mähne
            ctx.fillStyle = '#ffee88'; 
            ctx.beginPath(); ctx.arc(0, -26, 14, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -20, 8, 16, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10, -20, 8, 16, -0.2, 0, Math.PI*2); ctx.fill();
            drawFace();
        }
        else if (id === 'drizzy') {
            const hoodie = gradient(-14, 12, '#333', '#111');
            drawBody('#ac8b66', hoodie, '#222', '#fff');
            if (d === 'front') { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI*2); ctx.fill(); }
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); // Haare
            drawFace(false, true);
        }
        else if (id === '2pac') {
            drawBody('#7a4e32', '#fff', '#4466aa', '#fff'); // Weißes Tanktop
            // Bandana
            ctx.fillStyle = '#3366cc'; ctx.fillRect(-10, -28, 20, 6);
            if (d === 'front') { ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(16, -32); ctx.lineTo(16, -20); ctx.fill(); }
            drawFace(false, true);
        }
        else if (id === 'gaga') {
            const suit = gradient(-14, 12, '#0088ff', '#0044aa');
            drawBody('#ffe0e0', suit, suit, '#fff');
            // Haare / Schleife
            ctx.fillStyle = '#eeeedd'; ctx.beginPath(); ctx.arc(0, -24, 12, Math.PI, 0); ctx.fill();
            if (d!=='back') { ctx.fillRect(-12, -24, 6, 22); ctx.fillRect(6, -24, 6, 22); }
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(-10, -38); ctx.lineTo(-10, -26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(10, -38); ctx.lineTo(10, -26); ctx.fill();
            drawFace(true); // Brille
        }
        else if (id === '007') {
            const suit = gradient(-14, 12, '#555', '#333');
            drawBody('#f0d5be', suit, '#333', '#000');
            if (d === 'front') {
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-6,-14); ctx.lineTo(0,-4); ctx.lineTo(6,-14); ctx.fill();
                ctx.fillStyle='#000'; ctx.fillRect(-3, -14, 6, 4); // Fliege
            }
            ctx.fillStyle='#ccaa88'; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill(); // Haare
            drawFace();
            if (d === 'side') { ctx.fillStyle='#333'; ctx.fillRect(8, 2, 8, 4); } // Pistole
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

// --- LEVEL CACHING (Original wiederhergestellt) ---
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
            }

            if ((levelDef.id === 'hell' || levelDef.id === 'ice') && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                ctx.fillStyle = '#440000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#ff0000'; ctx.fillRect(px + 20, py + 8, 8, 32);
            }
            
            const dirPad = DIRECTION_PADS.find(p => p.x === x && p.y === y);
            if (dirPad) {
                const cx = px + TILE_SIZE/2; const cy = py + TILE_SIZE/2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#aaaaaa'; ctx.beginPath(); ctx.arc(cx + dirPad.dir.x*10, cy + dirPad.dir.y*10, 4, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    if (levelDef.hasCentralFire) {
        const cx = HELL_CENTER.x * TILE_SIZE; const cy = HELL_CENTER.y * TILE_SIZE;
        ctx.fillStyle = '#0a0505'; ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);
    }

    return c;
}

// --- EXPORTED DRAW FUNCTION ---
export function draw(ctx, canvas) {
    // 1. Level Cache
    if (!cachedLevelCanvas || lastLevelId !== state.currentLevel.id) {
        cachedLevelCanvas = bakeStaticLevel(state.currentLevel);
        lastLevelId = state.currentLevel.id;
    }
    ctx.drawImage(cachedLevelCanvas, 0, 0);

    // 2. Objects
    drawObjects(ctx);

    // 3. Players
    if (state.players) {
        state.players.slice().sort((a,b) => a.y - b.y).forEach(p => p.draw());
    }
    
    // 4. Particles
    drawAllParticles(ctx);
}

export function drawObjects(ctx) {
    for(let y=0; y<GRID_H; y++) {
        for(let x=0; x<GRID_W; x++) {
            const tile = state.grid[y][x];
            const item = state.items[y][x];
            const X = x*TILE_SIZE, Y = y*TILE_SIZE;

            if (tile === TYPES.WALL_SOFT) {
                if (state.currentLevel.id === 'ice') {
                    ctx.fillStyle = '#88ccff'; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 2; ctx.strokeRect(X+4, Y+4, TILE_SIZE-8, TILE_SIZE-8);
                } else if (state.currentLevel.id === 'jungle') {
                    ctx.fillStyle = '#116611'; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#228822'; ctx.beginPath(); ctx.arc(X+24, Y+24, 10, 0, Math.PI*2); ctx.fill();
                } else if (state.currentLevel.id === 'hell') {
                    ctx.fillStyle = '#880000'; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#aa0000'; ctx.fillRect(X+4, Y+4, 40, 40);
                } else {
                    ctx.fillStyle = state.currentLevel.wallSoft; ctx.fillRect(X, Y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = state.currentLevel.wallSoftLight; ctx.fillRect(X+4, Y+4, TILE_SIZE-8, TILE_SIZE-8);
                }
            }

            if (item !== ITEMS.NONE && tile !== TYPES.WALL_SOFT) {
                let color = '#fff', text = '?';
                if (item === ITEMS.BOMB_UP) { color='#444444'; text='💣'; }
                else if (item === ITEMS.RANGE_UP) { color='#ff4400'; text='🔥'; }
                else if (item === ITEMS.SPEED_UP) { color='#0088ff'; text='⚡'; }
                else if (item === ITEMS.SKULL) { color='#ff00ff'; text='☠️'; }
                else if (item === ITEMS.NAPALM) { color='#ff0000'; text='☢️'; }
                else if (item === ITEMS.ROLLING) { color='#888888'; text='🎳'; }
                
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.arc(X+TILE_SIZE/2, Y+TILE_SIZE/2, TILE_SIZE/2.5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = color; ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(text, X+TILE_SIZE/2, Y+TILE_SIZE/2+2);
            }
        }
    }

    state.bombs.forEach(b => {
        const bx = b.px + TILE_SIZE/2, by = b.py + TILE_SIZE/2;
        const pulse = 1 + Math.sin(b.timer * 0.2) * 0.1;
        let color = '#444444';
        if (b.napalm) color = '#aa0000'; else if (b.isRolling) color = '#555577';

        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(bx, by, (TILE_SIZE/2.2)*pulse, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.arc(bx+6, by-6, 6*pulse, 0, Math.PI*2); ctx.fill();
        
        if (b.napalm) { ctx.fillStyle = '#ffcc00'; ctx.font='12px sans-serif'; ctx.fillText('☢', bx, by+4); }
    });
}

// Wrapper für Player.js
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
    ctx.drawImage(sprite, -24, -24);
    
    ctx.restore();
}

export function drawLevelPreview(ctx, w, h, levelDef) {
    ctx.fillStyle = levelDef.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = levelDef.wallHard; ctx.fillRect(0, 0, w, w/15); ctx.fillRect(0, h-h/15, w, w/15);
}