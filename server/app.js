import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestContext } from "./middleware/requestContext.js";
import { originCheck } from "./middleware/originCheck.js";
import { apiLimiter, adminLimiter } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import settingsRouter from "./routes/settings.js";
import adminRouter from "./routes/admin.js";
import tasksRouter from "./routes/tasks.js";
import notesRouter from "./routes/notes.js";
import calendarEventsRouter from "./routes/calendarEvents.js";
import statsRouter from "./routes/stats.js";
import goalsRouter from "./routes/goals.js";
import habitsRouter from "./routes/habits.js";
import mealsRouter from "./routes/meals.js";
import groceryItemsRouter from "./routes/groceryItems.js";
import customRemindersRouter from "./routes/customReminders.js";
import activityLogRouter from "./routes/activityLog.js";
import migrateRouter from "./routes/migrate.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Behind Netlify (and other reverse proxies), resolve the real client IP
  // from X-Forwarded-For so per-IP rate limits work in production.
  app.set("trust proxy", config.isProd ? 1 : false);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(requestContext);
  app.use(originCheck);
  app.use(apiLimiter);
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.get("/", (req, res) => {
    res.json({ service: "life-organizer-api", status: "ok" });
  });

  app.use(`${config.apiPrefix}/health`, healthRouter);
  app.use(`${config.apiPrefix}/auth`, authRouter);
  app.use(`${config.apiPrefix}/profile`, profileRouter);
  app.use(`${config.apiPrefix}/settings`, settingsRouter);
  app.use(`${config.apiPrefix}/admin`, adminLimiter, adminRouter);
  app.use(`${config.apiPrefix}/tasks`, tasksRouter);
  app.use(`${config.apiPrefix}/notes`, notesRouter);
  app.use(`${config.apiPrefix}/calendarEvents`, calendarEventsRouter);
  app.use(`${config.apiPrefix}/stats`, statsRouter);
  app.use(`${config.apiPrefix}/goals`, goalsRouter);
  app.use(`${config.apiPrefix}/habits`, habitsRouter);
  app.use(`${config.apiPrefix}/meals`, mealsRouter);
  app.use(`${config.apiPrefix}/groceryItems`, groceryItemsRouter);
  app.use(`${config.apiPrefix}/customReminders`, customRemindersRouter);
  app.use(`${config.apiPrefix}/activityLog`, activityLogRouter);
  app.use(`${config.apiPrefix}/migrate`, migrateRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
