export default function UndoToast({ undoState, onUndo }) {
  if (!undoState) return null;
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span><i className="fa-solid fa-circle-check"></i> {undoState.label}</span>
      <button onClick={onUndo}><i className="fa-solid fa-rotate-left"></i> Undo</button>
    </div>
  );
}
