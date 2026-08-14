import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { config } from "../config.js";

const dataDir = path.resolve(process.cwd(), config.embedded.dataDir);
const { user, password, database, port } = config.db;

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: config.embedded.superuser,
    password: config.embedded.superuserPassword,
    port,
    persistent: true
  });

  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    await pg.initialise();
  }

  await pg.start();
  console.log(`[embedded-postgres] listening on 127.0.0.1:${port} (data: ${dataDir})`);

  const admin = pg.getPgClient("postgres");
  await admin.connect();

  const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [user]);
  if (role.rowCount === 0) {
    const escaped = password.replace(/'/g, "''");
    await admin.query(`CREATE ROLE "${user}" WITH LOGIN PASSWORD '${escaped}'`);
    console.log(`[embedded-postgres] created role "${user}"`);
  }

  const db = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (db.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database}" OWNER "${user}"`);
    console.log(`[embedded-postgres] created database "${database}"`);
  }

  await admin.end();
  console.log(`[embedded-postgres] ready → postgres://${user}:***@localhost:${port}/${database}`);
  console.log("[embedded-postgres] run migrations with: npm run db:migrate");

  const shutdown = async (signal) => {
    console.log(`[embedded-postgres] received ${signal}, stopping`);
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[embedded-postgres] failed:", err);
  process.exit(1);
});
