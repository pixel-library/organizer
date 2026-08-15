import { useState, useMemo } from "react";
import GroceryList from "./GroceryList";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function Meals({ meals, groceryList, onEditMeal, onDeleteMeal, onSetMealStatus, onAddGrocery, onUpdateGrocery, onDeleteGrocery, onToggleGrocery, onClearPurchased, onOpenMeal, escapeHtml, formatDateKey }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showGrocery, setShowGrocery] = useState(false);

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d);
    start.setDate(diff + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekStats = useMemo(() => {
    const allWeekMeals = weekDays.flatMap(d => {
      const key = formatDateKey(d);
      return meals.filter(m => m.date === key || m.day === DAYS[d.getDay()]);
    });
    const planned = allWeekMeals.length;
    const completed = allWeekMeals.filter(m => m.status === "completed").length;
    const skipped = allWeekMeals.filter(m => m.status === "skipped").length;
    const calories = allWeekMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const protein = allWeekMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
    return { planned, completed, skipped, calories, protein };
  }, [weekDays, meals, formatDateKey]);

  const getMealForType = (dateKey, dayName, type) => {
    return meals.find(m => (m.date === dateKey || m.day === dayName) && m.type === type);
  };

  const statusChip = (status) => {
    if (status === "completed") return { label: "Completed", color: "#16a34a" };
    if (status === "skipped") return { label: "Skipped", color: "#6B7486" };
    return { label: "Planned", color: "#910029" };
  };

  return (
    <section id="view-meals" className="view-section">
      <div className="standard-panel">
        <div className="standard-panel-heading">
          <div>
            <span className="panel-kicker">LIFESTYLE</span>
            <h2>Weekly Meal Planner</h2>
            <p>Plan your meals, organize your week and manage your grocery list.</p>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setShowGrocery(p => !p)} className="light-action-btn">
              <i className="fa-solid fa-cart-shopping"></i> Grocery List
            </button>
            <button onClick={() => onOpenMeal()} className="light-action-btn">
              <i className="fa-solid fa-plus"></i> Plan Meal
            </button>
          </div>
        </div>

        <div className="calendar-main-toolbar" style={{ marginBottom: 15 }}>
          <div className="calendar-navigation">
            <button onClick={() => setWeekOffset(p => p - 1)} title="Previous week"><i className="fa-solid fa-chevron-left"></i></button>
            <button onClick={() => setWeekOffset(0)} className="toolbar-today">Current Week</button>
            <button onClick={() => setWeekOffset(p => p + 1)} title="Next week"><i className="fa-solid fa-chevron-right"></i></button>
            <span className="calendar-toolbar-title">
              {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="dashboard-stat-grid" style={{ marginBottom: 15 }}>
          <div className="dash-stat-card">
            <div className="dash-stat-top"><span>Meals Planned</span></div>
            <div className="dash-stat-value">{weekStats.planned}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-top"><span>Completed</span></div>
            <div className="dash-stat-value">{weekStats.completed}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-top"><span>Skipped</span></div>
            <div className="dash-stat-value">{weekStats.skipped}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-top"><span>Calories</span></div>
            <div className="dash-stat-value">{weekStats.calories > 0 ? weekStats.calories.toLocaleString() : "Not tracked"}</div>
          </div>
        </div>

        {showGrocery && (
          <div style={{ marginBottom: 20 }}>
            <GroceryList
              groceryList={groceryList}
              meals={meals}
              onAdd={onAddGrocery}
              onUpdate={onUpdateGrocery}
              onDelete={onDeleteGrocery}
              onToggle={onToggleGrocery}
              onClearPurchased={onClearPurchased}
              escapeHtml={escapeHtml}
            />
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                {MEAL_TYPES.map(type => <th key={type}>{type}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekDays.map(d => {
                const dayName = DAYS[d.getDay()];
                const dateKey = formatDateKey(d);
                return (
                  <tr key={dateKey}>
                    <td style={{ fontWeight: 700, color: "#393F4B", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      <div>{dayName}</div>
                      <div style={{ fontSize: 12, color: "#7A8494", fontWeight: 400 }}>{dateKey}</div>
                    </td>
                    {MEAL_TYPES.map(type => {
                      const meal = getMealForType(dateKey, dayName, type);
                      return (
                        <td key={type} style={{ verticalAlign: "top" }}>
                          {meal ? (
                            <div style={{ padding: 8, background: "#F2F7FA", border: "1px solid rgba(57,63,75,.08)", borderRadius: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3, gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#393F4B" }}>{escapeHtml(meal.name || type)}</div>
                                <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: statusChip(meal.status).color + "22", color: statusChip(meal.status).color }}>{statusChip(meal.status).label}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "#7A8494", marginBottom: 2 }}>{escapeHtml(meal.time || "")}</div>
                              {meal.calories ? <div style={{ fontSize: 12, color: "#6B7486" }}>{meal.calories} kcal</div> : <div style={{ fontSize: 12, color: "#8A94A5" }}>Nutrition: Not tracked</div>}
                              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                <button onClick={() => onEditMeal(meal.id)} className="task-tool-btn" style={{ height: 36, fontSize: 12 }} title="Edit"><i className="fa-solid fa-pen"></i></button>
                                <button onClick={() => onSetMealStatus(meal.id, meal.status === "completed" ? "planned" : "completed")} className="task-tool-btn" style={{ height: 36, fontSize: 12 }} title="Toggle complete"><i className="fa-solid fa-check"></i></button>
                                <button onClick={() => onSetMealStatus(meal.id, meal.status === "skipped" ? "planned" : "skipped")} className="task-tool-btn" style={{ height: 36, fontSize: 12 }} title="Toggle skipped"><i className="fa-solid fa-ban"></i></button>
                                <button onClick={() => { if (confirm("Delete this meal?")) onDeleteMeal(meal.id); }} className="task-tool-btn delete" style={{ height: 36, fontSize: 12 }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => onOpenMeal({ day: dayName, date: dateKey, type })} className="task-tool-btn" style={{ width: "100%", height: 38, borderStyle: "dashed", fontSize: 12 }}>
                              <i className="fa-solid fa-plus"></i> Add
                            </button>
                          )}
                        </td>
                      );
                    })}
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
