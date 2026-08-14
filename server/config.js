import "dotenv/config";

const normalizeCorsOrigins = (value) =>
  String(value || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const buildDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.DB_USER || "life_organizer";
  const password = process.env.DB_PASSWORD || "life_organizer";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "life_organizer";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

export const config = {
  env: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",
  port: Number(process.env.PORT) || 4000,
  apiPrefix: process.env.API_PREFIX || "/api",
  corsOrigins: normalizeCorsOrigins(process.env.CORS_ORIGINS),
  db: {
    url: buildDatabaseUrl(),
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "life_organizer",
    user: process.env.DB_USER || "life_organizer",
    password: process.env.DB_PASSWORD || "life_organizer"
  },
  embedded: {
    dataDir: process.env.PG_DATA_DIR || ".pgdata",
    superuser: process.env.PG_SUPERUSER || "postgres",
    superuserPassword: process.env.PG_SUPERUSER_PASSWORD || "postgres"
  }
};
