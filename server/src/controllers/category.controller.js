import { z } from "zod";
import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, conflict } from "../utils/ApiError.js";

export const categorySchema = z.object({
  name: z.string().min(2, "Название — минимум 2 символа"),
  type: z.enum(["income", "expense"]),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  const items = await Category.find(filter).sort("type name");
  res.json(items);
});

export const create = asyncHandler(async (req, res) => {
  const item = await Category.create(req.body);
  res.status(201).json(item);
});

export const update = asyncHandler(async (req, res) => {
  const item = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) throw notFound("Категория не найдена");
  res.json(item);
});

export const remove = asyncHandler(async (req, res) => {
  // Если удалить используемую категорию, транзакции останутся «сиротами».
  const used = await Transaction.countDocuments({ category: req.params.id });
  if (used > 0) {
    throw conflict(
      `Категория используется в ${used} транзакциях. Вместо удаления сделайте её неактивной.`
    );
  }
  const item = await Category.findByIdAndDelete(req.params.id);
  if (!item) throw notFound("Категория не найдена");
  res.json({ message: "Удалено" });
});
