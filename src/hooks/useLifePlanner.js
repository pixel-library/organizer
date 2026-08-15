import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api, ApiError } from "../api";

export const STORAGE_KEYS = {
  tasks: "life_planner_tasks",
  history: "life_planner_history",
  goals: "life_planner_goals",
  notes: "life_planner_notes",
  habits: "life_planner_habits",
  meals: "life_planner_meals",
  calendarEvents: "life_planner_calendar_events",
  groceryList: "life_planner_grocery_list",
  customReminders: "life_planner_custom_reminders",
  settings: "life_planner_settings"
};

const pad = (n) => String(n).padStart(2, "0");
export const dateKeyFrom = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKeyFrom(new Date());
const parseDateKey = (key) => {
  const parts = String(key || "").split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};
const dayBeforeKey = (key) => {
  const d = parseDateKey(key);
  if (!d) return null;
  d.setDate(d.getDate() - 1);
  return dateKeyFrom(d);
};

const defaultSettings = { theme: "system" };

const migrateNotes = (notes) => {
  if (!Array.isArray(notes)) return [];
  return notes.map(n => ({
    id: n.id || Date.now() + Math.random(),
    title: n.title || "",
    content: n.content || "",
    category: n.category || "Personal",
    pinned: !!n.pinned,
    archived: !!n.archived,
    tags: Array.isArray(n.tags) ? n.tags : [],
    createdAt: n.createdAt || new Date().toISOString(),
    updatedAt: n.updatedAt || new Date().toISOString()
  }));
};

const migrateTasks = (tasks) => {
  if (!Array.isArray(tasks)) return [];
  return tasks.map(t => ({
    id: t.id ?? Date.now() + Math.random(),
    name: t.name || "",
    date: t.date || "",
    time: t.time || "",
    priority: t.priority || "Yellow",
    reminder: t.reminder || "none",
    completed: !!t.completed,
    type: t.type || "Task",
    description: t.description || "",
    startDate: t.startDate || "",
    estimatedTime: t.estimatedTime || "",
    tags: Array.isArray(t.tags) ? t.tags : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(s => ({ ...s, completed: !!s.completed })) : [],
    recurring: t.recurring || "none",
    color: t.color || "",
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt: t.updatedAt || new Date().toISOString()
  }));
};

const migrateHabits = (habits) => {
  if (!Array.isArray(habits)) return [];
  return habits.map(h => ({
    id: h.id ?? Date.now() + Math.random(),
    name: h.name || "",
    days: Array.isArray(h.days) ? h.days.map(Boolean) : Array(7).fill(false),
    history: Array.isArray(h.history) ? h.history.filter(d => typeof d === "string") : [],
    createdAt: h.createdAt || new Date().toISOString()
  }));
};

const migrateMeals = (meals) => {
  if (!Array.isArray(meals)) return [];
  return meals.map((m, idx) => {
    const day = m.day || ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][idx % 7];
    return {
      id: m.id ?? Date.now() + idx,
      date: m.date || "",
      type: m.type || "Meal",
      name: m.name || day,
      time: m.time || "08:00",
      calories: m.calories != null ? m.calories : null,
      protein: m.protein != null ? m.protein : null,
      carbohydrates: m.carbohydrates != null ? m.carbohydrates : null,
      fat: m.fat != null ? m.fat : null,
      ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
      notes: m.notes || "",
      status: m.status || "planned",
      day: day,
      breakfast: m.breakfast || "",
      lunch: m.lunch || "",
      dinner: m.dinner || "",
      snack: m.snack || "",
      createdAt: m.createdAt || new Date().toISOString(),
      updatedAt: m.updatedAt || new Date().toISOString()
    };
  });
};

const migrateCalendarEvents = (events) => {
  if (!Array.isArray(events)) return [];
  return events.map(e => ({
    id: e.id ?? Date.now() + Math.random(),
    title: e.title || "",
    start: e.start || "",
    end: e.end || e.start || "",
    startTime: e.startTime || "",
    endTime: e.endTime || e.startTime || "",
    allDay: !!e.allDay,
    category: e.category || "Personal",
    location: e.location || "",
    description: e.description || "",
    reminder: e.reminder || "none",
    recurrence: e.recurrence || "none",
    recurrenceEnd: e.recurrenceEnd || "",
    customWeekdays: Array.isArray(e.customWeekdays) ? e.customWeekdays : [],
    overrides: e.overrides && typeof e.overrides === "object" ? e.overrides : {},
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString()
  }));
};

const migrateReminders = (reminders) => {
  if (!Array.isArray(reminders)) return [];
  return reminders.map(r => ({
    id: r.id ?? Date.now() + Math.random(),
    title: r.title || "",
    date: r.date || "",
    time: r.time || "",
    note: r.note || "",
    type: r.type || "Custom",
    completed: !!r.completed,
    createdAt: r.createdAt || new Date().toISOString()
  }));
};

const migrateSettings = (settings) => {
  const merged = { ...defaultSettings, ...(settings && typeof settings === "object" ? settings : {}) };
  if (!["dark", "light", "system"].includes(merged.theme)) merged.theme = "system";
  return merged;
};

function loadFromStorage(key, defaultValue, migrate) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const parsed = JSON.parse(stored);
    if (migrate) return migrate(parsed);
    return parsed;
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function habitCompletionDates(habit) {
  const dates = new Set();
  const now = new Date();
  if (Array.isArray(habit.history)) {
    habit.history.forEach(k => { if (typeof k === "string") dates.add(k); });
  }
  if (Array.isArray(habit.days)) {
    const weekStart = getWeekStart(now);
    habit.days.forEach((checked, idx) => {
      if (checked) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + idx);
        dates.add(dateKeyFrom(d));
      }
    });
  }
  return dates;
}

function dateDiffDays(a, b) {
  return Math.round((parseDateKey(a) - parseDateKey(b)) / 86400000);
}

export function computeHabitStats(habit) {
  const dates = habitCompletionDates(habit);
  const sorted = [...dates].sort();
  const totalCompletions = sorted.length;
  let currentStreak = 0;
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || dateDiffDays(sorted[i], sorted[i - 1]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
  }
  const today = todayKey();
  let cursor = today;
  while (dates.has(cursor)) {
    currentStreak += 1;
    const prev = dayBeforeKey(cursor);
    if (!prev) break;
    cursor = prev;
  }
  if (currentStreak === 0) {
    const yesterday = dayBeforeKey(today);
    if (yesterday && dates.has(yesterday)) {
      currentStreak = 1;
      cursor = yesterday;
      for (;;) {
        const prev = dayBeforeKey(cursor);
        if (!prev || !dates.has(prev)) break;
        currentStreak += 1;
        cursor = prev;
      }
    }
  }
  let completionRate = 0;
  if (habit.createdAt) {
    const created = parseDateKey(String(habit.createdAt).slice(0, 10));
    const elapsed = created ? Math.max(1, dateDiffDays(today, created) + 1) : 0;
    if (elapsed > 0) completionRate = Math.round((totalCompletions / elapsed) * 100);
  }
  return { totalCompletions, currentStreak, bestStreak, completionRate };
}

const USER_DATA_KEYS = [
  STORAGE_KEYS.tasks, STORAGE_KEYS.history, STORAGE_KEYS.goals, STORAGE_KEYS.notes,
  STORAGE_KEYS.habits, STORAGE_KEYS.meals, STORAGE_KEYS.calendarEvents,
  STORAGE_KEYS.groceryList, STORAGE_KEYS.customReminders
];

const COLLECTIONS = [
  { name: "tasks", path: "/tasks", migrateName: "tasks", key: STORAGE_KEYS.tasks, migrate: migrateTasks },
  { name: "history", path: "/activityLog", migrateName: "activityLog", key: STORAGE_KEYS.history },
  { name: "goals", path: "/goals", migrateName: "goals", key: STORAGE_KEYS.goals },
  { name: "notes", path: "/notes", migrateName: "notes", key: STORAGE_KEYS.notes, migrate: migrateNotes },
  { name: "habits", path: "/habits", migrateName: "habits", key: STORAGE_KEYS.habits, migrate: migrateHabits },
  { name: "meals", path: "/meals", migrateName: "meals", key: STORAGE_KEYS.meals, migrate: migrateMeals },
  { name: "calendarEvents", path: "/calendarEvents", migrateName: "calendarEvents", key: STORAGE_KEYS.calendarEvents, migrate: migrateCalendarEvents },
  { name: "groceryList", path: "/groceryItems", migrateName: "groceryItems", key: STORAGE_KEYS.groceryList },
  { name: "customReminders", path: "/customReminders", migrateName: "customReminders", key: STORAGE_KEYS.customReminders, migrate: migrateReminders }
];

const TEMP_ID_PREFIX = "temp-";

const sanitizeEvent = (event) => {
  const out = { ...event };
  if (out.customWeekdays === null) delete out.customWeekdays;
  if (out.recurrenceEnd === null) delete out.recurrenceEnd;
  return out;
};

export function useLifePlanner() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [habits, setHabits] = useState([]);
  const [meals, setMeals] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [groceryList, setGroceryList] = useState([]);
  const [customReminders, setCustomReminders] = useState([]);
  const [settings, setSettingsState] = useState(() => loadFromStorage(STORAGE_KEYS.settings, defaultSettings, migrateSettings));
  const [undoState, setUndoState] = useState(null);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [authError, setAuthError] = useState("");
  const stateRef = useRef({});
  stateRef.current = { tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders };
  const setters = useMemo(() => ({
    tasks: setTasks, history: setHistory, goals: setGoals, notes: setNotes,
    habits: setHabits, meals: setMeals, calendarEvents: setCalendarEvents,
    groceryList: setGroceryList, customReminders: setCustomReminders
  }), []);

  const applyServerItem = useCallback((setter, tempId, item) => {
    setter(prev => prev.map(x => String(x.id) === String(tempId) ? item : x));
  }, []);

  const reloadCollection = useCallback((name) => {
    const spec = COLLECTIONS.find(c => c.name === name);
    if (!spec) return Promise.resolve();
    return api.get(spec.path).then(data => {
      setters[name](data);
    }).catch((err) => {
      if (err && err.status === 401) {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    });
  }, [setters]);

  const fail = useCallback((name) => (err) => {
    if (err && err.status === 401) {
      setUser(null);
      setAuthStatus("unauthenticated");
      return;
    }
    reloadCollection(name);
  }, [reloadCollection]);

  const loadAllCollections = useCallback(() => {
    return Promise.all(COLLECTIONS.map(c =>
      api.get(c.path).then(data => setters[c.name](data)).catch(() => {})
    ));
  }, [setters]);

  const clearAllCollections = useCallback(() => {
    COLLECTIONS.forEach(c => setters[c.name]([]));
  }, [setters]);

  const migrateLocalStorage = useCallback(async () => {
    const payload = {};
    for (const c of COLLECTIONS) {
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(c.key));
      } catch {
        stored = null;
      }
      if (Array.isArray(stored) && stored.length > 0) {
        payload[c.migrateName] = stored;
      }
    }
    if (Object.keys(payload).length === 0) return;
    try {
      await api.post("/migrate", payload);
      USER_DATA_KEYS.forEach(key => localStorage.removeItem(key));
    } catch {
      // Keep localStorage so the data can be retried on next login.
    }
  }, []);

  const enterApp = useCallback(async () => {
    await migrateLocalStorage();
    await loadAllCollections();
  }, [migrateLocalStorage, loadAllCollections]);

  const boot = useCallback(async () => {
    setAuthError("");
    try {
      const me = await api.get("/auth/me");
      setUser(me);
      setAuthStatus("ready");
      await enterApp();
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401) {
        setAuthStatus("unauthenticated");
      } else {
        setAuthStatus("error");
        setAuthError("Unable to reach the server. Check that the API is running and try again.");
      }
    }
  }, [enterApp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await boot();
    })();
    return () => { cancelled = true; };
  }, [boot]);

  const login = useCallback(async (email, password) => {
    setAuthError("");
    const data = await api.post("/auth/login", { email, password });
    setUser(data);
    setAuthStatus("ready");
    await enterApp();
  }, [enterApp]);

  const register = useCallback(async (name, email, password) => {
    setAuthError("");
    const data = await api.post("/auth/register", { name, email, password });
    setUser(data);
    setAuthStatus("ready");
    await enterApp();
  }, [enterApp]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setUser(null);
    setAuthStatus("unauthenticated");
    clearAllCollections();
  }, [clearAllCollections]);

  const setSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      saveToStorage(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const formatDateKey = useCallback((date) => dateKeyFrom(date), []);
  const escapeHtml = useCallback((value) => {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
  }, []);
  const priorityClass = useCallback((priority) => {
    if (priority === "Red") return "red";
    if (priority === "Yellow") return "yellow";
    return "green";
  }, []);
  const priorityLabel = useCallback((priority) => {
    if (priority === "Red") return "High";
    if (priority === "Yellow") return "Middle";
    return "Low";
  }, []);
  const reminderLabel = useCallback((value) => ({
    exact: "At time", "10min": "10 min before", "30min": "30 min before", "1hour": "1 hour before", none: "None",
    "5min": "5 min before", "15min": "15 min before", "1day": "1 day before"
  }[value] || value), []);

  const logHistory = useCallback((name, status) => {
    const now = new Date();
    const timestamp = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + ", " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}-${Math.random()}`;
    const entry = { id: tempId, name, timestamp, status };
    setHistory(prev => [entry, ...prev]);
    api.post("/activityLog", { name, timestamp, status })
      .then(server => { if (server) applyServerItem(setHistory, tempId, server); })
      .catch(fail("history"));
  }, [applyServerItem, fail]);

  const toggleTaskCompletion = useCallback((id) => {
    const task = tasks.find(t => String(t.id) === String(id));
    const completed = task ? !task.completed : true;
    if (task) logHistory(task.name, task.completed ? "Reopened" : "Completed");
    setTasks(prev => prev.map(t => String(t.id) === String(id) ? { ...t, completed, updatedAt: new Date().toISOString() } : t));
    api.patch(`/tasks/${id}`, { completed })
      .then(server => { if (server) applyServerItem(setTasks, id, server); })
      .catch(fail("tasks"));
  }, [tasks, logHistory, applyServerItem, fail]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => String(t.id) === String(id));
    if (task) {
      logHistory(task.name, "Deleted");
      const index = tasks.findIndex(t => String(t.id) === String(id));
      setUndoState({ type: "task", item: task, index, label: `Task "${task.name}" deleted` });
    }
    setTasks(prev => prev.filter(t => String(t.id) !== String(id)));
    api.del(`/tasks/${id}`).catch(fail("tasks"));
  }, [tasks, logHistory, fail]);

  const isTaskOverdue = useCallback((task) => {
    if (task.completed) return false;
    if (!task.date) return false;
    const now = new Date();
    const due = new Date(`${task.date}T${task.time || "23:59"}`);
    return !isNaN(due.getTime()) && due.getTime() < now.getTime();
  }, []);

  const addOrUpdateTask = useCallback((taskData) => {
    if (taskData.editingId) {
      const editingId = taskData.editingId;
      const oldTask = tasks.find(t => String(t.id) === String(editingId));
      if (oldTask) {
        const oldName = oldTask.name;
        logHistory(taskData.name, oldName === taskData.name ? "Updated" : `Renamed from ${oldName}`);
      }
      const { editingId: _drop, ...patch } = taskData;
      setTasks(prev => prev.map(t => String(t.id) === String(editingId) ? { ...t, ...patch, editingId: undefined, updatedAt: new Date().toISOString() } : t));
      api.patch(`/tasks/${editingId}`, patch)
        .then(server => { if (server) applyServerItem(setTasks, editingId, server); })
        .catch(fail("tasks"));
      return;
    }
    const now = new Date().toISOString();
    const { editingId: _drop, ...clean } = taskData;
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const newTask = { id: tempId, ...clean, completed: false, createdAt: now, updatedAt: now };
    logHistory(newTask.name, "Created");
    setTasks(prev => [...prev, newTask]);
    api.post("/tasks", { ...clean, completed: false })
      .then(server => { if (server) applyServerItem(setTasks, tempId, server); })
      .catch(fail("tasks"));
  }, [tasks, logHistory, applyServerItem, fail]);

  const bulkCompleteTasks = useCallback((ids) => {
    const idSet = new Set(ids.map(String));
    const pending = tasks.filter(t => idSet.has(String(t.id)) && !t.completed);
    if (pending.length === 0) {
      alert("All selected tasks are already completed.");
      return;
    }
    pending.forEach(t => logHistory(t.name, "Completed"));
    setTasks(prev => prev.map(t => idSet.has(String(t.id)) ? { ...t, completed: true, updatedAt: new Date().toISOString() } : t));
    Promise.all(pending.map(t => api.patch(`/tasks/${t.id}`, { completed: true })))
      .catch(fail("tasks"));
  }, [tasks, logHistory, fail]);

  const bulkDeleteTasks = useCallback((ids) => {
    const idSet = new Set(ids.map(String));
    const targets = tasks.filter(t => idSet.has(String(t.id)));
    targets.forEach(t => logHistory(t.name, "Deleted"));
    setTasks(prev => prev.filter(t => !idSet.has(String(t.id))));
    Promise.all(targets.map(t => api.del(`/tasks/${t.id}`)))
      .catch(fail("tasks"));
  }, [tasks, logHistory, fail]);

  const updateGoalProgress = useCallback((index, amount) => {
    const goal = goals[index];
    if (!goal) return;
    const next = Math.max(0, Math.min(goal.target, Number(goal.current || 0) + amount));
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, current: next } : g));
    api.patch(`/goals/${goal.id}`, { current: next })
      .then(server => { if (server) applyServerItem(setGoals, goal.id, server); })
      .catch(fail("goals"));
  }, [goals, applyServerItem, fail]);

  const addGoal = useCallback((goalData) => {
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const goal = { id: tempId, ...goalData, createdAt: new Date().toISOString() };
    setGoals(prev => [...prev, goal]);
    const { _createdAt, _updatedAt, id: _drop, ...payload } = goal;
    api.post("/goals", payload)
      .then(server => { if (server) applyServerItem(setGoals, tempId, server); })
      .catch(fail("goals"));
  }, [applyServerItem, fail]);

  const updateGoal = useCallback((id, patch) => {
    setGoals(prev => prev.map(g => String(g.id) === String(id) ? { ...g, ...patch } : g));
    api.patch(`/goals/${id}`, patch)
      .then(server => { if (server) applyServerItem(setGoals, id, server); })
      .catch(fail("goals"));
  }, [applyServerItem, fail]);

  const deleteGoal = useCallback((id) => {
    const goal = goals.find(g => String(g.id) === String(id));
    if (goal) {
      const index = goals.findIndex(g => String(g.id) === String(id));
      setUndoState({ type: "goal", item: goal, index, label: `Goal "${goal.name}" deleted` });
    }
    setGoals(prev => prev.filter(g => String(g.id) !== String(id)));
    api.del(`/goals/${id}`).catch(fail("goals"));
  }, [goals, fail]);

  const toggleHabitDay = useCallback((habitIndex, dayIndex) => {
    const habit = habits[habitIndex];
    if (!habit) return;
    const weekStart = getWeekStart(new Date());
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + dayIndex);
    const key = dateKeyFrom(d);
    const checked = !(habit.days && habit.days[dayIndex]);
    const days = (habit.days || Array(7).fill(false)).map((v, di) => di === dayIndex ? !v : v);
    const historySet = new Set(Array.isArray(habit.history) ? habit.history : []);
    if (checked) historySet.add(key); else historySet.delete(key);
    const historyArr = [...historySet];
    logHistory(habit.name || "Habit", checked ? "Habit Completed" : "Habit Check-in Removed");
    setHabits(prev => prev.map((h, i) => i === habitIndex ? { ...h, days, history: historyArr } : h));
    api.patch(`/habits/${habit.id}`, { days, history: historyArr })
      .then(server => { if (server) applyServerItem(setHabits, habit.id, server); })
      .catch(fail("habits"));
  }, [habits, logHistory, applyServerItem, fail]);

  const addHabit = useCallback((name) => {
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const habit = { id: tempId, name, days: Array(7).fill(false), history: [], createdAt: new Date().toISOString() };
    setHabits(prev => [...prev, habit]);
    const { _createdAt, id: _drop, ...payload } = habit;
    api.post("/habits", payload)
      .then(server => { if (server) applyServerItem(setHabits, tempId, server); })
      .catch(fail("habits"));
  }, [applyServerItem, fail]);

  const deleteHabit = useCallback((index) => {
    const habit = habits[index];
    if (habit) {
      setUndoState({ type: "habit", item: habit, index, label: `Habit "${habit.name}" deleted` });
      setHabits(prev => prev.filter((_, i) => i !== index));
      api.del(`/habits/${habit.id}`).catch(fail("habits"));
    }
  }, [habits, fail]);

  const updateMeal = useCallback((id, mealData) => {
    const meal = meals.find(m => String(m.id) === String(id));
    if (meal) logHistory(mealData.name || meal.name, "Meal Updated");
    setMeals(prev => prev.map(m => String(m.id) === String(id) ? { ...m, ...mealData, updatedAt: new Date().toISOString() } : m));
    api.patch(`/meals/${id}`, mealData)
      .then(server => { if (server) applyServerItem(setMeals, id, server); })
      .catch(fail("meals"));
  }, [meals, logHistory, applyServerItem, fail]);

  const addMeal = useCallback((mealData) => {
    const existingIdx = meals.findIndex(m => m.day === mealData.day && m.type === mealData.type);
    if (existingIdx >= 0) {
      const existing = meals[existingIdx];
      setMeals(prev => prev.map((m, i) => i === existingIdx ? { ...m, ...mealData, updatedAt: new Date().toISOString() } : m));
      api.patch(`/meals/${existing.id}`, mealData)
        .then(server => { if (server) applyServerItem(setMeals, existing.id, server); })
        .catch(fail("meals"));
      return;
    }
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const now = new Date().toISOString();
    const meal = { id: tempId, ...mealData, createdAt: now, updatedAt: now };
    setMeals(prev => [...prev, meal]);
    const { _createdAt, _updatedAt, id: _drop, ...payload } = meal;
    api.post("/meals", payload)
      .then(server => { if (server) applyServerItem(setMeals, tempId, server); })
      .catch(fail("meals"));
  }, [meals, applyServerItem, fail]);

  const deleteMeal = useCallback((id) => {
    const meal = meals.find(m => String(m.id) === String(id));
    if (meal) {
      logHistory(meal.name, "Meal Deleted");
      const index = meals.findIndex(m => String(m.id) === String(id));
      setUndoState({ type: "meal", item: meal, index, label: `Meal "${meal.name}" deleted` });
    }
    setMeals(prev => prev.filter(m => String(m.id) !== String(id)));
    api.del(`/meals/${id}`).catch(fail("meals"));
  }, [meals, logHistory, fail]);

  const setMealStatus = useCallback((id, status) => {
    const meal = meals.find(m => String(m.id) === String(id));
    if (!meal || meal.status === status) return;
    if (status === "completed") logHistory(meal.name, "Meal Completed");
    else if (status === "skipped") logHistory(meal.name, "Meal Skipped");
    setMeals(prev => prev.map(m => String(m.id) === String(id) ? { ...m, status, updatedAt: new Date().toISOString() } : m));
    api.patch(`/meals/${id}`, { status })
      .then(server => { if (server) applyServerItem(setMeals, id, server); })
      .catch(fail("meals"));
  }, [meals, logHistory, applyServerItem, fail]);

  const addNote = useCallback((noteData) => {
    const now = new Date().toISOString();
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const note = { id: tempId, ...noteData, tags: noteData.tags || [], createdAt: now, updatedAt: now };
    setNotes(prev => [...prev, note]);
    const { _createdAt, _updatedAt, id: _drop, ...payload } = note;
    api.post("/notes", payload)
      .then(server => { if (server) applyServerItem(setNotes, tempId, server); })
      .catch(fail("notes"));
  }, [applyServerItem, fail]);

  const updateNote = useCallback((id, noteData) => {
    setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...noteData, updatedAt: new Date().toISOString() } : n));
    api.patch(`/notes/${id}`, noteData)
      .then(server => { if (server) applyServerItem(setNotes, id, server); })
      .catch(fail("notes"));
  }, [applyServerItem, fail]);

  const deleteNote = useCallback((id) => {
    const note = notes.find(n => String(n.id) === String(id));
    if (note) {
      logHistory(note.title, "Note Deleted");
      const index = notes.findIndex(n => String(n.id) === String(id));
      setUndoState({ type: "note", item: note, index, label: `Note "${note.title}" deleted` });
    }
    setNotes(prev => prev.filter(n => String(n.id) !== String(id)));
    api.del(`/notes/${id}`).catch(fail("notes"));
  }, [notes, logHistory, fail]);

  const toggleNoteArchive = useCallback((id) => {
    const note = notes.find(n => String(n.id) === String(id));
    if (note) logHistory(note.title, note.archived ? "Note Restored" : "Note Archived");
    setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, archived: !n.archived, updatedAt: new Date().toISOString() } : n));
    api.patch(`/notes/${id}`, { archived: note ? !note.archived : true })
      .then(server => { if (server) applyServerItem(setNotes, id, server); })
      .catch(fail("notes"));
  }, [notes, logHistory, applyServerItem, fail]);

  const toggleNotePin = useCallback((id) => {
    const note = notes.find(n => String(n.id) === String(id));
    setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n));
    api.patch(`/notes/${id}`, { pinned: note ? !note.pinned : true })
      .then(server => { if (server) applyServerItem(setNotes, id, server); })
      .catch(fail("notes"));
  }, [notes, applyServerItem, fail]);

  const restoreNote = useCallback((id) => {
    const note = notes.find(n => String(n.id) === String(id));
    if (note) logHistory(note.title, "Note Restored");
    setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, archived: false, updatedAt: new Date().toISOString() } : n));
    api.patch(`/notes/${id}`, { archived: false })
      .then(server => { if (server) applyServerItem(setNotes, id, server); })
      .catch(fail("notes"));
  }, [notes, logHistory, applyServerItem, fail]);

  const removeHistoryItem = useCallback((index) => {
    const item = history[index];
    setHistory(prev => prev.filter((_, i) => i !== index));
    if (item) api.del(`/activityLog/${item.id}`).catch(fail("history"));
  }, [history, fail]);

  const clearHistory = useCallback(() => {
    if (confirm("Clear history archive?")) {
      setHistory([]);
      api.del("/activityLog").catch(fail("history"));
    }
  }, [fail]);

  const addCalendarEvent = useCallback((eventData) => {
    const now = new Date().toISOString();
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const event = { id: tempId, ...eventData, recurrence: eventData.recurrence || "none", overrides: {}, createdAt: now, updatedAt: now };
    logHistory(eventData.title, "Calendar Event Created");
    setCalendarEvents(prev => [...prev, event]);
    const { _createdAt, _updatedAt, id: _drop, ...payload } = event;
    api.post("/calendarEvents", sanitizeEvent(payload))
      .then(server => { if (server) applyServerItem(setCalendarEvents, tempId, server); })
      .catch(fail("calendarEvents"));
  }, [logHistory, applyServerItem, fail]);

  const updateCalendarEvent = useCallback((id, eventData) => {
    const event = calendarEvents.find(e => String(e.id) === String(id));
    if (event) logHistory(eventData.title || event.title, "Calendar Event Updated");
    setCalendarEvents(prev => prev.map(e => String(e.id) === String(id) ? { ...e, ...eventData, updatedAt: new Date().toISOString() } : e));
    api.patch(`/calendarEvents/${id}`, sanitizeEvent(eventData))
      .then(server => { if (server) applyServerItem(setCalendarEvents, id, server); })
      .catch(fail("calendarEvents"));
  }, [calendarEvents, logHistory, applyServerItem, fail]);

  const deleteCalendarEvent = useCallback((id) => {
    const event = calendarEvents.find(e => String(e.id) === String(id));
    if (event) {
      logHistory(event.title, "Calendar Event Deleted");
      const index = calendarEvents.findIndex(e => String(e.id) === String(id));
      setUndoState({ type: "event", item: event, index, label: `Event "${event.title}" deleted` });
    }
    setCalendarEvents(prev => prev.filter(e => String(e.id) !== String(id)));
    api.del(`/calendarEvents/${id}`).catch(fail("calendarEvents"));
  }, [calendarEvents, logHistory, fail]);

  const updateCalendarEventOccurrence = useCallback((originalId, dateKey, data, mode) => {
    const original = calendarEvents.find(e => String(e.id) === String(originalId));
    if (!original) return;
    logHistory(data.title || original.title, "Calendar Event Updated");
    if (mode === "all") {
      setCalendarEvents(prev => prev.map(e => String(e.id) === String(originalId) ? { ...e, ...data, start: dateKey, updatedAt: new Date().toISOString() } : e));
      api.patch(`/calendarEvents/${originalId}`, sanitizeEvent({ ...data, start: dateKey }))
        .then(server => { if (server) applyServerItem(setCalendarEvents, originalId, server); })
        .catch(fail("calendarEvents"));
      return;
    }
    if (mode === "following") {
      const before = dayBeforeKey(dateKey);
      setCalendarEvents(prev => prev.map(e => String(e.id) === String(originalId) ? { ...e, recurrenceEnd: before || e.recurrenceEnd, updatedAt: new Date().toISOString() } : e));
      api.patch(`/calendarEvents/${originalId}`, { recurrenceEnd: before || original.recurrenceEnd })
        .catch(fail("calendarEvents"));
      const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
      const now = new Date().toISOString();
      const copy = { ...original, id: tempId, ...data, start: dateKey, createdAt: now, updatedAt: now };
      setCalendarEvents(prev => [...prev, copy]);
      const { _createdAt, _updatedAt, id: _drop, overrides, ...payload } = copy;
      api.post("/calendarEvents", sanitizeEvent({ ...payload, overrides: overrides || {} }))
        .then(server => { if (server) applyServerItem(setCalendarEvents, tempId, server); })
        .catch(fail("calendarEvents"));
      return;
    }
    setCalendarEvents(prev => prev.map(e => {
      if (String(e.id) !== String(originalId)) return e;
      const overrides = { ...(e.overrides || {}) };
      overrides[dateKey] = { ...data, recurrence: "none", override: true };
      return { ...e, overrides, updatedAt: new Date().toISOString() };
    }));
    const nextOverrides = { ...(original.overrides || {}) };
    nextOverrides[dateKey] = { ...data, recurrence: "none", override: true };
    api.patch(`/calendarEvents/${originalId}`, { overrides: nextOverrides })
      .then(server => { if (server) applyServerItem(setCalendarEvents, originalId, server); })
      .catch(fail("calendarEvents"));
  }, [calendarEvents, logHistory, applyServerItem, fail]);

  const deleteCalendarEventOccurrence = useCallback((originalId, dateKey, mode) => {
    const original = calendarEvents.find(e => String(e.id) === String(originalId));
    if (!original) return;
    logHistory(original.title, "Calendar Event Deleted");
    if (mode === "all") {
      setCalendarEvents(prev => prev.filter(e => String(e.id) !== String(originalId)));
      api.del(`/calendarEvents/${originalId}`).catch(fail("calendarEvents"));
      return;
    }
    if (mode === "following") {
      const before = dayBeforeKey(dateKey);
      setCalendarEvents(prev => prev.map(e => String(e.id) === String(originalId) ? { ...e, recurrenceEnd: before || e.recurrenceEnd, updatedAt: new Date().toISOString() } : e));
      api.patch(`/calendarEvents/${originalId}`, { recurrenceEnd: before || original.recurrenceEnd })
        .catch(fail("calendarEvents"));
      return;
    }
    setCalendarEvents(prev => prev.map(e => {
      if (String(e.id) !== String(originalId)) return e;
      const overrides = { ...(e.overrides || {}) };
      overrides[dateKey] = { deleted: true };
      return { ...e, overrides, updatedAt: new Date().toISOString() };
    }));
    const nextOverrides = { ...(original.overrides || {}) };
    nextOverrides[dateKey] = { deleted: true };
    api.patch(`/calendarEvents/${originalId}`, { overrides: nextOverrides })
      .then(server => { if (server) applyServerItem(setCalendarEvents, originalId, server); })
      .catch(fail("calendarEvents"));
  }, [calendarEvents, logHistory, applyServerItem, fail]);

  const addGroceryItem = useCallback((itemData) => {
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const item = { id: tempId, ...itemData, createdAt: new Date().toISOString() };
    setGroceryList(prev => [...prev, item]);
    const { _createdAt, id: _drop, ...payload } = item;
    api.post("/groceryItems", payload)
      .then(server => { if (server) applyServerItem(setGroceryList, tempId, server); })
      .catch(fail("groceryList"));
  }, [applyServerItem, fail]);

  const updateGroceryItem = useCallback((id, itemData) => {
    setGroceryList(prev => prev.map(item => String(item.id) === String(id) ? { ...item, ...itemData } : item));
    api.patch(`/groceryItems/${id}`, itemData)
      .then(server => { if (server) applyServerItem(setGroceryList, id, server); })
      .catch(fail("groceryList"));
  }, [applyServerItem, fail]);

  const deleteGroceryItem = useCallback((id) => {
    setGroceryList(prev => prev.filter(item => String(item.id) !== String(id)));
    api.del(`/groceryItems/${id}`).catch(fail("groceryList"));
  }, [fail]);

  const toggleGroceryItem = useCallback((id) => {
    const item = groceryList.find(i => String(i.id) === String(id));
    const completed = item ? !item.completed : true;
    setGroceryList(prev => prev.map(i => String(i.id) === String(id) ? { ...i, completed } : i));
    api.patch(`/groceryItems/${id}`, { completed })
      .then(server => { if (server) applyServerItem(setGroceryList, id, server); })
      .catch(fail("groceryList"));
  }, [groceryList, applyServerItem, fail]);

  const clearPurchasedGrocery = useCallback(() => {
    if (confirm("Clear all purchased items?")) {
      const purchased = groceryList.filter(item => item.completed);
      setGroceryList(prev => prev.filter(item => !item.completed));
      Promise.all(purchased.map(item => api.del(`/groceryItems/${item.id}`)))
        .catch(fail("groceryList"));
    }
  }, [groceryList, fail]);

  const addCustomReminder = useCallback((data) => {
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const reminder = { id: tempId, ...data, type: data.type || "Custom", completed: false, createdAt: new Date().toISOString() };
    setCustomReminders(prev => [...prev, reminder]);
    const { _createdAt, id: _drop, ...payload } = reminder;
    api.post("/customReminders", payload)
      .then(server => { if (server) applyServerItem(setCustomReminders, tempId, server); })
      .catch(fail("customReminders"));
  }, [applyServerItem, fail]);

  const updateCustomReminder = useCallback((id, data) => {
    setCustomReminders(prev => prev.map(r => String(r.id) === String(id) ? { ...r, ...data } : r));
    api.patch(`/customReminders/${id}`, data)
      .then(server => { if (server) applyServerItem(setCustomReminders, id, server); })
      .catch(fail("customReminders"));
  }, [applyServerItem, fail]);

  const deleteCustomReminder = useCallback((id) => {
    const reminder = customReminders.find(r => String(r.id) === String(id));
    if (reminder) {
      const index = customReminders.findIndex(r => String(r.id) === String(id));
      setUndoState({ type: "reminder", item: reminder, index, label: `Reminder "${reminder.title}" deleted` });
    }
    setCustomReminders(prev => prev.filter(r => String(r.id) !== String(id)));
    api.del(`/customReminders/${id}`).catch(fail("customReminders"));
  }, [customReminders, fail]);

  const toggleCustomReminder = useCallback((id) => {
    const reminder = customReminders.find(r => String(r.id) === String(id));
    const completed = reminder ? !reminder.completed : true;
    setCustomReminders(prev => prev.map(r => String(r.id) === String(id) ? { ...r, completed } : r));
    api.patch(`/customReminders/${id}`, { completed })
      .then(server => { if (server) applyServerItem(setCustomReminders, id, server); })
      .catch(fail("customReminders"));
  }, [customReminders, applyServerItem, fail]);

  const UNDO_SPECS = useMemo(() => ({
    task: COLLECTIONS.find(c => c.name === "tasks"),
    note: COLLECTIONS.find(c => c.name === "notes"),
    event: COLLECTIONS.find(c => c.name === "calendarEvents"),
    meal: COLLECTIONS.find(c => c.name === "meals"),
    habit: COLLECTIONS.find(c => c.name === "habits"),
    goal: COLLECTIONS.find(c => c.name === "goals"),
    reminder: COLLECTIONS.find(c => c.name === "customReminders")
  }), []);

  const undoLastDeletion = useCallback(() => {
    if (!undoState) return false;
    const { type, item, index, label } = undoState;
    const spec = UNDO_SPECS[type];
    if (!spec) return false;
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const setter = setters[spec.name];
    setter(prev => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, { ...item, id: tempId });
      return next;
    });
    const { _createdAt, _updatedAt, id: _drop, ...payload } = item;
    api.post(spec.path, payload)
      .then(server => { if (server) applyServerItem(setter, tempId, server); })
      .catch(fail(spec.name));
    logHistory(label.replace(" deleted", ""), "Restored");
    setUndoState(null);
    return true;
  }, [undoState, UNDO_SPECS, setters, applyServerItem, fail, logHistory]);

  const exportData = useCallback(() => {
    return JSON.stringify({
      app: "life-organizer",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders, settings
      }
    }, null, 2);
  }, [tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders, settings]);

  const importData = useCallback((json) => {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, errors: ["File is not valid JSON."] };
    }
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, errors: ["Invalid backup structure."] };
    }
    const raw = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
    const collections = ["tasks", "history", "goals", "notes", "habits", "meals", "calendarEvents", "groceryList", "customReminders"];
    const invalid = collections.filter(key => raw[key] !== undefined && !Array.isArray(raw[key]));
    if (invalid.length) {
      return { ok: false, errors: [`Invalid data: "${invalid.join('", "')}" must be an array.`] };
    }
    return { ok: true, data: raw };
  }, []);

  const replaceAllData = useCallback((data) => {
    const present = COLLECTIONS.filter(c => Array.isArray(data[c.name]));
    present.forEach(c => setters[c.name](c.migrate ? c.migrate(data[c.name]) : data[c.name]));
    if (data.settings && typeof data.settings === "object") setSettingsState(migrateSettings(data.settings));
    return (async () => {
      for (const c of present) {
        const current = await api.get(c.path).catch(() => []);
        for (const row of current) {
          await api.del(`${c.path}/${row.id}`).catch(() => {});
        }
      }
      const payload = {};
      present.forEach(c => { payload[c.migrateName] = c.migrate ? c.migrate(data[c.name]) : data[c.name]; });
      await api.post("/migrate", payload);
      await Promise.all(present.map(c => reloadCollection(c.name)));
    })().catch(() => {
      Promise.all(present.map(c => reloadCollection(c.name)));
    });
  }, [setters, reloadCollection]);

  const mergeData = useCallback((data) => {
    const result = { tasks: 0, events: 0, notes: 0, habits: 0, meals: 0, groceries: 0, goals: 0, history: 0, reminders: 0 };
    const resultKey = {
      tasks: "tasks", calendarEvents: "events", notes: "notes", habits: "habits",
      meals: "meals", groceryList: "groceries", goals: "goals", history: "history", customReminders: "reminders"
    };
    const payload = {};
    for (const c of COLLECTIONS) {
      if (!Array.isArray(data[c.name]) || data[c.name].length === 0) continue;
      const mapped = c.migrate ? c.migrate(data[c.name]) : data[c.name];
      const existingIds = new Set((stateRef.current[c.name] || []).map(x => String(x.id)));
      const fresh = mapped.filter(x => !existingIds.has(String(x.id)));
      if (fresh.length > 0) {
        payload[c.migrateName] = fresh;
        result[resultKey[c.name]] = fresh.length;
      }
    }
    if (Object.keys(payload).length > 0) {
      api.post("/migrate", payload)
        .then(() => Promise.all(Object.keys(payload).map(n => {
          const spec = COLLECTIONS.find(c => c.migrateName === n);
          return spec ? reloadCollection(spec.name) : null;
        })))
        .catch(() => {});
    }
    return result;
  }, [reloadCollection]);

  return {
    tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders,
    settings, setSettings,
    user, authStatus, authError, login, register, logout, retryAuth: boot,
    toggleTaskCompletion, deleteTask, isTaskOverdue,
    addOrUpdateTask, bulkCompleteTasks, bulkDeleteTasks,
    updateGoalProgress, updateGoal, addGoal, deleteGoal,
    toggleHabitDay, addHabit, deleteHabit,
    updateMeal, addMeal, deleteMeal, setMealStatus,
    addNote, updateNote, deleteNote, toggleNoteArchive, restoreNote, toggleNotePin,
    removeHistoryItem, clearHistory, logHistory,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    updateCalendarEventOccurrence, deleteCalendarEventOccurrence,
    addGroceryItem, updateGroceryItem, deleteGroceryItem, toggleGroceryItem, clearPurchasedGrocery,
    addCustomReminder, updateCustomReminder, deleteCustomReminder, toggleCustomReminder,
    undoState, undoLastDeletion,
    exportData, importData, replaceAllData, mergeData,
    formatDateKey, escapeHtml, priorityClass, priorityLabel, reminderLabel,
    DAY_NAMES
  };
}
