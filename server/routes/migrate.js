import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const cleanText = (v, max = 200) => {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
};
const cleanDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const cleanTime = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
};
const num = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const asBool = (v) => (v === true || v === "true" || v === 1 ? true : false);
const cleanArray = (v) => (Array.isArray(v) ? v.map((i) => String(i)) : []);
const cleanTags = (v) => {
  if (Array.isArray(v)) return v.map((i) => String(i));
  if (typeof v === "string") return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return [];
};
const cleanWeekdays = (v) => {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((n) => {
    const numN = Number(n);
    return Number.isInteger(numN) ? numN : null;
  }).filter((n) => n !== null);
};
const cleanSubtasks = (v) => (Array.isArray(v) ? JSON.stringify(v) : JSON.stringify([]));

const PRIORITIES = ["Red", "Yellow", "Green"];
const TASK_COLORS = ["#313575", "#321951", "#633090", "#B22E37", "#F68318", "#FDC005"];
const cleanColor = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  return TASK_COLORS.includes(s) ? s : null;
};

const insertTasks = async (client, userId, rows) => {
  for (const t of rows ?? []) {
    await client.query(
      `INSERT INTO tasks (user_id, name, date, time, priority, reminder, completed, type, description, start_date, estimated_time, tags, subtasks, recurring, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        userId,
        cleanText(t.name, 200) || "Untitled task",
        cleanDate(t.date),
        cleanTime(t.time),
        PRIORITIES.includes(t.priority) ? t.priority : "Yellow",
        cleanText(t.reminder, 200),
        asBool(t.completed),
        cleanText(t.type, 50),
        cleanText(t.description, 2000),
        cleanDate(t.start_date),
        cleanText(t.estimated_time, 100),
        cleanTags(t.tags),
        cleanSubtasks(t.subtasks),
        cleanText(t.recurring, 100),
        cleanColor(t.color)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertNotes = async (client, userId, rows) => {
  for (const n of rows ?? []) {
    await client.query(
      `INSERT INTO notes (user_id, title, content, category, pinned, archived, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId,
        cleanText(n.title, 200) || "Untitled note",
        cleanText(n.content, 10000),
        cleanText(n.category, 50),
        asBool(n.pinned),
        asBool(n.archived),
        cleanTags(n.tags)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertCalendarEvents = async (client, userId, rows) => {
  for (const e of rows ?? []) {
    await client.query(
      `INSERT INTO calendar_events (user_id, title, start_date, end_date, start_time, end_time, all_day, category, location, description, reminder, recurrence, recurrence_end, custom_weekdays, overrides)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        userId,
        cleanText(e.title, 200) || "Untitled event",
        cleanDate(e.start_date) ?? cleanDate(e.start) ?? cleanDate(e.date),
        cleanDate(e.end_date) ?? cleanDate(e.end),
        cleanTime(e.start_time) ?? cleanTime(e.startTime) ?? cleanTime(e.time),
        cleanTime(e.end_time) ?? cleanTime(e.endTime),
        asBool(e.all_day),
        cleanText(e.category, 50),
        cleanText(e.location, 200),
        cleanText(e.description, 2000),
        cleanText(e.reminder, 200),
        cleanText(e.recurrence, 50),
        cleanDate(e.recurrence_end),
        cleanWeekdays(e.custom_weekdays),
        cleanSubtasks(e.overrides)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertGoals = async (client, userId, rows) => {
  for (const g of rows ?? []) {
    await client.query(
      "INSERT INTO goals (user_id, name, current, target, unit) VALUES ($1,$2,$3,$4,$5)",
      [userId, cleanText(g.name, 200) || "Untitled goal", num(g.current) ?? 0, num(g.target) ?? 1, cleanText(g.unit, 100)]
    );
  }
  return (rows ?? []).length;
};

const insertHabits = async (client, userId, rows) => {
  for (const h of rows ?? []) {
    const days = Array.isArray(h.days) && h.days.length === 7 ? h.days.map(asBool) : Array(7).fill(false);
    const history = (h.history ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))).map((d) => String(d));
    await client.query(
      "INSERT INTO habits (user_id, name, days, history) VALUES ($1,$2,$3,$4)",
      [userId, cleanText(h.name, 200) || "Untitled habit", days, history]
    );
  }
  return (rows ?? []).length;
};

const insertMeals = async (client, userId, rows) => {
  for (const m of rows ?? []) {
    await client.query(
      `INSERT INTO meals (user_id, date, type, name, time, calories, protein, carbohydrates, fat, ingredients, notes, status, day, breakfast, lunch, dinner, snack)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        userId,
        cleanDate(m.date),
        cleanText(m.type, 50),
        cleanText(m.name, 200) || "Untitled meal",
        cleanTime(m.time),
        num(m.calories),
        num(m.protein),
        num(m.carbohydrates),
        num(m.fat),
        cleanArray(m.ingredients),
        cleanText(m.notes, 2000),
        cleanText(m.status, 50),
        cleanText(m.day, 20),
        cleanText(m.breakfast, 200),
        cleanText(m.lunch, 200),
        cleanText(m.dinner, 200),
        cleanText(m.snack, 200)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertGroceryItems = async (client, userId, rows) => {
  for (const i of rows ?? []) {
    await client.query(
      "INSERT INTO grocery_items (user_id, name, category, quantity, unit, note, completed) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        userId,
        cleanText(i.name, 200) || "Untitled item",
        cleanText(i.category, 50),
        cleanText(i.quantity, 100),
        cleanText(i.unit, 100),
        cleanText(i.note, 500),
        asBool(i.completed)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertCustomReminders = async (client, userId, rows) => {
  for (const r of rows ?? []) {
    await client.query(
      "INSERT INTO custom_reminders (user_id, title, date, time, note, type, completed) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        userId,
        cleanText(r.title, 200) || "Untitled reminder",
        cleanDate(r.date),
        cleanTime(r.time),
        cleanText(r.note, 2000),
        cleanText(r.type, 50),
        asBool(r.completed)
      ]
    );
  }
  return (rows ?? []).length;
};

const insertActivityLog = async (client, userId, rows) => {
  for (const a of rows ?? []) {
    await client.query(
      "INSERT INTO activity_log (user_id, name, status, timestamp) VALUES ($1,$2,$3,$4)",
      [userId, cleanText(a.name, 200), cleanText(a.status, 100), cleanText(a.timestamp, 200)]
    );
  }
  return (rows ?? []).length;
};

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  const body = req.body ?? {};
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const counts = {
      tasks: await insertTasks(client, req.user.id, body.tasks),
      notes: await insertNotes(client, req.user.id, body.notes),
      calendarEvents: await insertCalendarEvents(client, req.user.id, body.calendarEvents),
      goals: await insertGoals(client, req.user.id, body.goals),
      habits: await insertHabits(client, req.user.id, body.habits),
      meals: await insertMeals(client, req.user.id, body.meals),
      groceryItems: await insertGroceryItems(client, req.user.id, body.groceryItems),
      customReminders: await insertCustomReminders(client, req.user.id, body.customReminders),
      activityLog: await insertActivityLog(client, req.user.id, body.activityLog)
    };
    await client.query("COMMIT");
    res.status(201).json({ migrated: counts });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;
