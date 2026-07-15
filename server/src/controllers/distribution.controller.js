import { z } from "zod";
import Distribution from "../models/Distribution.js";
import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, badRequest, conflict } from "../utils/ApiError.js";
import { computeMonth, monthRange } from "../services/profit.js";

export const createSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  reinvestPercent: z.coerce.number().min(0).max(100).optional().default(0),
  note: z.string().optional(),
});

export const paySchema = z.object({
  partner: z.string().min(1, "Партнёр не выбран"),
  amount: z.coerce.number().positive("Сумма должна быть больше 0"),
});

// Считает и показывает результат, ничего не сохраняя — чтобы посмотреть до
// создания распределения.
//
// Вместе с итогом отдаём расшифровку: какие заказы дали прибыль и какие расходы
// из неё вычтены. Без расшифровки легко не заметить, что расход на материал
// забыли привязать к заказу — и он вычелся вторым разом, поверх себестоимости.
export const preview = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const reinvestPercent = Number(req.query.reinvestPercent || 0);
  if (!year || !month) throw badRequest("Нужны параметры year и month");

  const { from, to } = monthRange(year, month);

  const [result, existing, orders, overheadItems] = await Promise.all([
    computeMonth(year, month, reinvestPercent),
    Distribution.findOne({ year, month }),
    Order.find({ status: "delivered", deliveredAt: { $gte: from, $lt: to } })
      .populate("customer", "name")
      .select("orderNumber title totalAmount costAmount deliveredAt customer")
      .sort("deliveredAt"),
    Transaction.find({ date: { $gte: from, $lt: to }, order: null })
      .populate("category", "name color type")
      .select("type amount date description category")
      .sort("-amount"),
  ]);

  res.json({
    ...result,
    existingId: existing?._id || null,
    orders: orders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      title: o.title,
      customerName: o.customer?.name || "",
      totalAmount: o.totalAmount,
      costAmount: o.costAmount,
      profit: o.profit,
      marginPercent: o.marginPercent,
      deliveredAt: o.deliveredAt,
    })),
    overheadItems,
  });
});

export const list = asyncHandler(async (_req, res) => {
  const items = await Distribution.find().sort("-year -month");
  res.json(items);
});

export const getOne = asyncHandler(async (req, res) => {
  const item = await Distribution.findById(req.params.id).populate(
    "shares.partner",
    "name phone"
  );
  if (!item) throw notFound("Распределение не найдено");
  res.json(item);
});

export const create = asyncHandler(async (req, res) => {
  const { year, month, reinvestPercent, note } = req.body;

  const exists = await Distribution.findOne({ year, month });
  if (exists) {
    throw conflict(`Распределение за ${month}.${year} уже существует`);
  }

  const c = await computeMonth(year, month, reinvestPercent);

  // Партнёров может не быть вовсе — тогда вся прибыль владельца. Ошибка только
  // если партнёрам роздано больше 100%: владельцу тогда осталось бы меньше нуля.
  if (!c.shareValid) {
    throw badRequest(
      `Партнёрам роздано ${c.shareTotal}% — больше 100%. Исправьте доли на странице «Партнёры».`
    );
  }
  if (c.isLoss) {
    throw badRequest(
      `Месяц закрыт с убытком (${c.netProfit}). Прибыль не распределяется.`
    );
  }
  if (c.orderCount === 0 && c.otherIncome === 0) {
    throw badRequest(
      `За ${month}.${year} нет ни одного выданного заказа. Прибыль считается по заказам в статусе «Выдан».`
    );
  }

  const dist = await Distribution.create({
    year,
    month,
    revenue: c.revenue,
    cogs: c.cogs,
    grossProfit: c.grossProfit,
    otherIncome: c.otherIncome,
    overhead: c.overhead,
    orderCount: c.orderCount,
    netProfit: c.netProfit,
    reinvestPercent: c.reinvestPercent,
    reinvestAmount: c.reinvestAmount,
    distributable: c.distributable,
    shares: c.shares,
    ownerPercent: c.ownerPercent,
    ownerAmount: c.ownerAmount,
    note,
    status: "draft",
    createdBy: req.user._id,
  });

  res.status(201).json(dist);
});

// Утверждение — после него суммы заморожены и можно проводить выплаты.
export const approve = asyncHandler(async (req, res) => {
  const dist = await Distribution.findById(req.params.id);
  if (!dist) throw notFound("Распределение не найдено");
  if (dist.status !== "draft") {
    throw badRequest("Утвердить можно только распределение в статусе «Черновик»");
  }
  dist.status = "approved";
  await dist.save();
  res.json(dist);
});

// Выплата партнёру.
//
// ВАЖНО: здесь намеренно НЕ создаётся транзакция расхода. Распределение прибыли
// — это не расход, а деление уже посчитанной прибыли. Если записать выплату как
// расход, прибыль следующего месяца уменьшится дважды.
export const pay = asyncHandler(async (req, res) => {
  const { partner, amount } = req.body;
  const dist = await Distribution.findById(req.params.id);
  if (!dist) throw notFound("Распределение не найдено");
  if (dist.status === "draft") {
    throw badRequest("Сначала утвердите распределение");
  }

  const share = dist.shares.find((s) => String(s.partner) === String(partner));
  if (!share) throw notFound("Этого партнёра нет в распределении");

  const remaining = share.amount - share.paidAmount;
  if (amount > remaining + 0.001) {
    throw badRequest(
      `Остаток к выплате этому партнёру — ${remaining.toLocaleString("ru-RU")}. Больше выплатить нельзя.`
    );
  }

  share.paidAmount = Math.round((share.paidAmount + amount) * 100) / 100;

  const allPaid = dist.shares.every((s) => s.paidAmount >= s.amount - 0.001);
  if (allPaid) dist.status = "paid";

  await dist.save();
  res.json(dist);
});

export const remove = asyncHandler(async (req, res) => {
  const dist = await Distribution.findById(req.params.id);
  if (!dist) throw notFound("Распределение не найдено");
  if (dist.status !== "draft") {
    throw badRequest(
      "Утверждённое распределение удалить нельзя — это разрушит историю отчётов"
    );
  }
  await dist.deleteOne();
  res.json({ message: "Удалено" });
});
