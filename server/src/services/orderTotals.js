import mongoose from "mongoose";
import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";

// Оплаченная сумма и расходы заказа выводятся из привязанных к нему транзакций.
// Вызывается при создании/изменении/удалении транзакции — благодаря этому
// Order.paidAmount никогда не расходится с реальными деньгами.
export async function recalcOrderTotals(orderId) {
  if (!orderId) return;
  const _id = new mongoose.Types.ObjectId(String(orderId));

  const rows = await Transaction.aggregate([
    { $match: { order: _id } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);

  const paid = rows.find((r) => r._id === "income")?.total || 0;
  const expense = rows.find((r) => r._id === "expense")?.total || 0;

  await Order.findByIdAndUpdate(_id, {
    paidAmount: paid,
    expenseAmount: expense,
  });
}
