import { useState, useMemo } from "react";

const NOTE_CATEGORIES = ["Personal", "Work", "Study", "Ideas", "Important"];
const SORT_OPTIONS = [
  { value: "updated", label: "Recently Updated" },
  { value: "created", label: "Recently Created" },
  { value: "oldest", label: "Oldest First" },
  { value: "az", label: "A – Z" },
  { value: "za", label: "Z – A" }
];

export default function Notes({ notes, _onUpdateNote, onDeleteNote, onToggleArchive, onRestore, onTogglePin, onEditNote, onOpenNote, onScheduleNote, escapeHtml }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("updated");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    let list = notes.filter(n => {
      if (showArchived) {
        if (!n.archived) return false;
      } else {
        if (n.archived) return false;
      }
      if (category !== "all" && n.category !== category) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (!n.title.toLowerCase().includes(s) && !n.content.toLowerCase().includes(s)) return false;
      }
      return true;
    });

    const pinned = list.filter(n => n.pinned);
    const unpinned = list.filter(n => !n.pinned);

    const sortFn = (a, b) => {
      if (sort === "updated") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (sort === "created") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "za") return b.title.localeCompare(a.title);
      return 0;
    };

    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
  }, [notes, search, category, sort, showArchived]);

  return (
    <section id="view-notes" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">QUICK NOTES</span>
            <h2>Notes Section</h2>
            <p>Quickly capture ideas, plans and important information.</p>
          </div>
          <button onClick={onOpenNote} className="light-action-btn">
            <i className="fa-solid fa-plus"></i> Add Note
          </button>
        </div>

        <div className="task-manager-toolbar" style={{ marginBottom: 15 }}>
          <div className="task-manager-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => setShowArchived(p => !p)} className="task-tool-btn">
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
        </div>

        <div className="notes-grid">
          {filtered.length === 0 && (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              <i className="fa-regular fa-folder-open"></i>
              <strong>{showArchived ? "No archived notes" : search ? "No matching notes" : "No notes yet"}</strong>
              <span>{showArchived ? "Archived notes will appear here." : search ? "Try a different search term." : "Capture an idea, reminder or thought to get started."}</span>
              {!showArchived && !search && <button onClick={onOpenNote} className="small-primary" style={{ marginTop: 10 }}><i className="fa-solid fa-plus"></i> Add Note</button>}
            </div>
          )}
          {filtered.map(note => (
            <div key={note.id} className="note-card">
              <div>
                <div className="note-head">
                  <div>
                    <h4>{escapeHtml(note.title)}</h4>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#7a7a7a", background: "#202020", padding: "3px 8px", borderRadius: 4 }}>{note.category}</span>
                      {note.pinned && <span style={{ fontSize: 12, color: "#f59e0b" }}><i className="fa-solid fa-thumbtack"></i> Pinned</span>}
                      {note.archived && <span style={{ fontSize: 12, color: "#8b7cff" }}><i className="fa-solid fa-box-archive"></i> Archived</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => onTogglePin(note.id)} title={note.pinned ? "Unpin" : "Pin"}>
                      <i className={`fa-solid fa-thumbtack`} style={{ color: note.pinned ? "#f59e0b" : "#666" }}></i>
                    </button>
                    <button onClick={() => onEditNote(note.id)} title="Edit"><i className="fa-solid fa-pen"></i></button>
                    <button onClick={() => onScheduleNote(note)} title="Schedule on calendar"><i className="fa-regular fa-calendar-plus"></i></button>
                    <button onClick={() => { if (confirm("Delete this note?")) onDeleteNote(note.id); }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                  </div>
                </div>
                <div className="note-content">{escapeHtml(note.content)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6b6b6b" }}>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {!note.archived ? (
                      <button onClick={() => { if (confirm("Archive this note?")) onToggleArchive(note.id); }} className="task-tool-btn" style={{ height: 36, fontSize: 12 }}>Archive</button>
                    ) : (
                      <button onClick={() => onRestore(note.id)} className="task-tool-btn" style={{ height: 36, fontSize: 12 }}>Restore</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
