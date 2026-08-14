import { AppError } from "../utils/AppError.js";
import { config } from "../config.js";

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : "Internal Server Error";

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { error: { message } };
  if (err instanceof AppError && err.details !== undefined) {
    body.error.details = err.details;
  }
  if (config.isDev) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
