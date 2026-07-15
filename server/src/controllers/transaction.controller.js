import { z } from "zod";
import Transaction, { PAYMENT_METHODS } from "../models/Transaction.js";
import Category from "../models/Category.js";
import { recalcOrderTotals } from "../services/orderTotals.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, badRequest } from "../utils/ApiError.js";

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Сумма должна быть больше 0"),
  date: z.coerce.date(),
  category: z.string().min(1, "Категория не выбрана"),
  order: z.string().optional().nullable(),
  customer: z.string().optional().nullable(),
  description: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

const TYPE_RU = { income: "приход", expense: "расход" };

// Тип категории обязан совпадать с типом транзакции — иначе «приход» попадёт в
// категорию расходов и отчёт будет неверным.
async function assertCategoryMatches(categoryId, type) {
  const cat = await Category.findById(categoryId);
  if (!cat) throw notFound("Категория не найдена");
  if (cat.type !== type) {
    throw badRequest(
      `«${cat.name}» — категория типа «${TYPE_RU[cat.type]}», её нельзя использовать для операции «${TYPE_RU[type]}»`
    );
  }
}

export const list = asyncHandler(async (req, res) => {
  const { type, category, order, from, to, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 50);

  const filter = {};
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (order) filter.order = order;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (q) filter.description = new RegExp(q, "i");

  const [items, total, sums] = await Promise.all([
    Transaction.find(filter)
      .populate("category", "name type color")
      .populate("order", "orderNumber title")
      .populate("customer", "name")
      .sort("-date -createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
  ]);

  const income = sums.find((s) => s._id === "income")?.total || 0;
  const expense = sums.find((s) => s._id === "expense")?.total || 0;

  res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    // Итоги по записям, попавшим под фильтр — показываются над таблицей.
    summary: { income, expense, balance: income - expense },
  });
});

export const create = asyncHandler(async (req, res) => {
  await assertCategoryMatches(req.body.category, req.body.type);

  const tx = await Transaction.create({
    ...req.body,
    order: req.body.order || undefined,
    customer: req.body.customer || undefined,
    createdBy: req.user._id,
  });

  if (tx.order) await recalcOrderTotals(tx.order);

  await tx.populate([
    { path: "category", select: "name type color" },
    { path: "order", select: "orderNumber title" },
  ]);
  res.status(201).json(tx);
});

export const update = asyncHandler(async (req, res) => {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) throw notFound("Транзакция не найдена");

  await assertCategoryMatches(req.body.category, req.body.type);

  const prevOrder = tx.order ? String(tx.order) : null;

  Object.assign(tx, req.body, {
    order: req.body.order || undefined,
    customer: req.body.customer || undefined,
  });
  await tx.save();

  // Если заказ изменился, пересчитать нужно и старый.
  const nextOrder = tx.order ? String(tx.order) : null;
  const affected = new Set([prevOrder, nextOrder].filter(Boolean));
  await Promise.all([...affected].map(recalcOrderTotals));

  await tx.populate([
    { path: "category", select: "name type color" },
    { path: "order", select: "orderNumber title" },
  ]);
  res.json(tx);
});

export const remove = asyncHandler(async (req, res) => {
  const tx = await Transaction.findByIdAndDelete(req.params.id);
  if (!tx) throw notFound("Транзакция не найдена");
  if (tx.order) await recalcOrderTotals(tx.order);
  res.json({ message: "Удалено" });
});
