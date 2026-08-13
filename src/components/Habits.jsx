export default function Habits({ habits, onToggleDay, onAddHabit, onDeleteHabit, escapeHtml }) {
  return (
    <section id="view-habits" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">ROUTINE</span>
            <h2>Habit Tracker Matrix</h2>
            <p>Build consistency with daily routine check-ins.</p>
          </div>
          <button onClick={() => { const name = prompt("Enter habit name:"); if (name) onAddHabit(name); }} className="light-action-btn">
            <i className="fa-solid fa-plus"></i> New Habit
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Habit Name</th>
                <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="task-empty">
                      <i className="fa-solid fa-hand-fist"></i>
                      <strong>No habits yet</strong>
                      <span>Add a habit to start building a daily routine.</span>
                    </div>
                  </td>
                </tr>
              )}
              {habits.map((habit, index) => (
                <tr key={habit.id}>
                  <td>{escapeHtml(habit.name)}</td>
                  {habit.days.map((checked, dayIndex) => (
                    <td key={dayIndex} style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={checked} onChange={() => onToggleDay(index, dayIndex)} />
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>
                    <button className="task-action-btn" onClick={() => onDeleteHabit(index)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
