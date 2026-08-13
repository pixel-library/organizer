import { useState, useEffect, useRef } from "react";

export default function TaskModal({ editingTask, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [priority, setPriority] = useState("Yellow");
  const [reminder, setReminder] = useState("exact");
  const [type, setType] = useState("Task");
  const titleRef = useRef(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.name || "");
      setDate(editingTask.date || new Date().toISOString().split("T")[0]);
      setTime(editingTask.time || "10:00");
      setPriority(editingTask.priority || "Yellow");
      setReminder(editingTask.reminder || "exact");
      setType(editingTask.type || "Task");
    } else {
      setTitle("");
      setDate(new Date().toISOString().split("T")[0]);
      setTime("10:00");
      setPriority("Yellow");
      setReminder("exact");
      setType("Task");
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [editingTask]);

  const handleSave = () => {
    if (!title || !date || !time) {
      alert("Please fill in all required fields.");
      return;
    }
    onSave({ name: title, date, time, priority, reminder, type });
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
    <div id="create-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <span>TASK WORKSPACE</span>
            <h3>{editingTask?.id ? "Edit Task" : "Create Calendar Entry"}</h3>
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
          <div className="modal-field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="Green">🟢 Green — Low Priority</option>
              <option value="Yellow">🟡 Yellow — Middle Priority</option>
              <option value="Red">🔴 Red — High Priority</option>
            </select>
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
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Task">Task / Event</option>
              <option value="Meeting">Meeting</option>
              <option value="Reminder">Reminder</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-cancel">Cancel</button>
          <button onClick={handleSave} className="modal-save">{editingTask?.id ? "Update Task" : "Save Entry"}</button>
        </div>
      </div>
    </div>
  );
}
