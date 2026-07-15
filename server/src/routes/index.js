import { Router } from "express";
import { protect, canWrite, adminOnly } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

import * as auth from "../controllers/auth.controller.js";
import * as category from "../controllers/category.controller.js";
import * as customer from "../controllers/customer.controller.js";
import * as partner from "../controllers/partner.controller.js";
import * as order from "../controllers/order.controller.js";
import * as task from "../controllers/task.controller.js";
import * as tx from "../controllers/transaction.controller.js";
import * as dist from "../controllers/distribution.controller.js";
import * as report from "../controllers/report.controller.js";

const r = Router();

// --- Аутентификация ---
// register: если в базе нет пользователей — открыт (первый админ), дальше нужен токен.
r.post(
  "/auth/register",
  (req, _res, next) => {
    if (req.headers.authorization) return protect(req, _res, next);
    next();
  },
  validate(auth.registerSchema),
  auth.register
);
r.post("/auth/login", validate(auth.loginSchema), auth.login);
r.get("/auth/me", protect, auth.me);

// --- Пользователи (только админ) ---
r.get("/users", protect, adminOnly, auth.listUsers);
r.patch(
  "/users/:id",
  protect,
  adminOnly,
  validate(auth.updateUserSchema),
  auth.updateUser
);
r.delete("/users/:id", protect, adminOnly, auth.deleteUser);

// --- Категории ---
r.get("/categories", protect, category.list);
r.post(
  "/categories",
  protect,
  canWrite,
  validate(category.categorySchema),
  category.create
);
r.patch(
  "/categories/:id",
  protect,
  canWrite,
  validate(category.categorySchema.partial()),
  category.update
);
r.delete("/categories/:id", protect, canWrite, category.remove);

// --- Клиенты ---
r.get("/customers", protect, customer.list);
r.get("/customers/:id", protect, customer.getOne);
r.post(
  "/customers",
  protect,
  canWrite,
  validate(customer.customerSchema),
  customer.create
);
r.patch(
  "/customers/:id",
  protect,
  canWrite,
  validate(customer.customerSchema.partial()),
  customer.update
);
r.delete("/customers/:id", protect, canWrite, customer.remove);

// --- Партнёры (доли меняет только админ) ---
r.get("/partners", protect, partner.list);
r.post(
  "/partners",
  protect,
  adminOnly,
  validate(partner.partnerSchema),
  partner.create
);
r.patch(
  "/partners/:id",
  protect,
  adminOnly,
  validate(partner.partnerSchema.partial()),
  partner.update
);
r.delete("/partners/:id", protect, adminOnly, partner.remove);

// --- Заказы / канбан ---
r.get("/orders", protect, order.list);
r.get("/orders/board", protect, order.board);
r.get("/orders/:id", protect, order.getOne);
r.post("/orders", protect, canWrite, validate(order.orderSchema), order.create);
r.patch(
  "/orders/:id",
  protect,
  canWrite,
  validate(order.orderSchema),
  order.update
);
r.patch(
  "/orders/:id/move",
  protect,
  canWrite,
  validate(order.moveSchema),
  order.move
);
r.delete("/orders/:id", protect, canWrite, order.remove);

// --- Повседневные задачи / канбан ---
r.get("/tasks", protect, task.list);
r.get("/tasks/board", protect, task.board);
r.post("/tasks", protect, canWrite, validate(task.taskSchema), task.create);
r.patch(
  "/tasks/:id",
  protect,
  canWrite,
  validate(task.taskSchema.partial()),
  task.update
);
r.patch(
  "/tasks/:id/move",
  protect,
  canWrite,
  validate(task.moveSchema),
  task.move
);
r.delete("/tasks/:id", protect, canWrite, task.remove);

// --- Приход-расход ---
r.get("/transactions", protect, tx.list);
r.post(
  "/transactions",
  protect,
  canWrite,
  validate(tx.transactionSchema),
  tx.create
);
r.patch(
  "/transactions/:id",
  protect,
  canWrite,
  validate(tx.transactionSchema),
  tx.update
);
r.delete("/transactions/:id", protect, canWrite, tx.remove);

// --- Распределение прибыли ---
r.get("/distributions", protect, dist.list);
r.get("/distributions/preview", protect, dist.preview);
r.get("/distributions/:id", protect, dist.getOne);
r.post(
  "/distributions",
  protect,
  adminOnly,
  validate(dist.createSchema),
  dist.create
);
r.patch("/distributions/:id/approve", protect, adminOnly, dist.approve);
r.post(
  "/distributions/:id/pay",
  protect,
  adminOnly,
  validate(dist.paySchema),
  dist.pay
);
r.delete("/distributions/:id", protect, adminOnly, dist.remove);

// --- Отчёты ---
r.get("/reports/dashboard", protect, report.dashboard);
r.get("/reports/summary", protect, report.summary);

export default r;
