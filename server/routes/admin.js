import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { getPool } from "../db.js";
import { adminGuard } from "../middleware/adminAuth.js";
import { encryptBackup, decryptBackup } from "../utils/backup.js";

const router = Router();
router.use(adminGuard);

const USER_TABLES = [
  "tasks", "notes", "calendar_events", "goals", "habits", "meals",
  "grocery_items", "custom_reminders", "activity_log"
];

const ALL_TABLES = ["users", "sessions", ...USER_TABLES, "settings"];

const TABLE_SET = new Set(ALL_TABLES);

const parsePaging = (query, maxPerPage = 100) => {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(maxPerPage, Math.max(1, Number(query.perPage) || 25));
  return { page, perPage, offset: (page - 1) * perPage };
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);

const serializeRow = (row) => {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = value.toISOString();
    else if (Buffer.isBuffer(value)) out[key] = value.toString("base64");
    else out[key] = value;
  }
  return out;
};

const COUNT_USER_TABLES_SQL = USER_TABLES
  .map(t => `(SELECT count(*) FROM ${t} WHERE user_id = $1) AS ${t}_count`)
  .join(", ");

router.get("/stats", async (_req, res, next) => {
  try {
    const pool = getPool();
    const [userStats, sessionStats, tableRows] = await Promise.all([
      pool.query(`SELECT
        (SELECT count(*) FROM users) AS total,
        (SELECT count(*) FROM users WHERE role = 'admin') AS admins,
        (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days') AS new_last_7d`),
      pool.query(`SELECT
        (SELECT count(*) FROM sessions) AS total,
        (SELECT count(*) FROM sessions WHERE expires_at > now() AND revoked_at IS NULL) AS active,
        (SELECT count(*) FROM sessions WHERE expires_at <= now()) AS expired`),
      Promise.all(ALL_TABLES.map(t => pool.query(`SELECT count(*)::int AS n FROM ${t}`).then(r => ({ name: t, rows: r.rows[0].n }))))
    ]);

    res.json({
      users: userStats.rows[0],
      sessions: sessionStats.rows[0],
      tables: tableRows,
      db: { connected: true }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const { page, perPage, offset } = parsePaging(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const sort = req.query.sort === "name" || req.query.sort === "role" || req.query.sort === "username"
      ? req.query.sort
      : "created_at";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";

    const conditions = [];
    const params = [];
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await getPool().query(`SELECT count(*)::int AS n FROM users u ${where}`, params);
    const listRes = await getPool().query(
      `SELECT u.id, u.name, u.username, u.role, u.created_at, u.updated_at,
              (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())::int AS active_sessions,
              (SELECT max(s.last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at
       FROM users u ${where}
       ORDER BY ${sort} ${dir}, u.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );

    res.json({
      page, perPage, total: countRes.rows[0].n,
      rows: listRes.rows.map(serializeRow)
    });
  } catch (err) {
    next(err);
  }
});

router.get("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError("Invalid user id", 400);

    const userRes = await getPool().query(
      "SELECT id, name, username, role, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
    if (userRes.rows.length === 0) throw new AppError("User not found", 404);

    const [counts, sessionCount] = await Promise.all([
      getPool().query(`SELECT ${COUNT_USER_TABLES_SQL}`, [id]),
      getPool().query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()", [id])
    ]);

    const rowCounts = {};
    for (const t of USER_TABLES) rowCounts[t] = counts.rows[0][`${t}_count`];

    res.json({ ...serializeRow(userRes.rows[0]), rowCounts, activeSessions: sessionCount.rows[0].n });
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError("Invalid user id", 400);
    const role = req.body?.role;
    if (role !== "user" && role !== "admin") throw new AppError("role must be 'user' or 'admin'", 400);

    if (id === Number(req.user.id) && role !== "admin") {
      throw new AppError("You cannot demote your own account", 400);
    }

    const { rows } = await getPool().query(
      "UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING id, name, username, role, created_at, updated_at",
      [id, role]
    );
    if (rows.length === 0) throw new AppError("User not found", 404);
    res.json(serializeRow(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError("Invalid user id", 400);
    if (id === Number(req.user.id)) throw new AppError("You cannot delete your own account", 400);

    const { rows } = await getPool().query("DELETE FROM users WHERE id = $1 RETURNING id, name, username", [id]);
    if (rows.length === 0) throw new AppError("User not found", 404);
    res.json({ ok: true, deleted: serializeRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.get("/sessions", async (req, res, next) => {
  try {
    const { page, perPage, offset } = parsePaging(req.query);
    const { rows } = await getPool().query(
      `SELECT s.id, s.user_id, u.name, u.username, s.created_at, s.last_seen_at, s.expires_at,
              (s.expires_at <= now() OR s.revoked_at IS NOT NULL) AS expired
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.last_seen_at DESC
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    );
    const countRes = await getPool().query("SELECT count(*)::int AS n FROM sessions");
    res.json({ page, perPage, total: countRes.rows[0].n, rows: rows.map(serializeRow) });
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/:id/revoke", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError("Invalid session id", 400);
    const { rows } = await getPool().query("DELETE FROM sessions WHERE id = $1 RETURNING id, user_id", [id]);
    if (rows.length === 0) throw new AppError("Session not found", 404);
    res.json({ ok: true, revoked: rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.get("/activity", async (req, res, next) => {
  try {
    const { page, perPage, offset } = parsePaging(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const params = [];
    let where = "";
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      where = `WHERE (a.name ILIKE $1 OR a.status ILIKE $1 OR u.username ILIKE $1)`;
    }
    const { rows } = await getPool().query(
      `SELECT a.id, a.user_id, u.name AS user_name, u.username AS user_username,
              a.name, a.status, a.timestamp, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );
    const countRes = await getPool().query("SELECT count(*)::int AS n FROM activity_log a", []);
    res.json({ page, perPage, total: countRes.rows[0].n, rows: rows.map(serializeRow) });
  } catch (err) {
    next(err);
  }
});

async function tableColumns(table) {
  const { rows } = await getPool().query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map(r => r.column_name);
}

router.get("/data/:table", async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLE_SET.has(table)) throw new AppError("Unknown table", 404);
    const columns = await tableColumns(table);

    const { page, perPage, offset } = parsePaging(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = typeof req.query.filter === "string" ? req.query.filter.trim() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";

    if (sort && !columns.includes(sort)) throw new AppError("Invalid sort column", 400);

    const conditions = [];
    const params = [];

    if (search && columns.includes("id")) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`id::text ILIKE $${params.length}`);
    }

    let filterKey = null;
    let filterValue = null;
    if (filter) {
      const eq = filter.match(/^([a-z_]+)=(.+)$/i);
      const like = filter.match(/^([a-z_]+)~(.+)$/i);
      const parsed = eq || like;
      if (!parsed || !columns.includes(parsed[1])) throw new AppError("Invalid filter (expected col=value or col~text)", 400);
      filterKey = parsed[1];
      filterValue = parsed[2];
      params.push(like ? `%${escapeLike(filterValue)}%` : filterValue);
      conditions.push(`${filterKey} ${like ? "ILIKE" : "="} $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await getPool().query(`SELECT count(*)::int AS n FROM ${table} ${where}`, params);
    const orderCol = sort && columns.includes(sort) ? sort : (columns.includes("id") ? "id" : "1");
    const { rows } = await getPool().query(
      `SELECT * FROM ${table} ${where} ORDER BY ${orderCol} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset]
    );

    res.json({
      table, columns, page, perPage, total: countRes.rows[0].n,
      search, filter, sort: orderCol === "1" ? "id" : orderCol, dir: dir.toLowerCase(),
      rows: rows.map(serializeRow)
    });
  } catch (err) {
    next(err);
  }
});

async function dumpAllTables() {
  const pool = getPool();
  const tables = [];
  for (const name of ALL_TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${name} ORDER BY 1`);
    tables.push({ name, columns: await tableColumns(name), rows: rows.map(serializeRow) });
  }
  return { exportedAt: new Date().toISOString(), db: "life-organizer", tables };
}

async function tableColumnTypes(table) {
  const { rows } = await getPool().query(
    "SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = $1",
    [table]
  );
  return new Map(rows.map(r => [r.column_name, r.udt_name]));
}

const insertTableRows = async (pool, name, rows, columnTypes) => {
  if (!rows.length) return;
  const cols = rows[0] ? Object.keys(rows[0]).filter(c => columnTypes.has(c)) : [];
  if (!cols.length) return;
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${name} (${cols.join(", ")}) VALUES (${placeholders})`;
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      if (v === undefined || v === null) return null;
      const type = columnTypes.get(c);
      if (Array.isArray(v) && type.startsWith("_")) return v;
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    });
    try {
      await pool.query(sql, values);
    } catch (err) {
      throw new AppError(`Failed to restore row in ${name}: ${err.message}`, 400);
    }
  }
};

const sanitizeTables = (tables) => {
  if (!Array.isArray(tables) || tables.length === 0) throw new AppError("Backup contains no tables", 400);
  return tables.map(t => {
    if (!t || !TABLE_SET.has(t.name) || !Array.isArray(t.rows)) throw new AppError("Invalid backup payload", 400);
    return { name: t.name, rows: t.rows };
  });
};

const RESTORE_ORDER = ["users", "sessions", ...USER_TABLES, "settings"];

router.post("/restore", async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    let payload;
    if (req.body?.file && req.body?.passphrase) {
      try {
        payload = decryptBackup(Buffer.from(req.body.file, "base64"), req.body.passphrase);
      } catch {
        throw new AppError("Unable to decrypt backup. Check the passphrase and file.", 400);
      }
    } else if (req.body?.data) {
      try {
        payload = typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body.data;
      } catch {
        throw new AppError("Invalid backup JSON", 400);
      }
    } else {
      throw new AppError("Provide { data } (JSON dump) or { file, passphrase } (encrypted backup)", 400);
    }

    const incoming = new Map(sanitizeTables(payload.tables).map(t => [t.name, t]));

    await client.query("BEGIN");
    try {
      const currentSession = (await client.query(
        "SELECT token_hash FROM sessions WHERE id = $1", [req.session.id]
      )).rows[0];

      await client.query(`TRUNCATE ${ALL_TABLES.join(", ")} CASCADE`);

      const columnsCache = new Map();
      for (const name of RESTORE_ORDER) {
        const table = incoming.get(name);
        if (!table) continue;
        if (!columnsCache.has(name)) columnsCache.set(name, await tableColumnTypes(name));
        await insertTableRows(client, name, table.rows, columnsCache.get(name));
      }

      if (currentSession) {
        const exists = (await client.query("SELECT 1 FROM sessions WHERE token_hash = $1", [currentSession.token_hash])).rows.length > 0;
        if (!exists) {
          await client.query(
            `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at)
             VALUES ($1, $2, now(), now(), now() + interval '7 days')`,
            [currentSession.token_hash, req.user.id]
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    const restored = RESTORE_ORDER
      .filter(name => incoming.has(name))
      .map(name => ({ name, rows: incoming.get(name).rows.length }));

    res.json({ ok: true, message: "Database restored", restored });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

router.get("/export", async (_req, res, next) => {
  try {
    const payload = await dumpAllTables();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="life-organizer-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json"`);
    res.send(JSON.stringify(payload));
  } catch (err) {
    next(err);
  }
});

router.post("/backup", async (req, res, next) => {
  try {
    const passphrase = typeof req.body?.passphrase === "string" ? req.body.passphrase : "";
    if (passphrase.length < 8) throw new AppError("Passphrase must be at least 8 characters", 400);

    const payload = await dumpAllTables();
    const envelope = encryptBackup(payload, passphrase);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.lzb"`);
    res.send(envelope);
  } catch (err) {
    next(err);
  }
});

export default router;