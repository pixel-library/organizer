import { JSDOM } from "jsdom";
import { createRequire } from "module";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.MutationObserver = window.MutationObserver;
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.localStorage = window.localStorage;

window.matchMedia = () => ({
  matches: false,
  media: "",
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {}
});
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.ResizeObserver = window.ResizeObserver;
}
globalThis.matchMedia = window.matchMedia;

let failures = 0;
const assert = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failures++;
};

const React = require("react");
const { createRoot } = require("react-dom/client");

const server = await createServer({
  root: new URL("..", import.meta.url).pathname,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});
const load = (p) => server.ssrLoadModule(p);

const { default: App } = await load("/src/App.jsx");

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);
root.render(React.createElement(App));
await sleep(150);

const bodyText = () => document.body.textContent || "";

/* ---- FRESH INSTALL EMPTY STATES ---- */
assert("Dashboard welcome empty state renders", bodyText().includes("Welcome to Organizer"));

const clickNav = (id) => {
  const el = document.getElementById(id);
  if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
};

const cases = [
  ["nav-tasks", "No tasks found"],
  ["nav-calendar", "No events scheduled"],
  ["nav-habits", "No habits yet"],
  ["nav-notes", "No notes yet"],
  ["nav-analytics", "No productivity data yet"],
  ["nav-goals", "No goals yet"],
  ["nav-reminders", "No reminders yet"]
];
for (const [id, text] of cases) {
  clickNav(id);
  await sleep(60);
  assert(`${id} empty state`, bodyText().includes(text));
}

clickNav("nav-meals");
await sleep(60);
assert("Meals renders without fake data", !bodyText().includes("Oatmeal & Berries"));

clickNav("nav-dashboard");
await sleep(60);

const leaked = ["Morning Code Review", "Client Sync Meeting", "Gym Session", "Workspace Initialized", "Oatmeal & Berries"];
const leakedFound = leaked.filter(t => bodyText().includes(t));
assert("No fake/sample content in DOM", leakedFound.length === 0, "found: " + leakedFound.join(", "));

const keys = Object.keys(globalThis.localStorage).filter(k => k.startsWith("life_planner_"));
assert("settings key exists (theme persistence)", keys.includes("life_planner_settings"));
let allEmpty = true;
for (const k of keys.filter(k => k !== "life_planner_settings")) {
  const v = JSON.parse(globalThis.localStorage.getItem(k));
  if (!Array.isArray(v) || v.length !== 0) { allEmpty = false; console.log("  non-empty key:", k); }
}
assert("No fake data persisted on fresh install (data keys empty arrays)", allEmpty);

/* ---- DATA LAYER ---- */
const hookModule = await server.ssrLoadModule("/src/hooks/useLifePlanner.js");
const { useLifePlanner } = hookModule;

const exposed = {};
function Harness() {
  Object.assign(exposed, useLifePlanner());
  return React.createElement("div");
}
const harnessRoot = createRoot(document.createElement("div"));
harnessRoot.render(React.createElement(Harness));
await sleep(50);

const h = exposed;

assert("Initial tasks empty", Array.isArray(h.tasks) && h.tasks.length === 0);
assert("Initial events empty", h.calendarEvents.length === 0);
assert("Initial habits empty", h.habits.length === 0);
assert("Initial reminders empty", h.customReminders.length === 0);

/* create + complete + delete + undo */
h.addOrUpdateTask({ name: "Buy groceries", date: "2026-08-14", priority: "Yellow", reminder: "none", type: "Personal" });
await sleep(30);
assert("Task created", h.tasks.length === 1 && h.tasks[0].name === "Buy groceries");
assert("Task persisted to localStorage", JSON.parse(globalThis.localStorage.getItem("life_planner_tasks")).length === 1);

const taskId = h.tasks[0].id;
h.toggleTaskCompletion(taskId);
await sleep(30);
assert("Task completed", h.tasks.find(t => t.id === taskId).completed === true);

h.deleteTask(taskId);
await sleep(30);
assert("Task deleted", h.tasks.length === 0);
assert("Undo available after delete", h.undoState !== null);

h.undoLastDeletion();
await sleep(30);
assert("Undo restores task", h.tasks.length === 1 && h.tasks[0].name === "Buy groceries");

/* habits */
h.addHabit("Read 10 pages");
await sleep(30);
assert("Habit created", h.habits.length === 1);
h.toggleHabitDay(0, 0);
await sleep(30);
assert("Habit toggle records history", Array.isArray(h.habits[0].history) && h.habits[0].history.length >= 1);

/* custom reminders */
h.addCustomReminder({ title: "Water plants", date: "2026-08-15", time: "08:00", type: "Custom" });
await sleep(30);
assert("Custom reminder created", h.customReminders.length === 1);
h.deleteCustomReminder(h.customReminders[0].id);
await sleep(30);
assert("Custom reminder deleted", h.customReminders.length === 0);

/* import / export */
const json = JSON.parse(h.exportData());
assert("Export wraps under data", json.data && Array.isArray(json.data.tasks));
assert("Export includes task", json.data.tasks.some(t => t.name === "Buy groceries"));
assert("Export includes habit", json.data.habits.length === 1);
assert("Export includes settings", json.data.settings && json.data.settings.theme);

assert("Import rejects invalid JSON", h.importData("{not json").ok === false);
assert("Import rejects wrong shape", h.importData(JSON.stringify({ tasks: "not-an-array" })).ok === false);

const backup = {
  tasks: [h.tasks[0], { id: "new-task-1", name: "New merged task", date: "2026-08-16", priority: "Green", reminder: "none", type: "Work" }],
  history: [], goals: [], notes: [], habits: [], meals: [], calendarEvents: [], groceryList: [], customReminders: []
};
const merged = h.mergeData(backup);
assert("Merge adds only the new record", merged.tasks === 1);
await sleep(30);
assert("Merge preserves existing + adds new (2 total)", h.tasks.length === 2);
assert("Merged task present", h.tasks.some(t => t.name === "New merged task"));

const clean = { tasks: [], history: [], goals: [], notes: [], habits: [], meals: [], calendarEvents: [], groceryList: [], customReminders: [] };
h.replaceAllData(clean);
await sleep(30);
assert("Replace all clears tasks", h.tasks.length === 0 && h.habits.length === 0);

/* theme */
h.setSettings({ theme: "light" });
await sleep(30);
assert("setSettings persists theme", h.settings.theme === "light");

/* pure helpers */
const { dateKeyFrom, habitCompletionDates, computeHabitStats } = hookModule;
const d0 = dateKeyFrom(new Date());
const mk = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return dateKeyFrom(x); };
assert("dateKeyFrom format", /^\d{4}-\d{2}-\d{2}$/.test(d0));
assert("streak math (3 consecutive days)", computeHabitStats({ days: [], history: [mk(0), mk(-1), mk(-2), mk(-5)] }).currentStreak === 3);
assert("empty habit stats", computeHabitStats({ days: [false, false, false, false, false, false, false], history: [] }).completionRate === 0);
const dates = [...habitCompletionDates({ days: [true, false, false, false, false, false, false], history: [mk(0)] })];
assert("habitCompletionDates unique", new Set(dates).size === dates.length);
assert("habitCompletionDates includes today", dates.includes(d0));

/* ---- DOM STRUCTURE VALIDATION ----
   Walks the rendered DOM and enforces the HTML content model for every
   parent/child pair. React creates elements programmatically, so invalid
   nesting (e.g. a div inside tbody) appears literally in the DOM instead of
   being repaired by the HTML parser — this catches it. */
const PHRASING = new Set(["A","ABBR","B","BDI","BDO","BR","CITE","CODE","DATA","DFN","EM","I","KBD","MARK","METER","Q","RP","RT","RUBY","S","SAMP","SMALL","SPAN","STRONG","SUB","SUP","TIME","U","VAR","WBR","IMG","PICTURE","CANVAS","MAP","OBJECT","OUTPUT","PROGRESS","SVG","MATH","LABEL","INPUT","SELECT","TEXTAREA","BUTTON"]);
const INTERACTIVE = new Set(["BUTTON","A","INPUT","SELECT","TEXTAREA","LABEL","IFRAME","OBJECT","EMBED","VIDEO","AUDIO"]);
const invalidChild = (pn, cn) => {
  if (pn === "TABLE") return !["CAPTION","COLGROUP","THEAD","TBODY","TFOOT","TR"].includes(cn);
  if (["THEAD","TBODY","TFOOT"].includes(pn)) return cn !== "TR";
  if (pn === "TR") return !["TD","TH"].includes(cn);
  if (pn === "SELECT") return !["OPTION","OPTGROUP"].includes(cn);
  if (pn === "UL" || pn === "OL") return cn !== "LI";
  if (pn === "DL") return !["DT","DD"].includes(cn);
  if (pn === "P") return !PHRASING.has(cn);
  if (pn === "A" || pn === "BUTTON") return INTERACTIVE.has(cn);
  if (pn === "LABEL") return cn === "LABEL";
  return false;
};
const collectStructure = (root) => {
  const errors = [];
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    for (const child of node.children) {
      if (invalidChild(node.nodeName, child.nodeName)) {
        errors.push(`${node.nodeName} > ${child.nodeName} (${child.className || child.id || "no-class"})`);
      }
      walk(child);
    }
  };
  walk(root);
  return errors;
};
const checkStructure = (name, root = document.body) => {
  const errors = collectStructure(root);
  assert(`DOM structure valid (${name})`, errors.length === 0, errors.slice(0, 8).join(" | "));
};
const clickEl = (el) => { if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const noop = () => {};
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* open/close every modal through the real UI and validate the result */
const openAndCheck = async (view, label) => {
  clickNav(`nav-${view}`);
  await sleep(60);
  clickEl(document.querySelector(".header-create"));
  await sleep(60);
  checkStructure(`app: ${label} open`);
  clickEl(document.querySelector(".modal-overlay"));
  await sleep(30);
};

checkStructure("app: dashboard");
await openAndCheck("tasks", "TaskModal");
await openAndCheck("calendar", "EventEditor");
await openAndCheck("notes", "NoteEditor");
await openAndCheck("meals", "MealEditor");
await openAndCheck("analytics", "ImportExportModal");

clickNav("nav-goals");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await sleep(60);
checkStructure("app: goals form");
clickNav("nav-reminders");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await sleep(60);
checkStructure("app: reminders form");

clickEl(document.querySelector('[aria-label="Command palette"]'));
await sleep(60);
checkStructure("app: command palette");
clickEl(document.querySelector(".cmd-overlay"));
await sleep(30);

clickEl(document.querySelector('[aria-label="Search"]'));
await sleep(60);
checkStructure("app: search modal");
clickEl(document.querySelector(".cmd-overlay"));
await sleep(30);

clickEl(document.querySelector(".quick-add-trigger"));
await sleep(60);
checkStructure("app: quick-add menu");
clickEl(document.querySelector(".quick-add-trigger"));
await sleep(30);

clickNav("nav-calendar");
await sleep(60);
for (const mode of ["Day", "Week", "Month", "Year", "Agenda"]) {
  const btn = [...document.querySelectorAll(".calendar-view-switcher button")].find(b => (b.textContent || "").trim().toLowerCase() === mode.toLowerCase());
  clickEl(btn);
  await sleep(60);
  checkStructure(`app: calendar ${mode} view (empty)`);
}

/* render populated components in isolation to exercise row/cell markup */
const mountScratch = async (name, el) => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(el);
  await sleep(40);
  checkStructure(name, div);
  return div;
};

const loadC = (p) => load(p).then(m => m.default);

await mountScratch("History (rows)", React.createElement(await loadC("/src/components/History.jsx"), {
  history: [
    { id: "h1", status: "Task Created", name: "Alpha", timestamp: "2026-08-14 10:00" },
    { id: "h2", status: "Task Completed", name: "Beta", timestamp: "2026-08-14 11:00" }
  ],
  onRemoveItem: noop, onClear: noop, escapeHtml: esc
}));

await mountScratch("Habits (rows)", React.createElement(await loadC("/src/components/Habits.jsx"), {
  habits: [{ id: "hab1", name: "Read 10 pages", days: [true, false, true, false, false, true, false], history: [] }],
  onToggleDay: noop, onAddHabit: noop, onDeleteHabit: noop, escapeHtml: esc
}));

const tasksMount = await mountScratch("Tasks (list rows)", React.createElement(await loadC("/src/components/Tasks.jsx"), {
  tasks: [{
    id: "t1", name: "Plan launch", date: "2026-08-14", time: "10:00", priority: "Red",
    reminder: "10min", type: "Meeting", description: "Prep slides", tags: ["work", "urgent"],
    subtasks: [{ id: "s1", name: "Draft", completed: true }, { id: "s2", name: "Review", completed: false }]
  }],
  isTaskOverdue: () => false,
  onToggleTask: noop, onDeleteTask: noop, onEditTask: noop, onOpenCreate: noop,
  onBulkComplete: noop, onBulkDelete: noop, onSelectTask: noop, onUpdateTask: noop,
  escapeHtml: esc, priorityClass: (p) => String(p || "").toLowerCase(),
  priorityLabel: (p) => p, reminderLabel: (r) => r, formatDateKey: () => "2026-08-14"
}));
const boardBtns = tasksMount.querySelectorAll(".task-view-switcher button");
if (boardBtns[1]) { clickEl(boardBtns[1]); await sleep(60); }
checkStructure("Tasks (board rows)", tasksMount);

await mountScratch("Meals (table rows)", React.createElement(await loadC("/src/components/Meals.jsx"), {
  meals: [
    { id: "m1", day: "Monday", date: "2026-08-14", type: "Breakfast", name: "Oatmeal", time: "08:00", calories: 300, status: "completed" },
    { id: "m2", day: "Monday", date: "2026-08-14", type: "Lunch", name: "Salad", time: "13:00", calories: 450, status: "planned" }
  ],
  groceryList: [],
  onEditMeal: noop, onDeleteMeal: noop, onSetMealStatus: noop,
  onAddGrocery: noop, onUpdateGrocery: noop, onDeleteGrocery: noop,
  onToggleGrocery: noop, onClearPurchased: noop, onOpenMeal: noop,
  escapeHtml: esc, formatDateKey: fmt
}));

await mountScratch("GroceryList (rows)", React.createElement(await loadC("/src/components/GroceryList.jsx"), {
  groceryList: [
    { id: "g1", name: "Chicken", quantity: "2", unit: "x", completed: false, category: "Proteins" },
    { id: "g2", name: "Apples", quantity: "", unit: "", completed: true, category: "Fruits" }
  ],
  meals: [],
  onAdd: noop, onUpdate: noop, onDelete: noop, onToggle: noop, onClearPurchased: noop, escapeHtml: esc
}));

await mountScratch("Notes (cards)", React.createElement(await loadC("/src/components/Notes.jsx"), {
  notes: [
    { id: "n1", title: "Idea", content: "Ship v2", category: "Ideas", tags: ["feature"], pinned: true, archived: false, createdAt: "2026-08-14", updatedAt: "2026-08-14" },
    { id: "n2", title: "Old", content: "Notes", category: "Work", tags: [], pinned: false, archived: true, createdAt: "2026-08-01", updatedAt: "2026-08-02" }
  ],
  onDeleteNote: noop, onToggleArchive: noop, onRestore: noop, onTogglePin: noop,
  onEditNote: noop, onOpenNote: noop, onScheduleNote: noop, escapeHtml: esc
}));

await mountScratch("Goals (cards)", React.createElement(await loadC("/src/components/Goals.jsx"), {
  goals: [
    { id: "go1", name: "Read 12 books", target: 12, current: 7, unit: "books" },
    { id: "go2", name: "Run 100 km", target: 100, current: 100, unit: "km" }
  ],
  onAddGoal: noop, onUpdateGoal: noop, onDeleteGoal: noop, escapeHtml: esc
}));

await mountScratch("Reminders (rows)", React.createElement(await loadC("/src/components/Reminders.jsx"), {
  tasks: [{ id: "t1", name: "Standup", date: "2026-08-15", time: "09:00", reminder: "10min", completed: false }],
  calendarEvents: [],
  customReminders: [{ id: "c1", title: "Water plants", date: "2026-08-16", time: "08:00", type: "Custom", completed: false }],
  onAddCustom: noop, onDeleteCustom: noop, onToggleCustom: noop,
  onOpenEvent: noop, onOpenTaskModal: noop, escapeHtml: esc
}));

await mountScratch("Analytics (data)", React.createElement(await loadC("/src/components/Analytics.jsx"), {
  tasks: [{ id: "t1", name: "T", date: "2026-08-14", completed: true, priority: "Red", type: "Task", time: "10:00" }],
  habits: [{ id: "h1", name: "H", days: [], history: ["2026-08-14"] }],
  calendarEvents: [],
  isTaskOverdue: () => false,
  formatDateKey: fmt, onSwitchView: noop
}));

await mountScratch("TaskModal", React.createElement(await loadC("/src/components/TaskModal.jsx"), {
  editingTask: { id: "t1", name: "T", date: "2026-08-14", time: "10:00", priority: "Red", reminder: "exact", type: "Task" },
  onSave: noop, onClose: noop
}));

await mountScratch("EventEditor", React.createElement(await loadC("/src/components/EventEditor.jsx"), {
  event: { id: "e1", title: "E", start: "2026-08-14", end: "2026-08-14", startTime: "09:00", endTime: "10:00" },
  onSave: noop, onClose: noop
}));

await mountScratch("MealEditor", React.createElement(await loadC("/src/components/MealEditor.jsx"), {
  meal: { id: "m1", name: "M" }, onSave: noop, onClose: noop
}));

await mountScratch("NoteEditor", React.createElement(await loadC("/src/components/NoteEditor.jsx"), {
  note: { id: "n1", title: "N", content: "c", category: "Work" }, onSave: noop, onClose: noop
}));

await mountScratch("ReminderModal", React.createElement(await loadC("/src/components/ReminderModal.jsx"), {
  text: "Test reminder", onDismiss: noop
}));

await mountScratch("UndoToast", React.createElement(await loadC("/src/components/UndoToast.jsx"), {
  undoState: { label: "Task deleted" }, onUndo: noop
}));

await mountScratch("ImportExportModal", React.createElement(await loadC("/src/components/ImportExportModal.jsx"), {
  open: true, onClose: noop, exportData: () => "{}",
  importData: () => ({ ok: false, errors: ["x"] }),
  replaceAllData: noop, mergeData: () => ({})
}));

await mountScratch("CommandPalette", React.createElement(await loadC("/src/components/CommandPalette.jsx"), {
  open: true, onClose: noop, onOpenView: noop, onCreateTask: noop, onCreateEvent: noop,
  onCreateNote: noop, onCreateHabit: noop, onGoToday: noop, onOpenSearch: noop,
  onExport: noop, onImport: noop
}));

await mountScratch("SearchModal", React.createElement(await loadC("/src/components/SearchModal.jsx"), {
  open: true, onClose: noop, tasks: [], calendarEvents: [], notes: [], habits: [], meals: [], history: [],
  onOpenView: noop, onEditEvent: noop, onEditNote: noop, onEditTask: noop, escapeHtml: esc
}));

const quickDiv = await mountScratch("QuickAdd (closed)", React.createElement(await loadC("/src/components/QuickAdd.jsx"), {
  onAddTask: noop, onAddEvent: noop, onAddHabit: noop, onAddNote: noop, onAddReminder: noop, onAddMeal: noop
}));
clickEl(quickDiv.querySelector(".quick-add-trigger"));
await sleep(60);
checkStructure("QuickAdd (open menu)", quickDiv);

const calDiv = await mountScratch("CalendarView (month, data)", React.createElement(await loadC("/src/components/CalendarView.jsx"), {
  tasks: [{ id: "t1", name: "Task A", date: "2026-08-14", time: "09:00", type: "Task", priority: "Red", completed: false, reminder: "none" }],
  calendarEvents: [{ id: "e1", title: "Event B", start: "2026-08-14", end: "2026-08-14", startTime: "10:00", endTime: "11:00", allDay: false, category: "Work", color: "#ef4444", reminder: "none" }],
  meals: [], habits: [],
  onOpenCreateForDate: noop, onOpenEvent: noop, onEditEvent: noop, onEditOccurrence: noop,
  onDeleteEvent: noop, onDeleteOccurrence: noop, onMoveEvent: noop,
  onToggleTask: noop, onDeleteTask: noop, onEditMeal: noop, onDeleteMeal: noop,
  onToggleHabit: noop, onSelectTask: noop, selectedTaskId: null,
  escapeHtml: esc, priorityClass: (p) => String(p || "").toLowerCase(),
  priorityLabel: (p) => p, reminderLabel: (r) => r, formatDateKey: fmt
}));
for (const mode of ["Day", "Week", "Year", "Agenda"]) {
  const btn = [...calDiv.querySelectorAll(".calendar-view-switcher button")].find(b => (b.textContent || "").trim() === mode);
  clickEl(btn);
  await sleep(60);
  checkStructure(`CalendarView (${mode}, data)`, calDiv);
}

checkStructure("app: full render");

await server.close();
console.log(failures === 0 ? "\nALL FUNCTIONAL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
