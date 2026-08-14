import { AppError } from "../utils/AppError.js";
import { getPool } from "../db.js";
import { COOKIE_NAME, sha256 } from "../utils/sessions.js";
import { config } from "../config.js";

const RENEW_AFTER_MS = 15 * 60 * 1000;

export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return next(new AppError("Authentication required", 401));
    }

    const { rows } = await getPool().query(
      `SELECT s.id AS session_id, s.last_seen_at, s.expires_at, s.revoked_at,
              u.id AS user_id, u.name, u.email, u.created_at, u.updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [sha256(token)]
    );

    if (rows.length === 0) {
      return next(new AppError("Invalid or expired session", 401));
    }

    const session = rows[0];
    if (session.revoked_at) {
      return next(new AppError("Session revoked", 401));
    }

    const now = Date.now();
    const expiresAt = new Date(session.expires_at).getTime();
    if (expiresAt <= now) {
      return next(new AppError("Session expired", 401));
    }

    const lastSeenAt = new Date(session.last_seen_at).getTime();
    const nearExpiry = expiresAt - now < 60 * 60 * 1000;
    if (nearExpiry || now - lastSeenAt > RENEW_AFTER_MS) {
      await getPool().query(
        `UPDATE sessions
         SET last_seen_at = now(), expires_at = now() + make_interval(mins => $2)
         WHERE id = $1`,
        [session.session_id, config.sessionTtlMinutes]
      );
    }

    req.session = {
      id: session.session_id,
      expiresAt: session.expires_at,
      lastSeenAt: session.last_seen_at
    };
    req.user = {
      id: session.user_id,
      name: session.name,
      email: session.email,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    };
    next();
  } catch (err) {
    next(err);
  }
}
