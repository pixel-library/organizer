import { Router } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../utils/AppError.js";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  COOKIE_NAME,
  cookieOptions,
  createSession,
  revokeSession,
  revokeOtherSessions,
  safeUser
} from "../utils/sessions.js";

const router = Router();

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/i;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/* ---- brute-force defense: per-username lockout (in-memory, per process) ---- */
const LOGIN_MAX_FAILS = Math.max(1, Number(process.env.LOGIN_MAX_FAILS) || 10);
const LOGIN_LOCK_MS = (Math.max(1, Number(process.env.LOGIN_LOCK_MINUTES) || 15)) * 60 * 1000;
const loginFailures = new Map();

const pruneLoginFailures = () => {
  const cutoff = Date.now() - LOGIN_LOCK_MS;
  for (const [key, entry] of loginFailures) {
    const locked = entry.lockedUntil > Date.now();
    if (!locked && entry.lastFail < cutoff) loginFailures.delete(key);
  }
};

const checkLoginThrottle = (username) => {
  const entry = loginFailures.get(username.toLowerCase());
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    throw new AppError("Too many failed attempts. Try again later.", 429);
  }
};

const recordLoginFailure = (username) => {
  const key = username.toLowerCase();
  const entry = loginFailures.get(key) || { count: 0, lockedUntil: 0, lastFail: 0 };
  entry.count += 1;
  entry.lastFail = Date.now();
  if (entry.count >= LOGIN_MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    entry.count = 0;
  }
  loginFailures.set(key, entry);
};

const clearLoginFailures = (username) => loginFailures.delete(username.toLowerCase());

/* dummy hash so unknown-usernames cost the same as real ones (timing equalization) */
const DUMMY_HASH = bcrypt.hashSync("timing-equalization-dummy", 10);

const validateRegistration = (body) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 1 || name.length > 100) {
    throw new AppError("Name must be between 1 and 100 characters", 400);
  }
  if (!USERNAME_RE.test(username)) {
    throw new AppError("Username must be 3-30 characters using letters, numbers, underscores or hyphens, starting with a letter or number", 400);
  }
  if (password.length < PASSWORD_MIN) {
    throw new AppError(`Password must be at least ${PASSWORD_MIN} characters`, 400);
  }
  if (password.length > PASSWORD_MAX) {
    throw new AppError(`Password must be at most ${PASSWORD_MAX} characters`, 400);
  }
  return { name, username, password };
};

const validatePassword = (password) => {
  const value = typeof password === "string" ? password : "";
  if (value.length < PASSWORD_MIN) {
    throw new AppError(`Password must be at least ${PASSWORD_MIN} characters`, 400);
  }
  if (value.length > PASSWORD_MAX) {
    throw new AppError(`Password must be at most ${PASSWORD_MAX} characters`, 400);
  }
  return value;
};

const sendUserWithCookie = (res, statusCode, user) => {
  res.status(statusCode).json(safeUser(user));
};

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { name, username, password } = validateRegistration(req.body ?? {});

    const existing = await getPool().query("SELECT id FROM users WHERE lower(username) = lower($1)", [username]);
    if (existing.rows.length > 0) {
      throw new AppError("An account with this username already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let userId;
    try {
      const inserted = await getPool().query(
        "INSERT INTO users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING id, name, username, created_at, updated_at",
        [name, username, passwordHash]
      );
      userId = inserted.rows[0].id;
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("An account with this username already exists", 409);
      }
      throw err;
    }

    const token = await createSession(userId);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    const user = (await getPool().query(
      "SELECT id, name, username, role, created_at, updated_at FROM users WHERE id = $1",
      [userId]
    )).rows[0];
    sendUserWithCookie(res, 201, user);
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      throw new AppError("Username and password are required", 400);
    }

    pruneLoginFailures();
    checkLoginThrottle(username);

    const { rows } = await getPool().query(
      "SELECT id, name, username, password_hash, role, created_at, updated_at FROM users WHERE lower(username) = lower($1)",
      [username]
    );
    const user = rows[0];

    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      recordLoginFailure(username);
      throw new AppError("Invalid username or password", 401);
    }

    clearLoginFailures(username);
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

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = validatePassword(req.body?.newPassword);

    const { rows } = await getPool().query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) throw new AppError("User not found", 404);

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new AppError("Current password is incorrect", 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await getPool().query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [req.user.id, passwordHash]
    );

    await revokeOtherSessions(req.user.id, req.session.id);
    res.json({ ok: true, message: "Password updated. Other devices signed out." });
  } catch (err) {
    next(err);
  }
});

router.post("/revoke-sessions", requireAuth, async (req, res, next) => {
  try {
    await revokeOtherSessions(req.user.id, req.session.id);
    res.json({ ok: true, message: "Other sessions revoked" });
  } catch (err) {
    next(err);
  }
});

router.delete("/account", requireAuth, async (req, res, next) => {
  try {
    await getPool().query("DELETE FROM users WHERE id = $1", [req.user.id]);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
