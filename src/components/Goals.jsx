import { useState, useMemo, useEffect } from "react";

export default function Goals({ goals, onAddGoal, onUpdateGoal, onDeleteGoal, escapeHtml, openRequest = 0 }) {
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (openRequest) setShowForm(true);
  }, [openRequest]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [unit, setUnit] = useState("");

  const submit = () => {
    if (!name.trim() || !Number(target)) {
      alert("Please enter a name and a target number.");
      return;
    }
    onAddGoal({
      name: name.trim(),
      target: Number(target),
      current: Number(current || 0),
      unit: unit.trim() || "items"
    });
    setName("");
    setTarget("");
    setCurrent("");
    setUnit("");
    setShowForm(false);
  };

  const totalProgress = useMemo(() => {
    const goalTotal = goals.reduce((sum, g) => sum + Number(g.target || 0), 0);
    const goalCurrent = goals.reduce((sum, g) => sum + Math.min(Number(g.current || 0), Number(g.target || 0)), 0);
    return goalTotal ? Math.round((goalCurrent / goalTotal) * 100) : 0;
  }, [goals]);

  return (
    <section id="view-goals" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">OBJECTIVES</span>
            <h2>Goals</h2>
            <p>Track progress toward meaningful outcomes.</p>
          </div>
          <button onClick={() => setShowForm(p => !p)} className="light-action-btn">
            <i className="fa-solid fa-plus"></i> New Goal
          </button>
        </div>

        {goals.length === 0 && (
          <div className="analytics-empty-state">
            <div className="empty-icon large"><i className="fa-solid fa-bullseye"></i></div>
            <strong>No goals yet</strong>
            <span>Set a target and track real progress toward it.</span>
          </div>
        )}

        {goals.length > 0 && (
          <div className="goals-overview">
            <div className="goals-overall">
              <span>OVERALL PROGRESS</span>
              <strong>{totalProgress}%</strong>
              <div className="mini-progress"><span style={{ width: `${totalProgress}%` }}></span></div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="goals-form">
            <input type="text" placeholder="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="number" placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
            <input type="number" placeholder="Current (optional)" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <input type="text" placeholder="Unit (e.g. books, modules)" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <button className="small-primary" onClick={submit}><i className="fa-solid fa-check"></i> Save Goal</button>
          </div>
        )}

        <div className="goal-grid">
          {goals.map(goal => {
            const percent = Math.min(100, Math.round(Number(goal.current) / Math.max(1, Number(goal.target)) * 100));
            const done = Number(goal.current) >= Number(goal.target) && Number(goal.target) > 0;
            return (
              <div key={goal.id} className={`goal-card ${done ? "done" : ""}`}>
                <div className="goal-card-top">
                  <h4>{escapeHtml(goal.name)}</h4>
                  {done && <span className="goal-done-badge"><i className="fa-solid fa-check"></i> Achieved</span>}
                </div>
                <div className="goal-card-value">{percent}%</div>
                <div className="project-progress"><span style={{ width: `${percent}%` }}></span></div>
                <div className="goal-card-meta">
                  <span>{goal.current} / {goal.target} {escapeHtml(goal.unit || "")}</span>
                  <div>
                    <button onClick={() => onUpdateGoal(goal.id, { current: Math.max(0, Number(goal.current || 0) + 1) })} title="Increase"><i className="fa-solid fa-plus"></i></button>
                    <button onClick={() => onUpdateGoal(goal.id, { current: Math.max(0, Number(goal.current || 0) - 1) })} title="Decrease"><i className="fa-solid fa-minus"></i></button>
                    <button className="danger" onClick={() => { if (confirm("Delete this goal?")) onDeleteGoal(goal.id); }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
