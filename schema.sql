-- Typing Speed Test — score storage
--
-- Apply (Windows PowerShell 5.1 has no `<` redirection):
--   Get-Content .\schema.sql | & C:\xampp\mysql\bin\mysql.exe -u root -h 127.0.0.1 typing_game
--
-- Safe to run repeatedly: CREATE TABLE IF NOT EXISTS leaves existing data alone.

CREATE TABLE IF NOT EXISTS `scores` (
    `id`                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    `player_name`        VARCHAR(32)       NOT NULL,
    `wpm`                SMALLINT UNSIGNED NOT NULL,
    `accuracy`           DECIMAL(5,2)      NOT NULL,
    `time_taken_seconds` DECIMAL(6,2)      NOT NULL,
    `chars_typed`        SMALLINT UNSIGNED NOT NULL,
    `error_count`        SMALLINT UNSIGNED NOT NULL,
    `punctuation_mode`   TINYINT(1)        NOT NULL DEFAULT 0,
    `created_at`         TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    -- Declared ascending on purpose. MariaDB 10.4 (the engine XAMPP ships) parses
    -- `wpm DESC` in an index definition but silently ignores the direction, so an
    -- ascending index is the honest declaration. The optimiser scans it backwards
    -- to serve the leaderboard's `ORDER BY wpm DESC, accuracy DESC, created_at ASC`.
    KEY `idx_scores_rank` (`wpm`, `accuracy`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
