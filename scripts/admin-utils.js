import "dotenv/config";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import pg from "pg";

let rl = null;
const lineQueue = [];
let lineWaiter = null;

function getRL() {
  if (!rl) {
    rl = readline.createInterface({ input, output });
    rl.on("line", (line) => {
      if (lineWaiter) {
        const waiter = lineWaiter;
        lineWaiter = null;
        waiter(line);
      } else {
        lineQueue.push(line);
      }
    });
  }
  return rl;
}

function nextLine() {
  if (lineQueue.length > 0) {
    return Promise.resolve(lineQueue.shift());
  }
  return new Promise((resolve) => {
    lineWaiter = resolve;
  });
}

export async function promptText(question) {
  const r = getRL();
  r._writeToOutput(question);
  const answer = await nextLine();
  return answer.trim();
}

export async function promptHidden(question) {
  const r = getRL();
  const original = r._writeToOutput.bind(r);
  original(question);
  r._writeToOutput = () => {};
  const answer = await nextLine();
  r._writeToOutput = original;
  output.write("\n");
  return answer;
}

export function configPath(override) {
  if (override) return override;
  if (process.env.ADMIN_CONFIG_PATH) return process.env.ADMIN_CONFIG_PATH;
  return path.join(os.homedir(), ".config", "life-organizer", "admin.json");
}

export function loadConfig(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function saveConfig(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

export function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.DB_USER || "life_organizer";
  const password = process.env.DB_PASSWORD || "life_organizer";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "life_organizer";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function dbLabel(url) {
  try {
    const u = new URL(url);
    return `${decodeURIComponent(u.username)}@${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "unknown";
  }
}

export async function connectDatabase() {
  const client = new pg.Client({ connectionString: getDbUrl() });
  await client.connect();
  return client;
}

export async function enforceReadOnly(client) {
  await client.query("SET default_transaction_read_only = on");
}

export async function authenticate(values = {}) {
  const file = configPath(values.config);
  const account = loadConfig(file);
  if (!account) {
    console.error("No admin account found. Run: npm run admin:init");
    process.exit(1);
  }
  const username = values.username ?? (await promptText("Username: "));
  const password = values.password ?? (await promptHidden("Password: "));
  if (username !== account.username || !(await bcrypt.compare(password, account.passwordHash))) {
    if (values.json) {
      console.log(JSON.stringify({ ok: false, error: "Invalid credentials" }));
    } else {
      console.error("Authentication failed. Access denied.");
    }
    process.exit(1);
  }
  return { file, account };
}

export async function listTables(client) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  const tables = [];
  for (const r of rows) {
    const count = await client.query(`SELECT count(*)::int AS n FROM "${r.table_name}"`);
    tables.push({ name: r.table_name, rows: count.rows[0].n });
  }
  return tables;
}

export async function listColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

export function escapeLike(value) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function parseFilter(text) {
  const str = String(text || "").trim();
  if (!str) return null;
  const m = str.match(/^(.+?)(=|~)(.*)$/);
  if (!m) return null;
  return { col: m[1], op: m[2] === "~" ? "like" : "eq", value: m[3] };
}

export async function runBrowseQuery(client, opts) {
  const { table, columns, page, perPage, search, filter, sort } = opts;
  const where = [];
  const params = [];
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const idx = params.length;
    where.push(`(${columns.map((c) => `"${c}"::text ILIKE $${idx}`).join(" OR ")})`);
  }
  if (filter && filter.col) {
    const idx = params.length + 1;
    if (filter.op === "like") {
      params.push(`%${escapeLike(filter.value)}%`);
      where.push(`"${filter.col}"::text ILIKE $${idx}`);
    } else {
      params.push(filter.value);
      where.push(`"${filter.col}"::text = $${idx}`);
    }
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const count = await client.query(`SELECT count(*)::int AS n FROM "${table}"${whereSql}`, params);
  const total = count.rows[0].n;
  const order = sort && sort.col ? ` ORDER BY "${sort.col}" ${sort.dir === "desc" ? "DESC" : "ASC"}` : "";
  const limit = perPage;
  const offset = (page - 1) * perPage;
  const { rows } = await client.query(
    `SELECT * FROM "${table}"${whereSql}${order} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return { total, rows };
}

export function renderTable(columns, rows, { maxWidth = 110, cellCap = 22 } = {}) {
  if (rows.length === 0) return "(no rows)";
  const asStr = (r, c) =>
    String(r[c] === null || r[c] === undefined ? "" : r[c]).replace(/\s+/g, " ");
  const widths = columns.map((c) => {
    const w = Math.max(c.length, ...rows.map((r) => asStr(r, c).length));
    return Math.min(w, cellCap);
  });
  let total = widths.reduce((a, b) => a + b, 0) + 3 * (columns.length - 1);
  while (total > maxWidth) {
    const i = widths.indexOf(Math.max(...widths));
    if (widths[i] <= 4) break;
    widths[i] -= 1;
    total -= 1;
  }
  const fit = (s, w) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w));
  const header = columns.map((c, i) => fit(c, widths[i])).join(" | ");
  const sep = "-".repeat(header.length);
  const body = rows.map((r) => columns.map((c, i) => fit(asStr(r, c), widths[i])).join(" | "));
  return [header, sep, ...body].join("\n");
}
