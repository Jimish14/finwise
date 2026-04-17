import { useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import api from "../../api/axios";
import { fmt, Spinner, Alert, Badge } from "../../components/ui/index.jsx";

const SCORE_COLORS = { excellent: "#10b981", good: "#34d399", moderate: "#f59e0b", at_risk: "#fb923c", critical: "#f43f5e" };
const COMPONENT_LABELS = {
  savings_rate: "Savings Rate", expense_control: "Expense Control",
  investment_discipline: "Investment Discipline", emergency_fund: "Emergency Fund",
  debt_load: "Debt Management", goal_progress: "Goal Progress",
};

function ScoreGauge({ score, riskLevel }) {
  const color = SCORE_COLORS[riskLevel] || "#f59e0b";
  const circumference = 2 * Math.PI * 52;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle cx="80" cy="80" r="52" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-4xl font-bold text-white">{score}</div>
        <div className="text-xs text-slate-500 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

export default function HealthGuard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const runAnalysis = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/ai/health-guard");
      if (data.success) setResult(data.data);
      else setError(data.error || "Analysis failed");
    } catch (err) {
      setError(err.response?.data?.error || "Could not connect to AI service.");
    } finally { setLoading(false); }
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const { data } = await api.get(`/ai/export/health?format=${format}`, { responseType: "blob" });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(data);
      link.download = `health-report.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err.response?.data?.error || "Could not export health report.");
    } finally {
      setExporting("");
    }
  };

  const SEVERITY_STYLE = {
    high:   "bg-rose-500/10 border-rose-500/20 text-rose-400",
    medium: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    low:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  };
  const IMPACT_COLORS = { high: "text-rose-400", medium: "text-amber-400", low: "text-blue-400" };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Intro */}
      <div className="glass-card p-6 border border-emerald-500/15">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center text-emerald-400 text-xl">♥</div>
          <div>
            <h2 className="font-display font-bold text-white mb-1">Financial Health Guard</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Analyzes your spending behavior, savings rate, investments, emergency fund, and goals
              to generate a 0–100 health score with personalized risk alerts and advice.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={runAnalysis} disabled={loading}
          className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {loading ? <><Spinner size="sm" /> Running analysis...</> : "♥ Analyze Financial Health"}
        </button>
        <button onClick={() => handleExport("pdf")} disabled={!!exporting} className="btn-ghost">
          {exporting === "pdf" ? "Exporting..." : "Export PDF"}
        </button>
        <button onClick={() => handleExport("excel")} disabled={!!exporting} className="btn-ghost">
          {exporting === "excel" ? "Exporting..." : "Export Excel"}
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError("")} />}

      {result && (
        <>
          {/* Score + Summary */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-8">
              <ScoreGauge score={result.health_score} riskLevel={result.risk_level} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-display text-2xl font-bold text-white">{result.risk_level_label}</h3>
                  <div className="w-3 h-3 rounded-full" style={{ background: SCORE_COLORS[result.risk_level] }} />
                </div>
                <p className="text-slate-400 text-sm mb-4">{result.summary}</p>
                <div className="flex gap-3">
                  <div className="px-4 py-2 bg-white/3 rounded-xl text-xs">
                    <div className="text-slate-600 mb-0.5">Trend</div>
                    <div className={`font-semibold capitalize ${result.trend?.trend === "improving" ? "text-emerald-400" : result.trend?.trend === "worsening" ? "text-rose-400" : "text-amber-400"}`}>
                      {result.trend?.trend || "-"}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white/3 rounded-xl text-xs">
                    <div className="text-slate-600 mb-0.5">Months Analyzed</div>
                    <div className="text-white font-semibold">{result.months_analyzed}</div>
                  </div>
                  <div className="px-4 py-2 bg-white/3 rounded-xl text-xs">
                    <div className="text-slate-600 mb-0.5">Savings Rate</div>
                    <div className="text-white font-semibold">{fmt.pct((result.vitals?.savings_rate || 0) * 100)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Component Scores */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(result.component_scores || {}).map(([key, score]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400">{COMPONENT_LABELS[key] || key}</span>
                    <span className={`font-semibold ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                      {score}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/6 rounded-full">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${score}%`,
                        background: score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e"
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Alerts */}
          {(result.risk_alerts || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">⚠️ Risk Alerts ({result.risk_alerts.length})</h3>
              <div className="space-y-3">
                {result.risk_alerts.map((alert, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${SEVERITY_STYLE[alert.severity]}`}>
                    <div className="flex items-start gap-3">
                      <Badge variant={alert.severity}>{alert.severity}</Badge>
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1">{alert.title}</div>
                        <div className="text-xs opacity-80 mb-2">{alert.description}</div>
                        <div className="text-xs font-medium">→ {alert.action}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advice */}
          {(result.advice || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="section-title mb-4">💡 Personalized Advice</h3>
              <div className="space-y-4">
                {result.advice.map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white/3 rounded-xl">
                    <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center text-amber-400 text-sm font-display font-bold shrink-0">
                      {item.priority}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{item.category}</span>
                        <span className={`text-xs font-medium ${IMPACT_COLORS[item.impact]}`}>● {item.impact} impact</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{item.advice}</p>
                      {item.estimated_benefit && (
                        <p className="text-xs text-emerald-400 mt-1.5 font-medium">📈 {item.estimated_benefit}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vitals Grid */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4">Financial Vitals</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Avg Monthly Income",  value: fmt.currency(result.vitals?.avg_monthly_income) },
                { label: "Avg Monthly Expense", value: fmt.currency(result.vitals?.avg_monthly_expense) },
                { label: "Emergency Fund",       value: `${result.vitals?.emergency_fund_months?.toFixed(1)} months` },
                { label: "Total Invested",       value: fmt.currency(result.vitals?.total_invested) },
              ].map(v => (
                <div key={v.label} className="p-4 bg-white/3 rounded-xl">
                  <div className="text-xs text-slate-600 mb-1">{v.label}</div>
                  <div className="text-slate-200 font-semibold font-mono text-sm">{v.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}