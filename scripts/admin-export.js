import { parseArgs } from "node:util";
import path from "node:path";
import {
  authenticate,
  promptHidden,
  connectDatabase,
  listTables,
  getDbUrl,
  dbLabel
} from "./admin-utils.js";
import { encryptBackup } from "./admin-backup.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    config: { type: "string" },
    json: { type: "boolean" },
    out: { type: "string" },
    pass: { type: "string" }
  },
  strict: false
});

const { account } = await authenticate(values);

const passphrase = values.pass ?? process.env.ADMIN_BACKUP_PASS ?? (await promptHidden("Encryption passphrase: "));
if (!passphrase) {
  console.error("A passphrase is required.");
  process.exit(1);
}

let client;
try {
  client = await connectDatabase();
} catch (err) {
  console.error(`Could not connect to database (${getDbUrl()}): ${err.message}`);
  process.exit(1);
}

const tables = await listTables(client);
const data = {
  exportedAt: new Date().toISOString(),
  db: dbLabel(getDbUrl()),
  tables: []
};
for (const t of tables) {
  const { rows } = await client.query(`SELECT * FROM "${t.name}"`);
  data.tables.push({
    name: t.name,
    columns: rows.length ? Object.keys(rows[0]) : [],
    rows
  });
}

const outFile =
  values.out ||
  path.join(process.cwd(), `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.lzb`);
encryptBackup(data, passphrase, outFile);

const summary = data.tables.map((t) => ({ name: t.name, rows: t.rows.length }));
const totalRows = summary.reduce((a, t) => a + t.rows, 0);

if (values.json) {
  console.log(JSON.stringify({ ok: true, file: outFile, db: data.db, tables: summary }, null, 2));
} else {
  console.log(`Encrypted backup written to ${outFile}`);
  console.log(`  ${summary.length} tables, ${totalRows} rows, AES-256-GCM (admin: ${account.username})`);
}

await client.end();
