import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { unauthorized, forbidden } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw unauthorized("Токен не передан");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthorized("Токен недействителен или истёк");
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw unauthorized("Пользователь неактивен");

  req.user = user;
  next();
});

// Доступ только указанным ролям. Например: allow("admin", "accountant")
export const allow =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        forbidden(`Недостаточно прав для этого действия (ваша роль: ${req.user.role})`)
      );
    }
    next();
  };

// Операции записи — запрещены роли viewer.
export const canWrite = allow("admin", "accountant");
export const adminOnly = allow("admin");
