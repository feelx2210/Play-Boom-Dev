import { CHARACTERS } from './constants.js';

const spriteCache = {};

export function getCachedSprite(charDef, d, isCursed) {
    // Safety Check
    if (!charDef) return document.createElement('canvas');

    const key = `${charDef.id}_${d}_${isCursed ? 'cursed' : 'normal'}`;
    if (spriteCache[key]) return spriteCache[key];

    const c = document.createElement('canvas');
    c.width = 48; 
    c.height = 64; 
    const ctx = c.getContext('2d');
    
    // Basis-Transformation (Füße bei Y=44)
    ctx.translate(24, 44);

    // --- VEKTOR HELPER ---
    const fillCircle = (x, y, r, col) => { 
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); 
    };
    
    const gradient = (y1, y2, c1, c2) => { 
        const g = ctx.createLinearGradient(0, y1, 0, y2); 
        g.addColorStop(0, c1); g.addColorStop(1, c2); 
        return g; 
    };

    const rect = (x, y, w, h, col) => {
        ctx.fillStyle = col; ctx.fillRect(x,y,w,h);
    };

    const id = charDef.id;

    // ============================================================
    // 1. ORIGINAL CHARACTERS (Dein Vektor-Code, unverändert)
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
    // 2. NEUE PROMIS (DETAILIERTER VEKTOR-STIL)
    // ============================================================
    else {
        /* Dieser Builder erstellt Vektorkörper (keine Pixel), 
           mit Parametern für Hosenlänge, Socken, Schuhe etc.
        */
        const drawVectorBody = (skin, topColor, pantsColor, shoesColor, options={}) => {
            const wMod = options.width || 1;
            const pantsLen = options.pantsLen || 12; // 12=Lang, 6=Kurz/Hotpants
            const sockColor = options.socks || null;
            
            // 1. BEINE
            // Wenn Hose kurz ist, zeichne Haut darunter
            if (pantsLen < 12) {
                ctx.fillStyle = skin;
                if(d==='side') ctx.fillRect(-4, 12, 8, 12);
                else { ctx.fillRect(-9*wMod, 12, 8*wMod, 12); ctx.fillRect(1*wMod, 12, 8*wMod, 12); }
            }
            // Socken?
            if (sockColor) {
                ctx.fillStyle = sockColor;
                if(d==='side') ctx.fillRect(-4, 18, 8, 4);
                else { ctx.fillRect(-9*wMod, 18, 8*wMod, 4); ctx.fillRect(1*wMod, 18, 8*wMod, 4); }
            }
            // Hose
            ctx.fillStyle = pantsColor;
            if(d==='side') ctx.fillRect(-5, 10, 10, pantsLen);
            else { ctx.fillRect(-9*wMod, 10, 8*wMod, pantsLen); ctx.fillRect(1*wMod, 10, 8*wMod, pantsLen); }

            // 2. SCHUHE
            ctx.fillStyle = shoesColor;
            if(d==='side') { ctx.beginPath(); ctx.ellipse(0, 24, 6, 3, 0, 0, Math.PI*2); ctx.fill(); }
            else { 
                ctx.beginPath(); ctx.arc(-5*wMod, 24, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(5*wMod, 24, 4, 0, Math.PI*2); ctx.fill();
            }

            // 3. TORSO (Trapez-Form wie Rambo)
            ctx.fillStyle = topColor;
            ctx.beginPath(); 
            ctx.moveTo(-11*wMod, -16); ctx.lineTo(11*wMod, -16); 
            ctx.lineTo(9*wMod, 12); ctx.lineTo(-9*wMod, 12); 
            ctx.fill();

            // 4. ARME
            if(d!=='side') {
                ctx.fillStyle = topColor; 
                if (options.sleeveless) ctx.fillStyle = skin; // Ärmellos -> Haut
                
                // Arme leicht angewinkelt
                ctx.beginPath(); ctx.ellipse(-14*wMod, -6, 4.5, 11, 0.2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(14*wMod, -6, 4.5, 11, -0.2, 0, Math.PI*2); ctx.fill();
                
                // Hände
                ctx.fillStyle = skin; 
                fillCircle(-15*wMod, 5, 3.5, skin);
                fillCircle(15*wMod, 5, 3.5, skin);
            }

            // 5. KOPF BASIS
            fillCircle(0, -22, 9.5, skin);
        };

        const drawFace = (glasses=false, visor=false, beard=false) => {
            if(d!=='front') return;
            // Augen
            if (!glasses && !visor) {
                fillCircle(-4, -23, 2.5, '#fff'); fillCircle(4, -23, 2.5, '#fff');
                fillCircle(-4, -23, 1, '#000'); fillCircle(4, -23, 1, '#000');
            }
            // Brille (Rechteckig schwarz)
            if (glasses) {
                ctx.fillStyle = '#111'; ctx.fillRect(-9, -26, 18, 5);
            }
            // Visor (Blau)
            if (visor) {
                ctx.fillStyle = '#0044cc'; ctx.fillRect(-10, -28, 20, 8);
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-8, -28, 4, 8); // Glanz
            }
            // Bart
            if (beard) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.arc(0, -22, 9.5, 0.5, 2.6); ctx.fill();
            }
        };

        // --- FARBEN ---
        const skinL = '#ffccaa'; const skinD = '#8d5524';
        const black = '#111'; const white = '#fff';

        // 1. CRISTIANO
        if (id === 'cristiano') {
            // Rot, weiße Hose, schwarze Stutzen, blaue Schuhe
            const jersey = gradient(-16, 12, '#e00', '#900');
            drawVectorBody(skinL, jersey, white, '#00f', { pantsLen: 6, socks: black });
            if(d==='front') { ctx.fillStyle=white; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('7', 0, 4); }
            // Haare (Gestylt)
            ctx.fillStyle='#210'; ctx.beginPath(); ctx.arc(0, -26, 10, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-10,-26); ctx.quadraticCurveTo(0,-34,10,-26); ctx.fill();
            drawFace();
        }
        
        // 2. HITMAN
        else if (id === 'hitman') {
            // Schwarzer Anzug, rote Krawatte, Glatze
            const suit = gradient(-16, 12, '#333', '#000');
            drawVectorBody(skinL, suit, black, black);
            if(d==='front') {
                // Weißes Hemd V
                ctx.fillStyle=white; ctx.beginPath(); ctx.moveTo(-5,-16); ctx.lineTo(5,-16); ctx.lineTo(0,-6); ctx.fill();
                // Rote Krawatte
                ctx.fillStyle='#c00'; ctx.fillRect(-2, -14, 4, 14);
            }
            drawFace(); // Glatze (nichts zeichnen)
            if(d==='back') rect(-3,-22,6,3,'#000'); // Barcode
        }

        // 3. ELON
        else if (id === 'elon') {
            // Schwarzes T-Shirt, Cybertruck Logo, Schwarze Jeans
            drawVectorBody(skinL, '#222', '#222', '#000');
            if(d==='front') {
                // Cybertruck Dreieck
                ctx.fillStyle='#888'; ctx.beginPath(); ctx.moveTo(-6,-6); ctx.lineTo(6,-6); ctx.lineTo(0,-12); ctx.fill();
            }
            // Haare
            ctx.fillStyle='#321'; ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, 0); ctx.fill();
            drawFace();
        }

        // 4. MJ
        else if (id === 'mj') {
            // Weißes Sakko, weiße Hose, blaues Hemd, weißer Hut, weiße Socken, schwarze Loafers
            const jacket = gradient(-16, 12, '#eee', '#ccc');
            drawVectorBody(skinL, jacket, white, black, { socks: white });
            if(d==='front') {
                // Blaues Hemd
                ctx.fillStyle='#44f'; ctx.beginPath(); ctx.moveTo(-4,-16); ctx.lineTo(4,-16); ctx.lineTo(0,-8); ctx.fill();
            }
            // Weißer Hut mit schwarzem Band
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.ellipse(0, -29, 13, 4, 0, 0, Math.PI*2); ctx.fill(); // Krempe
            ctx.beginPath(); ctx.arc(0, -32, 9, Math.PI, 0); ctx.fill(); // Top
            ctx.fillStyle=black; ctx.fillRect(-9, -32, 18, 3); // Band
            // Locke
            ctx.beginPath(); ctx.arc(6, -26, 2, 0, Math.PI*2); ctx.fill();
            drawFace();
        }

        // 5. LEBRON
        else if (id === 'lebron') {
            // Goldenes Lakers Trikot 23
            const gold = '#fdb927';
            drawVectorBody(skinD, gold, gold, white, { pantsLen: 7, width: 1.15 }); // Breit gebaut
            if(d==='front') { ctx.fillStyle='#552583'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('23', 0, 4); }
            // Bart & Haare
            ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI*2); ctx.stroke(); // Hairline
            drawFace(false, false, true); // Bart
        }

        // 6. PAMELA
        else if (id === 'pam') {
            // Roter Badeanzug, Blonde Haare
            drawVectorBody(skinL, '#f00', '#f00', skinL, { pantsLen: 5, width: 0.9 }); // Haut-Schuhe = Barfuß
            // Große Blonde Haare
            ctx.fillStyle='#fe8'; 
            ctx.beginPath(); ctx.arc(0, -28, 14, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-9, -22, 6, 12, 0.3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(9, -22, 6, 12, -0.3, 0, Math.PI*2); ctx.fill();
            drawFace();
        }

        // 7. DRIZZY
        else if (id === 'drizzy') {
            // Schwarzer Hoodie (Owl), Blaue Baggie Jeans
            const hoodie = '#111';
            drawVectorBody(skinD, hoodie, '#347', white, { width: 1.1 });
            if(d==='front') {
                // Gold Eule
                fillCircle(0, -6, 4, '#fd0');
                fillCircle(-1.5, -7, 1, black); fillCircle(1.5, -7, 1, black);
            }
            // Haare/Bart
            ctx.fillStyle=black; ctx.beginPath(); ctx.arc(0, -24, 10, Math.PI, 0); ctx.fill();
            drawFace(false, false, true);
        }

        // 8. 2PAC
        else if (id === '2pac') {
            // Weißes Unterhemd, Blaue Jeans, Bandana
            drawVectorBody(skinD, white, '#369', white, { sleeveless: true });
            // Blaues Bandana
            ctx.fillStyle='#36c';
            ctx.fillRect(-10, -29, 20, 6);
            if(d==='front') { ctx.beginPath(); ctx.moveTo(8,-29); ctx.lineTo(14,-34); ctx.lineTo(14,-22); ctx.fill(); } // Knoten
            drawFace(false, false, true); // Bart
        }

        // 9. DUA
        else if (id === 'dua') {
            // Hotpants schwarz, Top schwarz, lange schwarze Haare, sehr dünn
            drawVectorBody(skinL, black, black, black, { width: 0.8, pantsLen: 4 }); // 0.8 Width = Dünn
            // Bauchfrei (Haut malen über schwarz)
            ctx.fillStyle=skinL; ctx.fillRect(-8, -4, 16, 4);
            // Lange Haare
            ctx.fillStyle=black;
            ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, 0); ctx.fill();
            if(d!=='back') {
                ctx.fillRect(-11, -25, 6, 24); ctx.fillRect(5, -25, 6, 24);
            } else {
                ctx.fillRect(-10, -25, 20, 24);
            }
            drawFace();
        }

        // 10. GAGA
        else if (id === 'gaga') {
            // Blauer Anzug, Blauer Visor, Blonde Haare
            const blue = '#0055ff';
            drawVectorBody(skinL, blue, blue, white, { width: 0.9, pantsLen: 5 });
            // Haare
            ctx.fillStyle='#eee'; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, 0); ctx.fill();
            if(d!=='back') { ctx.fillRect(-11, -25, 5, 20); ctx.fillRect(6, -25, 5, 20); }
            // Visor
            drawFace(false, true);
        }

        // 11. 007
        else if (id === '007') {
            // Grauer Anzug
            drawVectorBody(skinL, '#555', '#333', black);
            if(d==='front') {
                ctx.fillStyle=white; ctx.beginPath(); ctx.moveTo(-5,-16); ctx.lineTo(5,-16); ctx.lineTo(0,-6); ctx.fill();
                ctx.fillStyle=black; ctx.fillRect(-2, -14, 4, 3); // Fliege
            }
            // Haare (Blond/Braun Craig)
            ctx.fillStyle='#aa9977'; ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, 0); ctx.fill();
            drawFace();
        }
    }

    // Cursed Effekt (Weiß blinkend)
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

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    const showCursedEffect = isCursed && (Math.floor(Date.now() / 100) % 2 === 0);
    const sprite = getCachedSprite(charDef, d, showCursedEffect);
    
    ctx.drawImage(sprite, -24, -44);
    
    ctx.restore();
}