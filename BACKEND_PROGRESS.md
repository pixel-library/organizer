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
