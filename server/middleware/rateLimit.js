import rateLimit from "express-rate-limit";

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 20;

const API_WINDOW_MS = 15 * 60 * 1000;
const API_MAX = Number(process.env.RATE_LIMIT_API_MAX) || 1000;
const ADMIN_MAX = Number(process.env.RATE_LIMIT_ADMIN_MAX) || 300;

const toJson = (message) => ({ error: { message } });

// The default key generator keys on `req.ip` — which respects the
// `app.set("trust proxy", ...)` setting — and normalizes IPv6 addresses,
// so limits are per-visitor rather than shared across every request that
// comes through the same reverse proxy.

export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET",
  message: toJson("Too many attempts. Please try again later.")
});

export const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: toJson("Too many requests. Please try again later.")
});

export const adminLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: ADMIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: toJson("Too many requests. Please try again later.")
});
