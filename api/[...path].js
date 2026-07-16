// Vercel обнаруживает функции в корневой папке /api. Это catch-all: сюда
// приходят ВСЕ запросы /api/* (например /api/auth/login). Функция получает
// полный путь, поэтому Express со своим app.use("/api", ...) его узнаёт.
//
// Сама логика — в server/api/index.js; здесь только точка входа для Vercel.
export { default } from "../server/api/index.js";
