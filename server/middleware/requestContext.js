import crypto from "node:crypto";

export function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
}
