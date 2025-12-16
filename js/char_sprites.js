import { CHARACTERS } from './constants.js';

// Cache für generierte Sprites
const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas');

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; 
    c.height = 64; // Höhe für Menü-Vorschau
    const ctx = c.getContext('2d');
    
    // Positionierung: Füße bei Y=40 (damit Köpfe nicht abgeschnitten werden)
    ctx.translate(24, 40);

    // --- ORIGINAL CHARACTERS (1:1 DEIN CODE) ---
    // Wir nutzen hier exakt die Logik aus deinem Snippet.
    // Da dein Snippet von (24,24) ausging und wir jetzt auf (24,40) sind,
    // rutscht die Figur einfach etwas tiefer ins Bild, was perfekt ist.

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

    // ============================================================
    // 2. NEUE PROMIS (ADAPTED STYLE: RECTS + GRADIENTS + ARC HEAD)
    // Damit sie zum Stil der 4 Originale passen (Mix aus Block & Rund)
    // ============================================================
    else {
        const id = charDef.id;
        const gradient = (y1, y2, c1, c2) => { 
            const g = ctx.createLinearGradient(0, y1, 0, y2); 
            g.addColorStop(0, c1); g.addColorStop(1, c2); 
            return g; 
        };
        const rect = (x, y, w, h, col) => { ctx.fillStyle=col; ctx.fillRect(x,y,w,h); };
        
        // Farben
        const skinL = '#ffccaa'; const skinD = '#8d5524';
        const black = '#111'; const white = '#fff';
        
        // --- DRAW BUILDER (Angelehnt an Rambo-Logik) ---
        const drawChar = (skin, topCol, botCol, shoesCol, opts={}) => {
            const wMod = opts.w || 1;
            const pantsLen = opts.pants || 12;
            
            // Beine (Rects wie Rambo)
            if (pantsLen < 12) { // Haut wenn kurz
                ctx.fillStyle = skin;
                if(d==='side') ctx.fillRect(-5, 12, 8, 12);
                else { ctx.fillRect(-10*wMod, 12, 8*wMod, 12); ctx.fillRect(2*wMod, 12, 8*wMod, 12); }
            }
            // Socken
            if (opts.socks) {
                ctx.fillStyle = opts.socks;
                if(d==='side') ctx.fillRect(-5, 18, 8, 4); else { ctx.fillRect(-10*wMod, 18, 8*wMod, 4); ctx.fillRect(2*wMod, 18, 8*wMod, 4); }
            }
            
            // Hose
            ctx.fillStyle = botCol;
            if (d==='side') ctx.fillRect(-5, 10, 10, pantsLen);
            else { ctx.fillRect(-10*wMod, 10, 8*wMod, pantsLen); ctx.fillRect(2*wMod, 10, 8*wMod, pantsLen); }
            
            // Schuhe
            ctx.fillStyle = shoesCol;
            if (d==='side') ctx.fillRect(-5, 20, 12, 4);
            else { ctx.fillRect(-10*wMod, 20, 8*wMod, 4); ctx.fillRect(2*wMod, 20, 8*wMod, 4); }
            
            // Torso (Rechteck mit Gradient wie Rambo)
            ctx.fillStyle = topCol; 
            ctx.fillRect(-12*wMod, -20, 24*wMod, 32); 
            
            // Kopf (Kreis wie Rambo)
            ctx.fillStyle = skin; 
            ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI*2); ctx.fill();
            
            // Arme (Rects)
            if (d!=='side') {
                ctx.fillStyle = opts.sleeveless ? skin : topCol;
                ctx.fillRect(-19*wMod, -18, 7, 18); ctx.fillRect(12*wMod, -18, 7, 18);
                // Hände
                ctx.fillStyle = skin;
                ctx.fillRect(-19*wMod, -2, 7, 4); ctx.fillRect(12*wMod, -2, 7, 4);
            }
        };

        const drawFace = (glasses=false, beard=false) => {
            if(d!=='front') return;
            if (!glasses) {
                ctx.fillStyle=white; ctx.fillRect(-6,-24,3,3); ctx.fillRect(3,-24,3,3);
                ctx.fillStyle=black; ctx.fillRect(-5,-23,2,2); ctx.fillRect(4,-23,2,2);
            } else {
                ctx.fillStyle=black; ctx.fillRect(-9,-26,18,6);
            }
            if (beard) {
                ctx.fillStyle='rgba(0,0,0,0.2)'; 
                ctx.beginPath(); ctx.arc(0,-22,9,0.5,2.6); ctx.fill();
            }
        };

        if (id === 'cristiano') {
            const shirt = gradient(-20,10,'#f33','#a00');
            drawChar(skinL, shirt, white, '#00f', {pants:6, socks:black});
            if(d==='front') { ctx.fillStyle=white; ctx.fillText('7',-2,0); }
            ctx.fillStyle='#210'; ctx.beginPath(); ctx.arc(0,-26,10,Math.PI,0); ctx.fill(); // Haare
            drawFace();
        } 
        else if (id === 'hitman') {
            const suit = gradient(-20,10,'#333','#000');
            drawChar(skinL, suit, black, black);
            if(d==='front') { 
                ctx.fillStyle=white; ctx.beginPath(); ctx.moveTo(-6,-20); ctx.lineTo(6,-20); ctx.lineTo(0,-5); ctx.fill();
                rect(-2,-18,4,16,'#c00'); 
            }
            drawFace();
            if(d==='back') rect(-3,-22,6,2,black);
        }
        else if (id === 'elon') {
            drawChar(skinL, gradient(-20,10,'#222','#111'), '#111', '#333');
            if(d==='front') { ctx.fillStyle='#888'; ctx.beginPath(); ctx.moveTo(-6,-8); ctx.lineTo(6,-8); ctx.lineTo(0,-14); ctx.fill(); }
            ctx.fillStyle='#321'; ctx.beginPath(); ctx.arc(0,-26,10,Math.PI,0); ctx.fill(); 
            drawFace();
        }
        else if (id === 'mj') {
            const suit = gradient(-20,10,'#eee','#ccc');
            drawChar(skinL, suit, white, black, {socks:white, w:0.9});
            if(d==='front') { ctx.fillStyle='#44f'; ctx.fillRect(-2,-20,4,8); ctx.fillStyle=white; ctx.fillRect(13,0,6,6); } // Handschuh
            ctx.fillStyle=black; ctx.beginPath(); ctx.ellipse(0,-30,14,3,0,0,Math.PI*2); ctx.fill(); // Hut
            rect(-9,-38,18,8,black); rect(-9,-34,18,2,white);
            drawFace();
        }
        else if (id === 'lebron') {
            drawChar(skinD, gradient(-20,10,'#fb2','#528'), '#fff', '#fff', {pants:7, w:1.1});
            if(d==='front') { ctx.fillStyle='#528'; ctx.font='bold 10px sans'; ctx.fillText('23',-6,0); }
            ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0,-23,10,0,Math.PI*2); ctx.stroke(); 
            rect(-10,-28,20,3,white);
            drawFace(false, true);
        }
        else if (id === 'pam') {
            drawChar(skinL, '#f00', '#f00', skinL, {pants:6, w:0.9});
            if(d==='front') rect(-4,-14,8,6,skinL);
            ctx.fillStyle='#fe8'; ctx.beginPath(); ctx.arc(0,-28,14,Math.PI,0); ctx.fill();
            rect(-12,-24,6,16,'#fe8'); rect(6,-24,6,16,'#fe8');
            drawFace();
        }
        else if (id === 'drizzy') {
            drawChar(skinD, gradient(-20,10,'#333','#111'), '#347', white, {w:1.1});
            if(d==='front') { ctx.beginPath(); ctx.arc(0,-8,4,0,Math.PI*2); ctx.fillStyle='#fd0'; ctx.fill(); }
            ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0,-24,10,Math.PI,0); ctx.fill();
            drawFace(false, true);
        }
        else if (id === '2pac') {
            drawChar(skinD, white, '#369', white, {sleeveless:true});
            ctx.fillStyle='#36c'; rect(-10,-29,20,6); if(d==='front') { ctx.beginPath(); ctx.moveTo(8,-29); ctx.lineTo(14,-34); ctx.lineTo(14,-22); ctx.fill(); }
            drawFace(false, true);
        }
        else if (id === 'gaga') {
            const blue = gradient(-20,10,'#08f','#04a');
            drawChar(skinL, blue, blue, white, {w:0.9, pants:6});
            ctx.fillStyle='#eed'; ctx.beginPath(); ctx.arc(0,-26,12,Math.PI,0); ctx.fill();
            if(d!=='back') { rect(-12,-26,6,22,'#eed'); rect(6,-26,6,22,'#eed'); }
            // Schleife
            ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(-10,-40); ctx.lineTo(-10,-28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(10,-40); ctx.lineTo(10,-28); ctx.fill();
            drawFace(true);
        }
        else if (id === '007') {
            drawChar(skinL, gradient(-20,10,'#555','#333'), '#333', black);
            if(d==='front') { ctx.fillStyle=white; ctx.fillRect(-4,-18,8,12); ctx.fillStyle=black; ctx.fillRect(-2,-16,4,4); }
            ctx.fillStyle='#ca8'; ctx.beginPath(); ctx.arc(0,-25,10,Math.PI,0); ctx.fill();
            drawFace();
        }
        else if (id === 'dua') {
            drawChar(skinL, black, black, black, {w:0.8, pants:4});
            rect(-10,-6,20,6,skinL); // Bauchfrei
            ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0,-25,10,Math.PI,0); ctx.fill();
            if(d!=='back') { rect(-12,-25,6,24,black); rect(6,-25,6,24,black); } else rect(-12,-25,24,24,black);
            drawFace();
        }
    }

    // Cursed Blink
    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(-24, -44, 48, 64); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, dir = {x:0, y:1}) {
    ctx.save();
    ctx.translate(x, y);

    let d = 'front'; 
    if (dir.y < 0) d = 'back';
    else if (dir.x !== 0) d = 'side';
    if (dir.x < 0) ctx.scale(-1, 1); 

    // Vektor-Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    
    // Offset für 48x64 Canvas (Mitte bei 24, 40)
    ctx.drawImage(sprite, -24, -40);
    
    ctx.restore();
}