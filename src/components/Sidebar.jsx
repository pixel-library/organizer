import InstallButton from "./InstallButton";

export default function Sidebar({ currentView, onSwitchView, historyCount, user, onLogout, mobileOpen = false, onMobileNavigate }) {
  const initials = (user?.name || "LP")
    .split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

  const logout = (e) => {
    e.preventDefault();
    if (confirm("Sign out of Life Planner?")) onLogout?.();
  };
  const navItems = [
    { id: "dashboard", icon: "fa-solid fa-house", label: "Dashboard" },
    { id: "calendar", icon: "fa-regular fa-calendar-days", label: "Task calendar" },
    { id: "tasks", icon: "fa-solid fa-list-check", label: "My Tasks" },
    { id: "notes", icon: "fa-regular fa-note-sticky", label: "Notes" },
    { id: "analytics", icon: "fa-solid fa-chart-simple", label: "Analytics" },
    { id: "goals", icon: "fa-solid fa-bullseye", label: "Goals" },
    { id: "habits", icon: "fa-solid fa-bolt", label: "Habit Tracker" },
    { id: "reminders", icon: "fa-regular fa-bell", label: "Reminders" },
    { id: "meals", icon: "fa-solid fa-utensils", label: "Meal Planner" },
    { id: "history", icon: "fa-solid fa-clock-rotate-left", label: "History" },
    { id: "settings", icon: "fa-solid fa-gear", label: "Settings" }
  ];
  if (user?.role === "admin") {
    navItems.push({ id: "admin", icon: "fa-solid fa-shield-halved", label: "Admin Panel" });
  }

  const go = (id) => {
    onSwitchView(id);
    onMobileNavigate?.();
  };

  return (
    <aside className={`app-sidebar ${mobileOpen ? "open" : ""}`}>
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
              onClick={(e) => { e.preventDefault(); go(item.id); }}
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
        <InstallButton />
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
          <div className="profile-avatar">{initials}</div>
          <div>
            <strong>{user?.name || "Life Planner"}</strong>
            <span>{user?.username ? `@${user.username}` : "Personal workspace"}</span>
          </div>
          <button className="profile-logout" onClick={logout} title="Sign out" aria-label="Sign out">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
