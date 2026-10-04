<?php
/**
 * GET api/leaderboard.php?limit=10&highlight_id=7
 *
 * limit        optional, default 10, clamped to 1..50
 * highlight_id optional, resolves one specific score so the player can see their
 *              own standing even when it falls outside the top list
 *
 * 200 -> { "ok": true, "top": [ { id, rank, player_name, wpm, accuracy, created_at } ],
 *          "highlight": { ... } | null, "total_scores": 20 }
 * 405 -> { "ok": false, "error": "Method not allowed" }
 * 500 -> { "ok": false, "error": "Could not load leaderboard" }
 */

require_once __DIR__ . '/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    fail('Method not allowed', 405);
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 50;

$limit = DEFAULT_LIMIT;
if (isset($_GET['limit']) && is_string($_GET['limit']) && preg_match('/^\d+$/', trim($_GET['limit']))) {
    $limit = max(1, min(MAX_LIMIT, (int) trim($_GET['limit'])));
}

$highlightId = null;
if (isset($_GET['highlight_id']) && is_string($_GET['highlight_id']) && preg_match('/^\d+$/', trim($_GET['highlight_id']))) {
    $candidate = (int) trim($_GET['highlight_id']);
    if ($candidate > 0) {
        $highlightId = $candidate;
    }
}

/**
 * Shape a DB row for JSON: ints as ints, accuracy as a float.
 */
function present_score(array $row, int $rank): array
{
    return [
        'id'          => (int) $row['id'],
        'rank'        => $rank,
        'player_name' => (string) $row['player_name'],
        'wpm'         => (int) $row['wpm'],
        'accuracy'    => (float) $row['accuracy'],
        'created_at'  => (string) $row['created_at'],
    ];
}

try {
    $pdo = get_pdo();

    $topStatement = $pdo->prepare(
        'SELECT id, player_name, wpm, accuracy, created_at
         FROM scores
         ORDER BY wpm DESC, accuracy DESC, created_at ASC, id ASC
         LIMIT :limit'
    );
    // Must be bound as an integer: with ATTR_EMULATE_PREPARES = false a quoted
    // LIMIT value is a syntax error on the server.
    $topStatement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $topStatement->execute();

    $top = [];
    $rank = 1;
    foreach ($topStatement->fetchAll() as $row) {
        $top[] = present_score($row, $rank);
        $rank++;
    }

    $highlight = null;
    if ($highlightId !== null) {
        $one = $pdo->prepare('SELECT id, player_name, wpm, accuracy, created_at FROM scores WHERE id = :id');
        $one->execute([':id' => $highlightId]);
        $row = $one->fetch();

        if ($row !== false) {
            $highlight = present_score($row, score_rank($pdo, $row));
        }
    }

    $total = (int) $pdo->query('SELECT COUNT(*) FROM scores')->fetchColumn();

    json_out([
        'ok'           => true,
        'limit'        => $limit,
        'top'          => $top,
        'highlight'    => $highlight,
        'total_scores' => $total,
    ]);
} catch (Throwable $e) {
    // Throwable, not just PDOException: anything uncaught here would reach PHP's
    // default handler, and XAMPP ships display_errors=On, so the client would get
    // an HTML fatal with absolute paths instead of JSON.
    log_db_error('leaderboard', $e);
    fail('Could not load leaderboard', 500);
}
