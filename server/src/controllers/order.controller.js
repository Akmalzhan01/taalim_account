import { z } from "zod";
import Order, { ALL_ORDER_STATUSES, PRIORITIES } from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, conflict } from "../utils/ApiError.js";

const itemSchema = z.object({
  name: z.string().min(1, "Укажите название позиции"),
  qty: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0).optional().default(0),
  unitPrice: z.coerce.number().min(0),
});

export const orderSchema = z.object({
  customer: z.string().min(1, "Клиент не выбран"),
  title: z.string().min(2, "Заголовок — минимум 2 символа"),
  description: z.string().optional(),
  items: z.array(itemSchema).min(1, "Добавьте хотя бы одну позицию"),
  status: z.enum(ALL_ORDER_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  deadline: z.coerce.date().optional().nullable(),
});

export const moveSchema = z.object({
  status: z.enum(ALL_ORDER_STATUSES),
  position: z.coerce.number().int().min(0),
});

// Считает себестоимость и цену каждой позиции, а из них — итоги заказа.
// Суммы с фронтенда на веру не берём: прибыль партнёров зависит от этих чисел.
function priceOrder(items) {
  const priced = items.map((i) => ({
    ...i,
    cost: Math.round(i.qty * (i.unitCost || 0) * 100) / 100,
    amount: Math.round(i.qty * i.unitPrice * 100) / 100,
  }));
  return {
    priced,
    totalAmount: priced.reduce((s, i) => s + i.amount, 0),
    costAmount: priced.reduce((s, i) => s + i.cost, 0),
  };
}

// Заказ попадает в прибыль месяца по дате выдачи. Ставим её при переходе в
// «Выдан» и снимаем, если заказ вернули на более ранний этап, — иначе прибыль
// осталась бы засчитанной за месяц, к которому заказ больше не относится.
function syncDeliveredAt(order) {
  if (order.status === "delivered") {
    if (!order.deliveredAt) order.deliveredAt = new Date();
  } else {
    order.deliveredAt = null;
  }
}

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.q)
    filter.$or = [
      { title: new RegExp(req.query.q, "i") },
      { orderNumber: new RegExp(req.query.q, "i") },
    ];

  const items = await Order.find(filter)
    .populate("customer", "name company phone")
    .sort("-createdAt");
  res.json(items);
});

// Доска канбана — заказы, сгруппированные по колонкам.
export const board = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ status: { $ne: "cancelled" } })
    .populate("customer", "name company")
    .sort("position createdAt");

  const columns = {};
  for (const st of ALL_ORDER_STATUSES.filter((s) => s !== "cancelled")) {
    columns[st] = [];
  }
  for (const o of orders) columns[o.status]?.push(o);

  res.json(columns);
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "customer",
    "name company phone"
  );
  if (!order) throw notFound("Заказ не найден");

  const transactions = await Transaction.find({ order: order._id })
    .populate("category", "name type color")
    .sort("-date");

  res.json({ ...order.toJSON(), transactions });
});

export const create = asyncHandler(async (req, res) => {
  const { priced, totalAmount, costAmount } = priceOrder(req.body.items);

  // Новая карточка попадает в начало колонки.
  const status = req.body.status || "new";
  const top = await Order.findOne({ status }).sort("position");
  const position = (top?.position ?? 0) - 1;

  const order = new Order({
    ...req.body,
    items: priced,
    totalAmount,
    costAmount,
    status,
    position,
    createdBy: req.user._id,
  });
  syncDeliveredAt(order);
  await order.save();

  await order.populate("customer", "name company phone");
  res.status(201).json(order);
});

export const update = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Заказ не найден");

  const { priced, totalAmount, costAmount } = priceOrder(req.body.items);
  Object.assign(order, req.body, { items: priced, totalAmount, costAmount });
  syncDeliveredAt(order);
  await order.save();

  await order.populate("customer", "name company phone");
  res.json(order);
});

// Перетаскивание карточки в канбане: меняет колонку и позицию.
export const move = asyncHandler(async (req, res) => {
  const { status, position } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Заказ не найден");

  // Перенумеровываем карточки целевой колонки в новом порядке — так позиции
  // остаются целыми и не повторяются.
  const siblings = await Order.find({
    status,
    _id: { $ne: order._id },
  }).sort("position createdAt");

  siblings.splice(Math.min(position, siblings.length), 0, order);

  order.status = status;
  syncDeliveredAt(order);

  await Promise.all(
    siblings.map((doc, idx) =>
      Order.updateOne(
        { _id: doc._id },
        // Дату выдачи меняем только у перетащенной карточки — у соседей она своя.
        doc._id.equals(order._id)
          ? { position: idx, status, deliveredAt: order.deliveredAt }
          : { position: idx, status }
      )
    )
  );

  const updated = await Order.findById(order._id).populate(
    "customer",
    "name company"
  );
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  const linked = await Transaction.countDocuments({ order: req.params.id });
  if (linked > 0) {
    throw conflict(
      `К заказу привязано ${linked} транзакций. Сначала удалите их или переведите заказ в статус «Отменён».`
    );
  }
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw notFound("Заказ не найден");
  res.json({ message: "Удалено" });
});
