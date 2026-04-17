import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import api from "../../api/axios";
import { fmt, Spinner, Alert } from "../../components/ui/index.jsx";

// ── Custom tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2234] border border-white/10 rounded-xl p-3 shadow-xl text-sm">
      <p className="text-slate-400 mb-1 text-xs">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold font-mono" style={{ color: p.fill || p.color || "#f59e0b" }}>
          {fmt.currency(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Confidence gauge ───────────────────────────────────────────────────────
function ConfGauge({ score = 0, label = "—" }) {
  const color = score >= 0.75 ? "#10b981" : score >= 0.5 ? "#f59e0b" : "#f43f5e";
  const r = 40, circ = 2 * Math.PI * r;
  const dash = Math.min(score, 1) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}/>
      </svg>
      <div className="absolute text-center">
        <div className="font-display font-bold text-xl text-white">{Math.round(Math.min(score,1)*100)}%</div>
        <div className="text-[10px] text-slate-500 capitalize">{label}</div>
      </div>
    </div>
  );
}

// ── Data status badge ──────────────────────────────────────────────────────
function DataBadge({ debug }) {
  if (!debug) return null;
  const { summaries_used, transactions_used, data_source, has_profile } = debug;
  const colors = {
    monthly_summary:            "text-emerald-400 border-emerald-500/20 bg-emerald-500/8",
    synthetic_from_transactions:"text-amber-400 border-amber-500/20 bg-amber-500/8",
    income_fallback:            "text-rose-400 border-rose-500/20 bg-rose-500/8",
  };
  const labels = {
    monthly_summary:            "Using monthly history",
    synthetic_from_transactions:"Built from transactions",
    income_fallback:            "Estimated from income",
  };
  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold ${colors[data_source] || "text-slate-400 border-white/10"}`}>
        {labels[data_source] || data_source}
      </span>
      <span className="text-[10px] text-slate-600">{summaries_used} summaries · {transactions_used} transactions · {has_profile ? "profile ✓" : "no profile"}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AIPredictor() {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [events,  setEvents]  = useState("");
  const [history, setHistory] = useState([]);

  // Load monthly summaries for the area chart
  useEffect(() => {
    api.get("/monthly-summary?months=6").then(r => {
      if (r.data?.data) setHistory(r.data.data);
    }).catch(() => {});
  }, []);

  const runPrediction = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data } = await api.post("/ai/predict-expense", {
        upcoming_events: events
          ? events.split(",").map(e => e.trim()).filter(Boolean)
          : [],
      });
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Prediction failed. Check that your AI service is running.");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Network error";
      setError(msg.includes("ECONNREFUSED") || msg.includes("connect")
        ? "Cannot connect to AI service. Make sure `python app.py` is running in the ai_service folder."
        : msg
      );
    } finally {
      setLoading(false);
    }
  };

  // Bar chart data
  const barData = result ? [
    { name: "Hist. Avg",    value: result.historical_average || 0, fill: "#334155" },
    { name: "Last Month",   value: result.last_month_expense  || 0, fill: "#475569" },
    { name: "Base",         value: result.base_prediction     || 0, fill: "#64748b" },
    { name: "Predicted ✦", value: result.predicted_amount    || 0, fill: "#f59e0b" },
  ] : [];

  // Area chart from history
  const areaData = history.map(s => ({
    month:   s.month,
    Expense: s.total_expense,
    Income:  s.total_income,
  }));

  const seg       = result?.user_segment || "unknown";
  const segStyles = {
    saver:    { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Saver",    desc: "You spend < 60% of income" },
    balanced: { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   label: "Balanced", desc: "Healthy income/expense ratio" },
    spender:  { color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",     label: "Spender",  desc: "Expenses > 90% of income" },
    unknown:  { color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",   label: "Unknown",  desc: "Not enough data" },
  };
  const segInfo = segStyles[seg] || segStyles.unknown;

  return (
    <div className="max-w-5xl space-y-6">

      {/* ── Intro card ── */}
      <div className="glass-card p-6 border border-amber-500/15">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center text-amber-400 text-xl shrink-0">◉</div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-white mb-1">AI Expense Predictor</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Uses <strong className="text-slate-300">Prophet + XGBoost + Trend</strong> ensemble with NLP event detection,
              salary intelligence, festival boosts, lifestyle change detection and recurring subscription analysis.
            </p>
            {/* How it works steps */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {["1. Fetch your history","2. Run 3 AI models","3. Apply multipliers","4. Return prediction"].map((s,i) => (
                <div key={i} className="text-[10px] px-2.5 py-1 bg-white/5 rounded-lg text-slate-500 border border-white/8">
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── History chart (pre-loaded) ── */}
      {areaData.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Your Last {areaData.length} Months</h3>
            <span className="text-xs text-slate-600">Income vs Expense</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={areaData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false}
                tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="Income"  stroke="#10b981" strokeWidth={2} fill="url(#gInc)"/>
              <Area type="monotone" dataKey="Expense" stroke="#f43f5e" strokeWidth={2} fill="url(#gExp)"/>
            </AreaChart>
          </ResponsiveContainer>
          {areaData.length < 2 && (
            <p className="text-xs text-amber-400 mt-2 text-center">
              ⚠️ Add more transactions across different months to improve prediction accuracy.
            </p>
          )}
        </div>
      )}

      {/* ── Empty state if no history ── */}
      {areaData.length === 0 && !loading && (
        <div className="glass-card p-6 border border-amber-500/15 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-slate-300 font-semibold mb-1">No transaction history yet</p>
          <p className="text-slate-500 text-sm mb-4">
            Add at least 2 months of income &amp; expense transactions to get an accurate prediction.<br/>
            The AI will still estimate based on your financial profile.
          </p>
        </div>
      )}

      {/* ── Config & Run ── */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-4">Run Prediction</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Upcoming Events <span className="normal-case text-slate-600 font-normal">(optional, comma separated)</span></label>
            <input
              className="input-field"
              placeholder="e.g. trip to goa, brother wedding, new laptop"
              value={events}
              onChange={e => setEvents(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && runPrediction()}
            />
            <p className="text-xs text-slate-600 mt-1">
              NLP classifier detects event type → applies boost: wedding ×1.30, travel ×1.15, medical ×1.12
            </p>
          </div>
          <button
            onClick={runPrediction}
            disabled={loading}
            className="btn-primary disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            {loading
              ? <><Spinner size="sm"/> Analyzing with AI — please wait…</>
              : "◉ Predict Next Month's Expenses"
            }
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <Alert type="error" message={error} onClose={() => setError("")}
          title="Prediction Failed" />
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="glass-card p-6">
              <div className="skeleton h-4 w-32 rounded mb-3"/>
              <div className="skeleton h-10 w-48 rounded mb-2"/>
              <div className="skeleton h-3 w-full rounded"/>
            </div>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="space-y-5 animate-fade-up">

          {/* Main prediction + confidence */}
          <div className="grid grid-cols-3 gap-5">

            {/* Big prediction number */}
            <div className="col-span-2 glass-card p-6 border border-amber-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 uppercase tracking-widest">Predicted for</span>
                <span className="font-mono text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  {result.next_month}
                </span>
              </div>

              <div className="flex items-end gap-3 mb-4">
                <span className="font-display text-5xl font-bold text-amber-400">
                  {fmt.currency(result.predicted_amount)}
                </span>
                <span className="text-slate-500 text-sm pb-2">
                  {result.months_analyzed} months analyzed
                </span>
              </div>

              {/* 3 stat tiles */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: "Base (models)",     value: fmt.currency(result.base_prediction),  color:"text-slate-300" },
                  { label: "After multipliers", value: fmt.currency(result.adjusted_amount),  color:"text-slate-300" },
                  { label: "+ Subscriptions",   value: fmt.currency(result.fixed_expense),    color:"text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="p-3 bg-white/3 rounded-xl">
                    <div className="text-[10px] text-slate-600 mb-1">{s.label}</div>
                    <div className={`font-mono font-semibold text-sm ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Prediction range */}
              {result.prediction_range && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Confidence Range</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Low: <span className="text-emerald-400 font-mono">{fmt.currency(result.prediction_range.min)}</span></span>
                    <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/50 via-amber-500/70 to-rose-500/50 rounded-full"/>
                    </div>
                    <span className="text-xs text-slate-400">High: <span className="text-rose-400 font-mono">{fmt.currency(result.prediction_range.max)}</span></span>
                  </div>
                </div>
              )}

              {/* Models used + data source */}
              {result.models_used && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-600">Models:</span>
                  {result.models_used.map(m => (
                    <span key={m} className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/15 font-semibold">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              <DataBadge debug={result._debug}/>
            </div>

            {/* Confidence + segment */}
            <div className="glass-card p-5 flex flex-col items-center gap-3">
              <ConfGauge score={result.confidence_score || 0} label={result.confidence}/>
              <div className="text-xs text-slate-500">AI Confidence</div>

              {result.backtest_error != null && (
                <div className="text-center">
                  <div className="text-[10px] text-slate-600 mb-0.5">Backtest Error</div>
                  <div className="font-mono text-sm text-slate-300">
                    {(result.backtest_error * 100).toFixed(1)}%
                  </div>
                </div>
              )}

              <div className={`w-full text-center p-3 rounded-xl border ${segInfo.bg}`}>
                <div className={`font-display font-bold text-sm ${segInfo.color}`}>{segInfo.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{segInfo.desc}</div>
              </div>
            </div>
          </div>

          {/* Comparison bar chart */}
          {barData.some(d => d.value > 0) && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-5">Prediction vs History</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barSize={52}>
                  <XAxis dataKey="name" tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}
                    tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                  <Tooltip content={<CustomTooltip/>} cursor={{ fill:"rgba(255,255,255,0.03)" }}/>
                  {barData.map((d,i) => (
                    <Bar key={i} dataKey="value" fill={d.fill} radius={[8,8,0,0]}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Adjustments */}
          {Object.keys(result.adjustments || {}).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">Multipliers Applied</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(result.adjustments).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5">
                    <span className="text-sm text-slate-400 capitalize">{key.replace(/_/g," ")}</span>
                    <span className={`font-mono text-sm font-bold ml-2 shrink-0 ${
                      Number(val) > 1 ? "text-rose-400" : Number(val) < 1 ? "text-emerald-400" : "text-slate-500"
                    }`}>
                      ×{val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          {(result.explanation || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">Why this prediction?</h3>
              <div className="space-y-2">
                {result.explanation.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/3 rounded-xl">
                    <div className="w-5 h-5 bg-amber-500/15 rounded-full flex items-center justify-center text-amber-400 text-xs shrink-0 mt-0.5 font-bold">
                      {i+1}
                    </div>
                    <p className="text-sm text-slate-300">{e}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {result.category_breakdown?.category_predictions && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">Category-wise Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(result.category_breakdown.category_predictions)
                  .sort((a,b) => b[1]-a[1])
                  .map(([cat, val]) => {
                    const total = result.category_breakdown.total_from_categories || 1;
                    const pct   = Math.round((val/total)*100);
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-slate-400">{cat}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600">{pct}%</span>
                            <span className="text-slate-300 font-mono">{fmt.currency(val)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/6 rounded-full">
                          <div className="h-full bg-amber-500/60 rounded-full transition-all duration-700" style={{ width:`${pct}%` }}/>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 pt-3 border-t border-white/6 flex justify-between text-sm">
                <span className="text-slate-500">Total from categories</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {fmt.currency(result.category_breakdown.total_from_categories)}
                </span>
              </div>
            </div>
          )}

          {/* Run again */}
          <div className="flex justify-center pt-2">
            <button onClick={runPrediction} disabled={loading}
              className="btn-ghost flex items-center gap-2">
              🔄 Re-run Prediction
            </button>
          </div>

        </div>
      )}
    </div>
  );
}