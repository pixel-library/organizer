import { useState, useEffect, useRef } from "react";

const NOTE_CATEGORIES = ["Personal", "Work", "Study", "Ideas", "Important"];

export default function NoteEditor({ note, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Personal");
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState("");
  const titleRef = useRef(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setContent(note.content || "");
      setCategory(note.category || "Personal");
      setPinned(!!note.pinned);
      setTags(Array.isArray(note.tags) ? note.tags.join(", ") : "");
    } else {
      setTitle("");
      setContent("");
      setCategory("Personal");
      setPinned(false);
      setTags("");
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [note]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert("Please fill in all required fields.");
      return;
    }
    const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
    onSave({ title, content, category, pinned, tags: tagList, editingId: note?.id || null });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div id="create-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <span>NOTE WORKSPACE</span>
            <h3>{note?.id ? "Edit Note" : "Add Note"}</h3>
          </div>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>Title</label>
            <input ref={titleRef} type="text" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Tags (comma separated)</label>
            <input type="text" placeholder="ideas, work, urgent..." value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Content</label>
            <textarea placeholder="Write your note..." value={content} onChange={(e) => setContent(e.target.value)} rows={6} style={{ width: "100%", background: "#1c1c1c", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, color: "#ddd", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          </div>
          <div className="modal-field">
            <label>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ marginRight: 8 }} />
              Pin this note
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-cancel">Cancel</button>
          <button onClick={handleSave} className="modal-save">{note?.id ? "Update Note" : "Save Note"}</button>
        </div>
      </div>
    </div>
  );
}
