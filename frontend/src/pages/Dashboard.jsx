import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import api from "../api/axios";
import { StatCard, fmt, Badge, PageLoader } from "../components/ui/index.jsx";
import { useAuth } from "../context/AuthContext";

const CATEGORY_COLORS = [
  "#f59e0b","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4","#a78bfa","#34d399"
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-white/10 rounded-xl p-3 shadow-xl text-sm">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {fmt.currency(p.value)}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [overview, setOverview] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/transactions/overview"),
      api.get("/monthly-summary?months=6"),
    ]).then(([ov, ms]) => {
      setOverview(ov.data.data);
      setSummaries(ms.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const chartData = summaries.map((s) => ({
    month: s.month.slice(5),
    Income: s.total_income,
    Expense: s.total_expense,
    Savings: Math.max(0, s.total_savings),
  }));

  const pieData = (overview?.categoryBreakdown || []).map((c, i) => ({
    name: c._id, value: c.total, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? "morning" : "evening"}, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="text-slate-500 text-sm mt-1">Here's your financial snapshot for this month</p>
        </div>
        <Link to="/transactions" className="btn-primary">+ Add Transaction</Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard label="Income" value={fmt.currency(overview?.totalIncome)} icon="↑" accent="emerald"
          sub="This month" />
        <StatCard label="Expenses" value={fmt.currency(overview?.totalExpense)} icon="↓" accent="rose"
          sub="This month" />
        <StatCard label="Net Savings" value={fmt.currency(overview?.netSavings)} icon="◈" accent="amber"
          sub={`${overview?.savingsRate}% savings rate`} />
        <StatCard label="Monthly Income" value={fmt.currency(profile?.monthly_income)} icon="⊕" accent="blue"
          sub={profile?.income_type || "Not set"} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Area Chart */}
        <div className="col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Income vs Expenses</h3>
            <span className="text-xs text-slate-600">Last 6 months</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2}
                  fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="Expense" stroke="#f43f5e" strokeWidth={2}
                  fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-600 text-sm">
              Add transactions to see your trend
            </div>
          )}
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="section-title mb-5">Category Split</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.slice(0, 4).map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-slate-400">{d.name}</span>
                    </div>
                    <span className="text-xs text-slate-300 font-mono">{fmt.currency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No expenses yet</div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title">Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            View all →
          </Link>
        </div>
        {(overview?.recentTransactions || []).length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">
            No transactions yet.{" "}
            <Link to="/transactions" className="text-amber-400 hover:underline">Add your first one →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(overview?.recentTransactions || []).map((txn) => (
              <div key={txn._id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/3 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm
                  ${txn.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {txn.type === "income" ? "↑" : "↓"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{txn.title}</p>
                  <p className="text-xs text-slate-500">{txn.category} · {fmt.shortDate(txn.date)}</p>
                </div>
                <span className={`font-mono font-semibold text-sm ${txn.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {txn.type === "income" ? "+" : "-"}{fmt.currency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Feature Cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { path: "/ai/predictor",    icon: "◉", label: "Expense Predictor", desc: "AI-powered forecast of next month's spending", color: "amber" },
          { path: "/ai/health-guard", icon: "♥", label: "Health Guard",       desc: "Get your financial health score & personalized advice", color: "emerald" },
          { path: "/ai/goal-calc",    icon: "⊕", label: "Goal Calculator",    desc: "Smart plan to reach your financial goals", color: "blue" },
        ].map((item) => (
          <Link key={item.path} to={item.path}
            className="glass-card-hover p-5 group cursor-pointer border border-white/5">
            <div className={`text-2xl mb-3 ${item.color === "amber" ? "text-amber-400" : item.color === "emerald" ? "text-emerald-400" : "text-blue-400"}`}>
              {item.icon}
            </div>
            <h4 className="font-display font-semibold text-white mb-1">{item.label}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            <div className="mt-3 text-xs text-amber-400 group-hover:translate-x-1 transition-transform duration-200">
              Try now →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}