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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "admin-backup-"));
const cfg = path.join(tmp, "admin.json");
const backupFile = path.join(tmp, "backup.lzb");
const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: process.cwd() });

const init = run("scripts/admin-init.js", ["--username", "boss", "--password", "secret-pass-123", "--config", cfg]);
assert("admin:init exits 0", init.status === 0, init.stderr);

const dbUrl = process.env.DATABASE_URL || "postgres://life_organizer:life_organizer@localhost:5432/life_organizer";
const client = new pg.Client({ connectionString: dbUrl });
let userId = null;

try {
  await client.connect();

  const email = `backuptest-${Date.now()}@example.com`;
  const username = `backup-${Date.now()}`;
  const user = await client.query(
    `INSERT INTO users (name, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    ["Backup Test User", username, email, "hash"]
  );
  userId = user.rows[0].id;

  const args = ["--username", "boss", "--password", "secret-pass-123", "--config", cfg];
  const common = ["--username", "boss", "--password", "secret-pass-123", "--config", cfg];

  const exported = run("scripts/admin-export.js", [...common, "--out", backupFile, "--pass", "s3cret-phrase"]);
  assert("export: exit 0", exported.status === 0, exported.stdout + exported.stderr);
  assert("export: file exists", fs.existsSync(backupFile), backupFile);

  const raw = fs.readFileSync(backupFile, "utf8");
  assert("export: file is encrypted envelope", raw.includes("aes-256-gcm") && raw.includes("salt") && raw.includes("iv"), "not an envelope");
  assert("export: no plaintext data in file", !raw.includes(email) && !raw.includes("Backup Test User"), "plaintext leaked");

  const viewed = run("scripts/admin-view.js", [backupFile, ...args, "--pass", "s3cret-phrase", "--json"]);
  let vdata = null;
  try {
    vdata = JSON.parse(viewed.stdout);
  } catch {
    vdata = null;
  }
  assert("view: exit 0", viewed.status === 0, viewed.stdout + viewed.stderr);
  assert("view: ok true", vdata && vdata.ok === true, viewed.stdout);
  assert("view: tables include users + tasks", vdata && Array.isArray(vdata.tables) && vdata.tables.some((t) => t.name === "users") && vdata.tables.some((t) => t.name === "tasks"), viewed.stdout);
  const usersTable = vdata && vdata.tables.find((t) => t.name === "users");
  assert("view: users table has rows", usersTable && usersTable.rows.length >= 1, viewed.stdout);
  assert("view: seeded user data round-trips", usersTable && usersTable.rows.some((r) => r.username === username), viewed.stdout);
  assert("view: exportedAt present", vdata && typeof vdata.exportedAt === "string", viewed.stdout);

  const tviewed = run("scripts/admin-view.js", [backupFile, ...args, "--pass", "s3cret-phrase", "--table", "users", "--json"]);
  const tdata = (() => {
    try {
      return JSON.parse(tviewed.stdout);
    } catch {
      return null;
    }
  })();
  assert("view --table: exit 0", tviewed.status === 0, tviewed.stdout + tviewed.stderr);
  assert("view --table: correct table selected", tdata && tdata.table === "users" && tdata.rows.some((r) => r.username === username), tviewed.stdout);

  const missingTable = run("scripts/admin-view.js", [backupFile, ...args, "--pass", "s3cret-phrase", "--table", "nope"]);
  assert("view unknown table rejected", missingTable.status === 1, missingTable.stdout + missingTable.stderr);

  const wrongPass = run("scripts/admin-view.js", [backupFile, ...args, "--pass", "wrong-phrase"]);
  assert("view wrong passphrase rejected", wrongPass.status === 1 && /wrong passphrase|decryption failed/i.test(wrongPass.stderr), wrongPass.stderr);

  const tampered = path.join(tmp, "tampered.lzb");
  fs.copyFileSync(backupFile, tampered);
  const env = JSON.parse(fs.readFileSync(tampered, "utf8"));
  env.data = env.data.replace(/^./, (c) => (c === "A" ? "B" : "A"));
  fs.writeFileSync(tampered, JSON.stringify(env));
  const tamperedView = run("scripts/admin-view.js", [tampered, ...args, "--pass", "s3cret-phrase"]);
  assert("view tampered file rejected", tamperedView.status === 1 && /wrong passphrase|corrupted/i.test(tamperedView.stderr), tamperedView.stderr);

  const notBackup = path.join(tmp, "plain.txt");
  fs.writeFileSync(notBackup, "hello");
  const notBackupView = run("scripts/admin-view.js", [notBackup, ...args, "--pass", "s3cret-phrase"]);
  assert("view non-backup file rejected", notBackupView.status === 1 && /not a valid/i.test(notBackupView.stderr), notBackupView.stderr);

  const noFile = run("scripts/admin-view.js", []);
  assert("view without file errors", noFile.status === 1 && /Usage/.test(noFile.stderr), noFile.stderr);
} catch (err) {
  assert("backup test setup", false, err.message);
} finally {
  if (userId) {
    try {
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } catch {
      /* ignore */
    }
  }
  await client.end();
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "\nALL BACKUP TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
