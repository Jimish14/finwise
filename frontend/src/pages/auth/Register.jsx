import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function Register() {
  const [step, setStep] = useState(1); // 1=account, 2=financial profile
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [profile, setProfile] = useState({
    monthly_income: "", income_type: "fixed",
    risk_profile: "medium", financial_dependents: 0,
    saving_preference_ratio: 20,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally { setLoading(false); }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/financial-profile", profile);
      navigate("/");
    } catch (_) {
      navigate("/"); // profile is optional
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-up relative">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 bg-amber-500 rounded-2xl items-center justify-center text-navy-900 font-display font-bold text-2xl mb-4">₹</div>
          <h1 className="font-display font-bold text-3xl text-white">FinWise</h1>
          <p className="text-slate-500 text-sm mt-1">Step {step} of 2</p>
          <div className="flex gap-1.5 justify-center mt-3">
            {[1,2].map(s => (
              <div key={s} className={`h-1 w-12 rounded-full transition-colors ${s <= step ? "bg-amber-500" : "bg-white/10"}`} />
            ))}
          </div>
        </div>

        <div className="glass-card p-8 border border-white/8">
          {step === 1 ? (
            <>
              <h2 className="font-display font-bold text-xl text-white mb-6">Create Account</h2>
              {error && <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>}
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input type="text" required className="input-field" placeholder="Your name"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" required className="input-field" placeholder="you@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" required minLength={6} className="input-field" placeholder="Min 6 characters"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
                  {loading ? "Creating account..." : "Continue →"}
                </button>
              </form>
              <p className="text-center text-sm text-slate-500 mt-5">
                Already have an account? <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display font-bold text-xl text-white mb-1">Financial Profile</h2>
              <p className="text-slate-500 text-sm mb-6">Help the AI personalize advice for you</p>
              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label className="label">Monthly Income (₹)</label>
                  <input type="number" required className="input-field" placeholder="e.g. 50000"
                    value={profile.monthly_income} onChange={(e) => setProfile({ ...profile, monthly_income: e.target.value })} />
                </div>
                <div>
                  <label className="label">Income Type</label>
                  <select className="input-field" value={profile.income_type}
                    onChange={(e) => setProfile({ ...profile, income_type: e.target.value })}>
                    <option value="fixed">Fixed (Salaried)</option>
                    <option value="variable">Variable</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                <div>
                  <label className="label">Risk Profile</label>
                  <div className="flex gap-2">
                    {["low","medium","high"].map(r => (
                      <button key={r} type="button"
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                          profile.risk_profile === r
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                            : "border-white/8 text-slate-400 hover:border-white/20"
                        }`}
                        onClick={() => setProfile({ ...profile, risk_profile: r })}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Target Savings Rate: {profile.saving_preference_ratio}%</label>
                  <input type="range" min={5} max={50} step={5} className="w-full accent-amber-500"
                    value={profile.saving_preference_ratio}
                    onChange={(e) => setProfile({ ...profile, saving_preference_ratio: Number(e.target.value) })} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
                  {loading ? "Saving..." : "Get Started →"}
                </button>
                <button type="button" onClick={() => navigate("/")} className="w-full text-center text-sm text-slate-600 hover:text-slate-400 transition-colors mt-1">
                  Skip for now
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}