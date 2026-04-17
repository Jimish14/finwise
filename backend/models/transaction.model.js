const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transaction_id: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["income", "expense"], required: true, index: true },
    category: { type: String, required: true, index: true },
    sub_category: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    merchant_name: { type: String, trim: true, index: true },
    date: { type: Date, required: true, index: true },
    payment_method: { type: String, enum: ["UPI", "Card", "Cash", "NetBanking", "Wallet"] },
    mode: { type: String, enum: ["online", "offline"] },
    tag: [{ type: String }],
    is_recurring: { type: Boolean, default: false },
    recurring_frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", null],
      default: null,
    },
    essential_flag: {
      type: String,
      enum: ["essential", "non-essential"],
      default: "essential",
    },
    location: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);