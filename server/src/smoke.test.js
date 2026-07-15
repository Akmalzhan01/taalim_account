// Сквозная проверка: настоящие HTTP-запросы, настоящая MongoDB (в памяти).
// Запуск: npm test
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const { default: app } = await import("./app.js");

let mongo;
let passed = 0;
const failures = [];

const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ❌ ${name}\n     → ${err.message}`);
  }
};

const api = () => request(app);
let adminToken, viewerToken, accToken;

async function main() {
  // На Windows холодный старт медленный — стандартных 10 с не хватает.
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongo.getUri());
  console.log("\n🧪 Запуск проверок\n");

  // --- Аутентификация ---
  console.log("Аутентификация и роли:");

  await test("Первый пользователь автоматически становится админом", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Admin", email: "admin@test.kg", password: "admin123" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "admin");
    adminToken = res.body.token;
  });

  await test("Без токена второго пользователя добавить нельзя", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "Hacker", email: "h@test.kg", password: "123456" });
    assert.equal(res.status, 401);
  });

  await test("Админ может добавить бухгалтера и наблюдателя", async () => {
    for (const [email, role] of [
      ["buh@test.kg", "accountant"],
      ["view@test.kg", "viewer"],
    ]) {
      const res = await api()
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: role, email, password: "123456", role });
      assert.equal(res.status, 201, `${role} не добавлен`);
    }

    const acc = await api()
      .post("/api/auth/login")
      .send({ email: "buh@test.kg", password: "123456" });
    accToken = acc.body.token;

    const view = await api()
      .post("/api/auth/login")
      .send({ email: "view@test.kg", password: "123456" });
    viewerToken = view.body.token;
    assert.ok(accToken && viewerToken);
  });

  await test("Неверный пароль → 401", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: "admin@test.kg", password: "wrong" });
    assert.equal(res.status, 401);
  });

  // --- Категории и клиенты ---
  console.log("\nКатегории и клиенты:");

  let incomeCat, expenseCat, customer;

  await test("Бухгалтер может создать категорию", async () => {
    const i = await api()
      .post("/api/categories")
      .set("Authorization", `Bearer ${accToken}`)
      .send({ name: "Печатный заказ", type: "income" });
    const e = await api()
      .post("/api/categories")
      .set("Authorization", `Bearer ${accToken}`)
      .send({ name: "Бумага", type: "expense" });
    assert.equal(i.status, 201);
    assert.equal(e.status, 201);
    incomeCat = i.body._id;
    expenseCat = e.body._id;
  });

  await test("Наблюдатель не может создавать записи (403)", async () => {
    const res = await api()
      .post("/api/categories")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ name: "Тест", type: "income" });
    assert.equal(res.status, 403);
  });

  await test("Наблюдатель может читать", async () => {
    const res = await api()
      .get("/api/categories")
      .set("Authorization", `Bearer ${viewerToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
  });

  await test("Клиент создаётся", async () => {
    const res = await api()
      .post("/api/customers")
      .set("Authorization", `Bearer ${accToken}`)
      .send({ name: "Жасур", company: "Бек Маркет" });
    assert.equal(res.status, 201);
    customer = res.body._id;
  });

  // --- Заказы и оплаты ---
  console.log("\nЗаказы и оплаты:");

  let order;

  await test("Заказ: себестоимость, цена и прибыль считаются на сервере", async () => {
    const res = await api()
      .post("/api/orders")
      .set("Authorization", `Bearer ${accToken}`)
      .send({
        customer,
        title: "Визитки",
        items: [
          { name: "Визитки", qty: 5000, unitCost: 1.6, unitPrice: 3 },
          { name: "Флаеры", qty: 10000, unitCost: 1.3, unitPrice: 2.5 },
        ],
      });
    assert.equal(res.status, 201);
    // продажа:      5000×3    + 10000×2.5 = 15 000 + 25 000 = 40 000
    // себестоимость 5000×1.6  + 10000×1.3 =  8 000 + 13 000 = 21 000
    assert.equal(res.body.totalAmount, 40_000);
    assert.equal(res.body.costAmount, 21_000);
    assert.equal(res.body.profit, 19_000);
    assert.equal(res.body.marginPercent, 47.5);
    assert.equal(res.body.orderNumber, "P-0001");
    assert.equal(res.body.status, "new");
    assert.equal(res.body.deliveredAt, null, "новый заказ ещё не выдан");
    order = res.body._id;
  });

  await test("Приход обновляет оплаченную сумму заказа", async () => {
    const res = await api()
      .post("/api/transactions")
      .set("Authorization", `Bearer ${accToken}`)
      .send({
        type: "income",
        amount: 25_000,
        date: new Date().toISOString(),
        category: incomeCat,
        order,
        description: "Предоплата",
      });
    assert.equal(res.status, 201);

    const o = await api()
      .get(`/api/orders/${order}`)
      .set("Authorization", `Bearer ${accToken}`);
    assert.equal(o.body.paidAmount, 25_000);
    assert.equal(o.body.dueAmount, 15_000, "долг = 40 000 − 25 000");
  });

  let expenseTx;

  await test("Расход по заказу не меняет его прибыль (она уже в себестоимости)", async () => {
    const res = await api()
      .post("/api/transactions")
      .set("Authorization", `Bearer ${accToken}`)
      .send({
        type: "expense",
        amount: 12_000,
        date: new Date().toISOString(),
        category: expenseCat,
        order,
        description: "Бумага",
      });
    assert.equal(res.status, 201);
    expenseTx = res.body._id;

    const o = await api()
      .get(`/api/orders/${order}`)
      .set("Authorization", `Bearer ${accToken}`);
    // expenseAmount — это факт по кассе, прибыль же считается от плановой
    // себестоимости. Если бы расход ещё раз вычитался из прибыли, он бы
    // списался дважды: один раз в costAmount, второй — здесь.
    assert.equal(o.body.expenseAmount, 12_000, "факт потрачено");
    assert.equal(o.body.profit, 19_000, "прибыль = 40 000 − 21 000, не зависит от транзакций");
  });

  await test("Удаление транзакции пересчитывает фактические суммы заказа", async () => {
    await api()
      .delete(`/api/transactions/${expenseTx}`)
      .set("Authorization", `Bearer ${accToken}`);

    const o = await api()
      .get(`/api/orders/${order}`)
      .set("Authorization", `Bearer ${accToken}`);
    assert.equal(o.body.expenseAmount, 0, "после удаления факт должен обнулиться");
    assert.equal(o.body.profit, 19_000, "прибыль от удаления транзакции не меняется");
  });

  await test("К приходу нельзя привязать категорию расхода", async () => {
    const res = await api()
      .post("/api/transactions")
      .set("Authorization", `Bearer ${accToken}`)
      .send({
        type: "income",
        amount: 1000,
        date: new Date().toISOString(),
        category: expenseCat, // ошибка: категория расхода
      });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /расход/);
  });

  // --- Канбан ---
  console.log("\nДоска канбана:");

  await test("Доска возвращает заказы по колонкам", async () => {
    const res = await api()
      .get("/api/orders/board")
      .set("Authorization", `Bearer ${viewerToken}`);
    assert.equal(res.status, 200);
    assert.ok("new" in res.body && "delivered" in res.body);
    assert.equal(res.body.new.length, 1);
  });

  await test("Карточка переносится в другую колонку", async () => {
    const res = await api()
      .patch(`/api/orders/${order}/move`)
      .set("Authorization", `Bearer ${accToken}`)
      .send({ status: "printing", position: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "printing");

    const board = await api()
      .get("/api/orders/board")
      .set("Authorization", `Bearer ${accToken}`);
    assert.equal(board.body.new.length, 0);
    assert.equal(board.body.printing.length, 1);
  });

  await test("Наблюдатель не может двигать карточки (403)", async () => {
    const res = await api()
      .patch(`/api/orders/${order}/move`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ status: "ready", position: 0 });
    assert.equal(res.status, 403);
  });

  // --- Повседневные задачи ---
  console.log("\nПовседневные задачи:");

  let task;

  await test("Задача создаётся в колонке «Сделать»", async () => {
    const res = await api()
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accToken}`)
      .send({ title: "Купить бумагу", priority: "high" });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "todo");
    assert.equal(res.body.completedAt, null);
    task = res.body._id;
  });

  await test("Наблюдатель не может создавать задачи (403)", async () => {
    const res = await api()
      .post("/api/tasks")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Нельзя" });
    assert.equal(res.status, 403);
  });

  await test("Доска задач возвращает три колонки", async () => {
    const res = await api()
      .get("/api/tasks/board")
      .set("Authorization", `Bearer ${viewerToken}`);
    assert.equal(res.status, 200);
    assert.ok("todo" in res.body && "in_progress" in res.body && "done" in res.body);
    assert.equal(res.body.todo.length, 1);
  });

  await test("Перенос в «Готово» проставляет дату завершения", async () => {
    const res = await api()
      .patch(`/api/tasks/${task}/move`)
      .set("Authorization", `Bearer ${accToken}`)
      .send({ status: "done", position: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "done");
    assert.ok(res.body.completedAt, "дата завершения должна проставиться");
  });

  await test("Возврат из «Готово» снимает дату завершения", async () => {
    const res = await api()
      .patch(`/api/tasks/${task}/move`)
      .set("Authorization", `Bearer ${accToken}`)
      .send({ status: "in_progress", position: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.completedAt, null);
  });

  await test("Задача удаляется", async () => {
    const res = await api()
      .delete(`/api/tasks/${task}`)
      .set("Authorization", `Bearer ${accToken}`);
    assert.equal(res.status, 200);
  });

  // --- Партнёры и распределение прибыли ---
  console.log("\nПартнёры и распределение прибыли:");

  await test("Партнёров может добавлять только админ", async () => {
    const denied = await api()
      .post("/api/partners")
      .set("Authorization", `Bearer ${accToken}`)
      .send({ name: "X", sharePercent: 50 });
    assert.equal(denied.status, 403);

    for (const [name, pct] of [
      ["Акмалжан", 30],
      ["Бекзод", 20],
    ]) {
      const res = await api()
        .post("/api/partners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name, sharePercent: pct });
      assert.equal(res.status, 201);
    }
  });

  await test("Нерозданная доля достаётся владельцу", async () => {
    // Партнёрам роздано 30 + 20 = 50%. Остальные 50% — владельца, заводить себя
    // партнёром не нужно.
    const res = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.body.shareTotal, 50);
    assert.equal(res.body.ownerPercent, 50);
    assert.equal(res.body.shareValid, true, "50% партнёрам — это нормально");
  });

  await test("Раздать партнёрам больше 100% нельзя", async () => {
    const res = await api()
      .post("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Жадный", sharePercent: 60 }); // 50 + 60 = 110
    assert.equal(res.status, 400);
    assert.match(res.body.message, /100%/);
  });

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  await test("Невыданный заказ в прибыль не попадает", async () => {
    // Заказ сейчас в «Печати». Прибыль признаётся только по выдаче.
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.revenue, 0);
    assert.equal(res.body.orderCount, 0);
    assert.equal(res.body.netProfit, 0);
  });

  await test("Выдача заказа переносит его прибыль в текущий месяц", async () => {
    const res = await api()
      .patch(`/api/orders/${order}/move`)
      .set("Authorization", `Bearer ${accToken}`)
      .send({ status: "delivered", position: 0 });
    assert.equal(res.status, 200);
    assert.ok(res.body.deliveredAt, "дата выдачи должна проставиться");

    const p = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(p.body.revenue, 40_000);
    assert.equal(p.body.cogs, 21_000);
    assert.equal(p.body.grossProfit, 19_000);
    assert.equal(p.body.orderCount, 1);
  });

  await test("Расход без привязки к заказу вычитается из прибыли", async () => {
    const res = await api()
      .post("/api/transactions")
      .set("Authorization", `Bearer ${accToken}`)
      .send({
        type: "expense",
        amount: 4_000,
        date: new Date().toISOString(),
        category: expenseCat,
        description: "Аренда цеха", // без order → накладной расход
      });
    assert.equal(res.status, 201);

    const p = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(p.body.overhead, 4_000);
    assert.equal(p.body.netProfit, 15_000, "19 000 валовой − 4 000 накладных");
  });

  await test("Оплата клиента сама по себе прибыль не создаёт", async () => {
    // Приход 25 000 привязан к заказу — его сумма уже сидит в выручке заказа.
    // Если бы он считался ещё и отдельным доходом, прибыль удвоилась бы.
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.body.otherIncome, 0, "оплата заказа не должна идти в прочий доход");
    assert.equal(res.body.netProfit, 15_000);
  });

  await test("Прибыль делится между партнёрами и владельцем", async () => {
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.body.distributable, 15_000);

    const shares = res.body.shares;
    assert.equal(shares.length, 2, "владельца в shares быть не должно");
    assert.equal(shares.find((s) => s.partnerName === "Акмалжан").amount, 4_500);
    assert.equal(shares.find((s) => s.partnerName === "Бекзод").amount, 3_000);

    // 50% нероздано → владельцу
    assert.equal(res.body.ownerPercent, 50);
    assert.equal(res.body.ownerAmount, 7_500);
    assert.equal(res.body.partnersAmount, 7_500);
  });

  await test("Реинвестиция уменьшает распределяемую сумму", async () => {
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month, reinvestPercent: 20 })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.body.reinvestAmount, 3_000);
    assert.equal(res.body.distributable, 12_000);
    // 30% от 12 000 → 3 600; владельцу 50% → 6 000
    assert.equal(
      res.body.shares.find((s) => s.partnerName === "Акмалжан").amount,
      3_600
    );
    assert.equal(res.body.ownerAmount, 6_000);
  });

  await test("Партнёры + владелец = распределяемая сумма (тыйын не теряется)", async () => {
    // Берём процент, который не делится нацело
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month, reinvestPercent: 33.33 })
      .set("Authorization", `Bearer ${adminToken}`);

    const sum =
      res.body.shares.reduce((s, x) => s + x.amount, 0) + res.body.ownerAmount;
    assert.equal(
      Math.round(sum * 100),
      Math.round(res.body.distributable * 100),
      `партнёры + владелец = ${sum}, распределяемая ${res.body.distributable}`
    );
  });

  await test("Без партнёров вся прибыль достаётся владельцу", async () => {
    // Временно отключаем обоих партнёров.
    const list = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    for (const p of list.body.partners) {
      await api()
        .patch(`/api/partners/${p._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });
    }

    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.body.ownerPercent, 100);
    assert.equal(res.body.ownerAmount, 15_000);
    assert.equal(res.body.shares.length, 0);

    // Возвращаем партнёров обратно.
    for (const p of list.body.partners) {
      await api()
        .patch(`/api/partners/${p._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
    }
  });

  let distId;

  await test("Распределение создаётся (черновик)", async () => {
    const res = await api()
      .post("/api/distributions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year, month, reinvestPercent: 0 });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "draft");
    assert.equal(res.body.distributable, 15_000);
    // Расчёт заморожен целиком — по нему потом можно объяснить каждую цифру.
    assert.equal(res.body.revenue, 40_000);
    assert.equal(res.body.cogs, 21_000);
    assert.equal(res.body.overhead, 4_000);
    assert.equal(res.body.ownerPercent, 50);
    assert.equal(res.body.ownerAmount, 7_500);
    distId = res.body._id;
  });

  await test("На один месяц нельзя создать второе распределение", async () => {
    const res = await api()
      .post("/api/distributions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year, month });
    assert.equal(res.status, 409);
  });

  await test("Из неутверждённого распределения выплатить нельзя", async () => {
    const partners = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    const p = partners.body.partners[0];

    const res = await api()
      .post(`/api/distributions/${distId}/pay`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ partner: p._id, amount: 1000 });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /утвердите/i);
  });

  await test("После утверждения выплата проходит", async () => {
    await api()
      .patch(`/api/distributions/${distId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    const partners = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    const akmal = partners.body.partners.find((p) => p.name === "Акмалжан");

    const res = await api()
      .post(`/api/distributions/${distId}/pay`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ partner: akmal._id, amount: 4_500 });
    assert.equal(res.status, 200);

    const share = res.body.shares.find((s) => s.partnerName === "Акмалжан");
    assert.equal(share.paidAmount, 4_500);
  });

  await test("Больше своей доли выплатить нельзя", async () => {
    const partners = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    const bek = partners.body.partners.find((p) => p.name === "Бекзод");

    const res = await api()
      .post(`/api/distributions/${distId}/pay`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ partner: bek._id, amount: 999_999 }); // доля всего 3 000
    assert.equal(res.status, 400);
  });

  await test("Выплата партнёру НЕ пишется в расход (нет двойного учёта)", async () => {
    // Ключевая проверка: партнёру выплачено 4 500, но накладные расходы месяца
    // должны остаться прежними — иначе прибыль уменьшится второй раз.
    const res = await api()
      .get("/api/distributions/preview")
      .query({ year, month })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(
      res.body.overhead,
      4_000,
      "выплата партнёру превратилась в расход — прибыль уменьшится дважды!"
    );
    assert.equal(res.body.netProfit, 15_000);
  });

  await test("Баланс партнёра обновляется после выплаты", async () => {
    const res = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    const akmal = res.body.partners.find((p) => p.name === "Акмалжан");
    assert.equal(akmal.totalEarned, 4_500);
    assert.equal(akmal.totalPaid, 4_500);
    assert.equal(akmal.balance, 0, "выплачено полностью — долга быть не должно");

    const bek = res.body.partners.find((p) => p.name === "Бекзод");
    assert.equal(bek.balance, 3_000, "Бекзоду ещё не выплачено");
  });

  await test("Партнёра из распределения удалить нельзя", async () => {
    const partners = await api()
      .get("/api/partners")
      .set("Authorization", `Bearer ${adminToken}`);
    const akmal = partners.body.partners.find((p) => p.name === "Акмалжан");

    const res = await api()
      .delete(`/api/partners/${akmal._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 409);
  });

  await test("Утверждённое распределение удалить нельзя", async () => {
    const res = await api()
      .delete(`/api/distributions/${distId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 400);
  });

  // --- Отчёты ---
  console.log("\nОтчёты:");

  await test("Дашборд считает прибыль так же, как страница «Прибыль»", async () => {
    const res = await api()
      .get("/api/reports/dashboard")
      .set("Authorization", `Bearer ${viewerToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.kpi.revenue, 40_000);
    assert.equal(res.body.kpi.cogs, 21_000);
    assert.equal(res.body.kpi.grossProfit, 19_000);
    assert.equal(res.body.kpi.overhead, 4_000);
    assert.equal(res.body.kpi.netProfit, 15_000);
    // Дележ виден прямо на дашборде — не нужно идти на страницу «Прибыль».
    assert.equal(res.body.kpi.ownerPercent, 50);
    assert.equal(res.body.kpi.ownerAmount, 7_500);
    assert.equal(res.body.kpi.partnersAmount, 7_500);
    // Касса — это реальные деньги: получено 25 000, потрачено 4 000.
    assert.equal(res.body.kpi.cash, 21_000);
    assert.equal(res.body.kpi.receivable, 15_000, "долг клиента = 40 000 − 25 000");
    assert.equal(res.body.monthly.length, 12);
  });

  await test("Используемую категорию удалить нельзя", async () => {
    const res = await api()
      .delete(`/api/categories/${incomeCat}`)
      .set("Authorization", `Bearer ${accToken}`);
    assert.equal(res.status, 409);
  });

  // --- Итог ---
  console.log(
    `\n${failures.length === 0 ? "✅" : "❌"} Пройдено: ${passed}, провалено: ${failures.length}\n`
  );

  await mongoose.disconnect();
  await mongo.stop();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Тесты не запустились:", err);
  await mongo?.stop();
  process.exit(1);
});
