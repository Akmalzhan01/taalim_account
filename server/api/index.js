// Точка входа для Vercel: тот же Express-app, но как серверлес-функция.
// Локально сервер запускается через `src/index.js` (app.listen); на Vercel
// listen не нужен — платформа сама вызывает этот обработчик на каждый запрос.
import "dotenv/config";
import connectDB from "../src/config/db.js";
import app from "../src/app.js";

export default async function handler(req, res) {
  const seen = req.url;

  // Express смонтирован на `/api`. Если платформа передала путь без этого
  // префикса — возвращаем его, иначе ни один маршрут не совпадёт.
  if (!req.url.startsWith("/api/") && req.url !== "/api") {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  const path = req.url.split("?")[0].replace(/\/$/, "");

  // Проверка живости — без базы. Отвечает, даже если БД не настроена, чтобы
  // отличить «функция не работает» от «не заданы переменные окружения».
  // Поле `seen` показывает, какой путь реально пришёл от Vercel.
  if (path === "/api/health") {
    return res
      .status(200)
      .json({ ok: true, seen, time: new Date().toISOString() });
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
