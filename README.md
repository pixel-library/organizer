<div align="center">

# Life Planner OS

**Your personal productivity workspace** — plan tasks, track habits, schedule meals, and manage your entire day from one dashboard.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

</div>

---

## About

Life Planner OS is a single-page workspace that brings together everything you need to stay on top of your life — tasks, calendar events, habits, meals, notes, and goals — in one clean, dark-themed interface. All your data lives in your browser via `localStorage`, so there is no backend, no account, and no setup required.

## Features

### Dashboard
- Live statistics: today's task count, project progress, high-priority items, and overall completion rate
- Chronological project timeline with priority-coded dots
- Today's agenda merging events, meals, and tasks into one view
- Recent notes preview and a built-in focus audio player

### Task Calendar
- Month, week, and day views
- Recurring events (daily, weekly, monthly, yearly, custom weekdays)
- Per-occurrence overrides — edit, move, or delete a single instance or the whole series
- Color-coded categories (Personal, Work, Study, Health, and more) with meals and habits overlaid on the grid

### Task Management
- Create, edit, complete, and delete tasks
- Priority levels (High / Medium / Low) with overdue detection
- In-app reminders fired at the exact time, or 10/30/60 minutes before
- Bulk complete and bulk delete actions

### Habit Tracker
- Track up to seven days per habit with a simple weekly grid
- Add and remove habits on the fly

### Meal Planner
- Plan breakfast, lunch, dinner, and snacks per day
- Track calories and macros per meal
- Mark meals as planned, completed, or skipped
- Auto-generated grocery list with check-off and clear-purchased actions

### Notes
- Organize notes into categories (Personal, Work, Study)
- Pin important notes and archive the rest — restore them anytime
- Schedule any note straight onto your calendar

### History
- Activity log of every action you take — created, completed, updated, deleted
- Remove individual entries or clear the whole archive

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

### Production build

```bash
npm run build       # builds to dist/
npm run preview     # preview the production build locally
```

### Linting

```bash
npm run lint        # runs oxlint with React & Oxc rules
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React 19](https://react.dev/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + custom CSS |
| Icons | [Font Awesome 6](https://fontawesome.com/) |
| Typography | [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) |
| Linting | [oxlint](https://oxc.rs/) |
| Persistence | Browser `localStorage` |

## Project Structure

```
life-organizer/
├── public/                  # Static assets (favicon, icons)
├── src/
│   ├── components/          # UI components
│   │   ├── Dashboard.jsx    # Control center with stats & agenda
│   │   ├── CalendarView.jsx # Month/week/day calendar
│   │   ├── Tasks.jsx        # Task list with bulk actions
│   │   ├── Habits.jsx       # Weekly habit tracker
│   │   ├── Meals.jsx        # Meal planner + grocery list
│   │   ├── Notes.jsx        # Notes with pin/archive
│   │   ├── History.jsx      # Activity log
│   │   └── ...              # Modals & editors
│   ├── hooks/
│   │   └── useLifePlanner.js # Core state, persistence & actions
│   ├── App.jsx              # Root view orchestration
│   ├── main.jsx             # App entry point
│   └── index.css            # Global styles
├── index.html               # HTML shell & theme config
├── vite.config.js           # Vite configuration
└── package.json
```

## How It Works

All state is managed by the `useLifePlanner` hook (`src/hooks/useLifePlanner.js`). Every change is persisted to `localStorage` under the `life_planner_*` key namespace, so your data survives page reloads and browser sessions. The app ships with sample data so you can explore every feature immediately — clear it anytime from the History section.

## Roadmap

- [ ] Export / import data as JSON
- [ ] Dark / light theme toggle
- [ ] Notification support for background reminders
- [ ] PWA installation for offline use
- [ ] Server-synced mode

## Contributing

Contributions are welcome! If you find a bug or have a feature idea:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.
