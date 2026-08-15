import { useState, useMemo } from "react";
import { todayKey } from "../hooks/useLifePlanner";

export default function Tasks({
  tasks, isTaskOverdue, onToggleTask, onDeleteTask, onEditTask, onOpenCreate,
  onBulkComplete, onBulkDelete, onSelectTask, onUpdateTask,
  escapeHtml, priorityClass, priorityLabel, reminderLabel, formatDateKey
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [quick, setQuick] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("dateAsc");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState("list");
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [newSubtask, setNewSubtask] = useState("");

  const today = formatDateKey ? formatDateKey(new Date()) : "";

  const filtered = useMemo(() => {
    let list = tasks.filter(task => {
      const text = `${task.name} ${task.date} ${task.time} ${task.type} ${task.priority} ${task.reminder} ${Array.isArray(task.tags) ? task.tags.join(" ") : task.tags || ""}`.toLowerCase();
      const matchesSearch = !search || text.includes(search.toLowerCase());
      const matchesStatus = status === "all" || (status === "pending" && !task.completed) || (status === "completed" && task.completed) || (status === "overdue" && isTaskOverdue(task));
      const matchesQuick = quick === "all" ||
        (quick === "today" && task.date === today) ||
        (quick === "upcoming" && task.date > today && !task.completed) ||
        (quick === "overdue" && isTaskOverdue(task) && !task.completed) ||
        (quick === "done" && task.completed);
      const matchesPriority = priority === "all" || task.priority === priority;
      const matchesType = type === "all" || task.type === type;
      return matchesSearch && matchesStatus && matchesQuick && matchesPriority && matchesType;
    });
    const priorityRank = { Red: 0, Yellow: 1, Green: 2 };
    list.sort((a, b) => {
      if (sort === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (sort === "name") return a.name.localeCompare(b.name);
      const comparison = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
      return sort === "dateDesc" ? -comparison : comparison;
    });
    return list;
  }, [tasks, search, status, quick, priority, type, sort, isTaskOverdue, today]);

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const high = tasks.filter(t => t.priority === "Red" && !t.completed).length;
  const overdue = tasks.filter(t => isTaskOverdue(t)).length;
  const todayCount = tasks.filter(t => t.date === today).length;
  const upcomingCount = tasks.filter(t => t.date > today && !t.completed).length;

  const quickFilters = [
    { key: "all", label: "All", count: total },
    { key: "today", label: "Today", count: todayCount },
    { key: "upcoming", label: "Upcoming", count: upcomingCount },
    { key: "overdue", label: "Overdue", count: overdue },
    { key: "done", label: "Done", count: completed }
  ];

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
    setQuick("all");
    setPriority("all");
    setType("all");
    setSort("dateAsc");
    setSelectedIds(new Set());
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const subtaskProgress = (task) => {
    const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
    const done = subs.filter(s => s.completed).length;
    return { subs, done };
  };

  const addSubtask = (task) => {
    if (!newSubtask.trim()) return;
    const { subs } = subtaskProgress(task);
    onUpdateTask(task.id, { subtasks: [...subs, { id: Date.now(), name: newSubtask.trim(), completed: false }] });
    setNewSubtask("");
  };

  const toggleSubtask = (task, subId) => {
    const { subs } = subtaskProgress(task);
    onUpdateTask(task.id, { subtasks: subs.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) });
  };

  const deleteSubtask = (task, subId) => {
    const { subs } = subtaskProgress(task);
    onUpdateTask(task.id, { subtasks: subs.filter(s => s.id !== subId) });
  };

  const exportCSV = () => {
    const csv = [
      ["ID","Task","Date","Time","Priority","Reminder","Type","Tags","Completed"],
      ...tasks.map(t => [t.id, t.name, t.date, t.time, t.priority, t.reminder, t.type, Array.isArray(t.tags) ? t.tags.join(";") : (t.tags || ""), t.completed ? "Yes" : "No"])
    ].map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `life-planner-tasks-${todayKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const boardColumns = useMemo(() => {
    return [
      { key: "overdue", label: "Overdue", tasks: filtered.filter(t => !t.completed && isTaskOverdue(t)) },
      { key: "today", label: "Today", tasks: filtered.filter(t => !t.completed && !isTaskOverdue(t) && t.date === today) },
      { key: "upcoming", label: "Upcoming", tasks: filtered.filter(t => !t.completed && !isTaskOverdue(t) && t.date > today) },
      { key: "done", label: "Completed", tasks: filtered.filter(t => t.completed) }
    ];
  }, [filtered, isTaskOverdue, today]);

  const renderTags = (task) => {
    const tags = Array.isArray(task.tags) ? task.tags : [];
    if (!tags.length) return null;
    return (
      <div className="task-tag-list">
        {tags.map(tag => <span key={tag} className="task-tag-chip">{escapeHtml(tag)}</span>)}
      </div>
    );
  };

  const renderSubtaskSection = (task) => {
    const { subs, done } = subtaskProgress(task);
    const isExpanded = expandedIds.has(task.id);
    return (
      <div className="task-subtask-wrap">
        {subs.length > 0 && (
          <>
            <div className="task-subtask-progress">
              <span>{done} / {subs.length} subtasks completed</span>
              <div className="mini-progress"><span style={{ width: subs.length ? `${(done / subs.length) * 100}%` : "0%" }}></span></div>
            </div>
            {isExpanded && (
              <div className="task-subtask-list">
                {subs.map(sub => (
                  <div key={sub.id} className="task-subtask-row">
                    <label>
                      <input type="checkbox" checked={sub.completed} onChange={() => toggleSubtask(task, sub.id)} />
                      <span className={sub.completed ? "completed-text" : ""}>{escapeHtml(sub.name)}</span>
                    </label>
                    <button className="task-action-btn" onClick={() => deleteSubtask(task, sub.id)} title="Remove subtask"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="task-subtask-add">
          <input
            type="text"
            placeholder="Add subtask..."
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addSubtask(task); } }}
          />
          <button className="task-tool-btn" onClick={() => addSubtask(task)}><i className="fa-solid fa-plus"></i></button>
        </div>
      </div>
    );
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
        <div className="task-quick-filters">
          {quickFilters.map(f => (
            <button
              key={f.key}
              className={`task-quick-chip ${quick === f.key ? "active" : ""}`}
              onClick={() => setQuick(f.key)}
            >
              {f.label} <b>{f.count}</b>
            </button>
          ))}
        </div>
        <div className="task-manager-toolbar">
          <div className="task-manager-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tasks" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
            <option value="all">All priority</option>
            <option value="Red">High</option>
            <option value="Yellow">Middle</option>
            <option value="Green">Low</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            <option value="Task">Task</option>
            <option value="Meeting">Meeting</option>
            <option value="Reminder">Reminder</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks">
            <option value="dateAsc">Date ↑</option>
            <option value="dateDesc">Date ↓</option>
            <option value="priority">Priority</option>
            <option value="name">Name</option>
          </select>
          <div className="task-view-switcher">
            <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="List view"><i className="fa-solid fa-list"></i></button>
            <button className={viewMode === "board" ? "active" : ""} onClick={() => setViewMode("board")} title="Board view"><i className="fa-solid fa-square-columns"></i></button>
          </div>
          <button onClick={clearFilters} className="task-tool-btn" title="Clear filters"><i className="fa-solid fa-filter-circle-xmark"></i></button>
          <button onClick={exportCSV} className="task-tool-btn" title="Export CSV"><i className="fa-solid fa-file-export"></i> Export</button>
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

        {viewMode === "list" ? (
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
                  const isOverdue = isTaskOverdue(task);
                  const { subs, done } = subtaskProgress(task);
                  return (
                    <tr key={task.id} className={`${task.completed ? "task-row-completed" : ""} ${isOverdue ? "task-row-overdue" : ""}`}>
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
                        <div className="task-name-sub">
                          {isOverdue ? "OVERDUE" : escapeHtml(task.type)}
                          {task.estimatedTime ? ` · ${escapeHtml(task.estimatedTime)}` : ""}
                        </div>
                        {renderTags(task)}
                        {task.description ? <div className="task-desc-preview">{escapeHtml(task.description)}</div> : null}
                        {subs.length > 0 && (
                          <button className="task-subtask-toggle" onClick={() => toggleExpand(task.id)}>
                            <i className={`fa-solid ${expandedIds.has(task.id) ? "fa-chevron-down" : "fa-chevron-right"}`}></i>
                            {done}/{subs.length} subtasks
                          </button>
                        )}
                        {expandedIds.has(task.id) && renderSubtaskSection(task)}
                      </td>
                      <td>
                        <span className={`task-priority-chip ${color}`}>
                          <i className="fa-solid fa-circle"></i> {priorityLabel(task.priority)}
                        </span>
                      </td>
                      <td>
                        <div className="task-schedule-main">{escapeHtml(task.date)}</div>
                        <div className="task-schedule-sub">{escapeHtml(task.time)} {isOverdue ? " · Overdue" : ""}</div>
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
                          <button className="task-action-btn" onClick={() => onDeleteTask(task.id)} title="Delete"><i className="fa-solid fa-trash-can"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="task-board">
            {boardColumns.map(col => (
              <div key={col.key} className={`task-board-col ${col.key}`}>
                <div className="task-board-head">
                  <span>{col.label}</span>
                  <b>{col.tasks.length}</b>
                </div>
                <div className="task-board-cards">
                  {col.tasks.length === 0 && <div className="task-board-empty">Nothing here</div>}
                  {col.tasks.map(task => {
                    const color = priorityClass(task.priority);
                    const { subs, done } = subtaskProgress(task);
                    return (
                      <div key={task.id} className="task-board-card">
                        <div className="task-board-card-top">
                          <span className={`task-priority-chip ${color}`}><i className="fa-solid fa-circle"></i> {priorityLabel(task.priority)}</span>
                          <span className="task-type-chip">{escapeHtml(task.type)}</span>
                        </div>
                        <h4 className={task.completed ? "completed-text" : ""}>{escapeHtml(task.name)}</h4>
                        <div className="task-board-meta">
                          <span><i className="fa-regular fa-calendar"></i> {escapeHtml(task.date)} · {escapeHtml(task.time)}</span>
                        </div>
                        {renderTags(task)}
                        {subs.length > 0 && (
                          <div className="task-subtask-progress">
                            <span>{done}/{subs.length}</span>
                            <div className="mini-progress"><span style={{ width: subs.length ? `${(done / subs.length) * 100}%` : "0%" }}></span></div>
                          </div>
                        )}
                        <div className="task-board-actions">
                          <button onClick={() => onToggleTask(task.id)} title={task.completed ? "Reopen" : "Complete"}><i className={`fa-solid ${task.completed ? "fa-rotate-left" : "fa-check"}`}></i></button>
                          <button onClick={() => onEditTask(task.id)} title="Edit"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => onDeleteTask(task.id)} title="Delete"><i className="fa-solid fa-trash-can"></i></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
