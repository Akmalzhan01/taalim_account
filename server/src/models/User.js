import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = ["admin", "accountant", "viewer"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: "viewer" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Mongoose 8: async-хук не получает `next` — достаточно самого промиса.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("User", userSchema);
