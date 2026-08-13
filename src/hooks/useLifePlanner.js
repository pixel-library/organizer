import { useState, useEffect, useCallback } from "react";

const STORAGE_KEYS = {
  tasks: "life_planner_tasks",
  history: "life_planner_history",
  goals: "life_planner_goals",
  notes: "life_planner_notes",
  habits: "life_planner_habits",
  meals: "life_planner_meals",
  calendarEvents: "life_planner_calendar_events",
  groceryList: "life_planner_grocery_list"
};

const seedDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const pad = (n) => String(n).padStart(2, "0");
const dateKeyFrom = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

const defaultTasks = [
  { id: 1, name: "Morning Code Review", date: seedDate(0), time: "09:00", priority: "Red", reminder: "10min", completed: false, type: "Task" },
  { id: 2, name: "Client Sync Meeting", date: seedDate(1), time: "14:30", priority: "Yellow", reminder: "exact", completed: false, type: "Meeting" },
  { id: 3, name: "Gym Session", date: seedDate(2), time: "18:00", priority: "Green", reminder: "30min", completed: false, type: "Task" }
];

const defaultHistory = [
  { id: 101, name: "Workspace Initialized", timestamp: "January 25, 2026, 10:00 AM", status: "Created" }
];

const defaultGoals = [
  { id: 1, name: "Complete Full-Stack Project", target: 10, current: 7, unit: "Modules" },
  { id: 2, name: "Read Productivity Books", target: 5, current: 3, unit: "Books" }
];

const migrateNotes = (notes) => {
  if (!Array.isArray(notes)) return [];
  return notes.map(n => ({
    id: n.id || Date.now() + Math.random(),
    title: n.title || "",
    content: n.content || "",
    category: n.category || "Personal",
    pinned: !!n.pinned,
    archived: !!n.archived,
    createdAt: n.createdAt || new Date().toISOString(),
    updatedAt: n.updatedAt || new Date().toISOString()
  }));
};

const defaultNotes = [
  { id: 1, title: "Project Ideas", content: "Build a modular life control OS with integrated calendar sync and habit tracking.", category: "Work", pinned: true, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, title: "Weekly Goals", content: "Focus on core system performance and priority matrix accuracy.", category: "Personal", pinned: false, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const defaultHabits = [
  { id: 1, name: "Drink 3L Water", days: [true, false, true, true, false, false, false] },
  { id: 2, name: "Read 20 Pages", days: [true, true, true, false, false, false, false] }
];

const migrateMeals = (meals) => {
  if (!Array.isArray(meals)) return [];
  return meals.map((m, idx) => {
    const day = m.day || ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][idx % 7];
    return {
      id: m.id || Date.now() + idx,
      date: m.date || seedDate(0),
      type: m.type || "Meal",
      name: m.name || day,
      time: m.time || "08:00",
      calories: m.calories || null,
      protein: m.protein || null,
      carbohydrates: m.carbohydrates || null,
      fat: m.fat || null,
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
    id: e.id || Date.now() + Math.random(),
    title: e.title || "",
    start: e.start || seedDate(0),
    end: e.end || e.start || seedDate(0),
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

const defaultMeals = [
  { id: 1, date: seedDate(0), type: "Meal", name: "Monday", time: "08:00", calories: null, protein: null, carbohydrates: null, fat: null, ingredients: [], notes: "", status: "planned", day: "Monday", breakfast: "Oatmeal & Berries", lunch: "Grilled Chicken Salad", dinner: "Salmon & Quinoa", snack: "Almonds", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, date: seedDate(1), type: "Meal", name: "Tuesday", time: "08:00", calories: null, protein: null, carbohydrates: null, fat: null, ingredients: [], notes: "", status: "planned", day: "Tuesday", breakfast: "Eggs & Toast", lunch: "Turkey Wrap", dinner: "Steak & Asparagus", snack: "Greek Yogurt", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const defaultCalendarEvents = [];
const defaultGroceryList = [];

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const parsed = JSON.parse(stored);
    if (key === STORAGE_KEYS.notes) return migrateNotes(parsed);
    if (key === STORAGE_KEYS.meals) return migrateMeals(parsed);
    if (key === STORAGE_KEYS.calendarEvents) return migrateCalendarEvents(parsed);
    return parsed;
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useLifePlanner() {
  const [tasks, setTasks] = useState(() => loadFromStorage(STORAGE_KEYS.tasks, defaultTasks));
  const [history, setHistory] = useState(() => loadFromStorage(STORAGE_KEYS.history, defaultHistory));
  const [goals, setGoals] = useState(() => loadFromStorage(STORAGE_KEYS.goals, defaultGoals));
  const [notes, setNotes] = useState(() => loadFromStorage(STORAGE_KEYS.notes, defaultNotes));
  const [habits, setHabits] = useState(() => loadFromStorage(STORAGE_KEYS.habits, defaultHabits));
  const [meals, setMeals] = useState(() => loadFromStorage(STORAGE_KEYS.meals, defaultMeals));
  const [calendarEvents, setCalendarEvents] = useState(() => loadFromStorage(STORAGE_KEYS.calendarEvents, defaultCalendarEvents));
  const [groceryList, setGroceryList] = useState(() => loadFromStorage(STORAGE_KEYS.groceryList, defaultGroceryList));

  const persistAll = useCallback(() => {
    saveToStorage(STORAGE_KEYS.tasks, tasks);
    saveToStorage(STORAGE_KEYS.history, history);
    saveToStorage(STORAGE_KEYS.goals, goals);
    saveToStorage(STORAGE_KEYS.notes, notes);
    saveToStorage(STORAGE_KEYS.habits, habits);
    saveToStorage(STORAGE_KEYS.meals, meals);
    saveToStorage(STORAGE_KEYS.calendarEvents, calendarEvents);
    saveToStorage(STORAGE_KEYS.groceryList, groceryList);
  }, [tasks, history, goals, notes, habits, meals, calendarEvents, groceryList]);

  useEffect(() => { persistAll(); }, [persistAll]);

  const formatDateKey = useCallback((date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
    setHistory(prev => [{ id: Date.now(), name, timestamp, status }, ...prev]);
  }, []);

  const toggleTaskCompletion = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      logHistory(task.name, task.completed ? "Reopened" : "Completed");
    }
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, completed: !t.completed };
    }));
  }, [tasks, logHistory]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) logHistory(task.name, "Deleted");
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [tasks, logHistory]);

  const isTaskOverdue = useCallback((task) => {
    if (task.completed) return false;
    const now = new Date();
    const due = new Date(`${task.date}T${task.time || "23:59"}`);
    return due.getTime() < now.getTime();
  }, []);

  const addOrUpdateTask = useCallback((taskData) => {
    if (taskData.editingId) {
      const oldTask = tasks.find(t => t.id === taskData.editingId);
      if (oldTask) {
        const oldName = oldTask.name;
        logHistory(taskData.name, oldName === taskData.name ? "Updated" : `Renamed from ${oldName}`);
      }
      setTasks(prev => prev.map(t => t.id === taskData.editingId ? { ...t, ...taskData } : t));
      return;
    }
    const newTask = { id: Date.now(), ...taskData, completed: false };
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
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, completed: true } : t));
  }, [tasks, logHistory]);

  const bulkDeleteTasks = useCallback((ids) => {
    ids.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task) logHistory(task.name, "Deleted");
    });
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
  }, [tasks, logHistory]);

  const updateGoalProgress = useCallback((index, amount) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, current: Math.min(g.target, g.current + amount) } : g));
  }, []);

  const addGoal = useCallback((goalData) => {
    setGoals(prev => [...prev, { id: Date.now(), ...goalData }]);
  }, []);

  const deleteGoal = useCallback((index) => {
    setGoals(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleHabitDay = useCallback((habitIndex, dayIndex) => {
    setHabits(prev => prev.map((h, i) => i === habitIndex ? { ...h, days: h.days.map((d, di) => di === dayIndex ? !d : d) } : h));
  }, []);

  const addHabit = useCallback((name) => {
    setHabits(prev => [...prev, { id: Date.now(), name, days: Array(7).fill(false) }]);
  }, []);

  const deleteHabit = useCallback((index) => {
    setHabits(prev => prev.filter((_, i) => i !== index));
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
    if (meal) logHistory(meal.name, "Meal Deleted");
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
    setNotes(prev => [...prev, { id: Date.now(), ...noteData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  }, []);

  const updateNote = useCallback((id, noteData) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...noteData, updatedAt: new Date().toISOString() } : n));
  }, []);

  const deleteNote = useCallback((id) => {
    const note = notes.find(n => n.id === id);
    if (note) logHistory(note.title, "Note Deleted");
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
    logHistory(eventData.title, "Calendar Event Created");
    setCalendarEvents(prev => [...prev, { id: Date.now(), ...eventData, recurrence: eventData.recurrence || "none", overrides: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  }, [logHistory]);

  const updateCalendarEvent = useCallback((id, eventData) => {
    const event = calendarEvents.find(e => e.id === id);
    if (event) logHistory(eventData.title || event.title, "Calendar Event Updated");
    setCalendarEvents(prev => prev.map(e => e.id === id ? { ...e, ...eventData, updatedAt: new Date().toISOString() } : e));
  }, [calendarEvents, logHistory]);

  const deleteCalendarEvent = useCallback((id) => {
    const event = calendarEvents.find(e => e.id === id);
    if (event) logHistory(event.title, "Calendar Event Deleted");
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

  return {
    tasks, history, goals, notes, habits, meals, calendarEvents, groceryList,
    toggleTaskCompletion, deleteTask, isTaskOverdue,
    addOrUpdateTask, bulkCompleteTasks, bulkDeleteTasks,
    updateGoalProgress, addGoal, deleteGoal,
    toggleHabitDay, addHabit, deleteHabit,
    updateMeal, addMeal, deleteMeal, setMealStatus,
    addNote, updateNote, deleteNote, toggleNoteArchive, restoreNote, toggleNotePin,
    removeHistoryItem, clearHistory, logHistory,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    updateCalendarEventOccurrence, deleteCalendarEventOccurrence,
    addGroceryItem, updateGroceryItem, deleteGroceryItem, toggleGroceryItem, clearPurchasedGrocery,
    formatDateKey, escapeHtml, priorityClass, priorityLabel, reminderLabel
  };
}
