import { requireAuth } from "./auth.js";
import { AppError } from "../utils/AppError.js";

/**
 * Admin-only guard: runs after requireAuth and rejects non-admin users.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError("Authentication required", 401));
  }
  if (req.user.role !== "admin") {
    return next(new AppError("Admin privileges required", 403));
  }
  next();
}

export const adminGuard = [requireAuth, requireAdmin];
