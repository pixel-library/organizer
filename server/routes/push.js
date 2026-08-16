import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";
import { config } from "../config.js";

const router = Router();

router.use(requireAuth);

const ENDPOINT_RE = /^https?:\/\//i;
const KEY_RE = /^[A-Za-z0-9_-]{8,}$/;

const normalizeSubscription = (value) => {
  if (!value || typeof value !== "object") throw new AppError("subscription is required", 400);
  const endpoint = String(value.endpoint || "").trim();
  if (!ENDPOINT_RE.test(endpoint)) throw new AppError("subscription.endpoint must be an http(s) URL", 400);
  const keys = value.keys ?? {};
  const p256dh = String(keys.p256dh || "");
  const auth = String(keys.auth || "");
  if (!KEY_RE.test(p256dh) || !KEY_RE.test(auth)) {
    throw new AppError("subscription.keys.p256dh and subscription.keys.auth are required", 400);
  }
  const tzOffset = Number(value.tzOffsetMinutes);
  return {
    endpoint,
    p256dh,
    auth,
    tzOffsetMinutes: Number.isFinite(tzOffset) ? Math.round(tzOffset) : 0,
    userAgent: String(value.userAgent || "").slice(0, 300)
  };
};

router.get("/vapid-public-key", (req, res) => {
  if (!config.vapid.publicKey) {
    return res.status(503).json({ error: "Web Push is not configured on this server" });
  }
  res.json({ key: config.vapid.publicKey });
});

router.get("/subscriptions", async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      "SELECT id, endpoint FROM push_subscriptions WHERE user_id = $1 ORDER BY id DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/subscribe", async (req, res, next) => {
  try {
    const sub = normalizeSubscription(req.body ?? {});
    const { rows } = await getPool().query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, tz_offset_minutes, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         tz_offset_minutes = EXCLUDED.tz_offset_minutes,
         user_agent = EXCLUDED.user_agent,
         updated_at = now()
       RETURNING id`,
      [req.user.id, sub.endpoint, sub.p256dh, sub.auth, sub.tzOffsetMinutes, sub.userAgent]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.delete("/subscribe", async (req, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint || req.query.endpoint || "").trim();
    if (!ENDPOINT_RE.test(endpoint)) throw new AppError("endpoint is required", 400);
    await getPool().query(
      "DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2",
      [endpoint, req.user.id]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;