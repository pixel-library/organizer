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
const weekStartKey = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return keyFrom(d);
};
const dayDiff = (a, b) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd)) / 86400000);
};

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const emailA = `stats-a-${suffix}@test.dev`;
  const emailB = `stats-b-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["stats-%@test.dev"]);

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

  const register = async (name, email) => {
    const res = await call("POST", "/auth/register", { name, email, password });
    return { res, cookie: cookieFrom(res), body: await res.json() };
  };

  const userA = await register("Stats Alice", emailA);
  const userB = await register("Stats Bob", emailB);
  assert("register User A → 201", userA.res.status === 201);
  assert("register User B → 201", userB.res.status === 201);

  // 1. New user → empty state (no fake numbers)
  const emptyRes = await call("GET", "/stats", undefined, userA.cookie);
  assert("GET /api/stats → 200", emptyRes.status === 200, String(emptyRes.status));
  const empty = await emptyRes.json();
  assert("dashboard.isEmpty true for new user", empty.dashboard.isEmpty === true);
  assert("analytics.hasData false for new user", empty.analytics.hasData === false);
  assert("new user totalTasks is 0 (no fake numbers)", empty.dashboard.totalTasks === 0);
  assert("new user completionRate is 0", empty.dashboard.completionRate === 0);
  assert("new user analytics completionRate is 0", empty.analytics.completionRate === 0);
  assert("new user monthEvents is 0", empty.analytics.monthEvents === 0);
  assert("new user habitCompletions is 0", empty.analytics.habitCompletions === 0);

  const noAuth = await call("GET", "/stats", undefined, undefined);
  assert("GET /api/stats without login → 401", noAuth.status === 401);

  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  const wkStart = weekStartKey();
  const inWeek = (k) => k >= wkStart && k <= today;
  const inMonth = (k) => k.slice(0, 7) === today.slice(0, 7);
  const expectedWeek = 3 + (inWeek(yesterday) ? 1 : 0);
  const expectedMonth = 3 + (inMonth(yesterday) ? 1 : 0);
  const expectedWeekRate = Math.round((2 / expectedWeek) * 100);
  const expectedMonthRate = Math.round((2 / expectedMonth) * 100);

  // 2. Create real data for User A
  const t1 = await call("POST", "/tasks", { name: "Hot task", date: today, time: "23:59", priority: "Red" }, userA.cookie);
  const t2 = await call("POST", "/tasks", { name: "Done task", date: today, time: "10:00", completed: true }, userA.cookie);
  const t3 = await call("POST", "/tasks", { name: "Done task 2", date: today, time: "11:00", completed: true }, userA.cookie);
  const t4 = await call("POST", "/tasks", { name: "Overdue task", date: yesterday, priority: "Red" }, userA.cookie);
  assert("create 4 tasks via API → 201", t1.status === 201 && t2.status === 201 && t3.status === 201 && t4.status === 201);

  const ev = await call("POST", "/calendarEvents", { title: "Standup", start: today, startTime: "08:00" }, userA.cookie);
  assert("create event via API → 201", ev.status === 201);

  const note = await call("POST", "/notes", { title: "Meeting notes", content: "abc" }, userA.cookie);
  assert("create note via API → 201", note.status === 201);

  await getPool().query("INSERT INTO goals (user_id, name, current, target) VALUES ($1, $2, $3, $4)", [userA.body.id, "Launch", 2, 10]);
  await getPool().query(
    "INSERT INTO meals (user_id, date, name, type, status) VALUES ($1, $2, $3, $4, $5)",
    [userA.body.id, today, "Breakfast", "Meal", "completed"]
  );
  const weekdayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  await getPool().query(
    "INSERT INTO meals (user_id, day, name, type, status) VALUES ($1, $2, $3, $4, $5)",
    [userA.body.id, weekdayName, "Lunch", "Meal", "planned"]
  );
  await getPool().query("INSERT INTO habits (user_id, name, history) VALUES ($1, $2, $3)", [userA.body.id, "Run", [today]]);

  // 3. Dashboard reflects real data
  const dashRes = await call("GET", "/stats", undefined, userA.cookie);
  const dash = (await dashRes.json()).dashboard;
  assert("dashboard.isEmpty false after data", dash.isEmpty === false);
  assert("totalTasks = 4", dash.totalTasks === 4, `${dash.totalTasks}`);
  assert("completedTasks = 2", dash.completedTasks === 2, `${dash.completedTasks}`);
  assert("completionRate = 50%", dash.completionRate === 50, `${dash.completionRate}`);
  assert("highPriority = 2 (both Red tasks incomplete)", dash.highPriority === 2, `${dash.highPriority}`);
  assert("overdue = 1", dash.overdue === 1, `${dash.overdue}`);
  assert("tasksToday = 3", dash.tasksToday === 3, `${dash.tasksToday}`);
  assert("tasksCompletedToday = 2", dash.tasksCompletedToday === 2, `${dash.tasksCompletedToday}`);
  assert("todayEvents = 1", dash.todayEvents === 1, `${dash.todayEvents}`);
  assert("todayMeals = 2", dash.todayMeals === 2, `${dash.todayMeals}`);
  assert("completedMealsToday = 1", dash.completedMealsToday === 1, `${dash.completedMealsToday}`);
  assert("goalCount = 1", dash.goalCount === 1, `${dash.goalCount}`);
  assert("projectProgress = 20%", dash.projectProgress === 20, `${dash.projectProgress}`);
  assert("notes = 1", dash.notes === 1, `${dash.notes}`);
  assert("activeNotes = 1", dash.activeNotes === 1, `${dash.activeNotes}`);
  assert("week.tasks = expectedWeek", dash.week.tasks === expectedWeek, `${dash.week.tasks} vs ${expectedWeek}`);
  assert("week.completed = 2", dash.week.completed === 2, `${dash.week.completed}`);
  assert("week.events = 1", dash.week.events === 1, `${dash.week.events}`);
  assert("week.habitCheckins = 1", dash.week.habitCheckins === 1, `${dash.week.habitCheckins}`);

  // 4. Analytics reflects real data
  const anaRes = await call("GET", "/stats", undefined, userA.cookie);
  const ana = (await anaRes.json()).analytics;
  assert("analytics.hasData true", ana.hasData === true);
  assert("analytics totalTasks = 4", ana.totalTasks === 4, `${ana.totalTasks}`);
  assert("analytics completedTasks = 2", ana.completedTasks === 2);
  assert("analytics completionRate = 50%", ana.completionRate === 50, `${ana.completionRate}`);
  assert("analytics overdue = 1", ana.overdue === 1, `${ana.overdue}`);
  assert("analytics week.tasks = expectedWeek", ana.week.tasks === expectedWeek, `${ana.week.tasks} vs ${expectedWeek}`);
  assert("analytics week.completed = 2", ana.week.completed === 2);
  assert("analytics week.completionRate matches", ana.week.completionRate === expectedWeekRate, `${ana.week.completionRate} vs ${expectedWeekRate}`);
  assert("analytics month.tasks = expectedMonth", ana.month.tasks === expectedMonth, `${ana.month.tasks} vs ${expectedMonth}`);
  assert("analytics month.completed = 2", ana.month.completed === 2);
  assert("analytics month.completionRate matches", ana.month.completionRate === expectedMonthRate, `${ana.month.completionRate} vs ${expectedMonthRate}`);
  assert("analytics monthEvents = 1", ana.monthEvents === 1, `${ana.monthEvents}`);
  assert("analytics upcomingEvents = 1", ana.upcomingEvents === 1, `${ana.upcomingEvents}`);
  assert("analytics habitCompletions = 1", ana.habitCompletions === 1, `${ana.habitCompletions}`);
  assert("analytics bestStreak = 1", ana.bestStreak === 1, `${ana.bestStreak}`);
  const createdKey = new Date().toISOString().slice(0, 10);
  const expectedHabitRate = Math.round((1 / Math.max(1, dayDiff(today, createdKey) + 1)) * 100);
  assert("analytics habitRate matches elapsed-day math", ana.habitRate === expectedHabitRate, `${ana.habitRate} vs ${expectedHabitRate}`);

  const todayBar = ana.last14Days.find((d) => d.key === today);
  assert("14-day chart has today column", todayBar !== undefined);
  assert("today completedTasks = 2", todayBar.completedTasks === 2, `${todayBar.completedTasks}`);
  assert("today habitCompletions = 1", todayBar.habitCompletions === 1, `${todayBar.habitCompletions}`);
  assert("today events = 1", todayBar.events === 1, `${todayBar.events}`);
  assert("maxActivity computed from real data", ana.maxActivity >= 4, `${ana.maxActivity}`);

  // 5. Delete data → stats update
  const delTask = await call("DELETE", `/tasks/${(await t3.json()).id}`, undefined, userA.cookie);
  const delEvent = await call("DELETE", `/calendarEvents/${(await ev.json()).id}`, undefined, userA.cookie);
  assert("delete task → 204", delTask.status === 204);
  assert("delete event → 204", delEvent.status === 204);

  const afterRes = await call("GET", "/stats", undefined, userA.cookie);
  const after = await afterRes.json();
  const expectedWeek2 = 2 + (inWeek(yesterday) ? 1 : 0);
  const expectedMonth2 = 2 + (inMonth(yesterday) ? 1 : 0);
  const expectedWeekRate2 = Math.round((1 / expectedWeek2) * 100);
  const expectedMonthRate2 = Math.round((1 / expectedMonth2) * 100);
  assert("totalTasks updated to 3", after.dashboard.totalTasks === 3, `${after.dashboard.totalTasks}`);
  assert("completedTasks updated to 1", after.dashboard.completedTasks === 1);
  assert("completionRate updated to 33%", after.dashboard.completionRate === 33, `${after.dashboard.completionRate}`);
  assert("tasksCompletedToday updated to 1", after.dashboard.tasksCompletedToday === 1);
  assert("todayEvents updated to 0", after.dashboard.todayEvents === 0);
  assert("week.events updated to 0", after.dashboard.week.events === 0);
  assert("week.completed updated to 1", after.dashboard.week.completed === 1);
  assert("analytics totalTasks updated to 3", after.analytics.totalTasks === 3);
  assert("analytics completionRate updated to 33%", after.analytics.completionRate === 33, `${after.analytics.completionRate}`);
  assert("analytics monthEvents updated to 0", after.analytics.monthEvents === 0);
  assert("analytics upcomingEvents updated to 0", after.analytics.upcomingEvents === 0);
  assert("analytics week.tasks updated", after.analytics.week.tasks === expectedWeek2, `${after.analytics.week.tasks} vs ${expectedWeek2}`);
  assert("analytics month.tasks updated", after.analytics.month.tasks === expectedMonth2, `${after.analytics.month.tasks} vs ${expectedMonth2}`);
  assert("analytics week.completionRate updated", after.analytics.week.completionRate === expectedWeekRate2, `${after.analytics.week.completionRate} vs ${expectedWeekRate2}`);
  assert("analytics month.completionRate updated", after.analytics.month.completionRate === expectedMonthRate2, `${after.analytics.month.completionRate} vs ${expectedMonthRate2}`);
  const todayBar2 = after.analytics.last14Days.find((d) => d.key === today);
  assert("today completedTasks updated to 1", todayBar2.completedTasks === 1, `${todayBar2.completedTasks}`);
  assert("today events updated to 0", todayBar2.events === 0, `${todayBar2.events}`);

  // 6. User B isolation — B stays empty while A has data
  const bEmpty = await call("GET", "/stats", undefined, userB.cookie);
  const bEmptyBody = await bEmpty.json();
  assert("B dashboard empty while A has data", bEmptyBody.dashboard.isEmpty === true);
  assert("B analytics hasData false while A has data", bEmptyBody.analytics.hasData === false);
  assert("B totalTasks is 0", bEmptyBody.dashboard.totalTasks === 0);

  const bTask = await call("POST", "/tasks", { name: "Bob task", date: today }, userB.cookie);
  assert("B creates own task → 201", bTask.status === 201);
  const bStats = await call("GET", "/stats", undefined, userB.cookie);
  const bBody = await bStats.json();
  assert("B dashboard isEmpty false after own task", bBody.dashboard.isEmpty === false);
  assert("B totalTasks = 1 (only own data)", bBody.dashboard.totalTasks === 1, `${bBody.dashboard.totalTasks}`);
  assert("B analytics hasData true", bBody.analytics.hasData === true);
  const aAfterB = await call("GET", "/stats", undefined, userA.cookie);
  const aAfterBBody = await aAfterB.json();
  assert("A totalTasks unaffected by B", aAfterBBody.dashboard.totalTasks === 3, `${aAfterBBody.dashboard.totalTasks}`);

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["stats-%@test.dev"]);
  const leftovers = await getPool().query(
    "SELECT (SELECT count(*)::int FROM tasks) + (SELECT count(*)::int FROM calendar_events) + (SELECT count(*)::int FROM goals) + (SELECT count(*)::int FROM habits) + (SELECT count(*)::int FROM meals) + (SELECT count(*)::int FROM notes) AS n"
  );
  assert("no leftover test rows", leftovers.rows[0].n === 0, `${leftovers.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL STATS TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
