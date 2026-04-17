# """
# =============================================================
#   AI FINANCIAL HEALTH GUARD (ADVISOR)
# =============================================================
#   Model   : Rule-based Risk Engine + Weighted Scoring +
#             Personalized Advice Generator
#   Input   : transactions[], financial_profile, investments[],
#             monthly_summaries[], goals[]
#   Output  : health_score (0–100), risk_alerts[], advice[]

#   How it works:
#     1. Compute financial health vitals from data
#     2. Rule engine detects risk signals in real-time
#     3. Weighted scoring model produces a 0–100 score
#     4. LLM-style advice generator produces human advice
#     5. Trend analysis detects improving/worsening patterns
# =============================================================
# """

# import numpy as np
# from datetime import datetime, timedelta
# from collections import defaultdict


# # ─────────────────────────────────────────────
# #  HEALTH SCORE WEIGHTS
# #  All weights must sum to 1.0
# # ─────────────────────────────────────────────
# SCORE_WEIGHTS = {
#     "savings_rate":          0.25,   # % of income saved
#     "expense_control":       0.20,   # non-essential spend control
#     "investment_discipline": 0.20,   # consistency of investing
#     "emergency_fund":        0.15,   # months of expenses covered
#     "debt_load":             0.10,   # debt vs income ratio
#     "goal_progress":         0.10,   # progress toward financial goals
# }

# # ─────────────────────────────────────────────
# #  BENCHMARKS (India-context defaults)
# # ─────────────────────────────────────────────
# BENCHMARKS = {
#     "ideal_savings_rate":       0.20,   # 20% of income
#     "good_savings_rate":        0.10,   # 10% of income
#     "critical_savings_rate":    0.05,   # <5% → warning
#     "ideal_investment_rate":    0.15,   # 15% of income
#     "emergency_fund_months":    6,      # 6 months expenses
#     "min_emergency_months":     3,      # 3 months → warning
#     "max_non_essential_ratio":  0.30,   # non-essential ≤ 30% expenses
#     "critical_expense_ratio":   0.90,   # expenses / income > 90% → danger
# }

# # ─────────────────────────────────────────────
# #  RISK LEVEL DEFINITIONS
# # ─────────────────────────────────────────────
# RISK_LEVELS = {
#     "critical": {"score_range": (0, 40),  "color": "red",    "label": "Critical"},
#     "at_risk":  {"score_range": (40, 60), "color": "orange", "label": "At Risk"},
#     "moderate": {"score_range": (60, 75), "color": "yellow", "label": "Moderate"},
#     "good":     {"score_range": (75, 90), "color": "green",  "label": "Good"},
#     "excellent":{"score_range": (90, 100),"color": "blue",   "label": "Excellent"},
# }


# # ─────────────────────────────────────────────
# #  VITAL CALCULATORS
# # ─────────────────────────────────────────────

# def compute_savings_rate(total_income: float, total_expense: float) -> float:
#     """Savings rate as fraction of income."""
#     if total_income <= 0:
#         return 0.0
#     return max(0.0, (total_income - total_expense) / total_income)


# def compute_non_essential_ratio(non_essential: float, total_expense: float) -> float:
#     """Non-essential spending as fraction of total expenses."""
#     if total_expense <= 0:
#         return 0.0
#     return min(1.0, non_essential / total_expense)


# def compute_emergency_fund_months(emergency_balance: float, avg_monthly_expense: float) -> float:
#     """How many months emergency fund covers."""
#     if avg_monthly_expense <= 0:
#         return 0.0
#     return emergency_balance / avg_monthly_expense


# def compute_investment_consistency(investments: list[dict], months_tracked: int) -> float:
#     """
#     Fraction of months with investment activity.
#     1.0 = invested every month, 0.0 = never invested.
#     """
#     if months_tracked <= 0 or not investments:
#         return 0.0
#     # Count unique months with investment
#     invest_months = set()
#     for inv in investments:
#         date_obj = inv.get("investment_start_date")
#         if date_obj:
#             try:
#                 if isinstance(date_obj, str):
#                     dt = datetime.fromisoformat(date_obj.replace("Z", ""))
#                 else:
#                     dt = date_obj
#                 invest_months.add((dt.year, dt.month))
#             except Exception:
#                 pass
#     return min(1.0, len(invest_months) / months_tracked)


# def compute_goal_progress(goals: list[dict]) -> float:
#     """Average completion ratio across all goals."""
#     if not goals:
#         return 0.5   # neutral – no goals set
#     ratios = []
#     for goal in goals:
#         target = float(goal.get("target_amount", 0))
#         current = float(goal.get("current_amount", 0))
#         if target > 0:
#             ratios.append(min(1.0, current / target))
#     return np.mean(ratios) if ratios else 0.5


# # ─────────────────────────────────────────────
# #  COMPONENT SCORE FUNCTIONS  (each returns 0–100)
# # ─────────────────────────────────────────────

# def _score_savings_rate(savings_rate: float) -> float:
#     """Score savings rate: 20%+ = 100, 0% = 0."""
#     ideal = BENCHMARKS["ideal_savings_rate"]
#     if savings_rate >= ideal:
#         return 100.0
#     elif savings_rate >= BENCHMARKS["good_savings_rate"]:
#         return 60 + (savings_rate - BENCHMARKS["good_savings_rate"]) / \
#                (ideal - BENCHMARKS["good_savings_rate"]) * 40
#     elif savings_rate >= BENCHMARKS["critical_savings_rate"]:
#         return 20 + (savings_rate - BENCHMARKS["critical_savings_rate"]) / \
#                (BENCHMARKS["good_savings_rate"] - BENCHMARKS["critical_savings_rate"]) * 40
#     else:
#         return max(0.0, savings_rate / BENCHMARKS["critical_savings_rate"] * 20)


# def _score_expense_control(non_essential_ratio: float) -> float:
#     """Lower non-essential ratio = better score."""
#     max_ratio = BENCHMARKS["max_non_essential_ratio"]
#     if non_essential_ratio <= max_ratio:
#         return 100 - (non_essential_ratio / max_ratio) * 20   # max 20 penalty for being at limit
#     elif non_essential_ratio <= 0.50:
#         return 80 - ((non_essential_ratio - max_ratio) / 0.20) * 50
#     else:
#         return max(0.0, 30 - (non_essential_ratio - 0.50) * 60)


# def _score_investment(investment_consistency: float, investment_rate: float) -> float:
#     """Combine consistency and rate into investment score."""
#     consistency_score = investment_consistency * 60     # max 60 pts
#     rate_score = min(investment_rate / BENCHMARKS["ideal_investment_rate"], 1.0) * 40  # max 40 pts
#     return consistency_score + rate_score


# def _score_emergency_fund(months_covered: float) -> float:
#     """6+ months = 100, 3 months = 50, 0 = 0."""
#     ideal = BENCHMARKS["emergency_fund_months"]
#     min_ok = BENCHMARKS["min_emergency_months"]
#     if months_covered >= ideal:
#         return 100.0
#     elif months_covered >= min_ok:
#         return 50 + (months_covered - min_ok) / (ideal - min_ok) * 50
#     else:
#         return max(0.0, months_covered / min_ok * 50)


# def _score_goal_progress(progress_ratio: float) -> float:
#     """Linear goal progress score."""
#     return min(100.0, progress_ratio * 100)


# # ─────────────────────────────────────────────
# #  RULE-BASED RISK ALERT ENGINE
# # ─────────────────────────────────────────────

# def detect_risk_alerts(
#     monthly_summaries: list[dict],
#     financial_profile: dict,
#     transactions: list[dict]
# ) -> list[dict]:
#     """
#     Real-time rule engine that scans for financial red flags.

#     Returns list of alert dicts:
#     {
#       "alert_id": str,
#       "severity": "high" | "medium" | "low",
#       "title": str,
#       "description": str,
#       "action": str
#     }
#     """
#     alerts = []

#     if not monthly_summaries:
#         return alerts

#     latest = monthly_summaries[-1]
#     income = float(financial_profile.get("monthly_income", 0))
#     emergency_fund = float(financial_profile.get("emergency_fund_balance", 0))
#     total_savings = float(financial_profile.get("total_savings", 0))

#     total_expense = float(latest.get("total_expense", 0))
#     total_income  = float(latest.get("total_income", income))
#     non_essential = float(latest.get("non_essential_expense", 0))
#     savings_rate  = compute_savings_rate(total_income, total_expense)
#     avg_expense   = np.mean([float(s.get("total_expense", 0)) for s in monthly_summaries])

#     # ── Alert 1: Expense > Income ────────────────────────────
#     if total_expense > total_income and total_income > 0:
#         alerts.append({
#             "alert_id": "EXPENSE_EXCEEDS_INCOME",
#             "severity": "high",
#             "title": "Expenses Exceed Income This Month",
#             "description": (
#                 f"You spent ₹{total_expense:,.0f} against income of ₹{total_income:,.0f}. "
#                 f"You are in deficit of ₹{total_expense - total_income:,.0f}."
#             ),
#             "action": "Review discretionary spending immediately. Identify top 3 categories to cut."
#         })

#     # ── Alert 2: Low Savings Rate ────────────────────────────
#     elif savings_rate < BENCHMARKS["critical_savings_rate"]:
#         alerts.append({
#             "alert_id": "CRITICAL_SAVINGS_RATE",
#             "severity": "high",
#             "title": "Critically Low Savings Rate",
#             "description": (
#                 f"Saving only {savings_rate*100:.1f}% of income. "
#                 f"Minimum recommended is 10–20%."
#             ),
#             "action": "Set up auto-debit for savings on salary day before spending."
#         })
#     elif savings_rate < BENCHMARKS["good_savings_rate"]:
#         alerts.append({
#             "alert_id": "LOW_SAVINGS_RATE",
#             "severity": "medium",
#             "title": "Below-Target Savings Rate",
#             "description": f"Saving {savings_rate*100:.1f}% — aim for at least 20%.",
#             "action": "Try the 50-30-20 rule: 50% needs, 30% wants, 20% savings."
#         })

#     # ── Alert 3: No Emergency Fund ───────────────────────────
#     emergency_months = compute_emergency_fund_months(emergency_fund, avg_expense)
#     if emergency_months < BENCHMARKS["min_emergency_months"]:
#         alerts.append({
#             "alert_id": "WEAK_EMERGENCY_FUND",
#             "severity": "high" if emergency_months < 1 else "medium",
#             "title": "Emergency Fund is Insufficient",
#             "description": (
#                 f"Emergency fund covers only {emergency_months:.1f} months of expenses. "
#                 f"Recommended: {BENCHMARKS['emergency_fund_months']} months."
#             ),
#             "action": (
#                 f"Target ₹{avg_expense * BENCHMARKS['emergency_fund_months']:,.0f} "
#                 f"in liquid savings. Start with ₹{avg_expense:,.0f}/month."
#             )
#         })

#     # ── Alert 4: High Non-Essential Spending ─────────────────
#     non_essential_ratio = compute_non_essential_ratio(non_essential, total_expense)
#     if non_essential_ratio > 0.45:
#         alerts.append({
#             "alert_id": "HIGH_NON_ESSENTIAL_SPEND",
#             "severity": "medium",
#             "title": "High Discretionary Spending Detected",
#             "description": (
#                 f"{non_essential_ratio*100:.0f}% of expenses are non-essential "
#                 f"(₹{non_essential:,.0f}). Ideal is below 30%."
#             ),
#             "action": "Track where non-essential money goes. Set a weekly budget limit."
#         })

#     # ── Alert 5: Expense Spike ───────────────────────────────
#     if len(monthly_summaries) >= 2:
#         prev_expense = float(monthly_summaries[-2].get("total_expense", 0))
#         if prev_expense > 0:
#             spike_ratio = total_expense / prev_expense
#             if spike_ratio > 1.30:
#                 alerts.append({
#                     "alert_id": "EXPENSE_SPIKE",
#                     "severity": "medium",
#                     "title": f"Expenses Spiked {round((spike_ratio-1)*100)}% This Month",
#                     "description": (
#                         f"Last month: ₹{prev_expense:,.0f} → "
#                         f"This month: ₹{total_expense:,.0f}"
#                     ),
#                     "action": "Check for one-time events. If recurring, reassess budget."
#                 })

#     # ── Alert 6: Subscription Creep ──────────────────────────
#     recurring_total = float(latest.get("recurring_expense_total", 0))
#     if total_income > 0 and recurring_total / total_income > 0.15:
#         alerts.append({
#             "alert_id": "SUBSCRIPTION_CREEP",
#             "severity": "low",
#             "title": "High Recurring Subscription Costs",
#             "description": (
#                 f"₹{recurring_total:,.0f}/month in subscriptions "
#                 f"({recurring_total/total_income*100:.0f}% of income)."
#             ),
#             "action": "Audit all subscriptions. Cancel unused ones (check last 30-day usage)."
#         })

#     # ── Alert 7: No Investments ──────────────────────────────
#     if len(monthly_summaries) >= 2:
#         # Check if top category isn't Investment
#         invest_months = [
#             s for s in monthly_summaries
#             if s.get("top_spending_category") == "Investment"
#         ]
#         if len(invest_months) == 0 and len(monthly_summaries) >= 2:
#             alerts.append({
#                 "alert_id": "NO_INVESTMENT_ACTIVITY",
#                 "severity": "medium",
#                 "title": "No Investment Activity Detected",
#                 "description": "You haven't invested in recent months. Your money is losing value to inflation.",
#                 "action": "Start a ₹500/month SIP in any index fund. Small start beats no start."
#             })

#     return alerts


# # ─────────────────────────────────────────────
# #  PERSONALIZED ADVICE GENERATOR
# # ─────────────────────────────────────────────

# def generate_advice(
#     health_score: float,
#     vitals: dict,
#     risk_alerts: list[dict],
#     financial_profile: dict,
#     monthly_summaries: list[dict]
# ) -> list[dict]:
#     """
#     Generate personalized, actionable financial advice.
#     Advice is prioritized by impact.

#     Returns list of advice dicts:
#     {
#       "priority": 1,
#       "category": str,
#       "advice": str,
#       "impact": "high" | "medium" | "low",
#       "estimated_benefit": str
#     }
#     """
#     advice_list = []
#     priority = 1

#     income = float(financial_profile.get("monthly_income", 0))
#     savings_rate = vitals.get("savings_rate", 0)
#     avg_expense = vitals.get("avg_monthly_expense", 0)
#     non_essential_ratio = vitals.get("non_essential_ratio", 0)
#     emergency_months = vitals.get("emergency_fund_months", 0)
#     investment_rate = vitals.get("investment_rate", 0)

#     # ── Advice 1: Savings Booster ────────────────────────────
#     if savings_rate < BENCHMARKS["ideal_savings_rate"]:
#         gap = BENCHMARKS["ideal_savings_rate"] - savings_rate
#         monthly_gap = income * gap
#         advice_list.append({
#             "priority": priority,
#             "category": "Savings",
#             "advice": (
#                 f"Your savings rate is {savings_rate*100:.1f}%. "
#                 f"To reach the 20% benchmark, save ₹{monthly_gap:,.0f} more each month. "
#                 f"Enable automatic savings transfer on salary day before you spend."
#             ),
#             "impact": "high",
#             "estimated_benefit": f"₹{monthly_gap * 12:,.0f} extra savings per year"
#         })
#         priority += 1

#     # ── Advice 2: Non-Essential Spending ────────────────────
#     if non_essential_ratio > BENCHMARKS["max_non_essential_ratio"]:
#         potential_saving = (non_essential_ratio - BENCHMARKS["max_non_essential_ratio"]) * avg_expense
#         advice_list.append({
#             "priority": priority,
#             "category": "Expense Reduction",
#             "advice": (
#                 f"Discretionary spending is {non_essential_ratio*100:.0f}% of your expenses. "
#                 f"Reducing to 30% can free up ₹{potential_saving:,.0f}/month. "
#                 f"Focus on dining out and entertainment first — high-spend, easy-to-cut categories."
#             ),
#             "impact": "high",
#             "estimated_benefit": f"₹{potential_saving:,.0f}/month available for savings"
#         })
#         priority += 1

#     # ── Advice 3: Emergency Fund ─────────────────────────────
#     if emergency_months < BENCHMARKS["emergency_fund_months"]:
#         target = avg_expense * BENCHMARKS["emergency_fund_months"]
#         current_ef = float(financial_profile.get("emergency_fund_balance", 0))
#         needed = max(0, target - current_ef)
#         months_to_build = int(needed / max(income * 0.05, 1))
#         advice_list.append({
#             "priority": priority,
#             "category": "Emergency Fund",
#             "advice": (
#                 f"Your emergency fund covers {emergency_months:.1f} months. "
#                 f"Target is 6 months (₹{target:,.0f}). "
#                 f"Save ₹{income*0.05:,.0f}/month in a liquid savings account — "
#                 f"you'll reach the target in ~{months_to_build} months."
#             ),
#             "impact": "high",
#             "estimated_benefit": "Protection against job loss or medical emergency"
#         })
#         priority += 1

#     # ── Advice 4: Investment ─────────────────────────────────
#     if investment_rate < BENCHMARKS["ideal_investment_rate"]:
#         gap_amount = income * (BENCHMARKS["ideal_investment_rate"] - investment_rate)
#         advice_list.append({
#             "priority": priority,
#             "category": "Investment",
#             "advice": (
#                 f"You're investing {investment_rate*100:.1f}% of income. "
#                 f"Starting an additional SIP of ₹{min(gap_amount, 1000):,.0f}/month in an index fund "
#                 f"can grow to ₹{min(gap_amount, 1000) * 12 * 10 * 1.12:,.0f} in 10 years (at 12% returns)."
#             ),
#             "impact": "high" if investment_rate < 0.05 else "medium",
#             "estimated_benefit": f"₹{min(gap_amount, 1000) * 12 * 10 * 1.12:,.0f} in 10 years"
#         })
#         priority += 1

#     # ── Advice 5: Trend-based insight ────────────────────────
#     if len(monthly_summaries) >= 3:
#         expenses = [float(s.get("total_expense", 0)) for s in monthly_summaries[-3:]]
#         if all(expenses[i] < expenses[i+1] for i in range(len(expenses)-1)):
#             advice_list.append({
#                 "priority": priority,
#                 "category": "Trend Alert",
#                 "advice": (
#                     f"Expenses have been rising for {len(expenses)} consecutive months. "
#                     f"Total increase: ₹{expenses[-1]-expenses[0]:,.0f}. "
#                     f"Identify which category is driving the increase and set a monthly cap."
#                 ),
#                 "impact": "medium",
#                 "estimated_benefit": "Prevents lifestyle inflation"
#             })
#             priority += 1

#     # ── Advice 6: Positive reinforcement ────────────────────
#     if health_score >= 75:
#         advice_list.append({
#             "priority": priority,
#             "category": "Wealth Building",
#             "advice": (
#                 f"Great financial health (score: {health_score:.0f}/100)! "
#                 f"Consider diversifying investments — add international index funds "
#                 f"or step up existing SIPs by 10% annually."
#             ),
#             "impact": "medium",
#             "estimated_benefit": "Accelerated wealth compounding"
#         })

#     return advice_list


# # ─────────────────────────────────────────────
# #  TREND ANALYSIS
# # ─────────────────────────────────────────────

# def analyze_trend(monthly_summaries: list[dict]) -> dict:
#     """Detect if financial health is improving, stable, or worsening."""
#     if len(monthly_summaries) < 3:
#         return {"trend": "insufficient_data", "description": "Need 3+ months of data."}

#     savings_rates = []
#     for s in monthly_summaries[-3:]:
#         income = float(s.get("total_income", 1))
#         expense = float(s.get("total_expense", 0))
#         savings_rates.append(compute_savings_rate(income, expense))

#     if all(savings_rates[i] < savings_rates[i+1] for i in range(len(savings_rates)-1)):
#         trend = "improving"
#         description = "Savings rate is improving month-over-month. Keep it up!"
#     elif all(savings_rates[i] > savings_rates[i+1] for i in range(len(savings_rates)-1)):
#         trend = "worsening"
#         description = "Savings rate is declining. Expenses are outpacing income growth."
#     else:
#         trend = "stable"
#         description = "Financial behavior is stable."

#     return {
#         "trend": trend,
#         "description": description,
#         "savings_rate_3months": [round(r * 100, 1) for r in savings_rates]
#     }


# # ─────────────────────────────────────────────
# #  MAIN FUNCTION
# # ─────────────────────────────────────────────

# def analyze_financial_health(
#     monthly_summaries: list[dict],
#     financial_profile: dict,
#     investments: list[dict] = None,
#     goals: list[dict] = None,
#     transactions: list[dict] = None
# ) -> dict:
#     """
#     Full financial health analysis.

#     Args:
#         monthly_summaries : List of MonthlySummary docs (sorted ASC)
#         financial_profile : FinancialProfile doc for the user
#         investments       : List of Investment docs
#         goals             : List of Goal docs
#         transactions      : Recent transaction list (last 1–3 months)

#     Returns:
#         {
#           "health_score": int (0–100),
#           "risk_level": str,
#           "vitals": dict,
#           "component_scores": dict,
#           "risk_alerts": list,
#           "advice": list,
#           "trend": dict,
#           "summary": str
#         }
#     """
#     investments  = investments  or []
#     goals        = goals        or []
#     transactions = transactions or []

#     # ── Sanitize MongoDB docs (remove ObjectId, _id, datetime keys) ──
#     def _clean(docs):
#         cleaned = []
#         for d in docs:
#             if not isinstance(d, dict):
#                 try: d = dict(d)
#                 except: continue
#             cleaned.append({k: v for k, v in d.items() if not str(k).startswith("_")})
#         return cleaned

#     monthly_summaries = _clean(monthly_summaries)
#     investments       = _clean(investments)
#     goals             = _clean(goals)
#     transactions      = _clean(transactions)
#     if financial_profile and not isinstance(financial_profile, dict):
#         try: financial_profile = dict(financial_profile)
#         except: financial_profile = {}
#     if isinstance(financial_profile, dict):
#         financial_profile = {k: v for k, v in financial_profile.items() if not str(k).startswith("_")}

#     if not monthly_summaries:
#         return {"error": "No monthly summary data available."}

#     # ── Aggregate vitals ─────────────────────────────────────
#     income = float(financial_profile.get("monthly_income", 0))
#     emergency_fund = float(financial_profile.get("emergency_fund_balance", 0))

#     total_incomes   = [float(s.get("total_income", income)) for s in monthly_summaries]
#     total_expenses  = [float(s.get("total_expense", 0)) for s in monthly_summaries]
#     non_essentials  = [float(s.get("non_essential_expense", 0)) for s in monthly_summaries]

#     avg_income   = np.mean(total_incomes)  if total_incomes  else income
#     avg_expense  = np.mean(total_expenses) if total_expenses else 0
#     avg_non_ess  = np.mean(non_essentials) if non_essentials else 0

#     savings_rate          = compute_savings_rate(avg_income, avg_expense)
#     non_essential_ratio   = compute_non_essential_ratio(avg_non_ess, avg_expense)
#     emergency_fund_months = compute_emergency_fund_months(emergency_fund, avg_expense)

#     # Investment total & rate
#     total_invested = sum(float(i.get("amount_invested", 0)) for i in investments)
#     monthly_invest = sum(float(i.get("monthly_contribution", 0)) for i in investments)
#     investment_rate = monthly_invest / avg_income if avg_income > 0 else 0.0

#     invest_consistency = compute_investment_consistency(investments, len(monthly_summaries))
#     goal_progress = compute_goal_progress(goals)

#     vitals = {
#         "avg_monthly_income":    round(avg_income, 2),
#         "avg_monthly_expense":   round(avg_expense, 2),
#         "savings_rate":          round(savings_rate, 4),
#         "non_essential_ratio":   round(non_essential_ratio, 4),
#         "emergency_fund_months": round(emergency_fund_months, 2),
#         "investment_rate":       round(investment_rate, 4),
#         "invest_consistency":    round(invest_consistency, 4),
#         "goal_progress_ratio":   round(goal_progress, 4),
#         "total_invested":        round(total_invested, 2)
#     }

#     # ── Component Scores ─────────────────────────────────────
#     score_savings    = _score_savings_rate(savings_rate)
#     score_expense    = _score_expense_control(non_essential_ratio)
#     score_investment = _score_investment(invest_consistency, investment_rate)
#     score_emergency  = _score_emergency_fund(emergency_fund_months)
#     score_goal       = _score_goal_progress(goal_progress)
#     # Debt score: placeholder (use 70 if no debt data)
#     score_debt       = 70.0

#     component_scores = {
#         "savings_rate":          round(score_savings, 1),
#         "expense_control":       round(score_expense, 1),
#         "investment_discipline": round(score_investment, 1),
#         "emergency_fund":        round(score_emergency, 1),
#         "debt_load":             round(score_debt, 1),
#         "goal_progress":         round(score_goal, 1),
#     }

#     # ── Weighted Health Score ────────────────────────────────
#     health_score = sum(
#         SCORE_WEIGHTS[key] * component_scores[key]
#         for key in SCORE_WEIGHTS
#     )
#     health_score = round(min(100, max(0, health_score)), 1)

#     # ── Risk Level ────────────────────────────────────────────
#     risk_level = "excellent"
#     for level, info in RISK_LEVELS.items():
#         lo, hi = info["score_range"]
#         if lo <= health_score < hi:
#             risk_level = level
#             break

#     # ── Risk Alerts ──────────────────────────────────────────
#     risk_alerts = detect_risk_alerts(monthly_summaries, financial_profile, transactions)

#     # ── Advice ───────────────────────────────────────────────
#     advice = generate_advice(health_score, vitals, risk_alerts, financial_profile, monthly_summaries)

#     # ── Trend ────────────────────────────────────────────────
#     trend = analyze_trend(monthly_summaries)

#     # ── Summary Sentence ─────────────────────────────────────
#     level_info = RISK_LEVELS.get(risk_level, {})
#     level_label = level_info.get("label", risk_level.title())
#     alert_count = len([a for a in risk_alerts if a["severity"] == "high"])

#     if health_score >= 90:
#         summary = f"Excellent financial health ({health_score}/100). Keep compounding!"
#     elif health_score >= 75:
#         summary = f"Good financial health ({health_score}/100). Fine-tune investments and savings."
#     elif health_score >= 60:
#         summary = (
#             f"Moderate financial health ({health_score}/100). "
#             f"{alert_count} high-priority issues need attention."
#         )
#     else:
#         summary = (
#             f"Financial health is {level_label} ({health_score}/100). "
#             f"Take immediate action on the {alert_count} critical alerts."
#         )

#     return {
#         "health_score": health_score,
#         "risk_level": risk_level,
#         "risk_level_label": level_label,
#         "vitals": vitals,
#         "component_scores": component_scores,
#         "risk_alerts": risk_alerts,
#         "advice": advice,
#         "trend": trend,
#         "summary": summary,
#         "months_analyzed": len(monthly_summaries)
#     }







# """
# =============================================================
#   AI FINANCIAL HEALTH GUARD — ULTIMATE V15 🔥🔥
# =============================================================
# ✔ Data cleaning + preprocessing
# ✔ Dynamic baseline (personalized)
# ✔ Time-aware intelligence
# ✔ Behavior modeling
# ✔ Emergency risk modeling
# ✔ Cash flow forecasting
# ✔ Personalization engine
# ✔ Goal intelligence (inflation-adjusted)
# ✔ Subscription leak detection
# ✔ Multi-month trend analysis
# ✔ ML anomaly detection (Z-score + Isolation Forest)
# ✔ Explainable AI (XAI)
# ✔ Macro-economic intelligence
# ✔ Real-time alert engine
# ✔ Feedback learning loop
# ✔ Smart dynamic health score (final upgrade) 🔥
# =============================================================
# """

# import numpy as np
# from datetime import datetime
# from collections import defaultdict

# from sklearn.ensemble import IsolationForest
# from sklearn.preprocessing import StandardScaler


# # ============================================================
# # 1. DATA CLEANING + TIME FEATURES
# # ============================================================
# def preprocess_transactions(transactions):
#     clean = []
#     for t in transactions:
#         if t.get("amount", 0) < 10:  # remove noise
#             continue

#         dt = datetime.fromisoformat(str(t["date"]))
#         t["is_weekend"] = dt.weekday() >= 5
#         t["day"] = dt.day
#         t["month"] = dt.month

#         clean.append(t)
#     return clean


# # ============================================================
# # 2. DYNAMIC BASELINE
# # ============================================================
# def get_category_baseline(monthly, category):
#     values = [m.get("category_breakdown", {}).get(category, 0) for m in monthly]
#     return np.mean(values[:-1]) if len(values) > 1 else 0


# # ============================================================
# # 3. EXPLAINABLE HELPERS
# # ============================================================
# def explain_change(cat, values):
#     base = np.mean(values[:-1])
#     curr = values[-1]
#     if base == 0:
#         return None
#     pct = ((curr - base) / base) * 100
#     return f"{cat} increased from ₹{int(base)} to ₹{int(curr)} ({pct:.0f}% higher than usual)"


# def explain_zscore(val, mean, std):
#     z = (val - mean) / std if std else 0
#     return f"₹{val} is {abs(z):.1f}σ away from avg ₹{int(mean)}"


# def explain_ml(val, avg):
#     return f"₹{val} deviates from your normal avg ₹{int(avg)}"


# # ============================================================
# # 4. RULE + DYNAMIC ANOMALY
# # ============================================================
# def detect_rule_anomalies(monthly):
#     alerts = []
#     categories = set()

#     for m in monthly:
#         categories.update(m.get("category_breakdown", {}).keys())

#     for cat in categories:
#         values = [m.get("category_breakdown", {}).get(cat, 0) for m in monthly]

#         if len(values) < 2:
#             continue

#         baseline = get_category_baseline(monthly, cat)
#         current = values[-1]

#         if current > baseline * 1.25:
#             alerts.append({
#                 "id": f"{cat}_overspend",
#                 "text": explain_change(cat, values)
#             })

#     return alerts


# # ============================================================
# # 5. ML ANOMALY DETECTION
# # ============================================================
# def detect_ml_anomalies(transactions):
#     if len(transactions) < 10:
#         return []

#     amounts = np.array([t["amount"] for t in transactions])
#     mean, std = np.mean(amounts), np.std(amounts)

#     z_anomalies = []
#     for t in transactions:
#         if std == 0:
#             continue
#         z = (t["amount"] - mean) / std
#         if abs(z) > 2.5:
#             z_anomalies.append({
#                 "id": "zscore",
#                 "text": explain_zscore(t["amount"], mean, std)
#             })

#     X = StandardScaler().fit_transform(amounts.reshape(-1, 1))
#     model = IsolationForest(contamination=0.1)
#     preds = model.fit_predict(X)

#     ml_anomalies = []
#     avg = np.mean(amounts)

#     for i, t in enumerate(transactions):
#         if preds[i] == -1:
#             ml_anomalies.append({
#                 "id": "ml",
#                 "text": explain_ml(t["amount"], avg)
#             })

#     return z_anomalies + ml_anomalies


# # ============================================================
# # 6. BEHAVIOR MODELING
# # ============================================================
# def detect_behavior(transactions):
#     weekend = [t["amount"] for t in transactions if t["is_weekend"]]
#     weekday = [t["amount"] for t in transactions if not t["is_weekend"]]

#     patterns = []
#     if weekday and np.mean(weekend) > np.mean(weekday) * 1.3:
#         patterns.append({"id": "weekend", "text": "You overspend on weekends"})

#     return patterns


# # ============================================================
# # 7. EMERGENCY RISK
# # ============================================================
# def emergency_months(profile, monthly):
#     avg = np.mean([m["total_expense"] for m in monthly])
#     return profile["emergency_fund_balance"] / avg if avg else 0


# # ============================================================
# # 8. CASH FLOW FORECAST
# # ============================================================
# def detect_shortage(transactions, balance):
#     net = balance
#     for t in transactions:
#         net += t["amount"] if t.get("type") == "income" else -t["amount"]
#         if net < 0:
#             return 10
#     return None


# # ============================================================
# # 9. GOALS (INFLATION)
# # ============================================================
# def goal_insights(goals, saving):
#     insights = []
#     for g in goals:
#         future = g["target_amount"] * (1.06 ** (g["deadline_months"] / 12))
#         delay = int((future - g["current_amount"]) / max(saving, 1))

#         insights.append({
#             "id": "goal",
#             "text": f"{g['goal_name']} delayed by {delay} months"
#         })
#     return insights


# # ============================================================
# # 10. SUBSCRIPTION DETECTION
# # ============================================================
# def detect_subscriptions(transactions):
#     groups = defaultdict(int)

#     for t in transactions:
#         key = (t.get("merchant"), round(t["amount"], -1))
#         groups[key] += 1

#     return sum(1 for v in groups.values() if v >= 3)


# # ============================================================
# # 11. TREND ANALYSIS
# # ============================================================
# def trend_insights(monthly):
#     insights = []
#     for cat in monthly[-1].get("category_breakdown", {}):
#         values = [m.get("category_breakdown", {}).get(cat, 0) for m in monthly]

#         if len(values) >= 3 and values[-1] > values[-2] > values[-3]:
#             insights.append({
#                 "id": "trend",
#                 "text": explain_change(cat, values)
#             })

#     return insights


# # ============================================================
# # 12. MACRO FACTORS
# # ============================================================
# def macro_insights(saving_rate):
#     out = []

#     if saving_rate < 0.06:
#         out.append({"id": "inflation", "text": "Savings below inflation rate"})

#     out.append({"id": "market", "text": "Market favorable for long-term SIP"})

#     return out


# # ============================================================
# # 13. REAL-TIME ALERTS
# # ============================================================
# def realtime_alerts(transactions, budgets):
#     alerts = []
#     spend = defaultdict(float)

#     for t in transactions:
#         if t.get("type") == "expense":
#             spend[t.get("category", "Other")] += t["amount"]

#     day = transactions[-1]["day"]

#     for cat, b in budgets.items():
#         if spend[cat] / b > (day / 30 + 0.2):
#             alerts.append({
#                 "id": "realtime",
#                 "text": f"{cat} spending too fast ({spend[cat]}/{b})"
#             })

#     return alerts


# # ============================================================
# # 14. FEEDBACK LEARNING
# # ============================================================
# def feedback_scores(feedback):
#     scores = defaultdict(lambda: [0, 0])

#     for f in feedback:
#         if f["feedback"] == "helpful":
#             scores[f["id"]][0] += 1
#         else:
#             scores[f["id"]][1] += 1

#     return {
#         k: v[0] / (v[0] + v[1]) if (v[0] + v[1]) else 0.5
#         for k, v in scores.items()
#     }


# def adjust_advice(advice, scores):
#     ranked = []

#     for a in advice:
#         score = scores.get(a["id"], 0.5)
#         if score > 0.3:
#             ranked.append((a["text"], score))

#     ranked.sort(key=lambda x: x[1], reverse=True)
#     return [x[0] for x in ranked]


# # ============================================================
# # 15. SMART HEALTH SCORE (FINAL)
# # ============================================================
# def compute_health(profile, monthly, patterns, shortage):
#     income = profile["monthly_income"]
#     avg_exp = np.mean([m["total_expense"] for m in monthly])

#     sr = (income - avg_exp) / income
#     er = avg_exp / income

#     base = 40 if sr > 0.2 else 20
#     behavior = -10 if patterns else 10
#     trend = 10 if len(monthly) < 3 else (-10 if avg_exp > monthly[-2]["total_expense"] else 10)
#     risk = -20 if shortage else 10

#     return max(0, min(100, base + behavior + trend + risk))


# # ============================================================
# # 16. MAIN ENGINE
# # ============================================================
# def analyze(transactions, monthly, profile, goals, budgets, feedback):

#     transactions = preprocess_transactions(transactions)

#     saving = profile["monthly_income"] - np.mean([m["total_expense"] for m in monthly])
#     saving_rate = saving / profile["monthly_income"]

#     advice = []

#     advice += detect_rule_anomalies(monthly)
#     advice += detect_ml_anomalies(transactions)
#     advice += detect_behavior(transactions)
#     advice += goal_insights(goals, saving)
#     advice += trend_insights(monthly)
#     advice += realtime_alerts(transactions, budgets)
#     advice += macro_insights(saving_rate)

#     subs = detect_subscriptions(transactions)
#     if subs > 2:
#         advice.append({"id": "subs", "text": "Too many subscriptions detected"})

#     shortage = detect_shortage(transactions, profile["current_balance"])
#     if shortage:
#         advice.append({"id": "risk", "text": "Balance may run out soon"})

#     scores = feedback_scores(feedback)
#     final_advice = adjust_advice(advice, scores)

#     health_score = compute_health(profile, monthly, advice, shortage)

#     return {
#         "health_score": health_score,
#         "advice": final_advice
#     }






"""
=============================================================
  AI FINANCIAL HEALTH GUARD (ADVISOR)
=============================================================
  Model   : Rule-based Risk Engine + Weighted Scoring +
            Personalized Advice Generator
  Input   : transactions[], financial_profile, investments[],
            monthly_summaries[], goals[]
  Output  : health_score (0–100), risk_alerts[], advice[]

  How it works:
    1. Compute financial health vitals from data
    2. Rule engine detects risk signals in real-time
    3. Weighted scoring model produces a 0–100 score
    4. LLM-style advice generator produces human advice
    5. Trend analysis detects improving/worsening patterns
=============================================================
"""

import numpy as np
from datetime import datetime
from collections import defaultdict

# ML anomaly detection (safe import)
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_ANOMALY = True
except ImportError:
    SKLEARN_ANOMALY = False


# ─────────────────────────────────────────────
#  HEALTH SCORE WEIGHTS
#  All weights must sum to 1.0
# ─────────────────────────────────────────────
SCORE_WEIGHTS = {
    "savings_rate":          0.25,   # % of income saved
    "expense_control":       0.20,   # non-essential spend control
    "investment_discipline": 0.20,   # consistency of investing
    "emergency_fund":        0.15,   # months of expenses covered
    "debt_load":             0.10,   # debt vs income ratio
    "goal_progress":         0.10,   # progress toward financial goals
}

# ─────────────────────────────────────────────
#  BENCHMARKS (India-context defaults)
# ─────────────────────────────────────────────
BENCHMARKS = {
    "ideal_savings_rate":       0.20,   # 20% of income
    "good_savings_rate":        0.10,   # 10% of income
    "critical_savings_rate":    0.05,   # <5% → warning
    "ideal_investment_rate":    0.15,   # 15% of income
    "emergency_fund_months":    6,      # 6 months expenses
    "min_emergency_months":     3,      # 3 months → warning
    "max_non_essential_ratio":  0.30,   # non-essential ≤ 30% expenses
    "critical_expense_ratio":   0.90,   # expenses / income > 90% → danger
}

# ─────────────────────────────────────────────
#  RISK LEVEL DEFINITIONS
# ─────────────────────────────────────────────
RISK_LEVELS = {
    "critical": {"score_range": (0, 40),  "color": "red",    "label": "Critical"},
    "at_risk":  {"score_range": (40, 60), "color": "orange", "label": "At Risk"},
    "moderate": {"score_range": (60, 75), "color": "yellow", "label": "Moderate"},
    "good":     {"score_range": (75, 90), "color": "green",  "label": "Good"},
    "excellent":{"score_range": (90, 100),"color": "blue",   "label": "Excellent"},
}


# ─────────────────────────────────────────────
#  VITAL CALCULATORS
# ─────────────────────────────────────────────

def compute_savings_rate(total_income: float, total_expense: float) -> float:
    """Savings rate as fraction of income."""
    if total_income <= 0:
        return 0.0
    return max(0.0, (total_income - total_expense) / total_income)


def compute_non_essential_ratio(non_essential: float, total_expense: float) -> float:
    """Non-essential spending as fraction of total expenses."""
    if total_expense <= 0:
        return 0.0
    return min(1.0, non_essential / total_expense)


def compute_emergency_fund_months(emergency_balance: float, avg_monthly_expense: float) -> float:
    """How many months emergency fund covers."""
    if avg_monthly_expense <= 0:
        return 0.0
    return emergency_balance / avg_monthly_expense


def compute_investment_consistency(investments: list[dict], months_tracked: int) -> float:
    """
    Fraction of months with investment activity.
    1.0 = invested every month, 0.0 = never invested.
    """
    if months_tracked <= 0 or not investments:
        return 0.0
    # Count unique months with investment
    invest_months = set()
    for inv in investments:
        date_obj = inv.get("investment_start_date")
        if date_obj:
            try:
                if isinstance(date_obj, str):
                    dt = datetime.fromisoformat(date_obj.replace("Z", ""))
                else:
                    dt = date_obj
                invest_months.add((dt.year, dt.month))
            except Exception:
                pass
    return min(1.0, len(invest_months) / months_tracked)


def compute_goal_progress(goals: list[dict]) -> float:
    """Average completion ratio across all goals."""
    if not goals:
        return 0.5   # neutral – no goals set
    ratios = []
    for goal in goals:
        target = float(goal.get("target_amount", 0))
        current = float(goal.get("current_amount", 0))
        if target > 0:
            ratios.append(min(1.0, current / target))
    return np.mean(ratios) if ratios else 0.5


# ─────────────────────────────────────────────
#  COMPONENT SCORE FUNCTIONS  (each returns 0–100)
# ─────────────────────────────────────────────

def _score_savings_rate(savings_rate: float) -> float:
    """Score savings rate: 20%+ = 100, 0% = 0."""
    ideal = BENCHMARKS["ideal_savings_rate"]
    if savings_rate >= ideal:
        return 100.0
    elif savings_rate >= BENCHMARKS["good_savings_rate"]:
        return 60 + (savings_rate - BENCHMARKS["good_savings_rate"]) / \
               (ideal - BENCHMARKS["good_savings_rate"]) * 40
    elif savings_rate >= BENCHMARKS["critical_savings_rate"]:
        return 20 + (savings_rate - BENCHMARKS["critical_savings_rate"]) / \
               (BENCHMARKS["good_savings_rate"] - BENCHMARKS["critical_savings_rate"]) * 40
    else:
        return max(0.0, savings_rate / BENCHMARKS["critical_savings_rate"] * 20)


def _score_expense_control(non_essential_ratio: float) -> float:
    """Lower non-essential ratio = better score."""
    max_ratio = BENCHMARKS["max_non_essential_ratio"]
    if non_essential_ratio <= max_ratio:
        return 100 - (non_essential_ratio / max_ratio) * 20   # max 20 penalty for being at limit
    elif non_essential_ratio <= 0.50:
        return 80 - ((non_essential_ratio - max_ratio) / 0.20) * 50
    else:
        return max(0.0, 30 - (non_essential_ratio - 0.50) * 60)


def _score_investment(investment_consistency: float, investment_rate: float) -> float:
    """Combine consistency and rate into investment score."""
    consistency_score = investment_consistency * 60     # max 60 pts
    rate_score = min(investment_rate / BENCHMARKS["ideal_investment_rate"], 1.0) * 40  # max 40 pts
    return consistency_score + rate_score


def _score_emergency_fund(months_covered: float) -> float:
    """6+ months = 100, 3 months = 50, 0 = 0."""
    ideal = BENCHMARKS["emergency_fund_months"]
    min_ok = BENCHMARKS["min_emergency_months"]
    if months_covered >= ideal:
        return 100.0
    elif months_covered >= min_ok:
        return 50 + (months_covered - min_ok) / (ideal - min_ok) * 50
    else:
        return max(0.0, months_covered / min_ok * 50)


def _score_goal_progress(progress_ratio: float) -> float:
    """Linear goal progress score."""
    return min(100.0, progress_ratio * 100)


# ─────────────────────────────────────────────
#  RULE-BASED RISK ALERT ENGINE
# ─────────────────────────────────────────────

def detect_risk_alerts(
    monthly_summaries: list[dict],
    financial_profile: dict,
    transactions: list[dict]
) -> list[dict]:
    """
    Real-time rule engine that scans for financial red flags.

    Returns list of alert dicts:
    {
      "alert_id": str,
      "severity": "high" | "medium" | "low",
      "title": str,
      "description": str,
      "action": str
    }
    """
    alerts = []

    if not monthly_summaries:
        return alerts

    latest = monthly_summaries[-1]
    income = float(financial_profile.get("monthly_income") or 0)
    emergency_fund = float(financial_profile.get("emergency_fund_balance") or 0)
    total_savings = float(financial_profile.get("total_savings") or 0)

    total_expense = float(latest.get("total_expense", 0))
    total_income  = float(latest.get("total_income", income))
    non_essential = float(latest.get("non_essential_expense", 0))
    savings_rate  = compute_savings_rate(total_income, total_expense)
    avg_expense   = np.mean([float(s.get("total_expense", 0)) for s in monthly_summaries])

    # ── Alert 1: Expense > Income ────────────────────────────
    if total_expense > total_income and total_income > 0:
        alerts.append({
            "alert_id": "EXPENSE_EXCEEDS_INCOME",
            "severity": "high",
            "title": "Expenses Exceed Income This Month",
            "description": (
                f"You spent ₹{total_expense:,.0f} against income of ₹{total_income:,.0f}. "
                f"You are in deficit of ₹{total_expense - total_income:,.0f}."
            ),
            "action": "Review discretionary spending immediately. Identify top 3 categories to cut."
        })

    # ── Alert 2: Low Savings Rate ────────────────────────────
    elif savings_rate < BENCHMARKS["critical_savings_rate"]:
        alerts.append({
            "alert_id": "CRITICAL_SAVINGS_RATE",
            "severity": "high",
            "title": "Critically Low Savings Rate",
            "description": (
                f"Saving only {savings_rate*100:.1f}% of income. "
                f"Minimum recommended is 10–20%."
            ),
            "action": "Set up auto-debit for savings on salary day before spending."
        })
    elif savings_rate < BENCHMARKS["good_savings_rate"]:
        alerts.append({
            "alert_id": "LOW_SAVINGS_RATE",
            "severity": "medium",
            "title": "Below-Target Savings Rate",
            "description": f"Saving {savings_rate*100:.1f}% — aim for at least 20%.",
            "action": "Try the 50-30-20 rule: 50% needs, 30% wants, 20% savings."
        })

    # ── Alert 3: No Emergency Fund ───────────────────────────
    emergency_months = compute_emergency_fund_months(emergency_fund, avg_expense)
    if emergency_months < BENCHMARKS["min_emergency_months"]:
        alerts.append({
            "alert_id": "WEAK_EMERGENCY_FUND",
            "severity": "high" if emergency_months < 1 else "medium",
            "title": "Emergency Fund is Insufficient",
            "description": (
                f"Emergency fund covers only {emergency_months:.1f} months of expenses. "
                f"Recommended: {BENCHMARKS['emergency_fund_months']} months."
            ),
            "action": (
                f"Target ₹{avg_expense * BENCHMARKS['emergency_fund_months']:,.0f} "
                f"in liquid savings. Start with ₹{avg_expense:,.0f}/month."
            )
        })

    # ── Alert 4: High Non-Essential Spending ─────────────────
    non_essential_ratio = compute_non_essential_ratio(non_essential, total_expense)
    if non_essential_ratio > 0.45:
        alerts.append({
            "alert_id": "HIGH_NON_ESSENTIAL_SPEND",
            "severity": "medium",
            "title": "High Discretionary Spending Detected",
            "description": (
                f"{non_essential_ratio*100:.0f}% of expenses are non-essential "
                f"(₹{non_essential:,.0f}). Ideal is below 30%."
            ),
            "action": "Track where non-essential money goes. Set a weekly budget limit."
        })

    # ── Alert 5: Expense Spike ───────────────────────────────
    if len(monthly_summaries) >= 2:
        prev_expense = float(monthly_summaries[-2].get("total_expense", 0))
        if prev_expense > 0:
            spike_ratio = total_expense / prev_expense
            if spike_ratio > 1.30:
                alerts.append({
                    "alert_id": "EXPENSE_SPIKE",
                    "severity": "medium",
                    "title": f"Expenses Spiked {round((spike_ratio-1)*100)}% This Month",
                    "description": (
                        f"Last month: ₹{prev_expense:,.0f} → "
                        f"This month: ₹{total_expense:,.0f}"
                    ),
                    "action": "Check for one-time events. If recurring, reassess budget."
                })

    # ── Alert 6: Subscription Creep ──────────────────────────
    recurring_total = float(latest.get("recurring_expense_total", 0))
    if total_income > 0 and recurring_total / total_income > 0.15:
        alerts.append({
            "alert_id": "SUBSCRIPTION_CREEP",
            "severity": "low",
            "title": "High Recurring Subscription Costs",
            "description": (
                f"₹{recurring_total:,.0f}/month in subscriptions "
                f"({recurring_total/total_income*100:.0f}% of income)."
            ),
            "action": "Audit all subscriptions. Cancel unused ones (check last 30-day usage)."
        })

    # ── Alert 7: No Investments ──────────────────────────────
    if len(monthly_summaries) >= 2:
        # Check if top category isn't Investment
        invest_months = [
            s for s in monthly_summaries
            if s.get("top_spending_category") == "Investment"
        ]
        if len(invest_months) == 0 and len(monthly_summaries) >= 2:
            alerts.append({
                "alert_id": "NO_INVESTMENT_ACTIVITY",
                "severity": "medium",
                "title": "No Investment Activity Detected",
                "description": "You haven't invested in recent months. Your money is losing value to inflation.",
                "action": "Start a ₹500/month SIP in any index fund. Small start beats no start."
            })

    return alerts


# ─────────────────────────────────────────────
#  PERSONALIZED ADVICE GENERATOR
# ─────────────────────────────────────────────

def generate_advice(
    health_score: float,
    vitals: dict,
    risk_alerts: list[dict],
    financial_profile: dict,
    monthly_summaries: list[dict]
) -> list[dict]:
    """
    Generate personalized, actionable financial advice.
    Advice is prioritized by impact.

    Returns list of advice dicts:
    {
      "priority": 1,
      "category": str,
      "advice": str,
      "impact": "high" | "medium" | "low",
      "estimated_benefit": str
    }
    """
    advice_list = []
    priority = 1

    income = float(financial_profile.get("monthly_income") or 0)
    savings_rate = vitals.get("savings_rate", 0)
    avg_expense = vitals.get("avg_monthly_expense", 0)
    non_essential_ratio = vitals.get("non_essential_ratio", 0)
    emergency_months = vitals.get("emergency_fund_months", 0)
    investment_rate = vitals.get("investment_rate", 0)

    # ── Advice 1: Savings Booster ────────────────────────────
    if savings_rate < BENCHMARKS["ideal_savings_rate"]:
        gap = BENCHMARKS["ideal_savings_rate"] - savings_rate
        monthly_gap = income * gap
        advice_list.append({
            "priority": priority,
            "category": "Savings",
            "advice": (
                f"Your savings rate is {savings_rate*100:.1f}%. "
                f"To reach the 20% benchmark, save ₹{monthly_gap:,.0f} more each month. "
                f"Enable automatic savings transfer on salary day before you spend."
            ),
            "impact": "high",
            "estimated_benefit": f"₹{monthly_gap * 12:,.0f} extra savings per year"
        })
        priority += 1

    # ── Advice 2: Non-Essential Spending ────────────────────
    if non_essential_ratio > BENCHMARKS["max_non_essential_ratio"]:
        potential_saving = (non_essential_ratio - BENCHMARKS["max_non_essential_ratio"]) * avg_expense
        advice_list.append({
            "priority": priority,
            "category": "Expense Reduction",
            "advice": (
                f"Discretionary spending is {non_essential_ratio*100:.0f}% of your expenses. "
                f"Reducing to 30% can free up ₹{potential_saving:,.0f}/month. "
                f"Focus on dining out and entertainment first — high-spend, easy-to-cut categories."
            ),
            "impact": "high",
            "estimated_benefit": f"₹{potential_saving:,.0f}/month available for savings"
        })
        priority += 1

    # ── Advice 3: Emergency Fund ─────────────────────────────
    if emergency_months < BENCHMARKS["emergency_fund_months"]:
        target = avg_expense * BENCHMARKS["emergency_fund_months"]
        current_ef = float(financial_profile.get("emergency_fund_balance") or 0)
        needed = max(0, target - current_ef)
        months_to_build = int(needed / max(income * 0.05, 1))
        advice_list.append({
            "priority": priority,
            "category": "Emergency Fund",
            "advice": (
                f"Your emergency fund covers {emergency_months:.1f} months. "
                f"Target is 6 months (₹{target:,.0f}). "
                f"Save ₹{income*0.05:,.0f}/month in a liquid savings account — "
                f"you'll reach the target in ~{months_to_build} months."
            ),
            "impact": "high",
            "estimated_benefit": "Protection against job loss or medical emergency"
        })
        priority += 1

    # ── Advice 4: Investment ─────────────────────────────────
    if investment_rate < BENCHMARKS["ideal_investment_rate"]:
        gap_amount = income * (BENCHMARKS["ideal_investment_rate"] - investment_rate)
        advice_list.append({
            "priority": priority,
            "category": "Investment",
            "advice": (
                f"You're investing {investment_rate*100:.1f}% of income. "
                f"Starting an additional SIP of ₹{min(gap_amount, 1000):,.0f}/month in an index fund "
                f"can grow to ₹{min(gap_amount, 1000) * 12 * 10 * 1.12:,.0f} in 10 years (at 12% returns)."
            ),
            "impact": "high" if investment_rate < 0.05 else "medium",
            "estimated_benefit": f"₹{min(gap_amount, 1000) * 12 * 10 * 1.12:,.0f} in 10 years"
        })
        priority += 1

    # ── Advice 5: Trend-based insight ────────────────────────
    if len(monthly_summaries) >= 3:
        expenses = [float(s.get("total_expense", 0)) for s in monthly_summaries[-3:]]
        if all(expenses[i] < expenses[i+1] for i in range(len(expenses)-1)):
            advice_list.append({
                "priority": priority,
                "category": "Trend Alert",
                "advice": (
                    f"Expenses have been rising for {len(expenses)} consecutive months. "
                    f"Total increase: ₹{expenses[-1]-expenses[0]:,.0f}. "
                    f"Identify which category is driving the increase and set a monthly cap."
                ),
                "impact": "medium",
                "estimated_benefit": "Prevents lifestyle inflation"
            })
            priority += 1

    # ── Advice 6: Positive reinforcement ────────────────────
    if health_score >= 75:
        advice_list.append({
            "priority": priority,
            "category": "Wealth Building",
            "advice": (
                f"Great financial health (score: {health_score:.0f}/100)! "
                f"Consider diversifying investments — add international index funds "
                f"or step up existing SIPs by 10% annually."
            ),
            "impact": "medium",
            "estimated_benefit": "Accelerated wealth compounding"
        })

    return advice_list


# ─────────────────────────────────────────────
#  TREND ANALYSIS
# ─────────────────────────────────────────────

def analyze_trend(monthly_summaries: list[dict]) -> dict:
    """Detect if financial health is improving, stable, or worsening."""
    if len(monthly_summaries) < 3:
        return {"trend": "insufficient_data", "description": "Need 3+ months of data."}

    savings_rates = []
    for s in monthly_summaries[-3:]:
        income = float(s.get("total_income", 1))
        expense = float(s.get("total_expense", 0))
        savings_rates.append(compute_savings_rate(income, expense))

    if all(savings_rates[i] < savings_rates[i+1] for i in range(len(savings_rates)-1)):
        trend = "improving"
        description = "Savings rate is improving month-over-month. Keep it up!"
    elif all(savings_rates[i] > savings_rates[i+1] for i in range(len(savings_rates)-1)):
        trend = "worsening"
        description = "Savings rate is declining. Expenses are outpacing income growth."
    else:
        trend = "stable"
        description = "Financial behavior is stable."

    return {
        "trend": trend,
        "description": description,
        "savings_rate_3months": [round(r * 100, 1) for r in savings_rates]
    }


# ─────────────────────────────────────────────
#  MAIN FUNCTION
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# ML ANOMALY DETECTION  (from new version — added to existing system)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_txn_date(d):
    """Safe date parsing for transactions."""
    if isinstance(d, datetime): return d
    if isinstance(d, str):
        try: return datetime.fromisoformat(d.replace("Z", ""))
        except Exception: pass
    return datetime.now()

def detect_ml_anomalies(transactions: list) -> list:
    """
    Detect unusual transactions using:
    1. Z-score (statistical outlier)
    2. Isolation Forest (ML-based outlier)
    Returns list of alert dicts compatible with existing risk_alerts format.
    """
    if not transactions or len(transactions) < 10 or not SKLEARN_ANOMALY:
        return []

    expense_txns = [t for t in transactions if t.get("type") == "expense" and float(t.get("amount", 0)) > 0]
    if len(expense_txns) < 5:
        return []

    amounts = np.array([float(t["amount"]) for t in expense_txns])
    mean, std = np.mean(amounts), np.std(amounts)
    alerts = []

    # Z-score anomalies
    for t in expense_txns:
        if std == 0: continue
        z = (float(t["amount"]) - mean) / std
        if abs(z) > 2.5:
            alerts.append({
                "alert_id":   "ANOMALY_ZSCORE",
                "severity":   "medium",
                "title":      f"Unusual Transaction Detected",
                "description":f"₹{float(t['amount']):,.0f} at {t.get('merchant_name','unknown')} "
                              f"is {abs(z):.1f}× your normal average (₹{mean:,.0f}).",
                "action":     "Verify this transaction is legitimate.",
            })

    # Isolation Forest anomalies (cap at 3 to avoid noise)
    try:
        X = StandardScaler().fit_transform(amounts.reshape(-1, 1))
        iso = IsolationForest(contamination=0.1, random_state=42)
        preds = iso.fit_predict(X)
        ml_count = 0
        for i, t in enumerate(expense_txns):
            if preds[i] == -1 and ml_count < 3:
                ml_count += 1
                alerts.append({
                    "alert_id":   "ANOMALY_ML",
                    "severity":   "low",
                    "title":      f"ML-Detected Unusual Spend",
                    "description":f"₹{float(t['amount']):,.0f} at {t.get('merchant_name','unknown')} "
                                  f"deviates from your normal spending pattern (avg ₹{mean:,.0f}).",
                    "action":     "Review if this was a planned or unplanned purchase.",
                })
    except Exception:
        pass

    # Deduplicate — keep highest-severity per merchant
    seen = set()
    deduped = []
    for a in alerts:
        key = a.get("description","")[:40]
        if key not in seen:
            seen.add(key)
            deduped.append(a)

    return deduped[:5]  # max 5 anomaly alerts


def detect_behavior_alerts(transactions: list) -> list:
    """Detect weekend overspending pattern."""
    if not transactions or len(transactions) < 10:
        return []

    weekend_total = 0.0
    weekday_total = 0.0

    for t in transactions:
        if t.get("type") != "expense": continue
        try:
            d = _parse_txn_date(t.get("date", ""))
            amt = float(t.get("amount", 0))
            if d.weekday() >= 5: weekend_total += amt
            else:                weekday_total  += amt
        except Exception:
            continue

    alerts = []
    if weekday_total > 0 and weekend_total > weekday_total * 1.30:
        ratio = weekend_total / (weekday_total + 1)
        alerts.append({
            "alert_id":   "WEEKEND_OVERSPENDING",
            "severity":   "medium",
            "title":      "Weekend Overspending Pattern",
            "description":f"Weekend spending is {ratio:.1f}× higher than weekday spending. "
                          f"Weekend: ₹{weekend_total:,.0f} vs Weekday: ₹{weekday_total:,.0f}.",
            "action":     "Set a weekend budget. Avoid impulse purchases on Sat/Sun.",
        })
    return alerts


def detect_subscription_creep(transactions: list) -> list:
    """Detect too many recurring subscriptions from transaction history."""
    if not transactions:
        return []

    groups = defaultdict(int)
    amounts = defaultdict(float)
    for t in transactions:
        if t.get("type") != "expense": continue
        merchant = str(t.get("merchant_name", "")).lower().strip()
        amt = round(float(t.get("amount", 0)), -1)  # round to nearest 10
        if merchant:
            key = (merchant, amt)
            groups[key] += 1
            amounts[key] = float(t.get("amount", 0))

    recurring = [(merchant, amt) for (merchant, amt), count in groups.items() if count >= 3]
    total_monthly = sum(amounts[(m, a)] for m, a in recurring)

    if len(recurring) > 4:
        return [{
            "alert_id":   "SUBSCRIPTION_CREEP",
            "severity":   "medium",
            "title":      f"Subscription Overload ({len(recurring)} detected)",
            "description":f"You have {len(recurring)} recurring subscriptions totaling ~₹{total_monthly:,.0f}/month. "
                          f"Top subscriptions: {', '.join([m for m, _ in recurring[:4]])}.",
            "action":     "Audit all subscriptions. Cancel ones unused in the last 30 days.",
        }]
    return []


def detect_cash_flow_risk(transactions: list, financial_profile: dict) -> list:
    """Detect if balance may run negative before month end."""
    balance = float(financial_profile.get("current_balance") or 0)
    if balance <= 0:
        return []

    net = balance
    for t in transactions:
        amt = float(t.get("amount", 0))
        net += amt if t.get("type") == "income" else -amt

    if net < 0:
        return [{
            "alert_id":   "CASH_FLOW_RISK",
            "severity":   "high",
            "title":      "Balance May Run Out Soon",
            "description":f"Based on recent transactions, your balance could drop to ₹{net:,.0f}. "
                          f"Current balance: ₹{balance:,.0f}.",
            "action":     "Reduce non-essential spending immediately or transfer from savings.",
        }]
    return []


def analyze_financial_health(
    monthly_summaries: list[dict],
    financial_profile: dict,
    investments: list[dict] = None,
    goals: list[dict] = None,
    transactions: list[dict] = None
) -> dict:
    """
    Full financial health analysis.

    Args:
        monthly_summaries : List of MonthlySummary docs (sorted ASC)
        financial_profile : FinancialProfile doc for the user
        investments       : List of Investment docs
        goals             : List of Goal docs
        transactions      : Recent transaction list (last 1–3 months)

    Returns:
        {
          "health_score": int (0–100),
          "risk_level": str,
          "vitals": dict,
          "component_scores": dict,
          "risk_alerts": list,
          "advice": list,
          "trend": dict,
          "summary": str
        }
    """
    investments  = investments  or []
    goals        = goals        or []
    transactions = transactions or []

    # ── Sanitize MongoDB docs (remove ObjectId, _id, datetime keys) ──
    def _clean(docs):
        cleaned = []
        for d in docs:
            if not isinstance(d, dict):
                try: d = dict(d)
                except: continue
            cleaned.append({k: v for k, v in d.items() if not str(k).startswith("_")})
        return cleaned

    monthly_summaries = _clean(monthly_summaries)
    investments       = _clean(investments)
    goals             = _clean(goals)
    transactions      = _clean(transactions)
    if financial_profile and not isinstance(financial_profile, dict):
        try: financial_profile = dict(financial_profile)
        except: financial_profile = {}
    if isinstance(financial_profile, dict):
        financial_profile = {k: v for k, v in financial_profile.items() if not str(k).startswith("_")}

    if not monthly_summaries:
        return {"error": "No monthly summary data available."}

    # ── Aggregate vitals ─────────────────────────────────────
    income = float(financial_profile.get("monthly_income") or 0)
    emergency_fund     = float(financial_profile.get("emergency_fund_balance") or 0)

    total_incomes   = [float(s.get("total_income", income)) for s in monthly_summaries]
    total_expenses  = [float(s.get("total_expense", 0)) for s in monthly_summaries]
    non_essentials  = [float(s.get("non_essential_expense", 0)) for s in monthly_summaries]

    avg_income   = np.mean(total_incomes)  if total_incomes  else income
    avg_expense  = np.mean(total_expenses) if total_expenses else 0
    avg_non_ess  = np.mean(non_essentials) if non_essentials else 0

    savings_rate          = compute_savings_rate(avg_income, avg_expense)
    non_essential_ratio   = compute_non_essential_ratio(avg_non_ess, avg_expense)
    emergency_fund_months = compute_emergency_fund_months(emergency_fund, avg_expense)

    # Investment total & rate
    total_invested = sum(float(i.get("amount_invested", 0)) for i in investments)
    monthly_invest = sum(float(i.get("monthly_contribution", 0)) for i in investments)
    investment_rate = monthly_invest / avg_income if avg_income > 0 else 0.0

    invest_consistency = compute_investment_consistency(investments, len(monthly_summaries))
    goal_progress = compute_goal_progress(goals)

    vitals = {
        "avg_monthly_income":    round(avg_income, 2),
        "avg_monthly_expense":   round(avg_expense, 2),
        "savings_rate":          round(savings_rate, 4),
        "non_essential_ratio":   round(non_essential_ratio, 4),
        "emergency_fund_months": round(emergency_fund_months, 2),
        "investment_rate":       round(investment_rate, 4),
        "invest_consistency":    round(invest_consistency, 4),
        "goal_progress_ratio":   round(goal_progress, 4),
        "total_invested":        round(total_invested, 2)
    }

    # ── Component Scores ─────────────────────────────────────
    score_savings    = _score_savings_rate(savings_rate)
    score_expense    = _score_expense_control(non_essential_ratio)
    score_investment = _score_investment(invest_consistency, investment_rate)
    score_emergency  = _score_emergency_fund(emergency_fund_months)
    score_goal       = _score_goal_progress(goal_progress)
    # Debt score: placeholder (use 70 if no debt data)
    score_debt       = 70.0

    component_scores = {
        "savings_rate":          round(score_savings, 1),
        "expense_control":       round(score_expense, 1),
        "investment_discipline": round(score_investment, 1),
        "emergency_fund":        round(score_emergency, 1),
        "debt_load":             round(score_debt, 1),
        "goal_progress":         round(score_goal, 1),
    }

    # ── Weighted Health Score ────────────────────────────────
    health_score = sum(
        SCORE_WEIGHTS[key] * component_scores[key]
        for key in SCORE_WEIGHTS
    )
    health_score = round(min(100, max(0, health_score)), 1)

    # ── Risk Level ────────────────────────────────────────────
    risk_level = "excellent"
    for level, info in RISK_LEVELS.items():
        lo, hi = info["score_range"]
        if lo <= health_score < hi:
            risk_level = level
            break

    # ── Risk Alerts (rule-based) ─────────────────────────────
    risk_alerts = detect_risk_alerts(monthly_summaries, financial_profile, transactions)

    # ── ML Anomaly Alerts (NEW) ───────────────────────────────
    ml_anomaly_alerts   = detect_ml_anomalies(transactions)
    behavior_alerts     = detect_behavior_alerts(transactions)
    subscription_alerts = detect_subscription_creep(transactions)
    cashflow_alerts     = detect_cash_flow_risk(transactions, financial_profile)

    # Merge all alerts (rule-based first, then ML)
    risk_alerts = risk_alerts + ml_anomaly_alerts + behavior_alerts + subscription_alerts + cashflow_alerts

    # ── Advice ───────────────────────────────────────────────
    advice = generate_advice(health_score, vitals, risk_alerts, financial_profile, monthly_summaries)

    # ── Trend ────────────────────────────────────────────────
    trend = analyze_trend(monthly_summaries)

    # ── Summary Sentence ─────────────────────────────────────
    level_info = RISK_LEVELS.get(risk_level, {})
    level_label = level_info.get("label", risk_level.title())
    alert_count = len([a for a in risk_alerts if a["severity"] == "high"])

    if health_score >= 90:
        summary = f"Excellent financial health ({health_score}/100). Keep compounding!"
    elif health_score >= 75:
        summary = f"Good financial health ({health_score}/100). Fine-tune investments and savings."
    elif health_score >= 60:
        summary = (
            f"Moderate financial health ({health_score}/100). "
            f"{alert_count} high-priority issues need attention."
        )
    else:
        summary = (
            f"Financial health is {level_label} ({health_score}/100). "
            f"Take immediate action on the {alert_count} critical alerts."
        )

    return {
        "health_score": health_score,
        "risk_level": risk_level,
        "risk_level_label": level_label,
        "vitals": vitals,
        "component_scores": component_scores,
        "risk_alerts": risk_alerts,
        "advice": advice,
        "trend": trend,
        "summary": summary,
        "months_analyzed": len(monthly_summaries)
    }