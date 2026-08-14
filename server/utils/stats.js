const pad = (n) => String(n).padStart(2, "0");
const dateKeyFrom = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateKey = (d) => (d instanceof Date ? dateKeyFrom(d) : "");
const todayKey = () => dateKeyFrom(new Date());
const parseKey = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dayDiff = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);

const weekStartKey = (now) => {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return dateKeyFrom(d);
};

const weekEndKey = (startKey) => {
  const d = parseKey(startKey);
  d.setDate(d.getDate() + 6);
  return dateKeyFrom(d);
};

const isTaskOverdue = (task) => {
  if (task.completed) return false;
  if (!task.date) return false;
  const dateStr = dateKey(task.date);
  const timeStr = task.time ? String(task.time).slice(0, 5) : "23:59";
  const due = new Date(`${dateStr}T${timeStr}`);
  return !isNaN(due.getTime()) && due.getTime() < Date.now();
};

const habitCompletionDates = (habit) => {
  const dates = new Set();
  const now = new Date();
  if (Array.isArray(habit.history)) {
    habit.history.forEach((k) => dates.add(dateKey(k)));
  }
  const days = Array.isArray(habit.days) ? habit.days : [];
  if (days.length > 0) {
    const wsDate = parseKey(weekStartKey(now));
    days.forEach((checked, idx) => {
      if (checked) {
        const d = new Date(wsDate);
        d.setDate(wsDate.getDate() + idx);
        dates.add(dateKeyFrom(d));
      }
    });
  }
  return dates;
};

const computeHabitStats = (habit) => {
  const dates = habitCompletionDates(habit);
  const sorted = [...dates].sort();
  const totalCompletions = sorted.length;
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || dayDiff(sorted[i], sorted[i - 1]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
  }
  const today = todayKey();
  let completionRate = 0;
  if (habit.created_at) {
    const createdKey = new Date(habit.created_at).toISOString().slice(0, 10);
    const created = parseKey(createdKey);
    const elapsed = created ? Math.max(1, dayDiff(today, createdKey) + 1) : 0;
    if (elapsed > 0) completionRate = Math.round((totalCompletions / elapsed) * 100);
  }
  return { totalCompletions, bestStreak, completionRate };
};

export function computeDashboard(tasks, events, meals, goals, notes, habits) {
  const now = new Date();
  const today = todayKey();

  const todayTasks = tasks.filter((t) => dateKey(t.date) === today);
  const todayCompleted = todayTasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const high = tasks.filter((t) => t.priority === "Red" && !t.completed).length;
  const overdue = tasks.filter((t) => t.date && !t.completed && dateKey(t.date) < today).length;

  const goalTotal = goals.reduce((sum, g) => sum + Number(g.target || 0), 0);
  const goalCurrent = goals.reduce(
    (sum, g) => sum + Math.min(Number(g.current || 0), Number(g.target || 0)),
    0
  );
  const project = goalTotal ? Math.round((goalCurrent / goalTotal) * 100) : 0;

  const todayEvents = events.filter((e) => dateKey(e.start_date) === today).length;

  const weekdayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayMeals = meals.filter((m) => dateKey(m.date) === today || m.day === weekdayName);
  const completedMealsToday = todayMeals.filter((m) => m.status === "completed").length;

  const wsKey = weekStartKey(now);
  const weKey = weekEndKey(wsKey);
  const weekTasks = tasks.filter((t) => {
    const k = dateKey(t.date);
    return k >= wsKey && k <= weKey;
  });
  const weekCompleted = weekTasks.filter((t) => t.completed).length;
  const weekEvents = events.filter((e) => {
    const k = dateKey(e.start_date);
    return k >= wsKey && k <= weKey;
  }).length;
  const weekHabits = habits.reduce(
    (sum, h) => sum + (Array.isArray(h.history) ? h.history.filter((k) => dateKey(k) >= wsKey && dateKey(k) <= weKey).length : 0),
    0
  );

  const isEmpty =
    tasks.length === 0 &&
    events.length === 0 &&
    notes.length === 0 &&
    habits.length === 0 &&
    meals.length === 0 &&
    goals.length === 0;

  return {
    isEmpty,
    tasksToday: todayTasks.length,
    tasksCompletedToday: todayCompleted,
    totalTasks: total,
    completedTasks: completed,
    completionRate: rate,
    highPriority: high,
    overdue,
    goalCount: goals.length,
    projectProgress: project,
    todayEvents,
    todayMeals: todayMeals.length,
    completedMealsToday,
    week: { tasks: weekTasks.length, completed: weekCompleted, events: weekEvents, habitCheckins: weekHabits },
    notes: notes.length,
    activeNotes: notes.filter((n) => !n.archived).length
  };
}

export function computeAnalytics(tasks, events, habits) {
  const now = new Date();
  const today = todayKey();

  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length;

  const monthStart = dateKeyFrom(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = dateKeyFrom(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const weekStart = weekStartKey(now);

  const monthTasks = tasks.filter((t) => {
    const k = dateKey(t.date);
    return k >= monthStart && k <= monthEnd;
  });
  const monthCompleted = monthTasks.filter((t) => t.completed).length;
  const monthRate = monthTasks.length ? Math.round((monthCompleted / monthTasks.length) * 100) : 0;

  const weekTasks = tasks.filter((t) => {
    const k = dateKey(t.date);
    return k >= weekStart && k <= today;
  });
  const weekCompleted = weekTasks.filter((t) => t.completed).length;
  const weekRate = weekTasks.length ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;

  const monthEvents = events.filter((e) => {
    const k = dateKey(e.start_date);
    return k >= monthStart && k <= monthEnd;
  }).length;
  const upcomingEvents = events.filter((e) => dateKey(e.start_date) >= today).length;

  const habitStats = habits.map((h) => computeHabitStats(h));
  const habitCompletions = habitStats.reduce((sum, s) => sum + s.totalCompletions, 0);
  const habitRate = habitStats.length
    ? Math.round(habitStats.reduce((sum, s) => sum + s.completionRate, 0) / habitStats.length)
    : 0;
  const bestStreak = habitStats.reduce((max, s) => Math.max(max, s.bestStreak), 0);

  const last14Days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKeyFrom(d);
    last14Days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      completedTasks: tasks.filter((t) => dateKey(t.date) === key && t.completed).length,
      habitCompletions: habits.reduce(
        (sum, h) => sum + (Array.isArray(h.history) && h.history.some((k) => dateKey(k) === key) ? 1 : 0),
        0
      ),
      events: events.filter((e) => dateKey(e.start_date) === key).length
    });
  }
  const maxActivity = Math.max(1, ...last14Days.map((d) => d.completedTasks + d.habitCompletions + d.events));

  return {
    completionRate: rate,
    completedTasks: completed,
    totalTasks: total,
    overdue,
    week: { tasks: weekTasks.length, completed: weekCompleted, completionRate: weekRate },
    month: { tasks: monthTasks.length, completed: monthCompleted, completionRate: monthRate },
    monthEvents,
    upcomingEvents,
    habitCompletions,
    habitRate,
    bestStreak,
    last14Days,
    maxActivity,
    hasData: total > 0 || events.length > 0 || habits.length > 0
  };
}
