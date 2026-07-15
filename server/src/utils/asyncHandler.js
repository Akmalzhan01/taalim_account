// Express 5 сам ловит ошибки в async-обработчиках, но этот враппер делает
// намерение явным и работает даже при откате на Express 4.
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
