const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    investment_type: {
      type: String,
      enum: ["SIP", "Stocks", "FD", "Mutual Funds", "Crypto", "PPF", "Other"],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    amount_invested: { type: Number, required: true },
    current_value: { type: Number, default: 0 },
    monthly_contribution: { type: Number, default: 0 },
    expected_return_rate: { type: Number, default: 0 },
    liquidity_type: { type: String, enum: ["liquid", "semi-liquid", "locked"], default: "semi-liquid" },
    risk_level: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    investment_frequency: {
      type: String,
      enum: ["one-time", "monthly", "weekly", "yearly"],
      default: "one-time",
    },
    investment_start_date: { type: Date, required: true, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", investmentSchema);