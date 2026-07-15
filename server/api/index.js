// Точка входа для Vercel: тот же Express-app, но как серверлес-функция.
// Локально сервер запускается через `src/index.js` (app.listen); на Vercel
// listen не нужен — платформа сама вызывает этот обработчик на каждый запрос.
import "dotenv/config";
import connectDB from "../src/config/db.js";
import app from "../src/app.js";

export default async function handler(req, res) {
  // Подключение кэшируется внутри connectDB — повторные вызовы бесплатны.
  await connectDB(process.env.MONGO_URI);
  return app(req, res);
}
