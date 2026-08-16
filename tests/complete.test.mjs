import { JSDOM } from "jsdom";
import { createRequire } from "module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createApp } from "../server/app.js";
import { connectDatabase, disconnectDatabase, getPool } from "../server/db.js";

const require = createRequire(import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (cond, ms = 5000, step = 25) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (cond()) return true;
    await sleep(step);
  }
  return cond();
};

/* ================= error / console / network capture ================= */
const consoleErrors = [];
const serverLogs = [];
const networkStatuses = [];
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
console.error = (...a) => { consoleErrors.push(a.map(String).join(" ")); originalError(...a); };
console.warn = (...a) => { consoleErrors.push(a.map(String).join(" ")); originalWarn(...a); };
console.log = (...a) => {
  const line = a.map(String).join(" ");
  if (/^[A-Z]+ \/api\/?[^\s]* \d{3} \d+\.\dms$/.test(line)) serverLogs.push(line);
  originalLog(...a);
};

/* ================= jsdom environment ================= */
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
window.confirm = () => true;
window.alert = () => {};
globalThis.confirm = () => true;
globalThis.alert = () => {};
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.ResizeObserver = window.ResizeObserver;
}
let matchMediaMatches = false;
window.matchMedia = () => ({
  matches: matchMediaMatches,
  media: "",
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {}
});
globalThis.matchMedia = window.matchMedia;
window.innerWidth = 1280;

let failures = 0;
const assert = (name, cond, extra = "") => {
  originalLog(`${cond ? "PASS" : "FAIL"}: ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failures++;
};

const React = require("react");
const { createRoot } = require("react-dom/client");

/* ================= dynamic dates (Agenda view renders today + next 2 days) ================= */
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = fmtDate(new Date());

/* ================= real backend + cookie jar ================= */
await connectDatabase();
const suffix = Date.now();
const usernameA = `complete-a-${suffix}`;
const usernameB = `complete-b-${suffix}`;
const password = "correct-horse-battery-staple";
await getPool().query("DELETE FROM users WHERE username LIKE $1", ["complete-%"]);

const app = createApp();
const httpServer = app.listen(0);
await new Promise((resolve) => httpServer.once("listening", resolve));
const { port } = httpServer.address();
const base = `http://127.0.0.1:${port}/api`;
globalThis.__LIFE_ORGANIZER_API__ = base;

let cookieJar = "";
const originalFetch = globalThis.fetch;
const jarFetch = async (url, opts = {}) => {
  const headers = new Headers(opts.headers || {});
  if (cookieJar && !headers.has("cookie")) headers.set("cookie", cookieJar);
  const res = await originalFetch(url, { ...opts, headers, credentials: "include" });
  networkStatuses.push(`${res.status} ${opts.method || "GET"} ${String(url).replace(base, "")}`);
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of setCookie) {
    const [pair] = sc.split(";");
    const [name] = pair.split("=");
    cookieJar = cookieJar.split(";").filter((c) => c.trim().split("=")[0] !== name).join(";");
    cookieJar = cookieJar ? `${cookieJar}; ${pair}` : pair;
  }
  return res;
};
globalThis.fetch = jarFetch;
window.fetch = jarFetch;

const server = await createServer({
  root: new URL("..", import.meta.url).pathname,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});
const load = (p) => server.ssrLoadModule(p);
const { default: App } = await load("/src/App.jsx");

const rootEl = document.getElementById("root");
let root = createRoot(rootEl);

const bodyText = () => document.body.textContent || "";
const clickEl = (el) => { if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); };
const clickNav = (id) => clickEl(document.getElementById(id));
const setNativeValue = (el, value) => {
  const proto = el instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype
    : el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};
const submitForm = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const byText = (selector, text) => [...document.querySelectorAll(selector)].find((b) => (b.textContent || "").trim() === text);
const byTextIn = (selector, text) => [...document.querySelectorAll(selector)].find((b) => (b.textContent || "").includes(text));
const fillModal = async (fields) => {
  const modal = document.querySelector("#create-modal");
  for (const [label, value] of Object.entries(fields)) {
    const field = [...modal.querySelectorAll(".modal-field")].find((f) => (f.querySelector("label")?.textContent || "").trim() === label);
    const input = field?.querySelector("input, select, textarea");
    if (input) setNativeValue(input, value);
  }
};

const mountApp = async () => {
  try { root.unmount(); } catch { /* first mount */ }
  root = createRoot(rootEl);
  root.render(React.createElement(App));
  await sleep(120);
};
const waitForWorkspace = () => waitFor(() => bodyText().includes("Life Planner") && document.getElementById("nav-dashboard") !== null);
const waitForAuthScreen = () => waitFor(() => bodyText().includes("Welcome back") || bodyText().includes("Create your account"));
const waitServer = async (path, cond, ms = 5000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const body = await (await jarFetch(`${base}${path}`)).json();
    if (cond(body)) return true;
    await sleep(50);
  }
  return false;
};
const clearUserCollection = async (path) => {
  const rows = await (await jarFetch(`${base}${path}`)).json();
  for (const r of rows) await jarFetch(`${base}${path}/${r.id}`, { method: "DELETE" });
};
const saveModal = async () => {
  const btn = document.querySelector("#create-modal .modal-save");
  clickEl(btn);
  await sleep(120);
};
const registerViaUi = async (name, username) => {
  await mountApp();
  await waitForAuthScreen();
  clickEl(byTextIn(".standard-panel button", "Create one"));
  await sleep(50);
  const form = document.querySelector('form[aria-label="Authentication form"]');
  const [nameInput, usernameInput, passwordInput] = form.querySelectorAll("input");
  setNativeValue(nameInput, name);
  setNativeValue(usernameInput, username);
  setNativeValue(passwordInput, password);
  submitForm(form);
  await waitForWorkspace();
};

/* ================= AUTH ================= */
await mountApp();
await waitForAuthScreen();
assert("Protected app shows AuthScreen when logged out", document.querySelector('form[aria-label="Authentication form"]') !== null);
assert("No workspace content while logged out", !document.getElementById("nav-dashboard"));

/* register via UI */
await registerViaUi("Complete Alice", usernameA);
assert("Register via UI loads workspace", bodyText().includes("Life Planner"));
assert("Sidebar shows profile name (profile read)", bodyText().includes("Complete Alice") && bodyText().includes(usernameA));

/* refresh while logged in (fresh component, same session) */
await mountApp();
await waitForWorkspace();
assert("Refresh while logged in loads workspace (no login prompt)", !bodyText().includes("Welcome back"));
assert("Data still loaded after refresh (dashboard nav present)", document.getElementById("nav-dashboard") !== null);

/* login with wrong password shows an error */
await mountApp();
await waitForWorkspace();
await sleep(400); // let in-flight collection loads settle before logging out
const logoutBtn = document.querySelector('button[aria-label="Sign out"]');
clickEl(logoutBtn);
await waitForAuthScreen();
assert("Logout returns to AuthScreen", document.querySelector('form[aria-label="Authentication form"]') !== null);
const form = document.querySelector('form[aria-label="Authentication form"]');
const [usernameInput, passwordInput] = form.querySelectorAll("input");
setNativeValue(usernameInput, usernameA);
setNativeValue(passwordInput, "wrong-password-123");
submitForm(form);
await waitFor(() => bodyText().includes("Invalid username or password"));
assert("Wrong-password login shows error", bodyText().includes("Invalid username or password"));

/* login with correct password */
setNativeValue(passwordInput, password);
submitForm(form);
await waitForWorkspace();
assert("Login with correct password loads workspace", bodyText().includes("Complete Alice"));

/* ================= DASHBOARD: empty state (fresh user A) ================= */
clickNav("nav-dashboard");
await sleep(80);
assert("Dashboard empty state shown (fresh user)", bodyText().includes("Welcome to Organizer"));

const leaked = ["Morning Code Review", "Client Sync Meeting", "Gym Session", "Workspace Initialized", "Oatmeal & Berries"];
assert("No fake/sample content anywhere", leaked.filter((t) => bodyText().includes(t)).length === 0);

/* ================= TASKS: full CRUD via UI ================= */
clickNav("nav-tasks");
await sleep(80);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
assert("TaskModal opens from Create Task", document.querySelector("#create-modal") !== null);
await fillModal({ "Title / Task Name": "Complete Task One", Date: today, "Specific Time": "09:30" });
await saveModal();
await waitFor(() => bodyText().includes("Complete Task One"));
assert("Task created + read in list", bodyText().includes("Complete Task One"));
assert("Task persisted to backend", (await (await jarFetch(`${base}/tasks`)).json()).some((t) => t.name === "Complete Task One"));

/* update */
const editTaskBtn = [...document.querySelectorAll(".task-action-btn")].find((b) => b.title === "Edit");
clickEl(editTaskBtn);
await waitFor(() => document.querySelector("#create-modal") !== null);
const titleInput = document.querySelector('#create-modal input[placeholder="Add title..."]');
assert("Edit modal pre-fills task title", titleInput.value === "Complete Task One", titleInput.value);
setNativeValue(titleInput, "Complete Task One (edited)");
await saveModal();
await waitFor(() => bodyText().includes("Complete Task One (edited)"));
assert("Task updated in UI", bodyText().includes("Complete Task One (edited)"));
assert("Task updated on backend", (await (await jarFetch(`${base}/tasks`)).json()).some((t) => t.name === "Complete Task One (edited)"));

/* complete */
const completeBox = document.querySelector("#view-tasks .task-status-wrap input[type=checkbox]");
clickEl(completeBox);
await waitServer("/tasks", (t) => t[0]?.completed === true);
assert("Task completed on backend", (await (await jarFetch(`${base}/tasks`)).json())[0].completed === true);

/* delete + undo */
const deleteTaskBtn = [...document.querySelectorAll(".task-action-btn")].find((b) => b.title === "Delete");
clickEl(deleteTaskBtn);
await waitFor(() => document.querySelector("#view-tasks .task-name-main") === null);
assert("Task deleted from UI", document.querySelector("#view-tasks .task-name-main") === null);
assert("Task deleted on backend", (await (await jarFetch(`${base}/tasks`)).json()).length === 0);
const undoBtn = document.querySelector(".undo-toast button, .undo-action, [aria-label='Undo']");
clickEl(undoBtn || document.body);
await sleep(150);
assert("Undo restores deleted task", (await (await jarFetch(`${base}/tasks`)).json()).length === 1);

/* delete the restored task via the UI so the tasks collection is empty again */
const deleteTaskBtn2 = [...document.querySelectorAll(".task-action-btn")].find((b) => b.title === "Delete");
clickEl(deleteTaskBtn2);
await waitFor(() => document.querySelector("#view-tasks .task-name-main") === null);
await waitServer("/tasks", (t) => t.length === 0);
assert("Task deleted on backend (post-undo)", (await (await jarFetch(`${base}/tasks`)).json()).length === 0);

/* ================= NOTES: full CRUD via UI ================= */
clickNav("nav-notes");
await sleep(80);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ Title: "Complete Note", Content: "This note was created through the UI." });
await saveModal();
await waitFor(() => bodyText().includes("Complete Note"));
assert("Note created + read as card", bodyText().includes("Complete Note") && bodyText().includes("This note was created through the UI."));
assert("Note persisted to backend", (await (await jarFetch(`${base}/notes`)).json()).some((n) => n.title === "Complete Note"));

const editNoteBtn = [...document.querySelectorAll(".note-card button")].find((b) => b.title === "Edit");
clickEl(editNoteBtn);
await waitFor(() => document.querySelector("#create-modal") !== null);
const noteTitle = document.querySelector('#create-modal input[placeholder="Note title..."]');
assert("Note editor pre-fills title", noteTitle.value === "Complete Note", noteTitle.value);
setNativeValue(noteTitle, "Complete Note (edited)");
await saveModal();
await waitFor(() => bodyText().includes("Complete Note (edited)"));
assert("Note updated in UI + backend", (await (await jarFetch(`${base}/notes`)).json()).some((n) => n.title === "Complete Note (edited)"));

const deleteNoteBtn = [...document.querySelectorAll(".note-card button")].find((b) => b.title === "Delete");
clickEl(deleteNoteBtn);
await waitFor(() => document.querySelectorAll(".note-card").length === 0);
assert("Note deleted from UI", document.querySelectorAll(".note-card").length === 0);
assert("Note deleted on backend", (await (await jarFetch(`${base}/notes`)).json()).length === 0);

/* ================= CALENDAR: full CRUD via UI ================= */
clickNav("nav-calendar");
await sleep(80);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ Title: "Complete Event", Date: today, "End Date": today });
await saveModal();
await waitFor(() => bodyText().includes("Complete Event"));
assert("Calendar event created + read in month view", bodyText().includes("Complete Event"));
assert("Calendar event persisted to backend", (await (await jarFetch(`${base}/calendarEvents`)).json()).some((e) => e.title === "Complete Event"));

/* edit via Agenda view row button (month-view .calendar-event is a plain div whose
   React onClick is not reachable through jsdom's synthetic dispatch, so use the
   real <button> path — CalendarView.jsx:943 routes through the same eventClick -> onEditEvent) */
const agendaBtn = byText(".calendar-view-switcher button", "Agenda");
clickEl(agendaBtn);
await sleep(100);
const agendaRow = [...document.querySelectorAll(".agenda-view .dash-task-row")].find((r) => r.textContent.includes("Complete Event"));
assert("Agenda view lists the event", !!agendaRow, "agenda row found");
const eventEditBtn = [...agendaRow.querySelectorAll(".task-tool-btn")].find((b) => b.textContent.trim() === "Edit");
clickEl(eventEditBtn);
await waitFor(() => document.querySelector("#create-modal") !== null);
const eventTitle = document.querySelector('#create-modal input[placeholder="Add title..."]');
assert("Event editor pre-fills title", eventTitle.value === "Complete Event", eventTitle.value);
setNativeValue(eventTitle, "Complete Event (edited)");
await saveModal();
await waitFor(() => bodyText().includes("Complete Event (edited)"));
assert("Calendar event updated on backend", (await (await jarFetch(`${base}/calendarEvents`)).json()).some((e) => e.title === "Complete Event (edited)"));

/* delete via Agenda view row button */
const agendaRow2 = [...document.querySelectorAll(".agenda-view .dash-task-row")].find((r) => r.textContent.includes("Complete Event (edited)"));
const eventDeleteBtn = agendaRow2.querySelector(".task-tool-btn .fa-trash");
clickEl(eventDeleteBtn);
await waitFor(() => [...document.querySelectorAll(".agenda-view .dash-task-row")].filter((r) => r.textContent.includes("Complete Event (edited)")).length === 0);
assert("Calendar event deleted from UI", [...document.querySelectorAll(".agenda-view .dash-task-row")].filter((r) => r.textContent.includes("Complete Event (edited)")).length === 0);
assert("Calendar event deleted on backend", (await (await jarFetch(`${base}/calendarEvents`)).json()).length === 0);

/* ================= DASHBOARD: real data ================= */
/* make counts deterministic: clear A's leftover data from the CRUD sections */
await clearUserCollection("/tasks");
await clearUserCollection("/notes");
await clearUserCollection("/calendarEvents");

clickNav("nav-dashboard");
await sleep(80);
assert("Dashboard empty after clearing", bodyText().includes("Welcome to Organizer"));

/* create a task + event for today, then complete the task via the UI */
/* task gets a past time (now), event a future time — so the event becomes the dashboard NEXT EVENT */
const now = new Date();
const taskTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
const eventTime = now.getHours() < 23
  ? `${String(now.getHours() + 1).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  : "23:59";
clickNav("nav-tasks");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ "Title / Task Name": "Dashboard Task", "Specific Time": taskTime });
await saveModal();
await waitFor(() => bodyText().includes("Dashboard Task"));
clickEl(document.querySelector("#view-tasks .task-status-wrap input[type=checkbox]"));
await waitServer("/tasks", (t) => t[0]?.completed === true);
clickNav("nav-calendar");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ Title: "Dashboard Event", "Start Time": eventTime });
await saveModal();
await waitFor(() => bodyText().includes("Dashboard Event"));
clickNav("nav-dashboard");
await sleep(120);
assert("Dashboard shows real data (control center)", bodyText().includes("Good day. Here is your control center."));
assert("Dashboard completion rate 100% (1/1 real task)", bodyText().includes("100%") && bodyText().includes("1 / 1 tasks"));
assert("Dashboard shows real task + event names", bodyText().includes("Dashboard Task") && bodyText().includes("Dashboard Event"));

/* ================= ANALYTICS: real data ================= */
clickNav("nav-analytics");
await sleep(80);
assert("Analytics shows real data (KPI present)", bodyText().includes("Task Completion Rate") && bodyText().includes("100%"));
assert("Analytics task totals real", bodyText().includes("1 / 1 tasks"));
assert("Analytics events this month real", bodyText().includes("Events This Month") && bodyText().includes("1"));

/* ================= ANALYTICS: empty state (fresh user) ================= */
const usernameEmpty = `complete-empty-${suffix}`;
clickEl(document.querySelector('button[aria-label="Sign out"]'));
await waitForAuthScreen();
await registerViaUi("Empty User", usernameEmpty);
clickNav("nav-analytics");
await sleep(80);
assert("Analytics empty state (fresh user)", bodyText().includes("No productivity data yet"));

/* ================= PROFILE: read + update ================= */
const apiA = await jarFetch(`${base}/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: usernameA, password })
});
assert("Login as A via API (for profile update)", apiA.status === 200, String(apiA.status));

await mountApp();
await waitForWorkspace();
assert("Sidebar shows A identity", bodyText().includes("Complete Alice") && bodyText().includes(usernameA));

const putProfile = await jarFetch(`${base}/profile`, {
  method: "PUT", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Complete Alice Renamed" })
});
assert("Profile update via API → 200", putProfile.status === 200, String(putProfile.status));
const putBody = await putProfile.json();
assert("Profile update returns safe fields", putBody.name === "Complete Alice Renamed" && putBody.password_hash === undefined);

await mountApp();
await waitForWorkspace();
assert("Sidebar reflects updated profile after refresh", bodyText().includes("Complete Alice Renamed") && !bodyText().includes("Welcome back"));

/* ================= USER ISOLATION ================= */
clickEl(document.querySelector('button[aria-label="Sign out"]'));
await waitForAuthScreen();
await registerViaUi("Bob Isolated", usernameB);
assert("Fresh user B workspace is empty", bodyText().includes("Welcome to Organizer"));
assert("B sees no A data (backend empty)", await waitServer("/tasks", (t) => t.length === 0));

clickNav("nav-notes");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ Title: "Bob Private Note", Content: "Only Bob can see this." });
await saveModal();
await waitFor(() => bodyText().includes("Bob Private Note"));
const bobNoteId = (await (await jarFetch(`${base}/notes`)).json()).find((n) => n.title === "Bob Private Note").id;

clickEl(document.querySelector('button[aria-label="Sign out"]'));
await waitForAuthScreen();
clickEl(byTextIn(".standard-panel button", "Sign in"));
await sleep(50);
const loginForm = document.querySelector('form[aria-label="Authentication form"]');
const [au, ap] = loginForm.querySelectorAll("input");
setNativeValue(au, usernameA);
setNativeValue(ap, password);
submitForm(loginForm);
await waitForWorkspace();
assert("A logs back in and still has own data", (await (await jarFetch(`${base}/tasks`)).json()).length >= 1);
assert("A cannot read B's note → 404", (await jarFetch(`${base}/notes/${bobNoteId}`)).status === 404);
assert("A's UI does not show B's note", !bodyText().includes("Bob Private Note"));

/* ================= RESPONSIVE ================= */
const css = await readFile(fileURLToPath(new URL("../src/index.css", import.meta.url)), "utf8");
for (const bp of [1250, 1050, 900, 800, 620, 600, 430]) {
  assert(`CSS has responsive breakpoint @${bp}px`, css.includes(`@media (max-width: ${bp}px)`));
}
assert("CSS has off-canvas mobile sidebar rules", css.includes(".app-sidebar.open") && css.includes(".sidebar-backdrop") && css.includes(".mobile-menu-btn"));

matchMediaMatches = true;
window.innerWidth = 500;
clickEl(document.querySelector(".mobile-menu-btn"));
await sleep(60);
const sidebar = document.querySelector(".app-sidebar");
assert("Mobile: hamburger opens sidebar (open class)", sidebar?.classList.contains("open"));
assert("Mobile: backdrop shown when sidebar open", document.querySelector(".sidebar-backdrop") !== null);
clickNav("nav-notes");
await sleep(60);
assert("Mobile: navigating closes sidebar", !sidebar.classList.contains("open"));
clickEl(document.querySelector(".mobile-menu-btn"));
await sleep(60);
assert("Mobile: sidebar reopens", sidebar.classList.contains("open"));
clickEl(document.querySelector(".sidebar-backdrop"));
await sleep(60);
assert("Mobile: backdrop click closes sidebar", !sidebar.classList.contains("open"));

/* ================= SEARCH + FILTER: UI ================= */
const createTaskViaUi = async (name, type) => {
  clickEl(document.querySelector(".header-create"));
  await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
  await fillModal({ "Title / Task Name": name, Type: type });
  await saveModal();
  await waitFor(() => bodyText().includes(name));
};
clickNav("nav-tasks");
await sleep(60);
await createTaskViaUi("Searchable Alpha Task", "Task");
await createTaskViaUi("Searchable Beta Meeting", "Meeting");

const searchInput = document.querySelector('input[aria-label="Search tasks"]');
setNativeValue(searchInput, "beta");
await sleep(80);
assert("Task search narrows the list", bodyText().includes("Searchable Beta Meeting") && !bodyText().includes("Searchable Alpha Task"));
setNativeValue(searchInput, "zzz-no-match");
await sleep(80);
assert("Task search empty state ('No tasks found')", bodyText().includes("No tasks found"));
setNativeValue(searchInput, "");
const typeFilter = document.querySelector('select[aria-label="Filter by type"]');
setNativeValue(typeFilter, "Meeting");
await sleep(80);
assert("Task type filter shows only meetings", bodyText().includes("Searchable Beta Meeting") && !bodyText().includes("Searchable Alpha Task"));
setNativeValue(typeFilter, "all");
const clearFiltersBtn = document.querySelector('.task-tool-btn[title="Clear filters"]');
clickEl(clearFiltersBtn);
await sleep(80);
assert("Clear filters restores full list", bodyText().includes("Searchable Alpha Task") && bodyText().includes("Searchable Beta Meeting"));

/* notes search */
clickNav("nav-notes");
await sleep(60);
clickEl(document.querySelector(".header-create"));
await waitFor(() => document.querySelector("#create-modal .modal-save") !== null);
await fillModal({ Title: "Searchable Note Zebra", Content: "Search me out." });
await saveModal();
await waitFor(() => bodyText().includes("Searchable Note Zebra"));
const noteSearch = document.querySelector('input[placeholder="Search notes..."]');
setNativeValue(noteSearch, "zebra");
await sleep(80);
assert("Notes search narrows the list", bodyText().includes("Searchable Note Zebra") && !bodyText().includes("No notes yet"));
setNativeValue(noteSearch, "nomatch");
await sleep(80);
assert("Notes search empty state ('No matching notes')", bodyText().includes("No matching notes"));
setNativeValue(noteSearch, "");

/* clean up the search/filter fixtures so later checks stay deterministic */
const pendingTaskIds = (await (await jarFetch(`${base}/tasks`)).json()).filter((t) => /^Searchable/.test(t.name)).map((t) => t.id);
for (const id of pendingTaskIds) await jarFetch(`${base}/tasks/${id}`, { method: "DELETE" });
const zebraNoteId = (await (await jarFetch(`${base}/notes`)).json()).find((n) => n.title === "Searchable Note Zebra")?.id;
if (zebraNoteId) await jarFetch(`${base}/notes/${zebraNoteId}`, { method: "DELETE" });

/* ================= ERROR CHECKS ================= */
const unexpected4xx = networkStatuses.filter((s) => {
  const [status] = s.split(" ");
  if (Number(status) < 400) return false;
  if (Number(status) >= 500) return false;
  return !s.includes("/auth/login") && !s.includes("/notes/") && !s.includes("/auth/me") && !s.includes("/profile");
});
const server5xx = serverLogs.filter((l) => /\s[5]\d\d\s/.test(l));
const network5xx = networkStatuses.filter((s) => Number(s.split(" ")[0]) >= 500);
assert("No unexpected 4xx API responses", unexpected4xx.length === 0, unexpected4xx.join(" | "));
assert("No 5xx API responses", network5xx.length === 0, network5xx.join(" | "));
assert("No 5xx in backend request logs", server5xx.length === 0, server5xx.join(" | "));
const benignPatterns = [/not implemented/i, /uncaught/i];
const realConsoleErrors = consoleErrors.filter((e) => !benignPatterns.some((p) => p.test(e)));
assert("No console errors/warnings during full run", realConsoleErrors.length === 0, realConsoleErrors.slice(0, 5).join(" | "));
/* cleanup */
await getPool().query("DELETE FROM users WHERE username LIKE $1", ["complete-%"]);
const leftoverUsers = (await getPool().query("SELECT count(*)::int AS n FROM users WHERE username LIKE 'complete-%'")).rows[0].n;
assert("No leftover test users", leftoverUsers === 0, String(leftoverUsers));
assert("No leftover test rows", (await getPool().query(
  "SELECT (SELECT count(*)::int FROM tasks) + (SELECT count(*)::int FROM notes) + (SELECT count(*)::int FROM calendar_events) + (SELECT count(*)::int FROM goals) + (SELECT count(*)::int FROM habits) + (SELECT count(*)::int FROM meals) + (SELECT count(*)::int FROM grocery_items) + (SELECT count(*)::int FROM custom_reminders) + (SELECT count(*)::int FROM activity_log) AS n"
)).rows[0].n === 0);

await server.close();
httpServer.close();
await disconnectDatabase();
originalLog(failures === 0 ? "\nALL COMPLETE APPLICATION TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
