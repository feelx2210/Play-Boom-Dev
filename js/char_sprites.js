import { CHARACTERS } from './constants.js';

// Cache für generierte Sprites
const spriteCache = {};

/**
 * Erstellt das Canvas für einen Charakter.
 * Enthält die Logik für Vektor-Stil (Alt) und Pixel-Stil (Neu).
 */
function getCachedSprite(charDef, d, isCursed) {
    if (!charDef) return document.createElement('canvas');

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; 
    c.height = 64; // Extra hoch für Hüte/Haare
    const ctx = c.getContext('2d');
    
    // Ankerpunkt: Füße bei Y=44 (für Pixel) bzw. Y=40 (für Vektor), 
    // wir mitteln es auf 42 oder nutzen Logik.
    // Die Vektor-Figuren waren auf 24,24 zentriert. Die Pixel-Figuren wachsen nach oben.
    // Wir nutzen hier 24, 40 als gute Basis.
    ctx.translate(24, 40);

    // --- ZEICHEN-HELFER ---
    const fillCircle = (x, y, r, col) => { 
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); 
    };
    
    // Rechteck (für Pixel-Look)
    const rect = (x, y, w, h, col) => { 
        ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); 
    };
    
    // Verlauf (für Vektor-Look)
    const gradient = (y1, y2, c1, c2) => { 
        const g = ctx.createLinearGradient(0, y1, 0, y2); 
        g.addColorStop(0, c1); g.addColorStop(1, c2); 
        return g; 
    };

    const id = charDef.id;

    // ============================================================
    // GRUPPE A: ORIGINAL CHARACTERS (VEKTOR-STIL)
    // Rambo, Lucifer, Nun, Yeti
    // ============================================================
    
    if (id === 'lucifer') {
        const skinGrad = gradient(-24, 10, '#ff5555', '#aa0000');
        ctx.fillStyle = '#1a0505'; 
        if (d==='side') { ctx.fillRect(-4, 14, 8, 10); } 
        else { ctx.fillRect(-8, 14, 6, 10); ctx.fillRect(2, 14, 6, 10); }
        ctx.fillStyle = skinGrad;
        ctx.beginPath(); ctx.ellipse(0, -5, 12, 18, 0, 0, Math.PI*2); ctx.fill(); 
        fillCircle(0, -20, 10, skinGrad); 
        const hornGrad = gradient(-35, -20, '#ffffff', '#bbbbbb');
        ctx.fillStyle = hornGrad;
        if(d!=='back') {
            ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(-14, -32, -10, -40); ctx.lineTo(-4, -28); ctx.fill();
            ctx.beginPath(); ctx.moveTo(6, -26); ctx.quadraticCurveTo(14, -32, 10, -40); ctx.lineTo(4, -28); ctx.fill();
        }
        if(d==='front') {
            rect(-7, -22, 5, 4, '#ffff00'); rect(2, -22, 5, 4, '#ffff00');
            rect(-5, -21, 2, 2, '#000'); rect(3, -21, 2, 2, '#000');
            ctx.fillStyle='#330000'; ctx.beginPath(); ctx.arc(0, -14, 4, 0, Math.PI, false); ctx.fill(); 
        }
    }
    else if (id === 'rambo') {
        const skin = '#ffccaa'; const skinShadow = '#eebba0';
        ctx.fillStyle = '#226622'; 
        if(d==='side') { ctx.fillRect(-5, 10, 10, 14); } else { ctx.fillRect(-9, 10, 8, 14); ctx.fillRect(1, 10, 8, 14); }
        const bodyGrad = gradient(-15, 10, skin, skinShadow);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(-14, 0, -8, 10); ctx.lineTo(8, 10); ctx.quadraticCurveTo(14, 0, 12, -18); ctx.fill();
        ctx.strokeStyle = '#442200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(10, 10); ctx.stroke();
        fillCircle(0, -22, 9, skin); 
        ctx.fillStyle = '#cc0000'; ctx.fillRect(-10, -28, 20, 6); 
        if(d==='back' || d==='side') { ctx.beginPath(); ctx.moveTo(8, -25); ctx.quadraticCurveTo(16, -20, 14, -10); ctx.lineTo(10, -22); ctx.fill(); } 
        fillCircle(0, -24, 9, '#111'); 
        if(d==='front') {
            rect(-7, -24, 5, 4, '#fff'); rect(2, -24, 5, 4, '#fff');
            rect(-5, -23, 2, 2, '#000'); rect(3, -23, 2, 2, '#000');
        }
    }
    else if (id === 'nun') {
        const robeGrad = gradient(-20, 20, '#333', '#000');
        ctx.fillStyle = robeGrad;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-14, 24); ctx.lineTo(14, 24); ctx.fill();
        fillCircle(0, -18, 7, '#ffccaa');
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -20, 9, Math.PI, 0); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 7, Math.PI, 0); ctx.stroke();
        if(d==='front') {
            rect(-3, -5, 6, 18, '#ffdd44'); rect(-8, 0, 16, 6, '#ffdd44');
            rect(-4, -19, 2, 2, '#000'); rect(2, -19, 2, 2, '#000');
        }
    }
    else if (id === 'yeti') {
        const furGrad = gradient(-20, 20, '#ddffff', '#88ccff');
        fillCircle(0, 0, 16, furGrad); 
        fillCircle(-10, -10, 8, furGrad); fillCircle(10, -10, 8, furGrad);
        fillCircle(-8, 12, 8, furGrad); fillCircle(8, 12, 8, furGrad);
        fillCircle(0, -20, 10, furGrad); 
        if(d==='front') {
            fillCircle(0, -18, 6, '#004488'); 
            rect(-4, -20, 3, 3, '#fff'); rect(1, -20, 3, 3, '#fff');
            rect(-3, -15, 2, 3, '#fff'); rect(1, -15, 2, 3, '#fff');
        }
    }

    // ============================================================
    // GRUPPE B: NEUE PROMIS (PIXEL-ART 8-BIT)
    // Cristiano, Hitman, Elon, MJ, etc.
    // ============================================================
    else {
        const skinCol = (id==='lebron'||id==='mj'||id==='2pac'||id==='drizzy') ? '#8d5524' : '#ffccaa';
        const pantsCol = (id==='cristiano'||id==='lebron'||id==='mj') ? '#fff' : (id==='2pac'||id==='elon') ? '#345' : '#222';
        const shoesCol = (id==='cristiano'||id==='lebron'||id==='mj') ? '#fff' : '#000';
        
        // Beine (Eckig)
        if(d==='side') {
            rect(-4, 12, 8, 12, pantsCol); rect(-4, 20, 10, 4, shoesCol);
        } else {
            rect(-8, 12, 6, 12, pantsCol); rect(2, 12, 6, 12, pantsCol);
            rect(-8, 20, 6, 4, shoesCol); rect(2, 20, 6, 4, shoesCol);
        }
        
        // Torso (Block)
        rect(-10, -14, 20, 26, charDef.color);
        // Kopf (Block)
        rect(-9, -26, 18, 12, skinCol);
        
        // Arme
        if(d!=='side') {
            rect(-14, -12, 4, 12, charDef.color); rect(10, -12, 4, 12, charDef.color);
            rect(-14, 0, 4, 4, skinCol); rect(10, 0, 4, 4, skinCol);
        }

        // Details
        if(id==='lebron') {
            rect(-4, -8, 8, 6, '#528'); 
            rect(-9, -18, 18, 6, '#111'); // Bart
            rect(-9, -28, 18, 2, '#fff'); // Band
        } else if(id==='cristiano') {
            if(d==='front') rect(-2, -8, 4, 8, '#fff'); 
            rect(-9, -30, 18, 6, '#210'); // Haare
        } else if(id==='mj') {
            rect(-10, -32, 20, 4, '#111'); // Hut
            rect(-8, -38, 16, 6, '#111');
            rect(-8, -34, 16, 2, '#fff');
        } else if(id==='pam') {
            rect(-9, 10, 18, 6, '#f00'); 
            if(d==='front') rect(-4, -12, 8, 6, skinCol);
            rect(-12, -34, 24, 8, '#fe8'); 
            rect(-14, -28, 6, 16, '#fe8'); rect(8, -28, 6, 16, '#fe8');
        } else if(id==='drizzy') {
            if(d==='front') rect(-2, -8, 4, 4, '#fd0');
            rect(-9, -30, 18, 4, '#111');
        } else if(id==='2pac') {
            rect(-9, -28, 18, 4, '#36c');
            rect(-8, -14, 16, 14, '#fff');
        } else if(id==='gaga') {
            rect(-10, -34, 20, 8, '#eed');
            if(d==='front') rect(-8, -24, 16, 4, '#111');
        } else if(id==='hitman') {
            if(d==='front') { rect(-4,-14,8,14,'#fff'); rect(-2,-12,4,12,'#c00'); }
        } else if(id==='007') {
            if(d==='front') { rect(-4,-14,8,14,'#fff'); rect(-2,-12,4,4,'#000'); }
        } else if(id==='elon') {
            if(d==='front') { rect(-4,-10,8,2,'#888'); rect(-2,-8,4,2,'#888'); }
        }

        // Gesicht (Simple Pixel Eyes für alle Neuen, außer Gaga mit Brille)
        if(d==='front' && id!=='gaga') {
            rect(-5,-22,2,2,'#000'); rect(3,-22,2,2,'#000'); 
        }
    }

    if (isCursed) { 
        ctx.globalCompositeOperation = 'source-atop'; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
        ctx.fillRect(0, 0, 48, 64); 
        ctx.globalCompositeOperation = 'source-over'; 
    }
    
    spriteCache[key] = c;
    return c;
}

/**
 * Public Funktion zum Zeichnen (Wird von Player.js und UI.js genutzt)
 */
export function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, dir = {x:0, y:1}) {
    ctx.save();
    ctx.translate(x, y);

    let d = 'front'; 
    if (dir.y < 0) d = 'back';
    else if (dir.x !== 0) d = 'side';
    if (dir.x < 0) ctx.scale(-1, 1); 

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    
    // Zeichnen mit Offset (wegen 64px Höhe und Translate 40)
    // Wir ziehen 40px nach oben ab, plus 4px Puffer -> -44
    ctx.drawImage(sprite, -24, -44);
    
    ctx.restore();
}