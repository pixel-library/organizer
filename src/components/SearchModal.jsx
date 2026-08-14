import { useState, useMemo, useEffect, useRef } from "react";

export default function SearchModal({ open, onClose, tasks, calendarEvents, notes, habits, meals, history, onOpenView, onEditEvent, onEditNote, onEditTask, escapeHtml }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    const out = {};
    const match = (text) => String(text || "").toLowerCase().includes(q);

    out.Tasks = (tasks || [])
      .filter(t => match(t.name) || match(t.description) || match(t.type) || (Array.isArray(t.tags) && t.tags.some(tag => match(tag))))
      .slice(0, 8)
      .map(t => ({ id: t.id, title: t.name, subtitle: `${t.date} · ${t.type}`, kind: "task" }));

    out.Events = (calendarEvents || [])
      .filter(e => match(e.title) || match(e.description) || match(e.location) || match(e.category))
      .slice(0, 8)
      .map(e => ({ id: e.id, title: e.title, subtitle: `${e.start} · ${e.category}`, kind: "event" }));

    out.Notes = (notes || [])
      .filter(n => match(n.title) || match(n.content) || match(n.category))
      .slice(0, 8)
      .map(n => ({ id: n.id, title: n.title, subtitle: n.category, kind: "note" }));

    out.Habits = (habits || [])
      .filter(h => match(h.name))
      .slice(0, 8)
      .map(h => ({ id: h.id, title: h.name, subtitle: "Habit", kind: "habit" }));

    out.Meals = (meals || [])
      .filter(m => match(m.name) || match(m.type) || match(m.day))
      .slice(0, 8)
      .map(m => ({ id: m.id, title: m.name, subtitle: `${m.day || m.date} · ${m.type}`, kind: "meal" }));

    out.History = (history || [])
      .filter(h => match(h.name) || match(h.status))
      .slice(0, 8)
      .map(h => ({ id: h.id, title: h.name, subtitle: `${h.status} · ${h.timestamp}`, kind: "history" }));

    const keys = Object.keys(out);
    keys.forEach(k => { if (out[k].length === 0) delete out[k]; });
    return out;
  }, [q, tasks, calendarEvents, notes, habits, meals, history]);

  const totalResults = useMemo(() => {
    if (!results) return 0;
    return Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  }, [results]);

  const openResult = (r) => {
    onClose();
    if (r.kind === "event") {
      onOpenView("calendar");
      onEditEvent(r.id);
    } else if (r.kind === "task") {
      onOpenView("tasks");
      onEditTask(r.id);
    } else if (r.kind === "note") {
      onOpenView("notes");
      onEditNote(r.id);
    } else if (r.kind === "habit") {
      onOpenView("habits");
    } else if (r.kind === "meal") {
      onOpenView("meals");
    } else if (r.kind === "history") {
      onOpenView("history");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay cmd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-palette search-palette" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="cmd-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, events, notes, habits, meals, history..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          {!q && <div className="cmd-empty">Start typing to search across everything.</div>}
          {q && totalResults === 0 && <div className="cmd-empty">No results found.</div>}
          {results && Object.entries(results).map(([group, items]) => (
            <div key={group} className="search-group">
              <div className="search-group-title">{group} · {items.length}</div>
              {items.map(r => (
                <button key={`${group}-${r.id}`} className="search-result-item" onClick={() => openResult(r)}>
                  <span className="search-result-title">{escapeHtml(r.title)}</span>
                  <span className="search-result-sub">{escapeHtml(r.subtitle)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
