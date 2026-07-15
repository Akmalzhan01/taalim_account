import mongoose from "mongoose";

// Партнёр — совладелец бизнеса, получает долю от чистой прибыли.
const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    // Доля от чистой прибыли (%). Сумма долей активных партнёров должна быть 100.
    sharePercent: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Partner", partnerSchema);
