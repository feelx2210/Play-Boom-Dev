import { keyBindings } from './constants.js';

export class InputHandler {
    constructor() {
        this.keys = {}; 
        this.touchActive = false;
        this.lastTouchTime = 0; // NEU: Zeitstempel für Entprellung
        
        this.initKeyboardListeners();
        this.initTouchListeners();
    }

    isDown(action) {
        return !!this.keys[action];
    }

    reset() {
        Object.keys(this.keys).forEach(k => this.keys[k] = false);
    }

    initKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            const action = this.getActionFromCode(e.code);
            if (action) {
                // Keine preventDefault hier, sonst gehen F5/DevTools nicht
                this.keys[action] = true;
                this.touchActive = false; 
            }
        });

        window.addEventListener('keyup', (e) => {
            const action = this.getActionFromCode(e.code);
            if (action) this.keys[action] = false;
        });
    }

    getActionFromCode(code) {
        for (const [action, key] of Object.entries(keyBindings)) {
            if (key === code) return action;
        }
        return null;
    }

    initTouchListeners() {
        setTimeout(() => {
            const dpadArea = document.getElementById('dpad-area');
            const btnBomb = document.getElementById('btn-bomb');
            const btnChange = document.getElementById('btn-change');

            if (dpadArea) this.bindDPad(dpadArea);
            if (btnBomb) this.bindButton(btnBomb, 'BOMB');
            if (btnChange) this.bindButton(btnChange, 'CHANGE');
        }, 100);
    }

    // Hilfsfunktion: Soll dieses Event ignoriert werden?
    shouldIgnore(e) {
        // Wenn es ein Touch-Event ist: Zeit merken & akzeptieren
        if (e.type.startsWith('touch')) {
            this.lastTouchTime = Date.now();
            this.touchActive = true;
            return false;
        }
        // Wenn es ein Maus-Event ist: Prüfen, ob vor kurzem getoucht wurde
        if (e.type.startsWith('mouse')) {
            if (this.touchActive && Date.now() - this.lastTouchTime < 500) {
                return true; // Ignoriere Ghost Mouse Event
            }
        }
        return false;
    }

    bindButton(element, action) {
        const press = (e) => {
            if (this.shouldIgnore(e)) return;
            if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
            
            this.keys[action] = true;
            element.style.transform = "scale(0.9)"; 
        };
        const release = (e) => {
            if (this.shouldIgnore(e)) return;
            if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
            
            this.keys[action] = false;
            element.style.transform = "scale(1)";
        };

        element.addEventListener('touchstart', press, {passive: false});
        element.addEventListener('touchend', release, {passive: false});
        element.addEventListener('touchcancel', release, {passive: false}); // Safety

        element.addEventListener('mousedown', press);
        element.addEventListener('mouseup', release);
        element.addEventListener('mouseleave', release);
    }

    bindDPad(area) {
        const arms = {
            UP: document.querySelector('.dpad-up'),
            DOWN: document.querySelector('.dpad-down'),
            LEFT: document.querySelector('.dpad-left'),
            RIGHT: document.querySelector('.dpad-right')
        };

        const handleMove = (e) => {
            if (this.shouldIgnore(e)) return;
            if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();

            const touch = e.touches ? e.touches[0] : e;
            if (!touch) return;
            
            const rect = area.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            // Reset
            this.keys['UP'] = false; this.keys['DOWN'] = false;
            this.keys['LEFT'] = false; this.keys['RIGHT'] = false;
            Object.values(arms).forEach(el => el && el.classList.remove('active'));

            if (dist < 10) return; // Deadzone

            let activeAction = null;
            if (angle > -135 && angle < -45) activeAction = 'UP';
            else if (angle >= -45 && angle <= 45) activeAction = 'RIGHT';
            else if (angle > 45 && angle < 135) activeAction = 'DOWN';
            else activeAction = 'LEFT';

            if (activeAction) {
                this.keys[activeAction] = true;
                if(arms[activeAction]) arms[activeAction].classList.add('active');
            }
        };

        const endMove = (e) => {
            if (this.shouldIgnore(e)) return;
            if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();

            ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(k => this.keys[k] = false);
            Object.values(arms).forEach(el => el && el.classList.remove('active'));
        };

        area.addEventListener('touchstart', handleMove, {passive: false});
        area.addEventListener('touchmove', handleMove, {passive: false});
        area.addEventListener('touchend', endMove);
        area.addEventListener('touchcancel', endMove);
        
        // Mouse Support (mit Ghost-Schutz)
        let isMouseDown = false;
        area.addEventListener('mousedown', (e) => { 
            if (this.shouldIgnore(e)) return;
            isMouseDown = true; handleMove(e); 
        });
        area.addEventListener('mousemove', (e) => { 
            if (isMouseDown && !this.shouldIgnore(e)) handleMove(e); 
        });
        area.addEventListener('mouseup', (e) => { isMouseDown = false; endMove(e); });
        area.addEventListener('mouseleave', (e) => { isMouseDown = false; endMove(e); });
    }
}