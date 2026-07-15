import mongoose from "mongoose";

export const DIST_STATUSES = ["draft", "approved", "paid"];

const shareSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    // Имя и процент замораживаются на момент создания распределения: если доля
    // партнёра позже изменится, старое распределение остаётся прежним.
    partnerName: { type: String, required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const distributionSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },

    // Расчёт прибыли замораживается целиком — чтобы через год было видно, из
    // чего сложилась выплата, даже если заказы задним числом отредактировали.
    revenue: { type: Number, default: 0 }, // продажи выданных заказов
    cogs: { type: Number, default: 0 }, // их себестоимость
    grossProfit: { type: Number, default: 0 }, // revenue − cogs
    otherIncome: { type: Number, default: 0 }, // приход вне заказов
    overhead: { type: Number, default: 0 }, // аренда, зарплата и т. п.
    orderCount: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 }, // grossProfit + otherIncome − overhead

    // Доля, которая остаётся в бизнесе (реинвестиция). Остальное делится.
    reinvestPercent: { type: Number, default: 0, min: 0, max: 100 },
    reinvestAmount: { type: Number, default: 0 },
    distributable: { type: Number, default: 0 },

    shares: [shareSchema],

    // Доля владельца — всё, что не роздано партнёрам. Отдельным партнёром он не
    // заводится, поэтому и в shares его нет; храним рядом.
    ownerPercent: { type: Number, default: 0, min: 0, max: 100 },
    ownerAmount: { type: Number, default: 0 },

    status: { type: String, enum: DIST_STATUSES, default: "draft" },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// На один месяц — только одно распределение.
distributionSchema.index({ year: 1, month: 1 }, { unique: true });

distributionSchema.virtual("totalPaid").get(function () {
  return (this.shares || []).reduce((s, x) => s + (x.paidAmount || 0), 0);
});

distributionSchema.virtual("totalUnpaid").get(function () {
  return (this.shares || []).reduce(
    (s, x) => s + Math.max(0, (x.amount || 0) - (x.paidAmount || 0)),
    0
  );
});

export default mongoose.model("Distribution", distributionSchema);
