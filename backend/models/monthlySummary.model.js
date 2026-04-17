const mongoose = require("mongoose");

const monthlySummarySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    total_income: { type: Number, default: 0 },
    total_expense: { type: Number, default: 0 },
    total_savings: { type: Number, default: 0 },
    savings_rate: { type: Number, default: 0 },
    essential_expense: { type: Number, default: 0 },
    non_essential_expense: { type: Number, default: 0 },
    top_spending_category: { type: String },
    discretionary_spending: { type: Number, default: 0 },
    recurring_expense_total: { type: Number, default: 0 },
  },
  { timestamps: true }
);

monthlySummarySchema.index({ user_id: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlySummary", monthlySummarySchema);