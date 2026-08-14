import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[life-organizer-api] listening on http://localhost:${config.port} (${config.env})`);
  connectDatabase().then(() => {
    console.log("[life-organizer-api] database layer initialized");
  });
});

function shutdown(signal) {
  console.log(`[life-organizer-api] received ${signal}, shutting down`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
