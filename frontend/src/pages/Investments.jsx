import { useState, useEffect } from "react";
import api from "../api/axios.js";
import { Modal, Badge, fmt, EmptyState, Spinner } from "../components/ui/index.jsx";

const EMPTY = {
  name:"", investment_type:"SIP", amount_invested:"", current_value:"",
  monthly_contribution:0, expected_return_rate:"", liquidity_type:"semi-liquid",
  risk_level:"medium", investment_frequency:"monthly",
  investment_start_date: new Date().toISOString().split("T")[0], notes:"",
};

const TYPE_COLORS = { SIP:"emerald", Stocks:"blue", FD:"amber", "Mutual Funds":"purple", Crypto:"rose", PPF:"green", Other:"slate" };

function InvestmentForm({ initial = EMPTY, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pnl = (Number(form.current_value) || Number(form.amount_invested)) - Number(form.amount_invested);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Investment Name</label>
          <input className="input-field" placeholder="e.g. Zerodha NIFTY 50 SIP"
            value={form.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input-field" value={form.investment_type} onChange={e => set("investment_type", e.target.value)}>
            {["SIP","Stocks","FD","Mutual Funds","Crypto","PPF","Other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Frequency</label>
          <select className="input-field" value={form.investment_frequency} onChange={e => set("investment_frequency", e.target.value)}>
            {["one-time","monthly","weekly","yearly"].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount Invested (₹)</label>
          <input type="number" className="input-field" placeholder="10000"
            value={form.amount_invested} onChange={e => set("amount_invested", e.target.value)} />
        </div>
        <div>
          <label className="label">Current Value (₹)</label>
          <input type="number" className="input-field" placeholder="10500"
            value={form.current_value} onChange={e => set("current_value", e.target.value)} />
        </div>
        <div>
          <label className="label">Monthly Contribution (₹)</label>
          <input type="number" className="input-field" placeholder="2000"
            value={form.monthly_contribution} onChange={e => set("monthly_contribution", e.target.value)} />
        </div>
        <div>
          <label className="label">Expected Return (%)</label>
          <input type="number" className="input-field" placeholder="12"
            value={form.expected_return_rate} onChange={e => set("expected_return_rate", e.target.value)} />
        </div>
        <div>
          <label className="label">Risk Level</label>
          <div className="flex gap-2">
            {["low","medium","high"].map(r => (
              <button key={r} type="button" onClick={() => set("risk_level", r)}
                className={`flex-1 py-2.5 rounded-xl border text-sm capitalize transition-all ${
                  form.risk_level === r ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "border-white/8 text-slate-400 hover:border-white/20"
                }`}>{r}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Liquidity</label>
          <select className="input-field" value={form.liquidity_type} onChange={e => set("liquidity_type", e.target.value)}>
            <option value="liquid">Liquid</option>
            <option value="semi-liquid">Semi-Liquid</option>
            <option value="locked">Locked</option>
          </select>
        </div>
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input-field" value={form.investment_start_date}
            onChange={e => set("investment_start_date", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Saving..." : "Save Investment"}
        </button>
      </div>
    </div>
  );
}

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: "create", data: null });
  const [deleteId, setDeleteId] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/investments");
      setInvestments(data.data); setSummary(data.summary || {});
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const p = { ...form, amount_invested: Number(form.amount_invested), current_value: Number(form.current_value) || Number(form.amount_invested), monthly_contribution: Number(form.monthly_contribution), expected_return_rate: Number(form.expected_return_rate) };
      if (modal.mode === "create") await api.post("/investments", p);
      else await api.put(`/investments/${modal.data._id}`, p);
      setModal({ open: false }); fetch();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          {[
            { label: "Invested",   value: fmt.currency(summary.totalInvested) },
            { label: "Current",    value: fmt.currency(summary.totalValue) },
            { label: "Gain/Loss",  value: fmt.currency(summary.gainLoss), colored: true },
            { label: "Monthly SIP",value: fmt.currency(summary.totalMonthly) },
          ].map(s => (
            <div key={s.label} className="glass-card px-5 py-3">
              <div className="text-xs text-slate-500 mb-1">{s.label}</div>
              <div className={`font-display font-bold ${s.colored ? (summary.gainLoss >= 0 ? "text-emerald-400" : "text-rose-400") : "text-white"}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">
          + Add Investment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : investments.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon="◈" title="No investments tracked"
            description="Add your SIPs, stocks, FDs and other investments to see your portfolio"
            action={<button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">Add Investment</button>} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {investments.map((inv) => {
            const pnl = (inv.current_value || inv.amount_invested) - inv.amount_invested;
            const pnlPct = inv.amount_invested > 0 ? (pnl / inv.amount_invested * 100) : 0;
            return (
              <div key={inv._id} className="glass-card-hover p-5 border border-white/5 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-lg font-medium">{inv.investment_type}</span>
                      <Badge variant={inv.risk_level}>{inv.risk_level} risk</Badge>
                    </div>
                    <h4 className="font-display font-semibold text-white">{inv.name}</h4>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ open: true, mode: "edit", data: inv })}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => setDeleteId(inv._id)} className="btn-danger text-xs px-2 py-1.5">Del</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-slate-600 mb-1">Invested</div>
                    <div className="font-mono text-slate-300">{fmt.currency(inv.amount_invested)}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 mb-1">Current</div>
                    <div className="font-mono text-slate-300">{fmt.currency(inv.current_value || inv.amount_invested)}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 mb-1">Return</div>
                    <div className={`font-mono font-semibold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {inv.monthly_contribution > 0 && (
                  <div className="mt-3 text-xs text-slate-600">
                    Monthly: <span className="text-slate-400">{fmt.currency(inv.monthly_contribution)}</span>
                    {inv.expected_return_rate > 0 && <> · Expected: <span className="text-amber-400">{inv.expected_return_rate}% p.a.</span></>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })}
        title={modal.mode === "create" ? "Add Investment" : "Edit Investment"} size="lg">
        <InvestmentForm
          initial={modal.data ? { ...EMPTY, ...modal.data, investment_start_date: modal.data.investment_start_date?.split("T")[0] || EMPTY.investment_start_date } : EMPTY}
          onSave={handleSave} onCancel={() => setModal({ open: false })} loading={saving} />
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Investment" size="sm">
        <p className="text-slate-400 mb-5">Remove this investment from tracking?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost">Cancel</button>
          <button onClick={async () => { await api.delete(`/investments/${deleteId}`); setDeleteId(null); fetch(); }} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}