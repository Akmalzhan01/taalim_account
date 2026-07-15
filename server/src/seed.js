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
import { recalcOrderTotals } from "./services/orderTotals.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
  await connectDB(process.env.MONGO_URI);

  console.log("🧹 Очистка старых данных...");
  await Promise.all([
    User.deleteMany({}),
    Partner.deleteMany({}),
    Category.deleteMany({}),
    Customer.deleteMany({}),
    Order.deleteMany({}),
    Transaction.deleteMany({}),
    Distribution.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  // --- Пользователи ---
  const [admin, accountant] = await User.create([
    {
      name: "Акмалжан (Администратор)",
      email: "admin@poligraf.kg",
      password: "admin123",
      role: "admin",
    },
    {
      name: "Динара (Бухгалтер)",
      email: "buh@poligraf.kg",
      password: "buh123",
      role: "accountant",
    },
    {
      name: "Сардор (Наблюдатель)",
      email: "viewer@poligraf.kg",
      password: "viewer123",
      role: "viewer",
    },
  ]);

  // --- Партнёры: в сумме 100% ---
  const partners = await Partner.create([
    { name: "Акмалжан Тохтасинов", phone: "+996 700 12 34 56", sharePercent: 50 },
    { name: "Бекзод Рахимов", phone: "+996 555 23 45 67", sharePercent: 30 },
    { name: "Шохрух Кадыров", phone: "+996 770 34 56 78", sharePercent: 20 },
  ]);

  // --- Категории ---
  const incomeCats = await Category.create([
    { name: "Печатный заказ", type: "income", color: "#10b981" },
    { name: "Дизайн-услуги", type: "income", color: "#3b82f6" },
    { name: "Рекламный баннер", type: "income", color: "#8b5cf6" },
    { name: "Прочий доход", type: "income", color: "#64748b" },
  ]);

  const expenseCats = await Category.create([
    { name: "Бумага и материалы", type: "expense", color: "#ef4444" },
    { name: "Краска и тонер", type: "expense", color: "#f97316" },
    { name: "Зарплата", type: "expense", color: "#eab308" },
    { name: "Аренда", type: "expense", color: "#06b6d4" },
    { name: "Коммунальные услуги", type: "expense", color: "#14b8a6" },
    { name: "Ремонт оборудования", type: "expense", color: "#a855f7" },
    { name: "Транспорт", type: "expense", color: "#f43f5e" },
  ]);

  // --- Клиенты ---
  const customers = await Customer.create([
    { name: "Жасур Алиев", company: "Бек Маркет", phone: "+996 700 11 22 33" },
    { name: "Нодира Каримова", company: "Учебный центр «Нур»", phone: "+996 555 22 33 44" },
    { name: "Отабек Юсупов", company: "Юсупов Строй", phone: "+996 770 33 44 55" },
    { name: "Малика Ташева", company: "Malika Beauty", phone: "+996 500 44 55 66" },
    { name: "Рустам Эргашев", company: "Эргаш Логистика", phone: "+996 707 55 66 77" },
    { name: "Зилола Назарова", company: "Кафе «Зилола»", phone: "+996 559 66 77 88" },
  ]);

  // --- Заказы (карточки канбана) ---
  // Объёмы как в реальной типографии: один заказ 15 000 – 60 000 сом.
  // unitCost — себестоимость единицы (бумага, краска, работа), она примерно
  // 52–56% от цены. Так валовая прибыль (≈45%) перекрывает постоянные расходы
  // (зарплата + аренда ≈ 108 000 сом) и партнёрам остаётся что делить.
  const productTemplates = [
    { name: "Визитки (5000 шт)", qty: 5000, unitCost: 1.6, unitPrice: 3 },
    { name: "Флаеры А5 (10000 шт)", qty: 10000, unitCost: 1.3, unitPrice: 2.5 },
    { name: "Каталог А4 (1000 шт)", qty: 1000, unitCost: 25, unitPrice: 45 },
    { name: "Брошюра (800 шт)", qty: 800, unitCost: 30, unitPrice: 55 },
    { name: "Фирменная папка (500 шт)", qty: 500, unitCost: 36, unitPrice: 65 },
    { name: "Бланк А4 (5000 шт)", qty: 5000, unitCost: 2.2, unitPrice: 4 },
    { name: "Наклейки (3000 шт)", qty: 3000, unitCost: 4.8, unitPrice: 9 },
    { name: "Фирменный конверт (3000 шт)", qty: 3000, unitCost: 3.9, unitPrice: 7 },
    { name: "Настенный календарь (500 шт)", qty: 500, unitCost: 66, unitPrice: 120 },
    { name: "Баннер 3x2 м", qty: 6, unitCost: 1300, unitPrice: 2500 },
  ];

  const titles = [
    "Фирменные визитки",
    "Флаеры к открытию",
    "Уличный баннер",
    "Каталог продукции",
    "Фирменные бланки",
    "Брендовые наклейки",
    "Презентационные папки",
    "Ценники для магазина",
    "Праздничная афиша",
    "Печать меню",
    "Комплект конвертов и бланков",
    "Выставочный стенд",
    "Брошюра годового отчёта",
    "Новогодние календари",
    "Комплект наружной рекламы",
    "Этикетки для продукции",
  ];

  const now = new Date();
  const orders = [];
  let position = 0;

  const makeOrder = async (createdAt, status) => {
    const items = Array.from({ length: rnd(1, 2) }, () => {
      const t = pick(productTemplates);
      return {
        name: t.name,
        qty: t.qty,
        unitCost: t.unitCost,
        unitPrice: t.unitPrice,
        cost: t.qty * t.unitCost,
        amount: t.qty * t.unitPrice,
      };
    });
    const totalAmount = items.reduce((s, x) => s + x.amount, 0);
    const costAmount = items.reduce((s, x) => s + x.cost, 0);

    // Заказ попадает в прибыль месяца по дате выдачи — она должна остаться
    // внутри того же месяца, что и создание, иначе прибыль уедет в следующий.
    const deliveredAt =
      status === "delivered"
        ? new Date(
            Math.min(createdAt.getTime() + rnd(1, 3) * 86400000, now.getTime())
          )
        : null;

    const order = new Order({
      customer: pick(customers)._id,
      title: pick(titles),
      description: "Типографский заказ",
      items,
      totalAmount,
      costAmount,
      status,
      deliveredAt,
      position: position++,
      priority: pick(["low", "medium", "high"]),
      deadline: new Date(createdAt.getTime() + rnd(3, 20) * 86400000),
      createdBy: admin._id,
      createdAt,
    });
    await order.save();
    orders.push(order);
    return order;
  };

  // История: за последние 6 месяцев по 6 выполненных заказов в месяц.
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < 6; k++) {
      // День не позже 24-го: выдача случается через 1–3 дня и не должна
      // перескочить в следующий месяц (в феврале всего 28 дней).
      const maxDay = m === 0 ? Math.max(1, now.getUTCDate() - 1) : 24;
      const createdAt = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, rnd(1, maxDay))
      );
      await makeOrder(createdAt, "delivered");
    }
  }

  // Активные: карточки, которые сейчас висят на доске канбана.
  const activeStatuses = [
    "new",
    "new",
    "design",
    "design",
    "printing",
    "printing",
    "finishing",
    "ready",
    "ready",
  ];
  for (const status of activeStatuses) {
    await makeOrder(new Date(Date.now() - rnd(0, 12) * 86400000), status);
  }

  // --- Транзакции ---
  const txs = [];

  // Этап заказа определяет состояние оплаты.
  const PAID_RATIO = { printing: 0.5, finishing: 0.5, ready: 0.5 };

  for (const o of orders) {
    let ratio;
    if (o.status === "delivered") {
      // Большинство оплачено полностью, четверть — должники (чтобы была видна дебиторка).
      ratio = Math.random() > 0.25 ? 1 : 0.6;
    } else {
      ratio = PAID_RATIO[o.status] ?? 0; // new / design — оплаты ещё нет
    }

    if (ratio > 0) {
      txs.push({
        type: "income",
        amount: Math.round(o.totalAmount * ratio),
        date: new Date(o.createdAt.getTime() + 86400000),
        category: pick(incomeCats)._id,
        order: o._id,
        customer: o.customer,
        description: `${o.orderNumber} — ${
          ratio === 1 ? "полная оплата" : `предоплата ${ratio * 100}%`
        }`,
        paymentMethod: pick(["cash", "card", "bank"]),
        createdBy: accountant._id,
      });
    }

    // Материалы закупаются, когда заказ ушёл в печать — на этапах «Новый» и
    // «Дизайн» расходов ещё нет.
    //
    // Сумма равна себестоимости заказа и расход привязан к заказу. Привязка
    // обязательна: такие транзакции движут кассу, но в прибыль не идут — она
    // уже посчитана через costAmount. Расход без привязки к заказу считается
    // накладным и вычитается из прибыли повторно.
    if (!["new", "design"].includes(o.status) && o.costAmount > 0) {
      txs.push({
        type: "expense",
        amount: Math.round(o.costAmount),
        date: new Date(o.createdAt.getTime() + 43200000),
        category: pick([expenseCats[0], expenseCats[1]])._id,
        order: o._id,
        description: `Материалы для ${o.orderNumber}`,
        paymentMethod: "cash",
        createdBy: accountant._id,
      });
    }
  }

  // Постоянные ежемесячные расходы — последние 6 месяцев
  for (let m = 5; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 5));
    txs.push(
      {
        type: "expense",
        amount: 65_000,
        date: d,
        category: expenseCats[2]._id, // Зарплата
        description: "Зарплата сотрудников",
        paymentMethod: "card",
        createdBy: accountant._id,
      },
      {
        type: "expense",
        amount: 35_000,
        date: d,
        category: expenseCats[3]._id, // Аренда
        description: "Аренда цеха",
        paymentMethod: "bank",
        createdBy: accountant._id,
      },
      {
        type: "expense",
        amount: rnd(6_000, 11_000),
        date: d,
        category: expenseCats[4]._id, // Коммунальные
        description: "Свет, вода, интернет",
        paymentMethod: "bank",
        createdBy: accountant._id,
      }
    );

    // Доход, не привязанный к заказу
    txs.push({
      type: "income",
      amount: rnd(15_000, 40_000),
      date: new Date(d.getTime() + rnd(2, 20) * 86400000),
      category: incomeCats[1]._id,
      description: "Дизайн и вёрстка макетов",
      paymentMethod: pick(["cash", "card"]),
      createdBy: accountant._id,
    });
  }

  await Transaction.insertMany(txs);

  // Приводим суммы заказов в соответствие с реальными транзакциями.
  for (const o of orders) await recalcOrderTotals(o._id);

  console.log(`
✅ Данные загружены:
   Пользователи:  3
   Партнёры:      ${partners.length} (50% / 30% / 20%)
   Категории:     ${incomeCats.length + expenseCats.length}
   Клиенты:       ${customers.length}
   Заказы:        ${orders.length}
   Транзакции:    ${txs.length}

🔑 Доступы:
   admin@poligraf.kg  / admin123    (администратор — всё)
   buh@poligraf.kg    / buh123      (приход-расход, заказы, клиенты)
   viewer@poligraf.kg / viewer123   (только просмотр)
`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Ошибка загрузки данных:", err);
  process.exit(1);
});
