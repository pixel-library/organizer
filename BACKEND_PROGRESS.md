# Backend Progress

## Phase 0 — COMPLETED (Inspection + Safe Checkpoint)

### Current architecture
- **Frontend-only SPA.** React 19 + Vite 8, plain JavaScript (`.jsx`, no TypeScript).
- **No router.** `react-router-dom` is installed but unused; navigation is state-driven via `currentView` in `src/App.jsx`.
- View-based shell: `Sidebar` + header + conditional page render in `App.jsx`. View title/create-action maps are hardcoded in `App.jsx` (`VIEW_TITLES`, `CREATE_LABELS`).
- Entry point: `src/main.jsx` mounts `<App />` into `#root` (`index.html`).
- Testing: `tests/functional.mjs` (JSDOM + Vite server, node test runner). Scripts: `dev`, `build`, `lint` (oxlint), `test`.

### Existing data storage
- **`localStorage` only.** No `sessionStorage`, no IndexedDB, no cookies for app data, no server storage.
- All state lives in the `useLifePlanner` hook (`src/hooks/useLifePlanner.js`) and is persisted to `localStorage` under the `life_planner_*` namespace (`STORAGE_KEYS`, lines 3–14).
- 10 collections: `tasks`, `history`, `goals`, `notes`, `habits`, `meals`, `calendarEvents`, `groceryList`, `customReminders`, `settings`.
- Write path: `persistAll()` (lines 269–282) saves every collection on each state change via `useEffect`.
- Read path: lazy `useState` initializers calling `loadFromStorage()` with per-collection `migrate*` helpers for schema normalization.
- Backup/restore: JSON export/import/replace/merge implemented in `exportData`/`importData`/`replaceAllData`/`mergeData`, driven by `ImportExportModal.jsx`.
- IDs are client-generated (`Date.now()` / `Date.now() + Math.random()`); no UUIDs.
- README (line 17) explicitly states: no backend, no account, and **no fake or sample data** — all collections start empty.

### Existing backend status
- **No backend exists.** No server directory, no API routes, no `fetch`/`axios` calls anywhere in `src/`, no auth, no database, no environment config.
- `vite.config.js` is minimal (react plugin only); `dist/` is a static build output.

### Features / screens identified
- Dashboard — `src/components/Dashboard.jsx`
- Calendar — `src/components/CalendarView.jsx` + `EventEditor.jsx`
- Tasks — `src/components/Tasks.jsx` + `TaskModal.jsx`
- Notes — `src/components/Notes.jsx` + `NoteEditor.jsx`
- Analytics — `src/components/Analytics.jsx`
- Goals — `src/components/Goals.jsx`
- Habits — `src/components/Habits.jsx`
- Meals — `src/components/Meals.jsx` + `MealEditor.jsx` + `GroceryList.jsx`
- Reminders — `src/components/Reminders.jsx` + `ReminderModal.jsx`
- History — `src/components/History.jsx`
- Quick add / command palette / search / undo toast / import-export — `QuickAdd.jsx`, `CommandPalette.jsx`, `SearchModal.jsx`, `UndoToast.jsx`, `ImportExportModal.jsx`
- Profile — **no dedicated page.** Static sidebar block (`Sidebar.jsx:64–71`, avatar "LP").
- Authentication — **none.**

### Key source files
| File | Role |
| --- | --- |
| `src/hooks/useLifePlanner.js` | All state, persistence, domain logic (add/update/delete/undo/history) |
| `src/App.jsx` | View routing, modals, reminders daemon, theme, orchestration |
| `src/main.jsx` | App entry |
| `tests/functional.mjs` | JSDOM functional test suite (asserts no sample content leaks) |
| `index.html` | Root HTML (Font Awesome + Plus Jakarta Sans CDN) |
| `package.json` | Scripts + deps |
| `vite.config.js` | Minimal Vite config |

### Storage search summary
- `localStorage` — only in `src/hooks/useLifePlanner.js` (get/set) and `tests/functional.mjs` (test harness).
- `sessionStorage` — none.
- `fetch` / `axios` / `/api/` / `XMLHttpRequest` — none in `src/`.
- Mock/demo/sample data — none in source; README and a test assert the app ships clean.
- Hardcoded sample content — none (defaults are empty arrays; `defaultSettings = { theme: "system" }`).
- `.kilo/` contains an agent-managed snapshot worktree (not part of the app source).

### Next phase
- Design backend integration (Phase 1), preserving current behavior.

---

## Phase 1 — COMPLETED (Backend Foundation)

### What was added
Express 5 API backend in `server/` with environment config, DB placeholder, middleware (CORS, security headers via helmet, request logger), centralized error handling, and a health endpoint. The frontend is untouched and still runs fully offline on `localStorage`.

### Backend structure
```
server/
  index.js             — entry point, boot + graceful shutdown (SIGINT/SIGTERM)
  app.js               — Express app assembly: helmet, cors, json, logger, routes, error handlers
  config.js            — environment config (dotenv): port, apiPrefix, CORS origins, DB placeholders
  db.js                — database placeholder (no driver yet; reports status to health)
  middleware/
    requestLogger.js   — dev request logging (method, url, status, duration)
    errorHandler.js    — 404 handler + centralized JSON error handler (AppError aware)
  routes/health.js     — GET /api/health
  utils/AppError.js    — error class with statusCode + details
```

### Environment
- `.env.example` created (PORT, NODE_ENV, API_PREFIX, CORS_ORIGINS, DATABASE_URL/DB_* placeholders).
- `.gitignore` updated to ignore `.env` / `.env.*` (keeps `.env.example`).
- No real `.env` committed; no secrets in the repo.

### Scripts
- `npm run server` — start API (default http://localhost:4000).
- `npm run server:dev` — start with auto-reload (`node --watch`).

### Endpoints
- `GET /` → `{ service: "life-organizer-api", status: "ok" }`
- `GET /api/health` → `{ status, service, uptime, timestamp, db: { configured, connected, provider } }`
- Unknown routes → JSON 404 via centralized handler.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) set by helmet; CORS restricted to configured origins (default `http://localhost:5173`).

### Database
- Placeholder only. `connectDatabase()` no-ops, health reports `configured: false, connected: false, provider: "none"`. A real driver + connection lifecycle is deferred to a later phase.

### Files changed (Phase 1)
| File | Action |
| --- | --- |
| `server/index.js` | added |
| `server/app.js` | added |
| `server/config.js` | added |
| `server/db.js` | added |
| `server/middleware/requestLogger.js` | added |
| `server/middleware/errorHandler.js` | added |
| `server/routes/health.js` | added |
| `server/utils/AppError.js` | added |
| `.env.example` | added |
| `.gitignore` | updated (ignore `.env`) |
| `package.json` | updated (deps: express, cors, helmet, dotenv; scripts: server, server:dev) |
| `README.md` | updated (backend section, tech stack, structure, roadmap) |
| `tests/functional.mjs` | fixed — `globalThis.navigator` setter is read-only on Node ≥ 21; now uses `Object.defineProperty` (pre-existing failure, unrelated to backend) |

### Tests run (Phase 1)
1. Backend starts — `node server/index.js` listens on :4000, DB placeholder initialized.
2. Health endpoint — `GET /api/health` returns 200 JSON with security headers; CORS preflight returns `Access-Control-Allow-Origin`; unknown route returns JSON 404.
3. Frontend still starts — `npm run dev` serves HTTP 200; `npm run build` succeeds.
4. No existing feature broken — `npm test` (jsdom functional suite): **ALL FUNCTIONAL TESTS PASSED** (after the Node 22 navigator compatibility fix above); `npm run lint` clean.

### Notes
- `vite.config.js` untouched (no dev proxy yet); frontend still has zero network calls.
- Dependencies added: `express@^5.2.1`, `cors@^2.8.6`, `helmet@^8.3.0`, `dotenv@^17.4.2`.

### Next phase
- Phase 2 (backend integration) not started — deferred pending instructions.

---

## Phase 2 — COMPLETED (Database Implementation)

### Database
- **PostgreSQL** (chosen — project had none). Driver: `pg`; migrations: `node-pg-migrate`; local dev server: `embedded-postgres` (real PostgreSQL 18.4 binaries, user-space, no root/system install; data dir `.pgdata/`, gitignored).
- The DB starts **empty — no seed/demo data**. Migration inserts schema only (verified: every table has 0 rows after migration).

### Schema (`server/db/migrations/20260814160000_init-schema.mjs`)
All tables in `public` schema; every user-owned table carries `user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | id (bigserial PK), name, email, password_hash, created_at, updated_at | UNIQUE on email + case-insensitive unique index on `lower(email)` |
| `tasks` | id, user_id, name, date, time, priority, reminder, completed, type, description, start_date, estimated_time, tags[], subtasks(jsonb), recurring, timestamps | CHECK priority IN (Red/Yellow/Green); idx (user_id), (user_id,date), (user_id,completed) |
| `notes` | id, user_id, title, content, category, pinned, archived, tags[], timestamps | idx (user_id), (user_id,archived) |
| `calendar_events` | id, user_id, title, start_date, end_date, start_time, end_time, all_day, category, location, description, reminder, recurrence, recurrence_end, custom_weekdays[], overrides(jsonb), timestamps | idx (user_id), (user_id,start_date) |
| `goals` | id, user_id, name, current, target, timestamps | idx (user_id) |
| `habits` | id, user_id, name, days boolean[7], history date[], created_at | idx (user_id) |
| `meals` | id, user_id, date, type, name, time, calories, protein, carbohydrates, fat, ingredients[], notes, status, day, breakfast/lunch/dinner/snack, timestamps | idx (user_id), (user_id,date) |
| `grocery_items` | id, user_id, name, category, quantity, note, completed, created_at | idx (user_id), (user_id,completed) |
| `custom_reminders` | id, user_id, title, date, time, note, type, completed, created_at | idx (user_id) |
| `activity_log` | id, user_id, name, status, timestamp, created_at | mirrors app History; idx (user_id), (user_id,created_at) |
| `settings` | user_id (PK, FK users), theme, updated_at | one row per user |

Design mapped 1:1 to the app's real collections in `src/hooks/useLifePlanner.js` (tasks, history→activity_log, goals, notes, habits, meals, calendarEvents→calendar_events, groceryList→grocery_items, customReminders→custom_reminders, settings).

### Migration system
- `node-pg-migrate` CLI, tracked in `pgmigrations` table. Up/down both defined; `db:rebuild` verified down→up cycle.
- Scripts: `db:start`, `db:migrate`, `db:down`, `db:rebuild`, `test:db`.

### Environment
- `.env.example` updated: `DATABASE_URL` + `DB_*` connection vars + embedded PG vars (`PG_DATA_DIR`, `PG_SUPERUSER`, `PG_SUPERUSER_PASSWORD`).
- Local `.env` created (gitignored) with dev defaults; **no secrets committed**.

### Runtime changes
- `server/db.js` — real `pg.Pool`; `connectDatabase()` performs `SELECT 1`, is failure-tolerant (server still boots if DB down); `getDatabaseStatus()` reports `provider: "postgres"`.
- `server/index.js` — log wording updated (placeholder → connected).
- `GET /api/health` now reports `db: { configured: true, connected: true, provider: "postgres" }`.

### Files changed (Phase 2)
| File | Action |
| --- | --- |
| `server/db/migrations/20260814160000_init-schema.mjs` | added (schema) |
| `server/db/embedded.js` | added (local PostgreSQL dev server) |
| `server/db.js` | rewritten (real pg pool) |
| `server/config.js` | updated (DATABASE_URL builder + embedded config) |
| `tests/db.test.mjs` | added (DB test suite) |
| `.env.example` | updated (DB vars) |
| `.gitignore` | updated (`.pgdata`) |
| `package.json` | updated (deps pg, node-pg-migrate, embedded-postgres; scripts db:*, test:db) |
| `README.md` | updated (database setup + stack + structure) |
| `.env` | created locally (gitignored, not committed) |

### Tests run (Phase 2)
1. **Database connection** — `node tests/db.test.mjs`: PASS (SELECT 1 through pool).
2. **Migration** — `npm run db:migrate` applied cleanly; `db:rebuild` (down+up) succeeded; migration recorded in `pgmigrations`.
3. **Table creation** — all 11 app tables present (users, tasks, notes, calendar_events, goals, habits, meals, grocery_items, custom_reminders, activity_log, settings).
4. **Foreign keys** — 10 FK checks passed: every user-owned table references `users`.
5. **Unique email constraint** — exact-case duplicate rejected (`23505`) and case-insensitive duplicate rejected via `lower(email)` unique index.
6. **FK enforcement** — orphan `user_id` insert rejected (`23503`); deleting a user cascades to owned rows.
7. **No seed data** — every table verified 0 rows.
8. **API** — `/api/health` returns `connected: true`; server boots with DB up; frontend unchanged: `npm test` all pass, lint clean, build succeeds.

### Notes
- `embedded-postgres` required a small fix in `server/db/embedded.js`: `CREATE ROLE ... PASSWORD` cannot use parameterized `$1` in PostgreSQL — password is inline with single-quote escaping.
- Only the schema layer changed; **no frontend files modified** in this phase.

### Next phase
- Phase 3 (backend integration) not started — deferred pending instructions.

---

## Phase 3 — User Authentication — COMPLETED

### Objective
Implement real authentication for the backend API: registration, login, logout, and a session-protected `/me` endpoint, using secure httpOnly cookies and server-side sessions.

### What was built
- **`server/db/migrations/20260814170000_add-sessions.mjs`** — new `sessions` table (`token_hash` unique, `user_id` FK → `users` with `ON DELETE CASCADE`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`) + indexes on `user_id` and `expires_at`.
- **`server/utils/sessions.js`** — session helpers: cryptographically random 64-char token (only its SHA-256 hash is stored in the DB), httpOnly cookie options (`Secure` in production, `SameSite=Lax`), `createSession`, `revokeSession`, `safeUser`.
- **`server/middleware/auth.js`** — `requireAuth` guard: resolves cookie → validates session hash (missing / revoked / expired → 401), attaches `req.user` + `req.session`, and applies **sliding expiration** (renews `expires_at` when near expiry or idle > 15 min).
- **`server/routes/auth.js`** — the four endpoints:
  - `POST /api/auth/register` — validates name/email/password (1–100 name, valid email, 8–72 password), rejects duplicate emails (case-insensitive, 409), bcrypt-hashes (cost 10), creates the user **and** an authenticated session (auto-login), returns 201 + safe user.
  - `POST /api/auth/login` — verifies credentials (timing-safe: bcrypt compare run even when user missing), creates session, returns 200 + safe user; wrong credentials → 401.
  - `POST /api/auth/logout` — revokes the server-side session and clears the cookie (204).
  - `GET /api/auth/me` — protected by `requireAuth`; returns only safe user info (`id, name, email, createdAt, updatedAt`). Never returns `password`, `password_hash`, or secrets.
- **`server/app.js`** — added `cookie-parser`, CORS `credentials: true`, and mounted the auth router at `/api/auth`.
- **`server/config.js` / `.env.example`** — `SESSION_TTL_MINUTES` (default 7 days).
- **`package.json`** — new deps `bcryptjs`, `cookie-parser`; new script `test:auth`.

### Security properties
- Passwords hashed with bcrypt (cost 10); only the hash is ever stored or compared.
- Session tokens are random 256-bit values; only their SHA-256 digest is persisted.
- Cookie is `httpOnly` (invisible to JS), `SameSite=Lax` (CSRF mitigation), `Secure` in production.
- Passwords never stored in `localStorage`, `sessionStorage`, or frontend JS (frontend untouched).
- `requireAuth` middleware guards protected endpoints; no DB schema for auth exposed.
- Logout invalidates the server-side session, so the cookie is dead even if replayed.

### Tests run (Phase 3)
1. **`node tests/auth.test.mjs`** — ALL AUTH TESTS PASSED: register (201 + httpOnly cookie, safe user, lowercased email), duplicate email → 409, invalid email/short password/empty name/empty payload → 400, login wrong password / unknown email → 401, login → 200 + cookie, `/me` returns safe user (`createdAt,email,id,name,updatedAt`) with no password fields, sliding session renewal extends `expires_at`, logout → 204 + cookie cleared + `/me` → 401, register-created session works, `/me` without cookie / with garbage cookie → 401, no leftover sessions after cleanup.
2. **`node tests/db.test.mjs`** — ALL DATABASE TESTS PASSED (now includes `sessions` table, its FK to `users`, and 0 seeded rows).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged).
4. **`npm run lint`** — clean. **`npm run build`** — succeeds.
5. **`npm run db:rebuild`** — full down + up migration cycle succeeds; DB tests still pass after rebuild.

### Notes
- Express 5's `clearCookie` preserves `maxAge` from the options used at set time; logout passes `maxAge: 0` so the browser actually expires the cookie immediately.
- Test users are created with unique timestamped emails and deleted (with their sessions) after the run — no fake or leftover accounts.
- No frontend files modified in this phase.

### Next phase
- Phase 4 — resource CRUD API (tasks, notes, calendar events, goals, habits, meals, grocery items, custom reminders, activity log) behind the auth middleware — not started.

---

## Phase 4 — User Profile — COMPLETED

### Objective
Connect the project's profile/account functionality to the authenticated user: read and update the profile via the API, with the user always resolved from the server-side session (never from a client-supplied `userId`), preserving the existing profile UI.

### What was built
- **`server/routes/profile.js`** — two authenticated endpoints (both behind `requireAuth`):
  - `GET /api/profile` — returns the profile of the authenticated user (`id`, `name`, `email`, `createdAt`, `updatedAt`); never returns `password`/`password_hash`.
  - `PUT /api/profile` — updates the authenticated user's `name` / `email` (partial updates supported). Identity is taken **only** from `req.user` (set by `requireAuth` from the session); any `userId`/`id` in the request body is ignored. Validation: name 1–100 chars, valid email; duplicate email (other account) → 409; no valid fields → 400.
- **`server/app.js`** — mounted the profile router at `/api/profile`.
- **`package.json`** — new script `test:profile`.

### Scope decision
The project's only existing profile/account UI is the static sidebar block (`Sidebar.jsx:64–71`, avatar "LP") — there is no dedicated profile page and no client-side profile data. The real profile fields are `users.name` and `users.email`. Per the instruction to implement *only* fields that exist, the profile API exposes exactly those two editable fields (plus identity metadata). The frontend was not modified or redesigned.

### Tests run (Phase 4)
1. **`node tests/profile.test.mjs`** — ALL PROFILE TESTS PASSED:
   - Register User A and User B (both 201).
   - `GET /api/profile` (A) → 200, correct name/email/id, no password fields.
   - `PUT /api/profile` (A) → 200, returns new name, preserves email.
   - Refresh: fresh `GET /api/profile` shows the updated name; row verified in the database.
   - User B isolation: B's `PUT` sending A's `userId`/`id` in the body updated **only B**; A's profile unchanged; B cannot claim A's email (409).
   - Validation: empty name, invalid email, empty body → 400; partial update keeps email.
   - `GET`/`PUT /api/profile` without login → 401.
   - Cleanup: no leftover test users or sessions.
2. **`node tests/auth.test.mjs`** — ALL AUTH TESTS PASSED (regression).
3. **`node tests/db.test.mjs`** — ALL DATABASE TESTS PASSED.
4. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged).
5. **`npm run lint`** — clean. **`npm run build`** — succeeds.

### Notes
- No schema changes were needed this phase (profile lives in the existing `users` table).
- No frontend files modified.

### Next phase
- Phase 5 — resource CRUD API (tasks, notes, calendar events, goals, habits, meals, grocery items, custom reminders, activity log) behind the auth middleware — not started.

---

## Phase 5 — Task Manager Backend Integration — COMPLETED

### Objective
Connect the existing task manager to the backend: a full authenticated task CRUD API that mirrors the frontend task model (create, edit, delete, complete, priority, due date, category, search, filters, sorting), with ownership always derived from the authenticated session.

### What was built
- **`server/routes/tasks.js`** — all six required endpoints, each behind `requireAuth`:
  - `GET /api/tasks` — list with server-side **search** (`?search=`, ILIKE across name/description/type/priority/reminder/tags), **filters** (`?status=pending|completed|overdue`, `?priority=`, `?type=`, `?from=`/`?to=` due-date range), and **sorting** (`?sort=dateAsc|dateDesc|priority|name|createdAt|updatedAt`, default `dateAsc`).
  - `POST /api/tasks` — creates a task with `user_id` set from the session (**never** from the request body).
  - `GET /api/tasks/:id` — single task, scoped to the owner (404 otherwise).
  - `PUT` / `PATCH /api/tasks/:id` — partial merge updates (supports toggling `completed`, editing any field); `updated_at` bumped.
  - `DELETE /api/tasks/:id` — 204 on success, 404 if not owned/missing.
- **Field mapping** mirrors the frontend `migrateTasks` model exactly: `date`↔`date`, `startDate`↔`start_date`, `estimatedTime`↔`estimated_time`, `tags` (text[]), `subtasks` (jsonb, stringified before binding), `priority` (Red/Yellow/Green validated), `type` (category), `recurring`, `reminder`, `completed`, `description`. Empty dates/times serialize as `""` (like the frontend) and store as NULL.
- **`server/middleware/errorHandler.js`** — added PostgreSQL error-code mapping so constraint/format errors surface as 4xx (23505→409; 23503/23502/23514/22P02/22P03/22007/22008→400) instead of 500.
- **`server/app.js`** — mounted the tasks router at `/api/tasks`.
- **`package.json`** — new script `test:tasks`.

### Security / ownership
- Every query enforces `user_id = authenticated_user_id`; ID operations verify ownership. A task that exists but belongs to another user returns 404 for read/edit/delete (no existence leak).
- The request body may contain `userId`/`id` — it is ignored; ownership comes only from the session.
- Responses never include `user_id`, `password_hash`, or secrets.

### Tests run (Phase 5)
1. **`node tests/tasks.test.mjs`** — ALL TASKS TESTS PASSED:
   - Create (201, full round-trip of all fields, `userId` in body ignored — DB row owned by session user).
   - Read (list + single), Edit (PATCH + PUT partial merge), Complete (`completed: true`), Delete (204, gone → 404, double-delete → 404).
   - Refresh persistence (fresh request), logout→login persistence (task survives session change).
   - Search (`?search=report` matches, no-match returns empty), filters (`status=completed/pending`, `priority`, `type`, date range in/out), invalid `status` → 400.
   - Validation: POST without `name` → 400, invalid `priority` → 400, invalid `date` → 400, empty PATCH body → 400, no login → 401.
   - User A/B isolation: B reading/editing/deleting A's task → 404; B's list excludes A's task; A's task intact afterwards.
   - Cleanup: no leftover tasks or test users.
2. **`node tests/auth.test.mjs`**, **`node tests/profile.test.mjs`**, **`node tests/db.test.mjs`** — ALL PASSED (regression).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged).
4. **`npm run lint`** — clean. **`npm run build`** — succeeds.

### Notes
- No schema changes needed — the Phase 2 `tasks` table already matches the frontend model.
- No fake tasks: all test tasks are created via the API and deleted (with their users) after the run.
- No frontend files modified.

### Next phase
- Phase 6 — remaining resource CRUD APIs (notes, calendar events, goals, habits, meals, grocery items, custom reminders, activity log) behind the auth middleware — not started.

---

## Phase 6 — Notes Backend Integration — COMPLETED

### Objective
Connect the existing Notes feature to the backend: authenticated note CRUD mirroring the frontend note model, with search/filters/sorting, ownership always derived from the session.

### What was built
- **`server/routes/notes.js`** — all six endpoints, each behind `requireAuth`:
  - `GET /api/notes` — list with **search** (`?search=` across title/content/tags, ILIKE), **filters** (`?category=`, `?archived=true|false`), and **sorting** (`?sort=updated|created|oldest|az|za`). Pinned notes sort first (matches the frontend). Default sort `updated`.
  - `POST /api/notes` — creates a note with `user_id` from the session (**never** from the body). A note has no required field (the app supports blank notes that are filled in later), so an empty payload creates a note with table defaults.
  - `GET /api/notes/:id` — single note, scoped to owner (404 otherwise).
  - `PUT` / `PATCH /api/notes/:id` — partial merge updates; `updated_at` bumped.
  - `DELETE /api/notes/:id` — 204 on success, 404 if not owned/missing.
- **Field mapping** mirrors the frontend `migrateNotes` model: `title`, `content`, `category`, `pinned`, `archived`, `tags` (text[]).
- **`server/app.js`** — mounted the notes router at `/api/notes`.
- **`package.json`** — new script `test:notes`.

### Security / ownership
- Every query enforces `user_id = authenticated_user_id`; ID operations verify ownership and return 404 for notes that exist but belong to another user.
- A `userId`/`id` in the request body is ignored; ownership comes only from the session.
- Responses never include `user_id`, `password_hash`, or secrets.

### Tests run (Phase 6)
1. **`node tests/notes.test.mjs`** — ALL NOTES TESTS PASSED:
   - Create (201, full field round-trip; `userId` in body ignored — DB row owned by session user), refresh (list shows it), persistence verified in DB.
   - Read (list + single), Edit (PATCH + PUT partial merge, category/pin/archive preserved), Delete (204, gone → 404).
   - Search across title/content/tags (match + no-match), filters (`category`, `archived=true`), sort (`az`).
   - Logout → login → notes still present.
   - Validation: non-string tags → 400, empty PATCH → 400, no login → 401.
   - User A/B isolation: B read/edit/delete on A's note → 404; B's list excludes A's note; A's note intact after B's attempts.
   - Cleanup: no leftover notes or test users.
2. **`node tests/tasks.test.mjs`**, **`node tests/auth.test.mjs`**, **`node tests/profile.test.mjs`**, **`node tests/db.test.mjs`** — ALL PASSED (regression).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged).
4. **`npm run lint`** — clean. **`npm run build`** — succeeds.

### Notes
- No schema changes — the Phase 2 `notes` table already matches the frontend model.
- No fake/demo/sample notes: all test notes are created via the API and deleted (with their users) after the run.
- No frontend files modified.

### Next phase
- Phase 7 — remaining resource CRUD APIs (calendar events, goals, habits, meals, grocery items, custom reminders, activity log) behind the auth middleware — not started.

---

## Phase 7 — Calendar Backend Integration — COMPLETED

### Objective
Connect the existing calendar to the backend: authenticated event CRUD using the actual fields the calendar already uses, with ownership always derived from the session.

### What was built
- **`server/routes/calendarEvents.js`** — event CRUD, each endpoint behind `requireAuth`:
  - `GET /api/calendarEvents` — list with optional **date-range filter** (`?from=`/`?to=` on `start`), sorted by `start_date` then `start_time`.
  - `POST /api/calendarEvents` — creates an event; `user_id` from the session (**never** from the body). `title` and `start` are required (matching the DB NOT NULL columns the calendar relies on).
  - `GET /api/calendarEvents/:id` — single event, scoped to owner (404 otherwise).
  - `PUT` / `PATCH /api/calendarEvents/:id` — partial merge updates; `updated_at` bumped.
  - `DELETE /api/calendarEvents/:id` — 204 on success, 404 if not owned/missing.
- **Field mapping** mirrors the frontend `migrateCalendarEvents` model exactly: `start`↔`start_date`, `end`↔`end_date`, `startTime`↔`start_time`, `endTime`↔`end_time`, `allDay`↔`all_day`, `recurrenceEnd`↔`recurrence_end`, `customWeekdays` (integer[] validated 0–6), `overrides` (jsonb, stringified + `::jsonb` cast), plus `title`, `category`, `location`, `description`, `reminder`, `recurrence`.
- **`server/app.js`** — mounted the router at `/api/calendarEvents`.
- **`package.json`** — new script `test:calendar`.

### Security / ownership
- Every query enforces `user_id = authenticated_user_id`; ID operations verify ownership and return 404 for events that exist but belong to another user.
- `userId`/`id` in the request body is ignored; ownership comes only from the session.
- Responses never include `user_id`, `password_hash`, or secrets.

### Tests run (Phase 7)
1. **`node tests/calendar.test.mjs`** — ALL CALENDAR TESTS PASSED:
   - Create (201, full field round-trip incl. `customWeekdays`/`overrides`; `userId` in body ignored — DB row owned by session user), refresh (event remains), persistence verified in DB.
   - Date-range query (`?from=`/`?to=`) includes/excludes correctly.
   - Edit (PATCH + PUT partial merge; preserves `overrides`/`category`), Delete (204, gone → 404).
   - Logout → login → events still present.
   - Validation: missing `title` → 400, missing `start` → 400, invalid date → 400, `customWeekdays` out of range → 400, non-object `overrides` → 400, empty PATCH → 400, no login → 401.
   - Full A/B isolation: B read/edit/delete on A's event → 404; B list excludes A's event; A list excludes B's own event; A's event intact after B's attempts.
   - Cleanup: no leftover events or test users.
2. **`node tests/notes.test.mjs`**, **`node tests/tasks.test.mjs`**, **`node tests/auth.test.mjs`**, **`node tests/profile.test.mjs`**, **`node tests/db.test.mjs`** — ALL PASSED (regression).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged).
4. **`npm run lint`** — clean. **`npm run build`** — succeeds.

### Notes
- No schema changes — the Phase 2 `calendar_events` table already matches the frontend model.
- No fake/default/demo events: all test events are created via the API and deleted (with their users) after the run.
- Calendar UI/behavior untouched; no frontend files modified.

### Next phase
- Phase 8 — dashboard + analytics (computed stats from real authenticated-user data) — completed next.

---

## Phase 8 — Dashboard + Analytics — COMPLETED

### Objective
Connect the existing Dashboard and Analytics to real database data: one authenticated endpoint that computes every metric the current `Dashboard.jsx` and `Analytics.jsx` already show — from the authenticated user's actual rows, never hardcoded.

### What was built
- **`server/utils/stats.js`** — pure computation module that mirrors the frontend math line-for-line:
  - `computeDashboard(tasks, events, meals, goals, notes, habits)` — today's tasks + completed today, overall completion rate, high-priority (Red, incomplete) + overdue tasks, goal progress (`sum(min(current,target))/sum(target)`), today's events, today's meals (`date === today` OR `day === today's weekday`) + completed today, this-week snapshot (tasks planned/completed/events/habit check-ins), note counts, and `isEmpty` (all six collections empty).
  - `computeAnalytics(tasks, events, habits)` — overall/weekly/monthly completion rates, overdue via `isTaskOverdue` (completed→skip, no date→skip, `date + time||23:59 < now`), events this month + upcoming, habit consistency/streaks via a port of `computeHabitStats` (history + current-week checked `days`, best-streak, elapsed-day completion rate from `created_at`), the last-14-days activity chart, `maxActivity`, and `hasData`.
- **`server/routes/stats.js`** — `GET /api/stats` behind `requireAuth`: loads the user's `tasks`, `calendar_events`, `meals`, `goals`, `notes`, `habits` in parallel (`user_id = authenticated_user_id`), computes both metric blocks, returns `{ dashboard, analytics }`. Any `userId` in a request is irrelevant (read-only endpoint); responses contain no secrets.
- **`server/app.js`** — mounted at `/api/stats`. **`package.json`** — new script `test:stats`.

### Empty-state behavior (no fake numbers)
- A brand-new user (or one with zero data across tasks/events/notes/habits/meals/goals) gets `dashboard.isEmpty: true` and `analytics.hasData: false` with every metric at `0` — matching the existing Dashboard/Analytics empty states. No invented percentages or counts.

### Tests run (Phase 8)
1. **`node tests/stats.test.mjs`** — ALL STATS TESTS PASSED:
   - New user → `dashboard.isEmpty: true`, `analytics.hasData: false`, all-zero metrics (no fake numbers).
   - Unauthenticated `GET /api/stats` → 401.
   - Created real data for User A (4 tasks via `/api/tasks` — 2 completed, 1 Red pending today, 1 Red overdue yesterday; an event + a note via their APIs; goal/meal/habit rows inserted for the same user — those collections have no CRUD endpoint yet). Dashboard then reported the real numbers (total 4, completed 2, 50% rate, high-priority 2, overdue 1, today 3/2, events 1, meals 2/1, goal progress 20%, week snapshot 2 completed / 1 event / 1 habit check-in); Analytics matched (50% overall, week/month rates, month+upcoming events 1, habit completions 1, best streak 1, 14-day chart today bar = 2 tasks + 1 habit + 1 event).
   - Deleted a task + the event via their APIs → stats updated live (total 3, completed 1, 33% rate, 0 events, 14-day chart updated).
   - A/B isolation: User B stayed fully empty while A had data; after B created one task, B showed only B's data (total 1) and A's totals were untouched.
   - Cleanup: no leftover test rows or users.
2. **`node tests/calendar.test.mjs`**, **`node tests/notes.test.mjs`**, **`node tests/tasks.test.mjs`**, **`node tests/profile.test.mjs`**, **`node tests/auth.test.mjs`**, **`node tests/db.test.mjs`** — ALL PASSED (regression).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED (frontend unchanged). **`npm run lint`** — clean. **`npm run build`** — succeeds.

### Notes
- No schema changes; stats are computed on demand from existing tables.
- The stats formulas are a direct port of the existing `Dashboard.jsx` / `Analytics.jsx` / `computeHabitStats` logic (including the Monday-start week window and the history-plus-current-week-days completion count), so the numbers match what the UI already computes.
- No frontend files modified; no UI redesign.

### Next phase
- Phase 9 — remaining resource CRUD APIs (goals, habits, meals, grocery items, custom reminders, activity log) behind the auth middleware — not started.

---

## Phase 9 — User Data Storage Migration — COMPLETED

### Objective
Move all persistent user data from `localStorage` into the PostgreSQL backend: full authenticated CRUD for the remaining collections (goals, habits, meals, grocery items, custom reminders, activity log), a one-time migration endpoint for existing `localStorage` data, and a frontend rewrite so the app is fully API-backed behind a login/register screen.

### What was built (backend)
- **`server/db/migrations/20260814180000_add-user-data-columns.mjs`** — `goals.unit TEXT`, `grocery_items.unit TEXT` (the only schema gaps vs. the frontend models). Applied via `npm run db:migrate`.
- **`server/routes/goals.js`**, **`habits.js`**, **`meals.js`**, **`groceryItems.js`**, **`customReminders.js`**, **`activityLog.js`** — full CRUD behind `requireAuth`, each mirroring the frontend model: fields mapped 1:1 (`startDate`/`startTime`/`endTime`, `estimatedTime`, `recurrenceEnd`, `customWeekdays` int[], `tags`/`history`/`days`/`ingredients` arrays, `overrides` jsonb), `user_id` always from the session (body `userId`/`id` ignored), cross-user access → 404, camelCase responses, `""` for empty dates/times, pg numerics → `Number()`, ids serialized as strings.
- **`server/routes/migrate.js`** — `POST /api/migrate` (transactional): accepts `{ tasks?, notes?, calendarEvents?, goals?, habits?, meals?, groceryItems?, customReminders?, activityLog? }`, maps legacy field names, inserts everything for the authenticated user, returns `{ counts }`.
- **`server/app.js`** — all six routers mounted at `/api/{goals,habits,meals,groceryItems,customReminders,activityLog}` + `/api/migrate`.
- **`package.json`** — new script `test:collections`.

### What was built (frontend)
- **`src/api.js`** — API client (base from `globalThis.__LIFE_ORGANIZER_API__` → `VITE_API_URL` → `/api`), `credentials: "include"`, `ApiError` with status.
- **`src/components/AuthScreen.jsx`** — login/register screen (name/email/password, validation, busy state).
- **`src/hooks/useLifePlanner.js`** — rewritten to be API-backed: auth state machine (`loading` → `unauthenticated`/`ready`), `login`/`register`/`logout`, `/auth/me` boot check, one-time `migrateLocalStorage()`, optimistic mutations with server reconciliation (`temp-` ids, reload-on-error, 401 → logout), a `COLLECTIONS` table mapping app names → REST paths/migrate names (`history`→`/activityLog`, `groceryList`→`/groceryItems`), and a `sanitizeEvent()` guard for `customWeekdays`/`recurrenceEnd` nulls. All pure helpers and the full return surface are preserved (`DAY_NAMES`, `habitCompletionDates`, `computeHabitStats`, `dateKeyFrom`, `exportData`/`importData`/`replaceAllData`/`mergeData`, undo, etc.). `settings` remains in `localStorage`; user-data keys are cleared after a successful migrate.
- **`src/App.jsx`** — auth gating (loading → AuthScreen → app), Sidebar receives `user` + `onLogout`.
- **`src/components/Sidebar.jsx`** — real name/email, initials avatar, sign-out (confirm).
- **`vite.config.js`** — `/api` dev proxy → `http://localhost:4000`.

### Tests run (Phase 9)
1. **`node tests/collections.test.mjs`** — ALL COLLECTIONS TESTS PASSED: full CRUD per collection (goals incl. `unit`, habits incl. `days`/`history`, meals incl. day default, grocery items incl. `unit`, custom reminders incl. type case-insensitivity, activity log); validation 400s; deletes; cross-user isolation (404s); `/api/migrate` counts + cleanup; refresh and logout/login persistence; no leftover rows.
2. **`node tests/functional.mjs`** — ALL FUNCTIONAL TESTS PASSED (rewritten as a full integration test): real backend + cookie-jar fetch + `__LIFE_ORGANIZER_API__`; register via the AuthScreen UI; empty states + "no fake data" across all views; data-layer create/complete/delete/undo with backend persistence checks; export/import/merge/replace; theme persists to `localStorage` settings only; refresh (fresh component) and logout/login persistence; DOM-structure validation; no leftover rows.
3. **`npm run test:db`**, **`test:auth`**, **`test:profile`**, **`test:tasks`**, **`test:notes`**, **`test:calendar`**, **`test:stats`** — ALL PASSED (regression).
4. **`npm run lint`** — clean (0 warnings). **`npm run build`** — succeeds.

### Notes
- Frontend mutations compare ids with `String(id)` everywhere (server ids are strings).
- `replaceAllData` now returns its promise (awaitable), and `setters`/`UNDO_SPECS` are memoized — lint-clean without disabling rules.
- The functional suite was extended with a cookie-jar `fetch` wrapper (Node fetch has no cookie jar) and waits for the boot `loadAllCollections` to settle before mutating.
- No seed/demo data anywhere; test users/rows are created via the API and removed after each run.

### Next phase
- Phase 10 — security + multi-user isolation audit — not started.

---

## Phase 10 — Security + Multi-User Isolation Audit — COMPLETED

### Objective
Audit and harden the backend's security posture (auth, cookies, CORS, headers, input validation, rate limiting, env/secrets handling, hardcoded credentials) and prove multi-user isolation with a dedicated User A / User B test.

### Audit findings (already solid — verified, no changes needed)
- **Passwords**: `bcrypt.hash(password, 10)` on register; login runs `bcrypt.compare` even for unknown emails (timing-safe); DB stores only a `$2` bcrypt hash — never plaintext.
- **Sessions**: 32 random bytes per token, only the SHA-256 hash stored (`sessions.token_hash`); cookie is `httpOnly`, `secure: config.env === "production"`, `sameSite: "lax"`, `maxAge` from `SESSION_TTL_MINUTES`.
- **Headers / CORS**: `helmet()` active; `x-powered-by` disabled; CORS restricted to `config.corsOrigins` with `credentials: true`.
- **Injection / validation**: every query is parameterized; dynamic columns and sort keys come only from whitelist constants (`FIELDS`, `SORT`); per-route field validators (names, emails, dates, arrays, enums).
- **Ownership**: `user_id` is always taken from the authenticated session (`req.user.id`); body `userId`/`id` are ignored; cross-user access returns 404. Verified in tasks, notes, calendarEvents, meals, groceryItems, activityLog, goals, habits, customReminders, migrate, profile, stats.
- **Error handling**: stack traces only in dev; known PG errors mapped to 400s; `safeUser` never exposes `password_hash`.
- **Secrets / env**: `.env` and `.env.*` gitignored (only `.env.example` tracked); no secrets in any `/api/*` response (health reports only configured/connected/provider); session tokens never sent back in JSON.

### What was added/fixed
- **`server/middleware/rateLimit.js`** — `express-rate-limit` (new dependency `^8.6.2`): a strict limiter on `/api/auth/*` (default 20 req / 15 min per IP) and a general API limiter (default 1000 req / 15 min per IP), both with `standardHeaders` and JSON error bodies. Limits overridable via `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_API_MAX`.
- **`server/app.js`** — mounted `apiLimiter` globally, `authLimiter` on the auth router, and raised the JSON body limit to `1mb` (so `/api/migrate` can import large local datasets).
- **`server/config.js`** — production guard: with `NODE_ENV=production` the server refuses to start unless `DATABASE_URL` (or `DB_USER` + `DB_PASSWORD`) **and** `CORS_ORIGINS` are set, eliminating predictable dev-default credentials (`life_organizer`/`life_organizer`, embedded `postgres`/`postgres`) in production. `isProd` exposed.
- **`.env.example`** — documented `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_API_MAX` and flagged `CORS_ORIGINS` as required in production.
- **`tests/security.test.mjs`** (+ `package.json` script `test:security`) — full A/B isolation + security suite.

### What the security test covers
- **Complete isolation**: dev-only users A and B each create a Task, Note, and Calendar Event; A's lists contain only A's rows and B's lists only B's (name/id checks both directions). A read/edit/delete of B's task, note, and event all → **404** (9 checks), and B vs A likewise (9 checks); both users' data verified intact afterward.
- **Session-only ownership**: task created with a spoofed body `userId`/`id` is owned by the creator (B gets 404); `POST /api/migrate` with a spoofed `userId` lands only under the caller (B's list unchanged).
- **Stats / activity-log isolation**: `/api/stats` totals reflect only the requesting user's rows; activity log entries never leak across users.
- **Secrets never leaked**: register/login/`/auth/me` responses contain no `password`/`password_hash`/`token`/`secret`; `/auth/me` exposes exactly `id,name,email,createdAt,updatedAt`; DB stores a bcrypt hash (never plaintext); `/api/health` contains no DB credentials or connection string.
- **Rate limiting**: exhausting the auth limiter on a real `authRouter` returns **429** and standard `RateLimit-*` headers.
- **Cleanup**: temp `sec-a-%@test.dev` / `sec-b-%@test.dev` users deleted; verified no leftovers.

### Tests run (Phase 10)
1. **`node tests/security.test.mjs`** — ALL SECURITY TESTS PASSED (isolation 18 404s, spoofed ownership, stats/log isolation, secret-leak checks, bcrypt-hash check, 429 burst, cleanup).
2. **`node tests/db.test.mjs`**, **`test:auth`**, **`test:profile`**, **`test:tasks`**, **`test:notes`**, **`test:calendar`**, **`test:stats`**, **`test:collections`** — ALL PASSED (regression).
3. **`npm test`** — ALL FUNCTIONAL TESTS PASSED. **`npm run lint`** — clean (0 warnings). **`npm run build`** — succeeds.
4. Verified `.env` is gitignored and not tracked; production guard rejects missing `DATABASE_URL`/`CORS_ORIGINS` and accepts explicit production env vars.

### Notes
- Rate-limit counters are in-memory per process (fine for a single-instance app); a shared store would be needed behind multiple instances.
- No seed/demo data anywhere; the A/B test users are created via the API and removed after the run.

### Next phase
- Phase 11 — not started.