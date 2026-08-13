export default function Sidebar({ currentView, onSwitchView, historyCount }) {
  const navItems = [
    { id: "dashboard", icon: "fa-solid fa-house", label: "Dashboard" },
    { id: "calendar", icon: "fa-regular fa-calendar-days", label: "Task calendar" },
    { id: "habits", icon: "fa-solid fa-bolt", label: "Habit Tracker" },
    { id: "meals", icon: "fa-solid fa-utensils", label: "Meal Planner" },
    { id: "tasks", icon: "fa-solid fa-list-check", label: "My Tasks" },
    { id: "notes", icon: "fa-regular fa-note-sticky", label: "Notes" },
    { id: "history", icon: "fa-solid fa-clock-rotate-left", label: "History" }
  ];

  return (
    <aside className="app-sidebar">
      <div>
        <div className="sidebar-brand">
          <span className="brand-dot"></span>
          <div>
            <strong>Life Planner</strong>
            <small>WORKSPACE OS</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">MAIN MENU</div>
          {navItems.map(item => (
            <a
              key={item.id}
              href="#"
              onClick={(e) => { e.preventDefault(); onSwitchView(item.id); }}
              id={`nav-${item.id}`}
              className={`nav-item ${currentView === item.id ? "active" : ""}`}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
              {item.id === "history" && (
                <span id="history-badge" className="nav-count">
                  {historyCount}
                </span>
              )}
            </a>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="reminder-status">
          <div className="reminder-icon">
            <i className="fa-regular fa-bell"></i>
          </div>
          <div>
            <span>Reminder daemon</span>
            <strong id="reminder-status-badge">
              <i className="fa-solid fa-circle"></i>
              Active monitoring
            </strong>
          </div>
        </div>
        <div className="sidebar-profile">
          <div className="profile-avatar">LP</div>
          <div>
            <strong>Life Planner</strong>
            <span>Personal workspace</span>
          </div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    </aside>
  );
}
