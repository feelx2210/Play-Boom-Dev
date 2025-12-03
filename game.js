const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIG ---
const TILE_SIZE = 48; 
const GRID_W = 15;
const GRID_H = 15;

const COLORS = {
    EXPLOSION_CORE: '#ffffcc'
};

// KEY BINDINGS CONFIG
const keyBindings = {
    UP: 'ArrowUp',
    DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    BOMB: 'Space',
    CHANGE: 'KeyX'
};

const BOOST_PADS = [
    {x: 5, y: 5}, {x: 9, y: 5}, {x: 5, y: 9}, {x: 9, y: 9}
];

const HELL_CENTER = { x: 7, y: 7 };

const CHARACTERS = [
    { id: 'rambo', name: 'Rambo', color: '#44aa44', accent: '#aa0000' }, 
    { id: 'lucifer', name: 'Lucifer', color: '#ff0000', accent: '#000000' }, 
    { id: 'nun', name: 'Nun', color: '#eeeeee', accent: '#000000' }, 
    { id: 'yeti', name: 'Yeti', color: '#00ccff', accent: '#ffffff' }
];

const LEVELS = {
    hell: {
        id: 'hell',
        name: 'Hell',
        bg: '#120505',
        wallHard: '#333333',
        wallSoft: '#aa0000',
        wallSoftLight: '#cc3333',
        grid: '#220a0a',
        glow: '#ff0000',
        border: '#550000',
        hasCentralFire: true
    },
    ice: {
        id: 'ice',
        name: 'Ice',
        bg: '#000044', 
        wallHard: '#4466ff', 
        wallSoft: '#88ccff', 
        wallSoftLight: '#ccffff',
        grid: '#000066',
        glow: '#00ccff',
        border: '#004488'
    },
    jungle: {
        id: 'jungle',
        name: 'Jungle',
        bg: '#4a3b2a', 
        wallHard: '#666666', 
        wallSoft: '#228822', 
        wallSoftLight: '#44aa44',
        grid: '#3a2b1a',
        glow: '#22aa22',
        border: '#114411',
        hasRiver: true 
    },
    stone: {
        id: 'stone',
        name: 'Stone',
        bg: '#1a1a1a',
        wallHard: '#444444', 
        wallSoft: '#888888',
        wallSoftLight: '#aaaaaa',
        grid: '#222222',
        glow: '#aaaaaa',
        border: '#666666'
    }
};

let currentLevel = LEVELS.hell;
let selectedCharIndex = 0; 
let selectedLevelKey = 'hell';
let menuState = 0; 

const TYPES = { EMPTY: 0, WALL_HARD: 1, WALL_SOFT: 2, BOMB: 3, WATER: 5, BRIDGE: 6 };
const ITEMS = { NONE: 0, BOMB_UP: 1, RANGE_UP: 2, SPEED_UP: 3, SKULL: 4, NAPALM: 5, ROLLING: 6 };
const BOMB_MODES = { STANDARD: 0, NAPALM: 1, ROLLING: 2 };

let grid = [], items = [], bombs = [], particles = [], players = [];
let isGameOver = false;
let isPaused = false;
let gameLoopId;

let hellFireTimer = 0;
let hellFirePhase = 'IDLE'; 
let hellFireActive = false; 

const keys = {}; 
let remappingAction = null;

// --- DRAWING HELPERS ---

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
    R = Math.round(R); G = Math.round(G); B = Math.round(B);
    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

function drawCharacterSprite(ctx, x, y, charDef, isCursed = false, dir = {x:0, y:1}) {
    ctx.save();
    ctx.translate(x, y);

    let d = 'front'; 
    if (dir.y < 0) d = 'back';
    else if (dir.x !== 0) d = 'side';
    
    if (dir.x < 0) ctx.scale(-1, 1); 

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI*2); ctx.fill();

    // -- HIGH RES PIXEL ART RENDERER --

    if (charDef.id === 'lucifer') {
        // --- LUCIFER ---
        const cBase = '#e62020';
        const cDark = '#aa0000'; 
        const cLite = '#ff5555'; 
        const cHoof = '#1a0505'; 

        if (d === 'side') {
            ctx.fillStyle = cDark; ctx.fillRect(2, 12, 6, 10);
            ctx.fillStyle = cHoof; ctx.fillRect(2, 20, 6, 4); 
            ctx.fillStyle = cBase; ctx.fillRect(-6, 12, 6, 10);
            ctx.fillStyle = cHoof; ctx.fillRect(-6, 20, 6, 4); 
        } else {
            ctx.fillStyle = cBase; 
            ctx.fillRect(-8, 12, 6, 10); ctx.fillRect(2, 12, 6, 10);
            ctx.fillStyle = cHoof; 
            ctx.fillRect(-8, 20, 6, 4); ctx.fillRect(2, 20, 6, 4);
        }

        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 10);
        bodyGrad.addColorStop(0, '#ff4444'); bodyGrad.addColorStop(1, '#aa0000');
        ctx.fillStyle = bodyGrad; ctx.fillRect(-8, -18, 16, 30);
        
        if (d === 'front') {
            ctx.fillStyle = cDark; ctx.fillRect(-1, -14, 2, 16); 
            ctx.fillRect(-7, -8, 6, 2); ctx.fillRect(1, -8, 6, 2); 
            ctx.fillStyle = cLite; ctx.fillRect(-9, -18, 4, 4); ctx.fillRect(5, -18, 4, 4);
        }

        const headGrad = ctx.createLinearGradient(0, -24, 0, -10);
        headGrad.addColorStop(0, '#ff5555'); headGrad.addColorStop(1, '#cc0000');
        ctx.fillStyle = headGrad; ctx.fillRect(-9, -24, 18, 15); 
        ctx.fillRect(-6, -10, 12, 4);

        const hornGrad = ctx.createLinearGradient(0, -35, 0, -20);
        hornGrad.addColorStop(0, '#ffffff'); hornGrad.addColorStop(1, '#bbbbbb');
        ctx.fillStyle = hornGrad;

        if (d === 'front') {
            ctx.fillStyle = cBase; 
            ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-16, -24); ctx.lineTo(-10, -16); ctx.fill();
            ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(16, -24); ctx.lineTo(10, -16); ctx.fill();

            ctx.fillStyle = hornGrad;
            ctx.beginPath(); ctx.moveTo(-7, -24); ctx.quadraticCurveTo(-18, -30, -14, -38); ctx.lineTo(-5, -26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(7, -24); ctx.quadraticCurveTo(18, -30, 14, -38); ctx.lineTo(5, -26); ctx.fill();

            ctx.fillStyle = '#ffff00'; 
            ctx.fillRect(-8, -20, 5, 4); ctx.fillRect(3, -20, 5, 4);
            ctx.fillStyle = '#000'; 
            ctx.fillRect(-6, -19, 2, 2); ctx.fillRect(5, -19, 2, 2); 
            
            ctx.fillStyle = cDark; ctx.fillRect(-2, -16, 4, 2);

            ctx.fillStyle = '#440000'; 
            ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(0, -6, 6, -10); ctx.lineTo(0, -8); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillRect(-5, -10, 2, 2); ctx.fillRect(3, -10, 2, 2);

            ctx.fillStyle = cBase; 
            ctx.fillRect(-14, -16, 5, 18); ctx.fillRect(9, -16, 5, 18);
            ctx.fillStyle = cDark; 
            ctx.fillRect(-14, -2, 5, 4); ctx.fillRect(9, -2, 5, 4);

        } else if (d === 'back') {
            ctx.fillStyle = cDark; ctx.fillRect(-4, -18, 8, 30); 
            ctx.fillStyle = '#ddd'; 
            ctx.beginPath(); ctx.moveTo(-7, -24); ctx.quadraticCurveTo(-18, -30, -14, -38); ctx.lineTo(-5, -26); ctx.fill();
            ctx.beginPath(); ctx.moveTo(7, -24); ctx.quadraticCurveTo(18, -30, 14, -38); ctx.lineTo(5, -26); ctx.fill();
            ctx.strokeStyle = '#aa0000'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(16, 22, 8, 30); ctx.stroke();
            ctx.fillStyle = '#aa0000'; ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(12, 34); ctx.lineTo(4, 34); ctx.fill();
            ctx.fillStyle = cBase; ctx.fillRect(-14, -16, 5, 18); ctx.fillRect(9, -16, 5, 18);
        } else if (d === 'side') {
            ctx.fillStyle = hornGrad;
            ctx.beginPath(); ctx.moveTo(2, -24); ctx.quadraticCurveTo(10, -30, 12, -38); ctx.lineTo(8, -24); ctx.fill();
            ctx.fillStyle = '#ffff00'; ctx.fillRect(4, -19, 4, 4); 
            ctx.fillStyle = cDark; ctx.fillRect(8, -16, 4, 2); 
            ctx.fillStyle = cBase; ctx.fillRect(0, -12, 5, 16); 
            ctx.fillStyle = cDark; ctx.fillRect(0, 0, 6, 4); 
            ctx.strokeStyle = '#aa0000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(-16, 20, -12, 26); ctx.stroke();
        }
    } 
    else if (charDef.id === 'rambo') {
        // --- RAMBO ---
        const cGreen = '#226622'; const cDarkG = '#113311'; const cLiteG = '#448844';
        const cSkin  = '#ffccaa'; const cSkinS = '#ddaa88'; const cBandana = '#dd0000';

        ctx.fillStyle = cGreen;
        if (d === 'side') { 
            ctx.fillRect(-5, 12, 8, 8); 
            ctx.fillStyle = '#111'; ctx.fillRect(-5, 20, 9, 4); 
        } else { 
            ctx.fillRect(-10, 12, 8, 8); ctx.fillRect(2, 12, 8, 8); 
            ctx.fillStyle = '#111'; 
            ctx.fillRect(-10, 20, 8, 4); ctx.fillRect(2, 20, 8, 4); 
        }

        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 12);
        bodyGrad.addColorStop(0, '#448844'); bodyGrad.addColorStop(1, '#225522');
        ctx.fillStyle = bodyGrad; ctx.fillRect(-12, -20, 24, 32);
        ctx.fillStyle = cDarkG;
        ctx.fillRect(-10, -16, 6, 4); ctx.fillRect(4, -8, 6, 4); ctx.fillRect(-6, 4, 6, 4);
        ctx.fillStyle = cLiteG;
        ctx.fillRect(6, -18, 4, 4); ctx.fillRect(-8, 0, 4, 4); ctx.fillRect(2, 10, 4, 4);

        if (d === 'front') {
            ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18);
            ctx.fillStyle = cSkinS; ctx.fillRect(-19, -18, 2, 18); 
            
            ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(12, 12); ctx.lineTo(6, 12); ctx.lineTo(-12, -14); ctx.fill();
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(-9, -18, 3, 5); ctx.fillRect(-3, -10, 3, 5); ctx.fillRect(3, -2, 3, 5);
            ctx.fillStyle = cSkin; ctx.fillRect(-10, -26, 20, 16); 
            ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(10, -24, 6, 6); 
            ctx.fillStyle = '#fff'; ctx.fillRect(-8, -18, 7, 7); ctx.fillRect(1, -18, 7, 7);
            ctx.fillStyle = '#000'; ctx.fillRect(-5, -16, 2, 2); ctx.fillRect(3, -16, 2, 2); 
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(-10, -14, 20, 4);

        } else if (d === 'back') {
            ctx.fillStyle = cSkin; ctx.fillRect(-19, -18, 7, 18); ctx.fillRect(12, -18, 7, 18);
            ctx.fillStyle = '#553311'; ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(-12, 12); ctx.lineTo(-6, 12); ctx.lineTo(12, -14); ctx.fill();
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(8, -16, 4, 6); ctx.fillRect(2, -8, 4, 6); ctx.fillRect(-4, 0, 4, 6);
            ctx.fillStyle = '#111'; ctx.fillRect(-10, -26, 20, 16); 
            ctx.fillStyle = cBandana; ctx.fillRect(-12, -26, 24, 6); ctx.fillRect(-4, -26, 8, 12); 
        } else if (d === 'side') {
            ctx.fillStyle = '#553311'; ctx.fillRect(-6, -18, 12, 28);
            ctx.fillStyle = cSkin; ctx.fillRect(-7, -26, 16, 16); 
            ctx.fillStyle = '#111'; ctx.fillRect(-9, -26, 4, 16);
            ctx.fillStyle = cBandana; ctx.fillRect(-9, -26, 20, 6); ctx.fillRect(-13, -24, 6, 6); 
            ctx.fillStyle = '#fff'; ctx.fillRect(4, -18, 5, 6); ctx.fillStyle = '#000'; ctx.fillRect(7, -16, 2, 2);
            ctx.fillStyle = cSkin; ctx.fillRect(0, -12, 7, 20);
            ctx.fillStyle = cGreen; ctx.fillRect(0, -16, 7, 4); 
        }
    }
    else if (charDef.id === 'nun') {
        // --- NUN ---
        ctx.fillStyle = '#111'; 
        if (d === 'side') ctx.fillRect(-5, 14, 10, 4);
        else { ctx.fillRect(-7, 14, 6, 4); ctx.fillRect(1, 14, 6, 4); }

        const robeGrad = ctx.createLinearGradient(0, -20, 0, 14);
        robeGrad.addColorStop(0, '#333'); robeGrad.addColorStop(1, '#000');

        if (d === 'front') {
            ctx.fillStyle = robeGrad; 
            ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(-12, 0, -10, 14); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(12, 0, 10, 14); ctx.stroke();
            ctx.fillStyle = '#eee';
            ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(-14, -24, -16, -8); ctx.lineTo(16, -8); ctx.quadraticCurveTo(14, -24, 0, -26); ctx.fill();
            ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.fillRect(-4, -17, 2, 2); ctx.fillRect(2, -17, 2, 2); 
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -19, 10, Math.PI, 0); ctx.fill();
            const gold = ctx.createLinearGradient(0,-6,0,10); gold.addColorStop(0,'#ffdd44'); gold.addColorStop(1,'#aa7700');
            ctx.fillStyle = gold; 
            ctx.fillRect(-3, -6, 6, 16); ctx.fillRect(-8, -2, 16, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-1, -6, 1, 16); 
            ctx.fillStyle = '#111'; ctx.fillRect(-20, -12, 8, 18); ctx.fillRect(12, -12, 8, 18);
            ctx.fillStyle = '#ffccaa'; ctx.fillRect(-18, 4, 4, 4); ctx.fillRect(14, 4, 4, 4); 

        } else if (d === 'back') {
            ctx.fillStyle = '#111'; 
            ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-18, -4, -16, 14); ctx.lineTo(16, 14); ctx.quadraticCurveTo(18, -4, 0, -24); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(-14, -10, -12, 10); ctx.lineTo(12, 10); ctx.quadraticCurveTo(14, -10, 0, -28); ctx.fill();
            ctx.fillStyle = '#eee'; 
            ctx.fillRect(-8, -24, 16, 2); 
            ctx.fillStyle = robeGrad; ctx.fillRect(-18, -12, 6, 18); ctx.fillRect(12, -12, 6, 18);

        } else if (d === 'side') {
            ctx.fillStyle = '#111'; 
            ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(-14, -10, -12, 14); ctx.lineTo(10, 14); ctx.quadraticCurveTo(12, -10, 0, -24); ctx.fill();
            ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(-8, -26); ctx.lineTo(-10, -8); ctx.lineTo(4, -8); ctx.fill();
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.quadraticCurveTo(-14, -16, -12, 10); ctx.lineTo(-6, 10); ctx.quadraticCurveTo(-8, -16, -4, -26); ctx.fill();
            ctx.fillStyle = '#ffccaa'; ctx.fillRect(2, -22, 6, 12); 
            ctx.fillStyle = '#000'; ctx.fillRect(6, -18, 2, 2); 
            ctx.fillStyle = '#cc9922'; ctx.fillRect(4, 0, 4, 10); ctx.fillRect(2, 2, 8, 4);
            ctx.fillStyle = '#111'; ctx.fillRect(-2, -12, 10, 18);
            ctx.fillStyle = '#ffccaa'; ctx.fillRect(-2, 4, 8, 4);
        }
    }
    else if (charDef.id === 'yeti') {
        // --- YETI ---
        const furBase = '#00ccff';
        const furDark = '#0088bb';
        const furLite = '#e0ffff'; 

        ctx.fillStyle = furBase;
        if (d === 'side') { ctx.fillRect(-6, 12, 12, 10); } else { ctx.fillRect(-10, 12, 8, 10); ctx.fillRect(2, 12, 8, 10); }
        
        const furGrad = ctx.createLinearGradient(0, -24, 0, 12);
        furGrad.addColorStop(0, furBase); furGrad.addColorStop(1, furDark);
        ctx.fillStyle = furGrad;
        ctx.fillRect(-16, -24, 32, 36); 
        
        ctx.fillStyle = furDark;
        ctx.fillRect(-16, 0, 8, 8); ctx.fillRect(8, -8, 8, 8); ctx.fillRect(-4, 20, 8, 8);
        ctx.fillStyle = furLite;
        ctx.fillRect(-12, -20, 4, 4); ctx.fillRect(4, -16, 4, 4); ctx.fillRect(10, 4, 4, 4);

        if (d === 'front') {
            ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26);
            ctx.fillStyle = furLite; ctx.fillRect(-22, -16, 8, 4); ctx.fillRect(14, -16, 8, 4); 

            ctx.fillStyle = '#005599'; ctx.fillRect(-12, -20, 24, 14);
            ctx.fillStyle = '#fff'; ctx.fillRect(-8, -17, 6, 6); ctx.fillRect(2, -17, 6, 6);
            ctx.fillStyle = '#000'; ctx.fillRect(-6, -16, 2, 2); ctx.fillRect(4, -16, 2, 2);
            ctx.fillStyle = '#fff'; ctx.fillRect(-6, -8, 3, 4); ctx.fillRect(3, -8, 3, 4);
        } else if (d === 'back') {
            ctx.fillStyle = furDark; ctx.fillRect(-10, -14, 20, 24);
            ctx.fillStyle = furBase; ctx.fillRect(-22, -16, 8, 26); ctx.fillRect(14, -16, 8, 26);
        } else if (d === 'side') {
            ctx.fillStyle = '#005599'; ctx.fillRect(6, -20, 10, 14); 
            ctx.fillStyle = '#fff'; ctx.fillRect(10, -17, 4, 6);
            ctx.fillStyle = '#000'; ctx.fillRect(12, -16, 2, 2);
            
            ctx.fillStyle = furBase; ctx.fillRect(-4, -14, 12, 26); 
            ctx.fillStyle = furLite; ctx.fillRect(-4, -14, 12, 4);
        }
    }

    if (isCursed && Math.floor(Date.now()/100)%2===0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(-25, -35, 50, 60);
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
}

function drawLevelPreview(ctx, w, h, levelDef) {
    const tileSize = w / 3; 
    
    ctx.fillStyle = levelDef.bg;
    ctx.fillRect(0, 0, w, h);

    const drawBlock = (x, y, type) => {
        const px = x * tileSize;
        const py = y * tileSize;
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


// --- MENU LOGIC ---

function initMenu() {
    // Clear containers
    const charContainer = document.getElementById('char-select');
    charContainer.innerHTML = '';
    const levelContainer = document.getElementById('level-select');
    levelContainer.innerHTML = '';
    
    // Update class for active group
    if (menuState === 0) {
        charContainer.classList.add('active-group');
        charContainer.classList.remove('inactive-group');
        levelContainer.classList.add('inactive-group');
        levelContainer.classList.remove('active-group');
        document.getElementById('start-game-btn').classList.remove('focused');
    } else if (menuState === 1) {
        charContainer.classList.add('inactive-group');
        charContainer.classList.remove('active-group');
        levelContainer.classList.add('active-group');
        levelContainer.classList.remove('inactive-group');
        document.getElementById('start-game-btn').classList.remove('focused');
    } else if (menuState === 2) {
        charContainer.classList.add('inactive-group');
        levelContainer.classList.add('inactive-group');
        document.getElementById('start-game-btn').classList.add('focused');
    }

    // 1. Characters
    CHARACTERS.forEach((char, index) => {
        const div = document.createElement('div');
        div.className = `option-card ${index === selectedCharIndex ? 'selected' : ''}`;
        div.onclick = () => {
            // Allow mouse override
            menuState = 0;
            selectChar(index);
        };
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 48;
        previewCanvas.height = 48;
        previewCanvas.className = 'preview-canvas';
        const pCtx = previewCanvas.getContext('2d');
        
        drawCharacterSprite(pCtx, 24, 36, char); 

        div.appendChild(previewCanvas);
        
        const label = document.createElement('div');
        label.className = 'card-label';
        label.innerText = char.name;
        div.appendChild(label);

        charContainer.appendChild(div);
    });

    // 2. Levels
    Object.keys(LEVELS).forEach((key, index) => {
        const lvl = LEVELS[key];
        const div = document.createElement('div');
        const isSelected = key === selectedLevelKey;
        div.className = `option-card ${isSelected ? 'selected' : ''}`;
        div.onclick = () => {
            menuState = 1;
            selectLevel(key);
        };
        
        const lvlCanvas = document.createElement('canvas');
        lvlCanvas.width = 48;
        lvlCanvas.height = 48;
        lvlCanvas.className = 'preview-canvas';
        const lCtx = lvlCanvas.getContext('2d');
        
        drawLevelPreview(lCtx, 48, 48, lvl);

        div.appendChild(lvlCanvas);

        const label = document.createElement('div');
        label.className = 'card-label';
        label.innerText = lvl.name;
        div.appendChild(label);

        levelContainer.appendChild(div);
    });
}

function showControls() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('controls-menu').classList.remove('hidden');
    initControlsMenu();
}

function initControlsMenu() {
    const container = document.getElementById('controls-list');
    container.innerHTML = '';
    const formatKey = (code) => code.replace('Key', '').replace('Arrow', '').replace('Space', 'SPACE').toUpperCase();
    Object.keys(keyBindings).forEach(action => {
        const row = document.createElement('div');
        row.className = 'control-row';
        const label = document.createElement('span');
        label.innerText = action;
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        btn.innerText = remappingAction === action ? 'PRESS KEY...' : formatKey(keyBindings[action]);
        if (remappingAction === action) btn.classList.add('active');
        btn.onclick = () => startRemap(action);
        row.appendChild(label);
        row.appendChild(btn);
        container.appendChild(row);
    });
}

function startRemap(action) {
    remappingAction = action;
    initControlsMenu(); 
}

function selectChar(index) {
    selectedCharIndex = index;
    initMenu(); 
}

function selectLevel(key) {
    selectedLevelKey = key;
    initMenu();
}

function showMenu() {
    cancelAnimationFrame(gameLoopId);
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden'); 
    document.getElementById('pause-menu').classList.add('hidden'); 
    document.getElementById('controls-menu').classList.add('hidden');
    
    // Reset Menu State
    menuState = 0;
    initMenu();
}

function handleMenuInput(code) {
    const levelKeys = Object.keys(LEVELS);
    const currentLevelIndex = levelKeys.indexOf(selectedLevelKey);

    if (menuState === 0) {
        // CHAR SELECT
        if (code === 'ArrowLeft') {
            selectedCharIndex = (selectedCharIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
            initMenu();
        } else if (code === 'ArrowRight') {
            selectedCharIndex = (selectedCharIndex + 1) % CHARACTERS.length;
            initMenu();
        } else if (code === 'Enter' || code === 'Space') {
            menuState = 1; // Jump to Level
            initMenu();
        }
    } else if (menuState === 1) {
        // LEVEL SELECT
        if (code === 'ArrowLeft') {
            const newIndex = (currentLevelIndex - 1 + levelKeys.length) % levelKeys.length;
            selectedLevelKey = levelKeys[newIndex];
            initMenu();
        } else if (code === 'ArrowRight') {
            const newIndex = (currentLevelIndex + 1) % levelKeys.length;
            selectedLevelKey = levelKeys[newIndex];
            initMenu();
        } else if (code === 'Enter' || code === 'Space') {
            menuState = 2; // Jump to Start Button
            initMenu();
        }
    } else if (menuState === 2) {
        // START BUTTON
        if (code === 'Enter' || code === 'Space') {
            startGame();
        } else if (code === 'ArrowUp') {
            menuState = 1; // Go back to Level
            initMenu();
        }
    }
}

function togglePause() {
    if (isGameOver || !document.getElementById('main-menu').classList.contains('hidden')) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pause-menu').classList.remove('hidden');
    } else {
        document.getElementById('pause-menu').classList.add('hidden');
    }
}

function quitGame() {
    isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    showMenu();
}

class Player {
    constructor(id, x, y, charDef, isBot = false) {
        this.id = id;
        this.charDef = charDef; 
        this.name = charDef.name;
        this.startX = x * TILE_SIZE;
        this.startY = y * TILE_SIZE;
        this.x = this.startX; 
        this.y = this.startY;
        this.gridX = x; this.gridY = y;
        this.isBot = isBot;
        this.alive = true;
        this.invincibleTimer = 0;
        this.fireTimer = 0;
        this.speed = 2; 
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.bombRange = 1;
        this.hasNapalm = false; this.napalmTimer = 0;
        this.hasRolling = false; this.rollingTimer = 0;
        this.currentBombMode = BOMB_MODES.STANDARD;
        this.lastDir = {x: 0, y: 1}; 
        this.skullEffect = null; this.skullTimer = 0;
        this.targetX = x; this.targetY = y; this.changeDirTimer = 0; 
        this.bobTimer = 0; 
    }

    update() {
        if (!this.alive) return;

        this.bobTimer += 0.2;

        if (this.hasRolling) {
            this.rollingTimer--;
            if (this.rollingTimer <= 0) {
                this.hasRolling = false;
                if (this.currentBombMode === BOMB_MODES.ROLLING) {
                    this.currentBombMode = BOMB_MODES.STANDARD;
                    this.updateHud();
                }
                createFloatingText(this.x, this.y, "ROLLING LOST", "#cccccc");
            }
        }
        if (this.hasNapalm) {
            this.napalmTimer--;
            if (this.napalmTimer <= 0) {
                this.hasNapalm = false;
                if (this.currentBombMode === BOMB_MODES.NAPALM) {
                    this.currentBombMode = BOMB_MODES.STANDARD;
                    this.updateHud();
                }
                createFloatingText(this.x, this.y, "NAPALM LOST", "#cccccc");
            }
        }
        
        if (this.invincibleTimer > 0) this.invincibleTimer--;

       // --- HIER DEN NEUEN CODE EINFÜGEN ---
        let currentSpeed = this.speed;

        if (this.skullEffect) {
            // Timer IMMER runterzählen, egal welcher Effekt
            this.skullTimer--;
            
            if (this.skullTimer <= 0) {
                this.skullEffect = null;
                createFloatingText(this.x, this.y, "CURED!", "#00ff00");
            } else {
                // Aktive Effekte anwenden
                if (this.skullEffect === 'sickness') {
                    if (Math.random() < 0.05) this.plantBomb();
                } else if (this.skullEffect === 'speed_rush') {
                    currentSpeed *= 2;
                } else if (this.skullEffect === 'slow') {
                    currentSpeed *= 0.5;
                }
            }
        }
        // -------------------------------------
        }

        let dx = 0, dy = 0;
        if (this.isBot) {
            this.updateBot(currentSpeed);
        } else {
            if (keys[keyBindings.UP]) dy = -currentSpeed;
            if (keys[keyBindings.DOWN]) dy = currentSpeed;
            if (keys[keyBindings.LEFT]) dx = -currentSpeed;
            if (keys[keyBindings.RIGHT]) dx = currentSpeed;
            
            if (dx !== 0 || dy !== 0) {
                if (Math.abs(dx) > Math.abs(dy)) this.lastDir = {x: Math.sign(dx), y: 0};
                else this.lastDir = {x: 0, y: Math.sign(dy)};
            }
            
            if (keys[keyBindings.BOMB]) { this.plantBomb(); keys[keyBindings.BOMB] = false; } 
            
            // MOVEMENT CONSTRAINT: REDUCED SLACK
            const size = TILE_SIZE * 0.85; // 40.8px hitbox in 48px tunnel -> 7.2px slack
            const offset = (TILE_SIZE - size) / 2;

            const check = (x, y) => {
                const gx = Math.floor(x / TILE_SIZE);
                const gy = Math.floor(y / TILE_SIZE);
                if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
                if (grid[gy][gx] === TYPES.WALL_HARD || grid[gy][gx] === TYPES.WALL_SOFT) return true;
                if (grid[gy][gx] === TYPES.BOMB) {
                    const bomb = bombs.find(b => b.gx === gx && b.gy === gy);
                    if (bomb && !bomb.walkableIds.includes(this.id)) return true;
                }
                return false;
            };

            if (dx !== 0) {
                const nextX = this.x + dx;
                const xEdge = dx > 0 ? nextX + size + offset : nextX + offset;
                const topY = this.y + offset;
                const bottomY = this.y + size + offset;
                if (!check(xEdge, topY) && !check(xEdge, bottomY)) this.x = nextX;
                else if (check(xEdge, topY) && !check(xEdge, bottomY)) this.y += this.speed;
                else if (!check(xEdge, topY) && check(xEdge, bottomY)) this.y -= this.speed;
            }
            if (dy !== 0) {
                const nextY = this.y + dy;
                const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
                const leftX = this.x + offset;
                const rightX = this.x + size + offset;
                if (!check(leftX, yEdge) && !check(rightX, yEdge)) this.y = nextY;
                else if (check(leftX, yEdge) && !check(rightX, yEdge)) this.x += this.speed;
                else if (!check(leftX, yEdge) && check(rightX, yEdge)) this.x -= this.speed;
            }
            this.gridX = Math.round(this.x / TILE_SIZE);
            this.gridY = Math.round(this.y / TILE_SIZE);
        }

        this.checkItem();
    }

    updateBot(speed) {
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        const dangerMap = this.getDangerMap();
        const amInDanger = dangerMap[gy][gx];
        let targetDir = {x:0, y:0};

        if (amInDanger) {
            targetDir = this.findSafeMove(gx, gy, dangerMap);
        } else {
            const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
            const nearTarget = neighbors.some(d => {
                const tx = gx + d.x; const ty = gy + d.y;
                if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
                return grid[ty][tx] === TYPES.WALL_SOFT; 
            });

            if (nearTarget && Math.random() < 0.05 && this.activeBombs < this.maxBombs) {
                if (this.canEscapeAfterPlanting(gx, gy, dangerMap)) {
                    this.plantBomb();
                    targetDir = this.findSafeMove(gx, gy, this.getDangerMap()); 
                }
            }

            if (targetDir.x === 0 && targetDir.y === 0) {
                if (this.changeDirTimer <= 0 || isSolid(Math.round((this.x + this.botDir.x*20)/TILE_SIZE), Math.round((this.y + this.botDir.y*20)/TILE_SIZE))) {
                    const safeNeighbors = neighbors.filter(d => {
                        const nx = gx + d.x; const ny = gy + d.y;
                        if (isSolid(nx, ny)) return false;
                        return !dangerMap[ny][nx];
                    });
                    
                    if (safeNeighbors.length > 0) {
                        const itemMove = safeNeighbors.find(d => items[gy+d.y][gx+d.x] !== ITEMS.NONE);
                        targetDir = itemMove || safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                    } else {
                        targetDir = {x:0, y:0};
                    }
                    this.changeDirTimer = 15 + Math.random() * 30;
                } else {
                    targetDir = this.botDir;
                }
            }
        }

        if (targetDir.x !== 0 || targetDir.y !== 0) {
            this.botDir = targetDir;
            if (this.botDir.x !== 0) this.botDir.y = 0;
            this.lastDir = { x: Math.sign(this.botDir.x), y: Math.sign(this.botDir.y) };
        }
        this.move(this.botDir.x * speed, this.botDir.y * speed);
        this.changeDirTimer--;
    }

    getDangerMap() {
        const map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(false));
        particles.forEach(p => { if (p.isFire && p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H) map[p.gy][p.gx] = true; });
        bombs.forEach(b => {
            const isBoost = currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
            const range = isBoost ? 15 : b.range;
            map[b.gy][b.gx] = true; 
            const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
            dirs.forEach(d => {
                for (let i = 1; i <= range; i++) {
                    const tx = b.gx + (d.x * i); const ty = b.gy + (d.y * i);
                    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
                    if (grid[ty][tx] === TYPES.WALL_HARD) break;
                    map[ty][tx] = true;
                    if (grid[ty][tx] === TYPES.WALL_SOFT) break; 
                }
            });
        });
        if (currentLevel.hasCentralFire && hellFirePhase !== 'IDLE') {
            const range = 5; const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
            dirs.forEach(d => {
                for(let i=1; i<=range; i++) {
                    const tx = HELL_CENTER.x + (d.x * i); const ty = HELL_CENTER.y + (d.y * i);
                    if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                        if (grid[ty][tx] === TYPES.WALL_HARD) break;
                        map[ty][tx] = true;
                        if (grid[ty][tx] === TYPES.WALL_SOFT) break;
                    }
                }
            });
        }
        return map;
    }

    findSafeMove(gx, gy, dangerMap) {
        const queue = [{x: gx, y: gy, firstMove: null, dist: 0}];
        const visited = new Set();
        visited.add(gx + "," + gy);
        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        while (queue.length > 0) {
            const current = queue.shift();
            if (!dangerMap[current.y][current.x]) return current.firstMove || {x:0, y:0}; 
            if (current.dist > 10) continue;
            for (let d of dirs) {
                const nx = current.x + d.x; const ny = current.y + d.y; const key = nx + "," + ny;
                if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited.has(key)) {
                    const isBlocked = isSolid(nx, ny);
                    if (!isBlocked) {
                        visited.add(key);
                        queue.push({ x: nx, y: ny, firstMove: current.firstMove || d, dist: current.dist + 1 });
                    }
                }
            }
        }
        return dirs[Math.floor(Math.random()*dirs.length)];
    }

    canEscapeAfterPlanting(gx, gy, currentDangerMap) {
        const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        const openNeighbors = neighbors.filter(d => {
            const nx = gx+d.x; const ny = gy+d.y;
            return !isSolid(nx, ny) && !currentDangerMap[ny][nx]; 
        });
        return openNeighbors.length > 0;
    }

    move(dx, dy) {
        const size = TILE_SIZE * 0.85; // TIGHTER MOVEMENT
        const offset = (TILE_SIZE - size) / 2;
        const check = (x, y) => {
            const gx = Math.floor(x / TILE_SIZE);
            const gy = Math.floor(y / TILE_SIZE);
            if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
            if (grid[gy][gx] === TYPES.WALL_HARD || grid[gy][gx] === TYPES.WALL_SOFT) return true;
            if (grid[gy][gx] === TYPES.BOMB) {
                const bomb = bombs.find(b => b.gx === gx && b.gy === gy);
                if (bomb && !bomb.walkableIds.includes(this.id)) return true;
            }
            return false;
        };

        if (dx !== 0) {
            const nextX = this.x + dx;
            const xEdge = dx > 0 ? nextX + size + offset : nextX + offset;
            const topY = this.y + offset;
            const bottomY = this.y + size + offset;
            if (!check(xEdge, topY) && !check(xEdge, bottomY)) this.x = nextX;
            else if (check(xEdge, topY) && !check(xEdge, bottomY)) this.y += this.speed;
            else if (!check(xEdge, topY) && check(xEdge, bottomY)) this.y -= this.speed;
        }
        if (dy !== 0) {
            const nextY = this.y + dy;
            const yEdge = dy > 0 ? nextY + size + offset : nextY + offset;
            const leftX = this.x + offset;
            const rightX = this.x + size + offset;
            if (!check(leftX, yEdge) && !check(rightX, yEdge)) this.y = nextY;
            else if (check(leftX, yEdge) && !check(rightX, yEdge)) this.x += this.speed;
            else if (!check(leftX, yEdge) && check(rightX, yEdge)) this.x -= this.speed;
        }
        this.gridX = Math.round(this.x / TILE_SIZE);
        this.gridY = Math.round(this.y / TILE_SIZE);
    }

    cycleBombType() {
        const modes = [BOMB_MODES.STANDARD];
        if (this.hasNapalm) modes.push(BOMB_MODES.NAPALM);
        if (this.hasRolling) modes.push(BOMB_MODES.ROLLING);
        let idx = modes.indexOf(this.currentBombMode);
        if (idx === -1) idx = 0;
        this.currentBombMode = modes[(idx + 1) % modes.length];
        this.updateHud();
    }

    updateHud() {
        if (this.id !== 1) return;
        const el = document.getElementById('bomb-type');
        switch(this.currentBombMode) {
            case BOMB_MODES.STANDARD: el.innerText = '⚫'; break;
            case BOMB_MODES.NAPALM: el.innerText = '☢️'; break;
            case BOMB_MODES.ROLLING: el.innerText = '🎳'; break;
        }
    }

    plantBomb() {
        const rollingBomb = bombs.find(b => b.owner === this && b.isRolling);
        if (rollingBomb) {
            rollingBomb.isRolling = false;
            rollingBomb.gx = Math.round(rollingBomb.px / TILE_SIZE);
            rollingBomb.gy = Math.round(rollingBomb.py / TILE_SIZE);
            rollingBomb.px = rollingBomb.gx * TILE_SIZE;
            rollingBomb.py = rollingBomb.gy * TILE_SIZE;
            grid[rollingBomb.gy][rollingBomb.gx] = TYPES.BOMB;
            return;
        }

        if (this.skullEffect === 'cant_plant') return;

        if (this.activeBombs >= this.maxBombs) return;
        const gx = Math.round(this.x / TILE_SIZE);
        const gy = Math.round(this.y / TILE_SIZE);
        if (grid[gy][gx] !== TYPES.EMPTY) return; 

        let isRolling = (this.currentBombMode === BOMB_MODES.ROLLING);
        let isNapalm = (this.currentBombMode === BOMB_MODES.NAPALM);

        const bomb = {
            owner: this,
            gx: gx, gy: gy,
            px: gx * TILE_SIZE, py: gy * TILE_SIZE,
            timer: 180, 
            range: this.bombRange, 
            napalm: isNapalm,
            isRolling: isRolling,
            isBlue: isRolling, 
            walkableIds: players.filter(p => {
                const pGx = Math.round(p.x / TILE_SIZE);
                const pGy = Math.round(p.y / TILE_SIZE);
                return pGx === gx && pGy === gy;
            }).map(p => p.id)
        };

        if (isRolling) {
            bomb.rollDir = {...this.lastDir};
            bomb.rollSpeed = 4;
        } else {
            grid[gy][gx] = TYPES.BOMB;
        }
        bombs.push(bomb);
        this.activeBombs++;
    }

    checkItem() {
        const gx = Math.floor((this.x + TILE_SIZE/2) / TILE_SIZE);
        const gy = Math.floor((this.y + TILE_SIZE/2) / TILE_SIZE);
        if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            if (items[gy][gx] !== ITEMS.NONE) {
                this.applyItem(items[gy][gx]);
                items[gy][gx] = ITEMS.NONE;
            }
        }
    }

    applyItem(type) {
        switch(type) {
            case ITEMS.BOMB_UP: this.maxBombs++; createFloatingText(this.x, this.y, "+1 BOMB"); break;
            case ITEMS.RANGE_UP: this.bombRange++; createFloatingText(this.x, this.y, "FIRE UP"); break;
            case ITEMS.SPEED_UP: this.speed = Math.min(this.speed+1, 6); createFloatingText(this.x, this.y, "SPEED UP"); break;
            case ITEMS.NAPALM: 
                this.hasNapalm = true; this.napalmTimer = 3600; 
                createFloatingText(this.x, this.y, "NAPALM! (60s)", "#ff0000"); break;
            case ITEMS.ROLLING: 
                this.hasRolling = true; this.rollingTimer = 3600; 
                createFloatingText(this.x, this.y, "ROLLING! (60s)", "#ffffff"); break;
            case ITEMS.SKULL: 
                const effects = ['sickness', 'speed_rush', 'slow', 'cant_plant'];
                const effect = effects[Math.floor(Math.random()*effects.length)];
                this.skullEffect = effect; this.skullTimer = 600;
                createFloatingText(this.x, this.y, "CURSED: "+effect.toUpperCase(), '#ff00ff'); break;
        }
    }

    draw() {
        if (!this.alive) return;
        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

        // Bobbing Animation
        const bob = Math.sin(this.bobTimer) * 2; 

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(this.x + TILE_SIZE/2, this.y + TILE_SIZE - 5, 10, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // Character uses the shared draw function with Direction!
        drawCharacterSprite(ctx, this.x + TILE_SIZE/2, this.y + TILE_SIZE/2 + bob, this.charDef, !!this.skullEffect, this.lastDir);
    }
}

function init() {
    canvas.width = GRID_W * TILE_SIZE;
    canvas.height = GRID_H * TILE_SIZE;

    window.addEventListener('keydown', e => {
        // If remapping, handle differently
        if (remappingAction) {
            e.preventDefault();
            keyBindings[remappingAction] = e.code;
            remappingAction = null;
            initControlsMenu(); // Update UI
            return;
        }

        // MENU NAVIGATION
        if (!document.getElementById('main-menu').classList.contains('hidden')) {
            handleMenuInput(e.code);
            return;
        }

        keys[e.code] = true;
        
        // Prevent scrolling with arrow keys or space
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
        
        if (e.code === keyBindings.BOMB) { /* handled in player update to prevent spam? No, check logic in player */ }
        if (e.code === keyBindings.CHANGE && players[0]) players[0].cycleBombType();
        if (e.key.toLowerCase() === 'p') togglePause();
    });
    window.addEventListener('keyup', e => {
        keys[e.code] = false;
    });
    
    let touchStartX = 0; let touchStartY = 0;
    canvas.addEventListener('touchstart', e => { e.preventDefault(); touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; keys[keyBindings.BOMB] = true; }, {passive:false});
    canvas.addEventListener('touchend', e => { e.preventDefault(); keys[keyBindings.BOMB] = false; keys[keyBindings.UP] = false; keys[keyBindings.DOWN] = false; keys[keyBindings.LEFT] = false; keys[keyBindings.RIGHT] = false; });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); const dx = e.touches[0].clientX - touchStartX; const dy = e.touches[0].clientY - touchStartY; keys[keyBindings.UP] = false; keys[keyBindings.DOWN] = false; keys[keyBindings.LEFT] = false; keys[keyBindings.RIGHT] = false; if (Math.abs(dx) > Math.abs(dy)) { if (dx > 30) keys[keyBindings.RIGHT] = true; if (dx < -30) keys[keyBindings.LEFT] = true; } else { if (dy > 30) keys[keyBindings.DOWN] = true; if (dy < -30) keys[keyBindings.UP] = true; } }, {passive:false});

    showMenu();
}

function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden'); 

    const userChar = CHARACTERS[selectedCharIndex];
    currentLevel = LEVELS[selectedLevelKey];
    
    const container = document.getElementById('game-container');
    container.style.boxShadow = `0 0 20px ${currentLevel.glow}`;
    container.style.borderColor = currentLevel.border;

    document.getElementById('p1-name').innerText = userChar.name.toUpperCase();

    grid = []; items = []; bombs = []; particles = []; players = [];
    isGameOver = false;
    isPaused = false;
    hellFireTimer = 0; 
    hellFirePhase = 'IDLE';
    hellFireActive = false; 

    for (let y = 0; y < GRID_H; y++) {
        let row = [];
        let itemRow = [];
        for (let x = 0; x < GRID_W; x++) {
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
                row.push(TYPES.WALL_HARD);
            }
            else if (currentLevel.id === 'jungle' && y === 7) {
                if (x === 3 || x === 7 || x === 11) {
                    row.push(TYPES.BRIDGE);
                } else {
                    row.push(TYPES.WATER);
                }
            }
            else if (x % 2 === 0 && y % 2 === 0) row.push(TYPES.WALL_HARD);
            else if (currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === x && p.y === y)) {
                row.push(TYPES.EMPTY); 
            }
            else if (Math.random() < 0.7) row.push(TYPES.WALL_SOFT);
            else row.push(TYPES.EMPTY);
            itemRow.push(ITEMS.NONE);
        }
        grid.push(row);
        items.push(itemRow);
    }

    const corners = [{x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1}, {x: GRID_W-2, y: 1}, {x: GRID_W-2, y: 2}, {x: GRID_W-3, y: 1}, {x: 1, y: GRID_H-2}, {x: 1, y: GRID_H-3}, {x: 2, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-2}, {x: GRID_W-3, y: GRID_H-2}, {x: GRID_W-2, y: GRID_H-3}];
    
    if (currentLevel.id === 'jungle') {
        for(let x=1; x<GRID_W-1; x++) {
            items[7][x] = ITEMS.NONE; 
        }
    }

    corners.forEach(p => grid[p.y][p.x] = TYPES.EMPTY);

    if (currentLevel.hasCentralFire) {
        grid[HELL_CENTER.y][HELL_CENTER.x] = TYPES.EMPTY;
        items[HELL_CENTER.y][HELL_CENTER.x] = ITEMS.NONE;
    }

    distributeItems();

    players.push(new Player(1, 1, 1, userChar, false));
    const availableChars = CHARACTERS.filter(c => c.id !== userChar.id);
    players.push(new Player(2, GRID_W-2, GRID_H-2, availableChars[0] || CHARACTERS[1], true));
    players.push(new Player(3, GRID_W-2, 1, availableChars[1] || CHARACTERS[2], true));
    players.push(new Player(4, 1, GRID_H-2, availableChars[2] || CHARACTERS[3], true));

    document.getElementById('bomb-type').innerText = '⚫';

    gameLoopId = requestAnimationFrame(gameLoop);
}

function distributeItems() {
    let softWalls = [];
    for(let y=0; y<GRID_H; y++) for(let x=0; x<GRID_W; x++) if (grid[y][x] === TYPES.WALL_SOFT) softWalls.push({x,y});
    softWalls.sort(() => Math.random() - 0.5);
    const itemCounts = [ {type: ITEMS.BOMB_UP, count: 8}, {type: ITEMS.RANGE_UP, count: 8}, {type: ITEMS.SPEED_UP, count: 4}, {type: ITEMS.NAPALM, count: 2}, {type: ITEMS.ROLLING, count: 3}, {type: ITEMS.SKULL, count: 4} ];
    let idx = 0;
    itemCounts.forEach(def => {
        for(let i=0; i<def.count; i++) if (idx < softWalls.length) { items[softWalls[idx].y][softWalls[idx].x] = def.type; idx++; }
    });
}
function isSolid(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return true;
    const t = grid[y][x];
    return t === TYPES.WALL_HARD || t === TYPES.WALL_SOFT || t === TYPES.BOMB;
}
function spawnRandomItem() {
    const p = players[0]; items[p.gridY][p.gridX] = Math.floor(Math.random() * 5) + 1;
}
function createFloatingText(x, y, text, color='#ffffff') {
    particles.push({x: x, y: y, text: text, life: 60, color: color, vy: -1});
}

function update() {
    if (isGameOver) return;
    players.forEach(p => p.inFire = false);

    if (currentLevel.hasCentralFire) {
        if (!hellFireActive) {
            const hitByFire = particles.some(p => p.isFire && p.gx === HELL_CENTER.x && p.gy === HELL_CENTER.y);
            if (hitByFire) {
                hellFireActive = true;
                hellFirePhase = 'WARNING'; 
                hellFireTimer = 0;
                createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "ACTIVATED!", "#ff0000");
            }
        } 
        else {
            hellFireTimer++;
            if (hellFirePhase === 'IDLE') {
                if (hellFireTimer >= 1800) {
                    hellFireTimer = 0;
                    hellFirePhase = 'WARNING';
                    createFloatingText(HELL_CENTER.x * TILE_SIZE, HELL_CENTER.y * TILE_SIZE, "!", "#ff0000");
                }
            } else if (hellFirePhase === 'WARNING') {
                if (hellFireTimer >= 180) {
                    hellFireTimer = 0;
                    hellFirePhase = 'IDLE'; 
                    triggerHellFire();
                }
            }
        }
    }

    for (let i = bombs.length - 1; i >= 0; i--) {
        let b = bombs[i]; b.timer--;
        
        if (b.isRolling) {
            b.px += b.rollDir.x * b.rollSpeed; b.py += b.rollDir.y * b.rollSpeed;
            const nextGx = Math.floor((b.px + TILE_SIZE/2) / TILE_SIZE);
            const nextGy = Math.floor((b.py + TILE_SIZE/2) / TILE_SIZE);
            
            const hitFire = particles.some(p => p.isFire && p.gx === nextGx && p.gy === nextGy);

            if (hitFire) {
                b.isRolling = false;
                b.gx = nextGx; b.gy = nextGy;
                b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE;
                b.timer = 0; 
            } else {
                let collision = false;
                if (nextGx < 0 || nextGx >= GRID_W || nextGy < 0 || nextGy >= GRID_H) collision = true;
                else if (grid[nextGy][nextGx] === TYPES.WALL_HARD || grid[nextGy][nextGx] === TYPES.WALL_SOFT) collision = true;
                else if (grid[nextGy][nextGx] === TYPES.BOMB) collision = true;

                if (!collision) {
                        const bRect = { l: b.px, r: b.px + TILE_SIZE, t: b.py, b: b.py + TILE_SIZE };
                        const hitPlayer = players.find(p => {
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
                    let occupiedByPlayer = players.some(p => {
                            if (!p.alive) return false;
                            const pGx = Math.round(p.x / TILE_SIZE); const pGy = Math.round(p.y / TILE_SIZE);
                            return pGx === b.gx && pGy === b.gy && !b.walkableIds.includes(p.id);
                    });
                    if (isSolid(b.gx, b.gy) || occupiedByPlayer) { b.gx -= b.rollDir.x; b.gy -= b.rollDir.y; }
                    b.px = b.gx * TILE_SIZE; b.py = b.gy * TILE_SIZE;
                    grid[b.gy][b.gx] = TYPES.BOMB;
                } else { b.gx = nextGx; b.gy = nextGy; }
            }
        }
        
        b.walkableIds = b.walkableIds.filter(pid => {
            const p = players.find(pl => pl.id === pid); if (!p) return false;
            const size = TILE_SIZE * 0.7; const offset = (TILE_SIZE - size) / 2;
            const pLeft = p.x + offset; const pRight = pLeft + size; const pTop = p.y + offset; const pBottom = pTop + size;
            const bLeft = b.px; const bRight = bLeft + TILE_SIZE; const bTop = b.py; const bBottom = bTop + TILE_SIZE;
            return (pLeft < bRight && pRight > bLeft && pTop < bBottom && pBottom > bTop);
        });
        
        if (b.timer <= 0) { explodeBomb(b); bombs.splice(i, 1); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; 
        p.life--;
        
        if (p.text) {
            p.y += p.vy;
        }
        
        if (p.isFire) {
            const fireX = p.gx * TILE_SIZE; 
            const fireY = p.gy * TILE_SIZE;
            const tolerance = 6; 
            const fkLeft = fireX + tolerance; 
            const fkRight = fireX + TILE_SIZE - tolerance;
            const fkTop = fireY + tolerance; 
            const fkBottom = fireY + TILE_SIZE - tolerance;

            // Player Collision
            players.forEach(pl => {
                if (!pl.alive) return;
                const hurtSize = 24; 
                const pCx = pl.x + TILE_SIZE/2; 
                const pCy = pl.y + TILE_SIZE/2;
                const plLeft = pCx - hurtSize/2; 
                const plRight = pCx + hurtSize/2; 
                const plTop = pCy - hurtSize/2; 
                const plBottom = pCy + hurtSize/2;
                if (plLeft < fkRight && plRight > fkLeft && plTop < fkBottom && plBottom > fkTop) pl.inFire = true;
            });

            // TRIGGER OTHER BOMBS (Chain Reaction)
            const hitBombIndex = bombs.findIndex(b => b.gx === p.gx && b.gy === p.gy);
            if (hitBombIndex !== -1) {
                const chainedBomb = bombs[hitBombIndex];
                // Only chain if timer is not already 0 (avoid infinite loop or double trigger)
                if (chainedBomb.timer > 1) {
                    if(chainedBomb.isRolling) { 
                        chainedBomb.isRolling = false; 
                        chainedBomb.px = chainedBomb.gx * TILE_SIZE; 
                        chainedBomb.py = chainedBomb.gy * TILE_SIZE; 
                    }
                    chainedBomb.timer = 0; 
                }
            }
        }
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Player Fire Damage Logic
    players.forEach(p => {
        if (p.inFire) {
            p.fireTimer++;
            if (p.fireTimer >= 12) { killPlayer(p); p.fireTimer = 0; }
        } else p.fireTimer = 0;
    });

    // Player Updates & Win Check
    let aliveCount = 0; let livingPlayers = [];
    players.forEach(p => { p.update(); if (p.alive) { aliveCount++; livingPlayers.push(p); } });

    // Infection Logic
    for (let i = 0; i < livingPlayers.length; i++) {
        for (let j = i + 1; j < livingPlayers.length; j++) {
            const p1 = livingPlayers[i];
            const p2 = livingPlayers[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < TILE_SIZE * 0.8) {
                if (p1.skullEffect && !p2.skullEffect) {
                    p2.skullEffect = p1.skullEffect;
                    p2.skullTimer = 600; 
                    createFloatingText(p2.x, p2.y, "INFECTED!", "#ff00ff");
                }
                else if (p2.skullEffect && !p1.skullEffect) {
                    p1.skullEffect = p2.skullEffect;
                    p1.skullTimer = 600; 
                    createFloatingText(p1.x, p1.y, "INFECTED!", "#ff00ff");
                }
            }
        }
    }

    if (players.length > 1 && aliveCount <= 1) {
        const winner = livingPlayers.length > 0 ? livingPlayers[0] : null;
        endGame(winner ? winner.name + " WINS!" : "DRAW!");
    }
}

function triggerHellFire() {
    const duration = 30; // Normal explosion time
    const range = 5; 
    
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = HELL_CENTER.x + (d.x * i); 
            const ty = HELL_CENTER.y + (d.y * i);
            
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            
            const tile = grid[ty][tx];
            
            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                createFire(tx, ty, duration); 
                break; 
            } else {
                destroyItem(tx, ty); 
                createFire(tx, ty, duration);
            }
        }
    });
}

function explodeBomb(b) {
    b.owner.activeBombs--;
    if (!b.isRolling) grid[b.gy][b.gx] = TYPES.EMPTY; 
    
    const isBoostPad = currentLevel.id !== 'stone' && BOOST_PADS.some(p => p.x === b.gx && p.y === b.gy);
    const range = isBoostPad ? 15 : b.range; 
    const duration = b.napalm ? 600 : 30;

    destroyItem(b.gx, b.gy);
    extinguishNapalm(b.gx, b.gy);
    createFire(b.gx, b.gy, duration, b.napalm);
    
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    dirs.forEach(d => {
        for (let i = 1; i <= range; i++) {
            const tx = b.gx + (d.x * i); 
            const ty = b.gy + (d.y * i);
            if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) break;
            const tile = grid[ty][tx];
            if (tile === TYPES.WALL_HARD) break;
            else if (tile === TYPES.WALL_SOFT) { 
                destroyWall(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, duration, b.napalm); 
                break; 
            } else {
                destroyItem(tx, ty); 
                extinguishNapalm(tx, ty); 
                createFire(tx, ty, duration, b.napalm);
            }
        }
    });
}

function extinguishNapalm(gx, gy) {
    particles.forEach(p => {
        if (p.isFire && p.isNapalm && p.gx === gx && p.gy === gy) {
            p.life = 0; 
        }
    });
}

function destroyItem(x, y) {
    if (items[y][x] !== ITEMS.NONE) {
        items[y][x] = ITEMS.NONE;
        createFloatingText(x * TILE_SIZE, y * TILE_SIZE, "ASHES", "#555555");
        for(let i=0; i<5; i++) {
            particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 30, color: '#333333', size: Math.random()*3 });
        }
    }
}

function createFire(gx, gy, duration, isNapalm = false) { 
    particles.push({ gx: gx, gy: gy, isFire: true, isNapalm: isNapalm, life: duration, color: duration > 60 ? '#ff4400' : '#ffaa00' }); 
}
function destroyWall(x, y) {
    grid[y][x] = TYPES.EMPTY;
    for(let i=0; i<5; i++) particles.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 20, color: '#882222', size: Math.random()*5 });
}

function killPlayer(p) {
    if (p.invincibleTimer > 0 || !p.alive) return;
    p.alive = false;
    createFloatingText(p.x, p.y, "ELIMINATED", "#ff0000");
    for(let i=0; i<15; i++) {
        particles.push({ x: p.x + 24, y: p.y + 24, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 60, color: p.color, size: 5 });
    }
}

function endGame(msg) {
    if (isGameOver) return; 
    isGameOver = true; 
    setTimeout(() => {
        document.getElementById('go-message').innerText = msg;
        document.getElementById('game-over').classList.remove('hidden');
    }, 3000);
}

function draw() {
    ctx.fillStyle = currentLevel.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentLevel.id !== 'stone') {
        BOOST_PADS.forEach(pad => {
            const px = pad.x * TILE_SIZE;
            const py = pad.y * TILE_SIZE;
            ctx.fillStyle = '#440000';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(px + 20, py + 8, 8, 32);
            ctx.beginPath(); ctx.moveTo(px+24, py+2); ctx.lineTo(px+30, py+10); ctx.lineTo(px+18, py+10); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(px+24, py+46); ctx.lineTo(px+30, py+38); ctx.lineTo(px+18, py+38); ctx.fill(); 
            ctx.fillRect(px + 8, py + 20, 32, 8);
            ctx.beginPath(); ctx.moveTo(px+2, py+24); ctx.lineTo(px+10, py+18); ctx.lineTo(px+10, py+30); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(px+46, py+24); ctx.lineTo(px+38, py+18); ctx.lineTo(px+38, py+30); ctx.fill(); 
        });
    }

    if (currentLevel.hasCentralFire) {
        const cx = HELL_CENTER.x * TILE_SIZE;
        const cy = HELL_CENTER.y * TILE_SIZE;
        const centerX = cx + TILE_SIZE/2;
        const centerY = cy + TILE_SIZE/2;

        ctx.fillStyle = '#0a0505'; 
        ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);

        if (!hellFireActive) {
            ctx.fillStyle = '#332222'; 
            const w = 16; 
            ctx.fillRect(centerX - w/2, cy, w, TILE_SIZE/2);
            ctx.fillRect(centerX - w/2, centerY, w, TILE_SIZE/2);
            ctx.fillRect(cx, centerY - w/2, TILE_SIZE/2, w);
            ctx.fillRect(centerX, centerY - w/2, TILE_SIZE/2, w);
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#221111';
            ctx.fill();
            ctx.strokeStyle = '#443333';
            ctx.lineWidth = 2;
            ctx.stroke();

        } else {
            let lavaColor = '#880000'; 
            let coreColor = '#aa2200';

            if (hellFirePhase === 'WARNING') {
                const pulse = Math.sin(Date.now() / 50); 
                const r = 200 + 55 * pulse;
                const g = 100 + 100 * pulse;
                lavaColor = `rgb(${r}, ${g}, 0)`; 
                coreColor = `rgb(255, ${220 + 35 * pulse}, 200)`; 
            }

            ctx.fillStyle = lavaColor;
            const w = 18; 
            
            ctx.fillRect(centerX - w/2, cy, w, TILE_SIZE);
            ctx.fillRect(cx, centerY - w/2, TILE_SIZE, w);

            ctx.strokeStyle = '#440000';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX - w/2, cy, w, TILE_SIZE);
            ctx.strokeRect(cx, centerY - w/2, TILE_SIZE, w);

            ctx.beginPath();
            ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
            ctx.fillStyle = coreColor;
            ctx.fill();
            
            ctx.strokeStyle = hellFirePhase === 'WARNING' ? '#ffff00' : '#ffaa00';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    if (currentLevel.id === 'ice') {
            for (let i = 0; i < 50; i++) {
                let sx = (Math.sin(i * 123.45) * 43758.5453) % 1 * canvas.width;
                let sy = (Math.cos(i * 678.90) * 12345.6789) % 1 * canvas.height;
                if (sx < 0) sx *= -1; if (sy < 0) sy *= -1;
                ctx.fillStyle = i % 2 === 0 ? '#6688aa' : '#ffffff';
                ctx.fillRect(sx, sy, 2, 2);
            }
    }

    ctx.strokeStyle = currentLevel.grid;
    ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=GRID_W; i++) { ctx.moveTo(i*TILE_SIZE, 0); ctx.lineTo(i*TILE_SIZE, canvas.height); }
    for(let i=0; i<=GRID_H; i++) { ctx.moveTo(0, i*TILE_SIZE); ctx.lineTo(canvas.width, i*TILE_SIZE); }
    ctx.stroke();

    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const px = x * TILE_SIZE; const py = y * TILE_SIZE;
            const item = items[y][x];
            if (item !== ITEMS.NONE && grid[y][x] !== TYPES.WALL_SOFT) drawItem(ctx, item, px, py);
            const tile = grid[y][x];
            
            if (tile === TYPES.WALL_HARD) {
                if (currentLevel.id === 'ice') {
                    ctx.fillStyle = '#4466ff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#6688ff'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = '#2244aa'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                    ctx.fillStyle = '#ccffff'; ctx.fillRect(px + 8, py + 8, 8, 8);
                } else if (currentLevel.id === 'jungle') {
                    ctx.fillStyle = '#666'; 
                    ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, TILE_SIZE/2-2, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#888'; 
                    ctx.beginPath(); ctx.arc(px+TILE_SIZE/2-5, py+TILE_SIZE/2-5, 10, 0, Math.PI*2); ctx.fill();
                } else if (currentLevel.id === 'hell') {
                    ctx.fillStyle = currentLevel.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#222'; ctx.fillRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#111';
                    ctx.fillRect(px+6, py+6, 4, 4); ctx.fillRect(px+38, py+6, 4, 4);
                    ctx.fillRect(px+6, py+38, 4, 4); ctx.fillRect(px+38, py+38, 4, 4);
                } else if (currentLevel.id === 'stone') {
                    ctx.fillStyle = currentLevel.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
                    ctx.fillStyle = '#333'; ctx.fillRect(px+10, py+10, TILE_SIZE-20, TILE_SIZE-20);
                } else {
                    ctx.fillStyle = currentLevel.wallHard; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, TILE_SIZE, 4); ctx.fillRect(px, py, 4, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE); ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
                }
            } else if (tile === TYPES.WALL_SOFT) {
                if (currentLevel.id === 'ice') {
                    ctx.fillStyle = '#88ccff'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE - 4); ctx.moveTo(px + TILE_SIZE - 4, py + 4); ctx.lineTo(px + 4, py + TILE_SIZE - 4); ctx.stroke();
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(px + TILE_SIZE/2 - 2, py + TILE_SIZE/2 - 2, 4, 4); 
                } else if (currentLevel.id === 'jungle') {
                    ctx.fillStyle = '#116611'; 
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    let seed = x * 12.9898 + y * 78.233;
                    const pseudoRandom = () => { seed += 1; const t = Math.sin(seed) * 10000; return t - Math.floor(t); };
                    ctx.fillStyle = '#228822'; for(let i=0; i<5; i++) { ctx.beginPath(); ctx.arc(px + pseudoRandom()*40, py + pseudoRandom()*40, 10, 0, Math.PI*2); ctx.fill(); }
                    ctx.fillStyle = '#44aa44'; for(let i=0; i<3; i++) { ctx.beginPath(); ctx.arc(px + pseudoRandom()*40, py + pseudoRandom()*40, 6, 0, Math.PI*2); ctx.fill(); }
                } else if (currentLevel.id === 'hell') {
                    ctx.fillStyle = '#880000'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = '#aa0000'; 
                    ctx.fillRect(px, py, 22, 10); ctx.fillRect(px+26, py, 22, 10);
                    ctx.fillRect(px, py+12, 10, 10); ctx.fillRect(px+14, py+12, 22, 10); ctx.fillRect(px+40, py+12, 8, 10);
                    ctx.fillRect(px, py+24, 22, 10); ctx.fillRect(px+26, py+24, 22, 10);
                    ctx.fillRect(px, py+36, 10, 10); ctx.fillRect(px+14, py+36, 22, 10); ctx.fillRect(px+40, py+36, 8, 10);
                } else if (currentLevel.id === 'stone') {
                    ctx.fillStyle = '#666'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px+10, py+10); ctx.lineTo(px+20, py+20); ctx.lineTo(px+30, py+10);
                    ctx.moveTo(px+15, py+30); ctx.lineTo(px+25, py+40);
                    ctx.stroke();
                    ctx.fillStyle = '#555'; ctx.fillRect(px+5, py+35, 10, 5); ctx.fillRect(px+30, py+20, 8, 8);
                } else {
                    ctx.fillStyle = currentLevel.wallSoft; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = currentLevel.wallSoftLight;
                    ctx.fillRect(px+2, py+2, 20, 10); ctx.fillRect(px+26, py+2, 20, 10);
                    ctx.fillRect(px+2, py+14, 10, 10); ctx.fillRect(px+14, py+14, 20, 10); ctx.fillRect(px+36, py+14, 10, 10);
                    ctx.fillRect(px+2, py+26, 20, 10); ctx.fillRect(px+26, py+26, 20, 10);
                }
            } else if (tile === TYPES.WATER) {
                ctx.fillStyle = '#3366ff'; 
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#6699ff';
                ctx.lineWidth = 2;
                const offset = Math.sin(x) * 4; 
                ctx.beginPath();
                ctx.moveTo(px + 4, py + 16 + offset);
                ctx.bezierCurveTo(px+16, py+8+offset, px+32, py+24+offset, px+44, py+16+offset);
                ctx.stroke();
            } else if (tile === TYPES.BRIDGE) {
                ctx.fillStyle = '#4a3b2a'; 
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#8b5a2b';
                ctx.fillRect(px+2, py, 44, TILE_SIZE);
                ctx.strokeStyle = '#5c3c1e';
                ctx.lineWidth = 2;
                for(let i=0; i<TILE_SIZE; i+=8) {
                    ctx.beginPath(); ctx.moveTo(px+2, py+i); ctx.lineTo(px+46, py+i); ctx.stroke();
                }
            }
        }
    }

    bombs.forEach(b => {
        const px = b.px; const py = b.py;
        const scale = 1 + Math.sin(Date.now() / 100) * 0.1;
        
        let baseColor = '#444444';
        if (currentLevel.id === 'jungle') {
            baseColor = '#000000';
        }

        ctx.fillStyle = b.napalm ? '#dd0000' : baseColor;
        if (b.isBlue) ctx.fillStyle = '#6666ff';
        
        ctx.beginPath(); ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 16 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE/2 + 8, py + TILE_SIZE/2 - 8); ctx.lineTo(px + TILE_SIZE/2 + 12, py + TILE_SIZE/2 - 14); ctx.stroke();
        ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(px + TILE_SIZE/2 + 12, py + TILE_SIZE/2 - 14, 3, 0, Math.PI*2); ctx.fill();
    });

    particles.forEach(p => {
        const px = p.gx * TILE_SIZE; const py = p.gy * TILE_SIZE;

        if (p.isFire) {
            const showExplosion = !p.isNapalm || (p.isNapalm && p.life > 570);

            if (!showExplosion) {
                if (p.isNapalm) {
                    ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.moveTo(px + 10, py + 40); ctx.lineTo(px + 38, py + 40); ctx.lineTo(px + 24, py + 10); ctx.fill();
                    ctx.fillStyle = '#ff6600'; ctx.beginPath(); ctx.moveTo(px + 14, py + 40); ctx.lineTo(px + 34, py + 40); ctx.lineTo(px + 24, py + 18); ctx.fill();
                    ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.moveTo(px + 18, py + 40); ctx.lineTo(px + 30, py + 40); ctx.lineTo(px + 24, py + 26); ctx.fill();
                    if (Math.random() < 0.2) { ctx.fillStyle = '#ffffaa'; ctx.fillRect(px + 20, py + 30, 8, 4); }
                }
            } else {
                ctx.fillStyle = '#ffaa00'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#ffff00'; ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 10, py + 10, TILE_SIZE - 20, TILE_SIZE - 20);
            }
        } else if (p.text) {
            ctx.fillStyle = p.color; ctx.font = '10px "Press Start 2P"'; ctx.fillText(p.text, p.x, p.y);
        } else {
            ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size || 4, p.size || 4);
        }
    });

    players.slice().sort((a,b) => a.y - b.y).forEach(p => p.draw());
}

function drawItem(ctx, type, x, y) {
    const pad = 2; 
    const size = TILE_SIZE - pad*2;
    
    ctx.fillStyle = '#442222'; 
    ctx.fillRect(x+pad, y+pad, size, size);
    
    ctx.strokeStyle = '#ff8888'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(x+pad, y+pad, size, size);

    const cx = x + TILE_SIZE/2; 
    const cy = y + TILE_SIZE/2;
    
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle'; 
    ctx.font = '32px sans-serif';

    switch(type) {
        case ITEMS.BOMB_UP: ctx.fillStyle = '#0088ff'; ctx.fillText('💣', cx, cy); break;
        case ITEMS.RANGE_UP: ctx.fillStyle = '#ffaa00'; ctx.fillText('🔥', cx, cy); break;
        case ITEMS.SPEED_UP: ctx.fillStyle = '#ffff00'; ctx.fillText('👟', cx, cy); break;
        case ITEMS.NAPALM: ctx.fillStyle = '#ff0000'; ctx.fillText('☢️', cx, cy); break;
        case ITEMS.ROLLING: ctx.fillStyle = '#ffffff'; ctx.fillText('🎳', cx, cy); break;
        case ITEMS.SKULL: ctx.fillStyle = '#cccccc'; ctx.fillText('💀', cx, cy); break;
    }
}

function gameLoop() {
    if (!document.getElementById('main-menu').classList.contains('hidden')) {
        // Do not update game logic in menu
    } else if (!isPaused) {
        update();
        draw();
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

init();
