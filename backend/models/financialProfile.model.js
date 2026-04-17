const mongoose = require("mongoose");

const financialProfileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    monthly_income: { type: Number, required: true },
    income_type: { type: String, enum: ["fixed", "variable", "freelance"], required: true },
    income_growth_rate: { type: Number, default: 0 },
    fixed_expenses: { type: Number, default: 0 },
    current_balance: { type: Number, default: 0 },
    total_savings: { type: Number, default: 0 },
    emergency_fund_balance: { type: Number, default: 0 },
    investment_balance: { type: Number, default: 0 },
    risk_profile: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    risk_appetite: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    saving_preference_ratio: { type: Number, default: 20 },
    fixed_expense_ratio: { type: Number, default: 40 },
    financial_dependents: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FinancialProfile", financialProfileSchema);