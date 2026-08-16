# Life Organizer — Admin Guide

Two admin interfaces exist:

| Interface | What it is | Best for |
| --- | --- | --- |
| **Terminal console** (`npm run admin`) | Read-only CLI that connects straight to the database | Browsing/auditing data, SQL queries, scripting, backups |
| **Web admin panel** (in-app **Admin** tab) | UI served by the API for `role = "admin"` users | Day-to-day management: users, sessions, activity, data browser, backup/restore |

---

## 1. First-time setup

### 1.1 Create the terminal admin account

The terminal console uses its own credentials stored **outside the repo** at:

```
~/.config/life-organizer/admin.json
```

Create it once:

```bash
npm run admin:init
# prompts for username + password (min 8 chars)
```

Non-interactive (e.g. in CI):

```bash
npm run admin:init -- --username myadmin --password 'S3curePass!'
```

To reset: delete `~/.config/life-organizer/admin.json` and run `admin:init` again.

> The file is stored with mode `0600` and contains only a bcrypt hash of the
> password — never the plaintext.

### 1.2 Give a web user the admin role

The web Admin tab is only visible to users whose `role` is `admin`. Promote a
user from the terminal console:

```bash
npm run admin:sql -- --sql-query "UPDATE users SET role='admin' WHERE username='you'" --allow-write
```

or once they exist in the system, promote them through the web panel itself
(Users section — see §3.2). Alternatively, sign up through the app, then
promote that account with the SQL above.

### 1.3 Which database does the console connect to?

The console reads `DATABASE_URL` from the environment, falling back to the
`DB_*` values. By default that's your **local embedded Postgres**.

To point it at the **production (Neon) database**:

```bash
export DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
npm run admin
```

The banner shows which database you are connected to
(`dbLabel` = `user@host:port/dbname`).

---

## 2. Terminal console (interactive)

```bash
npm run admin
```

### 2.1 Main menu

After login you see every table with its row count:

```
ADMIN CONSOLE
============================================================
   1. users                  12 rows
   2. tasks                 104 rows
   3. notes                  31 rows
   ...
   b. Per-user breakdown
   s. SQL mode (read-only)
   q. Quit

Select table / command:
```

- `1`, `2`, … — browse that table
- `b` — per-user breakdown: one row per user, one column per data table with
  the number of rows each user owns
- `s` — SQL mode (see §2.3)
- `q` — quit

### 2.2 Browsing a table

```
TASKS — 104 rows, page 1/11 (10/page)
┌──────┬─────────┬───────┬────────────┬─────┐
...
[n]ext [p]rev [g]oto [r]ows [s]earch [f]ilter [o]rder [d]etail [x]clear [b]ack [q]uit:
```

| Command | Meaning |
| --- | --- |
| `n` / `p` | next / previous page |
| `g 5` | go to page 5 |
| `r 50` | rows per page (1–100, default 10) |
| `s keyword` | full-text-ish search across all columns |
| `f col=value` | exact match filter, e.g. `f role=admin` |
| `f col~text` | LIKE filter (substring), e.g. `f name~rani` |
| `o col` / `o col desc` | sort ascending / descending, e.g. `o created_at desc` |
| `d` | row detail (all fields of current row, expanded) |
| `x` | clear search/filter/sort |
| `b` | back to main menu |
| `q` | quit entirely |

### 2.3 SQL mode

```
sql> SELECT username, name, role FROM users ORDER BY id DESC LIMIT 5
sql> SELECT count(*) FROM tasks WHERE completed = false
sql> SELECT user_id, count(*) FROM notes GROUP BY user_id ORDER BY 2 DESC
sql> EXPLAIN SELECT * FROM tasks
```

Only read-only statements are allowed (`SELECT`, `EXPLAIN`, `SHOW`, `WITH`,
`VALUES`, `TABLE`, `PREPARE`, `EXECUTE`, `DEALLOCATE`). Anything else is
rejected — the console sets `default_transaction_read_only = on` on every
connection (unless `--allow-write` is passed explicitly).

### 2.4 One-shot / scripted usage (JSON)

All flags work non-interactively and print JSON — great for scripting:

```bash
npm run admin -- --json                                     # list tables + row counts
npm run admin -- --json --table tasks                       # first page of a table
npm run admin -- --json --table users --page 2 --per-page 25
npm run admin -- --json --table tasks --filter "reminder~10min" --sort created_at --sort-dir desc
npm run admin -- --json --table tasks --search "meeting"
npm run admin -- --json --breakdown                         # per-user breakdown
npm run admin -- --json --sql-query "SELECT * FROM habits"  # arbitrary read-only query
```

Supply credentials non-interactively with `--username` / `--password`:

```bash
npm run admin -- --json --table tasks --username myadmin --password 'S3curePass!'
```

### 2.5 Common flags (reference)

| Flag | Description |
| --- | --- |
| `--username`, `--password` | authenticate without prompts |
| `--config <path>` | alternate admin credential file |
| `--json` | machine-readable output |
| `--table <name>` | browse a specific table |
| `--page`, `--per-page` | pagination |
| `--search <text>` | search value |
| `--filter "col=value"` or `"col~text"` | exact / LIKE filter |
| `--sort <col>`, `--sort-dir asc\|desc` | ordering |
| `--breakdown` | per-user row counts |
| `--sql` | read-only SQL REPL |
| `--sql-query "SELECT …"` | run one read-only query |
| `--allow-write` | **disable** read-only enforcement (dangerous — use with care) |

> Environment: `ADMIN_CONFIG_PATH` overrides the credentials file location;
> `DATABASE_URL` overrides the database; `ADMIN_BACKUP_PASS` supplies the
> export passphrase.

---

## 3. Web admin panel

Open the app, log in as an admin user → **Admin** tab.

### 3.1 Overview (DATA STORES)

- Row count for every table, plus totals and last-activity info.

### 3.2 ACCOUNTS (users)

- List users with search, pagination and filters (name/email/role/created).
- Change a user's role (`user` ↔ `admin`) — protects against demoting
  yourself.
- Delete a user (cascades to all their data).

### 3.3 SESSIONS

- All active login sessions (user, IP, user agent, created, last seen).
- **Revoke** any session to force a logout (e.g. stolen device).

### 3.4 ACTIVITY LOG

- Recent writes across the app (who did what, when).
- Filter by user, action, and date range; paginated.

### 3.5 DATA BROWSER

- Pick any table → paginated, searchable view of every row
  (same capabilities as the terminal browse, in the browser).

### 3.6 ENCRYPTED BACKUP / PLAINTEXT EXPORT / RESTORE

- **Encrypted backup**: downloads `life-organizer-backup-<timestamp>.json`
  encrypted with AES-256-GCM (passphrase prompt). Keep it somewhere safe.
- **Plaintext export**: full database as JSON (handy for migrations).
- **Restore**: upload a previous backup (JSON, encrypted or plaintext) to
  replace the database contents. Deletes existing data first — the UI asks
  for confirmation.

---

## 4. Backups from the terminal

```bash
npm run admin:export                                   # prompts for passphrase
npm run admin:export -- --out /tmp/backup.lzb --pass 'secret'   # non-interactive
ADMIN_BACKUP_PASS=secret npm run admin:export -- --json
```

Writes an **AES-256-GCM** encrypted file (`.lzb`) containing every table.
`--json` prints a machine-readable summary instead of the human banner.

Restore from the terminal is not supported — use the web panel's Restore
section (upload the JSON; it accepts both plaintext and the passphrase-
decrypted contents).

---

## 5. Quick recipes

```bash
# Who has data? (production)
export DATABASE_URL="$(cat /tmp/neon-url.txt)"
npm run admin -- --json --breakdown

# Find a task by name
npm run admin -- --json --table tasks --search "gym"

# Last 10 signups
npm run admin -- --json --table users --sort id --sort-dir desc --per-page 10

# All unfinished tasks, oldest first
npm run admin -- --json --table tasks --filter "completed=false" --sort created_at

# Back everything up
npm run admin:export -- --out backup.lzb
```

---

## 6. Security notes

- The terminal console is **read-only by default** at the database level
  (`default_transaction_read_only = on`). Only `--allow-write` disables it.
- Web admin routes require an authenticated user with `role = "admin"` and
  are rate-limited separately from normal API routes.
- Credentials for the console live only in `~/.config/life-organizer/admin.json`
  (0600, bcrypt hash). Delete it and re-run `admin:init` if compromised.
- Backups are encrypted with AES-256-GCM — losing the passphrase means losing
  the backup.
- Do not commit `.env`, `*.lzb` backup files, or `admin.json` to the repo.