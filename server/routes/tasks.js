import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const FIELDS = [
  ["name", "name", "text"],
  ["date", "date", "date"],
  ["time", "time", "time"],
  ["priority", "priority", "text"],
  ["reminder", "reminder", "text"],
  ["completed", "completed", "bool"],
  ["type", "type", "text"],
  ["description", "description", "text"],
  ["startDate", "start_date", "date"],
  ["estimatedTime", "estimated_time", "text"],
  ["tags", "tags", "array"],
  ["subtasks", "subtasks", "jsonb"],
  ["recurring", "recurring", "text"],
  ["color", "color", "text"]
];

const PRIORITIES = ["Red", "Yellow", "Green"];
const TASK_COLORS = ["#313575", "#321951", "#633090", "#B22E37", "#F68318", "#FDC005"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const timeKey = (t) => (typeof t === "string" && t.length >= 5 ? t.slice(0, 5) : "");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  date: row.date ? dateKey(row.date) : "",
  time: row.time ? timeKey(row.time) : "",
  priority: row.priority,
  reminder: row.reminder,
  completed: row.completed,
  type: row.type,
  description: row.description,
  startDate: row.start_date ? dateKey(row.start_date) : "",
  estimatedTime: row.estimated_time ?? "",
  tags: row.tags ?? [],
  subtasks: row.subtasks ?? [],
  recurring: row.recurring,
  color: row.color || "",
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

const requireText = (value, label) => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new AppError(`${label} is required`, 400);
  return v;
};

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
    case "name":
      return requireText(value, "name");
    case "type":
    case "priority":
    case "reminder":
    case "recurring":
      return normalizeText(value);
    case "description":
    case "estimatedTime":
      return typeof value === "string" ? value : String(value ?? "");
    case "date":
    case "startDate":
      return normalizeDate(value);
    case "time":
      return normalizeTime(value);
    case "color": {
      if (value === "" || value === null || value === undefined) return null;
      const v = String(value).trim().toUpperCase();
      if (!TASK_COLORS.includes(v)) {
        throw new AppError("color must be one of: " + TASK_COLORS.join(", "), 400);
      }
      return v;
    }
    case "completed":
      return Boolean(value);
    case "tags": {
      if (!Array.isArray(value)) throw new AppError("tags must be an array", 400);
      if (!value.every((t) => typeof t === "string")) throw new AppError("tags must contain only strings", 400);
      return value;
    }
    case "subtasks": {
      if (!Array.isArray(value)) throw new AppError("subtasks must be an array", 400);
      if (!value.every((s) => s && typeof s === "object" && !Array.isArray(s))) {
        throw new AppError("subtasks must contain only objects", 400);
      }
      return value;
    }
    default:
      throw new AppError("Unexpected field", 400);
  }
};

const validatePriority = (priority) => {
  if (priority && !PRIORITIES.includes(priority)) {
    throw new AppError("priority must be one of: Red, Yellow, Green", 400);
  }
};

const bindValue = (type, value) => {
  if (type === "jsonb") return JSON.stringify(value);
  return value;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const conditions = ["user_id = $1"];
    const params = [req.user.id];
    const { search, status, priority, type, from, to, sort } = req.query;

    if (search) {
      params.push(`%${String(search).replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR description ILIKE $${params.length} OR type ILIKE $${params.length} OR priority ILIKE $${params.length} OR reminder ILIKE $${params.length} OR array_to_string(tags, ' ') ILIKE $${params.length})`
      );
    }

    if (status === "pending") conditions.push("completed = false");
    else if (status === "completed") conditions.push("completed = true");
    else if (status === "overdue") {
      conditions.push(
        "completed = false AND date IS NOT NULL AND (date::timestamp + COALESCE(time, '23:59')::time) < now()"
      );
    } else if (status && status !== "all") {
      throw new AppError("status must be one of: pending, completed, overdue", 400);
    }

    if (priority && priority !== "all") {
      validatePriority(priority);
      params.push(priority);
      conditions.push(`priority = $${params.length}`);
    }
    if (type && type !== "all") {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (from) {
      const f = normalizeDate(from);
      params.push(f);
      conditions.push(`date >= $${params.length}`);
    }
    if (to) {
      const t = normalizeDate(to);
      params.push(t);
      conditions.push(`date <= $${params.length}`);
    }

    const SORT = {
      dateAsc: "date ASC NULLS LAST, time ASC NULLS LAST, id ASC",
      dateDesc: "date DESC NULLS LAST, time DESC NULLS LAST, id ASC",
      priority: "CASE priority WHEN 'Red' THEN 0 WHEN 'Yellow' THEN 1 WHEN 'Green' THEN 2 ELSE 9 END, id ASC",
      name: "lower(name) ASC, id ASC",
      createdAt: "created_at ASC, id ASC",
      updatedAt: "updated_at DESC, id ASC"
    };
    const orderBy = SORT[sort] ?? SORT.dateAsc;

    const { rows } = await getPool().query(
      `SELECT * FROM tasks WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy}`,
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
    const entries = FIELDS.map(([api, db, type]) => {
      if (body[api] === undefined) return null;
      const value = normalizeField(api, body[api]);
      validatePriority(api === "priority" ? value : null);
      return [api, db, type, value];
    }).filter(Boolean);

    const required = entries.find(([api]) => api === "name");
    if (!required) throw new AppError("name is required", 400);

    const columns = [];
    const values = [];
    for (const [, db, type, value] of entries) {
      columns.push(`"${db}"`);
      values.push(bindValue(type, value));
    }
    const placeholders = values.map((_, i) => `$${i + 2}`);

    const { rows } = await getPool().query(
      `INSERT INTO tasks (user_id${columns.length ? ", " + columns.join(", ") : ""})
       VALUES ($1${placeholders.length ? ", " + placeholders.join(", ") : ""})
       RETURNING *`,
      [req.user.id, ...values]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Task not found", 404);
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

router.put("/:id", updateTask);
router.patch("/:id", updateTask);

async function updateTask(req, res, next) {
  try {
    const body = req.body ?? {};
    const entries = FIELDS.map(([api, db, type]) => {
      if (body[api] === undefined) return null;
      const value = normalizeField(api, body[api]);
      validatePriority(api === "priority" ? value : null);
      return [db, type, value];
    }).filter(Boolean);

    if (entries.length === 0) throw new AppError("No valid fields provided", 400);

    const setClauses = entries.map(([db, type, _value], i) => `"${db}" = $${i + 3}${type === "jsonb" ? "::jsonb" : ""}`);
    const values = entries.map(([, type, value]) => bindValue(type, value));
    setClauses.push("updated_at = now()");

    const { rows } = await getPool().query(
      `UPDATE tasks SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Task not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Task not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
