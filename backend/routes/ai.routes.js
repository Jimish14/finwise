const express = require("express");
const r = express.Router();
const {
  categorize, predictExpense, healthGuard, goalPlan, retrain, exportHealthReport, exportGoalPlan,
} = require("../controllers/ai.controller");
const { protect } = require("../middleware/auth.middleware");
r.use(protect);
r.post("/categorize",       categorize);
r.post("/predict-expense",  predictExpense);
r.post("/health-guard",     healthGuard);
r.post("/goal-plan/:goalId",goalPlan);
r.post("/retrain",          retrain);
r.get("/export/health", exportHealthReport);
r.get("/export/goal-plan/:goalId", exportGoalPlan);
module.exports = r;