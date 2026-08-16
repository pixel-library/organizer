import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";
import { safeUser } from "../utils/sessions.js";

const router = Router();

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/i;

const validateName = (name) => {
  const value = typeof name === "string" ? name.trim() : "";
  if (value.length < 1 || value.length > 100) {
    throw new AppError("Name must be between 1 and 100 characters", 400);
  }
  return value;
};

const validateUsername = (username) => {
  const value = typeof username === "string" ? username.trim() : "";
  if (!USERNAME_RE.test(value)) {
    throw new AppError("Username must be 3-30 characters using letters, numbers, underscores or hyphens, starting with a letter or number", 400);
  }
  return value;
};

router.get("/", requireAuth, (req, res) => {
  res.json(req.user);
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const updates = {};
    if (body.name !== undefined) updates.name = validateName(body.name);
    if (body.username !== undefined) updates.username = validateUsername(body.username);
    if (Object.keys(updates).length === 0) {
      throw new AppError("No valid profile fields provided", 400);
    }

    const { rows } = await getPool().query(
      `UPDATE users
       SET name = COALESCE($2, name), username = COALESCE($3, username), updated_at = now()
       WHERE id = $1
       RETURNING id, name, username, role, created_at, updated_at`,
      [req.user.id, updates.name ?? null, updates.username ?? null]
    );

    if (rows.length === 0) {
      throw new AppError("User not found", 404);
    }
    res.json(safeUser(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return next(new AppError("An account with this username already exists", 409));
    }
    next(err);
  }
});

export default router;