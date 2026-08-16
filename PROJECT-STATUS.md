# Life Organizer — Project Status & Resume Guide

> Handoff document. Read this file first when resuming work.
> Last updated: 2026-08-16 (post-upgrade session)

---

## 1. What This Project Is

Full-stack personal life-organizer app:
- **Frontend**: React 19 + Vite (SPA), plain CSS, Font Awesome (self-hosted), Plus Jakarta Sans (self-hosted), PWA via vite-plugin-pwa (Workbox)
- **Backend**: Express 5 (ESM), session cookies (`life_organizer_sid`, httpOnly, sameSite=lax), bcryptjs, express-rate-limit
- **DB**: PostgreSQL via embedded postgres on `postgres://life_organizer:life_organizer@localhost:5432/life_organizer`, migrations via `node-pg-migrate` (`server/db/migrations/`)
- **Tests**: plain Node test scripts (no framework). `tests/functional.mjs` = full-browser test (Vite SSR + jsdom + real backend via `globalThis.__LIFE_ORGANIZER_API__`). Other `tests/*.test.mjs` = real server on ephemeral port + real DB.

## 2. Overall Goal (from user)

Upgrade the app to "top max level":
1. Web-based admin panel ✅
2. PWA + offline + notifications ✅
3. New frontend features ✅ (Settings view, recurring tasks, polish)
4. Backend hardening ✅ (username lockout, admin rate limit, restore fixes)
5. UI/UX overhaul (ongoing polish)

**Mid-request pivot (IMPORTANT — user instruction):** Replace email identity with a unique **username**. Users only register/login with the username they create. No email is collected anymore. Different people have different usernames; no two users may share the exact same username (case-insensitive uniqueness).

**API base via .env (user instruction):** The frontend must not hardcode the API URL — `src/api.js` resolves `globalThis.__LIFE_ORGANIZER_API__` → `import.meta.env.VITE_API_URL` → `/api`. `VITE_API_URL`/`VITE_PROXY_TARGET` are documented in `.env.example` and set in `.env`.

## 3. Current State (all of this is DONE + VERIFIED)

### Username refactor (verified)
- Migrations applied: `20260816200000_add-user-role.mjs` (`users.role`), `20260816210000_add-username.mjs` (`username`, drops `email` NOT NULL, case-insensitive unique index). Email column remains nullable + unique but the app never writes it.
- Username rules `/^[a-z0-9][a-z0-9_-]{2,29}$/i`; uniqueness + login case-insensitive.
- `POST /auth/register` `{name,username,password}`, `POST /auth/login` `{username,password}`, plus new `change-password`, `revoke-sessions`, `DELETE /account`.

### Backend hardening (new this session)
- **Per-username login lockout** (`server/routes/auth.js`): after `LOGIN_MAX_FAILS` (default 10) failed logins for a username it is locked `LOGIN_LOCK_MINUTES` (default 15) — even with the correct password. In-memory Map with `lastFail`/`lockedUntil`; `pruneLoginFailures` only prunes entries that are unlocked AND stale. Login uses a dummy bcrypt compare (`DUMMY_HASH`) for unknown usernames to equalize timing. Env: `LOGIN_MAX_FAILS`, `LOGIN_LOCK_MINUTES`.
- **Admin rate limiter** (`server/middleware/rateLimit.js` → `adminLimiter`, mounted on `/api/admin` in `server/app.js`): `RATE_LIMIT_ADMIN_MAX` (default 300/15min).
- **Restore fixes** (`server/routes/admin.js`): wrong passphrase / bad JSON now returns 400 (was 500); array columns (`tags text[]`, `ingredients text[]`) restored correctly — `insertTableRows` takes a `column→udt_name` map (`tableColumnTypes`) and binds JS arrays as-is (pg serializes them to PG array literals) instead of `JSON.stringify` → `"[]"`. `udt_name` starts with `_` for array types.
- Existing hardening intact: helmet, CORS allowlist, `originCheck` CSRF, json limit 5mb, `trust proxy` in prod, cookie `secure` in prod, errorHandler strips stacks in prod.

### PWA (done, verified via build)
- `vite.config.js`: `VitePWA` (autoUpdate, manifest `#910029`, icons, `workbox.navigateFallbackDenylist: [/^\/api\//]`). `npm run build` produces `dist/sw.js` + `manifest.webmanifest` (40 precache entries).
- `index.html`: manifest link, theme-color, apple-touch-icon, self-hosted `/vendor/fa-all.css` + `/vendor/jakarta.css`.
- `src/main.jsx`: `registerSW({ immediate: true })` guarded by `'serviceWorker' in navigator`.
- `src/components/OfflineBanner.jsx`, `src/components/InstallButton.jsx` (beforeinstallprompt/appinstalled); `Sidebar.jsx` shows InstallButton.
- `src/App.jsx` reminder poller fires browser `Notification` when a reminder is due (guarded `typeof Notification !== "undefined"`, permission requested after auth).

### Admin panel UI (done)
- `src/components/AdminPanel.jsx`: tabs Overview / Users / Sessions / Activity / Data / Backup. Users search/sort/promote/demote/delete (self-protected), session revoke, activity search, data browser (filter `col=value`/`col~text`, sort, paging), encrypted `.lzb` backup + JSON export + restore (file or pasted JSON). Header "Backup" button dispatches `admin-open-backup` event → AdminPanel listens → opens Backup tab.
- Wired in `src/App.jsx` (`currentView === "admin" && user?.role === "admin"`), `Sidebar.jsx` (nav item only for admins).

### Settings view (done)
- `src/components/SettingsView.jsx`: profile card, theme select (wired to `settings` state), notification permission, change-password form, sign-out-other-devices, export/import (reuses ImportExportModal), danger zone (type "delete" to delete account → then logout). Nav item in Sidebar.

### Recurring tasks (done)
- `TaskModal.jsx` recurrence select (none/daily/weekly/monthly) already existed and is persisted.
- NEW: completing a recurring task in `useLifePlanner.js` `toggleTaskCompletion` rolls it to the next occurrence (`nextOccurrenceDate` helper — daily/weekly/monthly with month-end clamping) and keeps it incomplete; PATCHes `{completed:false, date}`. `Tasks.jsx` shows a repeat badge.

### Admin API test suite (done)
- `tests/admin-api.test.mjs` + `package.json` script `test:admin:api` — ALL GREEN. Covers stats, users (search/sort/page/promote/demote/delete, self-guards), sessions (revoke + 404 re-revoke), activity, data browser, export, backup (encrypted envelope, no plaintext), restore (JSON + encrypted round-trip, wrong passphrase → 400).

### All test suites green (verified this session)
`npm run lint` ✅ clean · `npm test` ✅ ALL FUNCTIONAL · `test:complete` ✅ · `test:db` ✅ · `test:auth` ✅ · `test:security` ✅ (incl. per-username lockout 429) · `test:profile` ✅ · `test:tasks` ✅ · `test:notes` ✅ · `test:calendar` ✅ · `test:collections` ✅ · `test:stats` ✅ · `test:admin` ✅ · `test:admin:browse` ✅ · `test:admin:sql` ✅ · `test:admin:backup` ✅ · `test:admin:api` ✅ · `npm run build` ✅.

### Flakes fixed
- `tests/complete.test.mjs` + `tests/functional.mjs`: hardcoded `2026-08-*` dates → dynamic `fmtDate(new Date())`.
- `tests/functional.mjs`: auth-gate race (waitFor auth screen before toggling "Create one"); habit-toggle flake (wait for real server id before toggling so the `addHabit` POST response can't clobber local history); new recurring-rollover test (with cleanup so merge-count assertions stay deterministic).
- `tests/complete.test.mjs`: 401 `GET /customReminders` race — collection loads landing after logout cookie clear; fixed with `sleep(400)` before logout.

## 4. Remaining / Optional Work

- **SW push notifications** (README roadmap): background reminder notifications while the app is closed (needs push subscription + backend). Not implemented.
- **UI/UX polish**: further styling pass (user mentioned possibly using "Stitch" in an Antigravity MCP server — it is NOT configured in opencode yet; if added, it can drive the polish).
- Any further features the user requests.

## 5. How to Run / Verify

```bash
npm run db:start            # embedded postgres (if not running)
npm run db:migrate          # migrations (already applied)
npm run lint                # oxlint — must be clean
npm test                    # functional browser suite
npm run test:complete       # full end-to-end UI suite
npm run test:auth && npm run test:security && npm run test:profile
npm run test:tasks && npm run test:notes && npm run test:calendar
npm run test:collections && npm run test:stats
npm run test:admin && npm run test:admin:browse && npm run test:admin:sql
npm run test:admin:backup && npm run test:admin:api
npm run build               # production build (PWA)
npm run dev                 # app on :5173 (proxies /api → :4000)
```

**Creating an admin user (for the web Admin Panel / admin API tests):**
```bash
# register via API or UI, then:
node scripts/promote-admin.mjs <username>     # promotes
node scripts/promote-admin.mjs <username> --demote
node scripts/promote-admin.mjs --list
```

**Dev DB connection**: `postgres://life_organizer:life_organizer@localhost:5432/life_organizer` (embedded postgres; `npm run db:start`/`db:stop`).

## 6. Key Files Map

| Area | Files |
|---|---|
| Migrations | `server/db/migrations/20260816200000_add-user-role.mjs`, `20260816210000_add-username.mjs` |
| Auth + hardening | `server/routes/auth.js` (username, lockout, change-password, revoke, delete) |
| Rate limiting | `server/middleware/rateLimit.js` (`authLimiter`/`apiLimiter`/`adminLimiter`), mounted in `server/app.js` |
| Admin API | `server/routes/admin.js`, `server/middleware/adminAuth.js`, `server/utils/backup.js` |
| Other hardening | `server/middleware/requestContext.js`, `originCheck.js`, `errorHandler.js`, `server/app.js`, `server/index.js` |
| Frontend new views | `src/components/AdminPanel.jsx`, `SettingsView.jsx`, `OfflineBanner.jsx`, `InstallButton.jsx` |
| PWA | `vite.config.js`, `index.html`, `src/main.jsx`, `public/icons/*.png`, `public/vendor/*.css`, `public/fonts`, `public/webfonts` |
| Recurring tasks | `src/hooks/useLifePlanner.js` (`nextOccurrenceDate`, `toggleTaskCompletion`), `src/components/Tasks.jsx` (badge), `TaskModal.jsx` |
| API base env | `src/api.js`, `.env`, `.env.example` (`VITE_API_URL`, `VITE_PROXY_TARGET`) |
| Tests | `tests/*.test.mjs`, `tests/functional.mjs`, `tests/admin-api.test.mjs` |

## 7. Immediate Next Steps (if resuming)

1. Ask the user what's next (all planned upgrade work is done + verified).
2. Optional: hook up the Antigravity MCP "Stitch" tool (add its server command to `~/.config/opencode/opencode.jsonc`) and use it for the UI/UX polish pass.
3. Optional: SW push notifications (README roadmap item).

## 8. Gotchas / Notes for Resume

- **Migration rerun pitfall**: if you edit `20260816210000_add-username.mjs` again after it's applied, you must delete its `pgmigrations` row AND manually run its `down` before re-running `db:migrate`.
- **Rate limiter**: custom `keyGenerator` must NOT be reintroduced — express-rate-limit v8 throws `ERR_ERL_KEY_GEN_IPV6` on IPv6 loopback. Default keyGenerator respects `trust proxy`.
- **Origin check** (`originCheck.js`): all POST/PUT/PATCH/DELETE need matching `Origin`/`Sec-Fetch-Site`; tests fetch same-origin so they pass; a manually crafted `fetch` without Origin header will 403.
- **Per-username lockout is in-memory (per process)** — restarting the server clears locks. Env-tunable; the security suite proves 429 after 10 fails.
- **Restore/backup**: `insertTableRows` needs `udt_name` (array types start with `_`); plain `data_type` is `ARRAY` for arrays. Wrong passphrase/bad JSON → 400 (not 500).
- **Test cleanup pattern**: users deleted by `username LIKE 'prefix-%'`, NOT email.
- **DB may be wiped** — admin tests that assume an existing admin user will fail until one is created+promoted.
- **Email column**: keep nullable + unique index; app must never write it (only legacy/test SQL does).
- User is NOT to be bothered mid-task; user will explicitly say "read the .md and start work" to resume.
