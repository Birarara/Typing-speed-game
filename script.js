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
        this.gameStatus = document.querySelector('#gameStatus');
        this.modeToggle = document.querySelector('#modeToggle');
        this.isGameRunning = false;
        this.includePunctuation = this.modeToggle.checked;
        this.author = '';
        this.startTime = 0;
        this.playerName = '';
        this.bindEvents();
        this.showSentence.innerHTML = "Press [ Enter ] to start typing";

        this.nameGate = new NameGate((name) => {
            this.playerName = name;
            this.typingGround.blur();
            // The gate hides itself while focus is inside it, so without this an
            // assistive-tech user gets no cue that it closed or what to do next.
            this.announce(`Name saved as ${name}. Press Enter to start typing.`);
        });
        this.leaderboard = new Leaderboard({
            onPlayAgain: () => {
                this.leaderboard.hide();
                this.startTyping();
            },
            onChangeName: () => {
                this.leaderboard.hide();
                this.nameGate.open();
            }
        });
        this.nameGate.open();
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

    /** Say something once in the polite live region. */
    announce(message) {
        if (!this.gameStatus) return;
        this.gameStatus.textContent = message;
    }

    handleKeydown(event) {
        if (event.key !== 'Enter') return;
        // Let the name gate handle its own Enter presses: this listener
        // preventDefaults every Enter, which would eat the form submit.
        if (this.nameGate.isOpen) return;
        if (!this.playerName) return;
        if (event.target.closest && event.target.closest('#nameGate')) return;
        // The leaderboard panel stops Enter from its own buttons and inputs
        // before it reaches here, so anything that gets through (the focused
        // #leaderboardHeading) is the advertised "press Enter to restart".

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
            return 0;
        }

        this.showSentence.innerHTML = `Speed: ${typingSpeed} WPM <br> Time: ${Math.round(timeTaken)}s <br> Written by ${this.author} <br> [Press Enter to restart]`;
        return typingSpeed;
    }

    /**
     * Read the per-character spans the typing test already paints and turn them
     * into the run's accuracy. Must run before calculateTypingSpeed, which
     * replaces #showSentence and destroys the spans.
     *
     * Characters typed past the end of the quote get no span at all, so they are
     * counted separately as overflow errors.
     *
     * `completed` means the player reached the final character of the quote.
     * Enter ends a run at any point, so without this an early stop would post a
     * perfect accuracy on a handful of keystrokes.
     */
    collectRunStats() {
        const characterSpans = this.showSentence.querySelectorAll('span');
        const typedLength = this.typingGround.value.replace(/\n/g, '').length;
        const quoteLength = characterSpans.length;

        let correct = 0;
        let incorrect = 0;
        characterSpans.forEach((characterSpan) => {
            if (characterSpan.classList.contains('correct-char')) correct++;
            else if (characterSpan.classList.contains('incorrect-char')) incorrect++;
        });

        const overflow = Math.max(0, typedLength - quoteLength);
        const errors = incorrect + overflow;
        const total = correct + errors;
        const accuracy = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;

        return {
            correct,
            errors,
            charsTyped: typedLength,
            accuracy,
            quoteLength,
            completed: quoteLength > 0 && typedLength >= quoteLength
        };
    }

    endTypingTest() {
        this.isGameRunning = false;
        const timeTaken = (Date.now() - this.startTime) / 1000;
        const stats = this.collectRunStats();
        const typingSpeed = this.calculateTypingSpeed(timeTaken);
        this.typingGround.value = '';
        this.typingGround.setAttribute('disabled', 'true');

        this.leaderboard.submitAndShow({
            player_name: this.playerName,
            wpm: typingSpeed,
            accuracy: stats.accuracy,
            time_taken_seconds: Math.round(timeTaken * 100) / 100,
            chars_typed: stats.charsTyped,
            error_count: stats.errors,
            punctuation_mode: this.includePunctuation,
            quote_length: stats.quoteLength,
            completed: stats.completed
        });
    }

    async startTyping() {
        this.leaderboard.hide();
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