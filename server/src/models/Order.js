import mongoose from "mongoose";
import { nextSeq } from "./Counter.js";

// Колонки канбана — этапы типографского заказа.
export const ORDER_STATUSES = [
  "new",
  "design",
  "printing",
  "finishing",
  "ready",
  "delivered",
];
// "cancelled" — не колонка: отменённый заказ уходит с доски.
export const ALL_ORDER_STATUSES = [...ORDER_STATUSES, "cancelled"];
export const PRIORITIES = ["low", "medium", "high"];

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },

    // unitCost — себестоимость единицы (бумага, краска, работа), unitPrice —
    // цена продажи. Обе считает сервер: cost = qty × unitCost, amount = qty × unitPrice.
    unitCost: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    items: [itemSchema],

    // Считаются из позиций (priceOrder). Вручную не задаются.
    totalAmount: { type: Number, default: 0, min: 0 }, // цена продажи
    costAmount: { type: Number, default: 0, min: 0 }, // себестоимость

    // paidAmount / expenseAmount пересчитываются из привязанных транзакций
    // (recalcOrderTotals). Это фактические деньги, а не расчёт прибыли.
    paidAmount: { type: Number, default: 0, min: 0 },
    expenseAmount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ALL_ORDER_STATUSES, default: "new" },

    // Момент, когда заказ отдан клиенту. Именно по этой дате заказ попадает в
    // прибыль месяца — не по дате создания и не по дате оплаты.
    deliveredAt: { type: Date, default: null },

    position: { type: Number, default: 0 },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    deadline: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Остаток долга — сколько клиент ещё должен заплатить.
orderSchema.virtual("dueAmount").get(function () {
  return Math.max(0, (this.totalAmount || 0) - (this.paidAmount || 0));
});

// Прибыль заказа = цена продажи − себестоимость. Не зависит от того, заплатил
// уже клиент или нет: неоплаченный заказ всё равно принёс прибыль, просто деньги
// пока в долге (dueAmount).
orderSchema.virtual("profit").get(function () {
  return Math.round(((this.totalAmount || 0) - (this.costAmount || 0)) * 100) / 100;
});

// Рентабельность, % от цены продажи.
orderSchema.virtual("marginPercent").get(function () {
  if (!this.totalAmount) return 0;
  return Math.round((this.profit / this.totalAmount) * 1000) / 10;
});

orderSchema.index({ status: 1, position: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ deliveredAt: 1 });

orderSchema.pre("save", async function () {
  if (this.isNew && !this.orderNumber) {
    const seq = await nextSeq("order");
    this.orderNumber = `P-${String(seq).padStart(4, "0")}`;
  }
});

export default mongoose.model("Order", orderSchema);
