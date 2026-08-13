export default function ReminderModal({ text, onDismiss }) {
  return (
    <div id="reminder-alert-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}>
      <div className="reminder-modal">
        <div className="reminder-bell"><i className="fa-regular fa-bell"></i></div>
        <div className="reminder-label">REMINDER</div>
        <h3>Task Reminder</h3>
        <p id="reminder-alert-text">{text}</p>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
