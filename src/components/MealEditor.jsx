import { useState, useEffect, useRef } from "react";
import { todayKey } from "../hooks/useLifePlanner";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function MealEditor({ meal, preset, onSave, onClose }) {
  const [day, setDay] = useState("Monday");
  const [mealDate, setMealDate] = useState(todayKey());
  const [mealType, setMealType] = useState("Breakfast");
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbohydrates, setCarbohydrates] = useState("");
  const [fat, setFat] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("planned");
  const nameRef = useRef(null);

  useEffect(() => {
    if (meal) {
      setDay(meal.day || "Monday");
      setMealDate(meal.date || todayKey());
      setMealType(meal.type || "Breakfast");
      setName(meal.name || "");
      setTime(meal.time || "08:00");
      setCalories(meal.calories ?? "");
      setProtein(meal.protein ?? "");
      setCarbohydrates(meal.carbohydrates ?? "");
      setFat(meal.fat ?? "");
      setIngredients(Array.isArray(meal.ingredients) ? meal.ingredients.join(", ") : "");
      setNotes(meal.notes || "");
      setStatus(meal.status || "planned");
    } else if (preset) {
      setDay(preset.day || new Date().toLocaleDateString("en-US", { weekday: "long" }));
      setMealDate(preset.date || todayKey());
      setMealType(preset.type || "Breakfast");
      setName(preset.name || "");
      setTime(preset.time || (preset.type === "Breakfast" ? "08:00" : preset.type === "Lunch" ? "13:00" : preset.type === "Dinner" ? "20:00" : "16:00"));
      setCalories("");
      setProtein("");
      setCarbohydrates("");
      setFat("");
      setIngredients("");
      setNotes("");
      setStatus("planned");
    } else {
      setDay("Monday");
      setMealDate(todayKey());
      setMealType("Breakfast");
      setName("");
      setTime("08:00");
      setCalories("");
      setProtein("");
      setCarbohydrates("");
      setFat("");
      setIngredients("");
      setNotes("");
      setStatus("planned");
    }
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [meal, preset]);

  const handleSave = () => {
    if (!name.trim() || !day.trim()) {
      alert("Please fill in all required fields.");
      return;
    }
    const data = {
      day,
      date: mealDate,
      type: mealType,
      name,
      time,
      calories: calories ? Number(calories) : null,
      protein: protein ? Number(protein) : null,
      carbohydrates: carbohydrates ? Number(carbohydrates) : null,
      fat: fat ? Number(fat) : null,
      ingredients: ingredients ? ingredients.split(",").map(i => i.trim()).filter(Boolean) : [],
      notes,
      status,
      editingId: meal?.id || null
    };
    onSave(data);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div id="create-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <span>MEAL WORKSPACE</span>
            <h3>{meal?.id ? "Edit Meal" : "Plan Meal"}</h3>
          </div>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <div className="modal-two">
            <div className="modal-field">
              <label>Day</label>
              <input type="text" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Monday" />
            </div>
            <div className="modal-field">
              <label>Date</label>
              <input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
            </div>
          </div>
          <div className="modal-field">
            <label>Meal Type</label>
            <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Meal Name</label>
            <input ref={nameRef} type="text" placeholder="e.g. Chicken Rice Bowl" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Calories (kcal)</label>
              <input type="number" placeholder="e.g. 450" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Protein (g)</label>
              <input type="number" placeholder="e.g. 30" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
          </div>
          <div className="modal-two">
            <div className="modal-field">
              <label>Carbohydrates (g)</label>
              <input type="number" placeholder="e.g. 50" value={carbohydrates} onChange={(e) => setCarbohydrates(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Fat (g)</label>
              <input type="number" placeholder="e.g. 15" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>
          <div className="modal-field">
            <label>Ingredients (comma separated)</label>
            <input type="text" placeholder="Chicken, Rice, Broccoli" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Notes</label>
            <textarea placeholder="Any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%", background: "#1c1c1c", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, color: "#ddd", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-cancel">Cancel</button>
          <button onClick={handleSave} className="modal-save">{meal?.id ? "Update Meal" : "Save Meal"}</button>
        </div>
      </div>
    </div>
  );
}
