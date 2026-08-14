import pg from "pg";
import { config } from "../server/config.js";

const pool = new pg.Pool({ connectionString: config.db.url });

let failures = 0;
const assert = (name, cond, extra = "") => {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const tables = [
  "users", "tasks", "notes", "calendar_events", "goals", "habits", "meals",
  "grocery_items", "custom_reminders", "activity_log", "settings"
];

async function main() {
  await pool.query("SELECT 1");
  console.log("PASS: database connection");

  const { rows: existing } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const present = new Set(existing.map((r) => r.tablename));
  for (const t of tables) {
    assert(`table created: ${t}`, present.has(t));
  }
  assert("migration tracked in pgmigrations", present.has("pgmigrations"));

  const { rows: migrations } = await pool.query(
    "SELECT name FROM pgmigrations WHERE name LIKE '2026%init-schema%'"
  );
  assert("init-schema migration recorded", migrations.length === 1);

  const { rows: fks } = await pool.query(
    `SELECT tc.table_name
     FROM information_schema.table_constraints tc
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );
  const fkTables = new Set(fks.map((r) => r.table_name));
  for (const t of tables.filter((x) => x !== "users")) {
    assert(`foreign key to users on ${t}`, fkTables.has(t));
  }

  for (const t of tables) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
    assert(`no seeded data in ${t}`, rows[0].n === 0, `found ${rows[0].n} rows`);
  }

  const { rows: dup } = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE contype = 'u' AND conrelid = 'users'::regclass ORDER BY conname
  `);
  const uniqueNames = dup.map((r) => r.conname).join(",");
  assert("users unique constraint present", /users_email_unique/.test(uniqueNames), uniqueNames);

  const { rows: lowerIdx } = await pool.query(
    "SELECT indexdef FROM pg_indexes WHERE indexname = 'users_email_lower_unique'"
  );
  assert(
    "case-insensitive email unique index",
    lowerIdx.length === 1 && /lower\(email\)/.test(lowerIdx[0].indexdef),
    lowerIdx[0]?.indexdef
  );

  const u1 = await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ["Test User", "Alice@Example.com", "hash"]
  );
  const userId = u1.rows[0].id;
  console.log("PASS: insert user");

  try {
    await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      ["Other", "Alice@Example.com", "hash"]
    );
    assert("duplicate email rejected (exact case)", false);
  } catch (err) {
    assert("duplicate email rejected (exact case)", err.code === "23505");
  }

  try {
    await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      ["Other", "alice@example.com", "hash"]
    );
    assert("duplicate email rejected (case-insensitive)", false);
  } catch (err) {
    assert("duplicate email rejected (case-insensitive)", err.code === "23505");
  }

  const task = await pool.query(
    "INSERT INTO tasks (user_id, name, date) VALUES ($1, $2, $3) RETURNING id",
    [userId, "Valid task", "2026-08-14"]
  );
  assert("insert task with valid user_id", task.rowCount === 1);

  try {
    await pool.query(
      "INSERT INTO tasks (user_id, name) VALUES (999999999, 'Orphan task')"
    );
    assert("insert task with missing user_id rejected (FK)", false);
  } catch (err) {
    assert("insert task with missing user_id rejected (FK)", err.code === "23503");
  }

  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  const orphan = await pool.query("SELECT count(*)::int AS n FROM tasks WHERE id = $1", [task.rows[0].id]);
  assert("cascade delete removes user-owned rows", orphan.rows[0].n === 0);

  const { rows: habitDefaults } = await pool.query(
    `SELECT days FROM habits WHERE days = ARRAY[false,false,false,false,false,false,false] LIMIT 0`
  );
  assert("habits schema query ok", Array.isArray(habitDefaults));

  await pool.end();

  if (failures > 0) {
    console.log(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nALL DATABASE TESTS PASSED");
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
