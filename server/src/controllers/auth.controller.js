import jwt from "jsonwebtoken";
import { z } from "zod";
import User, { ROLES } from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { unauthorized, badRequest, notFound } from "../utils/ApiError.js";

const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

export const registerSchema = z.object({
  name: z.string().min(2, "Имя — минимум 2 символа"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль — минимум 6 символов"),
  role: z.enum(ROLES).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

// Регистрация. Если в базе нет ни одного пользователя, первый становится
// админом (bootstrap). Дальше новых пользователей может добавлять только админ.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const count = await User.countDocuments();

  if (count > 0) {
    if (!req.user || req.user.role !== "admin") {
      throw unauthorized("Добавлять пользователей может только администратор");
    }
  }

  const exists = await User.findOne({ email });
  if (exists) throw badRequest("Этот email уже зарегистрирован");

  const user = await User.create({
    name,
    email,
    password,
    role: count === 0 ? "admin" : role || "viewer",
  });

  res.status(201).json({
    user: publicUser(user),
    ...(count === 0 ? { token: signToken(user) } : {}),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw unauthorized("Неверный email или пароль");
  }
  if (!user.isActive) throw unauthorized("Ваш аккаунт заблокирован");

  res.json({ user: publicUser(user), token: signToken(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// --- Управление пользователями (только админ) ---

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort("-createdAt");
  res.json(users.map(publicUser));
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound("Пользователь не найден");

  // Админ не может менять свою роль или отключить себя — иначе в системе может
  // не остаться ни одного администратора.
  const isSelf = String(user._id) === String(req.user._id);
  if (isSelf && (req.body.role || req.body.isActive === false)) {
    throw badRequest("Нельзя изменить собственную роль или заблокировать себя");
  }

  Object.assign(user, req.body);
  await user.save();
  res.json(publicUser(user));
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw badRequest("Нельзя удалить самого себя");
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw notFound("Пользователь не найден");
  res.json({ message: "Удалено" });
});
