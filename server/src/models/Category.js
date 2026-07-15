import mongoose from "mongoose";

export const TX_TYPES = ["income", "expense"];

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TX_TYPES, required: true },
    color: { type: String, default: "#64748b" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, type: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
