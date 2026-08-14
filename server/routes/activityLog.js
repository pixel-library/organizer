import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  status: row.status,
  timestamp: row.timestamp,
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
  if (value.status !== undefined) {
    const status = String(value.status).trim();
    if (status.length > 100) throw new AppError("status must be 100 characters or fewer", 400);
    out.status = status;
  }
  if (value.timestamp !== undefined) {
    const timestamp = String(value.timestamp).trim();
    if (timestamp.length > 200) throw new AppError("timestamp must be 200 characters or fewer", 400);
    out.timestamp = timestamp;
  }
  return out;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC, id DESC",
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
      "INSERT INTO activity_log (user_id, name, status, timestamp) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, fields.name, fields.status ?? "", fields.timestamp ?? ""]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM activity_log WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new AppError("Activity entry not found", 404);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    await getPool().query("DELETE FROM activity_log WHERE user_id = $1", [req.user.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
