import { useState, useEffect, useCallback } from "react";

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
const todayKey = () => dateKeyFrom(new Date());
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

const defaultTasks = [];
const defaultHistory = [];
const defaultGoals = [];
const defaultNotes = [];
const defaultHabits = [];
const defaultMeals = [];
const defaultCalendarEvents = [];
const defaultGroceryList = [];
const defaultCustomReminders = [];
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

export function useLifePlanner() {
  const [tasks, setTasks] = useState(() => loadFromStorage(STORAGE_KEYS.tasks, defaultTasks, migrateTasks));
  const [history, setHistory] = useState(() => loadFromStorage(STORAGE_KEYS.history, defaultHistory));
  const [goals, setGoals] = useState(() => loadFromStorage(STORAGE_KEYS.goals, defaultGoals));
  const [notes, setNotes] = useState(() => loadFromStorage(STORAGE_KEYS.notes, defaultNotes, migrateNotes));
  const [habits, setHabits] = useState(() => loadFromStorage(STORAGE_KEYS.habits, defaultHabits, migrateHabits));
  const [meals, setMeals] = useState(() => loadFromStorage(STORAGE_KEYS.meals, defaultMeals, migrateMeals));
  const [calendarEvents, setCalendarEvents] = useState(() => loadFromStorage(STORAGE_KEYS.calendarEvents, defaultCalendarEvents, migrateCalendarEvents));
  const [groceryList, setGroceryList] = useState(() => loadFromStorage(STORAGE_KEYS.groceryList, defaultGroceryList));
  const [customReminders, setCustomReminders] = useState(() => loadFromStorage(STORAGE_KEYS.customReminders, defaultCustomReminders, migrateReminders));
  const [settings, setSettingsState] = useState(() => loadFromStorage(STORAGE_KEYS.settings, defaultSettings, migrateSettings));
  const [undoState, setUndoState] = useState(null);

  const persistAll = useCallback(() => {
    saveToStorage(STORAGE_KEYS.tasks, tasks);
    saveToStorage(STORAGE_KEYS.history, history);
    saveToStorage(STORAGE_KEYS.goals, goals);
    saveToStorage(STORAGE_KEYS.notes, notes);
    saveToStorage(STORAGE_KEYS.habits, habits);
    saveToStorage(STORAGE_KEYS.meals, meals);
    saveToStorage(STORAGE_KEYS.calendarEvents, calendarEvents);
    saveToStorage(STORAGE_KEYS.groceryList, groceryList);
    saveToStorage(STORAGE_KEYS.customReminders, customReminders);
    saveToStorage(STORAGE_KEYS.settings, settings);
  }, [tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders, settings]);

  useEffect(() => { persistAll(); }, [persistAll]);

  const setSettings = useCallback((patch) => {
    setSettingsState(prev => ({ ...prev, ...patch }));
  }, []);

  const formatDateKey = useCallback((date) => {
    return dateKeyFrom(date);
  }, []);

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
    setHistory(prev => [{ id: Date.now() + Math.random(), name, timestamp, status }, ...prev]);
  }, []);

  const toggleTaskCompletion = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      logHistory(task.name, task.completed ? "Reopened" : "Completed");
    }
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, completed: !t.completed, updatedAt: new Date().toISOString() };
    }));
  }, [tasks, logHistory]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      logHistory(task.name, "Deleted");
      const index = tasks.findIndex(t => t.id === id);
      setUndoState({ type: "task", item: task, index, label: `Task "${task.name}" deleted` });
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [tasks, logHistory]);

  const isTaskOverdue = useCallback((task) => {
    if (task.completed) return false;
    if (!task.date) return false;
    const now = new Date();
    const due = new Date(`${task.date}T${task.time || "23:59"}`);
    return !isNaN(due.getTime()) && due.getTime() < now.getTime();
  }, []);

  const addOrUpdateTask = useCallback((taskData) => {
    if (taskData.editingId) {
      const oldTask = tasks.find(t => t.id === taskData.editingId);
      if (oldTask) {
        const oldName = oldTask.name;
        logHistory(taskData.name, oldName === taskData.name ? "Updated" : `Renamed from ${oldName}`);
      }
      setTasks(prev => prev.map(t => t.id === taskData.editingId ? { ...t, ...taskData, editingId: undefined, updatedAt: new Date().toISOString() } : t));
      return;
    }
    const now = new Date().toISOString();
    const newTask = { id: Date.now(), ...taskData, completed: false, createdAt: now, updatedAt: now };
    logHistory(newTask.name, "Created");
    setTasks(prev => [...prev, newTask]);
  }, [tasks, logHistory]);

  const bulkCompleteTasks = useCallback((ids) => {
    const pending = tasks.filter(t => ids.includes(t.id) && !t.completed);
    if (pending.length === 0) {
      alert("All selected tasks are already completed.");
      return;
    }
    pending.forEach(t => logHistory(t.name, "Completed"));
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, completed: true, updatedAt: new Date().toISOString() } : t));
  }, [tasks, logHistory]);

  const bulkDeleteTasks = useCallback((ids) => {
    ids.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task) logHistory(task.name, "Deleted");
    });
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
  }, [tasks, logHistory]);

  const updateGoalProgress = useCallback((index, amount) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, current: Math.max(0, Math.min(g.target, Number(g.current || 0) + amount)) } : g));
  }, []);

  const addGoal = useCallback((goalData) => {
    setGoals(prev => [...prev, { id: Date.now(), ...goalData, createdAt: new Date().toISOString() }]);
  }, []);

  const updateGoal = useCallback((id, patch) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  }, []);

  const deleteGoal = useCallback((id) => {
    const goal = goals.find(g => g.id === id);
    if (goal) {
      const index = goals.findIndex(g => g.id === id);
      setUndoState({ type: "goal", item: goal, index, label: `Goal "${goal.name}" deleted` });
    }
    setGoals(prev => prev.filter(g => g.id !== id));
  }, [goals]);

  const toggleHabitDay = useCallback((habitIndex, dayIndex) => {
    const weekStart = getWeekStart(new Date());
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + dayIndex);
    const key = dateKeyFrom(d);
    setHabits(prev => prev.map((h, i) => {
      if (i !== habitIndex) return h;
      const days = h.days.map((v, di) => di === dayIndex ? !v : v);
      const historySet = new Set(Array.isArray(h.history) ? h.history : []);
      if (days[dayIndex]) historySet.add(key); else historySet.delete(key);
      const name = h.name || "Habit";
      logHistory(name, days[dayIndex] ? "Habit Completed" : "Habit Check-in Removed");
      return { ...h, days, history: [...historySet] };
    }));
  }, [logHistory]);

  const addHabit = useCallback((name) => {
    setHabits(prev => [...prev, { id: Date.now(), name, days: Array(7).fill(false), history: [], createdAt: new Date().toISOString() }]);
  }, []);

  const deleteHabit = useCallback((index) => {
    setHabits(prev => {
      const target = prev[index];
      if (target) setUndoState({ type: "habit", item: target, index, label: `Habit "${target.name}" deleted` });
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateMeal = useCallback((id, mealData) => {
    const meal = meals.find(m => m.id === id);
    if (meal) logHistory(mealData.name || meal.name, "Meal Updated");
    setMeals(prev => prev.map(m => m.id === id ? { ...m, ...mealData, updatedAt: new Date().toISOString() } : m));
  }, [meals, logHistory]);

  const addMeal = useCallback((mealData) => {
    setMeals(prev => {
      const idx = prev.findIndex(m => m.day === mealData.day && m.type === mealData.type);
      if (idx >= 0) {
        return prev.map((m, i) => i === idx ? { ...m, ...mealData, updatedAt: new Date().toISOString() } : m);
      }
      return [...prev, { id: Date.now(), ...mealData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    });
  }, []);

  const deleteMeal = useCallback((id) => {
    const meal = meals.find(m => m.id === id);
    if (meal) {
      logHistory(meal.name, "Meal Deleted");
      const index = meals.findIndex(m => m.id === id);
      setUndoState({ type: "meal", item: meal, index, label: `Meal "${meal.name}" deleted` });
    }
    setMeals(prev => prev.filter(m => m.id !== id));
  }, [meals, logHistory]);

  const setMealStatus = useCallback((id, status) => {
    const meal = meals.find(m => m.id === id);
    if (!meal || meal.status === status) return;
    if (status === "completed") logHistory(meal.name, "Meal Completed");
    else if (status === "skipped") logHistory(meal.name, "Meal Skipped");
    setMeals(prev => prev.map(m => m.id === id ? { ...m, status, updatedAt: new Date().toISOString() } : m));
  }, [meals, logHistory]);

  const addNote = useCallback((noteData) => {
    const now = new Date().toISOString();
    setNotes(prev => [...prev, { id: Date.now(), ...noteData, tags: noteData.tags || [], createdAt: now, updatedAt: now }]);
  }, []);

  const updateNote = useCallback((id, noteData) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...noteData, updatedAt: new Date().toISOString() } : n));
  }, []);

  const deleteNote = useCallback((id) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      logHistory(note.title, "Note Deleted");
      const index = notes.findIndex(n => n.id === id);
      setUndoState({ type: "note", item: note, index, label: `Note "${note.title}" deleted` });
    }
    setNotes(prev => prev.filter(n => n.id !== id));
  }, [notes, logHistory]);

  const toggleNoteArchive = useCallback((id) => {
    const note = notes.find(n => n.id === id);
    if (note) logHistory(note.title, note.archived ? "Note Restored" : "Note Archived");
    setNotes(prev => prev.map(n => n.id === id ? { ...n, archived: !n.archived, updatedAt: new Date().toISOString() } : n));
  }, [notes, logHistory]);

  const toggleNotePin = useCallback((id) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n));
  }, []);

  const restoreNote = useCallback((id) => {
    const note = notes.find(n => n.id === id);
    if (note) logHistory(note.title, "Note Restored");
    setNotes(prev => prev.map(n => n.id === id ? { ...n, archived: false, updatedAt: new Date().toISOString() } : n));
  }, [notes, logHistory]);

  const removeHistoryItem = useCallback((index) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearHistory = useCallback(() => {
    if (confirm("Clear history archive?")) {
      setHistory([]);
    }
  }, []);

  const addCalendarEvent = useCallback((eventData) => {
    const now = new Date().toISOString();
    logHistory(eventData.title, "Calendar Event Created");
    setCalendarEvents(prev => [...prev, { id: Date.now(), ...eventData, recurrence: eventData.recurrence || "none", overrides: {}, createdAt: now, updatedAt: now }]);
  }, [logHistory]);

  const updateCalendarEvent = useCallback((id, eventData) => {
    const event = calendarEvents.find(e => e.id === id);
    if (event) logHistory(eventData.title || event.title, "Calendar Event Updated");
    setCalendarEvents(prev => prev.map(e => e.id === id ? { ...e, ...eventData, updatedAt: new Date().toISOString() } : e));
  }, [calendarEvents, logHistory]);

  const deleteCalendarEvent = useCallback((id) => {
    const event = calendarEvents.find(e => e.id === id);
    if (event) {
      logHistory(event.title, "Calendar Event Deleted");
      const index = calendarEvents.findIndex(e => e.id === id);
      setUndoState({ type: "event", item: event, index, label: `Event "${event.title}" deleted` });
    }
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
  }, [calendarEvents, logHistory]);

  const updateCalendarEventOccurrence = useCallback((originalId, dateKey, data, mode) => {
    const original = calendarEvents.find(e => e.id === originalId);
    if (!original) return;
    logHistory(data.title || original.title, "Calendar Event Updated");
    if (mode === "all") {
      setCalendarEvents(prev => prev.map(e => e.id === originalId ? { ...e, ...data, start: dateKey, updatedAt: new Date().toISOString() } : e));
      return;
    }
    if (mode === "following") {
      const before = dayBeforeKey(dateKey);
      const copy = { ...original, id: Date.now(), ...data, start: dateKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setCalendarEvents(prev => [
        ...prev.map(e => e.id === originalId ? { ...e, recurrenceEnd: before || e.recurrenceEnd, updatedAt: new Date().toISOString() } : e),
        copy
      ]);
      return;
    }
    setCalendarEvents(prev => prev.map(e => {
      if (e.id !== originalId) return e;
      const overrides = { ...(e.overrides || {}) };
      overrides[dateKey] = { ...data, recurrence: "none", override: true };
      return { ...e, overrides, updatedAt: new Date().toISOString() };
    }));
  }, [calendarEvents, logHistory]);

  const deleteCalendarEventOccurrence = useCallback((originalId, dateKey, mode) => {
    const original = calendarEvents.find(e => e.id === originalId);
    if (!original) return;
    logHistory(original.title, "Calendar Event Deleted");
    if (mode === "all") {
      setCalendarEvents(prev => prev.filter(e => e.id !== originalId));
      return;
    }
    if (mode === "following") {
      const before = dayBeforeKey(dateKey);
      setCalendarEvents(prev => prev.map(e => e.id === originalId ? { ...e, recurrenceEnd: before || e.recurrenceEnd, updatedAt: new Date().toISOString() } : e));
      return;
    }
    setCalendarEvents(prev => prev.map(e => {
      if (e.id !== originalId) return e;
      const overrides = { ...(e.overrides || {}) };
      overrides[dateKey] = { deleted: true };
      return { ...e, overrides, updatedAt: new Date().toISOString() };
    }));
  }, [calendarEvents, logHistory]);

  const addGroceryItem = useCallback((itemData) => {
    setGroceryList(prev => [...prev, { id: Date.now(), ...itemData, createdAt: new Date().toISOString() }]);
  }, []);

  const updateGroceryItem = useCallback((id, itemData) => {
    setGroceryList(prev => prev.map(item => item.id === id ? { ...item, ...itemData } : item));
  }, []);

  const deleteGroceryItem = useCallback((id) => {
    setGroceryList(prev => prev.filter(item => item.id !== id));
  }, []);

  const toggleGroceryItem = useCallback((id) => {
    setGroceryList(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  }, []);

  const clearPurchasedGrocery = useCallback(() => {
    if (confirm("Clear all purchased items?")) {
      setGroceryList(prev => prev.filter(item => !item.completed));
    }
  }, []);

  const addCustomReminder = useCallback((data) => {
    setCustomReminders(prev => [...prev, { id: Date.now(), ...data, type: data.type || "Custom", completed: false, createdAt: new Date().toISOString() }]);
  }, []);

  const updateCustomReminder = useCallback((id, data) => {
    setCustomReminders(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  }, []);

  const deleteCustomReminder = useCallback((id) => {
    const reminder = customReminders.find(r => r.id === id);
    if (reminder) {
      const index = customReminders.findIndex(r => r.id === id);
      setUndoState({ type: "reminder", item: reminder, index, label: `Reminder "${reminder.title}" deleted` });
    }
    setCustomReminders(prev => prev.filter(r => r.id !== id));
  }, [customReminders]);

  const toggleCustomReminder = useCallback((id) => {
    setCustomReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  }, []);

  const undoLastDeletion = useCallback(() => {
    if (!undoState) return false;
    const { type, item, index } = undoState;
    if (type === "task") {
      setTasks(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "note") {
      setNotes(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "event") {
      setCalendarEvents(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "meal") {
      setMeals(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "habit") {
      setHabits(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "goal") {
      setGoals(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    } else if (type === "reminder") {
      setCustomReminders(prev => {
        const next = [...prev];
        const at = Math.min(index, next.length);
        next.splice(at, 0, item);
        return next;
      });
    }
    logHistory(undoState.label.replace(" deleted", ""), "Restored");
    setUndoState(null);
    return true;
  }, [undoState, logHistory]);

  const exportData = useCallback(() => {
    return JSON.stringify({
      app: "life-organizer",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        tasks,
        history,
        goals,
        notes,
        habits,
        meals,
        calendarEvents,
        groceryList,
        customReminders,
        settings
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
    if (Array.isArray(data.tasks)) setTasks(migrateTasks(data.tasks));
    if (Array.isArray(data.history)) setHistory(data.history);
    if (Array.isArray(data.goals)) setGoals(data.goals);
    if (Array.isArray(data.notes)) setNotes(migrateNotes(data.notes));
    if (Array.isArray(data.habits)) setHabits(migrateHabits(data.habits));
    if (Array.isArray(data.meals)) setMeals(migrateMeals(data.meals));
    if (Array.isArray(data.calendarEvents)) setCalendarEvents(migrateCalendarEvents(data.calendarEvents));
    if (Array.isArray(data.groceryList)) setGroceryList(data.groceryList);
    if (Array.isArray(data.customReminders)) setCustomReminders(migrateReminders(data.customReminders));
    if (data.settings && typeof data.settings === "object") setSettingsState(migrateSettings(data.settings));
  }, []);

  const mergeData = useCallback((data) => {
    const mergeCollection = (current, incoming, migrate) => {
      const mapped = migrate ? migrate(incoming) : incoming;
      const existingIds = new Set(current.map(item => item.id));
      const merged = [...current];
      let added = 0;
      let skipped = 0;
      mapped.forEach(item => {
        if (item.id != null && existingIds.has(item.id)) {
          skipped += 1;
          return;
        }
        merged.push(item);
        if (item.id != null) existingIds.add(item.id);
        added += 1;
      });
      return { merged, added, skipped };
    };
    const result = { tasks: 0, events: 0, notes: 0, habits: 0, meals: 0, groceries: 0, goals: 0, history: 0, reminders: 0 };
    if (Array.isArray(data.tasks)) { const r = mergeCollection(tasks, data.tasks, migrateTasks); setTasks(r.merged); result.tasks = r.added; }
    if (Array.isArray(data.calendarEvents)) { const r = mergeCollection(calendarEvents, data.calendarEvents, migrateCalendarEvents); setCalendarEvents(r.merged); result.events = r.added; }
    if (Array.isArray(data.notes)) { const r = mergeCollection(notes, data.notes, migrateNotes); setNotes(r.merged); result.notes = r.added; }
    if (Array.isArray(data.habits)) { const r = mergeCollection(habits, data.habits, migrateHabits); setHabits(r.merged); result.habits = r.added; }
    if (Array.isArray(data.meals)) { const r = mergeCollection(meals, data.meals, migrateMeals); setMeals(r.merged); result.meals = r.added; }
    if (Array.isArray(data.groceryList)) { const r = mergeCollection(groceryList, data.groceryList); setGroceryList(r.merged); result.groceries = r.added; }
    if (Array.isArray(data.goals)) { const r = mergeCollection(goals, data.goals); setGoals(r.merged); result.goals = r.added; }
    if (Array.isArray(data.history)) { const r = mergeCollection(history, data.history); setHistory(r.merged); result.history = r.added; }
    if (Array.isArray(data.customReminders)) { const r = mergeCollection(customReminders, data.customReminders, migrateReminders); setCustomReminders(r.merged); result.reminders = r.added; }
    return result;
  }, [tasks, calendarEvents, notes, habits, meals, groceryList, goals, history, customReminders]);

  return {
    tasks, history, goals, notes, habits, meals, calendarEvents, groceryList, customReminders,
    settings, setSettings,
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
