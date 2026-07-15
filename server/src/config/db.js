import mongoose from "mongoose";

mongoose.set("strictQuery", true);

// В серверлес-среде (Vercel) один контейнер обслуживает много запросов и может
// «замораживаться» между ними. Открывать новое подключение на каждый вызов
// функции нельзя — оно бы утекало и упёрлось в лимит соединений Atlas. Поэтому
// кэшируем подключение на globalThis и переиспользуем между вызовами.
let cached = globalThis.__mongoose;
if (!cached) cached = globalThis.__mongoose = { conn: null, promise: null };

export default async function connectDB(uri) {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((m) => {
      console.log(`✅ MongoDB подключена: ${m.connection.name}`);
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
