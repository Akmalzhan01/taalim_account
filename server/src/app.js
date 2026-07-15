import express from "express";
import cors from "cors";
import morgan from "morgan";

import routes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";

// Приложение Express без подключения к БД — поэтому его можно переиспользовать в тестах.
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
