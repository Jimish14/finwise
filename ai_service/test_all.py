"""
=============================================================
  FINWISE AI — MASTER TEST RUNNER
=============================================================
  Runs ALL 4 AI model test suites in sequence.

  Usage:
      python test_all.py                # run all 4 suites
      python test_all.py categorizer    # just categorizer
      python test_all.py health         # just health guard
      python test_all.py goal           # just goal calculator
      python test_all.py predictor      # just expense predictor
      python test_all.py api            # just live API tests
=============================================================
"""

import sys
import subprocess
import time

SUITES = [
    ("Transaction Categorizer",  "test_categorizer.py"),
    ("Financial Health Guard",   "test_health_guard.py"),
    ("Smart Goal Calculator",    "test_goal_calculator.py"),
    ("Expense Predictor",        "test_expense_predictor.py"),
]

FILTER_MAP = {
    "categorizer": "test_categorizer.py",
    "health":      "test_health_guard.py",
    "goal":        "test_goal_calculator.py",
    "predictor":   "test_expense_predictor.py",
    "api":         "test_api.py",
}

# Filter by CLI arg
arg = sys.argv[1].lower() if len(sys.argv) > 1 else None
if arg and arg in FILTER_MAP:
    SUITES = [(n, f) for n, f in SUITES if f == FILTER_MAP[arg]]
    if not SUITES:
        SUITES = [(arg.title(), FILTER_MAP[arg])]

print("\n" + "█"*60)
print("  FINWISE AI — MASTER TEST RUNNER")
print(f"  Running {len(SUITES)} test suite(s)")
print("  " + "─"*56)
print("  Commands:")
print("    python test_all.py              → all 4 suites")
print("    python test_all.py categorizer  → categorizer only")
print("    python test_all.py health       → health guard only")
print("    python test_all.py goal         → goal calculator only")
print("    python test_all.py predictor    → expense predictor only")
print("    python test_api.py              → live API tests (Flask must be running)")
print("█"*60)

results = []
total_start = time.time()

for name, script in SUITES:
    print(f"\n\n{'▶'*60}")
    print(f"  Running: {name}")
    print(f"{'▶'*60}")
    start = time.time()
    ret   = subprocess.run([sys.executable, script], capture_output=False)
    elapsed = round(time.time() - start, 1)
    status  = "✅ PASSED" if ret.returncode == 0 else "❌ FAILED"
    results.append((name, status, elapsed, ret.returncode))

# ── Final Summary ────────────────────────────────────────────
total_time = round(time.time() - total_start, 1)
all_passed = all(r[3] == 0 for r in results)

print("\n\n" + "█"*60)
print("  MASTER SUMMARY")
print("  " + "─"*56)
for name, status, elapsed, _ in results:
    print(f"  {status}  {name:<35} ({elapsed}s)")

print(f"\n  Total time: {total_time}s")
passed_count = sum(1 for r in results if r[3] == 0)
print(f"  Suites: {passed_count}/{len(results)} passed")

if all_passed:
    print("\n  🎉 ALL AI MODELS FULLY TESTED AND WORKING!")
    print("  ✅ Transaction Categorizer  — XGBoost + LR + Rule-based")
    print("  ✅ Financial Health Guard   — 6-score + ML Anomaly + Behavior")
    print("  ✅ Smart Goal Calculator    — ML Saving + Risk + SIP + Milestones")
    print("  ✅ Expense Predictor        — Prophet + XGBoost + Trend Ensemble")
else:
    failed = [r[0] for r in results if r[3] != 0]
    print(f"\n  ⚠️  Failed suites: {', '.join(failed)}")
    print("  Check the output above for details.")

print("█"*60 + "\n")
sys.exit(0 if all_passed else 1)