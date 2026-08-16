import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "dotenv/config";
import pg from "pg";

let failures = 0;
const assert = (name, cond, extra = "") => {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "admin-browse-"));
const cfg = path.join(tmp, "admin.json");
const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: process.cwd() });

const init = run("scripts/admin-init.js", ["--username", "boss", "--password", "secret-pass-123", "--config", cfg]);
assert("admin:init exits 0", init.status === 0, init.stderr);

const dbUrl = process.env.DATABASE_URL || "postgres://life_organizer:life_organizer@localhost:5432/life_organizer";
const client = new pg.Client({ connectionString: dbUrl });
const runSql = (sql, params) => client.query(sql, params);

let userId = null;
let taskId = null;
try {
  await client.connect();

  const email = `browsetest-${Date.now()}@example.com`;
  const user = await runSql(
    `INSERT INTO users (name, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    ["Browse Test User", `browse-${Date.now()}`, email, "$2b$10$testhash123456789012345678901234567890123456789012"]
  );
  userId = user.rows[0].id;

  const task = await runSql(
    `INSERT INTO tasks (user_id, name, date, color)
     VALUES ($1, $2, CURRENT_DATE, '#313575') RETURNING id`,
    [userId, `AdminSearchableTask-${Date.now()}`]
  );
  taskId = task.rows[0].id;

  const args = ["--username", "boss", "--password", "secret-pass-123", "--config", cfg];

  const browse = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--search", "AdminSearchableTask"]);
  let data = null;
  try {
    data = JSON.parse(browse.stdout);
  } catch {
    data = null;
  }
  assert("search: exit 0", browse.status === 0, browse.stdout + browse.stderr);
  assert("search: ok true", data && data.ok === true, browse.stdout);
  assert(
    "search: found the seeded task",
    data && data.total === 1 && data.rows.length === 1 && data.rows[0].id === taskId,
    browse.stdout
  );
  assert("search: columns listed", data && Array.isArray(data.columns) && data.columns.includes("name"));
  assert("search: paging metadata present", data && data.page === 1 && data.perPage === 10);

  const filtered = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--filter", `user_id=${userId}`]);
  const fdata = (() => {
    try {
      return JSON.parse(filtered.stdout);
    } catch {
      return null;
    }
  })();
  assert("filter by user_id: exit 0", filtered.status === 0, filtered.stdout + filtered.stderr);
  assert("filter by user_id: at least the seeded task", fdata && fdata.total >= 1 && fdata.rows.every((r) => r.user_id === userId), filtered.stdout);

  const filteredLike = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--filter", `name~AdminSearchable`]);
  const ldata = (() => {
    try {
      return JSON.parse(filteredLike.stdout);
    } catch {
      return null;
    }
  })();
  assert("filter name~text: finds task", ldata && ldata.total === 1 && ldata.rows[0].id === taskId, filteredLike.stdout);

  const badFilter = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--filter", "notacol=1"]);
  assert("unknown filter column rejected", badFilter.status === 1 && badFilter.stdout.includes("No column"), badFilter.stdout);

  const badFilterSyntax = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--filter", "garbage"]);
  assert("invalid filter syntax rejected", badFilterSyntax.status === 1 && badFilterSyntax.stdout.includes("Invalid filter"), badFilterSyntax.stdout);

  const badTable = run("scripts/admin.js", [...args, "--json", "--table", "does_not_exist"]);
  assert("unknown table rejected", badTable.status === 1 && badTable.stdout.includes("Unknown table"), badTable.stdout);

  const sorted = run("scripts/admin.js", [...args, "--json", "--table", "tasks", "--sort", "created_at", "--sort-dir", "desc", "--per-page", "1", "--page", "1"]);
  const sdata = (() => {
    try {
      return JSON.parse(sorted.stdout);
    } catch {
      return null;
    }
  })();
  assert("sort: exit 0 and 1 row per page", sorted.status === 0 && sdata && sdata.rows.length === 1 && sdata.perPage === 1, sorted.stdout);

  const breakdown = run("scripts/admin.js", [...args, "--json", "--breakdown"]);
  const bdata = (() => {
    try {
      return JSON.parse(breakdown.stdout);
    } catch {
      return null;
    }
  })();
  assert("breakdown: exit 0", breakdown.status === 0, breakdown.stdout + breakdown.stderr);
  assert("breakdown: tables include tasks", bdata && Array.isArray(bdata.tables) && bdata.tables.includes("tasks"), breakdown.stdout);
  const userRow = bdata && bdata.users && bdata.users.find((u) => u.id === userId);
  assert("breakdown: test user present", Boolean(userRow), breakdown.stdout);
  assert("breakdown: test user task count is 1", userRow && userRow.tasks === 1, breakdown.stdout);
} catch (err) {
  assert("browse test setup", false, err.message);
} finally {
  if (userId) {
    try {
      await runSql(`DELETE FROM users WHERE id = $1`, [userId]);
    } catch {
      /* ignore */
    }
  }
  if (taskId) {
    try {
      await runSql(`DELETE FROM tasks WHERE id = $1`, [taskId]);
    } catch {
      /* ignore */
    }
  }
  await client.end();
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\nALL BROWSE TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
