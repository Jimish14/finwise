import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Alert } from "../components/ui/index.jsx";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    monthly_income:          profile?.monthly_income          || "",
    income_type:             profile?.income_type             || "fixed",
    risk_profile:            profile?.risk_profile            || "medium",
    emergency_fund_balance:  profile?.emergency_fund_balance  || "",
    total_savings:           profile?.total_savings           || "",
    investment_balance:      profile?.investment_balance      || "",
    saving_preference_ratio: profile?.saving_preference_ratio || 20,
    financial_dependents:    profile?.financial_dependents    || 0,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/financial-profile", form);
      await refreshProfile();
      setMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Failed to save" });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* User info */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-display font-bold text-2xl text-amber-400">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-white">{user?.name}</h2>
            <p className="text-slate-500 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}

      {/* Financial Profile */}
      <div className="glass-card p-6">
        <h3 className="section-title mb-5">Financial Profile</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monthly Income (₹)</label>
              <input type="number" className="input-field" value={form.monthly_income}
                onChange={e => set("monthly_income", e.target.value)} />
            </div>
            <div>
              <label className="label">Income Type</label>
              <select className="input-field" value={form.income_type} onChange={e => set("income_type", e.target.value)}>
                <option value="fixed">Fixed (Salaried)</option>
                <option value="variable">Variable</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <div>
              <label className="label">Emergency Fund Balance (₹)</label>
              <input type="number" className="input-field" value={form.emergency_fund_balance}
                onChange={e => set("emergency_fund_balance", e.target.value)} />
            </div>
            <div>
              <label className="label">Total Savings (₹)</label>
              <input type="number" className="input-field" value={form.total_savings}
                onChange={e => set("total_savings", e.target.value)} />
            </div>
            <div>
              <label className="label">Investment Balance (₹)</label>
              <input type="number" className="input-field" value={form.investment_balance}
                onChange={e => set("investment_balance", e.target.value)} />
            </div>
            <div>
              <label className="label">Financial Dependents</label>
              <input type="number" min={0} className="input-field" value={form.financial_dependents}
                onChange={e => set("financial_dependents", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Risk Profile</label>
            <div className="flex gap-2">
              {["low","medium","high"].map(r => (
                <button key={r} type="button" onClick={() => set("risk_profile", r)}
                  className={`flex-1 py-3 rounded-xl border text-sm capitalize transition-all ${
                    form.risk_profile === r ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "border-white/8 text-slate-400 hover:border-white/20"
                  }`}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Target Savings Rate: {form.saving_preference_ratio}%</label>
            <input type="range" min={5} max={50} step={5} value={form.saving_preference_ratio}
              onChange={e => set("saving_preference_ratio", Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>5%</span><span>20% (ideal)</span><span>50%</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}