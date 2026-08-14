import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const timeKey = (t) => (typeof t === "string" && t.length >= 5 ? t.slice(0, 5) : "");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

const TYPES = ["once", "daily", "weekly", "monthly", "yearly", "custom", ""];

const serialize = (row) => ({
  id: row.id,
  title: row.title,
  date: row.date ? dateKey(row.date) : "",
  time: row.time ? timeKey(row.time) : "",
  note: row.note ?? "",
  type: row.type ?? "",
  completed: Boolean(row.completed),
  createdAt: iso(row.created_at)
});

const normalize = (value, { requireTitle = false } = {}) => {
  const out = {};
  if (value.title !== undefined) {
    const title = String(value.title).trim();
    if (requireTitle && !title) throw new AppError("title is required", 400);
    if (title.length > 200) throw new AppError("title must be 200 characters or fewer", 400);
    out.title = title;
  }
  if (value.date !== undefined) {
    if (value.date === "" || value.date === null) out.date = null;
    else if (typeof value.date === "string" && DATE_RE.test(value.date)) out.date = value.date;
    else throw new AppError("date must be in YYYY-MM-DD format", 400);
  }
  if (value.time !== undefined) {
    if (value.time === "" || value.time === null) out.time = null;
    else if (typeof value.time === "string" && TIME_RE.test(value.time)) out.time = value.time;
    else throw new AppError("time must be in HH:MM format", 400);
  }
  if (value.note !== undefined) out.note = String(value.note).trim();
  if (value.type !== undefined) {
    const t = String(value.type).toLowerCase();
    if (!TYPES.includes(t)) throw new AppError("type is not supported", 400);
    out.type = t;
  }
  if (value.completed !== undefined) {
    if (typeof value.completed !== "boolean") throw new AppError("completed must be a boolean", 400);
    out.completed = value.completed;
  }
  return out;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT * FROM custom_reminders WHERE user_id = $1 ORDER BY id ASC",
      [req.user.id]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const fields = normalize(req.body ?? {}, { requireTitle: true });
    const { rows } = await getPool().query(
      `INSERT INTO custom_reminders (user_id, title, date, time, note, type, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id,
        fields.title,
        fields.date ?? null,
        fields.time ?? null,
        fields.note ?? "",
        fields.type ?? "",
        fields.completed ?? false
      ]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM custom_reminders WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Reminder not found", 404);
  return rows[0];
};

router.get("/:id", async (req, res, next) => {
  try {
    const row = await fetchOwned(req.params.id, req.user.id);
    res.json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", updateReminder);
router.patch("/:id", updateReminder);

async function updateReminder(req, res, next) {
  try {
    const fields = normalize(req.body ?? {});
    if (Object.keys(fields).length === 0) throw new AppError("No valid fields provided", 400);
    const setClauses = [];
    const values = [];
    for (const [key, v] of Object.entries(fields)) {
      setClauses.push(`"${key}" = $${values.length + 3}`);
      values.push(v);
    }
    const { rows } = await getPool().query(
      `UPDATE custom_reminders SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Reminder not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM custom_reminders WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Reminder not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
