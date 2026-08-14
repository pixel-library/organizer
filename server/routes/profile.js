import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";
import { safeUser } from "../utils/sessions.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateName = (name) => {
  const value = typeof name === "string" ? name.trim() : "";
  if (value.length < 1 || value.length > 100) {
    throw new AppError("Name must be between 1 and 100 characters", 400);
  }
  return value;
};

const validateEmail = (email) => {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(value)) {
    throw new AppError("Email must be a valid email address", 400);
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
    if (body.email !== undefined) updates.email = validateEmail(body.email);
    if (Object.keys(updates).length === 0) {
      throw new AppError("No valid profile fields provided", 400);
    }

    const { rows } = await getPool().query(
      `UPDATE users
       SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = now()
       WHERE id = $1
       RETURNING id, name, email, created_at, updated_at`,
      [req.user.id, updates.name ?? null, updates.email ?? null]
    );

    if (rows.length === 0) {
      throw new AppError("User not found", 404);
    }
    res.json(safeUser(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return next(new AppError("An account with this email already exists", 409));
    }
    next(err);
  }
});

export default router;
