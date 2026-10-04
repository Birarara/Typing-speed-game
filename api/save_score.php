<?php
/**
 * POST api/save_score.php
 *
 * Body (application/json):
 *   { "player_name": "Biraj", "wpm": 62, "accuracy": 97.52, "time_taken_seconds": 23.41,
 *     "chars_typed": 121, "error_count": 3, "punctuation_mode": true,
 *     "quote_length": 118, "completed": true }
 *
 * Only a completed run can be saved. The client decides completion, so the
 * numbers it reports are also cross-checked against each other here — see the
 * plausibility block below.
 *
 * 200 -> { "ok": true, "id": 7, "rank": 3, "total_scores": 12 }
 * 400 -> { "ok": false, "error": "<which field was bad>" }   nothing is inserted
 * 405 -> { "ok": false, "error": "Method not allowed" }
 * 500 -> { "ok": false, "error": "Could not save score" }
 */

require_once __DIR__ . '/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail('Method not allowed', 405);
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    fail('Request body is empty', 400);
}

$payload = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
    fail('Request body is not valid JSON', 400);
}

/**
 * Clean a submitted name: strip control characters, collapse nothing else, trim.
 */
function clean_name($value): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $stripped = preg_replace('/[\p{C}]+/u', '', $value);
    if ($stripped === null) {
        return null;
    }

    return trim($stripped);
}

/**
 * Whole numbers only, within range. Rejects "12abc", 1.5, true, arrays.
 */
function valid_int($value, int $min, int $max): bool
{
    if (is_bool($value) || !is_numeric($value)) {
        return false;
    }
    if (is_string($value) && !preg_match('/^-?\d+$/', trim($value))) {
        return false;
    }
    if (is_float($value) && floor($value) !== $value) {
        return false;
    }

    $number = (int) $value;

    return $number >= $min && $number <= $max;
}

function valid_number($value, float $min, float $max): bool
{
    if (is_bool($value) || !is_numeric($value)) {
        return false;
    }

    $number = (float) $value;

    return $number >= $min && $number <= $max;
}

$name = clean_name($payload['player_name'] ?? null);
if ($name === null || $name === '') {
    fail('player_name is required', 400);
}
if (mb_strlen($name) > 32) {
    fail('player_name must be 32 characters or fewer', 400);
}

if (!valid_int($payload['wpm'] ?? null, 0, 500)) {
    fail('wpm must be a whole number between 0 and 500', 400);
}
if (!valid_number($payload['accuracy'] ?? null, 0, 100)) {
    fail('accuracy must be a number between 0 and 100', 400);
}
if (!valid_number($payload['time_taken_seconds'] ?? null, 0, 3600)) {
    fail('time_taken_seconds must be a number between 0 and 3600', 400);
}
if (!valid_int($payload['chars_typed'] ?? null, 0, 10000)) {
    fail('chars_typed must be a whole number between 0 and 10000', 400);
}
if (!valid_int($payload['error_count'] ?? null, 0, 10000)) {
    fail('error_count must be a whole number between 0 and 10000', 400);
}

/* ------------------------------------------------------------------
   Completion and plausibility.

   Accuracy only counts characters the player actually reached, so an
   unfinished run can report 100%. A leaderboard row therefore requires a
   completed run. The completion flag comes from the client, which is not
   trustworthy, so the reported numbers are also checked against each other.

   These are loose sanity bounds, not a re-derivation of the score: they catch
   degenerate and forged submissions (a few keystrokes claiming a finished
   quote, hundreds of characters in two seconds, a WPM unrelated to the clock)
   and leave a wide margin above anything a real player can produce.
   ------------------------------------------------------------------ */

/** A completed run must have typed at least this share of the quote. */
const MIN_COMPLETION_RATIO = 0.9;
/** ~360 WPM of raw keystrokes. The standing human record is well below this. */
const MAX_CHARS_PER_SECOND = 30.0;
/** Reported WPM may exceed the characters-per-minute estimate by this much. */
const WPM_PLAUSIBILITY_FACTOR = 3.0;
const WPM_PLAUSIBILITY_SLACK  = 20.0;

$completedRaw = $payload['completed'] ?? null;
if (is_bool($completedRaw)) {
    $completed = $completedRaw;
} elseif (valid_int($completedRaw, 0, 1)) {
    $completed = ((int) $completedRaw) === 1;
} else {
    fail('completed must be true or false', 400);
}

if (!$completed) {
    fail('Only a completed run can be saved: type the whole quote', 400);
}

if (!valid_int($payload['quote_length'] ?? null, 1, 10000)) {
    fail('quote_length must be a whole number between 1 and 10000', 400);
}

$quoteLength = (int) $payload['quote_length'];
$charsTyped  = (int) $payload['chars_typed'];
$wpm         = (int) $payload['wpm'];
$timeTaken   = (float) $payload['time_taken_seconds'];

if ($charsTyped < (int) ceil($quoteLength * MIN_COMPLETION_RATIO)) {
    fail('chars_typed is too low for a completed quote of that length', 400);
}

// Guards the division below; a finished run always took some time.
if ($timeTaken <= 0) {
    fail('time_taken_seconds must be greater than 0', 400);
}

if ($charsTyped / $timeTaken > MAX_CHARS_PER_SECOND) {
    fail('that many characters in that little time is not possible', 400);
}

// Characters/5 is the conventional word, which is close enough to the game's
// whitespace word count to bound it.
$impliedWpm = ($charsTyped / 5) / ($timeTaken / 60);
if ($wpm > $impliedWpm * WPM_PLAUSIBILITY_FACTOR + WPM_PLAUSIBILITY_SLACK) {
    fail('wpm does not match the reported time and characters typed', 400);
}

$punctuationRaw = $payload['punctuation_mode'] ?? false;
if (is_bool($punctuationRaw)) {
    $punctuation = $punctuationRaw ? 1 : 0;
} elseif (valid_int($punctuationRaw, 0, 1)) {
    $punctuation = (int) $punctuationRaw;
} else {
    fail('punctuation_mode must be true, false, 0 or 1', 400);
}

try {
    $pdo = get_pdo();

    $insert = $pdo->prepare(
        'INSERT INTO scores
            (player_name, wpm, accuracy, time_taken_seconds, chars_typed, error_count, punctuation_mode)
         VALUES
            (:player_name, :wpm, :accuracy, :time_taken_seconds, :chars_typed, :error_count, :punctuation_mode)'
    );
    $insert->execute([
        ':player_name'        => $name,
        ':wpm'                => (int) $payload['wpm'],
        ':accuracy'           => round((float) $payload['accuracy'], 2),
        ':time_taken_seconds' => round((float) $payload['time_taken_seconds'], 2),
        ':chars_typed'        => (int) $payload['chars_typed'],
        ':error_count'        => (int) $payload['error_count'],
        ':punctuation_mode'   => $punctuation,
    ]);

    $id = (int) $pdo->lastInsertId();

    $fetch = $pdo->prepare('SELECT id, wpm, accuracy, created_at FROM scores WHERE id = :id');
    $fetch->execute([':id' => $id]);
    $row = $fetch->fetch();

    if ($row === false) {
        log_db_error('save_score', new RuntimeException("inserted row {$id} could not be read back"));
        fail('Could not save score', 500);
    }

    $rank  = score_rank($pdo, $row);
    $total = (int) $pdo->query('SELECT COUNT(*) FROM scores')->fetchColumn();

    json_out([
        'ok'           => true,
        'id'           => $id,
        'rank'         => $rank,
        'total_scores' => $total,
    ]);
} catch (Throwable $e) {
    // Throwable, not just PDOException: anything uncaught here would reach PHP's
    // default handler, and XAMPP ships display_errors=On, so the client would get
    // an HTML fatal with absolute paths instead of JSON.
    log_db_error('save_score', $e);
    fail('Could not save score', 500);
}
