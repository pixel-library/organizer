import { connectDatabase, disconnectDatabase } from "../../server/db.js";
import { checkDueReminders, initPush } from "../../server/utils/push.js";

export const schedule = "*/5 * * * *";

export async function handler() {
  if (!initPush()) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: "vapid-not-configured" }) };
  }
  await connectDatabase();
  try {
    await checkDueReminders();
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } finally {
    await disconnectDatabase();
  }
}