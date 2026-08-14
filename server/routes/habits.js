import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  days: Array.isArray(row.days) ? row.days : Array(7).fill(false),
  history: Array.isArray(row.history) ? row.history.map((d) => (d instanceof Date ? dateKey(d) : String(d))) : [],
  createdAt: iso(row.created_at)
});

const normalize = (value, { requireName = false } = {}) => {
  const out = {};
  if (value.name !== undefined) {
    const name = String(value.name).trim();
    if (requireName && !name) throw new AppError("name is required", 400);
    if (name.length > 200) throw new AppError("name must be 200 characters or fewer", 400);
    out.name = name;
  }
  if (value.days !== undefined) {
    if (!Array.isArray(value.days) || value.days.length !== 7 || !value.days.every((b) => typeof b === "boolean")) {
      throw new AppError("days must be an array of 7 booleans", 400);
    }
    out.days = value.days;
  }
  if (value.history !== undefined) {
    if (!Array.isArray(value.history)) throw new AppError("history must be an array", 400);
    for (const d of value.history) {
      if (typeof d !== "string" || !DATE_RE.test(d)) {
        throw new AppError("history must contain only YYYY-MM-DD dates", 400);
      }
    }
    out.history = value.history;
  }
  return out;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT * FROM habits WHERE user_id = $1 ORDER BY id ASC",
      [req.user.id]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const fields = normalize(req.body ?? {}, { requireName: true });
    const { rows } = await getPool().query(
      `INSERT INTO habits (user_id, name, days, history)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, fields.name, fields.days ?? Array(7).fill(false), fields.history ?? []]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM habits WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Habit not found", 404);
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

router.put("/:id", updateHabit);
router.patch("/:id", updateHabit);

async function updateHabit(req, res, next) {
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
      `UPDATE habits SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Habit not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM habits WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Habit not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
