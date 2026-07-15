import { z } from "zod";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, conflict } from "../utils/ApiError.js";

export const customerSchema = z.object({
  name: z.string().min(2, "Имя — минимум 2 символа"),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(req.query.q, "i");
    filter.$or = [{ name: rx }, { company: rx }, { phone: rx }];
  }
  const items = await Customer.find(filter).sort("name");

  // Для каждого клиента — количество заказов и задолженность.
  const stats = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: "$customer",
        orderCount: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
        paidAmount: { $sum: "$paidAmount" },
      },
    },
  ]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));

  res.json(
    items.map((c) => {
      const s = byId.get(String(c._id));
      return {
        ...c.toObject(),
        orderCount: s?.orderCount || 0,
        totalAmount: s?.totalAmount || 0,
        paidAmount: s?.paidAmount || 0,
        dueAmount: Math.max(0, (s?.totalAmount || 0) - (s?.paidAmount || 0)),
      };
    })
  );
});

export const getOne = asyncHandler(async (req, res) => {
  const item = await Customer.findById(req.params.id);
  if (!item) throw notFound("Клиент не найден");
  const orders = await Order.find({ customer: item._id }).sort("-createdAt");
  res.json({ ...item.toObject(), orders });
});

export const create = asyncHandler(async (req, res) => {
  const item = await Customer.create(req.body);
  res.status(201).json(item);
});

export const update = asyncHandler(async (req, res) => {
  const item = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) throw notFound("Клиент не найден");
  res.json(item);
});

export const remove = asyncHandler(async (req, res) => {
  const used = await Order.countDocuments({ customer: req.params.id });
  if (used > 0) {
    throw conflict(
      `У этого клиента ${used} заказов. Вместо удаления сделайте его неактивным.`
    );
  }
  const item = await Customer.findByIdAndDelete(req.params.id);
  if (!item) throw notFound("Клиент не найден");
  res.json({ message: "Удалено" });
});
