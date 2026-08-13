import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CATEGORIES = ["Personal", "Work", "Study", "Health", "Other", "Task", "Meal", "Habit"];

const categoryColors = {
  Personal: "#5aa7ff",
  Work: "#ef4444",
  Study: "#8b7cff",
  Health: "#22c55e",
  Other: "#eab308",
  Task: "#c0c0c0",
  Meal: "#f59e0b",
  Habit: "#ec4899"
};

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_INDEX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_PX = 48;

const pad2 = (n) => String(n).padStart(2, "0");
const dateKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDateKey = (key) => {
  const parts = String(key || "").split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fromTime = (t) => {
  const parts = String(t || "00:00").split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};
const minutesToTime = (m) => `${pad2(Math.floor(m / 60))}:${pad2(Math.round(m % 60))}`;
const timeFromY = (y) => {
  const minutes = START_HOUR * 60 + (y / HOUR_PX) * 60;
  return clamp(Math.round(minutes / 30) * 30, START_HOUR * 60, END_HOUR * 60);
};

function matchesRule(event, date, start) {
  if (dateKeyOf(date) === dateKeyOf(start)) return true;
  switch (event.recurrence) {
    case "daily": return true;
    case "weekly": return date.getDay() === start.getDay();
    case "monthly": return date.getDate() === start.getDate();
    case "yearly": return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    case "custom": return (event.customWeekdays || []).includes(SHORT_WEEKDAYS[date.getDay()]);
    default: return false;
  }
}

function getOccurrenceDates(event, fromKey, toKey) {
  const start = parseDateKey(event.start);
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const endLimit = event.recurrenceEnd ? parseDateKey(event.recurrenceEnd) : null;
  if (!start || !from || !to) return [];
  const results = [];
  const cur = new Date(start);
  let guard = 0;
  while (guard < 5000) {
    if (cur > to) break;
    if (endLimit && cur > endLimit) break;
    const key = dateKeyOf(cur);
    if (key >= fromKey && matchesRule(event, cur, start)) results.push(key);
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return results;
}

function expandRecurringEvents(events, fromKey, toKey) {
  const out = [];
  (events || []).forEach(e => {
    if (e.recurrence && e.recurrence !== "none") {
      const dates = getOccurrenceDates(e, fromKey, toKey);
      dates.forEach(dateKey => {
        const override = (e.overrides || {})[dateKey];
        if (override && override.deleted) return;
        out.push({
          ...e,
          ...(override && !override.deleted ? override : {}),
          id: `${e.id}|${dateKey}`,
          start: dateKey,
          end: dateKey,
          originalId: e.id,
          instanceDate: dateKey,
          isOccurrence: true
        });
      });
    } else {
      out.push({ ...e, originalId: e.id, instanceDate: null });
    }
  });
  return out;
}

function buildMealEvents(meals, fromKey, toKey) {
  const out = [];
  (meals || []).forEach(m => {
    if (!m.time) return;
    if (m.date && m.date >= fromKey && m.date <= toKey) {
      out.push(mealToEvent(m, m.date));
      return;
    }
    const dayIdx = DAY_INDEX[m.day];
    if (dayIdx === undefined) return;
    const cur = parseDateKey(fromKey);
    const to = parseDateKey(toKey);
    while (cur && to && cur <= to) {
      const dow = (cur.getDay() + 6) % 7;
      if (dow === dayIdx) out.push(mealToEvent(m, dateKeyOf(cur)));
      cur.setDate(cur.getDate() + 1);
    }
  });
  return out;
}

function mealToEvent(m, date) {
  const status = m.status || "planned";
  return {
    id: `meal-${m.id}-${date}`,
    title: m.name || m.type,
    start: date,
    end: date,
    startTime: m.time || "",
    endTime: m.time || "",
    allDay: false,
    category: "Meal",
    color: categoryColors.Meal,
    isMeal: true,
    mealId: m.id,
    status,
    completed: status === "completed",
    skipped: status === "skipped"
  };
}

function buildHabitEvents(habits, fromKey, toKey) {
  const out = [];
  const cur = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  while (cur && to && cur <= to) {
    const dayIdx = (cur.getDay() + 6) % 7;
    (habits || []).forEach((h, habitIndex) => {
      if (h.days && h.days[dayIdx]) {
        const date = dateKeyOf(cur);
        out.push({
          id: `habit-${h.id}-${date}`,
          title: h.name,
          start: date,
          end: date,
          startTime: "",
          endTime: "",
          allDay: true,
          category: "Habit",
          color: categoryColors.Habit,
          isHabit: true,
          habitIndex,
          habitId: h.id
        });
      }
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function layoutTimed(dayTimeEvents) {
  const placed = {};
  const sorted = [...dayTimeEvents].sort((a, b) => a.startMin - b.startMin || (a.endMin - a.startMin) - (b.endMin - b.startMin));
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    const lanes = [];
    cluster.forEach(ev => {
      let idx = lanes.findIndex(lane => lane[lane.length - 1].endMin <= ev.startMin);
      if (idx === -1) {
        lanes.push([ev]);
        idx = lanes.length - 1;
      } else {
        lanes[idx].push(ev);
      }
    });
    const n = lanes.length;
    lanes.forEach((lane, li) => {
      lane.forEach(ev => {
        placed[ev.id] = {
          left: (100 / n) * li,
          width: (100 / n) - (n > 1 ? 1.25 : 0)
        };
      });
    });
    cluster = [];
  };
  sorted.forEach(ev => {
    if (cluster.length && ev.startMin >= cluster[0].endMin) flush();
    cluster.push(ev);
  });
  flush();
  return placed;
}

export default function CalendarView({
  tasks, calendarEvents, meals, habits, onOpenCreateForDate, onOpenEvent,
  onEditEvent, onEditOccurrence, onDeleteEvent, onDeleteOccurrence, onMoveEvent,
  onToggleTask, onDeleteTask, onEditMeal, onDeleteMeal, onToggleHabit,
  onSelectTask, selectedTaskId, escapeHtml, reminderLabel, formatDateKey
}) {
  const [calMode, setCalMode] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 800) return "agenda";
    return "month";
  });
  const [calDate, setCalDate] = useState(new Date());
  const [selectedId, setSelectedId] = useState(selectedTaskId || null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [interaction, setInteraction] = useState(null);
  const [recurringDelete, setRecurringDelete] = useState(null);
  const weekBodyRef = useRef(null);
  const dayBodyRef = useRef(null);
  const dragOccurredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTaskId != null) {
      setSelectedId(selectedTaskId);
      const task = tasks.find(t => t.id === selectedTaskId);
      if (task && task.date) {
        const d = parseDateKey(task.date);
        if (d) setCalDate(d);
      }
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    const onResize = () => {
      const small = window.innerWidth < 800;
      setCalMode(prev => {
        if (small && (prev === "month" || prev === "week")) return "agenda";
        return prev;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const today = useMemo(() => formatDateKey(new Date()), [formatDateKey]);

  const getWeekStart = useCallback((date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(() => {
    const start = getWeekStart(calDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calDate, getWeekStart]);

  const getViewRange = useCallback(() => {
    let from, to;
    if (calMode === "month") {
      from = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
      to = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0);
    } else if (calMode === "week") {
      from = getWeekStart(calDate);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
    } else if (calMode === "day") {
      from = new Date(calDate);
      to = new Date(calDate);
    } else if (calMode === "year") {
      from = new Date(calDate.getFullYear(), 0, 1);
      to = new Date(calDate.getFullYear(), 11, 31);
    } else {
      from = new Date(calDate);
      to = new Date(calDate);
      to.setDate(to.getDate() + 2);
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return { fromKey: formatDateKey(from), toKey: formatDateKey(to) };
  }, [calMode, calDate, getWeekStart, formatDateKey]);

  const searchLower = search.trim().toLowerCase();

  const filteredCalendarEvents = useMemo(() => {
    let list = calendarEvents || [];
    if (searchLower) {
      list = list.filter(e =>
        (e.title || "").toLowerCase().includes(searchLower) ||
        (e.description || "").toLowerCase().includes(searchLower) ||
        (e.location || "").toLowerCase().includes(searchLower)
      );
    }
    if (filterCategory !== "all") {
      list = list.filter(e => e.category === filterCategory);
    }
    return list;
  }, [calendarEvents, searchLower, filterCategory]);

  const filteredTasks = useMemo(() => {
    let list = tasks || [];
    if (searchLower) {
      list = list.filter(t => `${t.name} ${t.type} ${t.priority} ${t.date}`.toLowerCase().includes(searchLower));
    }
    if (filterCategory !== "all") {
      list = list.filter(t => t.type === filterCategory);
    }
    return list;
  }, [tasks, searchLower, filterCategory]);

  const filteredMeals = useMemo(() => {
    if (!searchLower) return meals || [];
    return (meals || []).filter(m => (m.name || "").toLowerCase().includes(searchLower));
  }, [meals, searchLower]);

  const displayEvents = useMemo(() => {
    const { fromKey, toKey } = getViewRange();
    const calExpanded = expandRecurringEvents(filteredCalendarEvents, fromKey, toKey);
    const taskEvents = filteredTasks
      .filter(t => t.date && t.date >= fromKey && t.date <= toKey)
      .map(t => ({
        id: t.id,
        title: t.name,
        start: t.date,
        end: t.date,
        startTime: t.time || "",
        endTime: t.time || "",
        allDay: false,
        category: t.type || "Task",
        color: categoryColors[t.type] || categoryColors.Task,
        isTask: true,
        completed: t.completed,
        priority: t.priority,
        reminder: t.reminder,
        type: t.type,
        originalId: null,
        instanceDate: null
      }));
    const mealEvents = buildMealEvents(filteredMeals, fromKey, toKey);
    const habitEvents = calMode === "year" || calMode === "month"
      ? []
      : buildHabitEvents(habits || [], fromKey, toKey);
    return [...taskEvents, ...calExpanded, ...mealEvents, ...habitEvents];
  }, [filteredTasks, filteredCalendarEvents, filteredMeals, habits, getViewRange, calMode]);

  const analyticsEvents = useMemo(() => {
    const now = new Date();
    const start = formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = formatDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const taskEvents = filteredTasks.map(t => ({
      start: t.date,
      completed: t.completed,
      category: t.type,
      priority: t.priority
    }));
    const calEvents = filteredCalendarEvents.filter(e => e.start >= start && e.start <= end).map(e => ({
      start: e.start,
      completed: false,
      category: e.category,
      priority: e.category === "Work" ? "Red" : e.category === "Health" ? "Green" : "Yellow"
    }));
    return [...taskEvents, ...calEvents].filter(e => e.start >= start && e.start <= end);
  }, [filteredTasks, filteredCalendarEvents, formatDateKey]);

  const analyticsData = useMemo(() => {
    const total = analyticsEvents.length;
    const completed = analyticsEvents.filter(t => t.completed).length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    const red = analyticsEvents.filter(t => t.category === "Work" || t.priority === "Red").length;
    const yellow = analyticsEvents.filter(t => t.category === "Study").length;
    const green = analyticsEvents.filter(t => t.category === "Health").length;
    const meetings = analyticsEvents.filter(t => t.category === "Meeting").length;
    const pending = total - completed;
    return { total, completed, rate, red, yellow, green, meetings, pending };
  }, [analyticsEvents]);

  const weekActivity = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = formatDateKey(d);
      const dayEvents = analyticsEvents.filter(e => e.start === key);
      days.push({ key, total: dayEvents.length, completed: dayEvents.filter(e => e.completed).length });
    }
    const maxCompleted = Math.max(1, ...days.map(d => d.completed));
    return { days, maxCompleted };
  }, [analyticsEvents, formatDateKey]);

  const allExpandedEvents = useMemo(() => {
    const year = new Date().getFullYear();
    const fromKey = `${year - 1}-01-01`;
    const toKey = `${year + 1}-12-31`;
    const calExpanded = expandRecurringEvents(calendarEvents || [], fromKey, toKey);
    const taskEvents = (tasks || []).map(t => ({
      id: t.id,
      title: t.name,
      start: t.date,
      startTime: t.time || "",
      category: t.type || "Task",
      color: categoryColors[t.type] || categoryColors.Task,
      isTask: true,
      completed: t.completed,
      priority: t.priority,
      reminder: t.reminder,
      type: t.type
    }));
    return [...taskEvents, ...calExpanded];
  }, [calendarEvents, tasks]);

  const selectedEvent = useMemo(() => {
    if (!selectedId) return null;
    return allExpandedEvents.find(e => e.id === selectedId) || null;
  }, [allExpandedEvents, selectedId]);

  const navigate = (dir) => {
    setCalDate(prev => {
      const d = new Date(prev);
      if (calMode === "day") d.setDate(d.getDate() + dir);
      else if (calMode === "week") d.setDate(d.getDate() + dir * 7);
      else if (calMode === "month") d.setMonth(d.getMonth() + dir);
      else if (calMode === "year") d.setFullYear(d.getFullYear() + dir);
      else d.setDate(d.getDate() + dir * 3);
      return d;
    });
  };

  const goToToday = () => setCalDate(new Date());

  const displayDate = useMemo(() => {
    if (calMode === "day") return `${MONTHS[calDate.getMonth()]} ${calDate.getDate()}, ${calDate.getFullYear()}`;
    if (calMode === "week") {
      const start = getWeekStart(calDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (start.getMonth() === end.getMonth()) return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      if (start.getFullYear() === end.getFullYear()) return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
      return `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    if (calMode === "month") return `${MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
    if (calMode === "year") return `${calDate.getFullYear()}`;
    const end = new Date(calDate);
    end.setDate(end.getDate() + 2);
    return `${MONTHS[calDate.getMonth()]} ${calDate.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
  }, [calDate, calMode, getWeekStart]);

  const handleSlotClick = (date, time) => {
    onOpenEvent({ date, startTime: time, endTime: time });
  };

  const eventClick = (evt) => {
    if (evt.isTask) {
      setSelectedId(evt.id);
      if (onSelectTask) onSelectTask(evt.id);
    } else if (evt.isMeal) {
      onEditMeal(evt.mealId);
    } else if (evt.isHabit) {
      const dow = (parseDateKey(evt.start).getDay() + 6) % 7;
      onToggleHabit(evt.habitIndex, dow);
    } else if (evt.isOccurrence) {
      onEditOccurrence(evt);
    } else {
      onEditEvent(evt.id);
    }
  };

  const eventDelete = (evt) => {
    if (evt.isTask) {
      if (confirm(`Delete task "${evt.title}"?`)) onDeleteTask(evt.id);
    } else if (evt.isMeal) {
      if (confirm(`Delete meal "${evt.title}"?`)) onDeleteMeal(evt.mealId);
    } else if (evt.isOccurrence) {
      setRecurringDelete({ originalId: evt.originalId, dateKey: evt.instanceDate });
    } else if (evt.isHabit) {
      return;
    } else {
      if (confirm(`Delete event "${evt.title}"?`)) onDeleteEvent(evt.id);
    }
  };

  const isEditable = (evt) => !evt.isTask && !evt.isMeal && !evt.isHabit;

  const startCreate = (e, colIndex) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const bodyEl = calMode === "week" ? weekBodyRef.current : dayBodyRef.current;
    if (!bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    setInteraction({
      type: "create",
      view: calMode,
      col: colIndex,
      startMin: timeFromY(e.clientY - rect.top),
      currentMin: timeFromY(e.clientY - rect.top)
    });
  };

  const startMove = (e, evt, layout) => {
    if (e.button !== 0 || !isEditable(evt)) return;
    e.preventDefault();
    e.stopPropagation();
    const bodyEl = calMode === "week" ? weekBodyRef.current : dayBodyRef.current;
    if (!bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    const minutes = timeFromY(e.clientY - rect.top);
    const col = calMode === "week" ? clamp(Math.floor((e.clientX - rect.left) / (rect.width / 7)), 0, 6) : 0;
    setInteraction({
      type: "move",
      view: calMode,
      id: evt.id,
      origCol: col,
      origStartMin: Math.round(layout.startMin / 30) * 30,
      dragCol: col,
      dragStartMin: minutes,
      offsetMin: minutes - layout.startMin
    });
  };

  const startResize = (e, evt) => {
    if (e.button !== 0 || !isEditable(evt)) return;
    e.preventDefault();
    e.stopPropagation();
    const bodyEl = calMode === "week" ? weekBodyRef.current : dayBodyRef.current;
    if (!bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    setInteraction({
      type: "resize",
      view: calMode,
      id: evt.id,
      origEndMin: Math.round(fromTime(evt.endTime || evt.startTime) / 30) * 30,
      dragEndMin: timeFromY(e.clientY - rect.top)
    });
  };

  useEffect(() => {
    if (!interaction) return;
    const onMove = (e) => {
      const bodyEl = interaction.view === "week" ? weekBodyRef.current : dayBodyRef.current;
      if (!bodyEl) return;
      const rect = bodyEl.getBoundingClientRect();
      const minutes = timeFromY(e.clientY - rect.top);
      setInteraction(prev => {
        if (!prev) return prev;
        if (prev.type === "create") return { ...prev, currentMin: minutes };
        if (prev.type === "move") {
          const col = prev.view === "week" ? clamp(Math.floor((e.clientX - rect.left) / (rect.width / 7)), 0, 6) : 0;
          return { ...prev, dragCol: col, dragStartMin: minutes - prev.offsetMin };
        }
        if (prev.type === "resize") return { ...prev, dragEndMin: minutes };
        return prev;
      });
    };
    const onUp = (e) => {
      const bodyEl = interaction.view === "week" ? weekBodyRef.current : dayBodyRef.current;
      const rect = bodyEl ? bodyEl.getBoundingClientRect() : null;
      const minutes = rect ? timeFromY(e.clientY - rect.top) : null;
      if (interaction.type === "create" && rect) {
        let start = Math.min(interaction.startMin, minutes);
        let end = Math.max(interaction.startMin, minutes);
        if (end - start < 30) end = start + 30;
        const date = interaction.view === "week" ? formatDateKey(weekDays[interaction.col]) : formatDateKey(calDate);
        onOpenEvent({ date, startTime: minutesToTime(start), endTime: minutesToTime(end) });
      } else if (interaction.type === "move") {
        const evt = displayEvents.find(x => x.id === interaction.id);
        if (evt && isEditable(evt)) {
          const newDate = interaction.view === "week" ? formatDateKey(weekDays[interaction.dragCol]) : formatDateKey(calDate);
          const newStart = clamp(interaction.dragStartMin, START_HOUR * 60, END_HOUR * 60 - 30);
          const moved = interaction.dragCol !== interaction.origCol || newStart !== interaction.origStartMin;
          if (moved) {
            dragOccurredRef.current = true;
            const duration = Math.max(30, fromTime(evt.endTime || evt.startTime) - fromTime(evt.startTime));
            onMoveEvent(evt, {
              start: newDate,
              end: newDate,
              startTime: minutesToTime(newStart),
              endTime: minutesToTime(newStart + duration)
            });
          }
        }
      } else if (interaction.type === "resize") {
        const evt = displayEvents.find(x => x.id === interaction.id);
        if (evt && isEditable(evt)) {
          const newEnd = clamp(Math.round(interaction.dragEndMin / 30) * 30, fromTime(evt.startTime) + 30, END_HOUR * 60);
          if (newEnd !== interaction.origEndMin) {
            dragOccurredRef.current = true;
            onMoveEvent(evt, {
              end: evt.end || evt.start,
              endTime: minutesToTime(newEnd)
            });
          }
        }
      }
      setInteraction(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction]);

  const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentTimeTop = ((currentTimeMinutes - START_HOUR * 60) / 60) * HOUR_PX;

  const hourLabels = useMemo(() => {
    const labels = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      labels.push(`${pad2(h)}:00`);
    }
    return labels;
  }, []);

  const renderMonthView = () => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const dayEvents = displayEvents.filter(e => e.start === dateString || e.end === dateString)
        .sort((a, b) => (a.allDay ? -1 : 1) || (a.startTime || "").localeCompare(b.startTime || ""));
      cells.push({ day, dateString, dayEvents });
    }

    return (
      <div className="calendar-month-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="calendar-empty-day"></div>;
          const visible = cell.dayEvents.slice(0, 4);
          return (
            <div key={cell.dateString} className={`calendar-day ${cell.dateString === today ? "today" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) handleSlotClick(cell.dateString, "09:00"); }}>
              <div className="calendar-day-number">
                <span>{cell.day}</span>
                <button className="calendar-add" onClick={(e) => { e.stopPropagation(); handleSlotClick(cell.dateString, "09:00"); }}>
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
              {visible.map(evt => (
                <div key={evt.id} className={`calendar-event ${evt.completed ? "completed" : ""}`} style={{ borderLeftColor: evt.color || "#999" }} onClick={(e) => { e.stopPropagation(); eventClick(evt); }}>
                  <span className="calendar-event-time">{evt.isHabit || evt.allDay ? "" : escapeHtml(evt.startTime || "")}</span>
                  <span className="calendar-event-name">{escapeHtml(evt.title)}</span>
                </div>
              ))}
              {cell.dayEvents.length > 4 && <div className="more-events">+{cell.dayEvents.length - 4} more</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderEventBlock = (evt, layout) => {
    const startMin = layout.startMin;
    const endMin = layout.endMin;
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX;
    const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_PX);
    const isDragging = interaction && interaction.type === "move" && interaction.id === evt.id;
    let preview = null;
    if (isDragging && interaction.view === calMode) {
      const newStart = clamp(interaction.dragStartMin, START_HOUR * 60, END_HOUR * 60 - 30);
      preview = {
        top: ((newStart - START_HOUR * 60) / 60) * HOUR_PX,
        left: layout.left,
        width: layout.width
      };
    }
    return (
      <div
        key={evt.id}
        className="calendar-event-block"
        style={{
          top: preview ? `${preview.top}px` : `${top}px`,
          height: `${height}px`,
          left: `${preview ? preview.left : layout.left}%`,
          width: `${preview ? preview.width : layout.width}%`,
          background: evt.color || "#333"
        }}
        onMouseDown={(e) => startMove(e, evt, layout)}
        onClick={() => {
          if (dragOccurredRef.current) {
            dragOccurredRef.current = false;
            return;
          }
          eventClick(evt);
        }}
        title={evt.title}
      >
        <div className="ceb-title">{escapeHtml(evt.title)}</div>
        <div className="ceb-time">
          {evt.allDay || evt.isHabit ? "All day" : `${escapeHtml(evt.startTime || "")}${evt.endTime && evt.endTime !== evt.startTime ? " – " + escapeHtml(evt.endTime) : ""}`}
        </div>
        {isEditable(evt) && (
          <div
            className="calendar-event-resize"
            onMouseDown={(e) => startResize(e, evt)}
          ></div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const allDayEvents = displayEvents.filter(e => e.allDay);
    const timedEvents = displayEvents.filter(e => !e.allDay && (e.startTime || ""));

    const perDay = weekDays.map(d => {
      const dateKey = formatDateKey(d);
      const dayAllDay = allDayEvents.filter(e => e.start === dateKey || (e.end && dateKey >= e.start && dateKey <= e.end));
      const dayTimed = [];
      timedEvents.forEach(e => {
        if (e.start === dateKey) {
          dayTimed.push({ ...e, startMin: fromTime(e.startTime), endMin: Math.max(fromTime(e.startTime) + 30, fromTime(e.endTime || e.startTime)) });
        } else if (e.end === dateKey) {
          dayTimed.push({ ...e, startMin: START_HOUR * 60, endMin: Math.max(START_HOUR * 60 + 30, fromTime(e.endTime || "12:00")) });
        } else if (e.start < dateKey && e.end > dateKey) {
          dayTimed.push({ ...e, startMin: START_HOUR * 60, endMin: END_HOUR * 60 });
        }
      });
      const lanes = layoutTimed(dayTimed);
      return { dateKey, dayAllDay, dayTimed, lanes };
    });

    const createRange =
      interaction && interaction.type === "create" && interaction.view === "week"
        ? { col: interaction.col, start: interaction.startMin, end: interaction.currentMin }
        : null;

    return (
      <div className="week-view">
        <div className="week-header-row">
          <div className="week-gutter-space"></div>
          {weekDays.map((d, i) => {
            const dateKey = formatDateKey(d);
            const dayData = perDay[i];
            return (
              <div key={dateKey} className={`week-header-cell ${dateKey === today ? "today" : ""}`}>
                <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <strong>{d.getDate()}</strong>
                {dayData.dayAllDay.map(evt => (
                  <button key={evt.id} className="week-allday-chip" style={{ borderLeftColor: evt.color }} onClick={(e) => { e.stopPropagation(); eventClick(evt); }}>
                    <i className="fa-solid fa-circle" style={{ color: evt.color, fontSize: 5, marginRight: 4 }}></i>
                    {escapeHtml(evt.title)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="week-body" ref={weekBodyRef}>
          <div className="week-gutter">
            {hourLabels.map(h => (
              <div key={h} className="week-hour-label" style={{ top: ((fromTime(h) - START_HOUR * 60) / 60) * HOUR_PX }}>{h}</div>
            ))}
          </div>
          {perDay.map((dayData, colIndex) => (
            <div key={dayData.dateKey} className="week-col" onMouseDown={(e) => startCreate(e, colIndex)}>
              <div className="week-grid-bg"></div>
              {dayData.dayTimed.map(evt => renderEventBlock(evt, { ...dayData.lanes[evt.id] || { left: 0, width: 100 }, startMin: evt.startMin, endMin: evt.endMin }))}
              {createRange && createRange.col === colIndex && (
                <div className="calendar-create-range" style={{
                  top: ((Math.min(createRange.start, createRange.end) - START_HOUR * 60) / 60) * HOUR_PX,
                  height: Math.max(22, (Math.abs(createRange.end - createRange.start) / 60) * HOUR_PX)
                }}></div>
              )}
            </div>
          ))}
          {calMode === "week" && currentTimeMinutes >= START_HOUR * 60 && currentTimeMinutes <= END_HOUR * 60 && (
            <div className="current-time-line" style={{ top: currentTimeTop, left: 44 }}>
              <span>{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dateKey = formatDateKey(calDate);
    const allDayEvents = displayEvents.filter(e => e.allDay && (e.start === dateKey || (e.end && dateKey >= e.start && dateKey <= e.end)));
    const timedEvents = [];
    displayEvents.forEach(e => {
      if (e.allDay || !e.startTime) return;
      if (e.start === dateKey) {
        timedEvents.push({ ...e, startMin: fromTime(e.startTime), endMin: Math.max(fromTime(e.startTime) + 30, fromTime(e.endTime || e.startTime)) });
      } else if (e.end === dateKey) {
        timedEvents.push({ ...e, startMin: START_HOUR * 60, endMin: Math.max(START_HOUR * 60 + 30, fromTime(e.endTime || "12:00")) });
      } else if (e.start < dateKey && e.end > dateKey) {
        timedEvents.push({ ...e, startMin: START_HOUR * 60, endMin: END_HOUR * 60 });
      }
    });
    const lanes = layoutTimed(timedEvents);

    const createRange =
      interaction && interaction.type === "create" && interaction.view === "day"
        ? { start: interaction.startMin, end: interaction.currentMin }
        : null;

    return (
      <div className="day-view">
        <div className="day-view-heading">
          <span>{new Date(calDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
        </div>
        {allDayEvents.length > 0 && (
          <div className="day-allday-strip">
            {allDayEvents.map(evt => (
              <button key={evt.id} className="week-allday-chip" style={{ borderLeftColor: evt.color }} onClick={(e) => { e.stopPropagation(); eventClick(evt); }}>
                <i className="fa-solid fa-circle" style={{ color: evt.color, fontSize: 5, marginRight: 4 }}></i>
                {escapeHtml(evt.title)}
              </button>
            ))}
          </div>
        )}
        <div className="day-body" ref={dayBodyRef} onMouseDown={(e) => startCreate(e, 0)}>
          <div className="week-gutter">
            {hourLabels.map(h => (
              <div key={h} className="week-hour-label" style={{ top: ((fromTime(h) - START_HOUR * 60) / 60) * HOUR_PX }}>{h}</div>
            ))}
          </div>
          <div className="day-grid-area">
            <div className="week-grid-bg"></div>
            {timedEvents.map(evt => renderEventBlock(evt, { ...lanes[evt.id] || { left: 0, width: 100 }, startMin: evt.startMin, endMin: evt.endMin }))}
            {createRange && (
              <div className="calendar-create-range" style={{
                top: ((Math.min(createRange.start, createRange.end) - START_HOUR * 60) / 60) * HOUR_PX,
                height: Math.max(22, (Math.abs(createRange.end - createRange.start) / 60) * HOUR_PX)
              }}></div>
            )}
            {currentTimeMinutes >= START_HOUR * 60 && currentTimeMinutes <= END_HOUR * 60 && (
              <div className="current-time-line" style={{ top: currentTimeTop }}>
                <span>{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = calDate.getFullYear();
    return (
      <div className="year-view">
        {MONTHS.map((monthName, monthIndex) => {
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
          return (
            <div key={monthName} className="year-month">
              <h4>{monthName}</h4>
              <div className="year-week">
                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
              </div>
              <div className="year-week">
                {Array.from({ length: firstDay }).map((_, i) => <span key={`e-${i}`}></span>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
                  const hasTask = displayEvents.some(e => e.start === date);
                  return (
                    <button key={day} className={`year-date ${hasTask ? "has-task" : ""}`} onClick={() => { setCalMode("day"); setCalDate(parseDateKey(date)); }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAgendaView = () => {
    const { fromKey } = getViewRange();
    const base = parseDateKey(fromKey);
    const days = [0, 1, 2].map(i => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = formatDateKey(d);
      return { label: i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : key, date: key };
    });

    const agendaItems = days.map(day => {
      const dayEvents = displayEvents.filter(e => e.start === day.date)
        .sort((a, b) => (a.allDay ? -1 : 1) || (a.startTime || "").localeCompare(b.startTime || ""));
      return { ...day, events: dayEvents };
    }).filter(d => d.events.length > 0);

    return (
      <div className="agenda-view">
        {agendaItems.length === 0 && <div className="empty-state">No upcoming events.</div>}
        {agendaItems.map(day => (
          <div key={day.date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>{day.label} — {day.date}</div>
            {day.events.map(evt => (
              <div key={evt.id} className="dash-task-row" style={{ padding: "8px 3px", borderBottom: "1px solid rgba(255,255,255,.045)", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ width: 50, fontSize: 12, fontWeight: 700, color: "#aaa" }}>{evt.allDay || evt.isHabit ? "All day" : escapeHtml(evt.startTime || "")}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: evt.color || "#888", flexShrink: 0 }}></span>
                  <span style={{ flex: 1, fontSize: 13, color: evt.completed ? "#666" : "#ddd", fontWeight: 600, textDecoration: evt.completed ? "line-through" : "none" }}>{escapeHtml(evt.title)}</span>
                  <span style={{ fontSize: 12, color: "#666" }}>{escapeHtml(evt.category || evt.type)}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {evt.isTask ? (
                    <button className="task-tool-btn" onClick={() => onToggleTask(evt.id)}>{evt.completed ? "Reopen" : "Complete"}</button>
                  ) : evt.isHabit ? (
                    <button className="task-tool-btn" onClick={() => eventClick(evt)}>Toggle</button>
                  ) : (
                    <button className="task-tool-btn" onClick={() => eventClick(evt)}>Edit</button>
                  )}
                  <button className="task-tool-btn" onClick={() => eventDelete(evt)}><i className="fa-solid fa-trash"></i></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderViewport = () => {
    if (calMode === "day") return renderDayView();
    if (calMode === "week") return renderWeekView();
    if (calMode === "month") return renderMonthView();
    if (calMode === "year") return renderYearView();
    return renderAgendaView();
  };

  return (
    <section id="view-calendar" className="view-section">
      <div className="calendar-page-header">
        <div>
          <span className="calendar-eyebrow">WORKSPACE / SCHEDULE</span>
          <h2>Task calendar</h2>
          <p>Schedule your work and monitor productivity performance.</p>
        </div>
        <div className="calendar-header-actions">
          <button onClick={goToToday} className="calendar-dark-btn">Today</button>
          <button onClick={() => onOpenCreateForDate(formatDateKey(new Date()))} className="calendar-dark-btn">
            <i className="fa-solid fa-list-check"></i> New Task
          </button>
          <button onClick={() => onOpenEvent()} className="calendar-orange-btn">
            <i className="fa-solid fa-plus"></i> Add schedule
          </button>
        </div>
      </div>

      <div className="calendar-search-bar">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input type="search" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="calendar-main-toolbar">
        <div className="calendar-navigation">
          <button onClick={() => navigate(-1)} title="Previous"><i className="fa-solid fa-chevron-left"></i></button>
          <button onClick={() => navigate(1)} title="Next"><i className="fa-solid fa-chevron-right"></i></button>
          <button onClick={goToToday} className="toolbar-today">Today</button>
          <span className="calendar-toolbar-title" id="gcal-display-date">{displayDate}</span>
        </div>
        <div className="calendar-view-switcher">
          {["day","week","month","year","agenda"].map(mode => (
            <button key={mode} className={calMode === mode ? "active" : ""} onClick={() => setCalMode(mode)}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-workspace">
        <div className="calendar-main-card">
          <div className="calendar-card-top">
            <span>TASK TIMELINE</span>
            <span id="calendar-visible-count">{displayEvents.length} items</span>
          </div>
          <div className="calendar-viewport">
            {renderViewport()}
          </div>
        </div>

        <aside className="calendar-analytics">
          <div className="analytics-header">
            <div>
              <span>ANALYTICS</span>
              <h3>Performance</h3>
            </div>
            <i className="fa-solid fa-chart-simple"></i>
          </div>

          <div className="analytics-range">
            <span>Range</span>
            <span style={{ fontSize: 12, color: "#aaa" }}>Current month</span>
          </div>
          <p className="analytics-period">Current month performance</p>

          <div className="analytics-metrics">
            <div><span>Scheduled</span><strong>{analyticsData.total}</strong></div>
            <div><span>Completed</span><strong>{analyticsData.completed}</strong></div>
            <div><span>Efficiency</span><strong>{analyticsData.rate}%</strong></div>
            <div><span>High priority</span><strong>{analyticsData.red}</strong></div>
          </div>

          <div className="analytics-section">
            <div className="analytics-section-title">Priority distribution</div>
            <div className="distribution-row">
              <span>High</span>
              <b>{analyticsData.red}</b>
              <div><i style={{ width: `${(analyticsData.red / Math.max(1, analyticsData.total)) * 100}%` }}></i></div>
            </div>
            <div className="distribution-row">
              <span>Middle</span>
              <b>{analyticsData.yellow}</b>
              <div><i style={{ width: `${(analyticsData.yellow / Math.max(1, analyticsData.total)) * 100}%` }}></i></div>
            </div>
            <div className="distribution-row">
              <span>Low</span>
              <b>{analyticsData.green}</b>
              <div><i style={{ width: `${(analyticsData.green / Math.max(1, analyticsData.total)) * 100}%` }}></i></div>
            </div>
          </div>

          <div className="analytics-section">
            <div className="analytics-section-title">Workload</div>
            <div className="workload-row"><span>Pending</span><strong>{analyticsData.pending}</strong></div>
            <div className="workload-row"><span>Completed</span><strong>{analyticsData.completed}</strong></div>
            <div className="workload-row"><span>Meetings</span><strong>{analyticsData.meetings}</strong></div>
          </div>

          <div className="analytics-section">
            <div className="analytics-section-title">7-point activity</div>
            <div className="analytics-bars">
              {weekActivity.days.map(day => (
                <div key={day.key} className="analytics-bar-wrap">
                  <div className="analytics-bar-track">
                    <div className="analytics-bar" style={{ height: day.completed ? `${Math.max(8, (day.completed / weekActivity.maxCompleted) * 100)}%` : "4%" }}></div>
                  </div>
                  <em>{day.completed}/{day.total}</em>
                  <label>{parseDateKey(day.key).toLocaleDateString(undefined, { weekday: "narrow" })}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-insights">
            {analyticsData.total === 0 ? (
              <div><i className="fa-solid fa-circle-info"></i><span>No scheduled work in this range. Create a task to start tracking.</span></div>
            ) : (
              <>
                <div>
                  <i className={`fa-solid ${analyticsData.rate >= 80 ? "fa-trophy" : analyticsData.rate >= 50 ? "fa-chart-line" : "fa-bullseye"}`}></i>
                  <span>{analyticsData.rate >= 80 ? "Strong consistency." : analyticsData.rate >= 50 ? "Good momentum." : "Focus opportunity."} {analyticsData.rate}% of scheduled work is complete.</span>
                </div>
                {analyticsData.red > 0 && (
                  <div>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{analyticsData.red} high-priority item{analyticsData.red === 1 ? "" : "s"} need visibility.</span>
                  </div>
                )}
                {analyticsData.meetings > 0 && (
                  <div>
                    <i className="fa-solid fa-users"></i>
                    <span>{analyticsData.meetings} meeting{analyticsData.meetings === 1 ? "" : "s"} scheduled.</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div id="calendar-selected-task" className="selected-task-card">
            {selectedEvent ? (
              <>
                <div className="selected-task-header">
                  <span className="priority-chip" style={{ background: selectedEvent.color || "#888", color: "#111" }}>{selectedEvent.category || selectedEvent.type}</span>
                  <button onClick={() => eventDelete(selectedEvent)}><i className="fa-solid fa-trash"></i></button>
                </div>
                <h4>{escapeHtml(selectedEvent.title)}</h4>
                <p>{escapeHtml(selectedEvent.start)} · {escapeHtml(selectedEvent.startTime || "")}{selectedEvent.endTime && selectedEvent.endTime !== selectedEvent.startTime ? " – " + escapeHtml(selectedEvent.endTime) : ""}</p>
                <div className="selected-task-meta">
                  {selectedEvent.reminder && <span><i className="fa-regular fa-bell"></i> {reminderLabel(selectedEvent.reminder)}</span>}
                  <span><i className="fa-solid fa-circle-check"></i> {selectedEvent.completed ? "Completed" : "Pending"}</span>
                </div>
                <button className="selected-task-complete" onClick={() => {
                  if (selectedEvent.isTask) onToggleTask(selectedEvent.id);
                  else if (selectedEvent.isOccurrence) onEditOccurrence(selectedEvent);
                  else onEditEvent(selectedEvent.id);
                }}>
                  {selectedEvent.completed ? "Reopen" : "Edit / Complete"}
                </button>
              </>
            ) : (
              <div className="selected-task-empty">
                <i className="fa-regular fa-hand-pointer"></i>
                <span>Select a calendar item to see details.</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {recurringDelete && (
        <div className="modal-overlay" onClick={() => setRecurringDelete(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <span>RECURRING EVENT</span>
                <h3>Delete recurring event</h3>
              </div>
              <button onClick={() => setRecurringDelete(null)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>This event repeats. What would you like to delete?</p>
              <button className="modal-field-btn" onClick={() => { onDeleteOccurrence(recurringDelete.originalId, recurringDelete.dateKey, "this"); setRecurringDelete(null); }}>
                This event
              </button>
              <button className="modal-field-btn" onClick={() => { onDeleteOccurrence(recurringDelete.originalId, recurringDelete.dateKey, "following"); setRecurringDelete(null); }}>
                This and following events
              </button>
              <button className="modal-field-btn" onClick={() => { onDeleteOccurrence(recurringDelete.originalId, recurringDelete.dateKey, "all"); setRecurringDelete(null); }}>
                All events
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
