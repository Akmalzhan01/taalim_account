import { z } from "zod";
import Task, { TASK_STATUSES, TASK_PRIORITIES } from "../models/Task.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound } from "../utils/ApiError.js";

export const taskSchema = z.object({
  title: z.string().min(2, "Название — минимум 2 символа"),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const moveSchema = z.object({
  status: z.enum(TASK_STATUSES),
  position: z.coerce.number().int().min(0),
});

// Отметку о завершении держим в синхроне со статусом: перешла в «Готово» —
// ставим дату, вернули в работу — снимаем.
function syncCompletedAt(task) {
  if (task.status === "done") {
    if (!task.completedAt) task.completedAt = new Date();
  } else {
    task.completedAt = null;
  }
}

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await Task.find(filter).sort("position createdAt");
  res.json(items);
});

// Доска: задачи, сгруппированные по колонкам.
export const board = asyncHandler(async (_req, res) => {
  const tasks = await Task.find().sort("position createdAt");

  const columns = {};
  for (const st of TASK_STATUSES) columns[st] = [];
  for (const t of tasks) columns[t.status]?.push(t);

  res.json(columns);
});

export const create = asyncHandler(async (req, res) => {
  // Новая карточка встаёт в начало своей колонки.
  const status = req.body.status || "todo";
  const top = await Task.findOne({ status }).sort("position");
  const position = (top?.position ?? 0) - 1;

  const task = new Task({
    ...req.body,
    status,
    position,
    createdBy: req.user._id,
  });
  syncCompletedAt(task);
  await task.save();

  res.status(201).json(task);
});

export const update = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw notFound("Задача не найдена");

  Object.assign(task, req.body);
  syncCompletedAt(task);
  await task.save();

  res.json(task);
});

// Перетаскивание карточки: меняет колонку и позицию. Колонку перенумеровываем
// целиком, чтобы позиции оставались целыми и не повторялись.
export const move = asyncHandler(async (req, res) => {
  const { status, position } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) throw notFound("Задача не найдена");

  const siblings = await Task.find({
    status,
    _id: { $ne: task._id },
  }).sort("position createdAt");

  siblings.splice(Math.min(position, siblings.length), 0, task);

  task.status = status;
  syncCompletedAt(task);

  await Promise.all(
    siblings.map((doc, idx) =>
      Task.updateOne(
        { _id: doc._id },
        doc._id.equals(task._id)
          ? { position: idx, status, completedAt: task.completedAt }
          : { position: idx, status }
      )
    )
  );

  const updated = await Task.findById(task._id);
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) throw notFound("Задача не найдена");
  res.json({ message: "Удалено" });
});
