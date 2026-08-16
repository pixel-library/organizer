import { createApp } from "../server/app.js";
import { connectDatabase, disconnectDatabase, getPool } from "../server/db.js";

let failures = 0;
const assert = (name, cond, extra = "") => {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const cookieFrom = (res) => {
  const setCookie = res.headers.getSetCookie();
  if (setCookie.length === 0) return null;
  const [pair] = setCookie[0].split(";");
  return pair;
};

const pad = (n) => String(n).padStart(2, "0");
const keyFrom = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyFrom(new Date());
const addDaysKey = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return keyFrom(new Date(y, m - 1, d + n));
};

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["col-%"]);
  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["mig-%"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api`;

  const call = (method, path, body, cookie) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

  const register = async (name, username) => {
    const res = await call("POST", "/auth/register", { name, username, password });
    return { res, cookie: cookieFrom(res), body: await res.json() };
  };

  const userA = await register("Col Alice", `col-a-${suffix}`);
  const userB = await register("Col Bob", `col-b-${suffix}`);
  assert("register A → 201", userA.res.status === 201);
  assert("register B → 201", userB.res.status === 201);

  // --- GOALS ---
  const gCreate = await call("POST", "/goals", { name: "Read 12 books", target: 12, current: 4, unit: "books" }, userA.cookie);
  assert("POST /goals → 201", gCreate.status === 201, String(gCreate.status));
  const goal = await gCreate.json();
  assert("goal has string id", typeof goal.id === "string", typeof goal.id);
  assert("goal fields round-trip", goal.name === "Read 12 books" && goal.target === 12 && goal.current === 4 && goal.unit === "books", JSON.stringify(goal));
  assert("goal no user_id leaked", goal.user_id === undefined);

  const gList = await call("GET", "/goals", undefined, userA.cookie);
  const goals = await gList.json();
  assert("GET /goals → 200 + 1 goal", gList.status === 200 && goals.length === 1 && goals[0].id === goal.id);

  const gOne = await call("GET", `/goals/${goal.id}`, undefined, userA.cookie);
  assert("GET /goals/:id → 200", gOne.status === 200 && (await gOne.json()).name === "Read 12 books");

  const gPatch = await call("PATCH", `/goals/${goal.id}`, { current: 6 }, userA.cookie);
  assert("PATCH /goals/:id → 200 + current updated", gPatch.status === 200 && (await gPatch.json()).current === 6);

  const gMissing = await call("POST", "/goals", { target: 5 }, userA.cookie);
  assert("POST /goals missing name → 400", gMissing.status === 400);

  const gBadTarget = await call("POST", "/goals", { name: "Bad", target: 0 }, userA.cookie);
  assert("POST /goals non-positive target → 400", gBadTarget.status === 400);

  // --- HABITS ---
  const hCreate = await call("POST", "/habits", { name: "Run", days: [true, false, true, false, false, false, false], history: [todayKey(), addDaysKey(todayKey(), -1)] }, userA.cookie);
  assert("POST /habits → 201", hCreate.status === 201, String(hCreate.status));
  const habit = await hCreate.json();
  assert("habit history round-trips as strings", Array.isArray(habit.history) && habit.history.every((d) => typeof d === "string") && habit.history.length === 2, JSON.stringify(habit.history));
  assert("habit days are 7 booleans", Array.isArray(habit.days) && habit.days.length === 7 && habit.days[0] === true, JSON.stringify(habit.days));

  const hBadDays = await call("POST", "/habits", { name: "Bad", days: [true, false] }, userA.cookie);
  assert("POST /habits bad days → 400", hBadDays.status === 400);

  const hPatch = await call("PATCH", `/habits/${habit.id}`, { history: [todayKey()] }, userA.cookie);
  const hPatched = await hPatch.json();
  assert("PATCH /habits/:id history replaces", hPatch.status === 200 && hPatched.history.length === 1 && hPatched.history[0] === todayKey());

  // --- MEALS ---
  const mCreate = await call("POST", "/meals", { name: "Oatmeal", date: todayKey(), type: "Breakfast", time: "07:30", calories: 300, ingredients: ["oats", "milk"], status: "completed" }, userA.cookie);
  assert("POST /meals → 201", mCreate.status === 201, String(mCreate.status));
  const meal = await mCreate.json();
  assert("meal date/time normalized", meal.date === todayKey() && meal.time === "07:30", JSON.stringify(meal));
  assert("meal ingredients array", Array.isArray(meal.ingredients) && meal.ingredients.length === 2);
  assert("meal calories numeric", meal.calories === 300);

  const mDayMeal = await call("POST", "/meals", { day: "Friday", type: "Dinner", name: "Pizza" }, userA.cookie);
  assert("POST /meals day-based → 201", mDayMeal.status === 201, String(mDayMeal.status));
  const mBadDay = await call("POST", "/meals", { day: "Funday" }, userA.cookie);
  assert("POST /meals bad day → 400", mBadDay.status === 400);

  const mPatch = await call("PUT", `/meals/${meal.id}`, { status: "planned", calories: 250 }, userA.cookie);
  const mPatched = await mPatch.json();
  assert("PUT /meals/:id full update", mPatch.status === 200 && mPatched.status === "planned" && mPatched.calories === 250 && mPatched.name === "Oatmeal");

  // --- GROCERY ITEMS ---
  const giCreate = await call("POST", "/groceryItems", { name: "Milk", quantity: "2", unit: "L", category: "Dairy", note: "skim" }, userA.cookie);
  assert("POST /groceryItems → 201", giCreate.status === 201, String(giCreate.status));
  const gi = await giCreate.json();
  assert("grocery unit round-trips", gi.unit === "L" && gi.quantity === "2" && gi.completed === false, JSON.stringify(gi));

  const giToggle = await call("PATCH", `/groceryItems/${gi.id}`, { completed: true }, userA.cookie);
  assert("PATCH grocery completed → true", giToggle.status === 200 && (await giToggle.json()).completed === true);

  const giMissing = await call("POST", "/groceryItems", { quantity: "1" }, userA.cookie);
  assert("POST grocery missing name → 400", giMissing.status === 400);

  // --- CUSTOM REMINDERS ---
  const rCreate = await call("POST", "/customReminders", { title: "Water plants", date: todayKey(), time: "09:00", note: "balcony", type: "daily" }, userA.cookie);
  assert("POST /customReminders → 201", rCreate.status === 201, String(rCreate.status));
  const reminder = await rCreate.json();
  assert("reminder fields round-trip", reminder.title === "Water plants" && reminder.time === "09:00" && reminder.completed === false);
  const rBadType = await call("POST", "/customReminders", { title: "Bad", type: "sometimes" }, userA.cookie);
  assert("POST reminder bad type → 400", rBadType.status === 400);

  const rPatch = await call("PATCH", `/customReminders/${reminder.id}`, { completed: true }, userA.cookie);
  assert("PATCH reminder completed → true", rPatch.status === 200 && (await rPatch.json()).completed === true);

  // --- ACTIVITY LOG ---
  const aCreate = await call("POST", "/activityLog", { name: "Added task", status: "created", timestamp: "August 14, 2026, 10:00 AM" }, userA.cookie);
  assert("POST /activityLog → 201", aCreate.status === 201, String(aCreate.status));
  const aCreate2 = await call("POST", "/activityLog", { name: "Completed goal", status: "updated" }, userA.cookie);
  assert("POST activity #2 → 201", aCreate2.status === 201);

  const aList = await call("GET", "/activityLog", undefined, userA.cookie);
  const aRows = await aList.json();
  assert("GET /activityLog newest-first", aRows.length === 2 && aRows[0].name === "Completed goal", JSON.stringify(aRows.map((r) => r.name)));
  assert("activity timestamp text preserved", aRows[1].timestamp === "August 14, 2026, 10:00 AM");

  const aDel = await call("DELETE", `/activityLog/${aRows[0].id}`, undefined, userA.cookie);
  assert("DELETE /activityLog/:id → 204", aDel.status === 204);
  const aClear = await call("DELETE", "/activityLog", undefined, userA.cookie);
  assert("DELETE /activityLog (clear) → 204", aClear.status === 204);
  const aEmpty = await call("GET", "/activityLog", undefined, userA.cookie);
  assert("activity log cleared", (await aEmpty.json()).length === 0);

  // --- DELETE checks ---
  for (const [path, id, label] of [
    ["/goals", goal.id, "goal"],
    ["/habits", habit.id, "habit"],
    ["/meals", meal.id, "meal"],
    ["/groceryItems", gi.id, "grocery"],
    ["/customReminders", reminder.id, "reminder"]
  ]) {
    const del = await call("DELETE", `${path}/${id}`, undefined, userA.cookie);
    assert(`DELETE ${path}/${id} → 204`, del.status === 204, String(del.status));
    const gone = await call("GET", `${path}/${id}`, undefined, userA.cookie);
    assert(`GET deleted ${label} → 404`, gone.status === 404, String(gone.status));
  }
  const aEmpty2 = await call("GET", "/activityLog", undefined, userA.cookie);
  assert("A activity log empty after clears", (await aEmpty2.json()).length === 0);

  // --- auth guards + cross-user isolation ---
  const noAuth = await call("GET", "/goals", undefined, undefined);
  assert("GET /goals without login → 401", noAuth.status === 401);

  const giA = await call("POST", "/groceryItems", { name: "A secret" }, userA.cookie);
  const giAId = (await giA.json()).id;
  const bRead = await call("GET", `/groceryItems/${giAId}`, undefined, userB.cookie);
  assert("B cannot read A's grocery item → 404", bRead.status === 404);
  const bPatch = await call("PATCH", `/groceryItems/${giAId}`, { completed: true }, userB.cookie);
  assert("B cannot update A's grocery item → 404", bPatch.status === 404);
  const bDel = await call("DELETE", `/groceryItems/${giAId}`, undefined, userB.cookie);
  assert("B cannot delete A's grocery item → 404", bDel.status === 404);
  const bList = await call("GET", "/groceryItems", undefined, userB.cookie);
  assert("B list only contains B items", (await bList.json()).length === 0);

  // --- MIGRATION ENDPOINT ---
  const userC = await register("Mig Carol", `mig-c-${suffix}`);
  assert("register C → 201", userC.res.status === 201);

  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  const payload = {
    tasks: [
      { id: 1, name: "Ship feature", date: today, time: "10:00", priority: "Red", completed: false, type: "Task", tags: "work;urgent", subtasks: [{ name: "a", completed: false }] },
      { id: 2, name: "Old", date: "not-a-date", priority: "Yellow", completed: true },
      { id: 3, name: "" }
    ],
    notes: [{ id: 1, title: "Meeting", content: "Decisions", category: "Work", pinned: true, tags: ["misc"] }],
    calendarEvents: [{ id: 1, title: "Standup", start: today, startTime: "09:00", category: "Work" }],
    goals: [{ id: 1, name: "Launch", current: 2, target: 10, unit: "x" }],
    habits: [{ id: 1, name: "Meditate", days: [true, true, true, true, true, false, false], history: [today, yesterday] }],
    meals: [{ id: 1, name: "Lunch", date: today, type: "Lunch", calories: "500", ingredients: ["salad", "chicken"] }],
    groceryItems: [{ id: 1, name: "Eggs", quantity: "12", unit: "pcs", completed: true }],
    customReminders: [{ id: 1, title: "Call mom", date: today, time: "18:00" }],
    activityLog: [{ id: 1, name: "Imported", status: "migrated" }]
  };

  const mig = await call("POST", "/migrate", payload, userC.cookie);
  assert("POST /migrate → 201", mig.status === 201, String(mig.status));
  const counts = (await mig.json()).migrated;
  assert("migrate counts per collection", JSON.stringify(counts) === JSON.stringify({ tasks: 3, notes: 1, calendarEvents: 1, goals: 1, habits: 1, meals: 1, groceryItems: 1, customReminders: 1, activityLog: 1 }), JSON.stringify(counts));

  const cTasks = await (await call("GET", "/tasks", undefined, userC.cookie)).json();
  const cEvents = await (await call("GET", "/calendarEvents", undefined, userC.cookie)).json();
  const cGoals = await (await call("GET", "/goals", undefined, userC.cookie)).json();
  const cHabits = await (await call("GET", "/habits", undefined, userC.cookie)).json();
  const cMeals = await (await call("GET", "/meals", undefined, userC.cookie)).json();
  const cGroceries = await (await call("GET", "/groceryItems", undefined, userC.cookie)).json();
  const cReminders = await (await call("GET", "/customReminders", undefined, userC.cookie)).json();
  const cLog = await (await call("GET", "/activityLog", undefined, userC.cookie)).json();
  const cNotes = await (await call("GET", "/notes", undefined, userC.cookie)).json();

  assert("migrated task count = 3", cTasks.length === 3, `${cTasks.length}`);
  const shipTask = cTasks.find((t) => t.name === "Ship feature");
  assert("migrated task normalized (date/time/priority/tags)", shipTask.date === today && shipTask.time === "10:00" && shipTask.priority === "Red", JSON.stringify(shipTask));
  assert("migrated task tags split", Array.isArray(shipTask.tags) && shipTask.tags.includes("work") && shipTask.tags.includes("urgent"), JSON.stringify(shipTask.tags));
  assert("migrated task subtasks jsonb", Array.isArray(shipTask.subtasks) && shipTask.subtasks[0].name === "a");
  const emptyName = cTasks.find((t) => t.name === "Untitled task");
  assert("migrated empty-name task got default", emptyName !== undefined);
  const badDate = cTasks.find((t) => t.name === "Old");
  assert("migrated bad date → empty", badDate.date === "", JSON.stringify(badDate));

  assert("migrated notes count", cNotes.length === 1 && cNotes[0].title === "Meeting" && cNotes[0].pinned === true && cNotes[0].tags.includes("misc"), JSON.stringify(cNotes[0]));
  assert("migrated events count + start", cEvents.length === 1 && cEvents[0].start === today && cEvents[0].startTime === "09:00", JSON.stringify(cEvents[0]));
  assert("migrated goals (unit preserved)", cGoals.length === 1 && cGoals[0].unit === "x" && cGoals[0].current === 2 && cGoals[0].target === 10, JSON.stringify(cGoals[0]));
  assert("migrated habits (days + history)", cHabits.length === 1 && cHabits[0].days[0] === true && cHabits[0].history.length === 2, JSON.stringify(cHabits[0]));
  assert("migrated meals (calories numeric)", cMeals.length === 1 && cMeals[0].calories === 500 && cMeals[0].ingredients.length === 2, JSON.stringify(cMeals[0]));
  assert("migrated groceries", cGroceries.length === 1 && cGroceries[0].name === "Eggs" && cGroceries[0].unit === "pcs" && cGroceries[0].completed === true);
  assert("migrated reminders", cReminders.length === 1 && cReminders[0].title === "Call mom" && cReminders[0].time === "18:00");
  assert("migrated activity log", cLog.length === 1 && cLog[0].name === "Imported" && cLog[0].status === "migrated");

  // migrate again → no dupes because we insert fresh rows each time (app clears after import)
  const mig2 = await call("POST", "/migrate", { tasks: payload.tasks.slice(0, 1) }, userC.cookie);
  assert("re-migrate appends", mig2.status === 201);
  const cTasks2 = await (await call("GET", "/tasks", undefined, userC.cookie)).json();
  assert("re-migrate appended task", cTasks2.length === 4, `${cTasks2.length}`);

  // --- REFRESH persistence (new HTTP request, same session cookie) ---
  const fresh = await call("GET", "/groceryItems", undefined, userC.cookie);
  const freshRows = await fresh.json();
  assert("refresh keeps migrated groceries", freshRows.length === 1 && freshRows[0].name === "Eggs");

  // --- LOGOUT/LOGIN persistence ---
  const logout = await call("POST", "/auth/logout", undefined, userC.cookie);
  assert("logout → 204", logout.status === 204, String(logout.status));
  const afterLogout = await call("GET", "/goals", undefined, userC.cookie);
  assert("logged-out session rejected → 401", afterLogout.status === 401);

  const loginRes = await call("POST", "/auth/login", { username: `mig-c-${suffix}`, password }, undefined);
  assert("login again → 200", loginRes.status === 200, String(loginRes.status));
  const cookie2 = cookieFrom(loginRes);
  const reloginGoals = await (await call("GET", "/goals", undefined, cookie2)).json();
  const reloginTasks = await (await call("GET", "/tasks", undefined, cookie2)).json();
  const reloginNotes = await (await call("GET", "/notes", undefined, cookie2)).json();
  const reloginHabits = await (await call("GET", "/habits", undefined, cookie2)).json();
  const reloginReminders = await (await call("GET", "/customReminders", undefined, cookie2)).json();
  assert("logout→login keeps goals", reloginGoals.length === 1 && reloginGoals[0].name === "Launch");
  assert("logout→login keeps tasks", reloginTasks.length === 4);
  assert("logout→login keeps notes", reloginNotes.length === 1);
  assert("logout→login keeps habits", reloginHabits.length === 1 && reloginHabits[0].history.length === 2);
  assert("logout→login keeps reminders", reloginReminders.length === 1);

  // cleanup A's extra grocery item too
  await call("DELETE", `/groceryItems/${giAId}`, undefined, userA.cookie);

  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["col-%"]);
  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["mig-%"]);
  const leftovers = await getPool().query(
    "SELECT (SELECT count(*)::int FROM tasks) + (SELECT count(*)::int FROM notes) + (SELECT count(*)::int FROM calendar_events) + (SELECT count(*)::int FROM goals) + (SELECT count(*)::int FROM habits) + (SELECT count(*)::int FROM meals) + (SELECT count(*)::int FROM grocery_items) + (SELECT count(*)::int FROM custom_reminders) + (SELECT count(*)::int FROM activity_log) AS n"
  );
  assert("no leftover test rows", leftovers.rows[0].n === 0, `${leftovers.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL COLLECTIONS TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
