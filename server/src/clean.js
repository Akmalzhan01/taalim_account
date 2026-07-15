import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/db.js";

import User from "./models/User.js";
import Partner from "./models/Partner.js";
import Category from "./models/Category.js";
import Customer from "./models/Customer.js";
import Order from "./models/Order.js";
import Transaction from "./models/Transaction.js";
import Distribution from "./models/Distribution.js";
import Counter from "./models/Counter.js";

const KEEP_EMAIL = "admin@poligraf.kg";
const KEEP_PASSWORD = "admin123";

/**
 * Убирает демо-данные, но оставляет справочник категорий и одного администратора.
 * В отличие от `seed`, ничего не создаёт заново — база остаётся пустой и готовой
 * к вводу настоящих данных.
 */
async function clean() {
  await connectDB(process.env.MONGO_URI);

  // Оставляем самого старого админа: обычно это тот, под которым уже входили.
  let admin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });

  if (!admin) {
    // Без администратора в систему не войти — создаём заново.
    admin = await User.create({
      name: "Администратор",
      email: KEEP_EMAIL,
      password: KEEP_PASSWORD,
      role: "admin",
    });
    console.log(`👤 Администратор создан: ${KEEP_EMAIL} / ${KEEP_PASSWORD}`);
  }

  const [users, partners, customers, orders, transactions, distributions] =
    await Promise.all([
      User.deleteMany({ _id: { $ne: admin._id } }),
      Partner.deleteMany({}),
      Customer.deleteMany({}),
      Order.deleteMany({}),
      Transaction.deleteMany({}),
      Distribution.deleteMany({}),
      // Сброс счётчика: следующий заказ снова получит номер P-0001.
      Counter.deleteMany({}),
    ]);

  const categories = await Category.countDocuments();

  console.log("\n🧹 Демо-данные удалены:\n");
  console.log(`   пользователи    -${users.deletedCount}`);
  console.log(`   партнёры        -${partners.deletedCount}`);
  console.log(`   клиенты         -${customers.deletedCount}`);
  console.log(`   заказы          -${orders.deletedCount}`);
  console.log(`   приход-расход   -${transactions.deletedCount}`);
  console.log(`   распределения   -${distributions.deletedCount}`);
  console.log("\n✅ Осталось:\n");
  console.log(`   категории       ${categories}`);
  console.log(`   администратор   ${admin.email}`);
  console.log("\nНумерация заказов начнётся заново с P-0001.\n");

  await mongoose.connection.close();
}

clean().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
