import { CHARACTERS } from './constants.js';

const spriteCache = {};

function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas');

    let timeKey = '';
    if (charDef.id === 'diva' || charDef.id === 'lifeguard') { 
        timeKey = `_t${Math.floor(Date.now() / 50)}`; 
    }

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}${timeKey}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    ctx.translate(24, 40);

    const fillCircle = (x, y, r, col) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); };
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const gradient = (y1, y2, c1, c2) => { const g = ctx.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

    const id = charDef.id;

    // ============================================================
    // Vektor-Zeichenfunktion
    // ============================================================
    const drawVectorBody = (skin, topColor, pantsColor, shoesColor, options={}) => {
        const wMod = options.width || 1;
        const pantsLen = options.pantsLen || 12; 
        const sockColor = options.socks || null;
        
        // BEINE & SCHUHE
        if (pantsLen < 12) {
            ctx.fillStyle = skin;
            if(d==='side') ctx.fillRect(-4, 12, 8, 12);
            else { ctx.fillRect(-9*wMod, 12, 8*wMod, 12); ctx.fillRect(1*wMod, 12, 8*wMod, 12); }
        }
        if (sockColor) {
            ctx.fillStyle = sockColor;
            if(d==='side') ctx.fillRect(-4, 18, 8, 4);
            else { ctx.fillRect(-9*wMod, 18, 8*wMod, 4); ctx.fillRect(1*wMod, 18, 8*wMod, 4); }
        }
        ctx.fillStyle = pantsColor;
        
        // V-Shape (für Lifeguard/Badeanzüge)
        if (options.vShape && d !== 'side') {
            ctx.beginPath();
            ctx.moveTo(-9*wMod, 10); ctx.lineTo(9*wMod, 10);
            ctx.lineTo(0, 18); 
            ctx.fill();
        } else {
            if(d==='side') ctx.fillRect(-5, 10, 10, pantsLen);
            else { ctx.fillRect(-9*wMod, 10, 8*wMod, pantsLen); ctx.fillRect(1*wMod, 10, 8*wMod, pantsLen); }
        }

        // Schuhe / Barfuß
        if (!options.barefoot) {
            ctx.fillStyle = shoesColor;
            if(d==='side') { ctx.beginPath(); ctx.ellipse(0, 24, 6, 3, 0, 0, Math.PI*2); ctx.fill(); }
            else { ctx.beginPath(); ctx.arc(-5*wMod, 24, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5*wMod, 24, 4, 0, Math.PI*2); ctx.fill(); }
        } else {
            ctx.fillStyle = skin;
            if(d==='side') { ctx.fillRect(-2, 22, 6, 3); }
            else { ctx.fillRect(-8*wMod, 22, 6, 3); ctx.fillRect(2*wMod, 22, 6, 3); }
        }

        // TORSO
        ctx.fillStyle = topColor;
        ctx.beginPath(); 
        ctx.moveTo(-11*wMod, -16); ctx.lineTo(11*wMod, -16); 
        ctx.lineTo(9*wMod, 12); ctx.lineTo(-9*wMod, 12); 
        ctx.fill();

        // ARME
        if(d!=='side') {
            ctx.fillStyle = topColor; 
            if (options.sleeveless) ctx.fillStyle = skin; 
            ctx.beginPath(); ctx.ellipse(-14*wMod, -6, 4.5, 11, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(14*wMod, -6, 4.5, 11, -0.2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = skin; fillCircle(-15*wMod, 5, 3.5, skin); fillCircle(15*wMod, 5, 3.5, skin);
            
            if (options.tattoos) {
                ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-16*wMod, -8); ctx.lineTo(-12*wMod, 0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(16*wMod, -8); ctx.lineTo(12*wMod, 0); ctx.stroke();
            }
        } else {
            ctx.fillStyle = topColor;
            if (options.sleeveless) ctx.fillStyle = skin;
            ctx.beginPath(); ctx.ellipse(0, -6, 4.5, 11, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = skin; fillCircle(0, 5, 3.5, skin);
        }

        // KOPF
        if (!options.skipHead) {
            fillCircle(0, -22, 9.5, skin);
        }
    };

    const drawFace = (glasses=false, visor=false, beard=false) => {
        if(d!=='front') return;
        if (!glasses && !visor) {
            fillCircle(-4, -23, 2.5, '#fff'); fillCircle(4, -23, 2.5, '#fff');
            fillCircle(-4, -23, 1, '#000'); fillCircle(4, -23, 1, '#000');
        }
        if (glasses) { ctx.fillStyle = '#111'; ctx.fillRect(-9, -26, 18, 5); }
        if (visor) { ctx.fillStyle = '#0044cc'; ctx.fillRect(-10, -28, 20, 8); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-8, -28, 4, 8); }
        if (beard) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(0, -22, 9.5, 0.5, 2.6); ctx.fill(); }
        
        // Standard Mund (wenn kein Bart)
        if (!beard) { ctx.fillStyle = '#a0522d'; ctx.fillRect(-2, -17, 4, 1); }
    };

    const skinL = '#ffccaa'; const skinD = '#8d5524';
    const black = '#111'; const white = '#fff';

    // ============================================================
    // CHARACTERS
    // ============================================================
    
    if (id === 'devil') {
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
    } 
    else if (id === 'commando') {
        const cGreen = '#226622'; const cDarkG = '#113311'; const cLiteG = '#448844'; const cSkin  = '#ffccaa'; const cSkinS = '#ddaa88'; const cBandana = '#dd0000';
        ctx.fillStyle = cGreen; if (d === 'side') { ctx.fillRect(-5, 12, 8, 8); ctx.fillStyle = '#111'; ctx.fillRect(-5, 20, 9, 4); } else { ctx.fillRect(-10, 12, 8, 8); ctx.fillRect(2, 12, 8, 8); ctx.fillStyle = '#111'; ctx.fillRect(-10, 20, 8, 4); ctx.fillRect(2, 20, 8, 4); }
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 12); bodyGrad.addColorStop(0, '#448844'); bodyGrad.addColorStop(1, '#225522'); ctx.fillStyle = bodyGrad; ctx.fillRect(-12, -20, 24, 32);
        ctx.fillStyle = cDarkG; ctx.fillRect(-10, -16, 6, 4); ctx.fillRect(4, -8, 6, 4); ctx.fillRect(-6, 4, 6, 4); ctx.fillStyle = cLiteG; ctx.fillRect(6, -18, 4, 4); ctx.fillRect(-8, 0, 4, 4); ctx.fillRect(2, 10, 4, 4);
        if (d === 'front') { ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18); ctx.fillStyle = cSkinS; ctx.fillRect(-19, -18, 2, 18); ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(12, 12); ctx.lineTo(6, 12); ctx.lineTo(-12, -14); ctx.fill(); ctx.fillStyle = '#ffcc00'; ctx.fillRect(-9, -18, 3, 5); ctx.fillRect(-3, -10, 3, 5); ctx.fillRect(3, -2, 3, 5); ctx.fillStyle = cSkin; ctx.fillRect(-10, -26, 20, 16); ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(10, -24, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -18, 7, 7); ctx.fillRect(1, -18, 7, 7); ctx.fillStyle = '#000'; ctx.fillRect(-5, -16, 2, 2); ctx.fillRect(3, -16, 2, 2); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(-10, -14, 20, 4); } 
        else if (d === 'back') { ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18); ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(-12, 12); ctx.lineTo(-6, 12); ctx.lineTo(12, -14); ctx.fill(); ctx.fillStyle = '#ffcc00'; ctx.fillRect(8, -16, 4, 6); ctx.fillRect(2, -8, 4, 6); ctx.fillRect(-4, 0, 4, 6); ctx.fillStyle = '#111'; ctx.fillRect(-10, -26, 20, 16); ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(-4, -26, 8, 12); } 
        else if (d === 'side') { ctx.fillStyle = '#553311'; ctx.fillRect(-6, -18, 12, 28); ctx.fillStyle = cSkin; ctx.fillRect(-7, -26, 16, 16); ctx.fillStyle = '#111'; ctx.fillRect(-9, -26, 4, 16); ctx.fillStyle = cBandana; ctx.fillRect(-9, -26, 20, 6); ctx.fillRect(-13, -24, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(4, -18, 5, 6); ctx.fillStyle = '#000'; ctx.fillRect(7, -16, 2, 2); ctx.fillStyle = cSkin; ctx.fillRect(0, -12, 7, 20); ctx.fillStyle = cGreen; ctx.fillRect(0, -16, 7, 4); }
        if(d==='front') { ctx.fillStyle='#a0522d'; ctx.fillRect(-2, -8, 4, 1); }
    }
    else if (id === 'nun') {
        ctx.fillStyle = '#111'; if (d === 'side') ctx.fillRect(-5, 14, 10, 4); else { ctx.fillRect(-7, 14, 6, 4); ctx.fillRect(1, 14, 6, 4); }
        const robeGrad = ctx.createLinearGradient(0, -20, 0, 14); robeGrad.addColorStop(0, '#333'); robeGrad.addColorStop(1, '#000');
        if (d === 'front') { ctx.fillStyle = robeGrad; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(-12, 0, -10, 14); ctx.stroke(); ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(12, 0, 10, 14); ctx.stroke(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(-14, -24, -16, -8); ctx.lineTo(16, -8); ctx.quadraticCurveTo(14, -24, 0, -26); ctx.fill(); ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-4, -17, 2, 2); ctx.fillRect(2, -17, 2, 2); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -19, 10, Math.PI, 0); ctx.fill(); const gold = ctx.createLinearGradient(0,-6,0,10); gold.addColorStop(0,'#ffdd44'); gold.addColorStop(1,'#aa7700'); ctx.fillStyle = gold; ctx.fillRect(-3, -6, 6, 16); ctx.fillRect(-8, -2, 16, 6); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-1, -6, 1, 16); ctx.fillStyle = '#111'; ctx.fillRect(-20, -12, 8, 18); ctx.fillRect(12, -12, 8, 18); ctx.fillStyle = '#ffccaa'; ctx.fillRect(-18, 4, 4, 4); ctx.fillRect(14, 4, 4, 4); } 
        else if (d === 'back') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(-14, -10, -12, 10); ctx.lineTo(12, 10); ctx.quadraticCurveTo(14, -10, 0, -28); ctx.fill(); ctx.fillStyle = '#eee'; ctx.fillRect(-8, -24, 16, 2); ctx.fillStyle = robeGrad; ctx.fillRect(-18, -12, 6, 18); ctx.fillRect(12, -12, 6, 18); } 
        else if (d === 'side') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-14, -10, -12, 14); ctx.lineTo(10, 14); ctx.quadraticCurveTo(12, -10, 0, -24); ctx.fill(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(-8, -26); ctx.lineTo(-10, -8); ctx.lineTo(4, -8); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.quadraticCurveTo(-14, -16, -12, 10); ctx.lineTo(-6, 10); ctx.quadraticCurveTo(-8, -16, -4, -26); ctx.fill(); ctx.fillStyle = '#ffccaa'; ctx.fillRect(2, -22, 6, 12); ctx.fillStyle = '#000'; ctx.fillRect(6, -18, 2, 2); ctx.fillStyle = '#cc9922'; ctx.fillRect(4, 0, 4, 10); ctx.fillRect(2, 2, 8, 4); ctx.fillStyle = '#111'; ctx.fillRect(-2, -12, 10, 18); ctx.fillStyle = '#ffccaa'; ctx.fillRect(-2, 4, 8, 4); }
        if(d==='front') { ctx.fillStyle='#d08060'; ctx.fillRect(-2, -12, 4, 1); }
    }
    else if (id === 'yeti') {
        const furBase = '#00ccff'; const furDark = '#0088bb'; const furLite = '#e0ffff'; 
        ctx.fillStyle = furBase; if (d === 'side') { ctx.fillRect(-6, 12, 12, 10); } else { ctx.fillRect(-10, 12, 8, 10); ctx.fillRect(2, 12, 8, 10); }
        const furGrad = ctx.createLinearGradient(0, -24, 0, 12); furGrad.addColorStop(0, furBase); furGrad.addColorStop(1, furDark); ctx.fillStyle = furGrad; ctx.fillRect(-16, -24, 32, 36); 
        ctx.fillStyle = furDark; ctx.fillRect(-16, 0, 8, 8); ctx.fillRect(8, -8, 8, 8); ctx.fillRect(-4, 20, 8, 8); ctx.fillStyle = furLite; ctx.fillRect(-12, -20, 4, 4); ctx.fillRect(4, -16, 4, 4); ctx.fillRect(10, 4, 4, 4);
        if (d === 'front') { ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26); ctx.fillStyle = furLite; ctx.fillRect(-22, -16, 8, 4); ctx.fillRect(14, -16, 8, 4); ctx.fillStyle = '#005599'; ctx.fillRect(-12, -20, 24, 14); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -17, 6, 6); ctx.fillRect(2, -17, 6, 6); ctx.fillStyle = '#000'; ctx.fillRect(-6, -16, 2, 2); ctx.fillRect(4, -16, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -8, 3, 4); ctx.fillRect(3, -8, 3, 4); } 
        else if (d === 'back') { ctx.fillStyle = furDark; ctx.fillRect(-10, -14, 20, 24); ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26); } 
        else if (d === 'side') { ctx.fillStyle = '#005599'; ctx.fillRect(6, -20, 10, 14); ctx.fillStyle = '#fff'; ctx.fillRect(10, -17, 4, 6); ctx.fillStyle = '#000'; ctx.fillRect(12, -16, 2, 2); ctx.fillStyle = furBase; ctx.fillRect(-4, -14, 12, 26); ctx.fillStyle = furLite; ctx.fillRect(-4, -14, 12, 4); }
        if(d==='front') { ctx.fillStyle='#002244'; ctx.fillRect(-3, -10, 6, 2); }
    }

    // 1. STRIKER
    else if (id === 'striker') {
        const jersey = gradient(-16, 12, '#e00', '#900');
        drawVectorBody(skinL, jersey, white, '#00f', { pantsLen: 6, socks: black });
        if(d==='front' || d==='back') { ctx.fillStyle=white; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('7', 0, 4); }
        ctx.fillStyle='#210'; ctx.beginPath(); ctx.arc(0, -26, 10, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-10,-26); ctx.quadraticCurveTo(0,-34,10,-26); ctx.fill();
        drawFace();
    }
    // 2. AGENT
    else if (id === 'agent') {
        const suit = gradient(-16, 12, '#333', '#000');
        drawVectorBody(skinL, suit, black, black);
        if(d==='front') { ctx.fillStyle=white; ctx.beginPath(); ctx.moveTo(-5,-16); ctx.lineTo(5,-16); ctx.lineTo(0,-6); ctx.fill(); ctx.fillStyle='#c00'; ctx.fillRect(-2, -14, 4, 14); }
        drawFace();
    }
    // 3. TECH CEO
    else if (id === 'techie') {
        drawVectorBody(skinL, '#222', '#222', '#000');
        ctx.fillStyle='#321'; ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, 0); ctx.fill();
        drawFace();
    }
    // 4. MOONWALKER
    else if (id === 'moonwalker') {
        const jacket = gradient(-16, 12, '#eee', '#ccc');
        drawVectorBody(skinL, jacket, white, black, { socks: white, width: 0.8, skipHead: true });
        ctx.fillStyle = skinL; ctx.beginPath(); ctx.ellipse(0, -22, 8, 9.5, 0, 0, Math.PI*2); ctx.fill();
        if(d==='front') { ctx.fillStyle='#44f'; ctx.beginPath(); ctx.moveTo(-4,-16); ctx.lineTo(4,-16); ctx.lineTo(0,-8); ctx.fill(); }
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(0, -29, 11, 4, 0, 0, Math.PI*2); ctx.fill(); 
        ctx.beginPath(); ctx.ellipse(0, -32, 8, 8, 0, Math.PI, 0); ctx.fill(); 
        ctx.fillStyle=black; ctx.fillRect(-8, -32, 16, 3); 
        ctx.beginPath(); ctx.arc(5, -26, 2, 0, Math.PI*2); ctx.fill(); 
        drawFace();
    }
    // 5. BALLER
    else if (id === 'baller') { 
        const gold = '#fdb927'; const purple = '#552583';
        drawVectorBody(skinD, gold, purple, white, { pantsLen: 7, width: 1.15, sleeveless: true }); 
        if(d==='front' || d==='back') { ctx.fillStyle=purple; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 4); }
        ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); 
        drawFace(false, false, true);
    }
    // 6. LIFEGUARD
    else if (id === 'lifeguard') {
        const t = Date.now() / 150; 
        const redGlitter = ctx.createLinearGradient(-15 + Math.sin(t)*15, -20, 15 + Math.sin(t)*15, 20);
        redGlitter.addColorStop(0, '#cc0000'); redGlitter.addColorStop(0.5, '#ff0000'); redGlitter.addColorStop(1, '#cc0000');   

        drawVectorBody(skinL, redGlitter, redGlitter, '#d00', { width: 0.8, pantsLen: 4, skipHead: true, sleeveless: true });
        
        ctx.fillStyle = skinL; ctx.beginPath(); ctx.ellipse(0, -23, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle='#fe8'; ctx.beginPath(); ctx.arc(0, -26, 9.5, Math.PI, 0); ctx.fill(); 
        if(d!=='back') { ctx.fillRect(-10.5, -26, 5, 25); ctx.fillRect(5.5, -26, 5, 25); } else { ctx.fillRect(-10, -26, 20, 25); }

        if(d==='front') {
            ctx.fillStyle = '#d00000'; ctx.fillRect(-1.5, -16, 3, 1.5); 
            drawFace(false, false, false);
        } else {
            drawFace();
        }
    }
    // 7. RAPPER
    else if (id === 'rapper') {
        drawVectorBody(skinD, gradient(-16,12,'#111','#000'), '#347', white, { width: 1.1 });
        if(d==='front') { 
            ctx.fillStyle = '#fd0'; ctx.beginPath(); ctx.ellipse(0, -6, 4, 5, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = black; ctx.beginPath(); ctx.arc(-1.5, -7, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(1.5, -7, 1, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill();
        drawFace(false, false, true);
    }
    // 8. RAP ICON
    else if (id === 'rap_icon') {
        drawVectorBody(skinD, white, '#369', white, { sleeveless: true, tattoos: true });
        ctx.fillStyle='#36c'; ctx.fillRect(-10, -29, 20, 6); 
        if(d==='front') { ctx.beginPath(); ctx.moveTo(8,-29); ctx.lineTo(14,-34); ctx.lineTo(14,-22); ctx.fill(); } 
        drawFace(false, false, true);
    }
    // 9. POP DIVA (UPDATED: Augen hinzugefügt!)
    else if (id === 'diva') {
        const t = Date.now() / 150; 
        const glitter = ctx.createLinearGradient(-15 + Math.sin(t)*15, -20, 15 + Math.sin(t)*15, 20);
        glitter.addColorStop(0, '#999999'); glitter.addColorStop(0.4, '#cccccc'); glitter.addColorStop(0.5, '#ffffff'); glitter.addColorStop(0.6, '#cccccc'); glitter.addColorStop(1, '#999999');   

        drawVectorBody(skinL, glitter, glitter, black, { width: 0.8, pantsLen: 4, skipHead: true });
        ctx.fillStyle=skinL; ctx.fillRect(-8, -4, 16, 4);
        ctx.fillStyle = skinL; ctx.beginPath(); ctx.ellipse(0, -23, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0, -26, 9.5, Math.PI, 0); ctx.fill(); 
        if(d!=='back') { ctx.fillRect(-10.5, -26, 5, 25); ctx.fillRect(5.5, -26, 5, 25); } else { ctx.fillRect(-10, -26, 20, 25); }
        
        // HIER WAR DER FEHLER: drawFace fehlte!
        if(d==='front') { 
            ctx.fillStyle = '#d00000'; ctx.fillRect(-1.5, -16, 3, 1.5); 
            drawFace(false, false, false); // Jetzt zeichnen wir auch das Gesicht!
        } else { 
            drawFace(); 
        }
    }
    // 10. POP STAR
    else if (id === 'star') {
        const blue = gradient(-16, 12, '#0055ff', '#0000aa');
        drawVectorBody(skinL, blue, blue, white, { width: 0.8, pantsLen: 5, skipHead: true });
        ctx.fillStyle = skinL; ctx.beginPath(); ctx.ellipse(0, -23, 7.5, 9.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#eeeedd'; ctx.beginPath(); ctx.arc(0, -26, 10, Math.PI, 0); ctx.fill(); 
        if (d === 'back') { rect(-10, -26, 20, 22, '#eeeedd'); } else if (d === 'side') { rect(-7, -26, 8, 22, '#eeeedd'); } else { rect(-10, -26, 5, 22, '#eeeedd'); rect(5, -26, 5, 22, '#eeeedd'); }
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-9, -40); ctx.lineTo(-9, -28); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(9, -40); ctx.lineTo(9, -28); ctx.fill();
        drawFace(true); 
    }
    // 11. SPY
    else if (id === 'spy') {
        drawVectorBody(skinL, gradient(-16, 12, '#555', '#333'), '#333', black);
        if(d==='front') { ctx.fillStyle=white; ctx.beginPath(); ctx.moveTo(-5,-16); ctx.lineTo(5,-16); ctx.lineTo(0,-6); ctx.fill(); ctx.fillStyle=black; ctx.fillRect(-2, -14, 4, 3); }
        ctx.fillStyle='#aa9977'; ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, 0); ctx.fill();
        drawFace();
    }

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
    let d = 'front'; if (dir.y < 0) d = 'back'; else if (dir.x !== 0) d = 'side';
    if (dir.x < 0) ctx.scale(-1, 1); 
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();
    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    ctx.drawImage(sprite, -24, -40);
    ctx.restore();
}