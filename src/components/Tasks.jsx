import { useState, useMemo } from "react";

export default function Tasks({
  tasks, isTaskOverdue, onToggleTask, onDeleteTask, onEditTask, onOpenCreate,
  onBulkComplete, onBulkDelete, onSelectTask, escapeHtml, priorityClass, priorityLabel, reminderLabel
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("dateAsc");
  const [selectedIds, setSelectedIds] = useState(new Set());

  const filtered = useMemo(() => {
    let list = tasks.filter(task => {
      const text = `${task.name} ${task.date} ${task.time} ${task.type} ${task.priority} ${task.reminder}`.toLowerCase();
      const matchesSearch = !search || text.includes(search.toLowerCase());
      const matchesStatus = status === "all" || (status === "pending" && !task.completed) || (status === "completed" && task.completed) || (status === "overdue" && isTaskOverdue(task));
      const matchesPriority = priority === "all" || task.priority === priority;
      const matchesType = type === "all" || task.type === type;
      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
    const priorityRank = { Red: 0, Yellow: 1, Green: 2 };
    list.sort((a, b) => {
      if (sort === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (sort === "name") return a.name.localeCompare(b.name);
      const comparison = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
      return sort === "dateDesc" ? -comparison : comparison;
    });
    return list;
  }, [tasks, search, status, priority, type, sort, isTaskOverdue]);

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const high = tasks.filter(t => t.priority === "Red" && !t.completed).length;
  const overdue = tasks.filter(t => isTaskOverdue(t)).length;

  const allSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));
  const someSelected = filtered.some(t => selectedIds.has(t.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    setSelectedIds(checked ? new Set(filtered.map(t => t.id)) : new Set());
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setType("all");
    setSort("dateAsc");
    setSelectedIds(new Set());
  };

  return (
    <section id="view-tasks" className="view-section">
      <div className="task-manager-header">
        <div>
          <span className="panel-kicker">TASK MANAGEMENT</span>
          <h2>My Tasks</h2>
          <p>Manage, prioritize, filter and complete your work.</p>
        </div>
        <button onClick={onOpenCreate} className="calendar-orange-btn">
          <i className="fa-solid fa-plus"></i> Create Task
        </button>
      </div>

      <div className="task-summary-grid">
        <div className="task-summary-card"><span>Total Tasks</span><strong>{total}</strong><i className="fa-solid fa-layer-group"></i></div>
        <div className="task-summary-card"><span>Pending</span><strong>{pending}</strong><i className="fa-regular fa-clock"></i></div>
        <div className="task-summary-card"><span>Completed</span><strong>{completed}</strong><i className="fa-solid fa-check"></i></div>
        <div className="task-summary-card danger"><span>High Priority</span><strong>{high}</strong><i className="fa-solid fa-bolt"></i></div>
        <div className="task-summary-card danger-soft"><span>Overdue</span><strong>{overdue}</strong><i className="fa-solid fa-triangle-exclamation"></i></div>
      </div>

      <div className="task-manager-panel">
        <div className="task-manager-toolbar">
          <div className="task-manager-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priority</option>
            <option value="Red">High</option>
            <option value="Yellow">Middle</option>
            <option value="Green">Low</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            <option value="Task">Task</option>
            <option value="Meeting">Meeting</option>
            <option value="Reminder">Reminder</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="dateAsc">Date ↑</option>
            <option value="dateDesc">Date ↓</option>
            <option value="priority">Priority</option>
            <option value="name">Name</option>
          </select>
          <button onClick={clearFilters} className="task-tool-btn"><i className="fa-solid fa-filter-circle-xmark"></i></button>
          <button onClick={() => {
            const csv = [
              ["ID","Task","Date","Time","Priority","Reminder","Type","Completed"],
              ...tasks.map(t => [t.id, t.name, t.date, t.time, t.priority, t.reminder, t.type, t.completed ? "Yes" : "No"])
            ].map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `life-planner-tasks-${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          }} className="task-tool-btn"><i className="fa-solid fa-file-export"></i> Export</button>
        </div>

        <div className="bulk-toolbar">
          <label>
            <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={(e) => toggleAll(e.target.checked)} />
            Select all
          </label>
          <span>{selectedIds.size} selected</span>
          <div>
            <button onClick={() => onBulkComplete([...selectedIds])}><i className="fa-solid fa-check"></i> Complete</button>
            <button onClick={() => { if (confirm(`Delete ${selectedIds.size} selected task${selectedIds.size === 1 ? "" : "s"}?`)) onBulkDelete([...selectedIds]); }} className="danger"><i className="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="task-manager-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Task</th>
                <th>Priority</th>
                <th>Date & Time</th>
                <th>Reminder</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="task-empty">
                    <i className="fa-regular fa-folder-open"></i>
                    <strong>No tasks found</strong>
                    <span>Try changing your filters or create a new task.</span>
                  </div>
                </td></tr>
              )}
              {filtered.map(task => {
                const color = priorityClass(task.priority);
                const overdue = isTaskOverdue(task);
                return (
                  <tr key={task.id} className={`${task.completed ? "task-row-completed" : ""} ${overdue ? "task-row-overdue" : ""}`}>
                    <td>
                      <div className="task-status-wrap">
                        <input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task.id)} />
                        <span className={`task-status-dot ${task.completed ? "done" : ""}`}></span>
                      </div>
                    </td>
                    <td>
                      <div className={`task-name-main ${task.completed ? "completed" : ""}`}>
                        <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)} />
                        <span>{escapeHtml(task.name)}</span>
                      </div>
                      <div className="task-name-sub">ID #{task.id} {overdue ? " · OVERDUE" : ""}</div>
                    </td>
                    <td>
                      <span className={`task-priority-chip ${color}`}>
                        <i className="fa-solid fa-circle"></i> {priorityLabel(task.priority)}
                      </span>
                    </td>
                    <td>
                      <div className="task-schedule-main">{escapeHtml(task.date)}</div>
                      <div className="task-schedule-sub">{escapeHtml(task.time)} {overdue ? " · Overdue" : ""}</div>
                    </td>
                    <td>
                      <span className="task-reminder-chip">
                        <i className="fa-regular fa-bell"></i> {reminderLabel(task.reminder)}
                      </span>
                    </td>
                    <td>
                      <span className="task-type-chip">{escapeHtml(task.type)}</span>
                    </td>
                    <td className="actions-col">
                      <div className="task-actions">
                        <button className="task-action-btn" onClick={() => onEditTask(task.id)} title="Edit"><i className="fa-solid fa-pen"></i></button>
                        <button className="task-action-btn" onClick={() => onSelectTask(task.id)} title="Open calendar"><i className="fa-regular fa-calendar"></i></button>
                        <button className="task-action-btn delete" onClick={() => onDeleteTask(task.id)} title="Delete"><i className="fa-solid fa-trash-can"></i></button>
                      </div>
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
