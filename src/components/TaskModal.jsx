import { useState, useEffect, useRef } from "react";
import { todayKey } from "../hooks/useLifePlanner";
import { TASK_COLORS, contrastText } from "../utils/color";

export default function TaskModal({ editingTask, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [priority, setPriority] = useState("Yellow");
  const [reminder, setReminder] = useState("exact");
  const [type, setType] = useState("Task");
  const [description, setDescription] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [tags, setTags] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [color, setColor] = useState(TASK_COLORS[0].value);
  const titleRef = useRef(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.name || "");
      setDate(editingTask.date || "");
      setStartDate(editingTask.startDate || "");
      setTime(editingTask.time || "10:00");
      setPriority(editingTask.priority || "Yellow");
      setReminder(editingTask.reminder || "exact");
      setType(editingTask.type || "Task");
      setDescription(editingTask.description || "");
      setEstimatedTime(editingTask.estimatedTime || "");
      setTags(Array.isArray(editingTask.tags) ? editingTask.tags.join(", ") : (editingTask.tags || ""));
      setRecurring(editingTask.recurring || "none");
      setColor(TASK_COLORS.some(c => c.value === (editingTask.color || "")) ? editingTask.color : TASK_COLORS[0].value);
    } else {
      setTitle("");
      setDate(todayKey());
      setStartDate("");
      setTime("10:00");
      setPriority("Yellow");
      setReminder("exact");
      setType("Task");
      setDescription("");
      setEstimatedTime("");
      setTags("");
      setRecurring("none");
      setColor(TASK_COLORS[0].value);
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [editingTask]);

  const handleSave = () => {
    if (!title || !date || !time) {
      alert("Please fill in all required fields.");
      return;
    }
    onSave({
      name: title,
      date,
      startDate,
      time,
      priority,
      reminder,
      type,
      description,
      estimatedTime,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      recurring,
      color,
      editingId: editingTask?.id || null
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && document.activeElement === titleRef.current) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div id="create-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-label={editingTask?.id ? "Edit task" : "Create task"}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <span>TASK WORKSPACE</span>
            <h3>{editingTask?.id ? "Edit Task" : "Create Task"}</h3>
          </div>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>Title / Task Name</label>
            <input ref={titleRef} type="text" placeholder="Add title..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Specific Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Start Date (optional)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Estimated Time (optional)</label>
              <input type="text" placeholder="e.g. 45 min, 2 hours" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} />
            </div>
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="Green">🟢 Green — Low Priority</option>
                <option value="Yellow">🟡 Yellow — Middle Priority</option>
                <option value="Red">🔴 Red — High Priority</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Task">Task</option>
                <option value="Meeting">Meeting</option>
                <option value="Reminder">Reminder</option>
              </select>
            </div>
          </div>
          <div className="modal-field">
            <label>Task Color</label>
            <div className="task-color-row">
              {TASK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={`${c.label} (${c.value})`}
                  aria-label={`Select color ${c.label}`}
                  aria-pressed={color === c.value}
                  className={"task-color-swatch" + (color === c.value ? " task-color-swatch--active" : "")}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                >
                  {color === c.value && <i className="fa-solid fa-check" style={{ color: contrastText(c.value) }}></i>}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-field">
            <label>Reminder</label>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
              <option value="exact">Exact at scheduled time</option>
              <option value="10min">10 minutes before</option>
              <option value="30min">30 minutes before</option>
              <option value="1hour">1 hour before</option>
              <option value="none">No reminder</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Recurrence</label>
            <select value={recurring} onChange={(e) => setRecurring(e.target.value)}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Tags (comma separated)</label>
            <input type="text" placeholder="work, urgent, design" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Description</label>
            <textarea placeholder="Describe this task..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", background: "#ffffff", border: "1px solid rgba(57,63,75,.14)", borderRadius: 8, color: "#393F4B", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-cancel">Cancel</button>
          <button onClick={handleSave} className="modal-save">{editingTask?.id ? "Update Task" : "Save Task"}</button>
        </div>
      </div>
    </div>
  );
}
