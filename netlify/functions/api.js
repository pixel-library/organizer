import serverless from "serverless-http";
import { createApp } from "../../server/app.js";
import { connectDatabase } from "../../server/db.js";

const app = createApp();
const apiHandler = serverless(app);

let readyPromise = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = connectDatabase().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

function normalizePath(rawPath) {
  const clean = String(rawPath || "").replace(/^\/\.netlify\/functions\/api/, "");
  return clean.startsWith("/api") ? clean : `/api${clean}`;
}

export async function handler(event, context) {
  await ensureReady();
  return apiHandler({ ...event, path: normalizePath(event.path) }, context);
}
