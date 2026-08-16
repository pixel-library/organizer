import "dotenv/config";

const env = process.env.NODE_ENV || "development";
const isProd = env === "production";

if (isProd) {
  if (!process.env.DATABASE_URL && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
    throw new Error("Production requires DATABASE_URL (or DB_USER + DB_PASSWORD) to be set");
  }
  if (!process.env.CORS_ORIGINS) {
    throw new Error("Production requires CORS_ORIGINS to be set");
  }
}

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
  env,
  isProd,
  isDev: env !== "production",
  port: Number(process.env.PORT) || 4000,
  apiPrefix: process.env.API_PREFIX || "/api",
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES) || 10080,
  corsOrigins: normalizeCorsOrigins(process.env.CORS_ORIGINS),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:admin@lifeplanner.local"
  },
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
