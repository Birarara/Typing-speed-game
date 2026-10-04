/**
 * Name gate: the player has to give a name before the typing test opens up.
 *
 * Plain global class, no modules — same style as script.js.
 * Construct with a callback that receives the accepted name:
 *   const gate = new NameGate((name) => console.log(name));
 *   gate.open();
 */
class NameGate {
    static STORAGE_KEY = 'typingGame.playerName';
    static MAX_LENGTH = 32;
    /** Everything inside the gate that Tab can reach. */
    static FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

    constructor(onSubmit) {
        this.onSubmit = typeof onSubmit === 'function' ? onSubmit : () => {};
        this.overlay = document.querySelector('#nameGate');
        this.form = document.querySelector('#nameForm');
        this.input = document.querySelector('#playerName');
        this.error = document.querySelector('#nameError');
        // Marked inert while the gate is open so the aria-modal="true" claim is
        // true for the keyboard too: the game's hidden #btn and #modeToggle are
        // opacity-0 but still tabbable without this.
        this.background = document.querySelector('.main-body');
        this.name = '';

        this.form.addEventListener('submit', (event) => this.handleSubmit(event));
        this.input.addEventListener('input', () => this.hideError());
        // The game listens for Enter on window and preventDefaults it, so keep
        // the gate's own keystrokes to itself.
        this.overlay.addEventListener('keydown', (event) => {
            event.stopPropagation();
            this.trapTab(event);
        });
    }

    /**
     * Wrap Tab/Shift+Tab around the gate's own controls. `inert` alone would stop
     * focus reaching the page behind the scrim, but Tab off the last control
     * would still leave the document for the browser's own UI.
     */
    trapTab(event) {
        if (event.key !== 'Tab' || !this.isOpen) return;

        const focusable = Array.from(this.overlay.querySelectorAll(NameGate.FOCUSABLE))
            .filter((element) => !element.disabled && element.offsetParent !== null);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && (active === first || !this.overlay.contains(active))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !this.overlay.contains(active))) {
            event.preventDefault();
            first.focus();
        }
    }

    get isOpen() {
        return !this.overlay.hasAttribute('hidden');
    }

    getName() {
        return this.name;
    }

    open() {
        this.hideError();
        this.input.value = this.name || this.readStoredName();
        if (this.background) this.background.setAttribute('inert', '');
        this.overlay.removeAttribute('hidden');
        this.input.focus();
        this.input.select();
    }

    close() {
        this.overlay.setAttribute('hidden', '');
        // Lift inert before anything in the game view is focused or announced:
        // an inert subtree takes neither focus nor live-region updates.
        if (this.background) this.background.removeAttribute('inert');
    }

    handleSubmit(event) {
        event.preventDefault();

        const candidate = NameGate.cleanName(this.input.value);

        if (candidate === '') {
            this.showError('Please enter a name before you start.');
            return;
        }
        if (candidate.length > NameGate.MAX_LENGTH) {
            this.showError(`Keep it to ${NameGate.MAX_LENGTH} characters or fewer.`);
            return;
        }

        this.name = candidate;
        this.input.value = candidate;
        this.storeName(candidate);
        this.hideError();
        this.close();
        this.onSubmit(candidate);
    }

    showError(message) {
        this.error.textContent = message;
        this.error.removeAttribute('hidden');
        this.input.setAttribute('aria-invalid', 'true');
        this.input.focus();
    }

    hideError() {
        this.error.textContent = '';
        this.error.setAttribute('hidden', '');
        this.input.removeAttribute('aria-invalid');
    }

    readStoredName() {
        try {
            return localStorage.getItem(NameGate.STORAGE_KEY) || '';
        } catch (error) {
            // Private mode / storage disabled — prefilling is a nicety, not a feature.
            return '';
        }
    }

    storeName(name) {
        try {
            localStorage.setItem(NameGate.STORAGE_KEY, name);
        } catch (error) {
            /* ignore: the session still works without a remembered name */
        }
    }

    /** Trim and drop control characters, matching what the server accepts. */
    static cleanName(value) {
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .trim();
    }
}
