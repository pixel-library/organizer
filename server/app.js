import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestLogger);

  app.get("/", (req, res) => {
    res.json({ service: "life-organizer-api", status: "ok" });
  });

  app.use(`${config.apiPrefix}/health`, healthRouter);
  app.use(`${config.apiPrefix}/auth`, authRouter);
  app.use(`${config.apiPrefix}/profile`, profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
