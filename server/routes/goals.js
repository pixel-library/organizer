import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  current: num(row.current) ?? 0,
  target: num(row.target) ?? 0,
  unit: row.unit ?? "",
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

const normalize = (value, { requireName = false } = {}) => {
  const out = {};
  if (value.name !== undefined) {
    const name = String(value.name).trim();
    if (requireName && !name) throw new AppError("name is required", 400);
    if (name.length > 200) throw new AppError("name must be 200 characters or fewer", 400);
    out.name = name;
  }
  if (value.current !== undefined) {
    const n = num(value.current);
    if (n === null || n < 0) throw new AppError("current must be a non-negative number", 400);
    out.current = n;
  }
  if (value.target !== undefined) {
    const n = num(value.target);
    if (n === null || n <= 0) throw new AppError("target must be a positive number", 400);
    out.target = n;
  }
  if (value.unit !== undefined) out.unit = String(value.unit).trim();
  return out;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT * FROM goals WHERE user_id = $1 ORDER BY id ASC",
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
      `INSERT INTO goals (user_id, name, current, target, unit)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, fields.name, fields.current ?? 0, fields.target ?? 1, fields.unit ?? ""]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

const fetchOwned = async (id, userId) => {
  const { rows } = await getPool().query(
    "SELECT * FROM goals WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Goal not found", 404);
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

router.put("/:id", updateGoal);
router.patch("/:id", updateGoal);

async function updateGoal(req, res, next) {
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
      `UPDATE goals SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Goal not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM goals WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Goal not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
