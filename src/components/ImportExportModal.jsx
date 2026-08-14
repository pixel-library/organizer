import { useRef, useState, useEffect } from "react";
import { todayKey } from "../hooks/useLifePlanner";

export default function ImportExportModal({ open, onClose, exportData, importData, replaceAllData, mergeData, initialMode = "export" }) {
  const [mode, setMode] = useState("export");
  const [status, setStatus] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [parsed, setParsed] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStatus(null);
      setConfirmReplace(false);
      setParsed(null);
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `organizer-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus({ ok: true, text: "Backup downloaded. Keep it somewhere safe." });
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importData(String(reader.result));
      if (!result.ok) {
        setStatus({ ok: false, text: result.errors.join(" ") });
        setParsed(null);
        return;
      }
      setParsed(result.data);
      setConfirmReplace(false);
      setStatus({ ok: true, text: "File validated. Choose how to import it." });
    };
    reader.readAsText(file);
  };

  const doImport = (replace) => {
    if (!parsed) return;
    if (replace) {
      replaceAllData(parsed);
      setStatus({ ok: true, text: "Backup restored — your existing data was replaced." });
    } else {
      const counts = mergeData(parsed);
      const added = Object.values(counts).reduce((s, n) => s + n, 0);
      setStatus({ ok: true, text: `Import complete — ${added} records added. Existing records were preserved.` });
    }
    setParsed(null);
    setConfirmReplace(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Import / Export data">
        <div className="modal-header">
          <div>
            <span>DATA</span>
            <h3>Import / Export</h3>
          </div>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <div className="recurrence-options" style={{ marginBottom: 16 }}>
            <button className={mode === "export" ? "active" : ""} onClick={() => { setMode("export"); setStatus(null); setParsed(null); }}>
              <i className="fa-solid fa-file-export"></i> Export
            </button>
            <button className={mode === "import" ? "active" : ""} onClick={() => { setMode("import"); setStatus(null); setParsed(null); }}>
              <i className="fa-solid fa-file-import"></i> Import
            </button>
          </div>

          {mode === "export" ? (
            <div>
              <p className="io-note">Downloads everything — tasks, events, habits, notes, meals, groceries, goals, reminders, history and settings — as a single JSON file.</p>
              <button className="modal-save" onClick={handleExport} style={{ width: "100%" }}>
                <i className="fa-solid fa-download"></i> Download backup
              </button>
            </div>
          ) : (
            <div>
              <p className="io-note">Choose an <code>organizer-backup.json</code> file. The file is validated before anything is imported.</p>
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="io-file-input" />
              {parsed && (
                <div className="io-options">
                  <button className="modal-field-btn" onClick={() => { doImport(false); }}>
                    <i className="fa-solid fa-plus"></i> Merge with existing data
                  </button>
                  {!confirmReplace ? (
                    <button className="modal-field-btn danger" onClick={() => setConfirmReplace(true)}>
                      <i className="fa-solid fa-triangle-exclamation"></i> Replace all data
                    </button>
                  ) : (
                    <div className="io-confirm">
                      <span>This overwrites all current data with the backup. Are you sure?</span>
                      <div>
                        <button className="modal-save" onClick={() => doImport(true)}>Yes, replace</button>
                        <button className="modal-cancel" onClick={() => setConfirmReplace(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status && (
            <div className={`io-status ${status.ok ? "ok" : "err"}`}>
              <i className={`fa-solid ${status.ok ? "fa-circle-check" : "fa-triangle-exclamation"}`}></i>
              {status.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
