import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";
import { computeDashboard, computeAnalytics } from "../utils/stats.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const collection = (table) =>
      getPool().query("SELECT * FROM " + table + " WHERE user_id = $1", [userId]).then((r) => r.rows);

    const [tasks, events, meals, goals, notes, habits] = await Promise.all([
      collection("tasks"),
      collection("calendar_events"),
      collection("meals"),
      collection("goals"),
      collection("notes"),
      collection("habits")
    ]);

    const dashboard = computeDashboard(tasks, events, meals, goals, notes, habits);
    const analytics = computeAnalytics(tasks, events, habits);

    res.json({ dashboard, analytics });
  } catch (err) {
    next(err);
  }
});

export default router;
