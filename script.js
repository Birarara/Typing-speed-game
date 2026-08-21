const fallbackQuotes = [
    { quote: "The quick brown fox jumps over the lazy dog.", author: "Traditional" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { quote: "Code is like humor. When you have to explain it, it’s bad.", author: "Cory House" }
];

class TypingSpeedGame {
    constructor() {
        this.typingGround = document.querySelector('#textarea');
        this.showSentence = document.querySelector('#showSentence');
        this.modeToggle = document.querySelector('#modeToggle');
        this.isGameRunning = false;
        this.includePunctuation = this.modeToggle.checked;
        this.author = '';
        this.startTime = 0;

        this.bindEvents();
        this.showSentence.innerHTML = "Press [ Enter ] to start typing";
    }

    bindEvents() {
        this.typingGround.addEventListener('input', () => this.updateCharacterStates());
        this.modeToggle.addEventListener('change', () => {
            this.includePunctuation = this.modeToggle.checked;
        });
        window.addEventListener('keydown', (event) => this.handleKeydown(event));
        window.addEventListener('click', () => {
            if (this.isGameRunning) this.typingGround.focus();
        });
    }

    handleKeydown(event) {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        if (this.isGameRunning) {
            this.endTypingTest();
        } else {
            this.startTyping();
        }
    }

    renderSentence(text) {
        this.showSentence.innerHTML = '';
        const sentence = this.includePunctuation
            ? text
            : text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

        sentence.split('').forEach((character) => {
            const characterSpan = document.createElement('span');
            characterSpan.innerText = character;
            this.showSentence.appendChild(characterSpan);
        });
    }

    updateCharacterStates() {
        const characterSpans = this.showSentence.querySelectorAll('span');
        const typedCharacters = this.typingGround.value.replace(/\n/g, '').split('');

        characterSpans.forEach((characterSpan, index) => {
            const typedCharacter = typedCharacters[index];
            characterSpan.classList.remove('correct-char', 'incorrect-char');

            if (typedCharacter == null) return;
            characterSpan.classList.add(
                typedCharacter === characterSpan.innerText ? 'correct-char' : 'incorrect-char'
            );
        });
    }

    calculateTypingSpeed(timeTaken) {
        const typedText = this.typingGround.value.trim();
        const wordCount = typedText === '' ? 0 : typedText.split(/\s+/).length;
        const typingSpeed = wordCount === 0 ? 0 : Math.round((wordCount / timeTaken) * 60);

        if (wordCount === 0) {
            this.showSentence.innerHTML = `Speed: 0 WPM | Time: ${Math.round(timeTaken)}s [Press Enter to restart]`;
            return;
        }

        this.showSentence.innerHTML = `Speed: ${typingSpeed} WPM <br> Time: ${Math.round(timeTaken)}s <br> Written by ${this.author} <br> [Press Enter to restart]`;
    }

    endTypingTest() {
        this.isGameRunning = false;
        const timeTaken = (Date.now() - this.startTime) / 1000;
        this.calculateTypingSpeed(timeTaken);
        this.typingGround.value = '';
        this.typingGround.setAttribute('disabled', 'true');
    }

    async startTyping() {
        this.isGameRunning = true;
        this.showSentence.innerHTML = 'Fetching...';
        this.typingGround.value = '';

        try {
            const response = await fetch('https://dummyjson.com/quotes/random');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            this.author = data.author;
            this.renderSentence(data.quote);
        } catch (error) {
            console.warn('Network offline, loading local fallback...');
            const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
            const selectedFallback = fallbackQuotes[randomIndex];
            this.author = selectedFallback.author;
            this.renderSentence(selectedFallback.quote);
        } finally {
            this.typingGround.removeAttribute('disabled');
            this.typingGround.focus();
            this.startTime = Date.now();
        }
    }
}

new TypingSpeedGame();