import webpush from "web-push";
import { config } from "../config.js";
import { getPool } from "../db.js";

const TASK_REMINDER_MINUTES = { exact: 0, "10min": 10, "30min": 30, "1hour": 60 };
const EVENT_REMINDER_MINUTES = {
  "5min": 5, "10min": 10, "15min": 15, "30min": 30, "1hour": 60, "1day": 1440
};

let enabled = false;
let timer = null;
let warned = false;

// Fired occurrences: key = `${userId}:${kind}:${id}:${fireKey}` (fireKey =
// date+minutes). A key only ever fires once, so edits/reschedules (which
// change the key) re-arm the notification. In-memory only; a restart may
// re-send one notification for a still-due occurrence, which is acceptable.
const lastSent = new Map();
const MAX_TRACKED = 20000;

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function initPush() {
  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    if (!warned) {
      warned = true;
      console.warn("[push] VAPID keys not configured — push notifications disabled");
    }
    return false;
  }
  try {
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
    enabled = true;
    return true;
  } catch (err) {
    console.warn("[push] VAPID setup failed:", err.message);
    return false;
  }
}

export function startPushScheduler(intervalMs = 60 * 1000) {
  if (timer) return;
  if (!initPush()) return;
  timer = setInterval(() => {
    checkDueReminders().catch((err) => {
      console.warn("[push] scheduler error:", err.message);
    });
  }, intervalMs);
  timer.unref();
}

export function stopPushScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

function parseClock(value) {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export async function checkDueReminders() {
  if (!enabled) return;
  const { rows: subs } = await getPool().query(
    `SELECT s.id AS sub_id, s.endpoint, s.p256dh, s.auth, s.tz_offset_minutes, s.user_id
     FROM push_subscriptions s
     JOIN users u ON u.id = s.user_id`
  );
  if (subs.length === 0) return;

  const byUser = new Map();
  for (const sub of subs) {
    if (!byUser.has(sub.user_id)) byUser.set(sub.user_id, []);
    byUser.get(sub.user_id).push(sub);
  }

  const userIds = [...byUser.keys()];
  const tasks = await loadDue("tasks", userIds);
  const events = await loadDue("calendar_events", userIds);
  const custom = await loadDue("custom_reminders", userIds);

  const serverOffset = new Date().getTimezoneOffset();
  const nowMs = Date.now();
  const nowLocalMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const payloads = [];
  for (const userId of userIds) {
    // The client stores reminder times in its own local timezone
    // (tz_offset_minutes is that browser's getTimezoneOffset() value).
    // Shift the server's "now" into the user's local wall-clock so the
    // date/time comparison is correct regardless of where the server runs.
    const tzOffset = byUser.get(userId)[0].tz_offset_minutes || 0;
    const offsetDelta = tzOffset - serverOffset;
    const userDate = dateKey(new Date(nowMs + offsetDelta * 60000));
    const userNowMinutes = nowLocalMinutes + offsetDelta;

    for (const task of tasks) {
      if (task.user_id !== userId) continue;
      const offset = TASK_REMINDER_MINUTES[task.reminder];
      if (offset === undefined || !task.time || task.completed) continue;
      if (task.date !== userDate) continue;
      const fireMinutes = parseClock(task.time) - offset;
      if (fireMinutes === null || fireMinutes < 0) continue;
      const ago = userNowMinutes - fireMinutes;
      if (ago < -2 || ago > 5) continue;
      const fireKey = `${userId}:task:${task.id}:${task.date}:${fireMinutes}`;
      if (lastSent.has(fireKey)) continue;
      markSent(fireKey);
      payloads.push({ userId, payload: {
        title: task.name,
        body: `Scheduled for ${task.time}${offset ? ` — ${offset} min from now` : ""}`,
        tag: `task-${task.id}`,
        url: "/"
      } });
    }

    for (const event of events) {
      if (event.user_id !== userId) continue;
      const offset = EVENT_REMINDER_MINUTES[event.reminder];
      if (offset === undefined || !event.start_time || event.all_day) continue;
      if (event.start_date !== userDate) continue;
      const fireMinutes = parseClock(event.start_time) - offset;
      if (fireMinutes === null || fireMinutes < 0) continue;
      const ago = userNowMinutes - fireMinutes;
      if (ago < -2 || ago > 5) continue;
      const fireKey = `${userId}:event:${event.id}:${event.start_date}:${fireMinutes}`;
      if (lastSent.has(fireKey)) continue;
      markSent(fireKey);
      payloads.push({ userId, payload: {
        title: event.title,
        body: `Event at ${event.start_time}${offset ? ` — ${offset} min from now` : ""}`,
        tag: `event-${event.id}`,
        url: "/"
      } });
    }

    for (const reminder of custom) {
      if (reminder.user_id !== userId) continue;
      if (!reminder.time || reminder.completed) continue;
      if (reminder.date !== userDate) continue;
      const fireMinutes = parseClock(reminder.time);
      if (fireMinutes === null) continue;
      const ago = userNowMinutes - fireMinutes;
      if (ago < -2 || ago > 5) continue;
      const fireKey = `${userId}:reminder:${reminder.id}:${reminder.date}:${fireMinutes}`;
      if (lastSent.has(fireKey)) continue;
      markSent(fireKey);
      payloads.push({ userId, payload: {
        title: reminder.title,
        body: reminder.note || `Reminder at ${reminder.time}`,
        tag: `reminder-${reminder.id}`,
        url: "/"
      } });
    }
  }

  for (const item of payloads) {
    for (const sub of byUser.get(item.userId) || []) {
      await sendPush(sub, item.payload);
    }
  }
}

function markSent(key) {
  lastSent.set(key, true);
  if (lastSent.size > MAX_TRACKED) {
    const oldest = lastSent.keys().next().value;
    lastSent.delete(oldest);
  }
}

async function loadDue(table, userIds) {
  if (table === "custom_reminders") {
    const { rows } = await getPool().query(
      `SELECT id, user_id, title, to_char(date, 'YYYY-MM-DD') AS date,
              to_char(time, 'HH24:MI') AS time, note, completed
       FROM custom_reminders WHERE user_id = ANY($1)`,
      [userIds]
    );
    return rows;
  }
  if (table === "calendar_events") {
    const { rows } = await getPool().query(
      `SELECT id, user_id, title, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(start_time, 'HH24:MI') AS start_time, reminder, all_day
       FROM calendar_events WHERE user_id = ANY($1)`,
      [userIds]
    );
    return rows;
  }
  const { rows } = await getPool().query(
    `SELECT id, user_id, name, to_char(date, 'YYYY-MM-DD') AS date,
            to_char(time, 'HH24:MI') AS time, reminder, completed
     FROM tasks WHERE user_id = ANY($1)`,
    [userIds]
  );
  return rows;
}

async function sendPush(sub, payload) {
  const message = JSON.stringify(payload);
  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    }, message);
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      try {
        await getPool().query("DELETE FROM push_subscriptions WHERE id = $1", [sub.sub_id]);
      } catch { /* already gone */ }
    } else {
      console.warn(`[push] send failed (${status || "?"}):`, err.message || err);
    }
  }
}

export { dateKey };