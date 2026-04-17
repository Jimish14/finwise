const Transaction = require("../models/transaction.model");
const MonthlySummary = require("../models/monthlySummary.model");

/**
 * Rebuild the monthly summary for a given user and month.
 * Called after every transaction create/update/delete.
 */
const rebuildMonthlySummary = async (user_id, monthStr) => {
  // monthStr format: "YYYY-MM"
  const [year, month] = monthStr.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const transactions = await Transaction.find({
    user_id,
    date: { $gte: startDate, $lte: endDate },
  });

  let total_income = 0, total_expense = 0, essential_expense = 0,
      non_essential_expense = 0, recurring_expense_total = 0;

  const categoryTotals = {};

  for (const txn of transactions) {
    if (txn.type === "income") {
      total_income += txn.amount;
    } else {
      total_expense += txn.amount;
      if (txn.essential_flag === "essential") {
        essential_expense += txn.amount;
      } else {
        non_essential_expense += txn.amount;
      }
      if (txn.is_recurring) {
        recurring_expense_total += txn.amount;
      }
      // category tallying
      categoryTotals[txn.category] = (categoryTotals[txn.category] || 0) + txn.amount;
    }
  }

  const total_savings = total_income - total_expense;
  const savings_rate = total_income > 0 ? (total_savings / total_income) * 100 : 0;
  const top_spending_category = Object.keys(categoryTotals).sort(
    (a, b) => categoryTotals[b] - categoryTotals[a]
  )[0] || null;

  await MonthlySummary.findOneAndUpdate(
    { user_id, month: monthStr },
    {
      user_id,
      month: monthStr,
      total_income,
      total_expense,
      total_savings,
      savings_rate: Math.round(savings_rate * 100) / 100,
      essential_expense,
      non_essential_expense,
      top_spending_category,
      discretionary_spending: non_essential_expense,
      recurring_expense_total,
    },
    { upsert: true, new: true }
  );
};

const getMonthStr = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

module.exports = { rebuildMonthlySummary, getMonthStr };