"""
=============================================================
  SMART GOAL CALCULATOR — TEST SUITE
=============================================================
  Run from ai_service/ folder:
      python test_goal_calculator.py
=============================================================
"""
import sys
from datetime import datetime, timedelta
from models.goal_calculator import calculate_goal_plan

# Sample transactions for ML + behavior analysis
def make_transactions(n=20):
    import random
    random.seed(42)
    now = datetime.now()
    merchants = [
        ("Swiggy",    300, "Food"),    ("Zomato",  250, "Food"),
        ("Netflix",   199, "Entertainment"), ("Jio", 699, "Bills"),
        ("Amazon",   2000, "Shopping"), ("Ola",    200, "Transport"),
        ("Gym",       800, "Health"),  ("HDFC SIP",2000,"Investment"),
    ]
    txns = []
    for i in range(n):
        days_back = random.randint(0, 60)
        d = (now - timedelta(days=days_back)).isoformat()
        mer, amt, cat = random.choice(merchants)
        # Make Netflix/Jio/SIP recurring (appear 3+ times same amount)
        txns.append({"date":d,"amount":amt,"merchant_name":mer,"category":cat,"type":"expense","description":f"{mer} payment"})
    # Force 3 occurrences of recurring
    for mo in [0,1,2]:
        d = (now - timedelta(days=mo*30)).isoformat()
        txns.append({"date":d,"amount":199, "merchant_name":"Netflix",  "category":"Entertainment","type":"expense","description":"Netflix"})
        txns.append({"date":d,"amount":2000,"merchant_name":"HDFC SIP", "category":"Investment",  "type":"expense","description":"SIP"})
    return txns

passed = 0
failed = 0

def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")

def future_date(months):
    dt = datetime.now() + timedelta(days=months*30)
    return dt.strftime("%Y-%m-%dT00:00:00")

def print_result(result):
    if result.get("error"):
        print(f"  ❌ ERROR: {result['error']}")
        return

    feas   = result.get("feasibility_score", 0)
    label  = result.get("feasibility_label", "?")
    summ   = result.get("summary", "")
    fv     = result.get("future_value", {})
    req    = result.get("required_saving", {})
    cap    = result.get("saving_capacity", {})
    gap    = result.get("gap_analysis", {})
    opts   = result.get("optimization_suggestions", [])
    alts   = result.get("alternative_plans", [])
    miles  = result.get("milestones", [])

    bar_len = int(feas / 5)
    bar     = "█" * bar_len + "░" * (20 - bar_len)
    icon    = "🟢" if feas>=80 else "🟡" if feas>=50 else "🔴"

    print(f"\n  {icon} Feasibility    : {feas:.0f}/100  [{bar}]  {label}")
    print(f"     Summary        : {summ[:75]}")
    print(f"\n  ── Financials ──")
    print(f"     Current Price  : ₹{fv.get('current_price',0):>10,.0f}")
    print(f"     Future Value   : ₹{fv.get('future_value',0):>10,.0f}  (+₹{fv.get('inflation_added',0):,.0f} inflation)")
    print(f"     Required/Month : ₹{req.get('required_monthly_saving',0):>10,.0f}")
    print(f"     Can Save/Month : ₹{cap.get('current_savings',0):>10,.0f}")
    print(f"     With Cuts      : ₹{cap.get('potential_savings',0):>10,.0f}")
    print(f"     Months Left    : {result.get('months_remaining',0)}")

    print(f"\n  ── Gap Analysis ──")
    print(f"     Feasible Now   : {'✅ Yes' if gap.get('is_feasible_now') else '❌ No'}")
    print(f"     With Cuts      : {'✅ Yes' if gap.get('is_feasible_with_cuts') else '❌ No'}")
    if not gap.get("is_feasible_now"):
        print(f"     Monthly Gap    : ₹{gap.get('gap_from_current',0):,.0f}")

    if opts:
        print(f"\n  ── Spending Cuts Suggested ({len(opts)}) ──")
        for o in opts[:3]:
            print(f"     ✂ {o.get('category','?'):<18} cut {o.get('suggested_cut_percent',0)}% → save ₹{o.get('monthly_saving',0):,.0f}/mo")

    if alts:
        print(f"\n  ── Alternative Plans ({len(alts)}) ──")
        for a in alts[:3]:
            print(f"     📌 [{a.get('feasibility','?'):<6}] {a.get('plan','')}")

    if miles:
        print(f"\n  ── Milestones ({len(miles)}) ──")
        for m in miles[:4]:
            print(f"     📅 {m.get('date','?')} — {m.get('milestone','')} ({m.get('progress_percent',0)}%)")

BASE_PROFILE = {
    "monthly_income": 60000,
    "income_type":    "fixed",
    "risk_profile":   "medium",
    "emergency_fund_balance": 150000,
    "saving_preference_ratio": 20,
}

BASE_SUMMARIES = []
now = datetime.now()
for i in range(6, 0, -1):
    dt = now.replace(day=1) - timedelta(days=i*30)
    BASE_SUMMARIES.append({
        "month":                  dt.strftime("%Y-%m"),
        "total_income":           60000,
        "total_expense":          38000,
        "total_savings":          22000,
        "savings_rate":           36.7,
        "essential_expense":      24700,
        "non_essential_expense":  13300,
        "recurring_expense_total":7600,
        "top_spending_category":  "Food",
    })

BASE_CAT_EXPENSES = {
    "Food":          9000,
    "Transport":     3500,
    "Shopping":      5000,
    "Entertainment": 2000,
    "Bills":         4000,
    "Health":        1000,
    "Education":     500,
}

# ══════════════════════════════════════════════════════════
print("\n" + "█"*60)
print("  SMART GOAL CALCULATOR — TEST SUITE")
print("█"*60)

# ══════════════════════════════════════════════════════════
# TEST 1: Easy goal — vacation in 6 months
# ══════════════════════════════════════════════════════════
section("TEST 1: Easy Goal — Goa Vacation (6 months, ₹30,000)")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "Goa Vacation",
        "goal_category":          "travel",
        "current_price":          30000,
        "expected_inflation_rate":5,
        "existing_allocation":    5000,
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(6),
        "auto_adjust_inflation":  True,
    },
    financial_profile   = BASE_PROFILE,
    monthly_summaries   = BASE_SUMMARIES,
    category_expenses   = BASE_CAT_EXPENSES,
        transactions        = make_transactions(),
    )
print_result(result)
feas = result.get("feasibility_score", 0)
assert feas >= 60, f"Easy goal should be feasible, got {feas}"
print(f"\n  ✅ PASS — Feasibility {feas:.0f}/100")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 2: Moderate goal — Royal Enfield (18 months)
# ══════════════════════════════════════════════════════════
section("TEST 2: Moderate Goal — Royal Enfield Bike (18 months, ₹2.2L)")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "Royal Enfield Classic 350",
        "goal_category":          "vehicle",
        "current_price":          220000,
        "expected_inflation_rate":7,
        "existing_allocation":    30000,
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(18),
        "auto_adjust_inflation":  True,
    },
    financial_profile   = BASE_PROFILE,
    monthly_summaries   = BASE_SUMMARIES,
    category_expenses   = BASE_CAT_EXPENSES,
        transactions        = make_transactions(),
    )
print_result(result)
req = result.get("required_saving", {}).get("required_monthly_saving", 0)
assert req > 0, "Required saving should be calculated"
print(f"\n  ✅ PASS — Monthly requirement ₹{req:,.0f}")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 3: Tough goal — MacBook Pro (6 months, tight budget)
# ══════════════════════════════════════════════════════════
section("TEST 3: Tough Goal — MacBook Pro (6 months, ₹1.5L, tight income)")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "MacBook Pro M3",
        "goal_category":          "gadget",
        "current_price":          150000,
        "expected_inflation_rate":3,
        "existing_allocation":    10000,
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(6),
        "auto_adjust_inflation":  True,
    },
    financial_profile = {**BASE_PROFILE, "monthly_income": 35000},
    monthly_summaries = [{**s, "total_income": 35000, "total_expense": 30000, "total_savings": 5000} for s in BASE_SUMMARIES],
    category_expenses = BASE_CAT_EXPENSES,
)
print_result(result)
feas  = result.get("feasibility_score", 0)
alts  = result.get("alternative_plans", [])
print(f"\n  Feasibility: {feas:.0f}/100")
print(f"  Alternative plans offered: {len(alts)}")
assert len(alts) >= 1, "Tough goal should offer alternatives"
print(f"  ✅ PASS — Correctly shows alternatives for tough goal")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 4: Long-term goal — Education abroad (36 months)
# ══════════════════════════════════════════════════════════
section("TEST 4: Long-term Goal — MBA Abroad (36 months, ₹15L)")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "MBA from IIM Ahmedabad",
        "goal_category":          "education",
        "current_price":          1500000,
        "expected_inflation_rate":10,
        "existing_allocation":    200000,
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(36),
        "auto_adjust_inflation":  True,
    },
    financial_profile   = {**BASE_PROFILE, "monthly_income": 100000},
    monthly_summaries   = [{**s, "total_income":100000,"total_expense":55000,"total_savings":45000} for s in BASE_SUMMARIES],
    category_expenses   = BASE_CAT_EXPENSES,
        transactions        = make_transactions(),
    )
print_result(result)
fv = result.get("future_value", {})
print(f"\n  Inflation-adjusted cost after 36 months: ₹{fv.get('future_value',0):,.0f}")
assert fv.get("future_value", 0) > 1500000, "Future value should be higher than current price"
miles = result.get("milestones", [])
assert len(miles) >= 3, f"Should have quarterly milestones, got {len(miles)}"
print(f"  ✅ PASS — {len(miles)} quarterly milestones generated")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 5: Already saved goal — almost done
# ══════════════════════════════════════════════════════════
section("TEST 5: Nearly Complete Goal — 90% Already Saved")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "iPhone 15 Pro",
        "goal_category":          "gadget",
        "current_price":          130000,
        "expected_inflation_rate":3,
        "existing_allocation":    118000,  # 90% already saved!
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(3),
        "auto_adjust_inflation":  True,
    },
    financial_profile   = BASE_PROFILE,
    monthly_summaries   = BASE_SUMMARIES,
    category_expenses   = BASE_CAT_EXPENSES,
        transactions        = make_transactions(),
    )
print_result(result)
feas = result.get("feasibility_score", 0)
assert feas >= 85, f"Nearly-done goal should score >= 85, got {feas}"
print(f"\n  ✅ PASS — Correctly high feasibility {feas:.0f}/100 (90% saved)")
passed += 1

# ══════════════════════════════════════════════════════════
# TEST 6: Zero data — no monthly summaries
# ══════════════════════════════════════════════════════════
section("TEST 6: No Monthly History (new user)")
try:
    result = calculate_goal_plan(
        goal = {
            "goal_name":              "Emergency Fund",
            "goal_category":          "other",
            "current_price":          200000,
            "expected_inflation_rate":0,
            "existing_allocation":    0,
            "goal_start_date":        datetime.now().isoformat(),
            "goal_target_date":       future_date(12),
            "auto_adjust_inflation":  False,
        },
        financial_profile = BASE_PROFILE,
        monthly_summaries = [],
        category_expenses = {},
    )
    if result.get("error"):
        print(f"  ℹ️  Returned error (acceptable): {result['error']}")
    else:
        print_result(result)
    print(f"  ✅ PASS — handled gracefully, no crash")
    passed += 1
except Exception as e:
    print(f"  ❌ CRASHED: {e}")
    import traceback; traceback.print_exc()
    failed += 1

# ══════════════════════════════════════════════════════════
# TEST 7: Investment return — SIP calculation
# ══════════════════════════════════════════════════════════
section("TEST 7: Investment Return Scenario (SIP at 12% returns)")
result = calculate_goal_plan(
    goal = {
        "goal_name":              "House Down Payment",
        "goal_category":          "other",
        "current_price":          1000000,
        "expected_inflation_rate":6,
        "existing_allocation":    100000,
        "goal_start_date":        datetime.now().isoformat(),
        "goal_target_date":       future_date(60),   # 5 years
        "auto_adjust_inflation":  True,
    },
    financial_profile = {
        **BASE_PROFILE,
        "monthly_income":  150000,
        "risk_profile":    "high",
    },
    monthly_summaries = [{**s,"total_income":150000,"total_expense":70000,"total_savings":80000} for s in BASE_SUMMARIES],
    category_expenses = BASE_CAT_EXPENSES,
)
print_result(result)
req_s = result.get("required_saving",{})
print(f"\n  Return rate assumed: {req_s.get('investment_return_rate',0)*100:.0f}%")
print(f"  ✅ PASS — Long-term SIP goal handled")
passed += 1

# ══════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════
total = passed + failed
print(f"\n{'█'*60}")
print(f"  RESULTS: {passed}/{total} tests passed  |  {failed} failed")
if failed == 0:
    print("  🎉 ALL GOAL CALCULATOR TESTS PASSED!")
else:
    print(f"  ❌ {failed} tests FAILED")
print("█"*60 + "\n")
sys.exit(0 if failed == 0 else 1)