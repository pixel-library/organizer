import { useState, useEffect, useRef } from "react";

export default function CommandPalette({
  open, onClose, onOpenView, onCreateTask, onCreateEvent, onCreateNote, onCreateHabit, onGoToday, onOpenSearch, onExport, onImport
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = [
    { label: "Create Task", icon: "fa-solid fa-list-check", action: onCreateTask },
    { label: "Create Event", icon: "fa-regular fa-calendar-plus", action: onCreateEvent },
    { label: "Create Note", icon: "fa-regular fa-note-sticky", action: onCreateNote },
    { label: "Create Habit", icon: "fa-solid fa-bolt", action: onCreateHabit },
    { label: "Open Dashboard", icon: "fa-solid fa-house", action: () => onOpenView("dashboard") },
    { label: "Open Calendar", icon: "fa-regular fa-calendar-days", action: () => onOpenView("calendar") },
    { label: "Open Tasks", icon: "fa-solid fa-list-check", action: () => onOpenView("tasks") },
    { label: "Open Notes", icon: "fa-regular fa-note-sticky", action: () => onOpenView("notes") },
    { label: "Open Analytics", icon: "fa-solid fa-chart-simple", action: () => onOpenView("analytics") },
    { label: "Open Goals", icon: "fa-solid fa-bullseye", action: () => onOpenView("goals") },
    { label: "Open Reminders", icon: "fa-regular fa-bell", action: () => onOpenView("reminders") },
    { label: "Open Habits", icon: "fa-solid fa-bolt", action: () => onOpenView("habits") },
    { label: "Open Meals", icon: "fa-solid fa-utensils", action: () => onOpenView("meals") },
    { label: "Open History", icon: "fa-solid fa-clock-rotate-left", action: () => onOpenView("history") },
    { label: "Go to Today", icon: "fa-solid fa-calendar-day", action: onGoToday },
    { label: "Search everything", icon: "fa-solid fa-magnifying-glass", action: onOpenSearch },
    { label: "Export data", icon: "fa-solid fa-file-export", action: onExport },
    { label: "Import data", icon: "fa-solid fa-file-import", action: onImport }
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.trim().toLowerCase()));

  const run = (cmd) => {
    onClose();
    cmd.action();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      run(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay cmd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="cmd-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="cmd-list">
          {filtered.length === 0 && <div className="cmd-empty">No commands found.</div>}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.label}
              className={`cmd-item ${i === activeIndex ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => run(cmd)}
            >
              <i className={cmd.icon}></i>
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
