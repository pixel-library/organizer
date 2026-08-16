import { AppError } from "../utils/AppError.js";
import { config } from "../config.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defense: for state-changing requests, require the Origin header to
 * match an allowed origin when it is present. Browsers always send Origin on
 * cross-site state-changing requests; same-site fetch sends it too in modern
 * browsers. Non-browser clients (curl, tests, server-to-server) omit it and
 * are allowed through — they cannot carry ambient cookies cross-site.
 */
export function originCheck(req, _res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (origin && !config.corsOrigins.includes(origin)) {
    return next(new AppError("Cross-origin request rejected", 403));
  }
  next();
}
