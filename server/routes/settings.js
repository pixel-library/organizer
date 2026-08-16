import { Router } from "express";
import { AppError } from "../utils/AppError.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db.js";

const router = Router();

const THEMES = new Set(["dark", "light", "system"]);
const DEFAULT_SETTINGS = { theme: "system" };

const normalizeSettings = (row) => ({ theme: row?.theme || DEFAULT_SETTINGS.theme });

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await getPool().query("SELECT theme FROM settings WHERE user_id = $1", [req.user.id]);
    res.json(normalizeSettings(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const theme = req.body?.theme;
    if (theme === undefined || !THEMES.has(theme)) {
      throw new AppError("theme must be one of: dark, light, system", 400);
    }
    await getPool().query(
      `INSERT INTO settings (user_id, theme, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, updated_at = now()`,
      [req.user.id, theme]
    );
    res.json({ theme });
  } catch (err) {
    next(err);
  }
});

export default router;
