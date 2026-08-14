import { AppError } from "../utils/AppError.js";
import { config } from "../config.js";

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

const PG_ERROR_STATUS = {
  "23505": 409,
  "23503": 400,
  "23502": 400,
  "23514": 400,
  "22P02": 400,
  "22P03": 400,
  "22007": 400,
  "22008": 400
};

export function errorHandler(err, req, res, _next) {
  const mapped = PG_ERROR_STATUS[err.code];
  const statusCode = err instanceof AppError ? err.statusCode : mapped ?? 500;
  const message =
    err instanceof AppError ? err.message : mapped ? `Invalid request: ${err.message}` : "Internal Server Error";

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
