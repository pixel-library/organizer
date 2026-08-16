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
  const adminName = `adminapi-admin-${suffix}`;
  const userName = `adminapi-user-${suffix}`;
  const victimName = `adminapi-victim-${suffix}`;
  const password = "correct-horse-battery-staple";

  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["adminapi-%"]);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api`;

  const call = (method, path, body, cookie) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

  const register = async (name, username) => {
    const res = await call("POST", "/auth/register", { name, username, password });
    return { res, cookie: cookieFrom(res), body: await res.json() };
  };

  const [admin, normal, victim] = await Promise.all([
    register("Admin API Boss", adminName),
    register("Normal User", userName),
    register("Victim User", victimName)
  ]);
  assert("register admin/user/victim → 201", admin.res.status === 201 && normal.res.status === 201 && victim.res.status === 201,
    `${admin.res.status} ${normal.res.status} ${victim.res.status}`);

  /* promote the boss via direct SQL (role column exists) */
  await getPool().query("UPDATE users SET role = 'admin' WHERE username = $1", [adminName]);

  /* ---- authz gates ---- */
  const anon = await call("GET", "/admin/stats");
  assert("anonymous → 401", anon.status === 401, String(anon.status));
  const forbidden = await call("GET", "/admin/stats", undefined, normal.cookie);
  assert("non-admin → 403", forbidden.status === 403, String(forbidden.status));

  /* ---- stats ---- */
  const stats = await call("GET", "/admin/stats", undefined, admin.cookie);
  assert("stats → 200", stats.status === 200, String(stats.status));
  const statsBody = await stats.json();
  assert("stats shape (users/sessions/tables/db)", statsBody.users && statsBody.sessions && Array.isArray(statsBody.tables) && statsBody.db?.connected === true);
  assert("stats users count >= 3", statsBody.users.total >= 3, String(statsBody.users.total));
  assert("stats admins >= 1", statsBody.users.admins >= 1, String(statsBody.users.admins));
  assert("stats tables include users + tasks", statsBody.tables.some(t => t.name === "users") && statsBody.tables.some(t => t.name === "tasks"));

  /* ---- users list ---- */
  const users = await call("GET", "/admin/users?perPage=50", undefined, admin.cookie);
  assert("users list → 200", users.status === 200, String(users.status));
  const usersBody = await users.json();
  assert("users list shape", Array.isArray(usersBody.rows) && usersBody.total >= 3);
  const adminRow = usersBody.rows.find(u => u.username === adminName);
  assert("users list has role field", adminRow && adminRow.role === "admin", JSON.stringify(adminRow));
  assert("users list never leaks password_hash", usersBody.rows.every(u => !("password_hash" in u)));

  const searched = await call("GET", `/admin/users?search=${encodeURIComponent(userName)}`, undefined, admin.cookie);
  const searchedBody = await searched.json();
  assert("users search by username", searchedBody.rows.length === 1 && searchedBody.rows[0].username === userName, JSON.stringify(searchedBody.rows));

  const sorted = await call("GET", "/admin/users?sort=username&dir=asc", undefined, admin.cookie);
  const sortedBody = await sorted.json();
  const names = sortedBody.rows.map(u => u.username);
  assert("users sort by username asc", names.every((n, i) => i === 0 || names[i - 1].toLowerCase() <= n.toLowerCase()), names.join(","));

  const badSort = await call("GET", "/admin/users?sort=email", undefined, admin.cookie);
  assert("sort=email falls back to created_at (no 500)", badSort.status === 200, String(badSort.status));

  const page2 = await call("GET", "/admin/users?page=2&perPage=2", undefined, admin.cookie);
  assert("users paging works", page2.status === 200);

  /* ---- single user ---- */
  const one = await call("GET", `/admin/users/${admin.body.id}`, undefined, admin.cookie);
  assert("user detail → 200", one.status === 200, String(one.status));
  const oneBody = await one.json();
  assert("user detail has rowCounts + activeSessions", oneBody.rowCounts && typeof oneBody.activeSessions === "number", JSON.stringify(oneBody));
  const missing = await call("GET", "/admin/users/99999999", undefined, admin.cookie);
  assert("unknown user → 404", missing.status === 404, String(missing.status));

  /* ---- role changes ---- */
  const promote = await call("PATCH", `/admin/users/${normal.body.id}/role`, { role: "admin" }, admin.cookie);
  assert("promote user → 200 + role admin", promote.status === 200 && (await promote.json()).role === "admin", String(promote.status));
  const demote = await call("PATCH", `/admin/users/${normal.body.id}/role`, { role: "user" }, admin.cookie);
  assert("demote user → 200 + role user", demote.status === 200 && (await demote.json()).role === "user", String(demote.status));
  const selfDemote = await call("PATCH", `/admin/users/${admin.body.id}/role`, { role: "user" }, admin.cookie);
  assert("self-demote blocked → 400", selfDemote.status === 400, String(selfDemote.status));
  const badRole = await call("PATCH", `/admin/users/${normal.body.id}/role`, { role: "superuser" }, admin.cookie);
  assert("invalid role → 400", badRole.status === 400, String(badRole.status));

  /* ---- delete user ---- */
  const deleted = await call("DELETE", `/admin/users/${victim.body.id}`, undefined, admin.cookie);
  assert("delete user → 200 ok", deleted.status === 200 && (await deleted.json()).ok === true, String(deleted.status));
  const gone = await call("GET", `/admin/users/${victim.body.id}`, undefined, admin.cookie);
  assert("deleted user gone → 404", gone.status === 404, String(gone.status));
  const selfDelete = await call("DELETE", `/admin/users/${admin.body.id}`, undefined, admin.cookie);
  assert("self-delete blocked → 400", selfDelete.status === 400, String(selfDelete.status));

  /* ---- sessions ---- */
  const sessions = await call("GET", "/admin/sessions", undefined, admin.cookie);
  assert("sessions list → 200", sessions.status === 200, String(sessions.status));
  const sessionsBody = await sessions.json();
  assert("sessions list has our sessions", sessionsBody.total >= 2, String(sessionsBody.total));

  const normalSession = sessionsBody.rows.find(s => s.username === userName);
  const revoke2 = await call("POST", `/admin/sessions/${normalSession?.id}/revoke`, {}, admin.cookie);
  assert("revoke session → 200 ok", normalSession && revoke2.status === 200 && (await revoke2.json()).ok === true, `${normalSession?.id} → ${revoke2.status}`);
  const revokeAgain = await call("POST", `/admin/sessions/${normalSession?.id}/revoke`, {}, admin.cookie);
  assert("revoke missing session → 404", revokeAgain.status === 404, String(revokeAgain.status));

  /* fresh session for the normal user for the remaining tests */
  const secondLogin = await call("POST", "/auth/login", { username: userName, password });
  assert("normal user can log in again (fresh session)", secondLogin.status === 200, String(secondLogin.status));
  normal.cookie = cookieFrom(secondLogin);

  /* ---- activity ---- */
  const taskRes = await call("POST", "/tasks", { name: "Admin API Task", date: "2026-08-16", priority: "Yellow", reminder: "none", type: "Personal" }, normal.cookie);
  assert("seed task for data browser", taskRes.status === 201, String(taskRes.status));
  const seedLog = await call("POST", "/activityLog", { name: "Admin API Task", status: "Created", timestamp: "August 16, 2026" }, normal.cookie);
  assert("seed activity via activityLog", seedLog.status === 201, String(seedLog.status));
  const activity = await call("GET", "/admin/activity", undefined, admin.cookie);
  assert("activity list → 200", activity.status === 200, String(activity.status));
  const activityBody = await activity.json();
  assert("activity includes seeded event", activityBody.rows.some(a => a.name === "Admin API Task" && a.user_username === userName), JSON.stringify(activityBody.rows[0]));
  const activitySearch = await call("GET", `/admin/activity?search=${encodeURIComponent(userName)}`, undefined, admin.cookie);
  const activitySearchBody = await activitySearch.json();
  assert("activity search by username", activitySearchBody.rows.every(a => a.user_username === userName));

  /* ---- data browser ---- */
  const data = await call("GET", "/admin/data/tasks", undefined, admin.cookie);
  assert("data browse → 200", data.status === 200, String(data.status));
  const dataBody = await data.json();
  assert("data browse shape", dataBody.table === "tasks" && Array.isArray(dataBody.columns) && Array.isArray(dataBody.rows));
  const filtered = await call("GET", `/admin/data/tasks?filter=name~Admin`, undefined, admin.cookie);
  const filteredBody = await filtered.json();
  assert("data filter col~text", filteredBody.rows.length >= 1 && filteredBody.rows.some(r => r.name === "Admin API Task"), JSON.stringify(filteredBody.rows));
  const badFilter = await call("GET", "/admin/data/tasks?filter=notacol=1", undefined, admin.cookie);
  assert("data bad filter → 400", badFilter.status === 400, String(badFilter.status));
  const badSort2 = await call("GET", "/admin/data/tasks?sort=notacol", undefined, admin.cookie);
  assert("data bad sort → 400", badSort2.status === 400, String(badSort2.status));
  const unknownTable = await call("GET", "/admin/data/nope", undefined, admin.cookie);
  assert("data unknown table → 404", unknownTable.status === 404, String(unknownTable.status));

  /* ---- export ---- */
  const exported = await call("GET", "/admin/export", undefined, admin.cookie);
  assert("export → 200", exported.status === 200, String(exported.status));
  const dump = await exported.json();
  assert("export has tables + users", Array.isArray(dump.tables) && dump.tables.find(t => t.name === "users")?.rows.length >= 2);

  /* ---- backup (encrypted) ---- */
  const shortPass = await call("POST", "/admin/backup", { passphrase: "short" }, admin.cookie);
  assert("backup short passphrase → 400", shortPass.status === 400, String(shortPass.status));
  const backup = await call("POST", "/admin/backup", { passphrase: "s3cret-phrase" }, admin.cookie);
  assert("backup → 200", backup.status === 200, String(backup.status));
  const envelope = await backup.text();
  assert("backup is encrypted envelope", envelope.includes("aes-256-gcm") && envelope.includes("salt") && envelope.includes("iv"), "not an envelope");
  assert("backup contains no plaintext usernames", !envelope.includes(adminName), "plaintext leaked");

  /* ---- restore ---- */
  const badRestore = await call("POST", "/admin/restore", { data: JSON.stringify({ tables: [] }) }, admin.cookie);
  assert("restore empty tables → 400", badRestore.status === 400, String(badRestore.status));
  const badRestoreShape = await call("POST", "/admin/restore", { data: JSON.stringify({ tables: [{ name: "nope", rows: [] }] }) }, admin.cookie);
  assert("restore unknown table → 400", badRestoreShape.status === 400, String(badRestoreShape.status));

  const restore = await call("POST", "/admin/restore", { data: JSON.stringify(dump) }, admin.cookie);
  assert("restore JSON dump → 200 ok", restore.status === 200, String(restore.status));
  const restoreBody = await restore.json();
  assert("restore reports tables restored", restoreBody.ok === true && Array.isArray(restoreBody.restored) && restoreBody.restored.length > 0, JSON.stringify(restoreBody));
  const afterRestore = await call("GET", "/admin/stats", undefined, admin.cookie);
  assert("admin session survives restore", afterRestore.status === 200, String(afterRestore.status));
  const usersAfter = await call("GET", "/admin/users?perPage=50", undefined, admin.cookie);
  const usersAfterBody = await usersAfter.json();
  assert("users restored", usersAfterBody.rows.some(u => u.username === adminName) && usersAfterBody.rows.some(u => u.username === userName));

  /* encrypted restore round-trip */
  const encRestore = await call("POST", "/admin/restore", {
    file: Buffer.from(envelope, "utf8").toString("base64"),
    passphrase: "s3cret-phrase"
  }, admin.cookie);
  assert("encrypted restore → 200 ok", encRestore.status === 200 && (await encRestore.json()).ok === true, String(encRestore.status));
  const encBad = await call("POST", "/admin/restore", {
    file: Buffer.from(envelope, "utf8").toString("base64"),
    passphrase: "wrong-phrase"
  }, admin.cookie);
  assert("encrypted restore wrong passphrase → 400", encBad.status === 400, String(encBad.status));

  /* cleanup */
  await getPool().query("DELETE FROM users WHERE username LIKE $1", ["adminapi-%"]);
  const leftoverUsers = (await getPool().query("SELECT count(*)::int AS n FROM users WHERE username LIKE 'adminapi-%'")).rows[0].n;
  const leftoverActivity = (await getPool().query("SELECT count(*)::int AS n FROM activity_log WHERE name = 'Admin API Task'")).rows[0].n;
  assert("no leftover test users", leftoverUsers === 0, String(leftoverUsers));
  assert("no leftover seeded activity", leftoverActivity === 0, String(leftoverActivity));

  server.close();
  await disconnectDatabase();
  console.log(failures === 0 ? "\nALL ADMIN API TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});