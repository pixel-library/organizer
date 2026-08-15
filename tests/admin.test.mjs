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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
const cfg = path.join(tmp, "admin.json");
const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: process.cwd() });

const init = run("scripts/admin-init.js", ["--username", "boss", "--password", "secret-pass-123", "--config", cfg]);
assert("admin:init exits 0", init.status === 0, init.stderr);

const exists = fs.existsSync(cfg);
assert("config file created", exists);
if (exists) {
  const raw = fs.readFileSync(cfg, "utf8");
  const data = JSON.parse(raw);
  assert("config stores username", data.username === "boss");
  assert("config stores bcrypt hash, not plaintext", Boolean(data.passwordHash) && !raw.includes("secret-pass-123"));
  assert("hash starts with bcrypt marker", data.passwordHash.startsWith("$2"));
  const mode = (fs.statSync(cfg).mode & 0o777).toString(8);
  assert("config file mode 600", mode === "600", mode);
}

const good = run("scripts/admin.js", ["--username", "boss", "--password", "secret-pass-123", "--config", cfg, "--json"]);
assert("console auth ok (exit 0)", good.status === 0, good.stderr);

let parsed = null;
try {
  parsed = JSON.parse(good.stdout);
} catch {
  parsed = null;
}
assert("json output parsed", Boolean(parsed));
assert("authenticated flag true", parsed && parsed.ok === true);
assert(
  "tables listed with counts (users present)",
  parsed && Array.isArray(parsed.tables) && parsed.tables.some((t) => t.name === "users"),
  parsed && JSON.stringify(parsed.tables)
);
assert(
  "row counts are numbers",
  parsed && Array.isArray(parsed.tables) && parsed.tables.every((t) => typeof t.rows === "number"),
  "non-numeric count found"
);

const bad = run("scripts/admin.js", ["--username", "boss", "--password", "wrong-password-1", "--config", cfg, "--json"]);
assert("wrong password rejected (exit 1)", bad.status === 1, bad.stdout + bad.stderr);
assert("wrong password returns invalid-credentials json", bad.stdout.includes("Invalid credentials"), bad.stdout);

const wrongUser = run("scripts/admin.js", ["--username", "nope", "--password", "secret-pass-123", "--config", cfg, "--json"]);
assert("wrong username rejected (exit 1)", wrongUser.status === 1, wrongUser.stdout + wrongUser.stderr);

const noAccount = run("scripts/admin.js", ["--username", "boss", "--password", "secret-pass-123", "--config", path.join(tmp, "missing.json"), "--json"]);
assert("no account → error exit", noAccount.status === 1 && noAccount.stderr.includes("admin:init"), noAccount.stderr);

const reinit = run("scripts/admin-init.js", ["--username", "boss2", "--password", "secret-pass-456", "--config", cfg]);
assert("admin:init refuses to overwrite existing account", reinit.status === 1, reinit.stderr);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\nALL ADMIN TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
