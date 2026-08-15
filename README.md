<div align="center">

# Life Planner OS

**Your personal productivity workspace** — plan tasks, track habits, schedule meals, and manage your entire day from one dashboard.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Live demo](https://img.shields.io/badge/Live%20demo-life-organizer--824.netlify.app-brightgreen)

</div>

---

## Live demo

Deployed and running at **https://life-organizer-824.netlify.app** — create an account to try it out.

---

## About

Life Planner OS is a full-stack, account-based workspace that brings everything you need to stay on top of your life together in one clean, dark-themed interface — tasks, calendar events, habits, meals, notes, goals, reminders, and analytics.

All user data is stored securely in **PostgreSQL** behind an **Express API**, protected by **session authentication** and strict per-user ownership. The app ships with **no fake or sample data** — you start from a clean workspace and everything you create is genuinely yours, synced to your account across sessions and devices.

## Features

### Dashboard
- Live statistics: today's task count, project progress, high-priority items, and overall completion rate
- Chronological project timeline with priority-coded dots
- Today's agenda merging events, meals, and tasks into one view
- Weekly snapshot, recent notes preview, and a built-in focus audio player

### Task Calendar
- Day, week, month, year, and agenda views
- Recurring events (daily, weekly, monthly, yearly, custom weekdays)
- Per-occurrence overrides — edit, move, resize, or delete a single instance or the whole series
- Drag-to-create events, color-coded categories, meals and habits overlaid on the grid
- Sidebar analytics: efficiency, priority distribution, workload, and 7-day activity

### Task Management
- List and kanban board views with search, filters (status / priority / type), and sorting
- Priority levels (High / Medium / Low) with overdue detection
- Subtasks with progress, tags, descriptions, and estimated time
- Bulk complete, bulk delete, select-all, and CSV export
- In-app reminders fired at the exact time, or 10/30/60 minutes before

### Habit Tracker
- Weekly check-in grid with current and best streaks and completion rate
- Add and remove habits on the fly

### Meal Planner
- Plan breakfast, lunch, dinner, and snacks per day across a full week
- Track calories and macros per meal; mark meals planned, completed, or skipped
- Auto-generated grocery list (from meal ingredients or manual) with categories and clear-purchased

### Notes
- Organize notes into categories (Personal, Work, Study, Ideas, Important)
- Tag notes and filter/search across titles, content, and tags
- Pin important notes and archive the rest — restore them anytime
- Schedule any note straight onto your calendar

### Goals
- Track progress toward real targets with an overall progress overview
- Increment/decrement progress and mark achievements

### Reminders
- Everything scheduled to remind you in one place — task alerts, event alerts, and custom reminders
- Toggle reminders complete or delete them, with browser notification polling

### Analytics
- Task completion rate, overdue load, habit consistency, and best streak
- Weekly and monthly breakdowns plus a 14-day activity chart

### History
- Activity log of every action you take — created, completed, updated, deleted
- Remove individual entries or clear the whole archive

### Power User Tools
- **Command palette** (Ctrl/Cmd + K) for instant navigation and creation
- **Global search** (Ctrl/Cmd + S) across tasks, events, notes, habits, meals, and history
- **Quick Add** menu for one-click creation from anywhere
- **Undo toast** after any deletion (8-second window)
- **Import / Export** data as a JSON backup — merge with existing data or replace everything
- **Themes**: dark, light, and system-following with a one-click cycle

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React 19](https://react.dev/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Styling | Custom CSS with a `data-theme` dark/light system |
| Icons | [Font Awesome 6](https://fontawesome.com/) |
| Typography | [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) |
| Linting | [oxlint](https://oxc.rs/) |
| Testing | [jsdom](https://github.com/jsdom/jsdom) + Vite SSR + Node test runner |
| API | [Express 5](https://expressjs.com/) + [helmet](https://helmetjs.github.io/) + [cors](https://github.com/expressjs/cors) + [cookie-parser](https://github.com/expressjs/cookie-parser) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) + [embedded-postgres](https://github.com/leinelissen/embedded-postgres) (dev) |

## Getting Started

### Installation

```bash
git clone https://github.com/pixel-library/organizer.git
cd organizer
npm install
```

### Environment setup

```bash
cp .env.example .env
```

The defaults are fine for local development (embedded PostgreSQL, API on `http://localhost:4000`, app origin `http://localhost:5173`). In **production** the server refuses to start unless `DATABASE_URL` (or `DB_USER` + `DB_PASSWORD`) **and** `CORS_ORIGINS` are set. All settings are documented in `.env.example`.

### Database setup

```bash
npm run db:start     # boot the local PostgreSQL server (data dir: .pgdata/)
npm run db:migrate   # apply schema migrations
```

`db:start` runs a real PostgreSQL server in user-space via `embedded-postgres` — no install or root needed. Alternatively, set `DATABASE_URL` to any existing PostgreSQL instance and skip `db:start`.

### Start the app

```bash
npm run server       # API on http://localhost:4000
npm run dev          # app on http://localhost:5173 (proxies /api → :4000)
```

Open `http://localhost:5173` in your browser.

## Authentication

The app is **account-based**: on first load you create an account (name, email, password) or sign in. Passwords are hashed with **bcrypt** server-side and never stored or transmitted in plaintext. Sessions use secure, **httpOnly** cookies backed by a server-side `sessions` table with sliding expiration.

The authenticated user is always resolved from the session cookie — a `userId` supplied by the client is never trusted, and every collection query enforces `user_id = <session user>`. Password hashes, session tokens, and secrets are never returned by the API and never stored in the frontend.

## Backend API

The API is RESTful under `/api`. Every collection route requires authentication and scopes all reads/writes to the session user (cross-user access returns 404).

```
GET  /api/health                  # service + database status
POST /api/auth/register           # create account → session cookie
POST /api/auth/login              # verify credentials → session cookie
POST /api/auth/logout             # invalidate session + clear cookie
GET  /api/auth/me                 # current user
GET/PUT /api/profile              # read / update profile (name, email)

GET/POST /api/tasks               # tasks — search/filters/sorting
GET/PUT/PATCH/DELETE /api/tasks/:id
GET/POST /api/notes               # notes — search/filters/sorting
GET/PUT/PATCH/DELETE /api/notes/:id
GET/POST /api/calendarEvents      # events — optional ?from=&to= range
GET/PUT/PATCH/DELETE /api/calendarEvents/:id
GET/POST /api/goals               # goals
GET/PUT/PATCH/DELETE /api/goals/:id
GET/POST /api/habits              # habits
GET/PUT/PATCH/DELETE /api/habits/:id
GET/POST /api/meals               # meals
GET/PUT/PATCH/DELETE /api/meals/:id
GET/POST /api/groceryItems        # grocery list
GET/PUT/PATCH/DELETE /api/groceryItems/:id
GET/POST /api/customReminders     # custom reminders
GET/PUT/PATCH/DELETE /api/customReminders/:id
GET/POST /api/activityLog         # activity log
DELETE /api/activityLog/:id
GET  /api/stats                   # dashboard + analytics metrics
POST /api/migrate                 # one-time localStorage → database import
```

Notes:

- **Tasks** support `?search=` (title/description), `?status=pending|completed|overdue`, `?priority=`, `?type=`, `?from=`/`?to=` date range, and `?sort=dateAsc|dateDesc|priority|name|createdAt|updatedAt`.
- **Notes** support `?search=` (title/content/tags), `?category=`, `?archived=true|false`, and `?sort=updated|created|oldest|az|za` (pinned first).
- **Events** use `title`, `start`/`end`, `startTime`/`endTime`, `allDay`, `category`, `location`, `description`, `reminder`, `recurrence`, `recurrenceEnd`, `customWeekdays`, and `overrides`. `title` and `start` are required on create.
- **GET /api/stats** computes live dashboard + analytics metrics from real user data only — a new account gets an empty state (`dashboard.isEmpty: true`), never fabricated figures.
- **POST /api/migrate** imports legacy `localStorage` data in one transaction, mapping old field names to the database schema, and clears the local keys afterwards.

## Admin Console

A terminal-only admin console for inspecting the database directly. It is **never** part of the web app or the deployed site — you run it locally, and it speaks straight to PostgreSQL (your `DATABASE_URL`, or the local dev DB).

```bash
npm run admin:init     # one-time: create your admin username + password (stored bcrypt-hashed)
npm run admin          # open the console
```

The admin credentials are kept at `~/.config/life-organizer/admin.json` (file mode `600`, bcrypt-hashed, never in the repo or on the web). On every launch the console asks for your admin username + password, and the whole session runs inside a **read-only transaction** unless you pass `--allow-write`.

From the console menu you can:

- Browse any table with **paging, search, filters, sorting, and full-row detail** — `s groceries`, `f priority=Red`, `o created_at desc`, `d 3`, `x` to clear
- Open a **per-user breakdown** (`b`) — every user's row counts across all data tables
- Drop into a **read-only SQL REPL** (`s` or `npm run admin:sql`) — writes are blocked by PostgreSQL itself

For automation, the same features run as JSON commands:

```bash
npm run admin -- --json --table tasks --search groceries
npm run admin -- --json --table tasks --filter priority=Red --sort created_at --sort-dir desc
npm run admin -- --json --breakdown
npm run admin -- --json --sql-query "SELECT name, email FROM users"
```

**Encrypted backups** (`AES-256-GCM`, key derived via scrypt from your passphrase; the backup is gzipped and the file contains no plaintext):

```bash
npm run admin:export            # dump all tables → backup-<timestamp>.lzb
npm run admin:view backup.lzb   # summary of tables + row counts
npm run admin:view backup.lzb -- --table users        # see a table's rows
npm run admin:view backup.lzb -- --json               # full dump
```

The passphrase is prompted hidden, or supplied via `--pass` / the `ADMIN_BACKUP_PASS` env var (for automation). Wrong passphrase or a tampered file is rejected by the AES-GCM authentication tag.

## Testing

```bash
npm run lint            # oxlint with React & Oxc rules
npm test                # functional + DOM-structure suite (jsdom + Vite SSR)
npm run test:db         # schema/constraint suite
npm run test:auth       # auth API suite
npm run test:profile    # profile API suite
npm run test:tasks      # tasks API suite
npm run test:notes      # notes API suite
npm run test:calendar   # calendar events API suite
npm run test:stats      # dashboard/analytics stats suite
npm run test:collections # goals/habits/meals/grocery/reminders/activity-log/migrate suite
npm run test:security   # auth isolation + security suite
npm run test:complete   # full end-to-end UI suite (real backend)
npm run test:admin      # admin console: auth + dynamic table list
npm run test:admin:browse # admin console: browse/search/filter/sort/breakdown
npm run test:admin:sql  # admin console: read-only SQL mode
npm run test:admin:backup # admin console: encrypted backup export/view
```

The API suites need a running database (`npm run db:start` + `npm run db:migrate`). The schema is created without any seed data — all tables start empty.

## Production build

```bash
npm run build           # builds to dist/
npm run preview         # preview the production build locally
```

## Deploying to Netlify

The app deploys as a static frontend plus the Express API as a **Netlify Function** (`netlify/functions/api.js`), so the frontend and API share one domain and the httpOnly session cookies work unchanged. Configuration lives in `netlify.toml` (build, function settings, SPA rewrite).

> **Status:** the project is deployed live at https://life-organizer-824.netlify.app (frontend + API on Netlify, data in Neon PostgreSQL). The steps below document how the deployment is set up.

**1. Create a hosted PostgreSQL database (Neon)**

Netlify has no database, so create a free project at [neon.tech](https://neon.tech). Copy the connection string, e.g.:

```
postgres://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**2. Push the repo to GitHub**

```
git remote add origin https://github.com/<you>/organizer.git
git push -u origin main
```

**3. Connect Netlify to the repo**

- Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → pick your GitHub repo.
- Framework preset: **Vite**; build command, publish directory, and function settings are already in `netlify.toml`.

**4. Set environment variables** (Site configuration → Environment variables):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Neon connection string (with `sslmode=require`) |
| `CORS_ORIGINS` | `https://<your-site>.netlify.app` (the deployed site URL) |

`NODE_ENV=production` and `VITE_API_URL=/.netlify/functions/api` are set in `netlify.toml`. If `CORS_ORIGINS` or `DATABASE_URL` are missing, the server refuses to start on purpose.

**5. Deploy**

The build runs `npm run db:migrate` (applies any pending migrations to Neon — node-pg-migrate skips already-applied ones) then `npm run build`. Hit **Deploy site**.

> **Note:** New projects on credit-based plans start **private** (visitors are forced to log in with Netlify). After the first deploy, go to **Project configuration → General → Visitor access → Project visibility** and set it to **Public** so anyone with the URL can use the app.

Notes:

- The SPA rewrite (`/*` → `/index.html`) lets the app use client-side routing; `/.netlify/functions/*` is handled by Netlify's function router before the rewrite.
- Migrations run on every build; they are idempotent, so repeat deploys are safe. To run them manually, `DATABASE_URL=<neon-url> npm run db:migrate`.
- The API lives at `/.netlify/functions/api/...` (frontend is pre-configured via `VITE_API_URL`). For local development nothing changes — Vite still proxies `/api` to `localhost:4000`.

## Project Structure

```
life-organizer/
├── public/                  # Static assets (favicon, icons)
├── src/
│   ├── components/          # UI components
│   │   ├── Dashboard.jsx    # Control center with stats & agenda
│   │   ├── CalendarView.jsx # Day/week/month/year/agenda calendar
│   │   ├── Tasks.jsx        # Task list + kanban board
│   │   ├── Habits.jsx       # Weekly habit tracker with streaks
│   │   ├── Meals.jsx        # Weekly meal planner + grocery list
│   │   ├── Notes.jsx        # Notes with tags, pin & archive
│   │   ├── Goals.jsx        # Goal tracking
│   │   ├── Reminders.jsx    # Derived + custom reminders
│   │   ├── Analytics.jsx    # Productivity analytics
│   │   ├── History.jsx      # Activity log
│   │   ├── CommandPalette.jsx # Ctrl+K command palette
│   │   ├── SearchModal.jsx  # Ctrl+S global search
│   │   ├── QuickAdd.jsx     # Quick-add menu
│   │   ├── ImportExportModal.jsx # JSON backup / restore
│   │   ├── UndoToast.jsx    # Undo-deletion toast
│   │   └── ...              # Editors & modals
│   ├── hooks/
│   │   └── useLifePlanner.js # Core state, persistence & actions
│   ├── App.jsx              # Root view orchestration
│   ├── main.jsx             # App entry point
│   └── index.css            # Global styles + theme system
├── tests/                   # Test suites (see Testing)
├── scripts/                 # Admin console CLI (admin, admin:init, admin:export, admin:view)
├── server/
│   ├── index.js             # Server entry point + graceful shutdown
│   ├── app.js               # Express app assembly (middleware, routes, errors)
│   ├── config.js            # Environment configuration
│   ├── db.js                # PostgreSQL connection pool + status
│   ├── db/
│   │   ├── embedded.js      # Local user-space PostgreSQL server (dev)
│   │   └── migrations/      # node-pg-migrate schema migrations
│   ├── middleware/          # Request logger, auth guard, error handling
│   ├── routes/              # health + auth endpoints
│   └── utils/               # AppError + session helpers
├── index.html               # HTML shell
├── netlify.toml             # Netlify build/function/redirect config
├── netlify/functions/api.js # Express API as a Netlify Function
├── vite.config.js           # Vite configuration
└── package.json
```

## How It Works

The app is **fully API-backed and account-based**. On first load you see an auth screen — create an account or sign in — and the backend issues a secure **httpOnly session cookie**. All state is managed by the `useLifePlanner` hook (`src/hooks/useLifePlanner.js`), which loads and saves every collection through the REST API; updates are optimistic with server reconciliation, and data survives reloads and sign-in/sign-out because it lives in PostgreSQL.

If you had existing `localStorage` data, it is migrated into your account once on first sign-in, then the user-data keys are cleared — only the `settings` (theme) preference stays in `localStorage`. Every collection starts empty for a new account; the UI guides you through your first task, event, habit, or note instead of seeding sample content. Back up your data anytime with the export feature, and restore or merge it later.

## Roadmap

- [x] Server-synced, account-based mode (Express API + PostgreSQL, all collections API-backed)
- [x] Production readiness: auth, security, isolation, and full end-to-end test coverage
- [ ] Notification support for background reminders (Service Worker)
- [ ] PWA installation for offline use

## Contributing

Contributions are welcome! If you find a bug or have a feature idea:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.
