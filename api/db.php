<?php
/**
 * Shared database connection and JSON response helpers for the score endpoints.
 */

require_once __DIR__ . '/config.php';

/**
 * Open a PDO connection to the game database.
 *
 * Throws PDOException on failure — callers catch it, log it, and return a
 * generic message. Connection details never reach the client.
 */
function get_pdo(): PDO
{
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

/**
 * Send a JSON response and stop. Every exit path from an endpoint goes through here.
 */
function json_out(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Send a JSON error and stop. The message is written by us, never by PDO.
 */
function fail(string $message, int $status): void
{
    json_out(['ok' => false, 'error' => $message], $status);
}

/**
 * Log a server-side failure without leaking anything to the client.
 */
function log_db_error(string $context, Throwable $e): void
{
    error_log(sprintf('[typing-game] %s: %s', $context, $e->getMessage()));
}

/**
 * Rank of one score row within the whole table.
 *
 * The comparison mirrors the leaderboard's ORDER BY exactly
 * (wpm DESC, accuracy DESC, created_at ASC, id ASC) so that the rank a row gets
 * when it is saved is the same rank it has in the listing. Shared by both
 * endpoints on purpose — two copies would drift.
 *
 * @param array $row Must contain id, wpm, accuracy, created_at.
 */
function score_rank(PDO $pdo, array $row): int
{
    $sql = 'SELECT COUNT(*) + 1 FROM scores
            WHERE wpm > :wpm
               OR (wpm = :wpm2 AND accuracy > :accuracy)
               OR (wpm = :wpm3 AND accuracy = :accuracy2 AND created_at < :created_at)
               OR (wpm = :wpm4 AND accuracy = :accuracy3 AND created_at = :created_at2 AND id < :id)';

    $statement = $pdo->prepare($sql);
    $statement->execute([
        ':wpm'         => $row['wpm'],
        ':wpm2'        => $row['wpm'],
        ':wpm3'        => $row['wpm'],
        ':wpm4'        => $row['wpm'],
        ':accuracy'    => $row['accuracy'],
        ':accuracy2'   => $row['accuracy'],
        ':accuracy3'   => $row['accuracy'],
        ':created_at'  => $row['created_at'],
        ':created_at2' => $row['created_at'],
        ':id'          => $row['id'],
    ]);

    return (int) $statement->fetchColumn();
}
