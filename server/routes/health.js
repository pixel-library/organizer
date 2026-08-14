import { Router } from "express";
import { getDatabaseStatus } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "life-organizer-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: getDatabaseStatus()
  });
});

export default router;
