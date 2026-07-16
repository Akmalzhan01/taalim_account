// Точка входа для Vercel: тот же Express-app, но как серверлес-функция.
// Локально сервер запускается через `src/index.js` (app.listen); на Vercel
// listen не нужен — платформа сама вызывает этот обработчик на каждый запрос.
import "dotenv/config";
import connectDB from "../src/config/db.js";
import app from "../src/app.js";

export default async function handler(req, res) {
  // Vercel направляет сюда всё из папки /api, но путь приходит БЕЗ префикса
  // (например `/auth/login`, а не `/api/auth/login`). Express смонтирован на
  // `/api` — возвращаем префикс, чтобы маршруты совпали. startsWith — на случай,
  // если платформа однажды перестанет срезать префикс, чтобы не задвоить его.
  if (!req.url.startsWith("/api/") && req.url !== "/api") {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  const path = req.url.split("?")[0].replace(/\/$/, "");

  // Проверка живости — без базы. Отвечает, даже если БД не настроена, чтобы
  // отличить «функция не работает» от «не заданы переменные окружения».
  if (path === "/api/health") {
    return res.status(200).json({ ok: true, time: new Date().toISOString() });
  }

  if (!process.env.MONGO_URI) {
    return res.status(500).json({
      message:
        "Переменная MONGO_URI не задана. Добавьте её в Vercel → Settings → Environment Variables и сделайте Redeploy.",
    });
  }

  try {
    // Подключение кэшируется внутри connectDB — повторные вызовы бесплатны.
    await connectDB(process.env.MONGO_URI);
  } catch (err) {
    return res.status(500).json({
      message:
        "Не удалось подключиться к MongoDB. Проверьте строку MONGO_URI и что в Atlas → Network Access разрешён доступ с 0.0.0.0/0.",
      error: err.message,
    });
  }

  return app(req, res);
}
