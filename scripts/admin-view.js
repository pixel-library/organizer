import { parseArgs } from "node:util";
import fs from "node:fs";
import { authenticate, promptHidden, renderTable } from "./admin-utils.js";
import { decryptBackup } from "./admin-backup.js";

const { values, positionals } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    config: { type: "string" },
    json: { type: "boolean" },
    pass: { type: "string" },
    table: { type: "string" }
  },
  allowPositionals: true,
  strict: false
});

const file = positionals[0];
if (!file) {
  console.error("Usage: node scripts/admin-view.js <backup.lzb> [--table <name>] [--json] [--pass <p>]");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const { account } = await authenticate(values);
const passphrase = values.pass ?? process.env.ADMIN_BACKUP_PASS ?? (await promptHidden("Decryption passphrase: "));

let data;
try {
  data = decryptBackup(file, passphrase);
} catch (err) {
  console.error(`Decryption failed: ${err.message}`);
  process.exit(1);
}

if (values.table) {
  const t = data.tables.find((x) => x.name === values.table);
  if (!t) {
    console.error(`Backup has no table "${values.table}".`);
    process.exit(1);
  }
  if (values.json) {
    console.log(JSON.stringify({ ok: true, table: t.name, columns: t.columns, rows: t.rows }, null, 2));
  } else {
    console.log(`${t.name.toUpperCase()} — ${t.rows.length} rows`);
    console.log(renderTable(t.columns, t.rows));
  }
  process.exit(0);
}

if (values.json) {
  console.log(JSON.stringify({ ok: true, exportedAt: data.exportedAt, db: data.db, tables: data.tables }, null, 2));
} else {
  console.log(`Backup from ${data.exportedAt} (${data.db}) — viewed by ${account.username}`);
  console.log(renderTable(
    ["table", "rows"],
    data.tables.map((t) => ({ table: t.name, rows: String(t.rows.length) }))
  ));
}
