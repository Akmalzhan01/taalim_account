import "dotenv/config";
import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () =>
      console.log(`🚀 Сервер: http://localhost:${PORT}/api`)
    );
  })
  .catch((err) => {
    console.error("❌ Не удалось подключиться к MongoDB:", err.message);
    process.exit(1);
  });
