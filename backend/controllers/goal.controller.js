const Goal = require("../models/goal.model");

const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user_id: req.user._id }).sort({ goal_target_date: 1 });
    res.json({ success: true, data: goals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getGoal = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!goal) return res.status(404).json({ success: false, error: "Goal not found" });
    res.json({ success: true, data: goal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createGoal = async (req, res) => {
  try {
    // Auto-calculate time_horizon_months
    const body = req.body;
    if (body.goal_start_date && body.goal_target_date) {
      const start  = new Date(body.goal_start_date);
      const target = new Date(body.goal_target_date);
      body.time_horizon_months = Math.max(1,
        (target.getFullYear() - start.getFullYear()) * 12 +
        (target.getMonth() - start.getMonth())
      );
    }
    const goal = await Goal.create({ ...body, user_id: req.user._id });
    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ success: false, error: "Goal not found" });
    res.json({ success: true, data: goal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!goal) return res.status(404).json({ success: false, error: "Goal not found" });
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getGoals, getGoal, createGoal, updateGoal, deleteGoal };