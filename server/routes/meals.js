import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const timeKey = (t) => (typeof t === "string" && t.length >= 5 ? t.slice(0, 5) : "");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const serialize = (row) => ({
  id: row.id,
  date: row.date ? dateKey(row.date) : "",
  type: row.type,
  name: row.name,
  time: row.time ? timeKey(row.time) : "",
  calories: num(row.calories),
  protein: num(row.protein),
  carbohydrates: num(row.carbohydrates),
  fat: num(row.fat),
  ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
  notes: row.notes,
  status: row.status,
  day: row.day,
  breakfast: row.breakfast,
  lunch: row.lunch,
  dinner: row.dinner,
  snack: row.snack,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

const normalize = (value, { requireName = false } = {}) => {
  const out = {};
  const text = (api, v, required = false) => {
    if (v !== undefined) {
      const s = String(v).trim();
      if (required && !s) throw new AppError(`${api} is required`, 400);
      out[api] = s;
    }
  };
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
  for (const key of ["calories", "protein", "carbohydrates", "fat"]) {
    if (value[key] !== undefined) {
      const n = num(value[key]);
      if (n !== null && n < 0) throw new AppError(`${key} must be a non-negative number`, 400);
      out[key] = n;
    }
  }
  if (value.ingredients !== undefined) {
    if (!Array.isArray(value.ingredients) || !value.ingredients.every((i) => typeof i === "string")) {
      throw new AppError("ingredients must be an array of strings", 400);
    }
    out.ingredients = value.ingredients;
  }
  if (value.day !== undefined && value.day !== "") {
    if (!DAYS.includes(value.day)) throw new AppError("day must be a weekday name (Monday–Sunday)", 400);
    out.day = value.day;
  }
  text("type", value.type);
  text("name", value.name, requireName);
  text("notes", value.notes);
  text("status", value.status);
  text("breakfast", value.breakfast);
  text("lunch", value.lunch);
  text("dinner", value.dinner);
  text("snack", value.snack);
  return out;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT * FROM meals WHERE user_id = $1 ORDER BY id ASC",
      [req.user.id]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const fields = normalize(req.body ?? {});
    const columns = ["user_id"];
    const values = [req.user.id];
    for (const [key, v] of Object.entries(fields)) {
      columns.push(`"${key}"`);
      values.push(v);
    }
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const { rows } = await getPool().query(
      `INSERT INTO meals (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM meals WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Meal not found", 404);
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

router.put("/:id", updateMeal);
router.patch("/:id", updateMeal);

async function updateMeal(req, res, next) {
  try {
    const fields = normalize(req.body ?? {});
    if (Object.keys(fields).length === 0) throw new AppError("No valid fields provided", 400);
    const setClauses = [];
    const values = [];
    for (const [key, v] of Object.entries(fields)) {
      setClauses.push(`"${key}" = $${values.length + 3}`);
      values.push(v);
    }
    setClauses.push("updated_at = now()");
    const { rows } = await getPool().query(
      `UPDATE meals SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Meal not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM meals WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Meal not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
