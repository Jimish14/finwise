"""
=============================================================
  SMART GOAL CALCULATOR — ULTIMATE MERGED VERSION 🔥
=============================================================
✔ Inflation-adjusted Future Value (per-category rates)
✔ ML Savings Prediction (LinearRegression on history)
✔ Proper SIP Formula (annuity-based)
✔ Recurring Expense Detection (auto-deducted from savings)
✔ Behavioral Analysis (weekend overspending detection)
✔ Risk Engine (emergency fund + debt penalty)
✔ User Segmentation (Saver / Balanced / Spender)
✔ Continuous Learning (trend-based adjustment)
✔ Gap Analysis & Optimization Suggestions
✔ Alternative Plans (extend timeline, SIP, partial goal)
✔ Quarterly Milestones
✔ Confidence Interval on required saving
✔ MongoDB Sanitizer
=============================================================
"""

import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression

try:
    from dateutil.relativedelta import relativedelta
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False


# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
CATEGORY_INFLATION = {
    "vehicle":    0.07,
    "gadget":     0.03,
    "travel":     0.06,
    "investment": 0.00,
    "education":  0.10,
    "other":      0.06,
}

OPTIMIZATION_LIMITS = {
    "Entertainment": 0.70,
    "Shopping":      0.50,
    "Food":          0.30,
    "Dining Out":    0.60,
    "Subscriptions": 0.50,
    "Travel":        0.60,
    "Miscellaneous": 0.40,
}

INVESTMENT_RETURNS = {
    "SIP":     0.12,
    "FD":      0.07,
    "Savings": 0.04,
    "PPF":     0.071,
    "Stocks":  0.15,
    "Gold":    0.08,
}


# ─────────────────────────────────────────────
# DATE HELPER
# ─────────────────────────────────────────────
def _parse_date(d):
    if isinstance(d, datetime):
        return d
    if isinstance(d, str):
        try:
            return datetime.fromisoformat(d.replace("Z", ""))
        except Exception:
            return datetime.now()
    return datetime.now()


# ─────────────────────────────────────────────
# MONGODB SANITIZER
# ─────────────────────────────────────────────
def _clean_doc(d):
    if not isinstance(d, dict):
        try:    d = dict(d)
        except: return {}
    return {k: v for k, v in d.items() if not str(k).startswith("_")}


# ─────────────────────────────────────────────
# NLP TRANSACTION CORRECTION (NEW)
# ─────────────────────────────────────────────
_KEYWORD_MAP = {
    "swiggy":    "Food",  "zomato":      "Food",    "bigbasket":   "Food",
    "amazon":    "Shopping","flipkart":  "Shopping", "myntra":      "Shopping",
    "netflix":   "Entertainment","spotify":"Entertainment","hotstar":"Entertainment",
    "uber":      "Transport","ola":      "Transport","rapido":      "Transport",
    "hospital":  "Health", "pharmacy":   "Health",   "apollo":      "Health",
    "sip":       "Investment","zerodha": "Investment","groww":       "Investment",
    "jio":       "Bills",  "airtel":     "Bills",    "electricity": "Bills",
}

def _classify_transaction_nlp(description):
    text = (description or "").lower()
    for keyword, category in _KEYWORD_MAP.items():
        if keyword in text:
            return category
    return "Other"

def _correct_misclassification(transactions):
    corrected = []
    for t in list(transactions):
        t = dict(t)
        if not t.get("category") or t.get("category") == "Other":
            t["category"] = _classify_transaction_nlp(t.get("description", "") or t.get("merchant_name", ""))
        corrected.append(t)
    return corrected


# ─────────────────────────────────────────────
# RECURRING DETECTION (NEW — merchant-based)
# ─────────────────────────────────────────────
def _detect_recurring_from_transactions(transactions):
    """Detect recurring expenses from raw transactions using merchant+amount pattern."""
    merchant_map = {}
    for t in transactions:
        name = str(t.get("merchant_name", "")).lower().strip()
        amt  = round(float(t.get("amount", 0)), 0)
        if not name:
            continue
        key = (name, amt)
        try:
            d = _parse_date(t.get("date", ""))
            merchant_map.setdefault(key, []).append(d)
        except Exception:
            continue

    total = 0.0
    for (merchant, amt), dates in merchant_map.items():
        if len(dates) < 3:
            continue
        dates.sort()
        intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
        avg_interval = np.mean(intervals)
        if 25 <= avg_interval <= 35:
            total += amt           # monthly
        elif 6 <= avg_interval <= 10:
            total += amt * 4       # weekly

    return float(total)


# ─────────────────────────────────────────────
# STEP 1: INFLATION-ADJUSTED FUTURE VALUE
# ─────────────────────────────────────────────
def compute_future_value(
    current_price: float,
    goal_category: str,
    months: int,
    custom_rate: float = None,
) -> dict:
    annual_rate = custom_rate if custom_rate is not None \
                  else CATEGORY_INFLATION.get(goal_category, 0.06)
    monthly_rate  = annual_rate / 12
    future_value  = current_price * ((1 + monthly_rate) ** months)
    inflation_added = future_value - current_price
    return {
        "current_price":    round(current_price,  2),
        "future_value":     round(future_value,   2),
        "inflation_added":  round(inflation_added,2),
        "annual_rate_used": round(annual_rate,    4),
        "months":           months,
    }


# ─────────────────────────────────────────────
# STEP 2: REQUIRED MONTHLY SAVING (SIP-BASED 🔥)
# ─────────────────────────────────────────────
def compute_required_saving(
    target_amount: float,
    existing_allocation: float,
    months: int,
    investment_return: float = 0.12,
) -> dict:
    remaining = max(0, target_amount - existing_allocation)
    r = investment_return / 12  # monthly rate

    # SIP formula (annuity): PMT = FV × r / ((1+r)^n - 1)
    if r > 0 and months > 0:
        factor = ((1 + r) ** months - 1)
        sip_required = remaining * r / factor if factor > 0 else remaining / months
    else:
        sip_required = remaining / max(months, 1)

    # Simple (no investment return) monthly saving
    simple_required = remaining / max(months, 1)

    return {
        "target_amount":           round(target_amount,    2),
        "existing_allocation":     round(existing_allocation, 2),
        "remaining_amount":        round(remaining,        2),
        "required_monthly_saving": round(sip_required,     2),
        "simple_required":         round(simple_required,  2),
        "investment_return_rate":  investment_return,
        "months":                  months,
    }


# ─────────────────────────────────────────────
# STEP 3: SAVING CAPACITY
# ─────────────────────────────────────────────
def compute_saving_capacity(
    monthly_summaries: list,
    financial_profile: dict,
) -> dict:
    income  = float(financial_profile.get("monthly_income") or 0)

    if monthly_summaries:
        avg_income  = np.mean([float(s.get("total_income",  income)) for s in monthly_summaries])
        avg_expense = np.mean([float(s.get("total_expense") or 0)      for s in monthly_summaries])
        avg_non_ess = np.mean([float(s.get("non_essential_expense") or 0) for s in monthly_summaries])
        current_savings  = max(0, avg_income - avg_expense)
        discretionary    = avg_non_ess
        potential_savings= current_savings + discretionary * 0.40
    else:
        avg_income       = income
        avg_expense      = income * 0.70
        current_savings  = income * 0.30
        discretionary    = income * 0.20
        potential_savings= current_savings + discretionary * 0.40

    return {
        "current_savings":   round(current_savings,   2),
        "potential_savings": round(potential_savings, 2),
        "discretionary":     round(discretionary,     2),
        "avg_income":        round(avg_income,        2),
        "avg_expense":       round(avg_expense,       2),
    }


# ─────────────────────────────────────────────
# ML SAVINGS PREDICTOR (NEW 🔥)
# ─────────────────────────────────────────────
def _train_savings_model(monthly_summaries):
    """Train LinearRegression to predict savings from income+expense history."""
    if len(monthly_summaries) < 3:
        return None
    X, y = [], []
    for s in monthly_summaries:
        inc = float(s.get("total_income") or 0)
        exp = float(s.get("total_expense") or 0)
        X.append([inc, exp])
        y.append(max(0, inc - exp))
    try:
        return LinearRegression().fit(X, y)
    except Exception:
        return None

def _predict_saving_ml(model, income, expense):
    """Use trained model to predict monthly saving."""
    if model is None:
        return max(0, income - expense)
    try:
        return float(max(0, model.predict([[income, expense]])[0]))
    except Exception:
        return max(0, income - expense)


# ─────────────────────────────────────────────
# BEHAVIORAL ANALYSIS (NEW 🔥)
# ─────────────────────────────────────────────
def _analyze_behavior(transactions):
    """Detect weekend overspending pattern."""
    weekend = 0.0
    weekday = 0.0
    for t in transactions:
        try:
            amt = float(t.get("amount") or 0)
            d   = _parse_date(t.get("date", ""))
            if d.weekday() >= 5:
                weekend += amt
            else:
                weekday += amt
        except Exception:
            continue
    patterns = []
    if weekday > 0 and weekend > weekday:
        patterns.append("weekend_overspending")
    return patterns

def _adjust_for_behavior(saving, patterns):
    if "weekend_overspending" in patterns:
        return saving * 0.90
    return saving


# ─────────────────────────────────────────────
# RISK ENGINE (NEW 🔥)
# ─────────────────────────────────────────────
def _risk_adjustment(saving, financial_profile, avg_expense):
    """
    Reduce effective saving based on risk factors:
    - Low emergency fund penalty
    - Monthly debt penalty
    """
    penalty = 0.0
    risk_flags = []

    emergency = float(financial_profile.get("emergency_fund_balance") or 0)
    if emergency < avg_expense * 3:
        penalty += 0.20
        risk_flags.append("low_emergency_fund")

    monthly_debt = float(financial_profile.get("monthly_debt") or 0)
    if monthly_debt > 0:
        penalty += 0.10
        risk_flags.append("has_debt")

    penalty = min(penalty, 0.40)   # cap at 40% reduction
    adjusted_saving = saving * (1 - penalty)
    return round(adjusted_saving, 2), round(penalty * 100, 1), risk_flags


# ─────────────────────────────────────────────
# USER SEGMENTATION (NEW)
# ─────────────────────────────────────────────
def _segment_user(income, expense):
    ratio = (income - expense) / (income + 1)
    if ratio > 0.30:   return "Saver"
    elif ratio < 0.10: return "Spender"
    return "Balanced"


# ─────────────────────────────────────────────
# CONTINUOUS LEARNING (NEW 🔥)
# ─────────────────────────────────────────────
def _learning_adjustment(memory, saving):
    """
    Adjust saving capacity prediction based on past saving trend.
    memory = list of past monthly savings (oldest first).
    """
    if not memory or len(memory) < 2:
        return saving
    try:
        trend = np.polyfit(range(len(memory)), memory, 1)[0]
        if trend < 0:
            return saving * 0.90    # downward trend → be conservative
        elif trend > 0:
            return saving * 1.05    # upward trend → slight optimism
    except Exception:
        pass
    return saving


# ─────────────────────────────────────────────
# CONFIDENCE INTERVAL ON REQUIRED SAVING (NEW)
# ─────────────────────────────────────────────
def _saving_confidence_range(required):
    return {
        "min": round(required * 0.90, 2),
        "max": round(required * 1.10, 2),
    }


# ─────────────────────────────────────────────
# OPTIMIZATION SUGGESTIONS
# ─────────────────────────────────────────────
def find_optimization_opportunities(category_expenses, monthly_gap):
    suggestions = []
    remaining_gap = monthly_gap

    sorted_cats = sorted(
        [(c, a) for c, a in category_expenses.items() if c in OPTIMIZATION_LIMITS],
        key=lambda x: x[1], reverse=True
    )

    for category, current_spend in sorted_cats:
        if remaining_gap <= 0:
            break
        max_cut_pct = OPTIMIZATION_LIMITS[category]
        max_cut_amt = current_spend * max_cut_pct
        cut_amt     = min(max_cut_amt, remaining_gap * 1.2)
        if cut_amt < 100:
            continue
        actual_pct  = cut_amt / current_spend if current_spend > 0 else 0
        new_budget  = current_spend - cut_amt
        suggestions.append({
            "category":             category,
            "current_spend":        round(current_spend) or 0,
            "suggested_cut_percent":round(actual_pct * 100) or 0,
            "monthly_saving":       round(cut_amt) or 0,
            "new_budget":           round(new_budget) or 0,
            "tip": _get_cut_tip(category, actual_pct),
        })
        remaining_gap -= cut_amt

    return suggestions

def _get_cut_tip(category, cut_pct):
    tips = {
        "Entertainment":f"Cancel {round(cut_pct*100)}% of OTT/gaming subscriptions. Keep 1–2.",
        "Shopping":     f"Set a ₹ cap per purchase. Avoid impulse buys.",
        "Food":         f"Cook at home more. Limit Swiggy/Zomato to weekends.",
        "Subscriptions":f"Audit all subscriptions. Remove unused ones.",
        "Travel":       f"Opt for local trips. Plan travel well in advance.",
        "Miscellaneous":f"Track miscellaneous spending more carefully.",
    }
    return tips.get(category, f"Reduce {category} spending by {round(cut_pct*100)}%.")


# ─────────────────────────────────────────────
# ALTERNATIVE PLANS
# ─────────────────────────────────────────────
def generate_alternative_plans(target_amount, current_savings, existing_allocation, months):
    plans = []

    # Plan 1: Extend timeline
    if current_savings > 0:
        needed    = target_amount - existing_allocation
        new_months= int(np.ceil(needed / current_savings))
        if new_months > months:
            plans.append({
                "plan":        "Extend Timeline",
                "description": f"Save ₹{current_savings:,.0f}/month and reach goal in {new_months} months.",
                "new_months":  new_months,
                "feasibility": "high",
            })

    # Plan 2: SIP investment
    for inv_type, annual_ret in [("SIP", 0.12), ("FD", 0.07)]:
        r = annual_ret / 12
        if r > 0:
            factor = ((1 + r) ** months - 1)
            sip_amt = (target_amount - existing_allocation) * r / factor if factor > 0 else 0
            if sip_amt > 0:
                plans.append({
                    "plan":        f"Invest via {inv_type}",
                    "description": f"₹{sip_amt:,.0f}/month in {inv_type} at {annual_ret*100:.0f}% p.a. reaches goal in {months} months.",
                    "sip_amount":  round(sip_amt) or 0,
                    "feasibility": "medium",
                })

    # Plan 3: Partial goal
    achievable = existing_allocation + current_savings * months
    if achievable < target_amount:
        plans.append({
            "plan":        "Partial Goal First",
            "description": f"Save for {months} months → accumulate ₹{achievable:,.0f}. Pay the rest from income.",
            "amount_by_deadline": round(achievable) or 0,
            "feasibility": "medium",
        })

    return plans[:4]


# ─────────────────────────────────────────────
# QUARTERLY MILESTONES
# ─────────────────────────────────────────────
def generate_milestones(start_date, target_date, target_amount, amount_saved_so_far, monthly_saving):
    milestones = []
    
    # 1. NEW: What if they ALREADY have 100% of the money saved right now?
    if amount_saved_so_far >= target_amount:
        milestones.append({
            "milestone":        f"₹{target_amount:,.0f} saved",
            "date":             start_date.strftime("%B %Y"),
            "progress_percent": 100.0,
            "on_track_check":   "Goal Achieved! 🎉",
        })
        return milestones

    if monthly_saving <= 0:
        return milestones

    total_months = max(1, (target_date.year - start_date.year) * 12 + (target_date.month - start_date.month))
    checkpoint_months = sorted(set(list(range(3, total_months, 3)) + [total_months]))

    for m in checkpoint_months:
        if HAS_DATEUTIL:
            milestone_date = start_date + relativedelta(months=m)
        else:
            milestone_date = start_date + timedelta(days=m * 30)

        # 2. NEW: Calculate based on live amount and cap at target
        accumulated = amount_saved_so_far + (monthly_saving * m)
        display_accumulation = min(accumulated, target_amount)
        pct = min(100.0, round((display_accumulation / target_amount) * 100, 1))

        # 3. NEW: Determine EXACT status
        if pct == 100.0:
            status_text = "Goal Achieved! 🎉"
        elif pct >= (m / total_months * 100 - 5):
            status_text = "On track ✅"
        else:
            status_text = "Behind schedule ⚠️"

        milestones.append({
            "milestone":        f"₹{display_accumulation:,.0f} saved",
            "date":             milestone_date.strftime("%B %Y"),
            "progress_percent": pct,
            "on_track_check":   status_text,
        })

        # 4. NEW: Stop predicting future milestones if goal is hit early!
        if pct == 100.0:
            break

    return milestones


# ─────────────────────────────────────────────
# MAIN FUNCTION
# ─────────────────────────────────────────────
def calculate_goal_plan(
    goal: dict,
    financial_profile: dict,
    monthly_summaries: list = None,
    category_expenses: dict = None,
    transactions: list = None,   # NEW — raw transactions for ML+behavior+recurring
    memory: list = None,         # NEW — past monthly savings for continuous learning
) -> dict:
    """
    Full smart goal calculation.

    Args:
        goal               : Goal document from DB
        financial_profile  : FinancialProfile document
        monthly_summaries  : List of MonthlySummary docs
        category_expenses  : { "Food": 8000, ... } for optimization
        transactions       : Raw recent transactions (NEW — for ML, behavior, recurring)
        memory             : Past saving history list (NEW — for continuous learning)

    Returns enriched dict with feasibility, SIP, milestones, ML prediction,
    behavioral analysis, risk assessment, and confidence intervals.
    """
    monthly_summaries = monthly_summaries or []
    category_expenses = category_expenses or {}
    transactions      = transactions      or []
    memory            = list(memory) if memory else []

    # ── Sanitize ─────────────────────────────────────────────
    if not isinstance(goal, dict):
        try:    goal = dict(goal)
        except: goal = {}
    goal              = _clean_doc(goal)
    financial_profile = _clean_doc(financial_profile) if isinstance(financial_profile, dict) \
                        else (financial_profile or {})
    monthly_summaries = [_clean_doc(s) for s in monthly_summaries]
    transactions      = [_clean_doc(t) for t in transactions]

    # ── NLP correct transaction categories ──────────────────
    transactions = _correct_misclassification(transactions)

    # ── Parse dates ──────────────────────────────────────────
    start_date  = _parse_date(goal.get("goal_start_date",  datetime.now()))
    target_date = _parse_date(goal.get("goal_target_date", datetime.now()))
    now         = datetime.now()

    months_remaining = max(1,
        (target_date.year - now.year) * 12 + (target_date.month - now.month)
    )

    current_price       = float(goal.get("current_price",        0))
    goal_category       = goal.get("goal_category", "other")
    custom_infl_raw     = goal.get("expected_inflation_rate")
    custom_inflation    = float(custom_infl_raw) / 100 if custom_infl_raw else None
    auto_adjust         = goal.get("auto_adjust_inflation", True)
    if not auto_adjust:
        custom_inflation = 0.0

    # ── THE FIX: use current_amount (live saved amount) ──────
    # existing_allocation = amount set at goal creation (never changes)
    # current_amount      = actual money saved so far (updates when user adds funds)
    # We use the HIGHER of the two so adding funds always reduces required/month
    existing_allocation = float(goal.get("existing_allocation") or 0)
    current_amount      = float(goal.get("current_amount") or 0)
    amount_saved_so_far = max(existing_allocation, current_amount)
    # ── STEP 1: Future Value ─────────────────────────────────
    fv_result     = compute_future_value(current_price, goal_category, months_remaining, custom_inflation)
    target_amount = fv_result["future_value"]

    # ── STEP 2: Required Saving (SIP-based) ─────────────────
    # Pass amount_saved_so_far so required/month drops as user saves more
    req_result       = compute_required_saving(target_amount, amount_saved_so_far, months_remaining)
    required_monthly = req_result["required_monthly_saving"]

    # ── STEP 3: Saving Capacity (history-based) ──────────────
    capacity          = compute_saving_capacity(monthly_summaries, financial_profile)
    avg_income        = capacity["avg_income"]
    avg_expense       = capacity["avg_expense"]
    current_savings   = capacity["current_savings"]
    potential_savings = capacity["potential_savings"]

    # ── STEP 3b: ML Savings Prediction (NEW) ─────────────────
    ml_model = _train_savings_model(monthly_summaries)
    ml_saving = _predict_saving_ml(ml_model, avg_income, avg_expense)

    # ── STEP 3c: Detect recurring from transactions (NEW) ────
    recurring_from_txns = _detect_recurring_from_transactions(transactions)
    ml_saving_after_recurring = max(0, ml_saving - recurring_from_txns)

    # ── STEP 3d: Behavioral adjustment (NEW) ─────────────────
    behavior_patterns = _analyze_behavior(transactions)
    ml_saving_adjusted = _adjust_for_behavior(ml_saving_after_recurring, behavior_patterns)

    # ── STEP 3e: Risk adjustment (NEW) ───────────────────────
    ml_saving_risk, risk_penalty_pct, risk_flags = _risk_adjustment(
        ml_saving_adjusted, financial_profile, avg_expense
    )

    # ── STEP 3f: Continuous learning (NEW) ───────────────────
    ml_saving_final = _learning_adjustment(memory, ml_saving_risk)
    # Update memory
    memory.append(round(ml_saving_final, 2))

    # Blend ML saving with capacity-based saving
    effective_saving = (
        0.60 * ml_saving_final + 0.40 * current_savings
        if ml_model else current_savings
    )
    effective_saving = round(max(0, effective_saving), 2)

    # ── STEP 3g: User segmentation (NEW) ─────────────────────
    user_type = _segment_user(avg_income, avg_expense)

    # ── STEP 4: Gap Analysis ─────────────────────────────────
    gap           = required_monthly - effective_saving
    potential_gap = required_monthly - potential_savings

    gap_analysis = {
        "required_monthly_saving":  round(required_monthly,  2),
        "current_monthly_saving":   round(effective_saving,  2),
        "ml_predicted_saving":      round(ml_saving_final,   2),
        "potential_monthly_saving": round(potential_savings, 2),
        "gap_from_current":         round(max(0, gap),       2),
        "gap_from_potential":       round(max(0, potential_gap), 2),
        "is_feasible_now":          bool(gap <= 0),
        "is_feasible_with_cuts":    bool(potential_gap <= 0),
    }

    # ── STEP 5: Optimization Suggestions ────────────────────
    optimization_suggestions = []
    if gap > 0 and category_expenses:
        optimization_suggestions = find_optimization_opportunities(category_expenses, gap)

    # ── STEP 6: Alternative Plans ────────────────────────────
    alternative_plans = []
    if gap > 0:
        alternative_plans = generate_alternative_plans(
        target_amount, effective_saving, amount_saved_so_far, months_remaining
    )

    # ── STEP 7: Milestones ───────────────────────────────────
    eff_for_milestones = min(effective_saving, required_monthly) if gap <= 0 else effective_saving
    milestones = generate_milestones(
        start_date, target_date, target_amount,
        amount_saved_so_far, eff_for_milestones
    )

    # ── STEP 8: Confidence Interval on required saving (NEW) ─
    saving_confidence = _saving_confidence_range(required_monthly)

    # ── Feasibility Score ────────────────────────────────────
    if amount_saved_so_far >= target_amount:
        feasibility_score = 100.0
        feasibility_label = "Goal Achieved! 🎉"
    elif gap <= 0:
        feasibility_score = 100.0
        feasibility_label = "Highly Feasible"
    elif potential_gap <= 0:
        cut_severity      = gap / max(capacity["discretionary"], 1)
        feasibility_score = max(50, 90 - cut_severity * 30)
        feasibility_label = "Feasible with Adjustments"
    else:
        deficit_ratio     = potential_gap / required_monthly
        feasibility_score = max(0, 50 - deficit_ratio * 50)
        if feasibility_score >= 40:
            feasibility_label = "Challenging"
        else:
            feasibility_label = "Not Feasible in Current Timeline"

    # ── Summary ──────────────────────────────────────────────
    goal_name = goal.get("goal_name", "Your Goal")
    if amount_saved_so_far >= target_amount:
        summary = (
            f"Congratulations! You have fully funded '{goal_name}'. "
            f"Target of ₹{target_amount:,.0f} achieved! 🎉"
        )
    elif gap <= 0:
        summary = (
            f"Great! You can achieve '{goal_name}' on time. "
            f"Save ₹{required_monthly:,.0f}/month → ₹{target_amount:,.0f} by {target_date.strftime('%B %Y')}."
        )
    elif potential_gap <= 0:
        total_cut = sum(s["monthly_saving"] for s in optimization_suggestions)
        summary = (
            f"'{goal_name}' is achievable with spending adjustments. "
            f"You need ₹{gap:,.0f}/month more. "
            f"Optimization can free up ₹{total_cut:,.0f}/month."
        )
    else:
        best_alt = alternative_plans[0] if alternative_plans else None
        alt_text = (f" Best alternative: {best_alt['plan']}." if best_alt else "")
        summary  = (
            f"'{goal_name}' needs {months_remaining} months at current rate.{alt_text} "
            f"Consider extending the timeline or reducing the goal amount."
        )
        
    return {
        "goal_name":                goal_name,
        "months_remaining":         months_remaining,
        "target_date":              target_date.strftime("%B %Y"),
        # Financial
        "future_value":             fv_result,
        "required_saving":          {**req_result, "confidence_range": saving_confidence},
        "saving_capacity":          capacity,
        # New ML fields
        "ml_predicted_saving":      round(ml_saving_final, 2),
        "recurring_deducted":       round(recurring_from_txns, 2),
        "risk_penalty_percent":     risk_penalty_pct,
        "risk_flags":               risk_flags,
        "behavior_patterns":        behavior_patterns,
        "user_type":                user_type,
        "memory":                   memory[-6:],   # keep last 6 entries
        # Analysis
        "gap_analysis":             gap_analysis,
        "optimization_suggestions": optimization_suggestions,
        "alternative_plans":        alternative_plans,
        "milestones":               milestones,
        # Score
        "feasibility_score":        round(feasibility_score, 1),
        "feasibility_label":        feasibility_label,
        "summary":                  summary,
    }