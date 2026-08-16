#!/usr/bin/env node
/**
 * Promote (or demote) a user to/from the admin role for the web admin panel.
 *
 * Usage:
 *   node scripts/promote-admin.mjs <username>         # make admin
 *   node scripts/promote-admin.mjs <username> --demote # make regular user
 *   node scripts/promote-admin.mjs --list             # list users + roles
 *
 * Reads the same DATABASE_URL / DB_* environment as the server (.env).
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const buildDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.DB_USER || "life_organizer";
  const password = process.env.DB_PASSWORD || "life_organizer";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "life_organizer";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const pool = new Pool({ connectionString: buildDatabaseUrl() });

const args = process.argv.slice(2);
const username = args.find(a => !a.startsWith("--"));
const demote = args.includes("--demote");
const list = args.includes("--list");

try {
  if (list) {
    const { rows } = await pool.query("SELECT id, username, name, role, created_at FROM users ORDER BY id");
    for (const row of rows) {
      console.log(`${row.id}\t${row.role.padEnd(5)}\t${row.username}\t${row.name}`);
    }
    console.log(`${rows.length} user(s)`);
    process.exit(0);
  }

  if (!username) {
    console.error("Usage: node scripts/promote-admin.mjs <username> [--demote] [--list]");
    process.exit(1);
  }

  const targetRole = demote ? "user" : "admin";
  const { rows } = await pool.query(
    "UPDATE users SET role = $2, updated_at = now() WHERE lower(username) = lower($1) RETURNING id, name, username, role",
    [username, targetRole]
  );
  if (rows.length === 0) {
    console.error(`No user found with username "${username}"`);
    process.exit(1);
  }
  console.log(`${rows[0].name} (@${rows[0].username}) is now ${rows[0].role}`);
  if (!demote) {
    console.log("Sign in (or refresh) the web app — the Admin panel appears in the sidebar.");
  }
} finally {
  await pool.end();
}