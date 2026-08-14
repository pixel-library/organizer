import rateLimit from "express-rate-limit";

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 20;

const API_WINDOW_MS = 15 * 60 * 1000;
const API_MAX = Number(process.env.RATE_LIMIT_API_MAX) || 1000;

const toJson = (message) => ({ error: { message } });

export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: toJson("Too many attempts. Please try again later.")
});

export const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: toJson("Too many requests. Please try again later.")
});
