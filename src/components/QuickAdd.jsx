import { useState, useRef, useEffect } from "react";

export default function QuickAdd({ onAddTask, onAddEvent, onAddHabit, onAddNote, onAddReminder, onAddMeal }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: "Task", icon: "fa-solid fa-list-check", action: onAddTask },
    { label: "Event", icon: "fa-regular fa-calendar-plus", action: onAddEvent },
    { label: "Habit", icon: "fa-solid fa-bolt", action: onAddHabit },
    { label: "Note", icon: "fa-regular fa-note-sticky", action: onAddNote },
    { label: "Reminder", icon: "fa-regular fa-bell", action: onAddReminder },
    { label: "Meal", icon: "fa-solid fa-utensils", action: onAddMeal }
  ];

  return (
    <div className="quick-add-wrap" ref={ref}>
      <button
        className="quick-add-trigger"
        onClick={() => setOpen(p => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Quick add"
      >
        <i className="fa-solid fa-plus"></i>
      </button>
      {open && (
        <div className="quick-add-menu" role="menu">
          <div className="quick-add-menu-title">QUICK ADD</div>
          {items.map(item => (
            <button key={item.label} role="menuitem" className="quick-add-item" onClick={() => { setOpen(false); item.action(); }}>
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
