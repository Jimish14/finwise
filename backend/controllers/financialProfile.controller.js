const FinancialProfile = require("../models/financialProfile.model");

const getProfile = async (req, res) => {
  try {
    const profile = await FinancialProfile.findOne({ user_id: req.user._id });
    if (!profile) return res.status(404).json({ success: false, error: "Profile not set up yet" });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const upsertProfile = async (req, res) => {
  try {
    const profile = await FinancialProfile.findOneAndUpdate(
      { user_id: req.user._id },
      { ...req.body, user_id: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getProfile, upsertProfile };