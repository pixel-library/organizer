import { Router } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../utils/AppError.js";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { COOKIE_NAME, cookieOptions, createSession, revokeSession, safeUser } from "../utils/sessions.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegistration = (body) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 1 || name.length > 100) {
    throw new AppError("Name must be between 1 and 100 characters", 400);
  }
  if (!EMAIL_RE.test(email)) {
    throw new AppError("Email must be a valid email address", 400);
  }
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }
  if (password.length > 72) {
    throw new AppError("Password must be at most 72 characters", 400);
  }
  return { name, email, password };
};

const sendUserWithCookie = (res, statusCode, user) => {
  res.status(statusCode).json(safeUser(user));
};

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = validateRegistration(req.body ?? {});

    const existing = await getPool().query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
    if (existing.rows.length > 0) {
      throw new AppError("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let userId;
    try {
      const inserted = await getPool().query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at, updated_at",
        [name, email, passwordHash]
      );
      userId = inserted.rows[0].id;
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("An account with this email already exists", 409);
      }
      throw err;
    }

    const token = await createSession(userId);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    const user = (await getPool().query(
      "SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1",
      [userId]
    )).rows[0];
    sendUserWithCookie(res, 201, user);
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const { rows } = await getPool().query(
      "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE lower(email) = lower($1)",
      [email]
    );
    const user = rows[0];

    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = await createSession(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    sendUserWithCookie(res, 200, user);
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    await revokeSession(token);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
