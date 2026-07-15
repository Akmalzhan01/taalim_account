import { badRequest } from "../utils/ApiError.js";

// Проверяет req.body по zod-схеме и подставляет очищенное значение.
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return next(badRequest(msg));
  }
  req.body = result.data;
  next();
};
