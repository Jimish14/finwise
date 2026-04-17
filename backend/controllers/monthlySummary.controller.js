const MonthlySummary = require("../models/monthlySummary.model");

// @GET /api/monthly-summary  — returns last N months
const getMonthlySummaries = async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const summaries = await MonthlySummary.find({ user_id: req.user._id })
      .sort({ month: -1 }) // Sort newest first
      .limit(Number(months));
      
    // 🚨 FIX: Removed .reverse()! Now data[0] is always the CURRENT month.
    res.json({ success: true, data: summaries }); 
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getMonthlySummaries };