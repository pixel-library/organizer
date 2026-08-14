<div align="center">

# Life Planner OS

**Your personal productivity workspace** — plan tasks, track habits, schedule meals, and manage your entire day from one dashboard.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

</div>

---

## About

Life Planner OS is a full-stack, account-based workspace that brings together everything you need to stay on top of your life — tasks, calendar events, habits, meals, notes, goals, reminders, and analytics — in one clean, dark-themed interface. All user data is stored securely in PostgreSQL behind an Express API, protected by session authentication and per-user ownership. The app ships with **no fake or sample data** — you start from a clean workspace and everything you create is genuinely yours, synced to your account across sessions and devices.

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
- Drag-to-create events, color-coded categories, and meals and habits overlaid on the grid
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

## Getting Started

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/pixel-library/organizer.git
cd organizer

# 2. Install dependencies
npm install
```

### Environment setup

```bash
cp .env.example .env
```

The defaults are fine for local development (embedded PostgreSQL, API on `http://localhost:4000`, app origin `http://localhost:5173`). In **production** the server refuses to start unless `DATABASE_URL` (or `DB_USER` + `DB_PASSWORD`) **and** `CORS_ORIGINS` are set. Available settings are documented in `.env.example`.

### Database setup

```bash
npm run db:start     # boot the local PostgreSQL server (data dir: .pgdata/)
```

`db:start` runs a real PostgreSQL server in user-space via `embedded-postgres` — no install or root needed. Alternatively, set `DATABASE_URL` to any existing PostgreSQL instance and skip `db:start`.

### Migration commands

```bash
npm run db:migrate   # apply schema migrations
npm run db:down      # roll back the latest migration
npm run db:rebuild   # roll back + re-apply (dev)
```

### Backend start

```bash
npm run server       # API on http://localhost:4000
npm run server:dev   # API with auto-reload
```

### Frontend start

```bash
npm run dev          # app on http://localhost:5173 (proxies /api → :4000)
```

Open `http://localhost:5173` in your browser.

### Authentication overview

The app is **account-based**: on first load you create an account (name, email, password) or sign in. Passwords are hashed with bcrypt server-side (never stored or transmitted in plaintext); sessions use secure, **httpOnly** cookies backed by a server-side `sessions` table with sliding expiration. The authenticated user is always resolved from the session cookie — a `userId` supplied by the client is never trusted, and every collection query enforces `user_id = <session user>`. Password hashes, session tokens, and secrets are never returned by the API and never stored in the frontend.

---

### Backend API

```bash
npm run server       # start the Express API (default http://localhost:4000)
npm run server:dev   # start with auto-reload
```

Copy `.env.example` to `.env` to customise the port, CORS origins, or database settings. The API exposes:

```bash
GET  /api/health      # service + database status
POST /api/auth/register  # create account (name, email, password) → session cookie
POST /api/auth/login     # verify credentials → session cookie
POST /api/auth/logout    # invalidate session + clear cookie
GET  /api/auth/me        # current user (requires auth)
GET  /api/profile        # read profile of the authenticated user (requires auth)
PUT  /api/profile        # update name/email of the authenticated user (requires auth)
GET  /api/tasks          # list tasks (requires auth) — supports search/filters/sorting
POST /api/tasks          # create a task (ownership from session, requires auth)
GET  /api/tasks/:id      # read one task (requires auth)
PUT  /api/tasks/:id      # update a task — partial merge semantics (requires auth)
PATCH /api/tasks/:id     # update a task — partial merge semantics (requires auth)
DELETE /api/tasks/:id    # delete a task (requires auth)
GET  /api/notes          # list notes (requires auth) — supports search/filters/sorting
POST /api/notes          # create a note (ownership from session, requires auth)
GET  /api/notes/:id      # read one note (requires auth)
PUT  /api/notes/:id      # update a note — partial merge semantics (requires auth)
PATCH /api/notes/:id     # update a note — partial merge semantics (requires auth)
DELETE /api/notes/:id    # delete a note (requires auth)
GET  /api/calendarEvents        # list events (requires auth) — optional ?from=&to= date range
POST /api/calendarEvents        # create an event (ownership from session, requires auth)
GET  /api/calendarEvents/:id    # read one event (requires auth)
PUT  /api/calendarEvents/:id    # update an event — partial merge semantics (requires auth)
PATCH /api/calendarEvents/:id   # update an event — partial merge semantics (requires auth)
DELETE /api/calendarEvents/:id  # delete an event (requires auth)
GET  /api/stats           # dashboard + analytics metrics (requires auth)
GET  /api/goals           # list goals (requires auth)
POST /api/goals           # create a goal (ownership from session, requires auth)
GET  /api/goals/:id       # read one goal (requires auth)
PUT  /api/goals/:id       # update a goal — partial merge semantics (requires auth)
PATCH /api/goals/:id      # update a goal — partial merge semantics (requires auth)
DELETE /api/goals/:id     # delete a goal (requires auth)
GET  /api/habits          # list habits (requires auth)
POST /api/habits          # create a habit (ownership from session, requires auth)
GET  /api/habits/:id      # read one habit (requires auth)
PUT  /api/habits/:id      # update a habit — partial merge semantics (requires auth)
PATCH /api/habits/:id     # update a habit — partial merge semantics (requires auth)
DELETE /api/habits/:id    # delete a habit (requires auth)
GET  /api/meals           # list meals (requires auth)
POST /api/meals           # create a meal (ownership from session, requires auth)
GET  /api/meals/:id       # read one meal (requires auth)
PUT  /api/meals/:id       # update a meal — partial merge semantics (requires auth)
PATCH /api/meals/:id      # update a meal — partial merge semantics (requires auth)
DELETE /api/meals/:id     # delete a meal (requires auth)
GET  /api/groceryItems    # list grocery items (requires auth)
POST /api/groceryItems    # create a grocery item (ownership from session, requires auth)
GET  /api/groceryItems/:id # read one grocery item (requires auth)
PUT  /api/groceryItems/:id # update a grocery item — partial merge semantics (requires auth)
PATCH /api/groceryItems/:id # update a grocery item — partial merge semantics (requires auth)
DELETE /api/groceryItems/:id # delete a grocery item (requires auth)
GET  /api/customReminders # list custom reminders (requires auth)
POST /api/customReminders # create a custom reminder (ownership from session, requires auth)
GET  /api/customReminders/:id # read one custom reminder (requires auth)
PUT  /api/customReminders/:id # update a custom reminder — partial merge semantics (requires auth)
PATCH /api/customReminders/:id # update a custom reminder — partial merge semantics (requires auth)
DELETE /api/customReminders/:id # delete a custom reminder (requires auth)
GET  /api/activityLog     # list activity-log entries (requires auth)
POST /api/activityLog     # create an activity-log entry (ownership from session, requires auth)
DELETE /api/activityLog/:id # delete an activity-log entry (requires auth)
POST /api/migrate         # one-time localStorage → database import (transactional, requires auth)
```

Calendar events use the existing event fields: `title`, `start`/`end` (dates), `startTime`/`endTime`, `allDay`, `category`, `location`, `description`, `reminder`, `recurrence`, `recurrenceEnd`, `customWeekdays`, `overrides`. `title` and `start` are required on create.

`GET /api/stats` computes the live dashboard + analytics metrics from the authenticated user's real data (no hardcoded numbers): `dashboard` covers today's tasks, completion rate, high-priority/overdue tasks, goal progress, today's events/meals, this-week snapshot, and note counts; `analytics` covers overall/weekly/monthly task completion, overdue load, events (this month + upcoming), habit consistency/streaks, and the last-14-days activity chart. A brand-new user gets `dashboard.isEmpty: true` / `analytics.hasData: false` with all-zero values (the app's empty state), never fake figures.

Notes support the existing note features: create, edit, delete, pin (`pinned`), archive/restore (`archived`), categories (`category`), tags, plus server-side **search** (`?search=` across title/content/tags), **filters** (`?category=`, `?archived=true|false`), and **sorting** (`?sort=updated|created|oldest|az|za`, pinned first).

Tasks support the existing task-manager features: create, edit, delete, complete (`completed`), priority (`Red`/`Yellow`/`Green`), due date (`date`, `time`), category (`type`), plus server-side **search** (`?search=`), **filters** (`?status=pending|completed|overdue`, `?priority=`, `?type=`, `?from=`/`?to=` date range), and **sorting** (`?sort=dateAsc|dateDesc|priority|name|createdAt|updatedAt`).

Authentication uses secure, **httpOnly** session cookies (server-side `sessions` table, bcrypt password hashing, sliding expiration). Passwords are never stored in `localStorage`, `sessionStorage`, or frontend JavaScript, and are never returned by the API. The protected routes use the `requireAuth` middleware; the user is always resolved from the authenticated session — a `userId` supplied by the client is never trusted, and every collection query enforces `user_id = authenticated_user_id` (cross-user reads/edits/deletes return 404).

`POST /api/migrate` performs a one-time import of the old `localStorage` data into the database in a single transaction: it accepts `{ tasks?, notes?, calendarEvents?, goals?, habits?, meals?, groceryItems?, customReminders?, activityLog? }`, maps the legacy field names the frontend used to the database schema, and inserts all rows for the authenticated user, returning `{ counts }`.

The frontend is now fully API-backed: it starts at an **auth screen** (create account / sign in), then loads every collection from the backend over the session cookie. A one-time migration moves any existing `localStorage` data into the database on first sign-in; from then on `localStorage` only holds the UI preference `settings` (theme). The Vite dev server proxies `/api` to the API (default `http://localhost:4000`).

### Database (PostgreSQL)

The backend uses PostgreSQL with `node-pg-migrate` for schema migrations. For local development a real PostgreSQL server can be run entirely in user-space (no install, no root) via `embedded-postgres`:

```bash
npm run db:start     # boot the local PostgreSQL server (data dir: .pgdata/)
npm run db:migrate   # apply schema migrations
npm run db:down      # roll back the latest migration
npm run db:rebuild   # roll back + re-apply (dev)
npm run test:db      # schema/constraint test suite (needs a running DB)
npm run test:auth    # auth API test suite (needs a running DB)
npm run test:profile # profile API test suite (needs a running DB)
npm run test:tasks   # tasks API test suite (needs a running DB)
npm run test:notes   # notes API test suite (needs a running DB)
npm run test:calendar # calendar events API test suite (needs a running DB)
npm run test:stats    # dashboard/analytics stats API test suite (needs a running DB)
npm run test:collections # goals/habits/meals/grocery/custom-reminders/activity-log/migrate API tests (needs a running DB)
npm run test:security # auth isolation + security test suite (needs a running DB)
npm run test:complete # full end-to-end UI test suite (needs a running DB)
```

Start order: `npm run db:start` (in one terminal) → `npm run db:migrate` → `npm run server`. Point `DATABASE_URL` at any existing PostgreSQL instance to use it instead of the embedded one. The migration creates the schema without any seed data — all tables start empty.

### Production build

```bash
npm run build       # builds to dist/
npm run preview     # preview the production build locally
```

### Linting & tests

```bash
npm run lint        # runs oxlint with React & Oxc rules
npm test            # functional + DOM-structure suite (jsdom + Vite SSR)
```
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
| Persistence | PostgreSQL (all user data) + browser `localStorage` (theme/settings only) |
| API foundation | [Express 5](https://expressjs.com/) + [helmet](https://helmetjs.github.io/) + [cors](https://github.com/expressjs/cors) + [cookie-parser](https://github.com/expressjs/cookie-parser) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) + [embedded-postgres](https://github.com/leinelissen/embedded-postgres) (dev) |

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
├── tests/
│   ├── functional.mjs       # Functional + DOM-structure test suite
│   ├── db.test.mjs          # Schema/constraint test suite
│   └── auth.test.mjs        # Auth API test suite
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
├── vite.config.js           # Vite configuration
└── package.json
```

## How It Works

The app is **fully API-backed and account-based**. On first load you see an auth screen — create an account or sign in — and the backend issues a secure **httpOnly session cookie**. From then on all state is managed by the `useLifePlanner` hook (`src/hooks/useLifePlanner.js`), which loads and saves every collection (`tasks`, `notes`, `calendarEvents`, `goals`, `habits`, `meals`, `groceryList`, `customReminders`, `history`) through the REST API; updates are optimistic with server reconciliation, and data survives reloads and sign-in/sign-out because it lives in PostgreSQL. If you had existing `localStorage` data, it is migrated into your account once on first sign-in, then the `life_planner_*` user-data keys are cleared — only the `settings` (theme) preference stays in `localStorage`. Every collection starts empty for a new account — the UI guides you through your first task, event, habit, or note instead of seeding sample content. Back up your data anytime with the export feature, and restore or merge it later.

## Roadmap

- [x] Server-synced, account-based mode (Express API + PostgreSQL, all collections API-backed)
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
