import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let failures = 0;
const assert = (name, cond, extra = "") => {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "admin-sql-"));
const cfg = path.join(tmp, "admin.json");
const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: process.cwd() });

const init = run("scripts/admin-init.js", ["--username", "boss", "--password", "secret-pass-123", "--config", cfg]);
assert("admin:init exits 0", init.status === 0, init.stderr);

const args = ["--username", "boss", "--password", "secret-pass-123", "--config", cfg];

const simple = run("scripts/admin.js", [...args, "--json", "--sql-query", "SELECT 1 AS one"]);
let data = null;
try {
  data = JSON.parse(simple.stdout);
} catch {
  data = null;
}
assert("sql-query: exit 0", simple.status === 0, simple.stdout + simple.stderr);
assert("sql-query: result parsed", data && data.ok === true, simple.stdout);
assert("sql-query: row value correct", data && data.rows[0].one === 1, simple.stdout);

const fromUsers = run(
  "scripts/admin.js",
  [...args, "--json", "--sql-query", "SELECT id, email FROM users WHERE email ILIKE '%example%'"]
);
const udata = (() => {
  try {
    return JSON.parse(fromUsers.stdout);
  } catch {
    return null;
  }
})();
assert("sql-query on users: exit 0", fromUsers.status === 0, fromUsers.stdout + fromUsers.stderr);
assert("sql-query on users: returns rows", udata && udata.ok === true && Array.isArray(udata.rows), fromUsers.stdout);

const del = run("scripts/admin.js", [...args, "--json", "--sql-query", "DELETE FROM users"]);
const ddata = (() => {
  try {
    return JSON.parse(del.stdout);
  } catch {
    return null;
  }
})();
assert("DELETE rejected (exit 1)", del.status === 1, del.stdout + del.stderr);
assert("DELETE blocked by read-only transaction", ddata && ddata.ok === false && /read-only/i.test(ddata.error), del.stdout);

const drop = run("scripts/admin.js", [...args, "--json", "--sql-query", "DROP TABLE users"]);
const drdata = (() => {
  try {
    return JSON.parse(drop.stdout);
  } catch {
    return null;
  }
})();
assert("DROP TABLE rejected (exit 1)", drop.status === 1, drop.stdout + drop.stderr);
assert("DROP blocked by read-only transaction", drdata && drdata.ok === false && /read-only/i.test(drdata.error), drop.stdout);

const insert = run("scripts/admin.js", [...args, "--json", "--sql-query", "INSERT INTO users (name,email,password_hash) VALUES ('x','y@z.com','h')"]);
assert("INSERT rejected (exit 1)", insert.status === 1, insert.stdout + insert.stderr);

const repl = spawnSync(
  process.execPath,
  ["scripts/admin.js", ...args, "--sql"],
  { encoding: "utf8", cwd: process.cwd(), input: "SELECT 40 + 2 AS answer\nq\n" }
);
assert("sql repl: exit 0", repl.status === 0, repl.stdout + repl.stderr);
assert("sql repl: executed select and printed result", repl.stdout.includes("answer") && repl.stdout.includes("42"), repl.stdout);

const replBlock = spawnSync(
  process.execPath,
  ["scripts/admin.js", ...args, "--sql"],
  { encoding: "utf8", cwd: process.cwd(), input: "UPDATE users SET name='hacked'\nq\n" }
);
assert("sql repl: write command refused by guard", /read-only statements allowed/i.test(replBlock.stdout), replBlock.stdout);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\nALL SQL TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
