/**
 * Leaderboard panel: saves a finished run, then shows the top scores.
 *
 * Plain global class, no modules — same style as script.js.
 *   const board = new Leaderboard({ onPlayAgain() {}, onChangeName() {} });
 *   board.submitAndShow(runPayload);
 *
 * Every value that comes back from the database is written with textContent.
 * Player names are user input, so this is the XSS boundary — no innerHTML here.
 */
class Leaderboard {
    static SAVE_URL = 'api/save_score.php';
    static LIST_URL = 'api/leaderboard.php';
    static TOP_LIMIT = 10;
    static MIN_SECONDS = 2;
    /** Form controls whose own keystrokes must not reach the game. */
    static CONTROLS = 'button, input, select, textarea, a[href]';

    constructor({ onPlayAgain, onChangeName } = {}) {
        this.onPlayAgain = typeof onPlayAgain === 'function' ? onPlayAgain : () => {};
        this.onChangeName = typeof onChangeName === 'function' ? onChangeName : () => {};

        this.panel = document.querySelector('#leaderboardPanel');
        this.heading = document.querySelector('#leaderboardHeading');
        this.summary = document.querySelector('#runSummary');
        this.status = document.querySelector('#leaderboardStatus');
        this.body = document.querySelector('#leaderboardBody');
        this.ownRow = document.querySelector('#leaderboardOwnRow');
        this.playAgainBtn = document.querySelector('#playAgainBtn');
        this.changeNameBtn = document.querySelector('#changeNameBtn');
        this.retryBtn = document.querySelector('#retryLeaderboardBtn');

        this.lastSavedId = null;

        this.playAgainBtn.addEventListener('click', () => this.onPlayAgain());
        this.changeNameBtn.addEventListener('click', () => this.onChangeName());
        this.retryBtn.addEventListener('click', () => this.reloadList());
        // Keep the panel's own controls from reaching the game's window listener,
        // which preventDefaults every Enter and would eat button activations.
        // Scoped to the controls, not the whole panel: focus lands on
        // #leaderboardHeading after a run, and Enter there has to reach the game
        // so that "[Press Enter to restart]" is true.
        this.panel.addEventListener('keydown', (event) => {
            const target = event.target;
            if (target.closest && target.closest(Leaderboard.CONTROLS)) {
                event.stopPropagation();
            }
        });
    }

    get isOpen() {
        return !this.panel.hasAttribute('hidden');
    }

    show() {
        this.panel.removeAttribute('hidden');
    }

    hide() {
        this.panel.setAttribute('hidden', '');
    }

    /**
     * Save the run (unless it is too short to be meaningful), then render the
     * top scores with the just-finished row highlighted.
     */
    async submitAndShow(run) {
        this.show();
        this.renderSummary(run);
        this.body.textContent = '';
        this.ownRow.textContent = '';
        this.retryBtn.setAttribute('hidden', '');
        this.lastSavedId = null;
        this.setStatus('Saving your score\u2026');

        // Only a finished quote earns a place: Enter ends a run at any point, and
        // accuracy only counts characters the player reached, so an early stop
        // would otherwise post a perfect score on a few keystrokes.
        if (run.completed !== true) {
            this.setStatus(
                "Not recorded \u2014 you stopped before the end of the quote. "
                + 'Type it all the way through to get on the leaderboard.'
            );
            await this.reloadList();
            return;
        }

        const tooShort = Number(run.chars_typed) === 0
            || Number(run.time_taken_seconds) < Leaderboard.MIN_SECONDS;

        if (tooShort) {
            this.setStatus('Run not saved \u2014 too short to count.');
            await this.reloadList();
            return;
        }

        try {
            const saved = await this.saveRun(run);
            this.lastSavedId = saved.id;
            this.setStatus(`Saved. You placed #${saved.rank} of ${saved.total_scores}.`);
        } catch (error) {
            console.warn('Could not save score:', error);
            if (error && error.rejected) {
                // The server answered, it just refused the run (bad or absurd values).
                this.setStatus(`Score wasn't saved: ${error.message}`, true);
            } else {
                this.setStatus("Could not reach the score server \u2014 your run wasn't saved.", true);
            }
        }

        await this.reloadList();
    }

    async saveRun(run) {
        const response = await fetch(Leaderboard.SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(run)
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok !== true) {
            const reason = data && data.error ? data.error : `HTTP ${response.status}`;
            const failure = new Error(reason);
            // A 4xx with a JSON error body means the server read the run and said
            // no, which is worth reporting differently from "never got an answer".
            failure.rejected = response.status >= 400 && response.status < 500
                && Boolean(data && data.error);
            throw failure;
        }

        return data;
    }

    /** Fetch and render the list. Used on first show and by the Retry button. */
    async reloadList() {
        let url = `${Leaderboard.LIST_URL}?limit=${Leaderboard.TOP_LIMIT}`;
        if (this.lastSavedId != null) {
            url += `&highlight_id=${encodeURIComponent(this.lastSavedId)}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || data.ok !== true) {
                const reason = data && data.error ? data.error : `HTTP ${response.status}`;
                throw new Error(reason);
            }

            this.renderRows(data.top || [], data.highlight || null);
            this.retryBtn.setAttribute('hidden', '');
        } catch (error) {
            console.warn('Could not load leaderboard:', error);
            this.body.textContent = '';
            this.ownRow.textContent = '';
            this.setStatus('Could not load the leaderboard.', true);
            this.retryBtn.removeAttribute('hidden');
        } finally {
            // Play again stays reachable no matter what the server did.
            this.heading.focus();
        }
    }

    renderSummary(run) {
        const accuracy = Number(run.accuracy).toFixed(2);
        const seconds = Number(run.time_taken_seconds).toFixed(1);
        this.summary.textContent =
            `${run.player_name} \u2014 ${run.wpm} WPM, ${accuracy}% accuracy, ${seconds}s, ${run.error_count} mistakes.`;
    }

    setStatus(message, isError = false) {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', Boolean(isError));
    }

    renderRows(top, highlight) {
        this.body.textContent = '';
        this.ownRow.textContent = '';

        if (top.length === 0) {
            const row = document.createElement('tr');
            row.className = 'empty-row';
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.textContent = 'No scores yet.';
            row.appendChild(cell);
            this.body.appendChild(row);
            return;
        }

        const highlightId = this.lastSavedId;
        let highlightShown = false;

        top.forEach((score) => {
            const isMine = highlightId != null && score.id === highlightId;
            if (isMine) highlightShown = true;
            this.body.appendChild(this.buildRow(score, isMine));
        });

        // Outside the top 10: show the player their own standing anyway.
        if (highlight && highlightId != null && highlight.id === highlightId && !highlightShown) {
            const label = document.createElement('tr');
            label.className = 'own-row-label';
            const labelCell = document.createElement('td');
            labelCell.colSpan = 5;
            labelCell.textContent = 'your rank';
            label.appendChild(labelCell);
            this.ownRow.appendChild(label);
            this.ownRow.appendChild(this.buildRow(highlight, true));
        }
    }

    buildRow(score, isMine) {
        const row = document.createElement('tr');
        if (isMine) {
            row.classList.add('highlight-row');
            row.setAttribute('aria-current', 'true');
        }

        row.appendChild(this.buildCell(`#${score.rank}`));
        row.appendChild(this.buildCell(score.player_name));
        row.appendChild(this.buildCell(String(score.wpm), true));
        row.appendChild(this.buildCell(`${Number(score.accuracy).toFixed(2)}%`, true));
        row.appendChild(this.buildCell(Leaderboard.formatDate(score.created_at)));

        return row;
    }

    buildCell(text, numeric = false) {
        const cell = document.createElement('td');
        if (numeric) cell.className = 'numeric';
        // textContent, never innerHTML: names come straight from the database.
        cell.textContent = text;
        return cell;
    }

    static formatDate(value) {
        if (!value) return '';
        // MySQL hands back "YYYY-MM-DD HH:MM:SS"; Safari needs the T separator.
        const parsed = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(parsed.getTime())) return String(value);

        return parsed.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}
