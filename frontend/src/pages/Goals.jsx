import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { Modal, Badge, fmt, EmptyState, Spinner } from "../components/ui/index.jsx";

const EMPTY = {
  goal_name:"", goal_category:"vehicle", current_price:"", expected_inflation_rate:6,
  existing_allocation:0, goal_start_date: new Date().toISOString().split("T")[0],
  goal_target_date:"", priority_level:"medium", auto_adjust_inflation:true,
};

function GoalForm({ initial = EMPTY, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Goal Name</label>
          <input className="input-field" placeholder="e.g. Buy a Royal Enfield"
            value={form.goal_name} onChange={e => set("goal_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input-field" value={form.goal_category} onChange={e => set("goal_category", e.target.value)}>
            {["vehicle","gadget","travel","investment","education","other"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Current Price (₹)</label>
          <input type="number" className="input-field" placeholder="200000"
            value={form.current_price} onChange={e => set("current_price", e.target.value)} />
        </div>
        <div>
          <label className="label">Already Saved (₹)</label>
          <input type="number" className="input-field" placeholder="0"
            value={form.existing_allocation} onChange={e => set("existing_allocation", e.target.value)} />
        </div>
        <div>
          <label className="label">Inflation Rate (%)</label>
          <input type="number" className="input-field" placeholder="6"
            value={form.expected_inflation_rate} onChange={e => set("expected_inflation_rate", e.target.value)} />
        </div>
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input-field" value={form.goal_start_date}
            onChange={e => set("goal_start_date", e.target.value)} />
        </div>
        <div>
          <label className="label">Target Date</label>
          <input type="date" className="input-field" value={form.goal_target_date}
            onChange={e => set("goal_target_date", e.target.value)} />
        </div>
        <div>
          <label className="label">Priority</label>
          <div className="flex gap-2">
            {["low","medium","high"].map(p => (
              <button key={p} type="button" onClick={() => set("priority_level", p)}
                className={`flex-1 py-2.5 rounded-xl border text-sm capitalize transition-all ${
                  form.priority_level === p ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "border-white/8 text-slate-400 hover:border-white/20"
                }`}>{p}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Saving..." : "Save Goal"}
        </button>
      </div>
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete }) {
  const progress = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.goal_target_date) - new Date()) / (1000 * 86400)));

  return (
    <div className="glass-card-hover p-5 border border-white/5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-display font-semibold text-white">{goal.goal_name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-lg bg-white/5 text-slate-400 capitalize">{goal.goal_category}</span>
            <Badge variant={goal.priority_level}>{goal.priority_level}</Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">Edit</button>
          <button onClick={onDelete} className="btn-danger text-xs px-2 py-1.5">Del</button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span className="text-slate-300">{fmt.currency(goal.current_amount)} / {fmt.currency(goal.target_amount || goal.current_price)}</span>
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-amber-400 font-semibold">{progress.toFixed(0)}% complete</span>
          <span className="text-slate-500">{daysLeft} days left</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-slate-600 mb-0.5">Target</div>
          <div className="text-slate-300 font-mono">{fmt.currency(goal.target_amount || goal.current_price)}</div>
        </div>
        <div>
          <div className="text-slate-600 mb-0.5">Deadline</div>
          <div className="text-slate-300">{fmt.date(goal.goal_target_date)}</div>
        </div>
      </div>

      <Link to={`/ai/goal-calc?goalId=${goal._id}`}
        className="block mt-4 text-center text-xs py-2 rounded-xl bg-amber-500/8 border border-amber-500/15 text-amber-400 hover:bg-amber-500/15 transition-colors">
        Get AI Plan →
      </Link>
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: "create", data: null });
  const [deleteId, setDeleteId] = useState(null);

  const fetchGoals = async () => {
    setLoading(true);
    try { const { data } = await api.get("/goals"); setGoals(data.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGoals(); }, []);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, current_price: Number(form.current_price), existing_allocation: Number(form.existing_allocation) };
      if (modal.mode === "create") await api.post("/goals", payload);
      else await api.put(`/goals/${modal.data._id}`, payload);
      setModal({ open: false, mode: "create", data: null });
      fetchGoals();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/goals/${deleteId}`);
    setDeleteId(null); fetchGoals();
  };

  const activeGoals = goals.filter(g => g.status === "active");
  const totalTarget = activeGoals.reduce((s, g) => s + (g.target_amount || g.current_price), 0);
  const totalSaved  = activeGoals.reduce((s, g) => s + (g.current_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-card px-5 py-3">
            <div className="text-xs text-slate-500 mb-1">Active Goals</div>
            <div className="font-display font-bold text-white">{activeGoals.length}</div>
          </div>
          <div className="glass-card px-5 py-3">
            <div className="text-xs text-slate-500 mb-1">Total Target</div>
            <div className="font-display font-bold text-white">{fmt.currency(totalTarget)}</div>
          </div>
          <div className="glass-card px-5 py-3">
            <div className="text-xs text-slate-500 mb-1">Total Saved</div>
            <div className="font-display font-bold text-amber-400">{fmt.currency(totalSaved)}</div>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">
          + New Goal
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : goals.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon="◎" title="No goals set"
            description="Define financial goals and let AI create a savings plan for you"
            action={<button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">Create First Goal</button>} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {goals.map(g => (
            <GoalCard key={g._id} goal={g}
              onEdit={() => setModal({ open: true, mode: "edit", data: g })}
              onDelete={() => setDeleteId(g._id)} />
          ))}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false, mode: "create", data: null })}
        title={modal.mode === "create" ? "New Goal" : "Edit Goal"} size="md">
        <GoalForm
          initial={modal.data ? { ...EMPTY, ...modal.data,
            goal_start_date: modal.data.goal_start_date?.split("T")[0] || EMPTY.goal_start_date,
            goal_target_date: modal.data.goal_target_date?.split("T")[0] || "",
          } : EMPTY}
          onSave={handleSave} onCancel={() => setModal({ open: false, mode: "create", data: null })} loading={saving} />
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Goal" size="sm">
        <p className="text-slate-400 mb-5">Are you sure you want to delete this goal?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}