import { parseArgs } from "node:util";
import {
  authenticate,
  promptText,
  connectDatabase,
  listTables,
  listColumns,
  parseFilter,
  runBrowseQuery,
  renderTable,
  getDbUrl,
  dbLabel
} from "./admin-utils.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    config: { type: "string" },
    json: { type: "boolean" },
    table: { type: "string" },
    page: { type: "string" },
    "per-page": { type: "string" },
    search: { type: "string" },
    filter: { type: "string" },
    sort: { type: "string" },
    "sort-dir": { type: "string" },
    breakdown: { type: "boolean" },
    sql: { type: "boolean" },
    "sql-query": { type: "string" },
    "allow-write": { type: "boolean" }
  },
  strict: false
});

const { account } = await authenticate(values);

let client;
try {
  client = await connectDatabase();
} catch (err) {
  console.error(`Could not connect to database (${getDbUrl()}): ${err.message}`);
  process.exit(1);
}

if (!values["allow-write"]) {
  await client.query("SET default_transaction_read_only = on");
}

async function getTableColumns(table) {
  const columns = await listColumns(client, table);
  if (columns.length === 0) {
    throw new Error(`Unknown table "${table}"`);
  }
  return columns;
}

async function userBreakdown() {
  const { rows: userTables } = await client.query(
    `SELECT DISTINCT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'user_id' AND table_name <> 'users'
     ORDER BY table_name`
  );
  const { rows: users } = await client.query(
    `SELECT id, email FROM users ORDER BY id::int`
  );
  const tables = userTables.map((r) => r.table_name);
  const counts = [];
  for (const t of tables) {
    const r = await client.query(`SELECT user_id, count(*)::int AS n FROM "${t}" GROUP BY user_id`);
    counts.push({ table: t, map: new Map(r.rows.map((x) => [String(x.user_id), x.n])) });
  }
  const body = users.map((u) => {
    const rec = { id: u.id, email: u.email };
    for (const c of counts) rec[c.table] = c.map.get(String(u.id)) ?? 0;
    return rec;
  });
  return { users: body, tables };
}

async function browseJson(table) {
  const columns = await getTableColumns(table);
  const page = Number(values.page) || 1;
  const perPage = Number(values["per-page"]) || 10;
  const filter = parseFilter(values.filter);
  if (values.filter && !filter) {
    throw new Error('Invalid filter. Use col=value or col~text.');
  }
  if (filter && !columns.includes(filter.col)) {
    throw new Error(`No column "${filter.col}" in "${table}".`);
  }
  let sort = null;
  if (values.sort) {
    if (!columns.includes(values.sort)) {
      throw new Error(`No column "${values.sort}" in "${table}".`);
    }
    sort = { col: values.sort, dir: values["sort-dir"] === "desc" ? "desc" : "asc" };
  }
  const res = await runBrowseQuery(client, {
    table,
    columns,
    page,
    perPage,
    search: values.search || "",
    filter,
    sort
  });
  return { table, columns, page, perPage, search: values.search || "", filter, sort, ...res };
}

async function browseInteractive(table) {
  let columns;
  try {
    columns = await getTableColumns(table);
  } catch (err) {
    console.log(err.message);
    return "back";
  }
  const state = { table, columns, page: 1, perPage: 10, search: "", filter: null, sort: null };
  while (true) {
    const res = await runBrowseQuery(client, {
      table: state.table,
      columns: state.columns,
      page: state.page,
      perPage: state.perPage,
      search: state.search,
      filter: state.filter,
      sort: state.sort
    });
    const pages = Math.max(1, Math.ceil(res.total / state.perPage));
    state.page = Math.min(state.page, pages);
    console.log(
      `\n${state.table.toUpperCase()} — ${res.total} row${res.total === 1 ? "" : "s"}, ` +
        `page ${state.page}/${pages} (${state.perPage}/page)` +
        `${state.search ? ` [search: ${state.search}]` : ""}` +
        `${state.filter ? ` [filter: ${state.filter.col}${state.filter.op === "like" ? "~" : "="}${state.filter.value}]` : ""}` +
        `${state.sort ? ` [sort: ${state.sort.col} ${state.sort.dir}]` : ""}`
    );
    console.log(renderTable(state.columns, res.rows));
    const cmd = (await promptText(
      "\n[n]ext [p]rev [g]oto [r]ows [s]earch [f]ilter [o]rder [d]etail [x]clear [b]ack [q]uit: "
    ))
      .trim()
      .toLowerCase();
    const [op, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    switch (op) {
      case "n":
        state.page = Math.min(state.page + 1, pages);
        break;
      case "p":
        state.page = Math.max(1, state.page - 1);
        break;
      case "g": {
        const n = parseInt(arg, 10);
        if (Number.isInteger(n) && n >= 1 && n <= pages) state.page = n;
        else console.log("Invalid page.");
        break;
      }
      case "r": {
        const n = parseInt(arg, 10);
        if (Number.isInteger(n) && n >= 1 && n <= 100) {
          state.perPage = n;
          state.page = 1;
        } else {
          console.log("Rows per page must be 1-100.");
        }
        break;
      }
      case "s":
        state.search = arg;
        state.page = 1;
        break;
      case "f": {
        if (!arg) {
          state.filter = null;
          break;
        }
        const f = parseFilter(arg);
        if (!f) {
          console.log("Use f col=value or f col~text.");
          break;
        }
        if (!state.columns.includes(f.col)) {
          console.log(`No column "${f.col}" in "${state.table}".`);
          break;
        }
        state.filter = f;
        state.page = 1;
        break;
      }
      case "o": {
        if (!arg) {
          state.sort = null;
          break;
        }
        const m = arg.match(/^(\S+)(\s+desc)?$/i);
        if (!m) {
          console.log("Use o col or o col desc.");
          break;
        }
        if (!state.columns.includes(m[1])) {
          console.log(`No column "${m[1]}" in "${state.table}".`);
          break;
        }
        state.sort = { col: m[1], dir: m[2] ? "desc" : "asc" };
        state.page = 1;
        break;
      }
      case "d": {
        const n = parseInt(arg, 10);
        const row = res.rows[n - 1];
        if (!row) {
          console.log("No such row on this page.");
          break;
        }
        console.log(JSON.stringify(row, null, 2));
        break;
      }
      case "x":
        state.search = "";
        state.filter = null;
        state.sort = null;
        state.page = 1;
        break;
      case "b":
        return "back";
      case "q":
        return "quit";
      default:
        console.log("Unknown command.");
    }
  }
}

const READONLY_HEADS = new Set([
  "select",
  "explain",
  "show",
  "with",
  "values",
  "table",
  "prepare",
  "execute",
  "deallocate"
]);

async function sqlRepl() {
  console.log("\nSQL MODE — read-only enforced (SELECT/EXPLAIN/SHOW/... only)");
  console.log("type a SQL statement, or q to return");
  while (true) {
    const stmt = (await promptText("sql> ")).trim();
    if (!stmt || stmt === "q") return;
    const head = stmt.split(/[\s;]+/)[0].toLowerCase();
    if (!READONLY_HEADS.has(head)) {
      console.log("Only read-only statements allowed (SELECT/EXPLAIN/SHOW/...).");
      continue;
    }
    try {
      const { rows } = await client.query(stmt);
      if (rows.length > 0) {
        console.log(renderTable(Object.keys(rows[0]), rows));
        console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
      } else {
        console.log("OK");
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

if (values.json) {
  try {
    if (values["sql-query"]) {
      const { rows, command } = await client.query(values["sql-query"]);
      console.log(JSON.stringify({ ok: true, command, rowCount: rows.length, rows }, null, 2));
    } else if (values.breakdown) {
      const data = await userBreakdown();
      console.log(JSON.stringify({ ok: true, ...data }, null, 2));
    } else if (values.table) {
      const data = await browseJson(values.table);
      console.log(JSON.stringify({ ok: true, ...data }, null, 2));
    } else {
      const tables = await listTables(client);
      console.log(JSON.stringify({ ok: true, username: account.username, tables }, null, 2));
    }
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  }
  await client.end();
  process.exit(process.exitCode || 0);
}

if (values.sql) {
  await sqlRepl();
  await client.end();
  console.log("Goodbye.");
  process.exit(0);
}

console.log(`\nAuthenticated as ${account.username} (Admin)`);
console.log(`Connected to ${dbLabel(getDbUrl())}\n`);

let running = true;
while (running) {
  const tables = await listTables(client);
  console.log("ADMIN CONSOLE");
  console.log("=".repeat(60));
  tables.forEach((t, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${t.name.padEnd(22)} ${t.rows} rows`);
  });
  console.log(`  b. Per-user breakdown`);
  console.log(`  s. SQL mode (read-only)`);
  console.log("  q. Quit");

  const choice = (await promptText("\nSelect table / command: ")).trim().toLowerCase();

  if (choice === "q") {
    running = false;
    continue;
  }
  if (choice === "s") {
    await sqlRepl();
    continue;
  }
  if (choice === "b" || choice === "p" || choice === "breakdown") {
    const data = await userBreakdown();
    console.log(`\nPer-user breakdown (${data.tables.length} data tables)`);
    console.log(renderTable(["id", "email", ...data.tables], data.users));
    continue;
  }

  const index = parseInt(choice, 10) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= tables.length) {
    const match = tables.find((t) => t.name === choice);
    if (!match) {
      console.log("Invalid choice.");
      continue;
    }
    const action = await browseInteractive(match.name);
    if (action === "quit") running = false;
    continue;
  }
  const action = await browseInteractive(tables[index].name);
  if (action === "quit") running = false;
}

await client.end();
console.log("Goodbye.");
