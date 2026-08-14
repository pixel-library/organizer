import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

let pool = null;
let connected = false;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.db.url });
    pool.on("error", (err) => {
      console.error("[life-organizer-api] idle client error:", err.message);
    });
  }
  return pool;
}

export async function connectDatabase() {
  const p = getPool();
  try {
    await p.query("SELECT 1");
    connected = true;
    console.log(`[life-organizer-api] database connected (${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database})`);
  } catch (err) {
    connected = false;
    console.warn(
      `[life-organizer-api] database not reachable (${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}): ${err.message}`
    );
  }
  return p;
}

export function getDatabaseStatus() {
  return { configured: true, connected, provider: "postgres" };
}

export async function disconnectDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    connected = false;
  }
}
