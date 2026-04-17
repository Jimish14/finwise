"""
=============================================================
  AI EXPENSE TRACKER — FLASK AI SERVICE
=============================================================
  Endpoints:
    POST /api/categorize          → Smart Transaction Categorizer
    POST /api/predict-expense     → AI Expense Predictor
    POST /api/health-guard        → AI Financial Health Guard
    POST /api/goal-plan           → Smart Goal Calculator
    POST /api/retrain-categorizer → Feedback loop for categorizer
    GET  /api/health              → Service health check
=============================================================
"""

from flask import Flask, request, jsonify
from models.transaction_categorizer import categorize_transaction, retrain_with_feedback
from models.expense_predictor       import predict_next_month_expense, predict_category_breakdown
from models.financial_health_guard  import analyze_financial_health
from models.goal_calculator         import calculate_goal_plan
import json
import numpy as np
from datetime import datetime, date

app = Flask(__name__)

# Suppress Flask request logs in production-like mode
import logging as _flask_log
_flask_log.getLogger("werkzeug").setLevel(_flask_log.WARNING)

# ── Custom JSON encoder: handles numpy types, datetime, ObjectId ──
class SafeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):          return int(obj)
        if isinstance(obj, (np.floating,)):         return float(obj)
        if isinstance(obj, (np.bool_,)):            return bool(obj)
        if isinstance(obj, np.ndarray):             return obj.tolist()
        if isinstance(obj, (datetime, date)):       return obj.isoformat()
        # Handle MongoDB ObjectId (bson) if present
        try:
            from bson import ObjectId
            if isinstance(obj, ObjectId): return str(obj)
        except ImportError:
            pass
        return super().default(obj)

app.json_encoder = SafeEncoder

def safe_jsonify(data):
    """Convert data through SafeEncoder then parse back so jsonify works cleanly."""
    clean = json.loads(json.dumps(data, cls=SafeEncoder))
    return jsonify(clean)

# ─────────────────────────────────────────────
#  HELPER
# ─────────────────────────────────────────────

def success(data, status: int = 200):
    return safe_jsonify({"success": True, "data": data}), status

def error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


# ─────────────────────────────────────────────
#  1. SMART TRANSACTION CATEGORIZER
# ─────────────────────────────────────────────
@app.route("/api/categorize", methods=["POST"])
def categorize():
    """
    Predict category for a transaction.

    Request Body:
    {
      "description":   "Swiggy order biryani",
      "merchant_name": "Swiggy",          // optional
      "amount":        450                 // optional
    }

    Response:
    {
      "category": "Food",
      "confidence": 0.94,
      "method": "ml",
      "all_probabilities": { "Food": 0.94, ... }
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    description   = body.get("description", "")
    merchant_name = body.get("merchant_name", "")
    amount        = body.get("amount")

    if not description and not merchant_name:
        return error("At least one of 'description' or 'merchant_name' is required.")

    result = categorize_transaction(description, merchant_name, amount)
    return success(result)


# ─────────────────────────────────────────────
#  CATEGORIZER FEEDBACK / RETRAIN
# ─────────────────────────────────────────────
@app.route("/api/retrain-categorizer", methods=["POST"])
def retrain():
    """
    Submit a corrected category to improve the model.

    Request Body:
    {
      "description":      "some transaction text",
      "merchant_name":    "Merchant",
      "correct_category": "Transport"
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    description      = body.get("description", "")
    merchant_name    = body.get("merchant_name", "")
    correct_category = body.get("correct_category", "")

    if not correct_category:
        return error("'correct_category' is required.")

    result = retrain_with_feedback(description, merchant_name, correct_category)
    return success(result)


# ─────────────────────────────────────────────
#  2. AI EXPENSE PREDICTOR
# ─────────────────────────────────────────────
@app.route("/api/predict-expense", methods=["POST"])
def predict_expense():
    """
    Predict next month's expense.

    Request Body:
    {
      "monthly_summaries": [
        {
          "month": "2025-11",
          "total_expense": 28000,
          "total_income": 45000,
          "top_spending_category": "Food",
          "recurring_expense_total": 2500
        },
        ...
      ],
      "financial_profile": {
        "monthly_income": 45000
      },
      "upcoming_events": ["travel", "birthday"],  // optional
      "recent_transactions": [                     // optional
        { "is_recurring": true, "type": "expense",
          "recurring_frequency": "monthly", "amount": 499 }
      ],
      "inflation_rate": 0.06                       // optional, default 6%
    }

    Response:
    {
      "predicted_amount": 31500,
      "base_prediction": 29000,
      "adjustments": { "inflation": 1.005, ... },
      "subscription_addition": 2500,
      "explanation": ["Inflation adjustment: +0.5%", ...],
      "confidence": "high",
      "next_month": "2026-03"
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    monthly_summaries   = body.get("monthly_summaries",   [])
    financial_profile   = body.get("financial_profile",   {})
    upcoming_events     = body.get("upcoming_events",     [])
    recent_transactions = body.get("recent_transactions", [])
    category_histories  = body.get("category_histories",  None)
    inflation_rate      = float(body.get("inflation_rate", 0.06))

    if not isinstance(monthly_summaries, list):
        return error("monthly_summaries must be a list.")

    result = predict_next_month_expense(
        monthly_summaries   = monthly_summaries,
        financial_profile   = financial_profile,
        upcoming_events     = upcoming_events,
        recent_transactions = recent_transactions,
        category_histories  = category_histories,
        inflation_rate      = inflation_rate,
    )

    if result.get("error"):
        return error(result["error"])

    return success(result)


# ─────────────────────────────────────────────
#  CATEGORY BREAKDOWN PREDICTION
# ─────────────────────────────────────────────
@app.route("/api/predict-expense/breakdown", methods=["POST"])
def predict_expense_breakdown():
    """
    Predict next month's expense per category.

    Request Body:
    {
      "monthly_summaries": [...],
      "category_histories": {
        "Food":      [8000, 9000, 8500, 9200],
        "Transport": [3000, 3100, 3200, 3050]
      }
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    category_histories = body.get("category_histories", {})

    if not category_histories:
        return error("'category_histories' is required. Provide a dict of {category: [monthly_values]}")

    try:
        result = predict_category_breakdown(category_histories)
        return success(result)
    except Exception as e:
        import traceback
        app.logger.error(f"Category breakdown error: {traceback.format_exc()}")
        return error(f"Prediction failed: {str(e)}")


# ─────────────────────────────────────────────
#  3. AI FINANCIAL HEALTH GUARD
# ─────────────────────────────────────────────
@app.route("/api/health-guard", methods=["POST"])
def health_guard():
    """
    Analyze financial health and generate alerts + advice.

    Request Body:
    {
      "monthly_summaries": [
        {
          "month": "2025-11",
          "total_income": 45000,
          "total_expense": 38000,
          "non_essential_expense": 14000,
          "recurring_expense_total": 3000,
          "top_spending_category": "Food"
        },
        ...
      ],
      "financial_profile": {
        "monthly_income": 45000,
        "emergency_fund_balance": 30000,
        "total_savings": 80000,
        "risk_profile": "medium"
      },
      "investments": [                              // optional
        {
          "investment_type": "SIP",
          "amount_invested": 10000,
          "monthly_contribution": 2000,
          "investment_start_date": "2025-01-01"
        }
      ],
      "goals": [                                    // optional
        {
          "goal_name": "Bike",
          "target_amount": 80000,
          "current_amount": 20000
        }
      ],
      "transactions": []                            // optional
    }

    Response:
    {
      "health_score": 72,
      "risk_level": "moderate",
      "vitals": { ... },
      "component_scores": { ... },
      "risk_alerts": [ { "severity": "high", ... } ],
      "advice": [ { "priority": 1, "advice": "...", ... } ],
      "trend": { "trend": "improving", ... },
      "summary": "..."
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    monthly_summaries = body.get("monthly_summaries", [])
    financial_profile = body.get("financial_profile", {})
    investments       = body.get("investments", [])
    goals             = body.get("goals", [])
    transactions      = body.get("transactions", [])

    if not monthly_summaries:
        return error("'monthly_summaries' is required.")
    if not financial_profile:
        return error("'financial_profile' is required.")

    result = analyze_financial_health(
        monthly_summaries = monthly_summaries,
        financial_profile = financial_profile,
        investments       = investments,
        goals             = goals,
        transactions      = transactions
    )

    if result.get("error"):
        return error(result["error"])

    return success(result)


# ─────────────────────────────────────────────
#  4. SMART GOAL CALCULATOR
# ─────────────────────────────────────────────
@app.route("/api/goal-plan", methods=["POST"])
def goal_plan():
    """
    Generate a full goal achievement plan.

    Request Body:
    {
      "goal": {
        "goal_name": "Bike Purchase",
        "goal_category": "vehicle",
        "current_price": 100000,
        "expected_inflation_rate": 7,      // annual %, optional
        "existing_allocation": 15000,      // already saved for this goal
        "goal_start_date": "2026-03-01",
        "goal_target_date": "2027-03-01",
        "auto_adjust_inflation": true
      },
      "financial_profile": {
        "monthly_income": 45000,
        "emergency_fund_balance": 30000
      },
      "monthly_summaries": [               // optional but recommended
        {
          "month": "2025-11",
          "total_income": 45000,
          "total_expense": 38000,
          "non_essential_expense": 14000
        }
      ],
      "category_expenses": {              // optional, enables optimization
        "Food": 9000,
        "Entertainment": 3000,
        "Shopping": 5000,
        "Transport": 4000
      }
    }

    Response:
    {
      "goal_name": "Bike Purchase",
      "future_value": { "future_value": 107000, ... },
      "required_saving": { "required_monthly_saving": 7667, ... },
      "saving_capacity": { "current_savings": 7000, ... },
      "gap_analysis": { "gap_from_current": 667, "is_feasible_now": false, ... },
      "optimization_suggestions": [ { "category": "Shopping", ... } ],
      "alternative_plans": [ ... ],
      "milestones": [ { "milestone": "Quarter 1", ... } ],
      "feasibility_score": 68,
      "feasibility_label": "Feasible with Adjustments",
      "summary": "..."
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return error("Request body is required.")

    goal              = body.get("goal")
    financial_profile = body.get("financial_profile", {})
    monthly_summaries = body.get("monthly_summaries", [])
    category_expenses = body.get("category_expenses", {})
    transactions      = body.get("transactions",      [])   # NEW
    memory            = body.get("memory",            [])   # NEW

    if not goal:
        return error("'goal' object is required.")
    if not goal.get("current_price"):
        return error("'goal.current_price' is required.")
    if not goal.get("goal_target_date"):
        return error("'goal.goal_target_date' is required.")

    try:
        result = calculate_goal_plan(
            goal              = goal,
            financial_profile = financial_profile,
            monthly_summaries = monthly_summaries,
            category_expenses = category_expenses,
            transactions      = transactions,
            memory            = memory,
        )
        return success(result)
    except Exception as e:
        import traceback
        app.logger.error(f"Goal plan error: {traceback.format_exc()}")
        return error(f"Goal calculation failed: {str(e)}")


# ─────────────────────────────────────────────
#  SERVICE HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health_check():
    return success({
        "status": "running",
        "models": {
            "transaction_categorizer": "active",
            "expense_predictor":       "active",
            "financial_health_guard":  "active",
            "goal_calculator":         "active"
        }
    })


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)