import { keyBindings } from './constants.js';

export class InputHandler {
    constructor() {
        this.keys = {}; // Speichert den Status aller Aktionen (UP, DOWN, BOMB, etc.)
        this.touchActive = false; // Merkt sich, ob Touch genutzt wird
        
        // Initialisierung
        this.initKeyboardListeners();
        this.initTouchListeners();
    }

    // Prüft, ob eine Aktion aktiv ist (z.B. 'UP', 'BOMB')
    isDown(action) {
        return !!this.keys[action];
    }

    // Setzt Inputs zurück (z.B. bei Menü-Wechsel)
    reset() {
        Object.keys(this.keys).forEach(k => this.keys[k] = false);
        this.updateVisuals();
    }

    // --- KEYBOARD ---
    initKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            // Mapping: KeyCode -> Action Name (z.B. 'ArrowUp' -> 'UP')
            const action = this.getActionFromCode(e.code);
            if (action) {
                e.preventDefault();
                this.keys[action] = true;
                this.touchActive = false; // Tastatur benutzt -> Touch-UI ggf. ausblenden (optional)
            }
        });

        window.addEventListener('keyup', (e) => {
            const action = this.getActionFromCode(e.code);
            if (action) {
                this.keys[action] = false;
            }
        });
    }

    getActionFromCode(code) {
        // Sucht in constants.js keyBindings nach dem Code
        for (const [action, key] of Object.entries(keyBindings)) {
            if (key === code) return action;
        }
        return null;
    }

    // --- TOUCH (GAME BOY D-PAD) ---
    initTouchListeners() {
        // Wir warten kurz, bis das DOM geladen ist, falls das Skript im Head liegt
        setTimeout(() => {
            const dpadArea = document.getElementById('dpad-area');
            const btnBomb = document.getElementById('btn-bomb');
            const btnChange = document.getElementById('btn-change');

            if (dpadArea) this.bindDPad(dpadArea);
            if (btnBomb) this.bindButton(btnBomb, 'BOMB');
            if (btnChange) this.bindButton(btnChange, 'CHANGE');
        }, 100);
    }

    bindButton(element, action) {
        const press = (e) => {
            if(e.cancelable) e.preventDefault();
            this.keys[action] = true;
            element.style.transform = "scale(0.9)"; // Visuelles Feedback
            this.touchActive = true;
        };
        const release = (e) => {
            if(e.cancelable) e.preventDefault();
            this.keys[action] = false;
            element.style.transform = "scale(1)";
        };

        element.addEventListener('touchstart', press, {passive: false});
        element.addEventListener('touchend', release, {passive: false});
        // Mouse Events für Hybrid/Testing
        element.addEventListener('mousedown', press);
        element.addEventListener('mouseup', release);
        element.addEventListener('mouseleave', release);
    }

    bindDPad(area) {
        // UI Elemente für Feedback
        const arms = {
            UP: document.querySelector('.dpad-up'),
            DOWN: document.querySelector('.dpad-down'),
            LEFT: document.querySelector('.dpad-left'),
            RIGHT: document.querySelector('.dpad-right')
        };

        const handleMove = (e) => {
            e.preventDefault();
            const touch = e.touches[0] || e; // Support für Mouse Event (e)
            if (!touch) return;
            
            // ClientX/Y bei Mouse Events direkt, bei Touch im Array
            const cx = touch.clientX;
            const cy = touch.clientY;

            const rect = area.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = cx - centerX;
            const dy = cy - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            // Reset interne States für D-Pad
            this.keys['UP'] = false; this.keys['DOWN'] = false;
            this.keys['LEFT'] = false; this.keys['RIGHT'] = false;
            
            // Visuelles Reset
            Object.values(arms).forEach(el => el && el.classList.remove('active'));

            if (dist < 10) return; // Deadzone

            // Berechnung der Richtung (45° gedreht für Sektoren)
            let activeAction = null;
            if (angle > -135 && angle < -45) activeAction = 'UP';
            else if (angle >= -45 && angle <= 45) activeAction = 'RIGHT';
            else if (angle > 45 && angle < 135) activeAction = 'DOWN';
            else activeAction = 'LEFT';

            if (activeAction) {
                this.keys[activeAction] = true;
                if(arms[activeAction]) arms[activeAction].classList.add('active');
                this.touchActive = true;
            }
        };

        const endMove = (e) => {
            e.preventDefault();
            ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(k => this.keys[k] = false);
            Object.values(arms).forEach(el => el && el.classList.remove('active'));
        };

        area.addEventListener('touchstart', handleMove, {passive: false});
        area.addEventListener('touchmove', handleMove, {passive: false});
        area.addEventListener('touchend', endMove);
        area.addEventListener('touchcancel', endMove);
        
        // Mouse Support für Tests am Desktop
        let isMouseDown = false;
        area.addEventListener('mousedown', (e) => { isMouseDown = true; handleMove(e); });
        area.addEventListener('mousemove', (e) => { if(isMouseDown) handleMove(e); });
        area.addEventListener('mouseup', (e) => { isMouseDown = false; endMove(e); });
        area.addEventListener('mouseleave', (e) => { isMouseDown = false; endMove(e); });
    }
    
    // Für UI Updates (z.B. Button Press Styles im UI Loop)
    updateVisuals() {
        // Hier könnte man später zentrale Visuals steuern
    }
}