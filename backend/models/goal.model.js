const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    goal_name: { type: String, required: true, trim: true },
    goal_category: {
      type: String,
      enum: ["vehicle", "gadget", "travel", "investment", "education", "other"],
      required: true,
    },
    current_price: { type: Number, required: true },
    expected_inflation_rate: { type: Number, default: 0 },
    target_amount: { type: Number },
    current_amount: { type: Number, default: 0 },
    existing_allocation: { type: Number, default: 0 },
    goal_start_date: { type: Date, required: true },
    goal_target_date: { type: Date, required: true, index: true },
    time_horizon_months: { type: Number },
    priority_level: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    goal_type: { type: String, enum: ["one-time", "recurring"], default: "one-time" },
    auto_adjust_inflation: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "completed", "paused"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Goal", goalSchema);