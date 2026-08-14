import { useMemo } from "react";
import { computeHabitStats } from "../hooks/useLifePlanner";

export default function Analytics({ tasks, habits, calendarEvents, isTaskOverdue, formatDateKey, onSwitchView }) {
  const today = formatDateKey(new Date());

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    const overdue = tasks.filter(t => isTaskOverdue(t)).length;

    const now = new Date();
    const monthStart = formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = formatDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const weekStartDate = new Date(now);
    const day = now.getDay();
    weekStartDate.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    const weekStart = formatDateKey(weekStartDate);

    const monthTasks = tasks.filter(t => t.date >= monthStart && t.date <= monthEnd);
    const monthCompleted = monthTasks.filter(t => t.completed).length;
    const monthRate = monthTasks.length ? Math.round((monthCompleted / monthTasks.length) * 100) : 0;

    const weekTasks = tasks.filter(t => t.date >= weekStart && t.date <= today);
    const weekCompleted = weekTasks.filter(t => t.completed).length;
    const weekRate = weekTasks.length ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;

    const monthEvents = calendarEvents.filter(e => e.start >= monthStart && e.start <= monthEnd);
    const upcomingEvents = calendarEvents.filter(e => e.start >= today);

    const habitStats = habits.map(h => computeHabitStats(h));
    const habitCompletions = habitStats.reduce((sum, s) => sum + s.totalCompletions, 0);
    const habitRate = habitStats.length
      ? Math.round(habitStats.reduce((sum, s) => sum + s.completionRate, 0) / habitStats.length)
      : 0;
    const bestStreak = habitStats.reduce((max, s) => Math.max(max, s.bestStreak), 0);

    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = formatDateKey(d);
      last14Days.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
        completedTasks: tasks.filter(t => t.date === key && t.completed).length,
        habitCompletions: habits.reduce((sum, h) => sum + (Array.isArray(h.history) && h.history.includes(key) ? 1 : 0), 0),
        events: calendarEvents.filter(e => e.start === key).length
      });
    }
    const maxActivity = Math.max(1, ...last14Days.map(d => d.completedTasks + d.habitCompletions + d.events));

    return {
      total, completed, rate, overdue,
      monthTasks: monthTasks.length, monthCompleted, monthRate,
      weekTasks: weekTasks.length, weekCompleted, weekRate,
      monthEvents: monthEvents.length, upcomingEvents: upcomingEvents.length,
      habitCompletions, habitRate, bestStreak,
      last14Days, maxActivity,
      hasData: total > 0 || calendarEvents.length > 0 || habits.length > 0
    };
  }, [tasks, habits, calendarEvents, isTaskOverdue, formatDateKey, today]);

  if (!stats.hasData) {
    return (
      <section id="view-analytics" className="view-section">
        <div className="standard-panel">
          <div className="standard-panel-heading">
            <div>
              <span className="panel-kicker">INSIGHTS</span>
              <h2>Productivity Analytics</h2>
              <p>Measure what you actually do.</p>
            </div>
          </div>
          <div className="analytics-empty-state">
            <div className="empty-icon large"><i className="fa-solid fa-chart-simple"></i></div>
            <strong>No productivity data yet</strong>
            <span>Complete tasks and habits to start seeing your analytics.</span>
            <div className="dashboard-empty-actions">
              <button onClick={() => onSwitchView("tasks")}><i className="fa-solid fa-list-check"></i> Go to Tasks</button>
              <button onClick={() => onSwitchView("habits")}><i className="fa-solid fa-bolt"></i> Go to Habits</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="view-analytics" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">INSIGHTS</span>
            <h2>Productivity Analytics</h2>
            <p>Calculated from your actual tasks, habits and events.</p>
          </div>
        </div>

        <div className="analytics-kpi-grid">
          <div className="analytics-kpi">
            <span>Task Completion Rate</span>
            <strong>{stats.rate}%</strong>
            <small>{stats.completed} / {stats.total} tasks</small>
          </div>
          <div className="analytics-kpi">
            <span>Overdue Tasks</span>
            <strong>{stats.overdue}</strong>
            <small>needs attention</small>
          </div>
          <div className="analytics-kpi">
            <span>Habit Consistency</span>
            <strong>{stats.habitRate}%</strong>
            <small>{stats.habitCompletions} total check-ins</small>
          </div>
          <div className="analytics-kpi">
            <span>Best Habit Streak</span>
            <strong>{stats.bestStreak}</strong>
            <small>days</small>
          </div>
          <div className="analytics-kpi">
            <span>Events This Month</span>
            <strong>{stats.monthEvents}</strong>
            <small>{stats.upcomingEvents} upcoming</small>
          </div>
        </div>

        <div className="analytics-month-grid">
          <div className="analytics-block">
            <div className="analytics-section-title">This week</div>
            <div className="analytics-metric-row">
              <div><span>Tasks planned</span><strong>{stats.weekTasks}</strong></div>
              <div><span>Completed</span><strong>{stats.weekCompleted}</strong></div>
              <div><span>Completion</span><strong>{stats.weekRate}%</strong></div>
            </div>
            <div className="mini-progress"><span style={{ width: `${stats.weekRate}%` }}></span></div>
          </div>
          <div className="analytics-block">
            <div className="analytics-section-title">This month</div>
            <div className="analytics-metric-row">
              <div><span>Tasks planned</span><strong>{stats.monthTasks}</strong></div>
              <div><span>Completed</span><strong>{stats.monthCompleted}</strong></div>
              <div><span>Completion</span><strong>{stats.monthRate}%</strong></div>
            </div>
            <div className="mini-progress"><span style={{ width: `${stats.monthRate}%` }}></span></div>
          </div>
        </div>

        <div className="analytics-block">
          <div className="analytics-section-title">Last 14 days activity</div>
          <div className="analytics-activity-chart">
            {stats.last14Days.map(day => {
              const activity = day.completedTasks + day.habitCompletions + day.events;
              return (
                <div key={day.key} className="activity-col" title={`${day.key}: ${day.completedTasks} tasks, ${day.habitCompletions} habits, ${day.events} events`}>
                  <div className="activity-bar-track">
                    <div className="activity-bar" style={{ height: activity ? `${Math.max(10, (activity / stats.maxActivity) * 100)}%` : "6%" }}></div>
                  </div>
                  <span>{day.label}</span>
                </div>
              );
            })}
          </div>
          <div className="activity-legend">
            <span><i style={{ background: "var(--blue)" }}></i> completed tasks</span>
            <span><i style={{ background: "var(--purple)" }}></i> habit check-ins</span>
            <span><i style={{ background: "var(--orange)" }}></i> events</span>
          </div>
        </div>
      </div>
    </section>
  );
}
