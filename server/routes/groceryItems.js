import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category ?? "",
  quantity: row.quantity ?? "",
  unit: row.unit ?? "",
  note: row.note ?? "",
  completed: Boolean(row.completed),
  createdAt: iso(row.created_at)
});

const normalize = (value, { requireName = false } = {}) => {
  const out = {};
  const text = (api, v) => {
    if (v !== undefined) out[api] = String(v).trim();
  };
  if (value.name !== undefined) {
    const name = String(value.name).trim();
    if (requireName && !name) throw new AppError("name is required", 400);
    if (name.length > 200) throw new AppError("name must be 200 characters or fewer", 400);
    out.name = name;
  }
  text("category", value.category);
  text("quantity", value.quantity);
  text("unit", value.unit);
  text("note", value.note);
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
      "SELECT * FROM grocery_items WHERE user_id = $1 ORDER BY id ASC",
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
      `INSERT INTO grocery_items (user_id, name, category, quantity, unit, note, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id,
        fields.name,
        fields.category ?? "",
        fields.quantity ?? "",
        fields.unit ?? "",
        fields.note ?? "",
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
    "SELECT * FROM grocery_items WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rows.length === 0) throw new AppError("Grocery item not found", 404);
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

router.put("/:id", updateItem);
router.patch("/:id", updateItem);

async function updateItem(req, res, next) {
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
      `UPDATE grocery_items SET ${setClauses.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, ...values]
    );
    if (rows.length === 0) throw new AppError("Grocery item not found", 404);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
}

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM grocery_items WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Grocery item not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
