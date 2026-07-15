export default class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new ApiError(400, msg);
export const unauthorized = (msg = "Требуется авторизация") =>
  new ApiError(401, msg);
export const forbidden = (msg = "Нет доступа") => new ApiError(403, msg);
export const notFound = (msg = "Не найдено") => new ApiError(404, msg);
export const conflict = (msg) => new ApiError(409, msg);
