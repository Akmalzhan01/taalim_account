export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Маршрут не найден: ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Ошибка сервера";

  // Ошибка валидации Mongoose
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Некорректный ObjectId
  if (err.name === "CastError") {
    status = 400;
    message = `Некорректное значение поля ${err.path}: ${err.value}`;
  }

  // Нарушение уникального индекса
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {}).join(", ");
    message = `Такая запись уже существует (${field})`;
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== "production" && status === 500
      ? { stack: err.stack }
      : {}),
  });
}
