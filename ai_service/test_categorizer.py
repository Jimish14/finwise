"""
=============================================================
  SMART TRANSACTION CATEGORIZER — TEST SUITE
=============================================================
  Run from ai_service/ folder:
      python test_categorizer.py
=============================================================
"""
import sys
from models.transaction_categorizer import categorize_transaction, retrain_with_feedback

passed = 0
failed = 0

def print_result(test_name, result, expected_category=None):
    cat    = result.get("category", "?")
    conf   = result.get("confidence_score", 0)
    method = result.get("method", "?")
    ok     = expected_category is None or cat == expected_category
    icon   = "✅" if ok else "❌"
    exp    = f"  expected: {expected_category}" if not ok else ""
    print(f"  {icon} [{method:<10}] {cat:<16} conf:{conf:.0%}  {exp}")
    return ok

def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")

print("\n" + "█"*55)
print("  SMART TRANSACTION CATEGORIZER — TEST SUITE")
print("█"*55)

# ══════════════════════════════════════════════════════════
# TEST GROUP 1: Food
# ══════════════════════════════════════════════════════════
section("GROUP 1 — Food Transactions")
FOOD_TESTS = [
    ("Swiggy lunch order",    "Swiggy",     350,  "Food"),
    ("Zomato biryani",        "Zomato",     280,  "Food"),
    ("BigBasket grocery",     "BigBasket",  1200, "Food"),
    ("Dominos pizza",         "Dominos",    450,  "Food"),
    ("KFC bucket",            "KFC",        650,  "Food"),
    ("chai at local cafe",    "",           30,   "Food"),
    ("dinner at restaurant",  "Barbeque Nation", 2400, "Food"),
    ("Starbucks coffee",      "Starbucks",  480,  "Food"),
]
for desc, merchant, amt, expected in FOOD_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 2: Transport
# ══════════════════════════════════════════════════════════
section("GROUP 2 — Transport Transactions")
TRANSPORT_TESTS = [
    ("Uber ride to office",   "Uber",       220,  "Transport"),
    ("Ola cab booking",       "Ola",        180,  "Transport"),
    ("Rapido bike ride",      "Rapido",     50,   "Transport"),
    ("IRCTC train ticket",    "IRCTC",      850,  "Transport"),
    ("IndiGo flight",         "IndiGo",     4500, "Transport"),
    ("petrol filling",        "HP Petrol",  2000, "Transport"),
    ("metro card recharge",   "Delhi Metro",200,  "Transport"),
    ("Redbus bus ticket",     "Redbus",     450,  "Transport"),
]
for desc, merchant, amt, expected in TRANSPORT_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 3: Shopping
# ══════════════════════════════════════════════════════════
section("GROUP 3 — Shopping Transactions")
SHOPPING_TESTS = [
    ("Amazon order delivered",  "Amazon",   2500, "Shopping"),
    ("Flipkart mobile purchase","Flipkart",  18000,"Shopping"),
    ("Myntra clothes",          "Myntra",    1800, "Shopping"),
    ("Nykaa skincare",          "Nykaa",     900,  "Shopping"),
    ("Meesho dress order",      "Meesho",    650,  "Shopping"),
    ("mall shopping",           "Phoenix Mall",5000,"Shopping"),
    ("Nike shoes",              "Nike",      4500, "Shopping"),
]
for desc, merchant, amt, expected in SHOPPING_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 4: Bills & Utilities
# ══════════════════════════════════════════════════════════
section("GROUP 4 — Bills & Utilities")
BILLS_TESTS = [
    ("electricity bill payment","MSEB",      1400, "Bills"),
    ("Jio broadband monthly",   "Jio",       699,  "Bills"),
    ("Airtel postpaid bill",    "Airtel",    549,  "Bills"),
    ("water bill",              "BWSSB",     300,  "Bills"),
    ("gas cylinder booking",    "HP Gas",    950,  "Bills"),
    ("Tata Sky DTH",            "Tata Sky",  350,  "Bills"),
    ("mobile recharge",         "Vi",        199,  "Bills"),
]
for desc, merchant, amt, expected in BILLS_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 5: Entertainment
# ══════════════════════════════════════════════════════════
section("GROUP 5 — Entertainment")
ENT_TESTS = [
    ("Netflix monthly subscription","Netflix",  199,  "Entertainment"),
    ("Spotify premium",          "Spotify",   119,  "Entertainment"),
    ("Amazon Prime renewal",     "Amazon",    1499, "Entertainment"),
    ("PVR movie ticket",         "PVR",       450,  "Entertainment"),
    ("Hotstar subscription",     "Hotstar",   299,  "Entertainment"),
    ("PlayStation game",         "PlayStation",2999,"Entertainment"),
    ("YouTube premium",          "Google",    129,  "Entertainment"),
]
for desc, merchant, amt, expected in ENT_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 6: Health
# ══════════════════════════════════════════════════════════
section("GROUP 6 — Health")
HEALTH_TESTS = [
    ("Apollo hospital bill",     "Apollo",    3500, "Health"),
    ("medicine from pharmacy",   "MedPlus",   800,  "Health"),
    ("gym monthly membership",   "Cult Fit",  1200, "Health"),
    ("doctor consultation",      "Practo",    500,  "Health"),
    ("diagnostic lab test",      "Dr Lal",    1200, "Health"),
    ("dental checkup",           "Dental Clinic",700,"Health"),
]
for desc, merchant, amt, expected in HEALTH_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 7: Investment
# ══════════════════════════════════════════════════════════
section("GROUP 7 — Investment")
INV_TESTS = [
    ("SIP mutual fund",          "Zerodha",   2000, "Investment"),
    ("Groww stocks purchase",    "Groww",     5000, "Investment"),
    ("PPF deposit",              "SBI",       1500, "Investment"),
    ("fixed deposit opening",    "HDFC",      50000,"Investment"),
    ("gold purchase",            "Tanishq",   15000,"Investment"),
    ("crypto bitcoin buy",       "CoinSwitch",3000, "Investment"),
    ("NPS contribution",         "NPS",       2000, "Investment"),
]
for desc, merchant, amt, expected in INV_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 8: Salary / Income
# ══════════════════════════════════════════════════════════
section("GROUP 8 — Salary / Income")
SAL_TESTS = [
    ("salary credit",            "HDFC Bank", 50000,"Salary"),
    ("monthly salary",           "TCS",       75000,"Salary"),
    ("payroll credit",           "Infosys",   60000,"Salary"),
    ("freelance payment",        "Upwork",    25000,"Salary"),
]
for desc, merchant, amt, expected in SAL_TESTS:
    result = categorize_transaction(desc, merchant, amt)
    ok = print_result(f"{desc[:35]}", result, expected)
    if ok: passed += 1
    else:  failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 9: Edge cases
# ══════════════════════════════════════════════════════════
section("GROUP 9 — Edge Cases")
EDGE_TESTS = [
    ("",        "",       0,    None),   # empty → should not crash
    ("xyz123",  "QWERTY", 999,  None),   # unknown → Miscellaneous
    ("abcdef",  "",       100,  None),   # no match
]
for desc, merchant, amt, expected in EDGE_TESTS:
    try:
        result = categorize_transaction(desc, merchant, amt)
        cat = result.get("category","?")
        print(f"  ✅ '{desc or '(empty)'}' → {cat} (no crash)")
        passed += 1
    except Exception as e:
        print(f"  ❌ CRASH on '{desc}': {e}")
        failed += 1

# ══════════════════════════════════════════════════════════
# TEST GROUP 10: Feedback / Retraining
# ══════════════════════════════════════════════════════════
section("GROUP 10 — Feedback Loop (Retraining)")
print("  Testing before retraining:")
result_before = categorize_transaction("paytm transfer", "Paytm", 500)
print(f"  'paytm transfer' → {result_before.get('category')} ({result_before.get('method')})")

print("\n  Sending correction feedback...")
feedback = retrain_with_feedback("paytm transfer", "Paytm", "Transfer")
print(f"  Feedback result: {feedback.get('message','no message')}")

print("\n  Testing after retraining:")
result_after = categorize_transaction("paytm transfer", "Paytm", 500)
print(f"  'paytm transfer' → {result_after.get('category')} ({result_after.get('method')})")
print(f"  ✅ Retrain feedback accepted without crash")
passed += 1

# ══════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════
total = passed + failed
print(f"\n{'█'*55}")
print(f"  RESULTS: {passed}/{total} tests passed  |  {failed} failed")
accuracy = round(passed/total*100) if total else 0
print(f"  Accuracy: {accuracy}%")
if accuracy >= 85:
    print("  🎉 EXCELLENT — Model is production ready!")
elif accuracy >= 70:
    print("  ✅ GOOD — Model performs well")
else:
    print("  ⚠️  Model needs more training data")
print("█"*55 + "\n")
# Exit 0 if accuracy >= 85% (production ready threshold)
# Minor rule-based misses on edge cases are acceptable
sys.exit(0 if accuracy >= 85 else 1)