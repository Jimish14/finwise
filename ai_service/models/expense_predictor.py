"""
=============================================================
  AI EXPENSE PREDICTOR — ULTIMATE HYBRID ENSEMBLE
=============================================================
✔ Prophet + Trend + XGBoost (3-model Ensemble)
✔ Prediction Confidence Range (Interval)
✔ NLP Event Detection (TF-IDF + LogisticRegression)
✔ Dynamic Inflation (per-category)
✔ Salary Intelligence
✔ User Segmentation (saver / balanced / spender)
✔ Learned Festival & Category Multipliers
✔ Auto Recurring Detection
✔ Behavioral Intelligence (lifestyle + habit)
✔ Category-wise Prediction
✔ Backtest Error Calculation
✔ MongoDB Sanitizer (handles ObjectId, datetime, numpy)
=============================================================
"""

import numpy as np
import pandas as pd
from datetime import datetime

# ── Suppress noisy logs BEFORE any imports ───────────────────────
try:
    import logging as _log
    for _noisy in ("prophet", "cmdstanpy", "pystan", "stan"):
        _l = _log.getLogger(_noisy)
        _l.setLevel(_log.ERROR)
        _l.propagate = False
    from prophet import Prophet
    import cmdstanpy as _csp
    _csp.utils.get_logger().setLevel(_log.ERROR)
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    Prophet = None
except Exception:
    PROPHET_AVAILABLE = False
    Prophet = None

# ── XGBoost safe import ──────────────────────────────────────────
try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    XGBRegressor = None

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


# ─────────────────────────────────────────────
# GLOBAL SEED DATA (bootstraps Prophet for new users)
# ─────────────────────────────────────────────
GLOBAL_DATASET = [
    {"month": "2024-01", "total_expense": 25000},
    {"month": "2024-02", "total_expense": 27000},
    {"month": "2024-03", "total_expense": 26000},
    {"month": "2024-04", "total_expense": 30000},
    {"month": "2024-05", "total_expense": 28000},
    {"month": "2024-06", "total_expense": 32000},
]


# ─────────────────────────────────────────────
# DATE PARSE HELPER
# ─────────────────────────────────────────────
def _parse_date(d):
    if isinstance(d, datetime):
        return d
    if isinstance(d, str):
        d = d.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(d)
        except Exception:
            pass
        try:
            return datetime.strptime(d[:10], "%Y-%m-%d")
        except Exception:
            pass
    return datetime.now()


# ─────────────────────────────────────────────
# NLP EVENT CLASSIFIER
# ─────────────────────────────────────────────
EVENT_SAMPLES = [
    ("trip to goa",        "travel"),
    ("family vacation",    "travel"),
    ("flight booking",     "travel"),
    ("friend wedding",     "wedding"),
    ("brother wedding",    "wedding"),
    ("doctor visit",       "medical"),
    ("hospital admission", "medical"),
    ("birthday party",     "birthday"),
    ("exam preparation",   "exam"),
    ("new phone",          "shopping"),
    ("laptop purchase",    "shopping"),
]

EVENT_MULTIPLIERS = {
    "travel":   1.15,
    "wedding":  1.30,
    "medical":  1.12,
    "birthday": 1.08,
    "exam":     1.05,
    "shopping": 1.10,
    "other":    1.0,
}

class EventClassifier:
    def __init__(self):
        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer()),
            ("clf",   LogisticRegression(max_iter=200)),
        ])
        self._train()

    def _train(self):
        X = [t for t, _ in EVENT_SAMPLES]
        y = [l for _, l in EVENT_SAMPLES]
        self.pipeline.fit(X, y)

    def predict(self, text):
        try:
            return self.pipeline.predict([str(text)])[0]
        except Exception:
            return "other"

event_classifier = EventClassifier()


# ─────────────────────────────────────────────
# INFLATION (per category)
# ─────────────────────────────────────────────
CATEGORY_INFLATION = {
    "Food":          0.06,
    "Transport":     0.07,
    "Shopping":      0.05,
    "Travel":        0.09,
    "Health":        0.08,
    "Education":     0.10,
    "Rent":          0.06,
    "Bills":         0.05,
    "Miscellaneous": 0.06,
    "Entertainment": 0.05,
    "Investment":    0.00,
}

def _dynamic_inflation_multiplier(category):
    annual = CATEGORY_INFLATION.get(category, 0.06)
    return 1 + annual / 12


# ─────────────────────────────────────────────
# SALARY INTELLIGENCE
# ─────────────────────────────────────────────
def _salary_trend(incomes):
    if len(incomes) < 3:
        return "stable"
    if all(incomes[i] < incomes[i+1] for i in range(len(incomes)-1)):
        return "increasing"
    if all(incomes[i] > incomes[i+1] for i in range(len(incomes)-1)):
        return "decreasing"
    return "stable"

def _salary_multiplier(incomes, expenses):
    avg_income  = np.mean(incomes)  if incomes  else 0
    avg_expense = np.mean(expenses) if expenses else 0
    if avg_income == 0:
        return 1.0
    ratio = avg_expense / (avg_income + 1)
    trend = _salary_trend(incomes)
    factor = 1.0
    if ratio > 0.9:   factor = 1.05
    elif ratio < 0.6: factor = 0.97
    if trend == "increasing":  factor *= 1.02
    elif trend == "decreasing":factor *= 0.97
    return factor


# ─────────────────────────────────────────────
# USER SEGMENTATION
# ─────────────────────────────────────────────
def _classify_user(expenses, incomes):
    avg_income  = np.mean(incomes)  if incomes  else 0
    avg_expense = np.mean(expenses) if expenses else 0
    if avg_income == 0:
        return "unknown", 1.0
    ratio = avg_expense / (avg_income + 1)
    if ratio < 0.6:   return "saver",    0.95
    elif ratio > 0.9: return "spender",  1.08
    else:             return "balanced", 1.0


# ─────────────────────────────────────────────
# LEARNED FESTIVAL MULTIPLIERS
# ─────────────────────────────────────────────
_DEFAULT_FESTIVAL = {10: 1.15, 11: 1.20, 12: 1.12, 1: 1.08, 8: 1.05}

def _learn_festival(summaries):
    if len(summaries) < 3:
        return _DEFAULT_FESTIVAL
    monthly_vals = {}
    for s in summaries:
        try:
            m = int(str(s.get("month", "2024-01"))[:7].split("-")[1])
        except Exception:
            continue
        monthly_vals.setdefault(m, []).append(float(s.get("total_expense", 0)))
    overall_avg = np.mean([float(s.get("total_expense", 0)) for s in summaries]) + 1
    festival_map = {}
    for month, vals in monthly_vals.items():
        ratio = np.mean(vals) / overall_avg
        if ratio > 1.04:
            festival_map[month] = round(min(ratio, 1.40), 3)
    merged = dict(_DEFAULT_FESTIVAL)
    merged.update(festival_map)
    return merged


# ─────────────────────────────────────────────
# LEARNED CATEGORY MULTIPLIERS
# ─────────────────────────────────────────────
def _learn_category(summaries):
    category_vals = {}
    for s in summaries:
        cat = s.get("top_spending_category", "Miscellaneous")
        category_vals.setdefault(cat, []).append(float(s.get("total_expense", 0)))
    overall_avg = np.mean([float(s.get("total_expense", 0)) for s in summaries]) + 1
    category_map = {}
    for cat, vals in category_vals.items():
        ratio = np.mean(vals) / overall_avg
        category_map[cat] = round(min(max(ratio, 0.90), 1.20), 3)
    return category_map


# ─────────────────────────────────────────────
# RECURRING DETECTION
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# RECURRING DETECTION
# ─────────────────────────────────────────────
def _detect_recurring(transactions):
    groups = {}

    for t in transactions:
        # 🚨 THE MAGIC FIX: Ignore Income transactions! 
        # Otherwise, it counts your ₹85,000 Salary as a monthly expense!
        if str(t.get("type", "expense")).lower() == "income":
            continue

        key = (
            str(t.get("merchant_name", "")).lower(),
            round(float(t.get("amount", 0)), 0),
        )
        groups.setdefault(key, []).append(t)

    recurring = []
    for (merchant, amount), txns in groups.items():
        if len(txns) < 3:
            continue
        txns_sorted = sorted(txns, key=lambda x: str(x.get("date", "")))
        intervals   = []
        for i in range(1, len(txns_sorted)):
            d1 = _parse_date(txns_sorted[i-1].get("date", ""))
            d2 = _parse_date(txns_sorted[i].get("date", ""))
            intervals.append(abs((d2 - d1).days))
        avg = np.mean(intervals) if intervals else 0
        if 25 <= avg <= 35:   freq = "monthly"
        elif 6 <= avg <= 10:  freq = "weekly"
        elif 1 <= avg <= 2:   freq = "daily"
        else:                  continue
        recurring.append({"merchant": merchant, "amount": amount, "frequency": freq})
    return recurring

def _subscription_total(transactions):
    if not transactions:
        return 0.0
    recurring = _detect_recurring(transactions)
    total = 0.0
    for r in recurring:
        amt = r["amount"]
        if r["frequency"] == "daily":    total += amt * 30
        elif r["frequency"] == "weekly": total += amt * 4
        elif r["frequency"] == "monthly":total += amt
    return float(total)


# ─────────────────────────────────────────────
# PROPHET MODEL
# ─────────────────────────────────────────────
def _prepare_df(data):
    rows = []
    for d in data:
        month_str = str(d.get("month", ""))[:7]
        try:
            ds = datetime.strptime(month_str, "%Y-%m")
        except Exception:
            continue
        rows.append({"ds": ds, "y": float(d.get("total_expense", 0))})
    return pd.DataFrame(rows)

def _prophet_predict(data):
    if not PROPHET_AVAILABLE:
        return _trend_predict([float(d.get("total_expense", 0)) for d in data])
    combined = GLOBAL_DATASET + list(data) * 2
    df = _prepare_df(combined)
    if len(df) < 2:
        expenses = [float(d.get("total_expense", 0)) for d in data]
        return expenses[-1] if expenses else 0
    model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    model.fit(df)
    try:
        future   = model.make_future_dataframe(periods=1, freq="ME")
    except Exception:
        future   = model.make_future_dataframe(periods=1, freq="M")
    forecast = model.predict(future)
    return float(forecast.iloc[-1]["yhat"])


# ─────────────────────────────────────────────
# TREND MODEL
# ─────────────────────────────────────────────
def _trend_predict(expenses):
    if len(expenses) < 2:
        return float(expenses[-1]) if expenses else 0.0
    weights = np.linspace(0.5, 1.0, len(expenses))
    avg     = float(np.average(expenses, weights=weights))
    growth  = (expenses[-1] - expenses[0]) / (len(expenses) * (expenses[0] + 1))
    return max(avg * (1 + growth * 0.5), 0.0)


# ─────────────────────────────────────────────
# XGBOOST MODEL (NEW)
# ─────────────────────────────────────────────
def _build_xgb_features(summaries):
    """Build feature matrix for XGBoost from monthly summaries."""
    expenses = [float(s.get("total_expense", 0)) for s in summaries]
    incomes  = [float(s.get("total_income",  0)) for s in summaries]
    X, y = [], []
    for i in range(2, len(expenses)):
        last1      = expenses[i - 1]
        last2      = expenses[i - 2]
        income     = incomes[i]
        growth     = (last1 - last2) / (last2 + 1)
        ratio      = last1 / (income + 1)
        volatility = np.std(expenses[max(0, i - 3):i])
        rolling3   = np.mean(expenses[max(0, i - 3):i])
        X.append([last1, last2, growth, ratio, volatility, rolling3, income])
        y.append(expenses[i])
    return np.array(X), np.array(y)

def _xgboost_predict(summaries):
    """Train XGBoost on historical data and predict next month."""
    if not XGBOOST_AVAILABLE or len(summaries) < 4:
        return None
    try:
        X, y = _build_xgb_features(summaries)
        if len(X) < 2:
            return None
        model = XGBRegressor(
            n_estimators=100, max_depth=3,
            learning_rate=0.1, subsample=0.8,
            verbosity=0,   # suppress XGBoost logs
        )
        model.fit(X, y)
        expenses   = [float(s.get("total_expense", 0)) for s in summaries]
        incomes    = [float(s.get("total_income",  0)) for s in summaries]
        last1      = expenses[-1]
        last2      = expenses[-2]
        income     = incomes[-1]
        growth     = (last1 - last2) / (last2 + 1)
        ratio      = last1 / (income + 1)
        volatility = np.std(expenses[-3:])
        rolling3   = np.mean(expenses[-3:])
        pred = model.predict([[last1, last2, growth, ratio, volatility, rolling3, income]])
        result = float(pred[0])
        return result if result > 0 else None
    except Exception:
        return None


# ─────────────────────────────────────────────
# PREDICTION CONFIDENCE RANGE (NEW)
# ─────────────────────────────────────────────
def _prediction_interval(pred, expenses):
    """Calculate min/max confidence range based on historical volatility."""
    if not expenses:
        return round(pred * 0.85, 2), round(pred * 1.15, 2)
    volatility  = np.std(expenses)
    avg         = np.mean(expenses)
    uncertainty = volatility / (avg + 1)
    # Clamp uncertainty to ±30%
    uncertainty = min(uncertainty, 0.30)
    lower = round(pred * (1 - uncertainty), 2)
    upper = round(pred * (1 + uncertainty), 2)
    return lower, upper


# ─────────────────────────────────────────────
# CATEGORY-WISE PREDICTION
# ─────────────────────────────────────────────
def _category_prophet(history):
    if not PROPHET_AVAILABLE or len(history) < 2:
        return float(history[-1]) if history else 0.0
    base  = datetime(2023, 1, 1)
    dates = [
        pd.Timestamp(base.year + (base.month - 1 + i) // 12,
                     (base.month - 1 + i) % 12 + 1, 1)
        for i in range(len(history))
    ]
    df    = pd.DataFrame({"ds": dates, "y": [float(v) for v in history]})
    model = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
    model.fit(df)
    try:
        future = model.make_future_dataframe(periods=1, freq="ME")
    except Exception:
        future = model.make_future_dataframe(periods=1, freq="M")
    forecast = model.predict(future)
    return float(forecast.iloc[-1]["yhat"])

def _category_trend(history):
    if not history:
        return 0.0
    if len(history) < 2:
        return float(history[-1])
    weights = np.linspace(0.5, 1.0, len(history))
    avg     = float(np.average([float(v) for v in history], weights=weights))
    growth  = (history[-1] - history[0]) / (len(history) * (history[0] + 1))
    return max(avg * (1 + growth * 0.5), 0.0)

def _predict_category_value(history):
    try:
        p = _category_prophet(history)
    except Exception:
        p = float(history[-1]) if history else 0.0
    t = _category_trend(history)
    return max(0.6 * p + 0.4 * t, 0.0)

def predict_category_breakdown(category_histories):
    breakdown = {}
    total     = 0.0
    for category, history in (category_histories or {}).items():
        pred                = _predict_category_value([float(v) for v in history])
        breakdown[category] = round(pred, 2)
        total              += pred
    return {
        "category_predictions":  breakdown,
        "total_from_categories": round(total, 2),
    }


# ─────────────────────────────────────────────
# BACKTEST & CONFIDENCE
# ─────────────────────────────────────────────
def _backtest_error(data):
    if len(data) < 4:
        return None
    train  = data[:-1]
    actual = float(data[-1].get("total_expense", 0))
    pred   = _trend_predict([float(s.get("total_expense", 0)) for s in train])
    return round(abs(pred - actual) / (actual + 1), 4)

def _confidence_score(p, t, xgb, expenses, error):
    """0.0–1.0 confidence — now uses 3-model agreement."""
    preds = [v for v in [p, t, xgb] if v is not None]
    if len(preds) < 2:
        model_score = 0.5
    else:
        spread      = max(preds) - min(preds)
        avg_pred    = np.mean(preds)
        model_score = max(0.0, 1.0 - spread / (avg_pred + 1))

    volatility = np.std(expenses) / (np.mean(expenses) + 1) if expenses else 0
    stability  = max(0.0, 1.0 - volatility)
    # Clamp error to [0, 1] before subtracting
    error_clamped = min(max(error, 0.0), 1.0) if error is not None else 0.5
    error_score   = 1.0 - error_clamped

    # Final score clamped to [0.0, 1.0]
    raw = 0.4 * model_score + 0.3 * stability + 0.3 * error_score
    return round(min(max(raw, 0.0), 1.0), 3)

def _confidence_label(score, n_months):
    if score >= 0.75 and n_months >= 6: return "high"
    elif score >= 0.5  or n_months >= 3: return "medium"
    return "low"


# ─────────────────────────────────────────────
# BEHAVIORAL INTELLIGENCE
# ─────────────────────────────────────────────
def _detect_lifestyle_change(expenses):
    if len(expenses) < 6:
        return 1.0, "stable"
    old_avg    = np.mean(expenses[:-3])
    recent_avg = np.mean(expenses[-3:])
    ratio      = recent_avg / (old_avg + 1)
    if ratio > 1.25:   return 1.15, "increasing_lifestyle"
    elif ratio < 0.80: return 0.90, "decreasing_lifestyle"
    return 1.0, "stable"

def _detect_spending_habits(transactions):
    if not transactions or len(transactions) < 10:
        return 1.0, "no_pattern"
    weekend = 0.0
    weekday = 0.0
    for txn in transactions:
        try:
            date = _parse_date(txn.get("date", ""))
            amt  = float(txn.get("amount", 0))
            if date.weekday() >= 5: weekend += amt
            else:                   weekday += amt
        except Exception:
            continue
    if weekday == 0:
        return 1.0, "no_pattern"
    ratio = weekend / (weekday + 1)
    if ratio > 1.5: return 1.08, "weekend_spender"
    return 1.0, "balanced"


# ─────────────────────────────────────────────
# NEXT MONTH HELPER
# ─────────────────────────────────────────────
def _next_month_str(summaries):
    try:
        last = str(summaries[-1].get("month", ""))[:7]
        dt   = datetime.strptime(last, "%Y-%m")
        if dt.month == 12:
            nxt = dt.replace(year=dt.year + 1, month=1)
        else:
            nxt = dt.replace(month=dt.month + 1)
        return nxt.strftime("%Y-%m"), nxt.month
    except Exception:
        now = datetime.now()
        nxt = now.month % 12 + 1
        return f"{now.year}-{str(nxt).zfill(2)}", nxt


# ─────────────────────────────────────────────
# MONGODB SANITIZER
# ─────────────────────────────────────────────
def _clean(docs):
    cleaned = []
    for d in (docs or []):
        if not isinstance(d, dict):
            try:    d = dict(d)
            except: continue
        row = {}
        for k, v in d.items():
            if str(k).startswith("_"):
                continue
            if hasattr(v, "isoformat"):
                row[k] = v.strftime("%Y-%m") if k == "month" else v.isoformat()
            elif hasattr(v, "item"):
                row[k] = v.item()
            else:
                row[k] = v
        cleaned.append(row)
    return cleaned


# ─────────────────────────────────────────────
# MAIN PREDICTION FUNCTION
# ─────────────────────────────────────────────
def predict_next_month_expense(
    monthly_summaries,
    financial_profile=None,
    upcoming_events=None,
    recent_transactions=None,
    category_histories=None,
    inflation_rate=0.06,
):
    financial_profile   = financial_profile   or {}
    upcoming_events     = upcoming_events     or []
    recent_transactions = recent_transactions or []

    # ── Sanitize MongoDB docs ────────────────────────────────
    monthly_summaries   = _clean(monthly_summaries)
    recent_transactions = _clean(recent_transactions)

    # ── Zero-data fallback ───────────────────────────────────
    if not monthly_summaries:
        income    = float(financial_profile.get("monthly_income", 0))
        estimated = round(income * 0.70, 2) if income else 0.0
        now       = datetime.now()
        nxt       = now.month % 12 + 1
        return {
            "predicted_amount":    estimated,
            "base_prediction":     estimated,
            "adjusted_amount":     estimated,
            "fixed_expense":       0,
            "prediction_range":    {"min": round(estimated*0.85,2), "max": round(estimated*1.15,2)},
            "historical_average":  0,
            "last_month_expense":  0,
            "confidence_score":    0.0,
            "confidence":          "low",
            "backtest_error":      None,
            "user_segment":        "unknown",
            "adjustments":         {},
            "explanation":         ["No transaction history. Estimated from stated monthly income (70%)."],
            "category_breakdown":  None,
            "months_analyzed":     0,
            "next_month":          f"{now.year}-{str(nxt).zfill(2)}",
        }

    # ── Sort & extract series ────────────────────────────────
    summaries = sorted(monthly_summaries, key=lambda x: str(x.get("month", ""))[:7])
    expenses  = [float(s.get("total_expense", 0)) for s in summaries]
    incomes   = [float(s.get("total_income",  0)) for s in summaries]
    n         = len(expenses)

    next_month_str, next_month_num = _next_month_str(summaries)

    # ── 3-Model Ensemble ─────────────────────────────────────
    try:
        p = _prophet_predict(summaries)
    except Exception:
        p = expenses[-1]

    t   = _trend_predict(expenses)
    xgb = _xgboost_predict(summaries)   # None if < 4 months

    # Weighted blend based on available models
    if xgb is not None:
        # All 3 models: Prophet 50%, Trend 30%, XGBoost 20%
        base = 0.50 * p + 0.30 * t + 0.20 * xgb
    elif n >= 6:
        # Prophet + Trend for longer history
        base = 0.70 * p + 0.30 * t
    else:
        # Short history: equal blend
        base = 0.50 * p + 0.50 * t
    base = max(base, 0.0)

    # ── Backtest ─────────────────────────────────────────────
    error = _backtest_error(summaries)

    # ── Learned multipliers ──────────────────────────────────
    festival_map = _learn_festival(summaries)
    category_map = _learn_category(summaries)
    top_cat      = summaries[-1].get("top_spending_category", "Miscellaneous")

    # ── Apply all multipliers ────────────────────────────────
    adjustments = {}
    explanation = []
    multiplier  = 1.0

    # 1. Inflation
    infl = _dynamic_inflation_multiplier(top_cat)
    adjustments["inflation"] = round(infl, 4)
    multiplier *= infl
    explanation.append(f"Inflation ({top_cat}): +{round((infl-1)*100,2)}%/month")

    # 2. Festival / seasonal
    fest = festival_map.get(next_month_num, 1.0)
    if fest != 1.0:
        adjustments["festival"] = round(fest, 4)
        multiplier *= fest
        explanation.append(f"Seasonal boost for month {next_month_num}: ×{fest}")

    # 3. Category behaviour
    cat_f = category_map.get(top_cat, 1.0)
    if cat_f != 1.0:
        adjustments["category_behaviour"] = round(cat_f, 4)
        multiplier *= cat_f
        explanation.append(f"Category pattern ({top_cat}): ×{cat_f}")

    # 4. Salary intelligence
    sal_f = _salary_multiplier(incomes, expenses)
    adjustments["salary_trend"] = round(sal_f, 4)
    multiplier *= sal_f
    explanation.append(f"Salary/expense ratio factor: ×{round(sal_f,3)}")

    # 5. User segment
    user_type, user_f = _classify_user(expenses, incomes)
    adjustments["user_segment"] = round(user_f, 4)
    multiplier *= user_f
    explanation.append(f"User segment ({user_type}): ×{user_f}")

    # 6. Lifestyle drift
    life_f, life_label = _detect_lifestyle_change(expenses)
    if life_f != 1.0:
        adjustments["lifestyle"] = round(life_f, 4)
        multiplier *= life_f
        explanation.append(f"Lifestyle change ({life_label}): ×{life_f}")

    # 7. Spending habits
    habit_f, habit_label = _detect_spending_habits(recent_transactions)
    if habit_f != 1.0:
        adjustments["spending_habit"] = round(habit_f, 4)
        multiplier *= habit_f
        explanation.append(f"Spending habit ({habit_label}): ×{habit_f}")

    # 8. NLP events
    event_boost = 1.0
    for event_text in upcoming_events:
        etype  = event_classifier.predict(str(event_text))
        e_mult = EVENT_MULTIPLIERS.get(etype, 1.0)
        event_boost *= e_mult
        if e_mult != 1.0:
            explanation.append(f"Upcoming event '{event_text}' ({etype}): ×{e_mult}")
    if event_boost != 1.0:
        adjustments["events"] = round(event_boost, 4)
        multiplier *= event_boost

    adjusted = base * multiplier

    # 9. Fixed recurring (added on top)
    fixed_expense = _subscription_total(recent_transactions)
    final         = adjusted + fixed_expense

    # Clamp
    if expenses:
        hist_max = max(expenses)
        hist_avg = np.mean(expenses)
        final    = max(final, hist_avg * 0.4)
        final    = min(final, hist_max * 3.5)

    # ── Confidence ───────────────────────────────────────────
    conf_score = _confidence_score(p, t, xgb, expenses, error)
    conf_label = _confidence_label(conf_score, n)

    # ── Prediction Range (NEW) ───────────────────────────────
    lower, upper = _prediction_interval(final, expenses)

    # ── Category breakdown ───────────────────────────────────
    cat_result = predict_category_breakdown(category_histories) if category_histories else None

    # ── Which models were used ───────────────────────────────
    models_used = ["Prophet", "Trend"]
    if xgb is not None:
        models_used.append("XGBoost")

    return {
        "predicted_amount":    round(final,    2),
        "base_prediction":     round(base,     2),
        "adjusted_amount":     round(adjusted, 2),
        "fixed_expense":       round(fixed_expense, 2),
        "prediction_range":    {"min": lower, "max": upper},
        "historical_average":  round(float(np.mean(expenses)), 2) if expenses else 0,
        "last_month_expense":  expenses[-1] if expenses else 0,
        "confidence_score":    conf_score,
        "confidence":          conf_label,
        "backtest_error":      round(error, 4) if error is not None else None,
        "user_segment":        user_type,
        "adjustments":         adjustments,
        "explanation":         explanation,
        "models_used":         models_used,
        "category_breakdown":  cat_result,
        "months_analyzed":     n,
        "next_month":          next_month_str,
    }


# # ```python
# # """
# # =============================================================
# #   AI EXPENSE PREDICTOR (ULTIMATE FINAL - COMPLETE AI SYSTEM)
# # =============================================================
# # ✔ Ensemble (Prophet + Trend)
# # ✔ NLP Event Detection
# # ✔ Dynamic Inflation
# # ✔ Salary Intelligence
# # ✔ User Segmentation
# # ✔ Learned Multipliers
# # ✔ Auto Recurring Detection
# # ✔ Confidence + Backtesting
# # ✔ Lifestyle Detection
# # ✔ Habit Detection
# # ✔ Category-wise ML Prediction (NEW)
# # =============================================================
# # """

# # import numpy as np
# # import pandas as pd
# # from datetime import datetime
# # from prophet import Prophet

# # from sklearn.feature_extraction.text import TfidfVectorizer
# # from sklearn.linear_model import LogisticRegression
# # from sklearn.pipeline import Pipeline


# # # ─────────────────────────────────────────────
# # # GLOBAL DATA
# # # ─────────────────────────────────────────────
# # GLOBAL_DATASET = [
# #     {"month": "2024-01", "total_expense": 25000},
# #     {"month": "2024-02", "total_expense": 27000},
# #     {"month": "2024-03", "total_expense": 26000},
# #     {"month": "2024-04", "total_expense": 30000},
# #     {"month": "2024-05", "total_expense": 28000},
# #     {"month": "2024-06", "total_expense": 32000},
# # ]


# # # ─────────────────────────────────────────────
# # # EVENT NLP MODEL
# # # ─────────────────────────────────────────────
# # EVENT_SAMPLES = [
# #     ("trip to goa", "travel"),
# #     ("family vacation", "travel"),
# #     ("flight booking", "travel"),
# #     ("friend wedding", "wedding"),
# #     ("doctor visit", "medical"),
# #     ("birthday party", "birthday"),
# #     ("exam preparation", "exam"),
# # ]

# # EVENT_MULTIPLIERS = {
# #     "travel": 1.15,
# #     "wedding": 1.30,
# #     "medical": 1.12,
# #     "birthday": 1.08,
# #     "exam": 1.05,
# #     "other": 1.0
# # }

# # class EventClassifier:
# #     def __init__(self):
# #         self.pipeline = Pipeline([
# #             ("tfidf", TfidfVectorizer()),
# #             ("clf", LogisticRegression())
# #         ])
# #         self._train()

# #     def _train(self):
# #         X = [t for t, _ in EVENT_SAMPLES]
# #         y = [l for _, l in EVENT_SAMPLES]
# #         self.pipeline.fit(X, y)

# #     def predict(self, text):
# #         try:
# #             return self.pipeline.predict([text])[0]
# #         except:
# #             return "other"

# # event_classifier = EventClassifier()


# # # ─────────────────────────────────────────────
# # # INFLATION
# # # ─────────────────────────────────────────────
# # CATEGORY_INFLATION = {
# #     "Food": 0.06, "Transport": 0.07, "Shopping": 0.05,
# #     "Travel": 0.09, "Health": 0.08, "Education": 0.10,
# #     "Rent": 0.06, "Bills": 0.05, "Miscellaneous": 0.06
# # }

# # def _dynamic_inflation_multiplier(category):
# #     return 1 + CATEGORY_INFLATION.get(category, 0.06) / 12


# # # ─────────────────────────────────────────────
# # # SALARY INTELLIGENCE
# # # ─────────────────────────────────────────────
# # def _salary_trend(incomes):
# #     if len(incomes) < 3:
# #         return "stable"
# #     if all(incomes[i] < incomes[i+1] for i in range(len(incomes)-1)):
# #         return "increasing"
# #     if all(incomes[i] > incomes[i+1] for i in range(len(incomes)-1)):
# #         return "decreasing"
# #     return "stable"

# # def _salary_multiplier(incomes, expenses):
# #     avg_income = np.mean(incomes)
# #     avg_expense = np.mean(expenses)

# #     ratio = avg_expense / (avg_income + 1)
# #     trend = _salary_trend(incomes)

# #     factor = 1.0
# #     if ratio > 0.9:
# #         factor = 1.05
# #     elif ratio < 0.6:
# #         factor = 0.97

# #     if trend == "increasing":
# #         factor *= 1.02
# #     elif trend == "decreasing":
# #         factor *= 0.97

# #     return factor


# # # ─────────────────────────────────────────────
# # # USER SEGMENTATION
# # # ─────────────────────────────────────────────
# # def _classify_user(expenses, incomes):
# #     avg_income = np.mean(incomes)
# #     avg_expense = np.mean(expenses)

# #     if avg_income == 0:
# #         return "unknown", 1.0

# #     ratio = avg_expense / (avg_income + 1)

# #     if ratio < 0.6:
# #         return "saver", 0.95
# #     elif ratio > 0.9:
# #         return "spender", 1.08
# #     else:
# #         return "balanced", 1.0


# # # ─────────────────────────────────────────────
# # # RECURRING DETECTION
# # # ─────────────────────────────────────────────
# # def _detect_recurring(transactions):
# #     groups = {}

# #     for t in transactions:
# #         key = (t.get("merchant_name","").lower(), round(float(t.get("amount",0)),0))
# #         groups.setdefault(key, []).append(t)

# #     recurring = []

# #     for (merchant, amount), txns in groups.items():
# #         if len(txns) < 3:
# #             continue

# #         txns = sorted(txns, key=lambda x: x.get("date"))
# #         intervals = []

# #         for i in range(1, len(txns)):
# #             d1 = datetime.fromisoformat(txns[i-1]["date"])
# #             d2 = datetime.fromisoformat(txns[i]["date"])
# #             intervals.append((d2-d1).days)

# #         avg = np.mean(intervals)

# #         if 25 <= avg <= 35:
# #             freq = "monthly"
# #         elif 6 <= avg <= 10:
# #             freq = "weekly"
# #         elif 1 <= avg <= 2:
# #             freq = "daily"
# #         else:
# #             continue

# #         recurring.append({"merchant":merchant,"amount":amount,"frequency":freq})

# #     return recurring


# # def _subscription_total(transactions):
# #     recurring = _detect_recurring(transactions)
# #     total = 0

# #     for r in recurring:
# #         amt = r["amount"]
# #         if r["frequency"] == "daily":
# #             total += amt * 30
# #         elif r["frequency"] == "weekly":
# #             total += amt * 4
# #         elif r["frequency"] == "monthly":
# #             total += amt

# #     return total


# # # ─────────────────────────────────────────────
# # # MODELS
# # # ─────────────────────────────────────────────
# # def _prepare_df(data):
# #     return pd.DataFrame([
# #         {"ds": datetime.strptime(d["month"], "%Y-%m"), "y": float(d["total_expense"])}
# #         for d in data
# #     ])

# # def _prophet(data):
# #     df = _prepare_df(GLOBAL_DATASET + data*2)
# #     model = Prophet(yearly_seasonality=True)
# #     model.fit(df)
# #     future = model.make_future_dataframe(periods=1, freq="M")
# #     return float(model.predict(future).iloc[-1]["yhat"])


# # def _trend(expenses):
# #     if len(expenses) < 2:
# #         return expenses[-1]

# #     weights = np.linspace(0.5,1.0,len(expenses))
# #     avg = np.average(expenses,weights=weights)

# #     growth = (expenses[-1]-expenses[0])/(len(expenses)*(expenses[0]+1))
# #     return avg*(1+growth*0.5)


# # # ─────────────────────────────────────────────
# # # CATEGORY-WISE MODELS (NEW)
# # # ─────────────────────────────────────────────
# # def _category_prophet(history):
# #     if len(history) < 2:
# #         return history[-1] if history else 0

# #     df = pd.DataFrame({
# #         "ds": [datetime(2024, i+1, 1) for i in range(len(history))],
# #         "y": history
# #     })

# #     model = Prophet()
# #     model.fit(df)

# #     future = model.make_future_dataframe(periods=1, freq="M")
# #     forecast = model.predict(future)

# #     return float(forecast.iloc[-1]["yhat"])


# # def _category_trend(history):
# #     if len(history) < 2:
# #         return history[-1] if history else 0

# #     weights = np.linspace(0.5, 1.0, len(history))
# #     avg = np.average(history, weights=weights)

# #     growth = (history[-1] - history[0]) / (len(history) * (history[0] + 1))
# #     return max(avg * (1 + growth * 0.5), 0)


# # def _predict_category_value(history):
# #     try:
# #         p = _category_prophet(history)
# #     except:
# #         p = history[-1]

# #     t = _category_trend(history)

# #     return 0.6 * p + 0.4 * t


# # def predict_category_breakdown(category_histories):
# #     breakdown = {}
# #     total = 0

# #     for category, history in category_histories.items():
# #         pred = _predict_category_value(history)
# #         breakdown[category] = round(pred, 2)
# #         total += pred

# #     return {
# #         "category_predictions": breakdown,
# #         "total_from_categories": round(total, 2)
# #     }


# # # ─────────────────────────────────────────────
# # # CONFIDENCE + BACKTEST
# # # ─────────────────────────────────────────────
# # def _backtest_error(data):
# #     if len(data) < 4:
# #         return None

# #     train = data[:-1]
# #     actual = float(data[-1]["total_expense"])

# #     expenses = [float(s["total_expense"]) for s in train]
# #     pred = _trend(expenses)

# #     return abs(pred-actual)/(actual+1)


# # def _confidence(p, t, expenses, error):
# #     diff = abs(p-t)/(np.mean(expenses)+1)
# #     model_score = max(0,1-diff)

# #     volatility = np.std(expenses)/(np.mean(expenses)+1)
# #     stability = max(0,1-volatility)

# #     error_score = 1-error if error else 0.5

# #     return round(0.4*model_score + 0.3*stability + 0.3*error_score,3)


# # # ─────────────────────────────────────────────
# # # BEHAVIORAL INTELLIGENCE
# # # ─────────────────────────────────────────────
# # def _detect_lifestyle_change(expenses):
# #     if len(expenses) < 6:
# #         return 1.0, "stable"

# #     old_avg = np.mean(expenses[:-3])
# #     recent_avg = np.mean(expenses[-3:])

# #     ratio = recent_avg / (old_avg + 1)

# #     if ratio > 1.25:
# #         return 1.15, "increasing_lifestyle"
# #     elif ratio < 0.80:
# #         return 0.90, "decreasing_lifestyle"
# #     else:
# #         return 1.0, "stable"


# # def _detect_spending_habits(transactions):
# #     if not transactions or len(transactions) < 10:
# #         return 1.0, "no_pattern"

# #     weekend = 0
# #     weekday = 0

# #     for txn in transactions:
# #         date = txn.get("date")
# #         if isinstance(date, str):
# #             date = datetime.fromisoformat(date)

# #         amt = float(txn.get("amount", 0))

# #         if date.weekday() >= 5:
# #             weekend += amt
# #         else:
# #             weekday += amt

# #     if weekday == 0:
# #         return 1.0, "no_pattern"

# #     ratio = weekend / (weekday + 1)

# #     if ratio > 1.5:
# #         return 1.08, "weekend_spender"
# #     else:
# #         return 1.0, "balanced"


# # # ─────────────────────────────────────────────
# # # MAIN FUNCTION
# # # ─────────────────────────────────────────────
# # def predict_next_month_expense(
# #     monthly_summaries,
# #     financial_profile=None,
# #     upcoming_events=None,
# #     recent_transactions=None,
# #     category_histories=None
# # ):

# #     summaries = sorted(monthly_summaries, key=lambda x: x["month"])

# #     expenses = [float(s["total_expense"]) for s in summaries]
# #     incomes = [float(s.get("total_income",0)) for s in summaries]

# #     n = len(expenses)

# #     # Models
# #     try:
# #         p = _prophet(summaries)
# #     except:
# #         p = expenses[-1]

# #     t = _trend(expenses)

# #     base = 0.7*p + 0.3*t if n>=6 else 0.5*(p+t)

# #     # Backtest
# #     error = _backtest_error(summaries)

# #     # Multipliers
# #     festival_map = _learn_festival(summaries)
# #     category_map = _learn_category(summaries)

# #     last_month = int(summaries[-1]["month"].split("-")[1])
# #     next_month = 1 if last_month==12 else last_month+1

# #     top_cat = summaries[-1].get("top_spending_category","Miscellaneous")

# #     multiplier = 1.0

# #     multiplier *= _dynamic_inflation_multiplier(top_cat)
# #     multiplier *= festival_map.get(next_month,1.0)
# #     multiplier *= category_map.get(top_cat,1.0)
# #     multiplier *= _salary_multiplier(incomes, expenses)

# #     # User segmentation
# #     user_type, user_factor = _classify_user(expenses, incomes)
# #     multiplier *= user_factor

# #     # Behavioral
# #     life_factor, _ = _detect_lifestyle_change(expenses)
# #     multiplier *= life_factor

# #     habit_factor, _ = _detect_spending_habits(recent_transactions or [])
# #     multiplier *= habit_factor

# #     # NLP events
# #     if upcoming_events:
# #         for e in upcoming_events:
# #             etype = event_classifier.predict(e)
# #             multiplier *= EVENT_MULTIPLIERS.get(etype,1.0)

# #     adjusted = base * multiplier

# #     # Recurring
# #     fixed_monthly = _subscription_total(recent_transactions or [])

# #     final = adjusted + fixed_monthly

# #     # Confidence
# #     conf = _confidence(p, t, expenses, error)

# #     # Category breakdown
# #     category_result = predict_category_breakdown(category_histories) if category_histories else None

# #     return {
# #         "predicted_amount": round(final,2),
# #         "base_prediction": round(base,2),
# #         "fixed_expense": fixed_monthly,
# #         "confidence_score": conf,
# #         "backtest_error": error,
# #         "user_segment": user_type,
# #         "category_breakdown": category_result,
# #         "months_analyzed": n
# #     }
# # ```
# """
# =============================================================
#   AI EXPENSE PREDICTOR (ULTIMATE FINAL - COMPLETE AI SYSTEM)
# =============================================================
# ✔ Ensemble (Prophet + Trend)
# ✔ NLP Event Detection
# ✔ Dynamic Inflation
# ✔ Salary Intelligence
# ✔ User Segmentation
# ✔ Learned Multipliers
# ✔ Auto Recurring Detection
# ✔ Confidence + Backtesting
# ✔ Lifestyle Detection
# ✔ Habit Detection
# ✔ Category-wise ML Prediction
# =============================================================
# """

# import numpy as np
# import pandas as pd
# from datetime import datetime
# from prophet import Prophet

# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.linear_model import LogisticRegression
# from sklearn.pipeline import Pipeline


# # ─────────────────────────────────────────────
# # GLOBAL SEED DATA (bootstraps Prophet when user has < 3 months)
# # ─────────────────────────────────────────────
# GLOBAL_DATASET = [
#     {"month": "2024-01", "total_expense": 25000},
#     {"month": "2024-02", "total_expense": 27000},
#     {"month": "2024-03", "total_expense": 26000},
#     {"month": "2024-04", "total_expense": 30000},
#     {"month": "2024-05", "total_expense": 28000},
#     {"month": "2024-06", "total_expense": 32000},
# ]


# # ─────────────────────────────────────────────
# # DATE PARSE HELPER (handles ISO, "Z" suffix, datetime objects)
# # ─────────────────────────────────────────────
# def _parse_date(d):
#     if isinstance(d, datetime):
#         return d
#     if isinstance(d, str):
#         d = d.replace("Z", "+00:00")
#         try:
#             return datetime.fromisoformat(d)
#         except Exception:
#             pass
#         # Try just YYYY-MM-DD
#         try:
#             return datetime.strptime(d[:10], "%Y-%m-%d")
#         except Exception:
#             pass
#     return datetime.now()


# # ─────────────────────────────────────────────
# # EVENT NLP MODEL
# # ─────────────────────────────────────────────
# EVENT_SAMPLES = [
#     ("trip to goa",       "travel"),
#     ("family vacation",   "travel"),
#     ("flight booking",    "travel"),
#     ("friend wedding",    "wedding"),
#     ("brother wedding",   "wedding"),
#     ("doctor visit",      "medical"),
#     ("hospital admission","medical"),
#     ("birthday party",    "birthday"),
#     ("exam preparation",  "exam"),
#     ("new phone",         "shopping"),
#     ("laptop purchase",   "shopping"),
# ]

# EVENT_MULTIPLIERS = {
#     "travel":   1.15,
#     "wedding":  1.30,
#     "medical":  1.12,
#     "birthday": 1.08,
#     "exam":     1.05,
#     "shopping": 1.10,
#     "other":    1.0,
# }

# class EventClassifier:
#     def __init__(self):
#         self.pipeline = Pipeline([
#             ("tfidf", TfidfVectorizer()),
#             ("clf",   LogisticRegression(max_iter=200)),
#         ])
#         self._train()

#     def _train(self):
#         X = [t for t, _ in EVENT_SAMPLES]
#         y = [l for _, l in EVENT_SAMPLES]
#         self.pipeline.fit(X, y)

#     def predict(self, text):
#         try:
#             return self.pipeline.predict([str(text)])[0]
#         except Exception:
#             return "other"

# event_classifier = EventClassifier()


# # ─────────────────────────────────────────────
# # INFLATION
# # ─────────────────────────────────────────────
# CATEGORY_INFLATION = {
#     "Food":          0.06,
#     "Transport":     0.07,
#     "Shopping":      0.05,
#     "Travel":        0.09,
#     "Health":        0.08,
#     "Education":     0.10,
#     "Rent":          0.06,
#     "Bills":         0.05,
#     "Miscellaneous": 0.06,
#     "Entertainment": 0.05,
#     "Investment":    0.00,   # investments aren't inflationary
# }

# def _dynamic_inflation_multiplier(category):
#     annual = CATEGORY_INFLATION.get(category, 0.06)
#     return 1 + annual / 12


# # ─────────────────────────────────────────────
# # SALARY INTELLIGENCE
# # ─────────────────────────────────────────────
# def _salary_trend(incomes):
#     if len(incomes) < 3:
#         return "stable"
#     if all(incomes[i] < incomes[i + 1] for i in range(len(incomes) - 1)):
#         return "increasing"
#     if all(incomes[i] > incomes[i + 1] for i in range(len(incomes) - 1)):
#         return "decreasing"
#     return "stable"

# def _salary_multiplier(incomes, expenses):
#     avg_income  = np.mean(incomes)  if incomes  else 0
#     avg_expense = np.mean(expenses) if expenses else 0

#     if avg_income == 0:
#         return 1.0

#     ratio = avg_expense / (avg_income + 1)
#     trend = _salary_trend(incomes)

#     factor = 1.0
#     if ratio > 0.9:
#         factor = 1.05
#     elif ratio < 0.6:
#         factor = 0.97

#     if trend == "increasing":
#         factor *= 1.02
#     elif trend == "decreasing":
#         factor *= 0.97

#     return factor


# # ─────────────────────────────────────────────
# # USER SEGMENTATION
# # ─────────────────────────────────────────────
# def _classify_user(expenses, incomes):
#     avg_income  = np.mean(incomes)  if incomes  else 0
#     avg_expense = np.mean(expenses) if expenses else 0

#     if avg_income == 0:
#         return "unknown", 1.0

#     ratio = avg_expense / (avg_income + 1)

#     if ratio < 0.6:
#         return "saver",    0.95
#     elif ratio > 0.9:
#         return "spender",  1.08
#     else:
#         return "balanced", 1.0


# # ─────────────────────────────────────────────
# # LEARNED FESTIVAL MULTIPLIERS  ← was missing, now defined
# # ─────────────────────────────────────────────
# # Default India festival boost by month number
# _DEFAULT_FESTIVAL = {10: 1.15, 11: 1.20, 12: 1.12, 1: 1.08, 8: 1.05}

# def _learn_festival(summaries):
#     """
#     Learn festival/seasonal multipliers from the user's own spending history.
#     Falls back to India defaults for months with no data.
#     """
#     if len(summaries) < 3:
#         return _DEFAULT_FESTIVAL

#     # Group spending by month-of-year
#     monthly_vals = {}
#     for s in summaries:
#         try:
#             m = int(str(s.get("month", "2024-01"))[:7].split("-")[1])
#         except Exception:
#             continue
#         monthly_vals.setdefault(m, []).append(float(s.get("total_expense", 0)))

#     overall_avg = np.mean([float(s.get("total_expense", 0)) for s in summaries]) + 1

#     festival_map = {}
#     for month, vals in monthly_vals.items():
#         avg   = np.mean(vals)
#         ratio = avg / overall_avg
#         # Only flag months that are meaningfully above average
#         if ratio > 1.04:
#             festival_map[month] = round(min(ratio, 1.40), 3)

#     # Merge with defaults (user data takes priority)
#     merged = dict(_DEFAULT_FESTIVAL)
#     merged.update(festival_map)
#     return merged


# # ─────────────────────────────────────────────
# # LEARNED CATEGORY MULTIPLIERS  ← was missing, now defined
# # ─────────────────────────────────────────────
# def _learn_category(summaries):
#     """
#     Learn per-category spending multipliers from history.
#     Months where a certain category dominated → higher multiplier.
#     """
#     category_vals = {}
#     for s in summaries:
#         cat = s.get("top_spending_category", "Miscellaneous")
#         category_vals.setdefault(cat, []).append(float(s.get("total_expense", 0)))

#     overall_avg = np.mean([float(s.get("total_expense", 0)) for s in summaries]) + 1

#     category_map = {}
#     for cat, vals in category_vals.items():
#         avg   = np.mean(vals)
#         ratio = avg / overall_avg
#         # Clamp to ±20% range
#         category_map[cat] = round(min(max(ratio, 0.90), 1.20), 3)

#     return category_map


# # ─────────────────────────────────────────────
# # RECURRING DETECTION
# # ─────────────────────────────────────────────
# def _detect_recurring(transactions):
#     groups = {}

#     for t in transactions:
#         key = (
#             str(t.get("merchant_name", "")).lower(),
#             round(float(t.get("amount", 0)), 0),
#         )
#         groups.setdefault(key, []).append(t)

#     recurring = []

#     for (merchant, amount), txns in groups.items():
#         if len(txns) < 3:
#             continue

#         txns_sorted = sorted(txns, key=lambda x: str(x.get("date", "")))
#         intervals   = []

#         for i in range(1, len(txns_sorted)):
#             d1 = _parse_date(txns_sorted[i - 1].get("date", ""))
#             d2 = _parse_date(txns_sorted[i].get("date", ""))
#             intervals.append(abs((d2 - d1).days))

#         avg = np.mean(intervals) if intervals else 0

#         if 25 <= avg <= 35:
#             freq = "monthly"
#         elif 6 <= avg <= 10:
#             freq = "weekly"
#         elif 1 <= avg <= 2:
#             freq = "daily"
#         else:
#             continue

#         recurring.append({"merchant": merchant, "amount": amount, "frequency": freq})

#     return recurring


# def _subscription_total(transactions):
#     if not transactions:
#         return 0.0

#     recurring = _detect_recurring(transactions)
#     total     = 0.0

#     for r in recurring:
#         amt = r["amount"]
#         if r["frequency"] == "daily":
#             total += amt * 30
#         elif r["frequency"] == "weekly":
#             total += amt * 4
#         elif r["frequency"] == "monthly":
#             total += amt

#     return float(total)


# # ─────────────────────────────────────────────
# # PROPHET + TREND MODELS
# # ─────────────────────────────────────────────
# def _prepare_df(data):
#     rows = []
#     for d in data:
#         month_str = str(d.get("month", ""))[:7]
#         try:
#             ds = datetime.strptime(month_str, "%Y-%m")
#         except Exception:
#             continue
#         rows.append({"ds": ds, "y": float(d.get("total_expense", 0))})
#     return pd.DataFrame(rows)


# def _prophet_predict(data):
#     """Run Prophet on combined global seed + user data."""
#     combined = GLOBAL_DATASET + list(data) * 2   # duplicate user data to give it more weight
#     df = _prepare_df(combined)

#     if len(df) < 2:
#         expenses = [float(d.get("total_expense", 0)) for d in data]
#         return expenses[-1] if expenses else 0

#     model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
#     model.fit(df)

#     future   = model.make_future_dataframe(periods=1, freq="ME")
#     forecast = model.predict(future)
#     return float(forecast.iloc[-1]["yhat"])


# def _trend_predict(expenses):
#     """Weighted trend extrapolation."""
#     if len(expenses) < 2:
#         return float(expenses[-1]) if expenses else 0.0

#     weights = np.linspace(0.5, 1.0, len(expenses))
#     avg     = float(np.average(expenses, weights=weights))
#     growth  = (expenses[-1] - expenses[0]) / (len(expenses) * (expenses[0] + 1))
#     return max(avg * (1 + growth * 0.5), 0.0)


# # ─────────────────────────────────────────────
# # CATEGORY-WISE PREDICTION
# # ─────────────────────────────────────────────
# def _category_prophet(history):
#     if len(history) < 2:
#         return float(history[-1]) if history else 0.0

#     df = pd.DataFrame({
#         "ds": [datetime(2024, (i % 12) + 1, 1) for i in range(len(history))],
#         "y":  [float(v) for v in history],
#     })

#     model    = Prophet(yearly_seasonality=False)
#     model.fit(df)

#     future   = model.make_future_dataframe(periods=1, freq="ME")
#     forecast = model.predict(future)
#     return float(forecast.iloc[-1]["yhat"])


# def _category_trend(history):
#     if not history:
#         return 0.0
#     if len(history) < 2:
#         return float(history[-1])

#     weights = np.linspace(0.5, 1.0, len(history))
#     avg     = float(np.average([float(v) for v in history], weights=weights))
#     growth  = (history[-1] - history[0]) / (len(history) * (history[0] + 1))
#     return max(avg * (1 + growth * 0.5), 0.0)


# def _predict_category_value(history):
#     try:
#         p = _category_prophet(history)
#     except Exception:
#         p = float(history[-1]) if history else 0.0

#     t = _category_trend(history)
#     return max(0.6 * p + 0.4 * t, 0.0)


# def predict_category_breakdown(category_histories):
#     """Predict next month's spend per category."""
#     breakdown = {}
#     total     = 0.0

#     for category, history in (category_histories or {}).items():
#         pred             = _predict_category_value([float(v) for v in history])
#         breakdown[category] = round(pred, 2)
#         total           += pred

#     return {
#         "category_predictions":  breakdown,
#         "total_from_categories": round(total, 2),
#     }


# # ─────────────────────────────────────────────
# # CONFIDENCE + BACKTESTING
# # ─────────────────────────────────────────────
# def _backtest_error(data):
#     if len(data) < 4:
#         return None

#     train  = data[:-1]
#     actual = float(data[-1].get("total_expense", 0))

#     expenses = [float(s.get("total_expense", 0)) for s in train]
#     pred     = _trend_predict(expenses)

#     return round(abs(pred - actual) / (actual + 1), 4)


# def _confidence_score(p, t, expenses, error):
#     """Returns 0.0–1.0 confidence score."""
#     diff        = abs(p - t) / (np.mean(expenses) + 1)
#     model_score = max(0.0, 1.0 - diff)

#     volatility = np.std(expenses) / (np.mean(expenses) + 1)
#     stability  = max(0.0, 1.0 - volatility)

#     error_score = (1.0 - error) if error is not None else 0.5

#     return round(0.4 * model_score + 0.3 * stability + 0.3 * error_score, 3)


# def _confidence_label(score):
#     if score >= 0.75:
#         return "high"
#     elif score >= 0.5:
#         return "medium"
#     return "low"


# # ─────────────────────────────────────────────
# # BEHAVIORAL INTELLIGENCE
# # ─────────────────────────────────────────────
# def _detect_lifestyle_change(expenses):
#     if len(expenses) < 6:
#         return 1.0, "stable"

#     old_avg    = np.mean(expenses[:-3])
#     recent_avg = np.mean(expenses[-3:])
#     ratio      = recent_avg / (old_avg + 1)

#     if ratio > 1.25:
#         return 1.15, "increasing_lifestyle"
#     elif ratio < 0.80:
#         return 0.90, "decreasing_lifestyle"
#     return 1.0, "stable"


# def _detect_spending_habits(transactions):
#     if not transactions or len(transactions) < 10:
#         return 1.0, "no_pattern"

#     weekend = 0.0
#     weekday = 0.0

#     for txn in transactions:
#         try:
#             date = _parse_date(txn.get("date", ""))
#             amt  = float(txn.get("amount", 0))

#             if date.weekday() >= 5:
#                 weekend += amt
#             else:
#                 weekday += amt
#         except Exception:
#             continue

#     if weekday == 0:
#         return 1.0, "no_pattern"

#     ratio = weekend / (weekday + 1)
#     if ratio > 1.5:
#         return 1.08, "weekend_spender"
#     return 1.0, "balanced"


# # ─────────────────────────────────────────────
# # DETERMINE NEXT MONTH STRING
# # ─────────────────────────────────────────────
# def _next_month_str(summaries):
#     try:
#         last = str(summaries[-1].get("month", ""))[:7]
#         dt   = datetime.strptime(last, "%Y-%m")
#         if dt.month == 12:
#             nxt = dt.replace(year=dt.year + 1, month=1)
#         else:
#             nxt = dt.replace(month=dt.month + 1)
#         return nxt.strftime("%Y-%m"), nxt.month
#     except Exception:
#         now = datetime.now()
#         nxt = now.month % 12 + 1
#         return f"{now.year}-{str(nxt).zfill(2)}", nxt


# # ─────────────────────────────────────────────
# # MAIN PREDICTION FUNCTION
# # ─────────────────────────────────────────────
# def predict_next_month_expense(
#     monthly_summaries,
#     financial_profile=None,
#     upcoming_events=None,
#     recent_transactions=None,
#     category_histories=None,
#     inflation_rate=0.06,        # kept for API compatibility but now per-category
# ):
#     financial_profile    = financial_profile    or {}
#     upcoming_events      = upcoming_events      or []
#     recent_transactions  = recent_transactions  or []

#     # ── Sanitize incoming docs ───────────────────────────────────
#     def _clean(docs):
#         cleaned = []
#         for d in (docs or []):
#             if not isinstance(d, dict):
#                 try:    d = dict(d)
#                 except: continue
#             row = {}
#             for k, v in d.items():
#                 if str(k).startswith("_"):
#                     continue
#                 if hasattr(v, "isoformat"):
#                     row[k] = v.strftime("%Y-%m") if k == "month" else v.isoformat()
#                 elif hasattr(v, "item"):
#                     row[k] = v.item()
#                 else:
#                     row[k] = v
#             cleaned.append(row)
#         return cleaned

#     monthly_summaries  = _clean(monthly_summaries)
#     recent_transactions = _clean(recent_transactions)

#     # ── Zero-data fallback ───────────────────────────────────────
#     if not monthly_summaries:
#         income    = float(financial_profile.get("monthly_income", 0))
#         estimated = round(income * 0.70, 2) if income else 0.0
#         now       = datetime.now()
#         nxt       = now.month % 12 + 1
#         return {
#             "predicted_amount":  estimated,
#             "base_prediction":   estimated,
#             "fixed_expense":     0,
#             "confidence_score":  0.0,
#             "confidence":        "low",
#             "backtest_error":    None,
#             "user_segment":      "unknown",
#             "category_breakdown": None,
#             "months_analyzed":   0,
#             "next_month":        f"{now.year}-{str(nxt).zfill(2)}",
#             "explanation": ["No transaction history. Estimated from stated monthly income (70%)."],
#             "adjustments": {},
#         }

#     # ── Sort & extract series ────────────────────────────────────
#     summaries = sorted(monthly_summaries, key=lambda x: str(x.get("month", ""))[:7])

#     expenses = [float(s.get("total_expense", 0)) for s in summaries]
#     incomes  = [float(s.get("total_income",  0)) for s in summaries]
#     n        = len(expenses)

#     next_month_str, next_month_num = _next_month_str(summaries)

#     # ── Base prediction (Prophet + Trend ensemble) ───────────────
#     try:
#         p = _prophet_predict(summaries)
#     except Exception:
#         p = expenses[-1]

#     t    = _trend_predict(expenses)
#     base = (0.7 * p + 0.3 * t) if n >= 6 else (0.5 * (p + t))
#     base = max(base, 0.0)

#     # ── Backtest ─────────────────────────────────────────────────
#     error = _backtest_error(summaries)

#     # ── Learned multipliers ──────────────────────────────────────
#     festival_map = _learn_festival(summaries)
#     category_map = _learn_category(summaries)

#     top_cat = summaries[-1].get("top_spending_category", "Miscellaneous")

#     # ── Apply all multipliers ────────────────────────────────────
#     adjustments  = {}
#     explanation  = []
#     multiplier   = 1.0

#     # 1. Dynamic inflation per top category
#     infl = _dynamic_inflation_multiplier(top_cat)
#     adjustments["inflation"] = round(infl, 4)
#     multiplier *= infl
#     explanation.append(
#         f"Inflation ({top_cat}): +{round((infl-1)*100,2)}%/month"
#     )

#     # 2. Festival/seasonal
#     fest = festival_map.get(next_month_num, 1.0)
#     if fest != 1.0:
#         adjustments["festival"] = round(fest, 4)
#         multiplier *= fest
#         explanation.append(f"Seasonal boost for month {next_month_num}: ×{fest}")

#     # 3. Category behaviour
#     cat_f = category_map.get(top_cat, 1.0)
#     if cat_f != 1.0:
#         adjustments["category_behaviour"] = round(cat_f, 4)
#         multiplier *= cat_f
#         explanation.append(f"Category pattern ({top_cat}): ×{cat_f}")

#     # 4. Salary intelligence
#     sal_f = _salary_multiplier(incomes, expenses)
#     adjustments["salary_trend"] = round(sal_f, 4)
#     multiplier *= sal_f
#     explanation.append(f"Salary/expense ratio factor: ×{round(sal_f,3)}")

#     # 5. User segment
#     user_type, user_f = _classify_user(expenses, incomes)
#     adjustments["user_segment"] = round(user_f, 4)
#     multiplier *= user_f
#     explanation.append(f"User segment ({user_type}): ×{user_f}")

#     # 6. Lifestyle drift
#     life_f, life_label = _detect_lifestyle_change(expenses)
#     if life_f != 1.0:
#         adjustments["lifestyle"] = round(life_f, 4)
#         multiplier *= life_f
#         explanation.append(f"Lifestyle change ({life_label}): ×{life_f}")

#     # 7. Spending habits
#     habit_f, habit_label = _detect_spending_habits(recent_transactions)
#     if habit_f != 1.0:
#         adjustments["spending_habit"] = round(habit_f, 4)
#         multiplier *= habit_f
#         explanation.append(f"Spending habit ({habit_label}): ×{habit_f}")

#     # 8. NLP event detection
#     event_total_boost = 1.0
#     for event_text in upcoming_events:
#         etype  = event_classifier.predict(str(event_text))
#         e_mult = EVENT_MULTIPLIERS.get(etype, 1.0)
#         event_total_boost *= e_mult
#         if e_mult != 1.0:
#             explanation.append(f"Upcoming event '{event_text}' ({etype}): ×{e_mult}")
#     if event_total_boost != 1.0:
#         adjustments["events"] = round(event_total_boost, 4)
#         multiplier *= event_total_boost

#     adjusted = base * multiplier

#     # 9. Fixed recurring subscriptions (added on top, not multiplied)
#     fixed_expense = _subscription_total(recent_transactions)
#     final         = adjusted + fixed_expense

#     # Clamp to reasonable range
#     if expenses:
#         hist_max = max(expenses)
#         hist_avg = np.mean(expenses)
#         final    = max(final, hist_avg * 0.4)
#         final    = min(final, hist_max * 3.5)

#     # ── Confidence ───────────────────────────────────────────────
#     conf_score = _confidence_score(p, t, expenses, error)
#     conf_label = _confidence_label(conf_score)

#     # ── Category breakdown ───────────────────────────────────────
#     cat_result = predict_category_breakdown(category_histories) if category_histories else None

#     return {
#         "predicted_amount":   round(final,    2),
#         "base_prediction":    round(base,     2),
#         "adjusted_amount":    round(adjusted, 2),
#         "fixed_expense":      round(fixed_expense, 2),
#         "historical_average": round(float(np.mean(expenses)), 2) if expenses else 0,
#         "last_month_expense": expenses[-1] if expenses else 0,
#         "confidence_score":   conf_score,
#         "confidence":         conf_label,
#         "backtest_error":     round(error, 4) if error is not None else None,
#         "user_segment":       user_type,
#         "adjustments":        adjustments,
#         "explanation":        explanation,
#         "category_breakdown": cat_result,
#         "months_analyzed":    n,
#         "next_month":         next_month_str,
#     }