import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { fmt, Spinner, Alert, Badge } from "../../components/ui/index.jsx";

export default function GoalCalculator() {
  const [searchParams] = useSearchParams();
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(searchParams.get("goalId") || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    api.get("/goals").then(({ data }) => setGoals(data.data));
  }, []);

  useEffect(() => {
    if (searchParams.get("goalId")) setSelectedGoalId(searchParams.get("goalId"));
  }, [searchParams]);

  const runAnalysis = async () => {
    if (!selectedGoalId) return setError("Please select a goal first.");
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await api.post(`/ai/goal-plan/${selectedGoalId}`);
      if (data.success) setResult(data.data);
      else setError(data.error || "Analysis failed");
    } catch (err) {
      setError(err.response?.data?.error || "Could not connect to AI service.");
    } finally { setLoading(false); }
  };

  const handleExport = async (format) => {
    if (!selectedGoalId) return setError("Please select a goal first.");
    try {
      setExporting(format);
      const { data } = await api.get(`/ai/export/goal-plan/${selectedGoalId}?format=${format}`, { responseType: "blob" });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(data);
      link.download = `goal-plan.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err.response?.data?.error || "Could not export goal plan.");
    } finally {
      setExporting("");
    }
  };

  const feasibilityColor = result
    ? result.feasibility_score >= 80 ? "text-emerald-400"
    : result.feasibility_score >= 60 ? "text-amber-400"
    : "text-rose-400" : "";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Intro */}
      <div className="glass-card p-6 border border-blue-500/15">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 text-xl">⊕</div>
          <div>
            <h2 className="font-display font-bold text-white mb-1">Smart Goal Calculator</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Inflation-adjusts your goal's future value, calculates required monthly savings,
              analyzes your actual spending capacity, and generates a personalized plan with milestones.
            </p>
          </div>
        </div>
      </div>

      {/* Goal Selector */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-4">Select a Goal</h3>
        {goals.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No goals found.{" "}
            <a href="/goals" className="text-amber-400 hover:underline">Create a goal first →</a>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {goals.map(g => (
              <button key={g._id} onClick={() => setSelectedGoalId(g._id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedGoalId === g._id
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-white/8 hover:border-white/15 bg-white/3"
                }`}>
                <div className="text-sm font-semibold text-white mb-1">{g.goal_name}</div>
                <div className="text-xs text-slate-500">{fmt.currency(g.current_price)} · {g.goal_category}</div>
                <div className="text-xs text-slate-600 mt-1">{fmt.date(g.goal_target_date)}</div>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={runAnalysis} disabled={loading || !selectedGoalId}
            className="btn-primary disabled:opacity-50 flex items-center gap-2">
            {loading ? <><Spinner size="sm" /> Calculating plan...</> : "⊕ Generate AI Plan"}
          </button>
          <button onClick={() => handleExport("pdf")} disabled={!selectedGoalId || !!exporting} className="btn-ghost">
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <button onClick={() => handleExport("excel")} disabled={!selectedGoalId || !!exporting} className="btn-ghost">
            {exporting === "excel" ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError("")} />}

      {result && (
        <>
          {/* Main Result */}
          <div className="glass-card p-6 border border-amber-500/15">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-display font-bold text-xl text-white mb-1">{result.goal_name}</h3>
                <p className="text-slate-400 text-sm">{result.summary}</p>
                <div className="mt-4">
                  <div className="text-xs text-slate-600 mb-1">Feasibility Score</div>
                  <div className={`font-display text-3xl font-bold ${feasibilityColor}`}>
                    {result.feasibility_score}/100
                  </div>
                  <div className={`text-sm font-medium mt-0.5 ${feasibilityColor}`}>{result.feasibility_label}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Current Price",     value: fmt.currency(result.future_value?.future_value - result.future_value?.inflation_added) },
                  { label: "Inflation-adjusted",value: fmt.currency(result.future_value?.future_value), accent: true },
                  { label: "Required/Month",    value: fmt.currency(result.required_saving?.required_monthly_saving), accent: true },
                  { label: "You Can Save/Month",value: fmt.currency(result.saving_capacity?.current_savings) },
                ].map(s => (
                  <div key={s.label} className="p-3 bg-white/3 rounded-xl">
                    <div className="text-xs text-slate-600 mb-1">{s.label}</div>
                    <div className={`font-mono font-semibold text-sm ${s.accent ? "text-amber-400" : "text-slate-300"}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ML Insights row — NEW */}
          <div className="grid grid-cols-3 gap-4">
            {result.user_type && (
              <div className={`p-4 rounded-xl border text-center ${
                result.user_type==="Saver"    ? "border-emerald-500/20 bg-emerald-500/8" :
                result.user_type==="Spender"  ? "border-rose-500/20 bg-rose-500/8" :
                                                "border-amber-500/20 bg-amber-500/8"
              }`}>
                <div className="text-xs text-slate-500 mb-1">User Profile</div>
                <div className={`font-display font-bold ${
                  result.user_type==="Saver"?"text-emerald-400":result.user_type==="Spender"?"text-rose-400":"text-amber-400"
                }`}>{result.user_type}</div>
              </div>
            )}
            {result.ml_predicted_saving > 0 && (
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/8 text-center">
                <div className="text-xs text-slate-500 mb-1">ML Saving Prediction</div>
                <div className="font-display font-bold text-blue-400">
                  {fmt.currency(result.ml_predicted_saving)}<span className="text-xs font-normal text-slate-500">/mo</span>
                </div>
              </div>
            )}
            {result.risk_penalty_percent > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/8 text-center">
                <div className="text-xs text-slate-500 mb-1">Risk Penalty</div>
                <div className="font-display font-bold text-rose-400">-{result.risk_penalty_percent}%</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{(result.risk_flags||[]).join(", ")}</div>
              </div>
            )}
          </div>

          {/* Behavior Patterns */}
          {(result.behavior_patterns||[]).length > 0 && (
            <div className="glass-card p-4 border border-amber-500/15">
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <span>⚠️</span>
                <span className="font-semibold">Behavioral Alert:</span>
                <span className="text-slate-400">{result.behavior_patterns.join(", ").replace(/_/g," ")}</span>
              </div>
            </div>
          )}

          {/* Gap Analysis */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4">Gap Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${result.gap_analysis?.is_feasible_now ? "border-emerald-500/20 bg-emerald-500/8" : "border-rose-500/20 bg-rose-500/8"}`}>
                <div className="text-xs text-slate-500 mb-1">Feasible Now?</div>
                <div className={`font-semibold ${result.gap_analysis?.is_feasible_now ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.gap_analysis?.is_feasible_now ? "✓ Yes" : "✗ No"}
                </div>
                {!result.gap_analysis?.is_feasible_now && (
                  <div className="text-xs text-rose-400/70 mt-1">Gap: {fmt.currency(result.gap_analysis?.gap_from_current)}/mo</div>
                )}
              </div>
              <div className={`p-4 rounded-xl border ${result.gap_analysis?.is_feasible_with_cuts ? "border-amber-500/20 bg-amber-500/8" : "border-rose-500/20 bg-rose-500/8"}`}>
                <div className="text-xs text-slate-500 mb-1">With Spending Cuts?</div>
                <div className={`font-semibold ${result.gap_analysis?.is_feasible_with_cuts ? "text-amber-400" : "text-rose-400"}`}>
                  {result.gap_analysis?.is_feasible_with_cuts ? "✓ Yes" : "✗ No"}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-white/8 bg-white/3">
                <div className="text-xs text-slate-500 mb-1">Target Date</div>
                <div className="font-semibold text-white">{result.target_date}</div>
                <div className="text-xs text-slate-500 mt-1">{result.months_remaining} months away</div>
              </div>
            </div>
          </div>

          {/* Optimization Suggestions */}
          {(result.optimization_suggestions || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">🔍 Spending Cuts to Close the Gap</h3>
              <div className="space-y-3">
                {result.optimization_suggestions.map((s, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-white/3 rounded-xl">
                    <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{s.category}</span>
                        <div className="text-right">
                          <span className="text-xs text-slate-500">{fmt.currency(s.current_spend)}</span>
                          <span className="text-slate-600 mx-1">→</span>
                          <span className="text-xs text-emerald-400">{fmt.currency(s.new_budget)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{s.tip}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-amber-400 font-semibold">Save {fmt.currency(s.monthly_saving)}/month</span>
                        <span className="text-slate-600">({s.suggested_cut_percent}% cut)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Plans */}
          {(result.alternative_plans || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">🔄 Alternative Plans</h3>
              <div className="grid grid-cols-2 gap-4">
                {result.alternative_plans.map((plan, i) => (
                  <div key={i} className="p-4 border border-white/8 rounded-xl bg-white/3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={plan.feasibility === "high" ? "active" : "medium"}>{plan.feasibility}</Badge>
                      <span className="text-sm font-semibold text-white">{plan.plan}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {(result.milestones || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">📅 Quarterly Milestones</h3>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-white/8" />
                <div className="space-y-4 pl-12">
                  {result.milestones.map((m, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-7 w-4 h-4 rounded-full border-2 border-amber-500/50 bg-navy-900 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      </div>
                      <div className="p-3 bg-white/3 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{m.milestone} — {m.date}</span>
                          <span className="text-xs text-amber-400 font-semibold">{m.progress_percent}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{m.on_track_check}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}