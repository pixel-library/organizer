import { useState, useMemo, useEffect } from "react";

export default function Reminders({ tasks, calendarEvents, customReminders, onAddCustom, onDeleteCustom, onToggleCustom, onOpenEvent, onOpenTaskModal, escapeHtml, openRequest = 0 }) {
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (openRequest) setShowForm(true);
  }, [openRequest]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");

  const derived = useMemo(() => {
    const items = [];
    tasks.forEach(t => {
      if (t.reminder && t.reminder !== "none" && !t.completed && t.date) {
        items.push({ id: `task-${t.id}`, source: "Task", title: t.name, date: t.date, time: t.time || "", reminder: t.reminder, refId: t.id, kind: "task" });
      }
    });
    calendarEvents.forEach(e => {
      if (e.reminder && e.reminder !== "none" && e.start) {
        items.push({ id: `event-${e.id}`, source: "Event", title: e.title, date: e.start, time: e.startTime || "", reminder: e.reminder, refId: e.id, kind: "event" });
      }
    });
    return items.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [tasks, calendarEvents]);

  const custom = useMemo(() => {
    return [...customReminders].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [customReminders]);

  const total = derived.length + custom.length;

  const submit = () => {
    if (!title.trim() || !date) {
      alert("Please fill in title and date.");
      return;
    }
    onAddCustom({ title: title.trim(), date, time, note: note.trim(), type: "Custom" });
    setTitle("");
    setDate("");
    setTime("09:00");
    setNote("");
    setShowForm(false);
  };

  const reminderShort = (r) => ({ exact: "At time", "5min": "5 min before", "10min": "10 min before", "15min": "15 min before", "30min": "30 min before", "1hour": "1 hour before", "1day": "1 day before" }[r] || r || "");

  return (
    <section id="view-reminders" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">ALERTS</span>
            <h2>Reminders</h2>
            <p>Everything scheduled to remind you — tasks, events and custom alerts.</p>
          </div>
          <button onClick={() => setShowForm(p => !p)} className="light-action-btn">
            <i className="fa-solid fa-plus"></i> New Reminder
          </button>
        </div>

        {total === 0 && (
          <div className="analytics-empty-state">
            <div className="empty-icon large"><i className="fa-regular fa-bell"></i></div>
            <strong>No reminders yet</strong>
            <span>Reminders appear here when you set them on tasks, events or create one below.</span>
          </div>
        )}

        {showForm && (
          <div className="goals-form">
            <input type="text" placeholder="Reminder title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="small-primary" onClick={submit}><i className="fa-solid fa-check"></i> Save Reminder</button>
          </div>
        )}

        {custom.length > 0 && (
          <div className="reminder-group">
            <div className="reminder-group-title">Custom</div>
            {custom.map(r => (
              <div key={r.id} className={`reminder-row ${r.completed ? "completed" : ""}`}>
                <input type="checkbox" checked={r.completed} onChange={() => onToggleCustom(r.id)} />
                <div className="reminder-row-main">
                  <strong>{escapeHtml(r.title)}</strong>
                  {r.note && <span>{escapeHtml(r.note)}</span>}
                </div>
                <div className="reminder-row-meta">
                  <span><i className="fa-regular fa-calendar"></i> {escapeHtml(r.date)} · {escapeHtml(r.time || "")}</span>
                  <span className="task-type-chip">{escapeHtml(r.type)}</span>
                </div>
                <button className="task-action-btn" onClick={() => { if (confirm("Delete this reminder?")) onDeleteCustom(r.id); }}><i className="fa-solid fa-trash"></i></button>
              </div>
            ))}
          </div>
        )}

        {derived.length > 0 && (
          <div className="reminder-group">
            <div className="reminder-group-title">Scheduled</div>
            {derived.map(r => (
              <div key={r.id} className="reminder-row">
                <span className="calendar-event-dot" style={{ background: r.kind === "task" ? "#5aa7ff" : "#f59e0b" }}></span>
                <div className="reminder-row-main">
                  <strong>{escapeHtml(r.title)}</strong>
                  <span>{escapeHtml(r.source)} · {reminderShort(r.reminder)}</span>
                </div>
                <div className="reminder-row-meta">
                  <span><i className="fa-regular fa-calendar"></i> {escapeHtml(r.date)} · {escapeHtml(r.time)}</span>
                </div>
                <button className="task-tool-btn" onClick={() => r.kind === "task" ? onOpenTaskModal(r.refId) : onOpenEvent({ date: r.date })}>
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
