import { useMemo } from "react";
import AudioPlayer from "./AudioPlayer";

export default function Dashboard({
  tasks, goals, calendarEvents, meals, notes, habits,
  onSwitchView, onOpenCreate, onOpenAddGoal, onOpenEvent, onAddHabit, onOpenNote,
  onUpdateGoal, onDeleteGoal, onToggleTask, onSelectTask,
  formatDateKey, escapeHtml, priorityClass, dashboardTime
}) {
  const today = formatDateKey(new Date());
  const todayTasks = useMemo(() => tasks.filter(t => t.date === today), [tasks, today]);
  const todayCompleted = useMemo(() => todayTasks.filter(t => t.completed).length, [todayTasks]);
  const total = tasks.length;
  const completed = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const high = useMemo(() => tasks.filter(t => t.priority === "Red" && !t.completed).length, [tasks]);
  const overdue = useMemo(() => tasks.filter(t => t.date && !t.completed && t.date < today).length, [tasks, today]);
  const goalTotal = useMemo(() => goals.reduce((sum, g) => sum + Number(g.target || 0), 0), [goals]);
  const goalCurrent = useMemo(() => goals.reduce((sum, g) => sum + Math.min(Number(g.current || 0), Number(g.target || 0)), 0), [goals]);
  const project = goalTotal ? Math.round((goalCurrent / goalTotal) * 100) : 0;

  const todayEvents = useMemo(() => {
    return calendarEvents.filter(e => e.start === today).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [calendarEvents, today]);

  const todayMeals = useMemo(() => {
    return meals.filter(m => m.date === today || m.day === new Date().toLocaleDateString("en-US", { weekday: "long" }));
  }, [meals, today]);

  const nextEvent = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = [...calendarEvents, ...tasks]
      .filter(e => (e.start || e.date) >= today)
      .filter(e => {
        if ((e.start || e.date) === today) {
          const [h, m] = (e.startTime || e.time || "23:59").split(":").map(Number);
          return h * 60 + m > currentMinutes;
        }
        return true;
      })
      .sort((a, b) => `${a.start || a.date}${a.startTime || a.time || ""}`.localeCompare(`${b.start || b.date}${b.startTime || b.time || ""}`));
    return upcoming[0] || null;
  }, [calendarEvents, tasks, today]);

  const sorted = useMemo(() => [...tasks].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 8), [tasks]);

  const recentNotes = useMemo(() => {
    return [...notes]
      .filter(n => !n.archived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 4);
  }, [notes]);

  const completedMealsToday = useMemo(() => todayMeals.filter(m => m.status === "completed").length, [todayMeals]);

  const list = useMemo(() => {
    return [...tasks]
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 10);
  }, [tasks]);

  const weeklyStats = useMemo(() => {
    const start = new Date();
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(start);
    weekStart.setDate(diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startKey = formatDateKey(weekStart);
    const endKey = formatDateKey(weekEnd);
    const weekTasks = tasks.filter(t => t.date >= startKey && t.date <= endKey);
    const weekCompleted = weekTasks.filter(t => t.completed).length;
    const weekEvents = calendarEvents.filter(e => e.start >= startKey && e.start <= endKey);
    const weekHabitCompletions = habits.reduce((sum, h) => sum + (Array.isArray(h.history) ? h.history.filter(k => k >= startKey && k <= endKey).length : 0), 0);
    return { weekTasks: weekTasks.length, weekCompleted, weekEvents: weekEvents.length, weekHabits: weekHabitCompletions };
  }, [tasks, calendarEvents, habits, formatDateKey]);

  const isEmpty = useMemo(() => {
    return tasks.length === 0 && calendarEvents.length === 0 && notes.length === 0 &&
      habits.length === 0 && meals.length === 0 && goals.length === 0;
  }, [tasks, calendarEvents, notes, habits, meals, goals]);

  if (isEmpty) {
    return (
      <section id="view-dashboard" className="view-section">
        <div className="dashboard-empty-state">
          <div className="empty-icon large"><i className="fa-solid fa-sparkles"></i></div>
          <h2>Welcome to Organizer</h2>
          <p>Start by adding your first task, event, habit or note. Your data is saved securely to your account and synced across sessions.</p>
          <div className="dashboard-empty-actions">
            <button onClick={onOpenCreate}><i className="fa-solid fa-list-check"></i> Add Task</button>
            <button onClick={() => onOpenEvent({ date: today })}><i className="fa-regular fa-calendar-plus"></i> Add Event</button>
            <button onClick={() => { const name = prompt("Enter habit name:"); if (name) onAddHabit(name); }}><i className="fa-solid fa-bolt"></i> Add Habit</button>
            <button onClick={onOpenNote}><i className="fa-regular fa-note-sticky"></i> Add Note</button>
          </div>
          <div className="dashboard-empty-strip">
            <span>Your workspace is clean. Sign in on any device to pick up where you left off.</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="view-dashboard" className="view-section">
      <div className="dashboard-welcome">
        <div>
          <div className="eyebrow">
            <span className="status-dot"></span>
            LIFE PLANNER OS / WORKSPACE
          </div>
          <h2>Good day. Here is your control center.</h2>
          <p>Track projects, schedule, priorities and personal progress from one workspace.</p>
        </div>
        <div className="dashboard-date-block">
          <span id="dashboard-date-label">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
          </span>
          <strong id="dashboard-time-label">{dashboardTime}</strong>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>Today's Tasks</span>
            <i className="fa-solid fa-list-check"></i>
          </div>
          <div className="dash-stat-value">{todayTasks.length}</div>
          <div className="dash-stat-meta">
            <span>{todayCompleted} completed</span>
            <span className="trend-neutral">Today</span>
          </div>
          <div className="mini-progress">
            <span style={{ width: todayTasks.length ? `${(todayCompleted / todayTasks.length) * 100}%` : "0%" }}></span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>Project Progress</span>
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div className="dash-stat-value">{project}%</div>
          <div className="dash-stat-meta">
            <span>{goals.length} goal{goals.length === 1 ? "" : "s"}</span>
            <span className="trend-up">Live</span>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${project}%` }}></span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>High Priority</span>
            <i className="fa-solid fa-bolt"></i>
          </div>
          <div className="dash-stat-value">{high}</div>
          <div className="dash-stat-meta">
            <span>{overdue} overdue</span>
            <span className="trend-alert">Priority</span>
          </div>
          <div className="mini-progress priority">
            <span style={{ width: `${Math.min(100, high * 20)}%` }}></span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>Completion Rate</span>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="dash-stat-value">{rate}%</div>
          <div className="dash-stat-meta">
            <span>{completed} / {total} tasks</span>
            <span className="trend-up">Overall</span>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${rate}%` }}></span>
          </div>
        </div>
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">OPERATIONS</span>
              <h3>Project Timeline</h3>
            </div>
            <button onClick={() => onSwitchView("calendar")} className="text-action">
              View calendar <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
          <div className="timeline-toolbar">
            <span>Chronological task flow</span>
            <span id="dashboard-task-total">{total} scheduled item{total === 1 ? "" : "s"}</span>
          </div>
          <div className="dashboard-timeline">
            {sorted.length === 0 && <div className="empty-state">No timeline items yet.</div>}
            {sorted.map(task => {
              const color = priorityClass(task.priority);
              return (
                <div key={task.id} className="timeline-row" onClick={() => onSelectTask(task.id)}>
                  <div className="timeline-time">
                    <b>{escapeHtml(task.time)}</b>
                    <span>{escapeHtml(String(task.date).slice(5))}</span>
                  </div>
                  <div className="timeline-line">
                    <span className={`timeline-dot ${color}`}></span>
                  </div>
                  <div className="timeline-content">
                    <div>
                      <b className={task.completed ? "completed-text" : ""}>{escapeHtml(task.name)}</b>
                      <span>{escapeHtml(task.type)}</span>
                    </div>
                    <em className={`timeline-status ${task.completed ? "done" : ""}`}>{task.completed ? "Done" : "Open"}</em>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">PROJECTS</span>
              <h3>Project Progress</h3>
            </div>
            <button onClick={onOpenAddGoal} className="icon-action">
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>
          <div className="dashboard-project-list">
            {goals.length === 0 && <div className="empty-state">No goals yet.</div>}
            {goals.slice(0, 6).map((goal, index) => {
              const percent = Math.min(100, Math.round(Number(goal.current) / Math.max(1, Number(goal.target)) * 100));
              return (
                <div key={goal.id} className="project-row">
                  <div className="project-row-top">
                    <span><i className="fa-solid fa-folder-open"></i> {escapeHtml(goal.name)}</span>
                    <b>{percent}%</b>
                  </div>
                  <div className="project-progress">
                    <span style={{ width: `${percent}%` }}></span>
                  </div>
                  <div className="project-row-meta">
                    <small>{goal.current} / {goal.target} {escapeHtml(goal.unit || "")}</small>
                    <div>
                      <button onClick={() => onUpdateGoal(index, 1)} title="Increase progress">+1</button>
                      <button onClick={() => onUpdateGoal(index, -1)} title="Decrease progress">-1</button>
                      <button className="danger" onClick={() => { if (confirm("Delete this goal?")) onDeleteGoal(goal.id); }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-bottom-grid">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">TASKS</span>
              <h3>Task List</h3>
            </div>
            <div className="task-tools">
              <button onClick={onOpenCreate} className="small-primary">
                <i className="fa-solid fa-plus"></i> New Task
              </button>
            </div>
          </div>
          <div className="dashboard-task-list">
            {list.length === 0 && <div className="empty-state">No matching tasks.</div>}
            {list.map(task => {
              const color = priorityClass(task.priority);
              return (
                <div key={task.id} className="dash-task-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                    />
                    <span className={`priority-dot ${color}`}></span>
                    <span>
                      <b className={task.completed ? "completed-text" : ""}>{escapeHtml(task.name)}</b>
                      <small>{escapeHtml(task.date)} · {escapeHtml(task.time)} · {escapeHtml(task.type)}</small>
                    </span>
                  </label>
                  <button onClick={() => onSelectTask(task.id)}>
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-panel agenda-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">TODAY</span>
              <h3>Today's Agenda</h3>
            </div>
            <button onClick={() => onSwitchView("calendar")} className="text-action">
              Open calendar
            </button>
          </div>
          <div>
            {todayEvents.length === 0 && todayTasks.length === 0 && todayMeals.length === 0 && (
              <div className="empty-state">No tasks, events or meals scheduled for today.</div>
            )}
            {nextEvent && (
              <div style={{ padding: 10, background: "var(--surface)", borderRadius: 6, marginBottom: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>NEXT EVENT</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{escapeHtml(nextEvent.title || nextEvent.name)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {escapeHtml(nextEvent.start || nextEvent.date)} · {escapeHtml(nextEvent.startTime || nextEvent.time || "")}
                </div>
              </div>
            )}
            {todayMeals.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                  MEALS TODAY · {completedMealsToday}/{todayMeals.length} completed
                </div>
                {todayMeals.map((meal, i) => (
                  <div key={i} style={{ padding: "6px 3px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: meal.status === "completed" ? "#22c55e" : meal.status === "skipped" ? "#8d8d8d" : "#f59e0b", flexShrink: 0 }}></span>
                    <span style={{ flex: 1, fontSize: 14, color: meal.status === "completed" ? "var(--muted-2)" : "var(--text)", fontWeight: 600, textDecoration: meal.status === "completed" ? "line-through" : "none" }}>{escapeHtml(meal.name || meal.type)}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{escapeHtml(meal.time || "")}</span>
                  </div>
                ))}
              </div>
            )}
            {todayTasks.slice(0, 6).map(task => {
              const color = priorityClass(task.priority);
              return (
                <div key={task.id} className="agenda-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                    />
                    <span className={`agenda-dot ${color}`}></span>
                    <span>
                      <b className={task.completed ? "completed-text" : ""}>{escapeHtml(task.name)}</b>
                      <small>{escapeHtml(task.time)} · {escapeHtml(task.type)}</small>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-weekly-strip">
        <div>
          <span className="panel-kicker">THIS WEEK</span>
          <h3>Weekly snapshot</h3>
        </div>
        <div className="dashboard-weekly-stats">
          <div><strong>{weeklyStats.weekTasks}</strong><span>Tasks planned</span></div>
          <div><strong>{weeklyStats.weekCompleted}</strong><span>Completed</span></div>
          <div><strong>{weeklyStats.weekEvents}</strong><span>Events</span></div>
          <div><strong>{weeklyStats.weekHabits}</strong><span>Habit check-ins</span></div>
        </div>
      </div>

      <div className="dashboard-panel" style={{ marginTop: 10 }}>
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">NOTES</span>
            <h3>Recent Notes</h3>
          </div>
          <button onClick={() => onSwitchView("notes")} className="text-action">
            Open notes <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        {recentNotes.length === 0 ? (
          <div className="empty-state">No notes yet.</div>
        ) : (
          <div className="dashboard-task-list">
            {recentNotes.map(note => (
              <div key={note.id} className="dash-task-row" onClick={() => onSwitchView("notes")}>
                <span className="priority-dot" style={{ background: note.pinned ? "#f59e0b" : "#666" }}></span>
                <span style={{ flex: 1 }}>
                  <b>{escapeHtml(note.title)}</b>
                  <small>{escapeHtml(note.category)}{note.pinned ? " · Pinned" : ""} · {new Date(note.updatedAt).toLocaleDateString()}</small>
                </span>
                <i className="fa-solid fa-chevron-right" style={{ color: "#555", fontSize: 14 }}></i>
              </div>
            ))}
          </div>
        )}
      </div>
      <AudioPlayer />
    </section>
  );
}
