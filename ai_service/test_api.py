"""
=============================================================
  TEST THE LIVE FLASK API  (ai_service running on :5000)
=============================================================
  Run AFTER starting python app.py:
  
      python test_api.py
=============================================================
"""
import json
import requests
from datetime import datetime, timedelta

BASE = "http://localhost:5000"

def post(endpoint, data):
    r = requests.post(f"{BASE}{endpoint}", json=data, timeout=30)
    try:
        return r.status_code, r.json()
    except Exception:
        # Return raw text so we can debug what the server sent
        return r.status_code, {"success": False, "error": f"Server returned non-JSON (HTTP {r.status_code}): {r.text[:300] or '(empty body)'}"}

def heading(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ── Build test data ───────────────────────────────────────────
def make_summaries(n=6):
    now = datetime.now()
    base = 32000
    rows = []
    for i in range(n, 0, -1):
        dt  = now.replace(day=1) - timedelta(days=i*30)
        exp = base + i*300 + ([0,3000,6000,0,0,0,0,0,0,0,3000,5000][dt.month-1])
        rows.append({
            "month": dt.strftime("%Y-%m"),
            "total_income":  50000,
            "total_expense": exp,
            "total_savings": 50000 - exp,
            "savings_rate":  round((50000-exp)/500,1),
            "essential_expense": round(exp*0.65),
            "non_essential_expense": round(exp*0.35),
            "recurring_expense_total": round(exp*0.20),
            "top_spending_category": "Food",
        })
    return rows

def make_transactions():
    now = datetime.now()
    txns = []
    # Recurring: 3 months same merchant + amount
    for mo in [0,1,2]:
        d = (now - timedelta(days=mo*30)).strftime("%Y-%m-%dT00:00:00")
        txns += [
            {"date":d,"amount":199, "merchant_name":"Netflix",   "type":"expense","category":"Entertainment"},
            {"date":d,"amount":699, "merchant_name":"Jio Fiber", "type":"expense","category":"Bills"},
            {"date":d,"amount":2000,"merchant_name":"HDFC SIP",  "type":"expense","category":"Investment"},
        ]
    # Random transactions
    for amt, mer, cat in [(350,"Swiggy","Food"),(280,"Zomato","Food"),(1400,"Amazon","Shopping"),
                           (220,"Ola","Transport"),(1800,"Electricity","Bills")]:
        for dago in [5,12,20]:
            d = (now - timedelta(days=dago)).strftime("%Y-%m-%dT00:00:00")
            txns.append({"date":d,"amount":amt,"merchant_name":mer,"type":"expense","category":cat})
    return txns


# ══════════════════════════════════════════════════════════════

heading("API TEST 1 — Health check")
try:
    r = requests.get(f"{BASE}/api/health", timeout=5)
    print(f"  Status : {r.status_code}")
    print(f"  Body   : {r.json()}")
except Exception as e:
    print(f"  ❌ Server not reachable: {e}")
    print("     Make sure 'python app.py' is running!")
    exit(1)


heading("API TEST 2 — Predict with 6 months data")
status, body = post("/api/predict-expense", {
    "monthly_summaries":   make_summaries(6),
    "financial_profile":   {"monthly_income": 50000, "income_type": "fixed"},
    "upcoming_events":     [],
    "recent_transactions": make_transactions(),
    "inflation_rate":      0.06,
})
print(f"  HTTP Status  : {status}")
if body.get("success"):
    d = body["data"]
    print(f"  Next month   : {d.get('next_month')}")
    print(f"  Predicted    : ₹{d.get('predicted_amount'):,.0f}")
    print(f"  Base         : ₹{d.get('base_prediction'):,.0f}")
    print(f"  Fixed/Recur  : ₹{d.get('fixed_expense'):,.0f}")
    print(f"  Segment      : {d.get('user_segment')}")
    print(f"  Confidence   : {d.get('confidence')} ({d.get('confidence_score'):.0%})")
    print(f"  Adjustments  : {d.get('adjustments')}")
else:
    print(f"  ❌ Error: {body.get('error')}")


heading("API TEST 3 — Predict with WEDDING event")
status, body = post("/api/predict-expense", {
    "monthly_summaries":   make_summaries(6),
    "financial_profile":   {"monthly_income": 50000},
    "upcoming_events":     ["brother wedding"],
    "recent_transactions": [],
})
print(f"  HTTP Status  : {status}")
if body.get("success"):
    d = body["data"]
    print(f"  Predicted    : ₹{d.get('predicted_amount'):,.0f}")
    print(f"  Events adj   : {d.get('adjustments',{}).get('events','not applied')}")
    expl = [e for e in d.get("explanation",[]) if "wedding" in e.lower() or "event" in e.lower()]
    if expl: print(f"  Explanation  : {expl[0]}")
else:
    print(f"  ❌ Error: {body.get('error')}")


heading("API TEST 4 — Predict with ZERO data (new user)")
status, body = post("/api/predict-expense", {
    "monthly_summaries":   [],
    "financial_profile":   {"monthly_income": 50000},
    "upcoming_events":     [],
    "recent_transactions": [],
})
print(f"  HTTP Status  : {status}")
if body.get("success"):
    d = body["data"]
    print(f"  Predicted    : ₹{d.get('predicted_amount'):,.0f}  (should be ~35000 = 70% × 50000)")
    print(f"  Confidence   : {d.get('confidence')}")
else:
    print(f"  ❌ Error: {body.get('error')}")


heading("API TEST 5 — Category breakdown")
# Note: breakdown endpoint only needs category_histories, NOT monthly_summaries
status, body = post("/api/predict-expense/breakdown", {
    "category_histories": {
        "Food":          [8000, 8500, 9000, 8200, 8800, 9200],
        "Transport":     [3000, 3200, 2900, 3100, 3300, 3000],
        "Shopping":      [4000, 6000, 3500, 5000, 7000, 4500],
        "Entertainment": [1500, 1800, 1200, 1600, 1900, 1400],
        "Bills":         [3500, 3500, 3600, 3500, 3500, 3600],
    },
})
print(f"  HTTP Status  : {status}")
if body.get("success"):
    data = body.get("data", {})
    cats = data.get("category_predictions", {})
    for cat, val in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat:<18} ₹{val:,.0f}")
    print(f"  {'─'*28}")
    print(f"  {'Total':<18} ₹{data.get('total_from_categories', 0):,.0f}")
else:
    print(f"  ❌ Error: {body.get('error')}")


print(f"\n{'═'*55}")
print("  All API tests done.")
print(f"{'═'*55}\n")


heading("API TEST 6 — Health check endpoint")
try:
    status, body = post("/api/health-guard", {
        "monthly_summaries": make_summaries(3),
        "financial_profile": {"monthly_income": 50000, "emergency_fund_balance": 100000},
        "investments": [],
        "goals": [],
        "transactions": make_transactions(),
    })
    print(f"  HTTP Status  : {status}")
    if body.get("success"):
        d = body["data"]
        print(f"  Health Score : {d.get('health_score')}/100")
        print(f"  Risk Level   : {d.get('risk_level_label')}")
        print(f"  Alerts       : {len(d.get('risk_alerts', []))}")
        print(f"  Advice items : {len(d.get('advice', []))}")
    else:
        print(f"  ❌ Error: {body.get('error')}")
except Exception as e:
    print(f"  ❌ Exception: {e}")


heading("API TEST 7 — Transaction categorizer")
test_transactions = [
    {"description": "Swiggy lunch order", "merchant_name": "Swiggy", "amount": 350},
    {"description": "Uber ride to office", "merchant_name": "Uber",   "amount": 200},
    {"description": "Amazon shopping",     "merchant_name": "Amazon", "amount": 2500},
    {"description": "Monthly salary",      "merchant_name": "HDFC",   "amount": 50000},
    {"description": "Netflix subscription","merchant_name": "Netflix", "amount": 199},
]
for txn in test_transactions:
    try:
        status, body = post("/api/categorize", txn)
        if body.get("success"):
            d = body["data"]
            print(f"  '{txn['description'][:30]:<30}' → {d.get('category'):<18} (conf: {d.get('confidence_score', 0):.0%}, method: {d.get('method')})")
        else:
            print(f"  ❌ {txn['description']}: {body.get('error')}")
    except Exception as e:
        print(f"  ❌ Exception: {e}")

print(f"\n{'═'*55}")
print("  ✅ All API tests complete!")
print(f"{'═'*55}\n")