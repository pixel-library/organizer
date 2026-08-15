import { useState, useMemo } from "react";

const GROCERY_CATEGORIES = ["Proteins", "Vegetables", "Fruits", "Grains", "Dairy", "Other"];

const CATEGORY_KEYWORDS = {
  Proteins: ["chicken", "beef", "pork", "turkey", "fish", "salmon", "egg", "eggs", "tofu", "shrimp", "tuna", "steak", "bacon", "sausage", "lentils", "beans", "chickpea", "ham"],
  Vegetables: ["broccoli", "spinach", "salad", "lettuce", "tomato", "cucumber", "onion", "carrot", "pepper", "mushroom", "zucchini", "asparagus", "kale", "cabbage", "celery", "garlic", "potato", "peas", "corn", "avocado", "herbs"],
  Fruits: ["apple", "banana", "berry", "berries", "orange", "lemon", "lime", "mango", "strawberry", "blueberry", "grapes", "watermelon", "pineapple", "peach", "pear"],
  Grains: ["rice", "quinoa", "oat", "oats", "bread", "pasta", "tortilla", "wrap", "cereal", "granola", "barley", "flour", "noodles", "couscous", "bagel"],
  Dairy: ["milk", "yogurt", "cheese", "butter", "cream", "greek", "cottage", "mozzarella", "parmesan"]
};

const categorize = (name) => {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return "Other";
};

export default function GroceryList({ groceryList, meals, onAdd, onUpdate, onDelete, onToggle, onClearPurchased, escapeHtml }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("Other");

  const items = useMemo(() => {
    let list = groceryList;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(s));
    }
    if (filter === "remaining") list = list.filter(item => !item.completed);
    if (filter === "purchased") list = list.filter(item => item.completed);
    return list;
  }, [groceryList, search, filter]);

  const grouped = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const category = item.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });
    return groups;
  }, [items]);

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAdd({ name: newItem.trim(), quantity: "", unit: "", completed: false, category: newCategory });
    setNewItem("");
  };

  const editItem = (item) => {
    const qty = prompt(`Quantity for "${item.name}":`, item.quantity || "");
    if (qty === null) return;
    const unit = prompt(`Unit for "${item.name}" (optional):`, item.unit || "");
    if (unit === null) return;
    onUpdate(item.id, { quantity: qty, unit: unit || "" });
  };

  const generateFromMeals = () => {
    const collected = [];
    (meals || []).forEach(m => {
      (m.ingredients || []).forEach(ing => {
        const name = String(ing).trim();
        if (!name) return;
        const existing = collected.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.count = (existing.count || 1) + 1;
          return;
        }
        collected.push({ name, category: categorize(name), count: 1 });
      });
    });
    if (collected.length === 0) {
      alert("No meal ingredients found. Add ingredients to a meal first.");
      return;
    }
    if (!confirm(`Add ${collected.length} ingredient${collected.length === 1 ? "" : "s"} to the grocery list?`)) return;
    collected.forEach(it => {
      onAdd({
        name: it.name,
        quantity: it.count > 1 ? String(it.count) : "",
        unit: it.count > 1 ? "x" : "",
        completed: false,
        category: it.category
      });
    });
  };

  const completedCount = groceryList.filter(i => i.completed).length;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid rgba(57,63,75,.08)", borderRadius: 8, padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#393F4B", textTransform: "uppercase", letterSpacing: ".08em" }}>
            <i className="fa-solid fa-cart-shopping" style={{ marginRight: 6, color: "#910029" }}></i>
            Grocery List
          </span>
          <span style={{ fontSize: 12, color: "#7A8494", marginLeft: 8 }}>{completedCount}/{groceryList.length} purchased</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={generateFromMeals} className="task-tool-btn" style={{ height: 38, fontSize: 12 }}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> From Meals
          </button>
          {groceryList.length > 0 && (
            <button onClick={onClearPurchased} className="task-tool-btn" style={{ height: 38, fontSize: 12 }}>
              Clear Purchased
            </button>
          )}
        </div>
      </div>

      <div className="task-manager-toolbar" style={{ marginBottom: 12 }}>
        <div className="task-manager-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input type="search" placeholder="Search groceries..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="remaining">Remaining</option>
          <option value="purchased">Purchased</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Add grocery item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          style={{ flex: "1 1 180px", height: 40, padding: "0 12px", background: "#FFFFFF", border: "1px solid rgba(57,63,75,.14)", borderRadius: 8, color: "#393F4B", fontSize: 14, fontFamily: "inherit" }}
        />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ height: 40, background: "#FFFFFF", border: "1px solid rgba(57,63,75,.14)", borderRadius: 8, color: "#5D6E7F", fontSize: 13, padding: "0 8px" }}>
          {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={handleAdd} className="small-primary" style={{ height: 40 }}>
          <i className="fa-solid fa-plus"></i> Add
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="empty-state">
          <i className="fa-regular fa-folder-open"></i>
          <strong>No groceries yet</strong>
          <span>Add items from meals or manually.</span>
        </div>
      )}

      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7486", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
            {category}
          </div>
          {categoryItems.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(57,63,75,.05)" }}>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onToggle(item.id)}
                style={{ accentColor: "#910029" }}
              />
              <span style={{ flex: 1, fontSize: 13, color: item.completed ? "#7A8494" : "#393F4B", textDecoration: item.completed ? "line-through" : "none" }}>
                {escapeHtml(item.name)}
              </span>
              {item.quantity ? (
                <span style={{ fontSize: 12, color: "#7A8494" }}>{escapeHtml(item.quantity)}{item.unit ? " " + escapeHtml(item.unit) : ""}</span>
              ) : (
                <span style={{ fontSize: 12, color: "#8A94A5" }}>—</span>
              )}
              <button onClick={() => editItem(item)} className="task-action-btn" title="Edit quantity">
                <i className="fa-solid fa-pen" style={{ fontSize: 12 }}></i>
              </button>
              <button onClick={() => onDelete(item.id)} className="task-action-btn" title="Remove">
                <i className="fa-solid fa-xmark" style={{ fontSize: 13 }}></i>
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
