import crypto from "node:crypto";
import { getPool } from "../db.js";
import { config } from "../config.js";

export const COOKIE_NAME = "life_organizer_sid";

export const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlMinutes * 60 * 1000
  };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await getPool().query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [sha256(token), userId, config.sessionTtlMinutes]
  );
  return token;
}

export async function revokeSession(token) {
  if (!token) return;
  await getPool().query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

export async function revokeOtherSessions(userId, keepSessionId) {
  await getPool().query(
    "DELETE FROM sessions WHERE user_id = $1 AND id <> $2",
    [userId, keepSessionId]
  );
}

export async function revokeSessionById(sessionId) {
  await getPool().query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function purgeExpiredSessions() {
  await getPool().query("DELETE FROM sessions WHERE expires_at <= now() OR revoked_at IS NOT NULL");
}

export function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role || "user",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
