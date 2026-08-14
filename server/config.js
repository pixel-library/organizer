import "dotenv/config";

const normalizeCorsOrigins = (value) =>
  String(value || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",
  port: Number(process.env.PORT) || 4000,
  apiPrefix: process.env.API_PREFIX || "/api",
  corsOrigins: normalizeCorsOrigins(process.env.CORS_ORIGINS),
  db: {
    url: process.env.DATABASE_URL || "",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || "life_organizer",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || ""
  }
};
