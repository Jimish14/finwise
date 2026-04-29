const axios     = require("axios");
const mongoose  = require("mongoose");
const MonthlySummary   = require("../models/monthlySummary.model");
const FinancialProfile = require("../models/financialProfile.model");
const Investment       = require("../models/investment.model");
const Goal             = require("../models/goal.model");
const Transaction      = require("../models/transaction.model");
const { getAIResponse } = require('../controllers/ai.controller');
const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:5000";

// ── Serialize Mongoose docs → plain JSON ─────────────────────────────────────
const toPlain = (doc) => {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(toPlain);
  if (doc && typeof doc.toObject === "function") {
    return JSON.parse(JSON.stringify(doc.toObject({ flattenObjectIds: true })));
  }
  return JSON.parse(JSON.stringify(doc));
};

// ── Call AI service with proper error message ─────────────────────────────────
const callAI = async (endpoint, data) => {
  try {
    const res = await axios.post(`${AI_URL}${endpoint}`, data, {
      timeout: 600000,
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (err) {
    const flaskMsg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      (err.code === "ECONNREFUSED"
        ? `AI service is not running. Start it with: cd ai_service && python app.py`
        : err.message);
    throw new Error(flaskMsg || "AI service unavailable");
  }
};

// ── Build monthly summaries from raw transactions (when MonthlySummary is empty) ─
const buildSyntheticSummaries = async (user_id) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Cast to ObjectId properly for aggregation
    const uid = typeof user_id === "string"
      ? new mongoose.Types.ObjectId(user_id)
      : user_id;

    const pipeline = [
      { $match: { user_id: uid, date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: "$date" },
            month: { $month: "$date" },
            type:  "$type",
          },
          total:         { $sum: "$amount" },
          non_essential: {
            $sum: { $cond: [{ $eq: ["$essential_flag", "non-essential"] }, "$amount", 0] },
          },
          recurring: {
            $sum: { $cond: [{ $toBool: "$is_recurring" }, "$amount", 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ];

    const raw = await Transaction.aggregate(pipeline);
    if (!raw || raw.length === 0) return [];

    const monthMap = {};
    for (const r of raw) {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: key,
          total_income: 0, total_expense: 0,
          non_essential_expense: 0, essential_expense: 0,
          recurring_expense_total: 0,
        };
      }
      if (r._id.type === "income") {
        monthMap[key].total_income += r.total;
      } else if (r._id.type === "expense") {
        monthMap[key].total_expense           += r.total;
        monthMap[key].non_essential_expense   += (r.non_essential || 0);
        monthMap[key].essential_expense       += (r.total - (r.non_essential || 0));
        monthMap[key].recurring_expense_total += (r.recurring || 0);
      }
    }

    return Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        total_savings: m.total_income - m.total_expense,
        savings_rate:  m.total_income > 0
          ? ((m.total_income - m.total_expense) / m.total_income) * 100
          : 0,
        top_spending_category: "Food", // default
      }));
  } catch (err) {
    console.error("buildSyntheticSummaries error:", err.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/ai/categorize
// ─────────────────────────────────────────────────────────────────
const categorize = async (req, res) => {
  try {
    const result = await callAI("/api/categorize", req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/ai/predict-expense
// ─────────────────────────────────────────────────────────────────
const predictExpense = async (req, res) => {
  try {
    // 1. Try real monthly summaries first
    const [dbSummaries, profile, transactions] = await Promise.all([
      MonthlySummary.find({ user_id: req.user._id }).sort({ month: 1 }).limit(12),
      FinancialProfile.findOne({ user_id: req.user._id }),
      Transaction.find({ user_id: req.user._id }).sort({ date: -1 }).limit(100),
    ]);

    let summaries = toPlain(dbSummaries) || [];
    let dataSource = "monthly_summary";

    // 2. Fall back to building from raw transactions
    if (summaries.length < 2) {
      summaries   = await buildSyntheticSummaries(req.user._id);
      dataSource  = "synthetic_from_transactions";
    }

    // 3. Let Flask handle zero-data case (uses income fallback)
    if (summaries.length === 0) {
      dataSource = "income_fallback";
    }

    const plainTransactions = toPlain(transactions) || [];
    const plainProfile      = toPlain(profile) || {};

    const payload = {
      monthly_summaries:   summaries,
      financial_profile:   plainProfile,
      upcoming_events:     req.body.upcoming_events || [],
      recent_transactions: plainTransactions,
      inflation_rate:      Number(req.body.inflation_rate) || 0.06,
    };

    const result = await callAI("/api/predict-expense", payload);

    // Attach debug info so frontend knows what happened
    if (result && result.data) {
      result.data._debug = {
        summaries_used:  summaries.length,
        transactions_used: plainTransactions.length,
        data_source:     dataSource,
        has_profile:     !!profile,
      };
    }

    res.json(result);
  } catch (err) {
    console.error("predictExpense error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/ai/health-guard
// ─────────────────────────────────────────────────────────────────
const healthGuard = async (req, res) => {
  try {
    const [dbSummaries, profile, investments, goals, transactions] = await Promise.all([
      MonthlySummary.find({ user_id: req.user._id }).sort({ month: 1 }).limit(12),
      FinancialProfile.findOne({ user_id: req.user._id }),
      Investment.find({ user_id: req.user._id }),
      Goal.find({ user_id: req.user._id, status: "active" }),
      Transaction.find({ user_id: req.user._id }).sort({ date: -1 }).limit(100),
    ]);

    let summaries = toPlain(dbSummaries) || [];
    if (summaries.length < 1) {
      summaries = await buildSyntheticSummaries(req.user._id);
    }
    if (summaries.length < 1) {
      return res.status(200).json({
        success: false,
        error: "No transaction data found. Add some income and expense transactions first.",
      });
    }

    const payload = {
      monthly_summaries: summaries,
      financial_profile: toPlain(profile) || { monthly_income: 0, emergency_fund_balance: 0 },
      investments:       toPlain(investments) || [],
      goals:             toPlain(goals) || [],
      transactions:      toPlain(transactions) || [],
    };

    const result = await callAI("/api/health-guard", payload);
    res.json(result);
  } catch (err) {
    console.error("healthGuard error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/ai/goal-plan/:goalId
// ─────────────────────────────────────────────────────────────────
const goalPlan = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.goalId, user_id: req.user._id });
    if (!goal) return res.status(404).json({ success: false, error: "Goal not found" });

    const [dbSummaries, profile] = await Promise.all([
      MonthlySummary.find({ user_id: req.user._id }).sort({ month: 1 }).limit(6),
      FinancialProfile.findOne({ user_id: req.user._id }),
    ]);

    let summaries = toPlain(dbSummaries) || [];
    if (summaries.length < 1) {
      summaries = await buildSyntheticSummaries(req.user._id);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const categoryAgg = await Transaction.aggregate([
      { $match: { user_id: req.user._id, type: "expense", date: { $gte: startOfMonth } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);
    const category_expenses = {};
    categoryAgg.forEach((c) => { if (c._id) category_expenses[c._id] = c.total; });

    const recentTxns = await Transaction.find({ user_id: req.user._id }).sort({ date: -1 }).limit(60);

    const payload = {
      goal:              toPlain(goal),
      financial_profile: toPlain(profile) || { monthly_income: 0 },
      monthly_summaries: summaries,
      category_expenses,
      transactions:      toPlain(recentTxns),
      memory:            [],
    };

    const result = await callAI("/api/goal-plan", payload);
    res.json(result);
  } catch (err) {
    console.error("goalPlan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/ai/retrain
// ─────────────────────────────────────────────────────────────────
const retrain = async (req, res) => {
  try {
    const result = await callAI("/api/retrain-categorizer", req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @GET /api/ai/export/health
// ─────────────────────────────────────────────────────────────────
const exportHealthReport = async (req, res) => {
  try {
    const [summaries, profile] = await Promise.all([
      MonthlySummary.find({ user_id: req.user._id }).sort({ month: 1 }),
      FinancialProfile.findOne({ user_id: req.user._id }),
    ]);

    const payload = {
      monthly_summaries: toPlain(summaries) || [],
      financial_profile: toPlain(profile) || {},
    };

    const result = await callAI("/api/health-guard", payload);

    res.json({
      success: true,
      type: "health_report",
      data: result,
    });
  } catch (err) {
    console.error("exportHealthReport error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// @GET /api/ai/export/goal-plan/:goalId
// ─────────────────────────────────────────────────────────────────
const exportGoalPlan = async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.goalId,
      user_id: req.user._id,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: "Goal not found",
      });
    }

    const payload = {
      goal: toPlain(goal),
    };

    const result = await callAI("/api/goal-plan", payload);

    res.json({
      success: true,
      type: "goal_plan",
      data: result,
    });
  } catch (err) {
    console.error("exportGoalPlan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  categorize,
  predictExpense,
  healthGuard,
  goalPlan,
  retrain,
  exportHealthReport,   // ✅ ADD THIS
  exportGoalPlan        // ✅ ADD THIS
};
