// Vercel-функция для API. Все запросы /api/* приходят сюда через rewrite в
// vercel.json. Сама логика — в server/api/index.js; здесь только точка входа.
export { default } from "../server/api/index.js";
