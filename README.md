<div align="center">

# Life Planner OS

**Your personal productivity workspace** — plan tasks, track habits, schedule meals, and manage your entire day from one dashboard.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

</div>

---

## About

Life Planner OS is a single-page workspace that brings together everything you need to stay on top of your life — tasks, calendar events, habits, meals, notes, goals, reminders, and analytics — in one clean, dark-themed interface. All your data lives in your browser via `localStorage`, so there is no account and no setup required. The app ships with **no fake or sample data** — you start from a clean workspace and everything you create is genuinely yours. An Express API backend foundation is included for future server-synced features.

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

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- npm (bundled with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/pixel-library/organizer.git
cd organizer

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Backend API (foundation)

```bash
npm run server       # start the Express API (default http://localhost:4000)
npm run server:dev   # start with auto-reload
```

Copy `.env.example` to `.env` to customise the port, CORS origins, or database settings. The API exposes:

```bash
GET /api/health      # service + database status
```

The frontend does not use the API yet — it continues to run fully offline on `localStorage`.

### Database (PostgreSQL)

The backend uses PostgreSQL with `node-pg-migrate` for schema migrations. For local development a real PostgreSQL server can be run entirely in user-space (no install, no root) via `embedded-postgres`:

```bash
npm run db:start     # boot the local PostgreSQL server (data dir: .pgdata/)
npm run db:migrate   # apply schema migrations
npm run db:down      # roll back the latest migration
npm run db:rebuild   # roll back + re-apply (dev)
npm run test:db      # schema/constraint test suite (needs a running DB)
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
| Testing | [jsdom](https://github.com/jsdom/jsdom) + Vite SSR |
| Persistence | Browser `localStorage` |
| API foundation | [Express 5](https://expressjs.com/) + [helmet](https://helmetjs.github.io/) + [cors](https://github.com/expressjs/cors) |
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
│   └── functional.mjs       # Functional + DOM-structure test suite
├── server/
│   ├── index.js             # Server entry point + graceful shutdown
│   ├── app.js               # Express app assembly (middleware, routes, errors)
│   ├── config.js            # Environment configuration
│   ├── db.js                # PostgreSQL connection pool + status
│   ├── db/
│   │   ├── embedded.js      # Local user-space PostgreSQL server (dev)
│   │   └── migrations/      # node-pg-migrate schema migrations
│   ├── middleware/          # Request logger + centralized error handling
│   ├── routes/health.js     # Health endpoint
│   └── utils/AppError.js    # Error class
├── index.html               # HTML shell
├── vite.config.js           # Vite configuration
└── package.json
```

## How It Works

All state is managed by the `useLifePlanner` hook (`src/hooks/useLifePlanner.js`). Every change is persisted to `localStorage` under the `life_planner_*` key namespace, so your data survives page reloads and browser sessions. On first load every collection starts empty — the UI guides you through your first task, event, habit, or note instead of seeding sample content. Back up your data anytime with the export feature, and restore or merge it later.

## Roadmap

- [ ] Notification support for background reminders (Service Worker)
- [ ] PWA installation for offline use
- [ ] Server-synced mode (backend foundation in place — see `server/`)

## Contributing

Contributions are welcome! If you find a bug or have a feature idea:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.
