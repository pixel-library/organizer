import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db.js";
import { purgeExpiredSessions } from "./utils/sessions.js";
import { startPushScheduler, stopPushScheduler } from "./utils/push.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[life-organizer-api] listening on http://localhost:${config.port} (${config.env})`);
  connectDatabase().then(() => {
    console.log("[life-organizer-api] database layer initialized");
  });
});

const sessionPurgeTimer = setInterval(() => {
  purgeExpiredSessions().catch(() => {});
}, 60 * 60 * 1000);
sessionPurgeTimer.unref();

startPushScheduler();

function shutdown(signal) {
  console.log(`[life-organizer-api] received ${signal}, shutting down`);
  clearInterval(sessionPurgeTimer);
  stopPushScheduler();
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));