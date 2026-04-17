const Investment = require("../models/investment.model");

const getInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({ user_id: req.user._id }).sort({ investment_start_date: -1 });
    // Portfolio summary
    const totalInvested = investments.reduce((s, i) => s + i.amount_invested, 0);
    const totalValue    = investments.reduce((s, i) => s + (i.current_value || i.amount_invested), 0);
    const totalMonthly  = investments.reduce((s, i) => s + (i.monthly_contribution || 0), 0);
    res.json({
      success: true,
      data: investments,
      summary: { totalInvested, totalValue, totalMonthly, gainLoss: totalValue - totalInvested },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createInvestment = async (req, res) => {
  try {
    const inv = await Investment.create({ ...req.body, user_id: req.user._id });
    res.status(201).json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateInvestment = async (req, res) => {
  try {
    const inv = await Investment.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!inv) return res.status(404).json({ success: false, error: "Investment not found" });
    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteInvestment = async (req, res) => {
  try {
    const inv = await Investment.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!inv) return res.status(404).json({ success: false, error: "Investment not found" });
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getInvestments, createInvestment, updateInvestment, deleteInvestment };