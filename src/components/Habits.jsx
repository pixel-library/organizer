import { useMemo } from "react";
import { computeHabitStats } from "../hooks/useLifePlanner";

export default function Habits({ habits, onToggleDay, onAddHabit, onDeleteHabit, escapeHtml }) {
  const stats = useMemo(() => {
    return habits.map(h => computeHabitStats(h));
  }, [habits]);

  return (
    <section id="view-habits" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">ROUTINE</span>
            <h2>Habit Tracker</h2>
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
                <th>Current Streak</th>
                <th>Best Streak</th>
                <th>Completion</th>
                <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <div className="task-empty">
                      <i className="fa-solid fa-hand-fist"></i>
                      <strong>No habits yet</strong>
                      <span>Start building a habit to see streaks and consistency here.</span>
                    </div>
                  </td>
                </tr>
              )}
              {habits.map((habit, index) => {
                const s = stats[index] || { totalCompletions: 0, currentStreak: 0, bestStreak: 0, completionRate: 0 };
                return (
                  <tr key={habit.id}>
                    <td>
                      <strong style={{ color: "var(--text)" }}>{escapeHtml(habit.name)}</strong>
                      {s.totalCompletions === 0 && <div className="habit-no-history">No habit history yet</div>}
                    </td>
                    <td>
                      <span className={`habit-streak-chip ${s.currentStreak > 0 ? "active" : ""}`}>
                        <i className="fa-solid fa-fire"></i> {s.currentStreak} day{s.currentStreak === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td><strong style={{ color: "var(--text)" }}>{s.bestStreak}</strong></td>
                    <td>
                      <div className="habit-rate-cell">
                        <span>{s.completionRate}%</span>
                        <div className="mini-progress"><span style={{ width: `${Math.min(100, s.completionRate)}%` }}></span></div>
                      </div>
                    </td>
                    {habit.days.map((checked, dayIndex) => (
                      <td key={dayIndex} style={{ textAlign: "center" }}>
                        <button
                          className={`habit-day-cell ${checked ? "checked" : ""}`}
                          onClick={() => onToggleDay(index, dayIndex)}
                          aria-label={`Toggle ${habit.name} on ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][dayIndex]}`}
                          title={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][dayIndex]}
                        >
                          {checked && <i className="fa-solid fa-check"></i>}
                        </button>
                      </td>
                    ))}
                    <td style={{ textAlign: "right" }}>
                      <button className="task-action-btn" onClick={() => { if (confirm(`Delete habit "${habit.name}"?`)) onDeleteHabit(index); }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
