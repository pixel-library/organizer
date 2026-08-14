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

let base;

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const emailA = `tasks-a-${suffix}@test.dev`;
  const emailB = `tasks-b-${suffix}@test.dev`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["tasks-%@test.dev"]);

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

  const userA = await register("Task Alice", emailA);
  const userB = await register("Task Bob", emailB);
  assert("register User A → 201", userA.res.status === 201);
  assert("register User B → 201", userB.res.status === 201);

  // Create
  const taskPayload = {
    name: "Write progress report",
    date: "2026-08-20",
    time: "15:30",
    priority: "Red",
    type: "Work",
    description: "Q3 summary",
    tags: ["report", "work"],
    subtasks: [{ id: 1, text: "Draft", completed: false }],
    reminder: "none",
    recurring: "none",
    startDate: "2026-08-18",
    estimatedTime: "1h 30m",
    completed: false,
    userId: userB.body.id
  };
  const created = await call("POST", "/tasks", taskPayload, userA.cookie);
  assert("POST /tasks → 201", created.status === 201, String(created.status));
  const task = await created.json();
  assert("task has id", task.id !== undefined && task.id !== null);
  assert("task round-trips name", task.name === "Write progress report");
  assert("task round-trips priority", task.priority === "Red");
  assert("task round-trips date", task.date === "2026-08-20");
  assert("task round-trips time (HH:MM)", task.time === "15:30", task.time);
  assert("task round-trips type (category)", task.type === "Work");
  assert("task round-trips tags", Array.isArray(task.tags) && task.tags.length === 2);
  assert("task round-trips subtasks", Array.isArray(task.subtasks) && task.subtasks[0].text === "Draft");
  assert("task round-trips startDate", task.startDate === "2026-08-18");
  assert("task response has no password/secrets", task.password_hash === undefined);

  const dbCheck = await getPool().query("SELECT user_id FROM tasks WHERE id = $1", [task.id]);
  assert("ownership set from session (not client)", String(dbCheck.rows[0].user_id) === String(userA.body.id));

  // Read (list + single)
  const list = await call("GET", "/tasks", undefined, userA.cookie);
  assert("GET /tasks → 200", list.status === 200);
  const listBody = await list.json();
  assert("GET /tasks returns array", Array.isArray(listBody));
  assert("GET /tasks contains created task", listBody.some((t) => String(t.id) === String(task.id)));

  const single = await call("GET", `/tasks/${task.id}`, undefined, userA.cookie);
  assert("GET /tasks/:id → 200", single.status === 200, String(single.status));
  assert("GET /tasks/:id matches", (await single.json()).name === "Write progress report");

  // Edit
  const edited = await call("PATCH", `/tasks/${task.id}`, { name: "Final report", priority: "Green" }, userA.cookie);
  assert("PATCH /tasks/:id → 200", edited.status === 200, String(edited.status));
  const editedBody = await edited.json();
  assert("PATCH updates name", editedBody.name === "Final report");
  assert("PATCH updates priority", editedBody.priority === "Green");
  assert("PATCH preserves other fields", editedBody.type === "Work" && editedBody.date === "2026-08-20");

  // PUT also works (partial semantics)
  const put = await call("PUT", `/tasks/${task.id}`, { description: "updated via PUT" }, userA.cookie);
  assert("PUT /tasks/:id → 200", put.status === 200, String(put.status));
  assert("PUT updates field", (await put.json()).description === "updated via PUT");

  // Complete
  const completedRes = await call("PATCH", `/tasks/${task.id}`, { completed: true }, userA.cookie);
  assert("PATCH complete → 200", completedRes.status === 200);
  assert("task marked completed", (await completedRes.json()).completed === true);

  // Search / filter / sort
  const search = await call("GET", "/tasks?search=report", undefined, userA.cookie);
  assert("search matches name", (await search.json()).some((t) => String(t.id) === String(task.id)));
  const searchNo = await call("GET", "/tasks?search=zzzznomatch", undefined, userA.cookie);
  assert("search no-match → empty", (await searchNo.json()).length === 0);
  const done = await call("GET", "/tasks?status=completed", undefined, userA.cookie);
  assert("filter status=completed", (await done.json()).every((t) => t.completed === true));
  const pending = await call("GET", "/tasks?status=pending", undefined, userA.cookie);
  assert("filter status=pending excludes completed", (await pending.json()).length === 0);
  const byPriority = await call("GET", "/tasks?priority=Green", undefined, userA.cookie);
  assert("filter priority=Green", (await byPriority.json()).some((t) => String(t.id) === String(task.id)));
  const byType = await call("GET", "/tasks?type=Work", undefined, userA.cookie);
  assert("filter type=Work", (await byType.json()).some((t) => String(t.id) === String(task.id)));
  const from = await call("GET", "/tasks?from=2026-08-01&to=2026-08-31", undefined, userA.cookie);
  assert("filter date range includes task", (await from.json()).some((t) => String(t.id) === String(task.id)));
  const outOfRange = await call("GET", "/tasks?from=2030-01-01", undefined, userA.cookie);
  assert("filter date range excludes task", (await outOfRange.json()).length === 0);
  const badStatus = await call("GET", "/tasks?status=bogus", undefined, userA.cookie);
  assert("invalid status → 400", badStatus.status === 400);

  // Refresh persistence (fresh request)
  const refresh = await call("GET", "/tasks", undefined, userA.cookie);
  assert("refresh shows completed task", (await refresh.json()).some((t) => String(t.id) === String(task.id) && t.completed === true));

  // Logout / login persistence
  await call("POST", "/auth/logout", {}, userA.cookie);
  const relogin = await call("POST", "/auth/login", { email: emailA, password }, undefined);
  assert("relogin → 200", relogin.status === 200);
  const cookie2 = cookieFrom(relogin);
  const afterLogin = await call("GET", "/tasks", undefined, cookie2);
  assert("tasks persist across logout/login", (await afterLogin.json()).some((t) => String(t.id) === String(task.id)));

  // Validation
  const noName = await call("POST", "/tasks", { priority: "Red" }, cookie2);
  assert("POST without name → 400", noName.status === 400, String(noName.status));
  const badPriority = await call("POST", "/tasks", { name: "X", priority: "Purple" }, cookie2);
  assert("invalid priority → 400", badPriority.status === 400, String(badPriority.status));
  const noBody = await call("PATCH", `/tasks/${task.id}`, {}, cookie2);
  assert("empty PATCH body → 400", noBody.status === 400);
  const noAuth = await call("GET", "/tasks", undefined, undefined);
  assert("GET /tasks without login → 401", noAuth.status === 401);
  const badDate = await call("POST", "/tasks", { name: "X", date: "not-a-date" }, cookie2);
  assert("invalid date → 400", badDate.status === 400);

  // Isolation — User B must not read/edit/delete A's task
  const bRead = await call("GET", `/tasks/${task.id}`, undefined, userB.cookie);
  assert("B cannot read A task → 404", bRead.status === 404, String(bRead.status));
  const bEdit = await call("PATCH", `/tasks/${task.id}`, { name: "hacked" }, userB.cookie);
  assert("B cannot edit A task → 404", bEdit.status === 404, String(bEdit.status));
  const bDelete = await call("DELETE", `/tasks/${task.id}`, undefined, userB.cookie);
  assert("B cannot delete A task → 404", bDelete.status === 404, String(bDelete.status));
  const bList = await call("GET", "/tasks", undefined, userB.cookie);
  assert("B list excludes A task", (await bList.json()).length === 0);

  const stillThere = await call("GET", `/tasks/${task.id}`, undefined, cookie2);
  assert("A task intact after B attempts", stillThere.status === 200);

  // Delete
  const del = await call("DELETE", `/tasks/${task.id}`, undefined, cookie2);
  assert("DELETE /tasks/:id → 204", del.status === 204, String(del.status));
  const gone = await call("GET", `/tasks/${task.id}`, undefined, cookie2);
  assert("task gone after delete → 404", gone.status === 404, String(gone.status));
  const again = await call("DELETE", `/tasks/${task.id}`, undefined, cookie2);
  assert("delete non-existent → 404", again.status === 404);

  // Cleanup
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["tasks-%@test.dev"]);
  const leftoverTasks = await getPool().query("SELECT count(*)::int AS n FROM tasks");
  const leftoverUsers = await getPool().query("SELECT count(*)::int AS n FROM users WHERE email LIKE $1", ["%@test.dev"]);
  assert("no leftover test tasks", leftoverTasks.rows[0].n === 0, `${leftoverTasks.rows[0].n} rows`);
  assert("no leftover test users", leftoverUsers.rows[0].n === 0, `${leftoverUsers.rows[0].n} rows`);

  server.close();
  await disconnectDatabase();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL TASKS TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
