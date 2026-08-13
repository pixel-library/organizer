export default function History({ history, onRemoveItem, onClear, escapeHtml }) {
  return (
    <section id="view-history" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">ACTIVITY LOG</span>
            <h2>History Archive</h2>
            <p>Permanent log of task creation, completion and deletion.</p>
          </div>
          <button onClick={onClear} className="outline-btn">
            <i className="fa-solid fa-trash"></i> Clear Archive
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action Status</th>
                <th>Item</th>
                <th>Timestamp</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="task-empty">
                    <i className="fa-regular fa-clock"></i>
                    <strong>No history yet</strong>
                    <span>Task creation, completion and deletion will be logged here.</span>
                  </div>
                </td></tr>
              )}
              {history.map((item, index) => (
                <tr key={item.id}>
                  <td><span className="task-type-chip">{escapeHtml(item.status)}</span></td>
                  <td>{escapeHtml(item.name)}</td>
                  <td>{escapeHtml(item.timestamp)}</td>
                  <td>
                    <button className="task-action-btn" onClick={() => onRemoveItem(index)}>
                      <i className="fa-solid fa-xmark"></i>
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
