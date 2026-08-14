import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const FIELDS = [
  ["title", "title", "text"],
  ["start", "start_date", "date"],
  ["end", "end_date", "date"],
  ["startTime", "start_time", "time"],
  ["endTime", "end_time", "time"],
  ["allDay", "all_day", "bool"],
  ["category", "category", "text"],
  ["location", "location", "text"],
  ["description", "description", "text"],
  ["reminder", "reminder", "text"],
  ["recurrence", "recurrence", "text"],
  ["recurrenceEnd", "recurrence_end", "date"],
  ["customWeekdays", "custom_weekdays", "array-int"],
  ["overrides", "overrides", "jsonb"]
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const timeKey = (t) => (typeof t === "string" && t.length >= 5 ? t.slice(0, 5) : "");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const serialize = (row) => ({
  id: row.id,
  title: row.title,
  start: row.start_date ? dateKey(row.start_date) : "",
  end: row.end_date ? dateKey(row.end_date) : "",
  startTime: row.start_time ? timeKey(row.start_time) : "",
  endTime: row.end_time ? timeKey(row.end_time) : "",
  allDay: row.all_day,
  category: row.category,
  location: row.location,
  description: row.description,
  reminder: row.reminder,
  recurrence: row.recurrence,
  recurrenceEnd: row.recurrence_end ? dateKey(row.recurrence_end) : "",
  customWeekdays: row.custom_weekdays ?? [],
  overrides: row.overrides ?? {},
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

const normalizeText = (value) => (typeof value === "string" ? value.trim() : String(value ?? "").trim());

const normalizeDate = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const v = String(value);
  if (!DATE_RE.test(v)) throw new AppError("date must be in YYYY-MM-DD format", 400);
  return v;
};

const normalizeTime = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const v = String(value);
  if (!TIME_RE.test(v)) throw new AppError("time must be in HH:MM format", 400);
  return v;
};

const normalizeField = (api, value) => {
  switch (api) {
    case "title":
    case "category":
    case "location":
    case "reminder":
    case "recurrence":
      return normalizeText(value);
    case "description":
      return typeof value === "string" ? value : String(value ?? "");
    case "start":
    case "end":
    case "recurrenceEnd":
      return normalizeDate(value);
    case "startTime":
    case "endTime":
      return normalizeTime(value);
    case "allDay":
      return Boolean(value);
    case "customWeekdays": {
      if (!Array.isArray(value)) throw new AppError("customWeekdays must be an array", 400);
      if (!value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        throw new AppError("customWeekdays must contain only integers 0-6", 400);
      }
      return value;
    }
    case "overrides": {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new AppError("overrides must be an object", 400);
      }
      return value;
    }
    default:
      throw new AppError("Unexpected field", 400);
  }
};

const bindValue = (type, value) => (type === "jsonb" ? JSON.stringify(value) : value);

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const conditions = ["user_id = $1"];
    const params = [req.user.id];
    const { from, to } = req.query;

    if (from) {
      const f = normalizeDate(from);
      params.push(f);
      conditions.push(`start_date >= $${params.length}`);
    }
    if (to) {
      const t = normalizeDate(to);
      params.push(t);
      conditions.push(`start_date <= $${params.length}`);
    }

    const { rows } = await getPool().query(
      `SELECT * FROM calendar_events WHERE ${conditions.join(" AND ")} ORDER BY start_date ASC, start_time ASC NULLS LAST, id ASC`,
      params
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const values = {};
    for (const [api, db, type] of FIELDS) {
      if (body[api] !== undefined) values[db] = [type, normalizeField(api, body[api])];
    }

    const title = values.title?.[1];
    const start = values.start_date?.[1];
    if (!title) throw new AppError("title is required", 400);
    if (!start) throw new AppError("start is required", 400);

    const columns = Object.keys(values);
    const placeholders = columns.map((_, i) => `$${i + 2}${values[columns[i]][0] === "jsonb" ? "::jsonb" : ""}`);
    const params = [req.user.id, ...columns.map((c) => bindValue(values[c][0], values[c][1]))];

    const { rows } = await getPool().query(
      `INSERT INTO calendar_events (user_id${columns.length ? ", " + columns.map((c) => `"${c}"`).join(", ") : ""})
       VALUES ($1${placeholders.length ? ", " + placeholders.join(", ") : ""})
       RETURNING *`,
      params
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM calendar_events WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Event not found", 404);
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

router.put("/:id", updateEvent);
router.patch("/:id", updateEvent);

async function updateEvent(req, res, next) {
  try {
    const body = req.body ?? {};
    const entries = [];
    for (const [api, db, type] of FIELDS) {
      if (body[api] === undefined) continue;
      entries.push([db, type, normalizeField(api, body[api])]);
    }
    if (entries.length === 0) throw new AppError("No valid fields provided", 400);

    const setClauses = entries.map(
      ([db, type, _value], i) => `"${db}" = $${i + 3}${type === "jsonb" ? "::jsonb" : ""}`
    );
    const values = entries.map(([, type, value]) => bindValue(type, value));
    setClauses.push("updated_at = now()");

    const { rows } = await getPool().query(
      `UPDATE calendar_events SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Event not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM calendar_events WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Event not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
