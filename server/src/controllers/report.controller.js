import Transaction from "../models/Transaction.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import asyncHandler from "../utils/asyncHandler.js";
import { monthRange, monthProfit, computeMonth } from "../services/profit.js";

const num = (rows, type) => rows.find((r) => r._id === type)?.total || 0;

export const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  const { to } = monthRange(year, month);

  // Начало 12-месячного окна для графика.
  const seriesFrom = new Date(Date.UTC(year - 1, month, 1));

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [
    profit,
    prevProfit,
    allRows,
    statusRows,
    dueRows,
    recent,
    orderSeries,
    txSeries,
    overheadByCategory,
    customerCount,
    pipelineRows,
  ] = await Promise.all([
    // Прибыль и её дележ считаются той же функцией, что и на странице «Прибыль», —
    // иначе цифры на двух страницах разошлись бы.
    computeMonth(year, month, 0),
    monthProfit(prevYear, prevMonth),
    // Остаток в кассе за всё время — это реальные деньги, тут учитываются
    // все транзакции, включая привязанные к заказам.
    Transaction.aggregate([
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    // Задолженность клиентов
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          paid: { $sum: "$paidAmount" },
        },
      },
    ]),
    Transaction.find()
      .populate("category", "name type color")
      .populate("order", "orderNumber")
      .sort("-date -createdAt")
      .limit(8),
    // Выручка и себестоимость по месяцам выдачи заказов
    Order.aggregate([
      {
        $match: {
          status: "delivered",
          deliveredAt: { $gte: seriesFrom, $lt: to },
        },
      },
      {
        $group: {
          _id: { y: { $year: "$deliveredAt" }, m: { $month: "$deliveredAt" } },
          revenue: { $sum: "$totalAmount" },
          cogs: { $sum: "$costAmount" },
        },
      },
    ]),
    // Доходы и расходы вне заказов — по месяцам
    Transaction.aggregate([
      { $match: { date: { $gte: seriesFrom, $lt: to }, order: null } },
      {
        $group: {
          _id: { y: { $year: "$date" }, m: { $month: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]),
    // Накладные расходы текущего месяца по статьям
    Transaction.aggregate([
      {
        $match: {
          type: "expense",
          order: null,
          date: { $gte: monthRange(year, month).from, $lt: to },
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: "$cat" },
      { $project: { _id: 0, name: "$cat.name", color: "$cat.color", total: 1 } },
    ]),
    Customer.countDocuments({ isActive: true }),
    // Прибыль, которая ещё «в работе»: заказы на доске, пока не выданные.
    // Она не в прибыли месяца, и без этой строки непонятно, почему прибыль ноль,
    // когда доска полна заказов.
    Order.aggregate([
      { $match: { status: { $nin: ["delivered", "cancelled"] } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          cogs: { $sum: "$costAmount" },
        },
      },
    ]),
  ]);

  const pipe = pipelineRows[0] || { revenue: 0, cogs: 0 };
  const pipelineProfit = Math.round((pipe.revenue - pipe.cogs) * 100) / 100;

  const ordersByStatus = {};
  for (const r of statusRows) ordersByStatus[r._id] = r.count;

  const due = dueRows[0] || { total: 0, paid: 0 };

  // Достраиваем 12-месячный ряд — месяцы без данных остаются нулями.
  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;

    const o = orderSeries.find((s) => s._id.y === y && s._id.m === m);
    const tx = (type) =>
      txSeries.find((s) => s._id.y === y && s._id.m === m && s._id.type === type)
        ?.total || 0;

    const revenue = (o?.revenue || 0) + tx("income");
    const cost = (o?.cogs || 0) + tx("expense");

    monthly.push({
      label: `${String(m).padStart(2, "0")}.${String(y).slice(2)}`,
      year: y,
      month: m,
      revenue,
      cost,
      profit: Math.round((revenue - cost) * 100) / 100,
    });
  }

  // Себестоимость заказов — самая крупная статья затрат, но она не транзакция.
  // Показываем её отдельной строкой, иначе картина расходов неполная.
  const topExpense = [
    ...(profit.cogs > 0
      ? [{ name: "Себестоимость заказов", color: "#0ea5e9", total: profit.cogs }]
      : []),
    ...overheadByCategory,
  ].sort((a, b) => b.total - a.total);

  res.json({
    period: { year, month },
    kpi: {
      revenue: profit.revenue,
      cogs: profit.cogs,
      grossProfit: profit.grossProfit,
      otherIncome: profit.otherIncome,
      overhead: profit.overhead,
      netProfit: profit.netProfit,
      orderCount: profit.orderCount,

      prevRevenue: prevProfit.revenue,
      prevNetProfit: prevProfit.netProfit,

      // Дележ чистой прибыли месяца: сколько партнёрам, сколько владельцу.
      shares: profit.shares,
      partnersAmount: profit.partnersAmount,
      ownerPercent: profit.ownerPercent,
      ownerAmount: profit.ownerAmount,
      shareTotal: profit.shareTotal,
      shareValid: profit.shareValid,

      // Прибыль незавершённых заказов — ещё не заработана.
      pipelineProfit,

      cash: num(allRows, "income") - num(allRows, "expense"),
      receivable: Math.max(0, due.total - due.paid),
      customers: customerCount,
      activeOrders: Object.entries(ordersByStatus)
        .filter(([s]) => s !== "delivered" && s !== "cancelled")
        .reduce((a, [, c]) => a + c, 0),
    },
    ordersByStatus,
    monthly,
    topExpense,
    recent,
  });
});

// Отчёт за произвольный период — в разрезе категорий.
export const summary = asyncHandler(async (req, res) => {
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const byCategory = await Transaction.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { category: "$category", type: "$type" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id.category",
        foreignField: "_id",
        as: "cat",
      },
    },
    { $unwind: "$cat" },
    {
      $project: {
        _id: 0,
        categoryId: "$_id.category",
        name: "$cat.name",
        color: "$cat.color",
        type: "$_id.type",
        total: 1,
        count: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);

  const income = byCategory
    .filter((c) => c.type === "income")
    .reduce((s, c) => s + c.total, 0);
  const expense = byCategory
    .filter((c) => c.type === "expense")
    .reduce((s, c) => s + c.total, 0);

  res.json({
    from,
    to,
    totals: { income, expense, profit: income - expense },
    income: byCategory.filter((c) => c.type === "income"),
    expense: byCategory.filter((c) => c.type === "expense"),
  });
});
