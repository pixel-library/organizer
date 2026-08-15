import { useState, useEffect, useRef } from "react";
import { todayKey } from "../hooks/useLifePlanner";

const CATEGORIES = ["Personal", "Work", "Study", "Health", "Other"];
const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" }
];
const REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "5min", label: "5 minutes" },
  { value: "10min", label: "10 minutes" },
  { value: "15min", label: "15 minutes" },
  { value: "30min", label: "30 minutes" },
  { value: "1hour", label: "1 hour" },
  { value: "1day", label: "1 day" }
];

export default function EventEditor({ event, preset, occurrenceDate, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState("Personal");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reminder, setReminder] = useState("none");
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [customWeekdays, setCustomWeekdays] = useState([]);
  const [editMode, setEditMode] = useState("this");
  const titleRef = useRef(null);

  useEffect(() => {
    if (occurrenceDate) {
      const original = event || {};
      setTitle(original.title || "");
      setStartDate(occurrenceDate);
      setEndDate(occurrenceDate);
      setStartTime(original.startTime || "09:00");
      setEndTime(original.endTime || "10:00");
      setAllDay(!!original.allDay);
      setCategory(original.category || "Personal");
      setLocation(original.location || "");
      setDescription(original.description || "");
      setReminder(original.reminder || "none");
      setRecurrence(original.recurrence || "none");
      setRecurrenceEnd(original.recurrenceEnd || "");
      setCustomWeekdays(original.customWeekdays || []);
      setEditMode("this");
    } else if (event) {
      setTitle(event.title || "");
      setStartDate(event.start || "");
      setEndDate(event.end || "");
      setStartTime(event.startTime || "09:00");
      setEndTime(event.endTime || "10:00");
      setAllDay(!!event.allDay);
      setCategory(event.category || "Personal");
      setLocation(event.location || "");
      setDescription(event.description || "");
      setReminder(event.reminder || "none");
      setRecurrence(event.recurrence || "none");
      setRecurrenceEnd(event.recurrenceEnd || "");
      setCustomWeekdays(event.customWeekdays || []);
    } else if (preset) {
      setTitle("");
      setStartDate(preset.date || todayKey());
      setEndDate(preset.date || todayKey());
      setStartTime(preset.startTime || "09:00");
      setEndTime(preset.endTime || "10:00");
      setAllDay(false);
      setCategory("Personal");
      setLocation("");
      setDescription("");
      setReminder("none");
      setRecurrence("none");
      setRecurrenceEnd("");
      setCustomWeekdays([]);
    } else {
      setTitle("");
      setStartDate(todayKey());
      setEndDate(todayKey());
      setStartTime("09:00");
      setEndTime("10:00");
      setAllDay(false);
      setCategory("Personal");
      setLocation("");
      setDescription("");
      setReminder("none");
      setRecurrence("none");
      setRecurrenceEnd("");
      setCustomWeekdays([]);
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [event, preset, occurrenceDate]);

  const handleSave = () => {
    if (!title || !startDate || !startTime) {
      alert("Please fill in all required fields.");
      return;
    }
    const data = {
      title,
      start: startDate,
      end: endDate || startDate,
      startTime,
      endTime,
      allDay,
      category,
      location,
      description,
      reminder,
      recurrence,
      recurrenceEnd: recurrence === "custom" ? recurrenceEnd : null,
      customWeekdays: recurrence === "custom" ? customWeekdays : null,
      editingId: event?.id || null
    };
    if (occurrenceDate && event?.id) {
      onSave(data, { originalId: event.id, dateKey: occurrenceDate, mode: editMode });
    } else {
      onSave(data);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  const toggleWeekday = (day) => {
    setCustomWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div id="create-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <span>EVENT WORKSPACE</span>
            <h3>{event?.id ? "Edit Event" : "Create Event"}</h3>
          </div>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          {occurrenceDate && (
            <div className="modal-field">
              <label>Apply changes to</label>
              <div className="recurrence-options">
                <button type="button" className={editMode === "this" ? "active" : ""} onClick={() => setEditMode("this")}>This event</button>
                <button type="button" className={editMode === "following" ? "active" : ""} onClick={() => setEditMode("following")}>This and following</button>
                <button type="button" className={editMode === "all" ? "active" : ""} onClick={() => setEditMode("all")}>All events</button>
              </div>
            </div>
          )}
          <div className="modal-field">
            <label>Title</label>
            <input ref={titleRef} type="text" placeholder="Add title..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!!occurrenceDate} />
            </div>
            <div className="modal-field">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!!occurrenceDate} />
            </div>
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={allDay} />
            </div>
            <div className="modal-field">
              <label>End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={allDay} />
            </div>
          </div>
          <div className="modal-field">
            <label>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ marginRight: 8 }} />
              All Day
            </label>
          </div>
          <div className="modal-field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Location</label>
            <input type="text" placeholder="Add location..." value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Description</label>
            <textarea placeholder="Add description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", background: "#FFFFFF", border: "1px solid rgba(57,63,75,.14)", borderRadius: 8, color: "#393F4B", padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }} />
          </div>
          <div className="modal-field">
            <label>Reminder</label>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
              {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Repeat</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {REPEAT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {recurrence === "custom" && (
            <div className="modal-field">
              <label>Repeat on weekdays</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => (
                  <button key={day} type="button" onClick={() => toggleWeekday(day)} style={{
                    width: 36, height: 36, borderRadius: 6, border: "1px solid rgba(57,63,75,.14)",
                    background: customWeekdays.includes(day) ? "#910029" : "#FFFFFF",
                    color: customWeekdays.includes(day) ? "#fff" : "#5D6E7F",
                    fontSize: 13, fontWeight: 700, cursor: "pointer"
                  }}>{day}</button>
                ))}
              </div>
            </div>
          )}
          {recurrence !== "none" && (
            <div className="modal-field">
              <label>End Recurrence</label>
              <input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-cancel">Cancel</button>
          <button onClick={handleSave} className="modal-save">{event?.id ? "Update Event" : "Save Event"}</button>
        </div>
      </div>
    </div>
  );
}
