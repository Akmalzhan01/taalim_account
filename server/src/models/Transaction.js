import mongoose from "mongoose";

export const TX_TYPES = ["income", "expense"];
export const PAYMENT_METHODS = ["cash", "card", "bank", "invoice"];

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TX_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    // Привязка к заказу необязательна. Если она есть, оплаченная сумма и расходы
    // заказа пересчитываются автоматически.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    description: { type: String, trim: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ order: 1 });

export default mongoose.model("Transaction", transactionSchema);
