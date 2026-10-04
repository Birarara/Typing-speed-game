# Typing Speed Test

A browser typing test with player names, score saving, and a leaderboard. You enter
a name, type a randomly fetched quote, and your words-per-minute and accuracy are
stored in MySQL. When the run ends you see the top scores and where you placed.

Built with PHP, HTML, JavaScript, CSS and a single SQL file. No Composer, no npm,
no frameworks, no build step. That is deliberate: you edit a file, you refresh the
page, you see the change.

## Requirements

- **XAMPP**, with Apache and MySQL (MariaDB) running
- **A modern browser.** Tested with Chrome only, see [Known limitations](#known-limitations)
- **PHP 8.2.12** is what this was developed and tested against (the version XAMPP
  bundles here). Anything from PHP 7.4 up should work, but only 8.2.12 was verified
- **An internet connection** is preferred but not required. Quotes come from a public
  API; if it is unreachable the game falls back to five built-in quotes

## Setup

**If you are reading this on the machine the project was built on, setup is already
done.** The database exists, the table exists, the files are in place. Skip to
[How to run](#how-to-run).

For a fresh machine, follow these in order.

### 1. Install and open XAMPP

Download XAMPP from [apachefriends.org](https://www.apachefriends.org/) and install
it. Open the XAMPP Control Panel.

### 2. Start Apache and MySQL

In the control panel, click **Start** next to both **Apache** and **MySQL**. Both
need to show a green "Running" state. Apache serves the pages and runs the PHP;
MySQL stores the scores. If Apache refuses to start, see
[Troubleshooting](#troubleshooting).

### 3. Put the project in htdocs

The project folder must live inside XAMPP's web root, at exactly:

```
C:\xampp\htdocs\typing-game
```

This matters. Apache only serves files under `htdocs`. If the folder sits anywhere
else, PHP will not execute and score saving will not work.

### 4. Create the database

Either through phpMyAdmin or the command line, whichever you prefer.

**Option A, phpMyAdmin.** Go to <http://localhost/phpmyadmin>, click **New** in the
left sidebar, enter `typing_game` as the database name, choose
`utf8mb4_unicode_ci` as the collation, and click **Create**.

**Option B, PowerShell.**

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' -u root -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS typing_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 5. Create the scores table

`schema.sql` holds the table definition. It uses `CREATE TABLE IF NOT EXISTS`, so
running it twice is harmless and will not touch existing scores.

**Option A, phpMyAdmin.** Select the `typing_game` database, open the **Import**
tab, choose `C:\xampp\htdocs\typing-game\schema.sql`, and click **Import**.

**Option B, PowerShell.**

```powershell
Get-Content 'C:\xampp\htdocs\typing-game\schema.sql' | & 'C:\xampp\mysql\bin\mysql.exe' -u root -h 127.0.0.1 typing_game
```

Note the pipe. Windows PowerShell 5.1 does not support `<` input redirection, so
the usual `mysql < schema.sql` form you see in most guides will fail here.

### 6. Confirm it worked

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' -u root -h 127.0.0.1 typing_game -e "DESCRIBE scores;"
```

You should see nine columns. An empty result or an error means step 5 did not take.

## How to run

Open your browser and go to:

```
http://localhost/typing-game/
```

That is the whole thing. Nothing to compile, nothing to install.

**Do not open `index.html` by double-clicking it.** That loads the page as a
`file:///` URL, which means Apache never sees the request and the PHP never runs.
The game itself will appear to work, but saving your score and loading the
leaderboard will both fail. It has to go through `localhost`.

### Playing

1. A name prompt appears first. Type a name, 1 to 32 characters, and click
   **Start**. Typing stays locked until you do. Your name is remembered in the
   browser, so next visit it is prefilled.
2. Press **Enter** to begin a run. A quote is fetched and displayed, and the text
   box becomes editable.
3. Type the quote. Each character turns green as you get it right and red as you
   get it wrong, live.
4. Press **Enter** again to finish. **Type all the way to the last character**, or
   the run will not be recorded. See [How scoring works](#how-scoring-works).
5. Your result and the leaderboard appear. Your row is highlighted and your
   placement is shown, for example "Saved. You placed #3 of 12."
6. From there, **Play again** starts a fresh run, or **Change name** reopens the
   name prompt. Pressing **Enter** also starts a new run.

### The punctuation toggle

The switch in the top right controls how quotes are presented. Off, the quote is
lowercased with punctuation stripped, which is easier. On, you type it exactly as
written, capitals and commas included. Which mode you used is stored with the
score.

## How scoring works

**WPM** is your whitespace-separated word count divided by elapsed time, scaled to
a minute, then rounded.

**Accuracy** is correct characters divided by total characters you accounted for,
where total includes mistyped characters and anything you typed past the end of the
quote.

**Only completed runs are saved.** You have to reach the final character of the
quote. Stop early and you get the leaderboard with a message saying the run was not
recorded, and nothing is written to the database.

This is intentional. Accuracy only counts characters you actually reached, so
without the rule you could type three correct letters, stop, and post 100% accuracy
with an inflated WPM, which would sit at the top of the board forever. The server
enforces this too, and additionally rejects submissions whose numbers contradict
each other, such as hundreds of characters claimed in two seconds or a WPM that
does not match the reported time and character count. The bounds are loose enough
that no genuine run is affected.

**Leaderboard ranking** is highest WPM first. Ties break on higher accuracy, then on
the earlier score. The top 10 are shown by default. If you place outside the top 10,
your own row is shown separately underneath so you can still see your standing.

## Project structure

```
typing-game/
├── index.html            Page markup: game, name prompt, leaderboard panel
├── script.js             The typing test itself: quotes, timing, WPM, accuracy
├── name-gate.js          Name prompt: validation, focus handling, localStorage
├── leaderboard.js        Submits scores, fetches and renders the leaderboard
├── style.css             All styling
├── schema.sql            The scores table definition (setup only)
└── api/
    ├── config.php        Database credentials
    ├── db.php            PDO connection, JSON helpers, shared ranking query
    ├── save_score.php    POST endpoint: validates and stores one score
    └── leaderboard.php   GET endpoint: returns top scores and a highlighted row
```

`schema.sql` is only used during setup. The running app never reads it. Keep it
anyway, it is how you would recreate the database elsewhere.

### The scores table

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | INT UNSIGNED | Primary key |
| `player_name` | VARCHAR(32) | Name entered at the prompt |
| `wpm` | SMALLINT UNSIGNED | Words per minute |
| `accuracy` | DECIMAL(5,2) | Percentage, 0 to 100 |
| `time_taken_seconds` | DECIMAL(6,2) | Run duration |
| `chars_typed` | SMALLINT UNSIGNED | Characters entered |
| `error_count` | SMALLINT UNSIGNED | Mistyped plus overflow characters |
| `punctuation_mode` | TINYINT(1) | 1 if the punctuation toggle was on |
| `created_at` | TIMESTAMP | When the score was saved |

There is also an unused table named `leaderboard` in the same database, left over
from before this feature was built. Nothing reads or writes it. You can drop it
without affecting anything.

## API reference

Both endpoints return JSON and never leak database errors to the client. Failures
are logged server-side and come back as a generic message.

### POST `api/save_score.php`

Saves one completed run. Request body must be JSON:

```json
{
  "player_name": "Biraj",
  "wpm": 108,
  "accuracy": 100,
  "time_taken_seconds": 7.25,
  "chars_typed": 63,
  "error_count": 0,
  "punctuation_mode": false,
  "quote_length": 63,
  "completed": true
}
```

Success returns the new row's id, its rank, and the total number of scores:

```json
{ "ok": true, "id": 1, "rank": 1, "total_scores": 1 }
```

Validation failures return `400` and insert nothing:

```json
{ "ok": false, "error": "Only a completed run can be saved: type the whole quote" }
```

Accepted ranges: `player_name` 1 to 32 characters, `wpm` 0 to 500, `accuracy` 0 to
100, `time_taken_seconds` above 0 and up to 3600, `chars_typed` and `error_count` 0
to 10000, `quote_length` 1 to 10000. `completed` must be true. A wrong method
returns `405`, a server fault returns `500`.

### GET `api/leaderboard.php`

Returns the top scores. Both query parameters are optional: `limit` defaults to 10
and is clamped to 1 through 50, and `highlight_id` resolves one specific score so a
player can see their own standing even when it falls outside the top list.

```powershell
(Invoke-WebRequest -UseBasicParsing 'http://localhost/typing-game/api/leaderboard.php?limit=10&highlight_id=1').Content
```

Real response from this machine:

```json
{
  "ok": true,
  "limit": 10,
  "top": [
    { "id": 1, "rank": 1, "player_name": "Biraj", "wpm": 108, "accuracy": 100, "created_at": "2026-10-04 23:19:37" }
  ],
  "highlight": { "id": 1, "rank": 1, "player_name": "Biraj", "wpm": 108, "accuracy": 100, "created_at": "2026-10-04 23:19:37" },
  "total_scores": 1
}
```

`highlight` is `null` when `highlight_id` is absent or matches no row.

## Troubleshooting

**Page loads but looks unstyled, or scores never save.** You are almost certainly
on a `file:///` URL. Check the address bar. It must start with
`http://localhost/typing-game/`.

**"Could not save score" or "Could not load leaderboard".** The PHP ran but could
not reach the database. Check MySQL is started in the XAMPP Control Panel, then
test the connection directly:

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' -u root -h 127.0.0.1 typing_game -e "SELECT COUNT(*) FROM scores;"
```

A count, including zero, means the database is fine and the problem is elsewhere. A
connection error means MySQL is not running. An "unknown database" or "table
doesn't exist" error means setup steps 4 and 5 need redoing.

**Apache will not start, or `localhost` does not respond.** Something else is using
port 80. The usual culprits are IIS, Skype, or another web server. Find it:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen | Select-Object OwningProcess, @{n='Process';e={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

Either stop that process, or change Apache's port in the XAMPP panel under
**Config → httpd.conf** (and then use `http://localhost:8080/typing-game/` or
whichever port you chose).

**404 on the page.** The folder is not where Apache expects. It must be
`C:\xampp\htdocs\typing-game`, and the URL path has to match the folder name.

**Quotes do not load, or the same five keep appearing.** The quote API is
unreachable, so the built-in fallback quotes are being used. The game still works
fully. Check your internet connection if you want fresh quotes.

**Nothing above matches.** Check the Apache error log, which is where PHP problems
surface:

```powershell
Get-Content 'C:\xampp\apache\logs\error.log' -Tail 30
```

## Security note

The credentials in `api/config.php` are XAMPP's defaults, user `root` with an empty
password. The save endpoint has no authentication and no rate limiting, so anyone
who can reach it can post a score. On your own machine, with MySQL listening only
on `127.0.0.1`, that is fine.

It is not fine on a public host. Before deploying anywhere: create a MySQL user
with a real password and only the rights it needs, move `config.php` out of the web
root, and add authentication to the save endpoint. The file itself carries the same
warning in a comment.

## Known limitations

- **Verified in Chrome only.** Other browsers were not tested. Nothing in the code
  is Chrome-specific, but that is reasoning, not evidence.
- **Screen reader output was never tested.** The markup has labels, a live region,
  a real table with column headers, and focus management, but no assistive
  technology was actually driven to confirm how it reads.
- **The narrow-screen layout is unverified.** There is a `max-width: 600px` style
  block that was not exercised on a real small screen.
- **Scores are self-reported.** The server checks that submitted numbers are
  internally consistent, not that they came from a real run. A determined person
  could still craft a plausible score by hand, since the endpoint has no
  authentication.
