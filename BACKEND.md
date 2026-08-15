# Backend Architecture & Reference

Everything about the **Life Organizer** backend: how it works, how it connects to the frontend and the database, what libraries it uses, the request lifecycle, the API surface, and how it's deployed.

> Scope: `server/`, `netlify/functions/`, and the frontend↔backend wiring. The full table of contents is at the top of each section so you can jump around.

---

## Table of Contents

1. [What this backend is](#1-what-this-backend-is)
2. [Tech stack](#2-tech-stack)
3. [How the pieces connect (high level)](#3-how-the-pieces-connect-high-level)
4. [Project layout](#4-project-layout)
5. [Configuration & environment variables](#5-configuration--environment-variables)
6. [Database layer](#6-database-layer)
   - [Connection pool (`db.js`)](#61-connection-pool)
   - [Embedded PostgreSQL for local dev](#62-embedded-postgresql-for-local-dev)
   - [Migrations & schema](#63-migrations--schema)
7. [Request lifecycle](#7-request-lifecycle)
8. [Middleware stack](#8-middleware-stack)
9. [Authentication & sessions](#9-authentication--sessions)
10. [Route conventions (the CRUD pattern)](#10-route-conventions-the-crud-pattern)
11. [API reference](#11-api-reference)
12. [The `/api/migrate` legacy importer](#12-the-apimigrate-legacy-importer)
13. [Stats & analytics module](#13-stats--analytics-module)
14. [Error handling conventions](#14-error-handling-conventions)
15. [How the frontend connects](#15-how-the-frontend-connects)
16. [Deployment (local, Netlify, Neon)](#16-deployment-local-netlify-neon)
17. [Testing](#17-testing)
18. [Security notes](#18-security-notes)

---

## 1. What this backend is

A **REST API** written in Node.js + Express that powers a single-page React app (Life Planner). It provides:

- Account registration / login / logout (email + password, cookie sessions)
- Per-user CRUD for **10 data collections**: tasks, notes, calendar events, goals, habits, meals, grocery items, custom reminders, activity log, and a legacy data importer
- Read-only aggregates for the dashboard and analytics (computed server-side)
- Health endpoint for uptime/DB checks

Every collection is **scoped to the logged-in user** (`user_id` column + `WHERE user_id = $1` on every query), so no user can read or modify another user's data.

The same codebase runs two ways:

| Mode | Entry point | How it runs |
|---|---|---|
| Local dev / `npm run server` | `server/index.js` | Long-lived Express server on `:4000` |
| Production (Netlify) | `netlify/functions/api.js` | Express app wrapped in `serverless-http`, invoked per request as a Netlify Function |

---

## 2. Tech stack

| Concern | Library | Version | Why / role |
|---|---|---|---|
| HTTP framework | **Express** | `^5.2.1` | Routing + middleware, async handlers, 404/error handlers |
| HTTP serverless adapter | **serverless-http** | `^4.0.0` | Wraps the Express app for Netlify Functions |
| PostgreSQL driver | **pg** | `^8.23.0` | Connection pooling + parameterized queries |
| Schema migrations | **node-pg-migrate** | `^9.0.0` | Versioned, idempotent schema migrations |
| Embedded Postgres (dev) | **embedded-postgres** | devDep | Spins up a real PostgreSQL instance inside `.pgdata/` |
| Password hashing | **bcryptjs** | `^3.0.3` | bcrypt cost-10 hashing for passwords (pure JS, no native build) |
| Session cookies | **cookie-parser** | `^1.4.7` | Reads signed/unsigned cookies; the session token rides here |
| CORS | **cors** | `^2.8.6` | Whitelist of allowed browser origins |
| Security headers | **helmet** | `^8.3.0` | Sets `X-Frame-Options`, `X-Content-Type-Options`, CSP, etc. |
| Rate limiting | **express-rate-limit** | `^8.6.2` | Throttles `/api/auth/*` and the rest of the API |
| Env config | **dotenv** | `^17.4.2` | Loads `.env` into `process.env` |

No ORM — all SQL is written by hand with `pg` parameterized queries (`$1`, `$2`, ...), which prevents SQL injection.

---

## 3. How the pieces connect (high level)

```
        React SPA (Vite, port 5173)
                  │
                  │  fetch('/api/tasks', { credentials:'include' })
                  ▼
        ┌─────────────────────────────────────┐
        │  API_BASE resolution (src/api.js)   │
        │  1. VITE_API_URL if set             │
        │  2. else '/api'                     │
        └──────────────┬──────────────────────┘
                       │
        ┌──────────────▼──────────────────────┐
        │  Dev: Vite proxy  /api → :4000      │  (vite.config.js)
        │  Prod: /api → /.netlify/functions/  │  (netlify.toml)
        └──────────────┬──────────────────────┘
                       │
                       ▼
        Express app (server/app.js)
        middleware stack → routes → SQL
                       │
                       ▼
        pg.Pool ──► PostgreSQL
        local: embedded-postgres (:5432, .pgdata/)
        prod:  Neon (managed, DATABASE_URL)
```

Two connection facts worth knowing:

- **Local dev**: Vite proxies every `/api/*` request to `http://localhost:4000` (`vite.config.js`). The browser only ever talks to `:5173`, so httpOnly cookies and CORS behave like a single origin.
- **Production**: `VITE_API_URL = "/.netlify/functions/api"` is baked into the build (`netlify.toml`). Netlify routes `/.netlify/functions/api/*` to the serverless function; the SPA + API share the domain, so session cookies work unchanged.

---

## 4. Project layout

```
server/
├── index.js                    # Local server entry (createApp + listen + graceful shutdown)
├── app.js                      # createApp(): Express wiring, middleware order, router mount
├── config.js                   # Reads env → config object (db, cors, session, embedded pg)
├── db.js                       # pg.Pool singleton + connect/disconnect/status helpers
├── db/
│   ├── embedded.js             # Dev-only: boots an embedded PostgreSQL instance
│   └── migrations/             # node-pg-migrate versioned schema files
├── middleware/
│   ├── auth.js                 # requireAuth: session token → req.user
│   ├── errorHandler.js         # notFound + centralized error→JSON mapping
│   ├── rateLimit.js            # authLimiter + apiLimiter
│   └── requestLogger.js        # Dev-only request/response timing log
├── routes/                     # One router per resource (all mounted under /api)
│   ├── auth.js  health.js  profile.js
│   ├── tasks.js  notes.js  calendarEvents.js
│   ├── goals.js  habits.js  meals.js
│   ├── groceryItems.js  customReminders.js  activityLog.js
│   ├── stats.js                # dashboard + analytics aggregates
│   └── migrate.js              # one-time legacy localStorage importer
└── utils/
    ├── AppError.js             # Error subclass carrying statusCode + details
    ├── sessions.js             # cookie options, sha256, create/revoke session, safeUser
    └── stats.js                # computeDashboard / computeAnalytics (pure functions)

netlify/
└── functions/api.js            # Production entry: serverless(app) + connectDatabase
```

---

## 5. Configuration & environment variables

`server/config.js` loads `.env` (via `dotenv`) and exports a frozen config object used everywhere.

### `.env` reference

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables strict env checks + secure cookies |
| `PORT` | `4000` | Local server port |
| `API_PREFIX` | `/api` | Mount path for every router |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed by CORS |
| `DATABASE_URL` | — | Full connection string; takes precedence over `DB_*` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `localhost:5432/life_organizer` | Fallback connection parts when no `DATABASE_URL` |
| `SESSION_TTL_MINUTES` | `10080` (7 days) | Session lifetime + cookie maxAge |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_API_MAX` | `20` / `1000` | Per-15-min request caps |
| `PG_DATA_DIR` / `PG_SUPERUSER` / `PG_SUPERUSER_PASSWORD` | `.pgdata` / `postgres` | Embedded Postgres bootstrap |

### Hard requirements

`config.js` deliberately **throws at startup** in production if:

- `DATABASE_URL` (or `DB_USER` + `DB_PASSWORD`) is missing, or
- `CORS_ORIGINS` is missing.

This fails fast instead of shipping a broken deploy.

### Config resolution order for the DB

1. `DATABASE_URL` if present
2. Else build `postgres://user:pass@host:port/db` from `DB_*`

---

## 6. Database layer

### 6.1 Connection pool

`server/db.js` owns a single `pg.Pool` (lazily created on first use) with an idle-client error handler. Key functions:

- `getPool()` → the singleton `pg.Pool` (builds `connectionString` from `config.db.url`)
- `connectDatabase()` → runs `SELECT 1` to verify connectivity, flips the `connected` flag (used by `/health`)
- `getDatabaseStatus()` → `{ configured, connected, provider: "postgres" }`
- `disconnectDatabase()` → drains the pool (used on server shutdown)

The pool is created **once per process** and reused across requests — connection overhead is amortized.

### 6.2 Embedded PostgreSQL for local dev

`server/db/embedded.js` runs a real PostgreSQL server **inside the repo** (data dir `.pgdata/`) using `embedded-postgres`:

1. If `.pgdata/PG_VERSION` doesn't exist → `pg.initialise()` (downloads/bootstraps binaries + data dir)
2. `pg.start()` on `127.0.0.1:${PORT}` (default 5432)
3. Connects as superuser `postgres`, creates the app role `life_organizer` and database `life_organizer` if missing
4. Stays running until `SIGINT`/`SIGTERM`

```
npm run db:start    # boots embedded postgres
npm run db:migrate  # applies migrations (separate step)
npm run server      # starts the API against it
```

### 6.3 Migrations & schema

`node-pg-migrate` versioned migrations live in `server/db/migrations/`. Each file exports `up(pgm)` / `down(pgm)`. Applied migrations are recorded in the `pgmigrations` table, so re-running `npm run db:migrate` is a **no-op** on already-applied ones (this is what makes repeat Netlify deploys safe).

| Migration | What it does |
|---|---|
| `20260814160000_init-schema` | Creates `users`, `tasks`, `notes`, `calendar_events`, `goals`, `habits`, `meals`, `grocery_items`, `custom_reminders`, `activity_log`, `settings` + indexes, FKs (`user_id → users`, `ON DELETE CASCADE`), constraints |
| `20260814170000_add-sessions` | Creates `sessions` (token_hash, user_id FK, expires_at, revoked_at) |
| `20260814180000_add-user-data-columns` | Adds `goals.unit` and `grocery_items.unit` |
| `20260815100000_add-task-color` | Adds `tasks.color` (text) for the per-task color palette |

**Schema snapshot** (all data tables carry `user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`):

- `users` — id, name, email (unique, case-insensitive index), password_hash, created_at, updated_at
- `sessions` — id, token_hash (unique), user_id, created_at, last_seen_at, expires_at, revoked_at
- `tasks` — name, date, time, priority (`Red/Yellow/Green` check), reminder, completed, type, description, start_date, estimated_time, tags `text[]`, subtasks `jsonb`, recurring, **color**, timestamps
- `notes` — title, content, category, pinned, archived, tags `text[]`
- `calendar_events` — title, start_date (required), end_date, start_time, end_time, all_day, category, location, description, reminder, recurrence, recurrence_end, custom_weekdays `integer[]`, overrides `jsonb`
- `goals` — name, current `numeric`, target `numeric`, unit
- `habits` — name, days `boolean[7]`, history `date[]`
- `meals` — date, type, name, time, calories, protein, carbohydrates, fat, ingredients `text[]`, notes, status, day, breakfast, lunch, dinner, snack
- `grocery_items` — name, category, quantity, unit, note, completed
- `custom_reminders` — title, date, time, note, type, completed
- `activity_log` — name, status, timestamp, created_at
- `settings` — user_id PK, theme (table exists in schema; the frontend currently persists theme in `localStorage`)

---

## 7. Request lifecycle

```
1. Client sends request  (cookie header carries session token)
2. helmet()            → security headers
3. cors()              → allow-listed origins + credentials
4. apiLimiter          → 429 if over 1000 req / 15 min
5. express.json()      → parse body (max 1mb)
6. cookieParser()      → req.cookies
7. requestLogger       → dev-only timing log
8. Router (e.g. /api/tasks)
      └─ requireAuth   → validates session, sets req.user
         └─ handler    → normalize → SQL → serialize → res.json()
9. 404 handler or error handler → error JSON
```

`createApp()` (`server/app.js`) is a **factory** returning a fresh Express app. This matters because both the local server (`index.js`) and the Netlify function (`netlify/functions/api.js`) build their own instance — and tests do too.

---

## 8. Middleware stack

- **helmet()** — baseline security headers.
- **cors({ origin: config.corsOrigins, credentials: true })** — reflects the configured origin(s) and permits cookies. `credentials: true` is required for the httpOnly session cookie.
- **apiLimiter** (`express-rate-limit`) — 1000 req / 15 min on the whole API. Applied to `/api` in `app.js` **before** routers.
- **express.json({ limit: "1mb" })** — JSON bodies, 1 MB cap.
- **cookieParser()** — exposes `req.cookies` (the session token lives here).
- **requestLogger** — logs `METHOD url status ms` in dev only.
- **requireAuth** (per-router) — see next section.
- **notFoundHandler** — `404 Route not found: METHOD /url`.
- **errorHandler** — last line of defense; maps errors to status codes and JSON (see [§14](#14-error-handling-conventions)).

Mounting note: the **auth router gets its own stricter limiter** (`authLimiter`, 20 req / 15 min) — applied in `app.js` only to `/api/auth`.

---

## 9. Authentication & sessions

Everything lives in `server/routes/auth.js` (endpoints) + `server/utils/sessions.js` + `server/middleware/auth.js`.

### Registration / login flow

1. Validate (name ≤100, valid email, password 8–72 chars).
2. `bcrypt.hash(password, 10)` → store hash; **plaintext never stored**.
3. `createSession(userId)`:
   - generates `crypto.randomBytes(32).toString("hex")` as the opaque token
   - stores `sha256(token)` in `sessions.token_hash` with `expires_at = now() + 7 days`
   - returns the raw token
4. Response sets cookie `life_organizer_sid` = raw token with:

```js
{ httpOnly: true, secure: env === "production", sameSite: "lax", path: "/", maxAge: 7 days }
```

So the DB holds only a hash — a leaked DB does not leak usable session tokens.

### requireAuth (every protected route)

1. Read `req.cookies.life_organizer_sid`.
2. Look up `sessions ⋈ users` by `token_hash = sha256(token)`.
3. Reject if missing, revoked (`revoked_at`), or expired.
4. **Sliding expiration**: if within 1h of expiry or last seen >15 min ago, bump `expires_at` to `now() + TTL` and refresh `last_seen_at`.
5. Attach `req.user` (id, name, email, createdAt, updatedAt) and `req.session`.

### Logout

`revokeSession(token)` deletes the session row by hash; the cookie is cleared with `maxAge: 0`.

### `/api/auth/me`

`requireAuth`-protected — returns the current user object from the session (no DB re-fetch).

---

## 10. Route conventions (the CRUD pattern)

All resource routers (`tasks`, `notes`, `calendarEvents`, `goals`, `habits`, `meals`, `groceryItems`, `customReminders`, `activityLog`) follow one shape:

```
router.use(requireAuth)          # everything below needs a session
GET    /            list (filters + sorting)
POST   /            create
GET    /:id         fetch one (ownership-checked)
PUT    /:id         full update
PATCH  /:id         partial update
DELETE /:id         delete
```

The pattern is clearest in `server/routes/tasks.js`:

- **FIELDS** — `[apiKey, columnName, pgType][]`. A single table drives create + update, e.g. `["color", "color", "text"]`, `["tags", "tags", "array"]`, `["subtasks", "subtasks", "jsonb"]`.
- **normalizeField(api, value)** — whitelist validation per field. Unknown keys are rejected (`Unexpected field` 400); format validation (dates `YYYY-MM-DD`, times `HH:MM`, enums, arrays) happens here. e.g. `color` must be one of the 6 palette hexes (uppercased).
- **serialize(row)** — converts DB rows (snake_case, Date objects, PG arrays/jsonb) → JSON API shape (camelCase, `YYYY-MM-DD` strings, JS arrays). Timestamps are ISO strings.
- **bindValue(type, value)** — JSON-stringifies `jsonb` fields before parameter binding.
- **fetchOwned(id, userId)** — `SELECT * FROM t WHERE id = $1 AND user_id = $2` → guarantees **ownership scoping**; returns 404 if not found.
- **Queries are parameterized** everywhere — no string interpolation of user input into SQL (search input gets `ILIKE` with `%`/`_`/`\` escaped).

List endpoints support query params (resource-dependent): `search`, `status` (pending/completed/overdue), `priority`, `type`, `from`/`to` date range, `sort`, `archived`, `category`. Sorting is whitelisted via a `SORT` map (unknown keys fall back to a default) — never user-supplied SQL.

---

## 11. API reference

Base prefix `/api`. All routes except `health`/`auth` require a session cookie.

### Health & auth

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Service banner `{ service, status }` |
| GET | `/health` | — | `status`, `uptime`, `db: { configured, connected, provider }` |
| POST | `/auth/register` | — | Create account → sets session cookie (201) |
| POST | `/auth/login` | — | Verify password → sets session cookie (200) |
| POST | `/auth/logout` | — | Delete session, clear cookie (204) |
| GET | `/auth/me` | ✅ | Current user |

### Data collections (all `requireAuth`)

| Resource | Route | Standard CRUD | Notable fields / filters |
|---|---|---|---|
| Profile | `/profile` | GET / PUT | update `name`, `email` |
| Tasks | `/tasks` | ✅ | `color`, `subtasks`, `tags`, `recurring`; filters `search/status/priority/type/from/to/sort` |
| Notes | `/notes` | ✅ | `pinned`, `archived`, `tags`; filters `search/category/archived/sort` |
| Calendar events | `/calendarEvents` | ✅ | `startTime`, `allDay`, `category`, `recurrence`, `overrides`; filters `from/to` |
| Goals | `/goals` | ✅ | `name`, `current`, `target`, `unit` (current ≥0, target >0) |
| Habits | `/habits` | ✅ | `days` (7 booleans), `history` (date[]); no timestamps update |
| Meals | `/meals` | ✅ | `calories/protein/carbohydrates/fat`, `ingredients`, `day` (Mon–Sun), status |
| Grocery items | `/groceryItems` | ✅ | `name`, `category`, `quantity`, `unit`, `note`, `completed` |
| Custom reminders | `/customReminders` | ✅ | `title`, `date`, `time`, `note`, `type` enum |
| Activity log | `/activityLog` | GET / POST / DELETE(:id) / DELETE(all) | `name`, `status`, `timestamp` |
| Stats | `/stats` | GET | Dashboard + analytics aggregates (see §13) |
| Migrate | `/migrate` | POST | Legacy localStorage import (see §12) |

`calendarEvents` requires `title` + `start` on create; `tasks` requires `name`; `goals`/`habits` require `name`; reminders require `title`; activity log requires `name`. Everything else is optional with safe defaults.

---

## 12. The `/api/migrate` legacy importer

`server/routes/migrate.js` is a one-time migration for users coming from the old **localStorage** app. POST one payload containing arrays for any collection:

```json
{ "tasks": [...], "notes": [...], "calendarEvents": [...], "goals": [...],
  "habits": [...], "meals": [...], "groceryItems": [...],
  "customReminders": [...], "activityLog": [...] }
```

- Runs inside a single **transaction** (`BEGIN`/`COMMIT` with `ROLLBACK` on error) so a partial failure never leaves half-imported data.
- Every record is scrubbed through `clean*` helpers (truncation, date/time regex, enum coercion, `cleanColor` for the task palette, empty→null). Nothing from the payload reaches SQL as raw input.
- Old field names are mapped to the current schema (e.g. `start`/`date` → `start_date`).
- Returns `201 { migrated: { tasks: n, notes: n, ... } }`.

The frontend calls it once after first sign-in, then clears the legacy localStorage keys.

---

## 13. Stats & analytics module

`server/routes/stats.js` pulls all six relevant collections in parallel (`Promise.all`), then delegates to pure functions in `server/utils/stats.js`:

- **computeDashboard(tasks, events, meals, goals, notes, habits)** → today's task counts + completion, overall completion rate, high-priority (Red) open, overdue, goal/project progress, today's events/meals, weekly snapshot (`week.tasks/completed/events/habitCheckins`), note counts, `isEmpty`.
- **computeAnalytics(tasks, events, habits)** → completion rate + overdue, this-week and this-month rates, upcoming events, habit completions/rate/best streak, and a `last14Days` activity series (per-day completed tasks, habit check-ins, events) normalized with `maxActivity`.

All date math uses local `YYYY-MM-DD` keys; habits compute streaks by diffing consecutive completion dates. `overdue` uses `date + COALESCE(time, '23:59') < now()` semantics.

---

## 14. Error handling conventions

- **AppError** (`server/utils/AppError.js`) — `new AppError(message, statusCode, details?)`. Thrown by validators/routes for predictable 4xx responses.
- **errorHandler** maps:
  - `AppError` → its `statusCode`
  - Known **PostgreSQL error codes** (from `PG_ERROR_STATUS`) → friendly 4xx (e.g. `23505` unique violation → 409, `23503` FK → 400, `22P02` bad enum/int → 400)
  - Any other client status (400–499) → passed through
  - Everything else → `500 Internal Server Error`
- Response shape is always `{ "error": { "message": "...", "details?": ... } }` (dev builds also include `stack`).
- 5xx errors are logged to console; 4xx are not.

---

## 15. How the frontend connects

- **`src/api.js`** — single fetch wrapper. `API_BASE` resolves in priority order: global override → `import.meta.env.VITE_API_URL` → `/api`. Every call uses `credentials: "include"` (sends the httpOnly cookie) and `content-type: application/json`. Non-2xx throws `ApiError` with the server's `error.message`.
- **`src/hooks/useLifePlanner.js`** — the React data layer; loads all collections on login (`Promise.all` of `api.get(...)`), exposes `addOrUpdateX`, `deleteX`, `toggleX` helpers that call the API then update local state. It also runs `migrateTasks`/`migrateEvents` normalizers (e.g. defaulting new fields like `color`) so old cached data still renders.
- **Dev proxy** — `vite.config.js` forwards `/api` → `http://localhost:4000` (override with `VITE_PROXY_TARGET`).
- **Prod** — `VITE_API_URL=/.netlify/functions/api` baked at build time.

---

## 16. Deployment (local, Netlify, Neon)

### Local development

```bash
npm install
npm run db:start      # 1) boot embedded PostgreSQL  (port 5432, .pgdata/)
npm run db:migrate    # 2) apply schema migrations
npm run server        # 3) API on http://localhost:4000
npm run dev           # 4) Vite dev server + proxy on http://localhost:5173
```

### Netlify (production)

`netlify.toml`:

```toml
[build]
  command = "npm run db:migrate && npm run build"
  publish = "dist"

[build.environment]
  NODE_ENV = "production"
  VITE_API_URL = "/.netlify/functions/api"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  external_node_modules = ["pg-native"]

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- The build runs migrations first (idempotent), then builds the SPA.
- `netlify/functions/api.js` reuses `createApp()` from `server/app.js`, calls `connectDatabase()` (lazily, memoized across invocations), and normalizes the function path so Express sees `/api/...`.
- Site env vars (set in the Netlify dashboard): `DATABASE_URL` (Neon `postgresql://...neon.tech/neondb?sslmode=require`), `CORS_ORIGINS` (the deployed site URL), plus `NODE_ENV`/`VITE_API_URL` baked by the build.
- Deploy via the dashboard (connected repo) or CLI:

```bash
npx netlify-cli deploy --prod --build
```

- The SPA rewrite (`/* → /index.html`) is last, so `/.netlify/functions/*` is intercepted by Netlify's function router first.

### Important deploy note

The site is **not linked to a GitHub repo** (confirmed via the Netlify API: `repo_url: null`). Pushing to GitHub does **not** auto-deploy; production deploys must be triggered from the Netlify dashboard ("Deploy site") or with the CLI command above. The latest migration (`add-task-color`) was applied to Neon directly during the last deploy.

---

## 17. Testing

Tests live in `tests/` and run against a real DB (the same embedded PostgreSQL), using the actual HTTP API via `createApp()` + `app.listen(0)`:

```bash
npm run test:db          # schema/migration/integrity
npm run test:auth        # register/login/logout/me, password hashing
npm run test:profile     # profile get/update
npm run test:tasks       # tasks CRUD + filters + validation
npm run test:notes       # notes CRUD
npm run test:calendar    # calendar events CRUD
npm run test:stats       # dashboard + analytics aggregates
npm run test:collections # goals/habits/meals/grocery/reminders/activity/migrate
npm run test:security    # authz/isolation/rate-limit/headers
npm run test:complete    # full end-to-end (jsdom + real UI + API)
npm run test:admin       # admin console: auth + dynamic table list
npm run test:admin:browse # admin console: browse/search/filter/sort/breakdown
npm run test:admin:sql   # admin console: read-only SQL mode
npm run test:admin:backup # admin console: encrypted backup export/view
```

Notes:

- The API suites need a running database (`npm run db:start` + `npm run db:migrate`).
- Schema is created **without seed data**; each suite creates and cleans up its own users.
- `test:db` asserts the `users` table is empty before running — a leftover account (e.g. your own `rudrasharma25262@gmail.com`) makes one check fail by design.
- `test:complete` has one known time-of-day dependency: the dashboard "task + event names" assertion assumes the 09:00 sample event is still in the future.

---

## 18. Admin console & CLI tools

A terminal-only admin console (`scripts/`) for inspecting the database directly — never part of the web app or the deployed site.

- **`scripts/admin-utils.js`** — shared helpers: hidden prompt queue (TTY + piped stdin), credential storage (`~/.config/life-organizer/admin.json`, mode `600`), `authenticate()`, DB connect + read-only enforcement, dynamic table/column introspection, `runBrowseQuery()` (whitelisted identifiers + 100% parameterized), `renderTable()`.
- **`scripts/admin-init.js`** — `npm run admin:init`: create the bcrypt-hashed (cost 12) admin username/password. Refuses to overwrite an existing account.
- **`scripts/admin.js`** — `npm run admin`: login → table list → per-table browser (paging/search/filter/sort/detail) → per-user breakdown → read-only SQL REPL. JSON modes (`--json`) for automation. The session runs with `SET default_transaction_read_only = on` unless `--allow-write`.
- **`scripts/admin-backup.js`** — `AES-256-GCM` backup format: gzip(JSON) encrypted with a scrypt-derived key; salt + IV + auth tag stored in the envelope; any wrong passphrase or tamper is rejected by the tag.
- **`scripts/admin-export.js`** — `npm run admin:export`: dumps all tables to an encrypted `.lzb` file.
- **`scripts/admin-view.js`** — `npm run admin:view <file>`: summary, `--table <name>`, `--json`.

Passphrases are prompted hidden, or via `--pass` / `ADMIN_BACKUP_PASS`. Credentials always require the admin login.

---

## 19. Security notes

- **SQL injection**: 100% parameterized queries (`$n` placeholders); dynamic `ORDER BY`/column names come from internal whitelists, never user input.
- **Passwords**: bcryptjs, cost 10, never returned by any endpoint (`safeUser` strips `password_hash`).
- **Sessions**: opaque 256-bit tokens; DB stores only `sha256(token)`; httpOnly + `Secure` in prod + `SameSite=Lax` cookies; sliding expiration; revocation on logout.
- **Ownership**: every query filters by `user_id = req.user.id`; `fetchOwned` ensures 404 (not 403) so record existence isn't leaked across users.
- **Brute force**: `authLimiter` (20/15 min) on `/api/auth/*`, `apiLimiter` (1000/15 min) elsewhere.
- **Headers**: helmet defaults; `x-powered-by` disabled; CORS strictly allow-listed with credentials.
- **Secrets**: never commit `.env`; in prod, secrets come from Netlify env vars (never in the repo or bundle).
- **Body size**: 1 MB JSON cap.
- **Admin console**: local-only CLI, never in the web app; credentials bcrypt-hashed (cost 12) in a mode-600 file; sessions run in a PostgreSQL read-only transaction by default; backups are AES-256-GCM encrypted with a scrypt-derived key.
