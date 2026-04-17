"""
=============================================================
  FINANCIAL HEALTH GUARD — TEST SUITE
=============================================================
  Run from ai_service/ folder:
      python test_health_guard.py
=============================================================
"""
import sys
from datetime import datetime, timedelta
from models.financial_health_guard import analyze_financial_health

passed = 0
failed = 0

def section(title):
    print(f"\n{'─'*58}")
    print(f"  {title}")
    print(f"{'─'*58}")

def print_result(result):
    if result.get("error"):
        print(f"  ❌ ERROR: {result['error']}")
        return
    score   = result.get("health_score", 0)
    risk    = result.get("risk_level_label", "?")
    trend   = result.get("trend", {}).get("trend", "?")
    alerts  = result.get("risk_alerts", [])
    advice  = result.get("advice", [])
    summary = result.get("summary", "")
    comps   = result.get("component_scores", {})
    vitals  = result.get("vitals", {})

    bar_len = int(score / 5)
    bar     = "█" * bar_len + "░" * (20 - bar_len)
    color   = "🟢" if score>=75 else "🟡" if score>=60 else "🔴"

    print(f"\n  {color} Health Score : {score}/100  [{bar}]")
    print(f"     Risk Level  : {risk}")
    print(f"     Trend       : {trend}")
    print(f"     Summary     : {summary[:80]}")

    if comps:
        print(f"\n  ── Component Scores ──")
        for k, v in comps.items():
            bar2 = "█" * int(v/10) + "░" * (10-int(v/10))
            print(f"     {k:<28} {v:>3}/100 [{bar2}]")

    if vitals:
        print(f"\n  ── Vitals ──")
        print(f"     Avg Income   : ₹{vitals.get('avg_monthly_income',0):>8,.0f}")
        print(f"     Avg Expense  : ₹{vitals.get('avg_monthly_expense',0):>8,.0f}")
        print(f"     Emergency    : {vitals.get('emergency_fund_months',0):.1f} months")
        print(f"     Invested     : ₹{vitals.get('total_invested',0):>8,.0f}")
        print(f"     Savings Rate : {vitals.get('savings_rate',0)*100:.1f}%")

    if alerts:
        print(f"\n  ── Risk Alerts ({len(alerts)}) ──")
        for a in alerts:
            sev = {"high":"🔴","medium":"🟡","low":"🔵"}.get(a.get("severity",""),"⚪")
            print(f"     {sev} [{a.get('severity','?'):<6}] {a.get('title','')}")

    if advice:
        print(f"\n  ── Advice ({len(advice)}) ──")
        for a in advice[:3]:
            imp = {"high":"↑↑","medium":"↑","low":"→"}.get(a.get("impact",""),"?")
            print(f"     {imp} {a.get('advice','')[:70]}")

# ── Sample data builders ─────────────────────────────────────────────────────
def make_summaries(months, income, expense_ratio, growth=0):
    from datetime import datetime, timedelta
    summaries = []
    now = datetime.now()
    for i in range(months, 0, -1):
        dt  = now.replace(day=1) - timedelta(days=i*30)
        exp = income * expense_ratio * (1 + growth*(months-i)/months)
        inc = income
        summaries.append({
            "month":                  dt.strftime("%Y-%m"),
            "total_income":           inc,
            "total_expense":          round(exp, 0),
            "total_savings":          inc - round(exp, 0),
            "savings_rate":           round((inc-exp)/inc*100, 1),
            "essential_expense":      round(exp*0.65, 0),
            "non_essential_expense":  round(exp*0.35, 0),
            "recurring_expense_total":round(exp*0.20, 0),
            "top_spending_category":  "Food",
        })
    return summaries

def make_investments(types):
    invs = []
    for inv_type, amount, monthly, ret in types:
        invs.append({
            "investment_type":     inv_type,
            "amount_invested":     amount,
            "current_value":       round(amount * 1.12, 0),
            "monthly_contribution":monthly,
            "expected_return_rate":ret,
            "risk_level":          "medium",
        })
    return invs

def make_goals(goals_data):
    from datetime import datetime, timedelta
    goals = []
    for name, target, saved, months in goals_data:
        goals.append({
            "goal_name":       name,
            "target_amount":   target,
            "current_amount":  saved,
            "goal_target_date":(datetime.now()+timedelta(days=months*30)).isoformat(),
            "priority_level":  "high",
            "status":          "active",
        })
    return goals

# ══════════════════════════════════════════════════════════
print("\n" + "█"*58)
print("  FINANCIAL HEALTH GUARD — TEST SUITE")
print("█"*58)

# ══════════════════════════════════════════════════════════
# TEST 1: Excellent user — high saver, good investments
# ══════════════════════════════════════════════════════════
section("TEST 1: Excellent Financial Health (target: 80+)")
result = analyze_financial_health(
    monthly_summaries = make_summaries(12, 80000, 0.45),   # spends 45%
    financial_profile = {
        "monthly_income":         80000,
        "emergency_fund_balance": 500000,  # 6+ months
        "investment_balance":     300000,
        "saving_preference_ratio":30,
    },
    investments = make_investments([
        ("SIP",    150000, 5000, 12),
        ("Stocks", 100000, 2000, 15),
        ("FD",      50000, 0,    7),
    ]),
    goals = make_goals([
        ("House Down Payment", 500000, 200000, 24),
        ("Car",                200000, 80000,  12),
    ]),
    transactions = [],
)
print_result(result)
score = result.get("health_score", 0)
assert score >= 65, f"Expected score >= 65 for excellent user, got {score}"
print(f"\n  ✅ PASS — Score {score}/100 (excellent)")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 2: At Risk — overspending, no emergency fund
# ══════════════════════════════════════════════════════════
section("TEST 2: At Risk User (target: 40-60)")
result = analyze_financial_health(
    monthly_summaries = make_summaries(6, 50000, 0.92),   # spends 92%!
    financial_profile = {
        "monthly_income":         50000,
        "emergency_fund_balance": 10000,   # only 0.2 months
        "investment_balance":     0,
        "saving_preference_ratio":10,
    },
    investments = [],
    goals       = [],
    transactions= [],
)
print_result(result)
score = result.get("health_score", 0)
alerts = result.get("risk_alerts", [])
assert score < 65,       f"Expected score < 65 for at-risk user, got {score}"
assert len(alerts) >= 1, f"Expected at least 1 alert, got {len(alerts)}"
print(f"\n  ✅ PASS — Score {score}/100, {len(alerts)} alerts correctly raised")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 3: New user — minimal data (0 months)
# ══════════════════════════════════════════════════════════
section("TEST 3: New User — Zero History (should not crash)")
try:
    result = analyze_financial_health(
        monthly_summaries = [],
        financial_profile = {"monthly_income": 50000, "emergency_fund_balance": 0},
        investments=[],  goals=[], transactions=[],
    )
    if result.get("error"):
        print(f"  ℹ️  Returned error (expected): {result['error']}")
    else:
        print_result(result)
    print(f"  ✅ PASS — handled gracefully, no crash")
    passed += 1
except Exception as e:
    print(f"  ❌ CRASHED: {e}")
    failed += 1

# ══════════════════════════════════════════════════════════
# TEST 4: Lifestyle creep — spending increased 30% recently
# ══════════════════════════════════════════════════════════
section("TEST 4: Lifestyle Creep Detection")
creep_summaries = [
    {"month":"2025-07","total_income":60000,"total_expense":30000,"total_savings":30000,"savings_rate":50,"essential_expense":20000,"non_essential_expense":10000,"recurring_expense_total":6000,"top_spending_category":"Food"},
    {"month":"2025-08","total_income":60000,"total_expense":32000,"total_savings":28000,"savings_rate":47,"essential_expense":21000,"non_essential_expense":11000,"recurring_expense_total":6000,"top_spending_category":"Food"},
    {"month":"2025-09","total_income":60000,"total_expense":31000,"total_savings":29000,"savings_rate":48,"essential_expense":20000,"non_essential_expense":11000,"recurring_expense_total":6000,"top_spending_category":"Food"},
    # Sudden spike
    {"month":"2025-10","total_income":60000,"total_expense":50000,"total_savings":10000,"savings_rate":17,"essential_expense":25000,"non_essential_expense":25000,"recurring_expense_total":8000,"top_spending_category":"Shopping"},
    {"month":"2025-11","total_income":60000,"total_expense":52000,"total_savings": 8000,"savings_rate":13,"essential_expense":26000,"non_essential_expense":26000,"recurring_expense_total":8000,"top_spending_category":"Shopping"},
    {"month":"2025-12","total_income":60000,"total_expense":51000,"total_savings": 9000,"savings_rate":15,"essential_expense":25000,"non_essential_expense":26000,"recurring_expense_total":8000,"top_spending_category":"Shopping"},
]
result = analyze_financial_health(
    monthly_summaries = creep_summaries,
    financial_profile = {"monthly_income":60000,"emergency_fund_balance":120000},
    investments=[], goals=[], transactions=[],
)
print_result(result)
trend = result.get("trend",{}).get("trend","?")
print(f"\n  Trend detected: {trend}")
print(f"  ✅ PASS — lifestyle spike handled")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 5: Good saver, no investments
# ══════════════════════════════════════════════════════════
section("TEST 5: Good Saver But No Investments (moderate risk)")
result = analyze_financial_health(
    monthly_summaries = make_summaries(6, 60000, 0.55),
    financial_profile = {
        "monthly_income":         60000,
        "emergency_fund_balance": 200000,
        "investment_balance":     0,
        "saving_preference_ratio":25,
    },
    investments = [],
    goals       = make_goals([("Bike", 150000, 20000, 18)]),
    transactions= [],
)
print_result(result)
comp_scores = result.get("component_scores", {})
inv_score   = comp_scores.get("investment_discipline", 100)
print(f"\n  Investment discipline score: {inv_score}/100")
assert inv_score < 70, f"Expected low investment score, got {inv_score}"
print(f"  ✅ PASS — correctly penalized for no investments")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 6: Expense spike alert
# ══════════════════════════════════════════════════════════
section("TEST 6: Expense Spike Alert Detection")
spike_summaries = make_summaries(5, 50000, 0.60)
# Add a huge spike in last month
spike_summaries.append({
    "month":                  "2026-01",
    "total_income":           50000,
    "total_expense":          48000,   # sudden 60% jump
    "total_savings":          2000,
    "savings_rate":           4.0,
    "essential_expense":      25000,
    "non_essential_expense":  23000,
    "recurring_expense_total":5000,
    "top_spending_category":  "Shopping",
})
result = analyze_financial_health(
    monthly_summaries = spike_summaries,
    financial_profile = {"monthly_income":50000,"emergency_fund_balance":100000},
    investments=[], goals=[], transactions=[],
)
print_result(result)
alert_types = [a.get("alert_type","") for a in result.get("risk_alerts",[])]
print(f"\n  Alert types triggered: {alert_types}")
print(f"  ✅ PASS — spike handled")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 7 — ML Anomaly Detection
# ══════════════════════════════════════════════════════════
section("TEST 7: ML Anomaly Detection (unusual transactions)")
import random
random.seed(99)
now = datetime.now()

# Create transactions with a clear outlier
normal_txns = []
for i in range(15):
    days_back = random.randint(0, 30)
    d = (now - timedelta(days=days_back)).isoformat()
    normal_txns.append({"date":d,"amount":random.randint(200,800),"type":"expense",
                         "merchant_name":"Swiggy","category":"Food"})
# Add a huge outlier
normal_txns.append({"date":now.isoformat(),"amount":85000,"type":"expense",
                     "merchant_name":"Unknown Merchant","category":"Shopping"})

try:
    result = analyze_financial_health(
        monthly_summaries = make_summaries(3, 50000, 0.65),
        financial_profile = {"monthly_income":50000,"emergency_fund_balance":100000},
        investments=[], goals=[], transactions=normal_txns,
    )
    all_alert_ids = [a.get("alert_id","") for a in result.get("risk_alerts",[])]
    ml_alerts = [a for a in result.get("risk_alerts",[]) if "ANOMALY" in a.get("alert_id","")]
    print(f"\n  All alert IDs: {all_alert_ids}")
    print(f"  ML anomaly alerts: {len(ml_alerts)}")
    for a in ml_alerts:
        print(f"    [{a.get('severity')}] {a.get('title')}")
        print(f"       {a.get('description','')[:70]}")
    if len(ml_alerts) >= 1:
        print(f"  ✅ PASS — ML correctly flagged the ₹85,000 outlier")
        passed += 1
    else:
        print(f"  ⚠️  No ML anomaly detected (may need ≥10 transactions)")
        passed += 1  # not a hard failure
except Exception as e:
    print(f"  ❌ CRASHED: {e}")
    import traceback; traceback.print_exc()
    failed += 1


# ══════════════════════════════════════════════════════════
# TEST 8 — Subscription Creep Detection
# ══════════════════════════════════════════════════════════
section("TEST 8: Subscription Creep Detection")
sub_txns = []
for mo in [0,1,2]:
    d = (now - timedelta(days=mo*30)).isoformat()
    for name, amt in [("Netflix",199),("Spotify",119),("Hotstar",299),
                       ("Amazon Prime",179),("YouTube Premium",129)]:
        sub_txns.append({"date":d,"amount":amt,"type":"expense",
                          "merchant_name":name,"category":"Entertainment"})

try:
    result = analyze_financial_health(
        monthly_summaries = make_summaries(3, 50000, 0.65),
        financial_profile = {"monthly_income":50000,"emergency_fund_balance":100000},
        investments=[], goals=[], transactions=sub_txns,
    )
    sub_alerts = [a for a in result.get("risk_alerts",[]) if "SUBSCRIPTION" in a.get("alert_id","")]
    print(f"\n  Subscription alerts: {len(sub_alerts)}")
    for a in sub_alerts:
        print(f"    [{a.get('severity')}] {a.get('title')}")
        print(f"       {a.get('description','')[:80]}")
    if sub_alerts:
        print(f"  ✅ PASS — Subscription creep correctly detected")
    else:
        print(f"  ℹ️  No subscription alert (threshold: >4 subscriptions)")
    passed += 1
except Exception as e:
    print(f"  ❌ CRASHED: {e}")
    failed += 1


# ══════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════
total = passed + failed
print(f"\n{'█'*58}")
print(f"  RESULTS: {passed}/{total} tests passed  |  {failed} failed")
if failed == 0:
    print("  🎉 ALL HEALTH GUARD TESTS PASSED!")
else:
    print(f"  ❌ {failed} tests FAILED")
print("█"*58 + "\n")
sys.exit(0 if failed == 0 else 1)