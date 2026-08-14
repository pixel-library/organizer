import express from "express";
import cookieParser from "cookie-parser";
import { createApp } from "../server/app.js";
import { connectDatabase, disconnectDatabase, getPool } from "../server/db.js";
import authRouter from "../server/routes/auth.js";
import { authLimiter } from "../server/middleware/rateLimit.js";

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

const SECRET_KEYS = ["password", "password_hash", "token", "token_hash", "secret", "set-cookie"];

const containsSecret = (body) => {
  const json = JSON.stringify(body);
  const lower = json.toLowerCase();
  return SECRET_KEYS.some((k) => lower.includes(k));
};

async function main() {
  await connectDatabase();
  const suffix = Date.now();
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["sec-a-%@test.dev"]);
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["sec-b-%@test.dev"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api`;

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

  /* ---- create development-only users A and B ---- */
  const userA = await register("Security Alice", `sec-a-${suffix}@test.dev`);
  const userB = await register("Security Bob", `sec-b-${suffix}@test.dev`);
  assert("register A → 201", userA.res.status === 201, String(userA.res.status));
  assert("register B → 201", userB.res.status === 201, String(userB.res.status));

  /* ---- passwords / secrets never returned ---- */
  assert("register response has no secret fields", !containsSecret(userA.body), JSON.stringify(userA.body));
  assert("register response has no secret fields (B)", !containsSecret(userB.body), JSON.stringify(userB.body));

  const loginA = await call("POST", "/auth/login", { email: userA.body.email, password });
  assert("login A → 200", loginA.status === 200, String(loginA.status));
  const loginABody = await loginA.json();
  assert("login response has no secret fields", !containsSecret(loginABody), JSON.stringify(loginABody));
  assert("login response exposes no password hash", loginABody.password_hash === undefined);

  const meA = await call("GET", "/auth/me", undefined, userA.cookie);
  const meABody = await meA.json();
  assert("GET /auth/me → 200 with only safe fields", meA.status === 200 &&
    Object.keys(meABody).sort().join(",") === "createdAt,email,id,name,updatedAt", JSON.stringify(meABody));

  const health = await call("GET", "/health");
  const healthBody = await health.json();
  const healthStr = JSON.stringify(healthBody);
  assert("health response leaks no DB credentials", !/life_organizer|postgres:|DB_PASSWORD|password|@localhost/.test(healthStr), healthStr);

  const dbUserA = (await getPool().query("SELECT password_hash FROM users WHERE id = $1", [userA.body.id])).rows[0];
  assert("DB stores a bcrypt hash, not plaintext", typeof dbUserA.password_hash === "string" && dbUserA.password_hash.startsWith("$2") && dbUserA.password_hash !== password, dbUserA.password_hash);

  /* ---- create A's and B's data ---- */
  const taskA = (await (await call("POST", "/tasks", { name: "Task A", date: "2026-08-20" }, userA.cookie)).json());
  const noteA = (await (await call("POST", "/notes", { title: "Note A", content: "secret-note-A" }, userA.cookie)).json());
  const eventA = (await (await call("POST", "/calendarEvents", { title: "Event A", start: "2026-08-20" }, userA.cookie)).json());

  const taskB = (await (await call("POST", "/tasks", { name: "Task B", date: "2026-08-20" }, userB.cookie)).json());
  const noteB = (await (await call("POST", "/notes", { title: "Note B", content: "secret-note-B" }, userB.cookie)).json());
  const eventB = (await (await call("POST", "/calendarEvents", { title: "Event B", start: "2026-08-20" }, userB.cookie)).json());

  assert("Task A id is a string", typeof taskA.id === "string");
  assert("Task B id is a string", typeof taskB.id === "string");

  /* ---- A sees only A, B sees only B ---- */
  const aTasks = await (await call("GET", "/tasks", undefined, userA.cookie)).json();
  const aNotes = await (await call("GET", "/notes", undefined, userA.cookie)).json();
  const aEvents = await (await call("GET", "/calendarEvents", undefined, userA.cookie)).json();
  assert("A list contains exactly Task A", aTasks.length === 1 && aTasks[0].id === taskA.id, JSON.stringify(aTasks.map(t => t.name)));
  assert("A list contains exactly Note A", aNotes.length === 1 && aNotes[0].id === noteA.id);
  assert("A list contains exactly Event A", aEvents.length === 1 && aEvents[0].id === eventA.id);

  const bTasks = await (await call("GET", "/tasks", undefined, userB.cookie)).json();
  const bNotes = await (await call("GET", "/notes", undefined, userB.cookie)).json();
  const bEvents = await (await call("GET", "/calendarEvents", undefined, userB.cookie)).json();
  assert("B list contains exactly Task B", bTasks.length === 1 && bTasks[0].id === taskB.id, JSON.stringify(bTasks.map(t => t.name)));
  assert("B list contains exactly Note B", bNotes.length === 1 && bNotes[0].id === noteB.id);
  assert("B list contains exactly Event B", bEvents.length === 1 && bEvents[0].id === eventB.id);

  assert("A's list has no B names", !JSON.stringify(aTasks).includes("Task B") && !JSON.stringify(aNotes).includes("Note B") && !JSON.stringify(aEvents).includes("Event B"));
  assert("B's list has no A names", !JSON.stringify(bTasks).includes("Task A") && !JSON.stringify(bNotes).includes("Note A") && !JSON.stringify(bEvents).includes("Event A"));

  /* ---- A attempts on B's resources must FAIL (404) ---- */
  const readB = async (path) => (await call("GET", path, undefined, userA.cookie)).status;
  const editB = async (path, body) => (await call("PATCH", path, body, userA.cookie)).status;
  const deleteB = async (path) => (await call("DELETE", path, undefined, userA.cookie)).status;

  assert("A read B task → 404", (await readB(`/tasks/${taskB.id}`)) === 404);
  assert("A edit B task → 404", (await editB(`/tasks/${taskB.id}`, { name: "Hijacked" })) === 404);
  assert("A delete B task → 404", (await deleteB(`/tasks/${taskB.id}`)) === 404);
  assert("A read B note → 404", (await readB(`/notes/${noteB.id}`)) === 404);
  assert("A edit B note → 404", (await editB(`/notes/${noteB.id}`, { title: "Hijacked" })) === 404);
  assert("A delete B note → 404", (await deleteB(`/notes/${noteB.id}`)) === 404);
  assert("A read B event → 404", (await readB(`/calendarEvents/${eventB.id}`)) === 404);
  assert("A edit B event → 404", (await editB(`/calendarEvents/${eventB.id}`, { title: "Hijacked" })) === 404);
  assert("A delete B event → 404", (await deleteB(`/calendarEvents/${eventB.id}`)) === 404);

  /* ---- B attempts on A's resources must FAIL (404) ---- */
  const readA = async (path) => (await call("GET", path, undefined, userB.cookie)).status;
  const editA = async (path, body) => (await call("PUT", path, body, userB.cookie)).status;
  const deleteA = async (path) => (await call("DELETE", path, undefined, userB.cookie)).status;

  assert("B read A task → 404", (await readA(`/tasks/${taskA.id}`)) === 404);
  assert("B edit A task → 404", (await editA(`/tasks/${taskA.id}`, { name: "Hijacked" })) === 404);
  assert("B delete A task → 404", (await deleteA(`/tasks/${taskA.id}`)) === 404);
  assert("B read A note → 404", (await readA(`/notes/${noteA.id}`)) === 404);
  assert("B edit A note → 404", (await editA(`/notes/${noteA.id}`, { title: "Hijacked" })) === 404);
  assert("B delete A note → 404", (await deleteA(`/notes/${noteA.id}`)) === 404);
  assert("B read A event → 404", (await readA(`/calendarEvents/${eventA.id}`)) === 404);
  assert("B edit A event → 404", (await editA(`/calendarEvents/${eventA.id}`, { title: "Hijacked" })) === 404);
  assert("B delete A event → 404", (await deleteA(`/calendarEvents/${eventA.id}`)) === 404);

  /* ---- data intact after all cross-user attempts ---- */
  const intactA = await (await call("GET", "/tasks", undefined, userA.cookie)).json();
  const intactBNote = await (await call("GET", `/notes/${noteB.id}`, undefined, userB.cookie)).json();
  assert("A's data intact after B's attempts", intactA.length === 1 && intactA[0].name === "Task A");
  assert("B's note intact after A's attempts", intactBNote.id === noteB.id && intactBNote.title === "Note B");

  /* ---- body userId / id is ignored — ownership from session only ---- */
  const spoofed = await call("POST", "/tasks", { name: "Spoofed task", date: "2026-08-20", userId: userB.body.id, id: "99999" }, userA.cookie);
  const spoofedTask = await spoofed.json();
  assert("task created with spoofed userId → 201", spoofed.status === 201, String(spoofed.status));
  assert("spoofed task owned by A, not B", (await call("GET", `/tasks/${spoofedTask.id}`, undefined, userB.cookie)).status === 404);
  assert("spoofed task visible to A", (await call("GET", `/tasks/${spoofedTask.id}`, undefined, userA.cookie)).status === 200);

  /* ---- migrate ignores client-supplied user ids ---- */
  const migrated = await call("POST", "/migrate", {
    tasks: [{ name: "Migrated-for-B", date: "2026-08-20" }],
    userId: userB.body.id
  }, userA.cookie);
  assert("POST /migrate with spoofed userId → 201", migrated.status === 201, String(migrated.status));
  const bTasksAfter = await (await call("GET", "/tasks", undefined, userB.cookie)).json();
  assert("B list excludes A's migrated task", bTasksAfter.length === 1 && bTasksAfter[0].id === taskB.id, JSON.stringify(bTasksAfter.map(t => t.name)));

  /* ---- stats isolation ---- */
  const statsA = await (await call("GET", "/stats", undefined, userA.cookie)).json();
  const statsB = await (await call("GET", "/stats", undefined, userB.cookie)).json();
  assert("stats A sees only A's totals", statsA.dashboard.totalTasks === 3, JSON.stringify(statsA.dashboard.totalTasks)); // Task A + spoofed + migrated
  assert("stats B sees only B's totals", statsB.dashboard.totalTasks === 1, JSON.stringify(statsB.dashboard.totalTasks));

  /* ---- activity log isolation ---- */
  const logB = await call("POST", "/activityLog", { name: "Event B log", status: "Created", timestamp: "August 20, 2026" }, userB.cookie);
  assert("B creates activity log entry → 201", logB.status === 201, String(logB.status));
  const aLog = await (await call("GET", "/activityLog", undefined, userA.cookie)).json();
  assert("A activity log excludes B's entry", !aLog.some((e) => e.name === "Event B log"), JSON.stringify(aLog.map(e => e.name)));

  /* ---- rate limiting: 429 after exhausting the auth limit ---- */
  const mini = express();
  mini.use(express.json());
  mini.use(cookieParser());
  mini.use("/auth", authLimiter, authRouter);
  const miniServer = mini.listen(0);
  await new Promise((resolve) => miniServer.once("listening", resolve));
  const miniBase = `http://127.0.0.1:${miniServer.address().port}/auth`;
  const attempts = 22;
  let lastStatus = 0;
  let got429 = false;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(`${miniBase}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `nobody-${i}@test.dev`, password: "wrong-password-1" })
    });
    lastStatus = res.status;
    if (res.status === 429) got429 = true;
  }
  assert("rate limiter returns 429 after auth attempt burst", got429, `last=${lastStatus}`);
  const ratelimitHeaders = (await fetch(`${miniBase}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nobody@test.dev", password: "wrong-password-1" })
  })).headers;
  assert("rate limiter sets standard rate-limit headers", ratelimitHeaders.get("ratelimit-remaining") !== null || ratelimitHeaders.get("rate-limit-remaining") !== null);
  miniServer.close();

  /* ---- cleanup: remove temporary development test data ---- */
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["sec-a-%@test.dev"]);
  await getPool().query("DELETE FROM users WHERE email LIKE $1", ["sec-b-%@test.dev"]);
  const leftover = (await getPool().query(
    "SELECT (SELECT count(*)::int FROM users WHERE email LIKE 'sec-%@test.dev') AS users"
  )).rows[0];
  assert("no leftover security test users", leftover.users === 0, String(leftover.users));

  server.close();
  await disconnectDatabase();
  console.log(failures === 0 ? "\nALL SECURITY TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
