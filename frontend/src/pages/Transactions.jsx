import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { Modal, Badge, fmt, EmptyState, Spinner } from "../components/ui/index.jsx";

const CATEGORIES = ["Food","Transport","Shopping","Bills","Entertainment","Health","Education","Investment","Rent","Transfer","Salary","Travel","Miscellaneous"];
const EMPTY_FORM = {
  title:"", amount:"", type:"expense", category:"", description:"", merchant_name:"",
  date: new Date().toISOString().split("T")[0], payment_method:"Cash", mode:"offline",
  essential_flag:"essential", is_recurring:false, recurring_frequency:null,
};

function TransactionForm({ initial = EMPTY_FORM, onSave, onCancel, loading, enableVoiceAutoAdd = false }) {
  const [form, setForm] = useState(initial);
  const [autoCatLoading, setAutoCatLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoCategory = async () => {
    if (!form.title && !form.merchant_name) return;
    setAutoCatLoading(true);
    try {
      const { data } = await api.post("/ai/categorize", {
        description: form.title, merchant_name: form.merchant_name, amount: Number(form.amount)
      });
      if (data?.data?.category) set("category", data.data.category);
    } catch (_) {}
    setAutoCatLoading(false);
  };

  const normalizeText = (text) =>
    (text || "")
      .replace(/\binner\b/gi, "dinner")
      .replace(/\bpetrol pump\b/gi, "fuel")
      .trim();

  const parseVoiceTransaction = (transcript, confidence = 0) => {
    const clean = normalizeText(transcript);
    const lower = clean.toLowerCase();
    const amountMatch = clean.match(/(?:₹|rs\.?\s*)?\s*(\d+(?:[,\d]*)(?:\.\d+)?)/i);
    const detectedAmount = amountMatch ? Number(String(amountMatch[1]).replace(/,/g, "")) : "";

    const detectedType =
      lower.includes("income") || lower.includes("salary") || lower.includes("credited")
        ? "income"
        : "expense";
    const detectedPaymentMethod = lower.includes("card")
      ? "Card"
      : lower.includes("upi")
      ? "UPI"
      : lower.includes("netbanking") || lower.includes("bank transfer")
      ? "NetBanking"
      : lower.includes("wallet")
      ? "Wallet"
      : "Cash";
    const detectedMode = detectedPaymentMethod === "Cash" ? "offline" : "online";
    const inferredCategory = lower.includes("fuel") || lower.includes("petrol") || lower.includes("diesel") || lower.includes("car")
      ? "Transport"
      : lower.includes("dinner") || lower.includes("lunch") || lower.includes("breakfast") || lower.includes("food")
      ? "Food"
      : "";
    const detectedCategory = CATEGORIES.find((c) => lower.includes(c.toLowerCase())) || inferredCategory;

    const titleFromSpeech =
      lower.includes("fuel") || lower.includes("petrol") || lower.includes("diesel")
        ? "Fuel expense"
        : lower.includes("dinner")
        ? "Dinner"
        : clean.split(" ").slice(0, 4).join(" ");

    return {
      voiceTransaction: {
        ...form,
        title: titleFromSpeech || clean,
        description: clean,
        amount: detectedAmount || form.amount,
        type: detectedType,
        category: detectedCategory || form.category || "Miscellaneous",
        payment_method: detectedPaymentMethod,
        mode: detectedMode,
      },
      qualityGood: confidence >= 0.55 && Boolean(detectedAmount),
      clean,
    };
  };

  const handleVoiceFill = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setVoiceHint("Listening... speak full sentence, then pause.");
    };
    recognition.onend = () => {
      setListening(false);
      setTimeout(() => setVoiceHint(""), 2500);
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceHint("Could not catch that clearly. Please try again closer to mic.");
    };
    recognition.onresult = (event) => {
      const finalResult = Array.from(event.results).find((r) => r.isFinal);
      if (!finalResult) return;

      // Pick the most reliable alternative: prioritize amount detection, then confidence.
      let best = null;
      for (const alt of Array.from(finalResult)) {
        const parsed = parseVoiceTransaction(alt.transcript, alt.confidence || 0);
        const hasAmount = Boolean(parsed.voiceTransaction.amount);
        if (!best) {
          best = { ...parsed, confidence: alt.confidence || 0, hasAmount };
          continue;
        }
        if (hasAmount && !best.hasAmount) {
          best = { ...parsed, confidence: alt.confidence || 0, hasAmount };
        } else if (hasAmount === best.hasAmount && (alt.confidence || 0) > best.confidence) {
          best = { ...parsed, confidence: alt.confidence || 0, hasAmount };
        }
      }

      if (!best) return;
      const { voiceTransaction, qualityGood, clean, confidence } = best;

      setForm(voiceTransaction);
      setVoiceHint(`Heard: "${clean}" (${Math.round((confidence || 0) * 100)}% confidence)`);

      // Auto-save only when speech quality and amount extraction are reliable.
      if (enableVoiceAutoAdd && qualityGood) {
        onSave(voiceTransaction);
      } else if (!voiceTransaction.amount) {
        setVoiceHint('Could not detect amount. Example: "dinner 250 cash".');
      } else {
        setVoiceHint('Captured with low confidence. Review once, then press "Save Transaction".');
      }
    };
    recognition.start();
  };

  return (
    <div className="space-y-4">

      {/* ── Row 1: Title (full width) ── */}
      <div>
        <label className="label">Title *</label>
        <div className="relative flex gap-2">
          <input
            className="input-field pr-10"
            placeholder="e.g. Swiggy lunch order"
            value={form.title}
            onChange={e => set("title", e.target.value)}
            onBlur={autoCategory}
          />
          <button
            type="button"
            onClick={handleVoiceFill}
            className={`px-3 rounded-xl border text-xs ${listening ? "border-rose-400 text-rose-300" : "border-white/10 text-slate-300 hover:border-white/20"}`}
          >
            {listening ? "Listening..." : "Voice"}
          </button>
          {autoCatLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
        {autoCatLoading && (
          <p className="text-xs text-amber-400 mt-1">⚡ AI is auto-detecting category...</p>
        )}
        {voiceHint && (
          <p className="text-xs text-slate-400 mt-1">{voiceHint}</p>
        )}
      </div>

      {/* ── Row 2: Amount + Type ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount (₹) *</label>
          <input
            type="number" className="input-field" placeholder="0.00"
            value={form.amount} onChange={e => set("amount", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type *</label>
          <div className="flex gap-2 h-[46px]">
            {["income","expense"].map(t => (
              <button key={t} type="button" onClick={() => set("type", t)}
                className={`flex-1 rounded-xl border text-sm font-medium capitalize transition-all ${
                  form.type === t
                    ? t === "income"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-400"
                    : "border-white/8 text-slate-400 hover:border-white/20"
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Category + Date ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Category *</label>
          <select className="input-field" value={form.category} onChange={e => set("category", e.target.value)}>
            <option value="">Select category...</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input-field" value={form.date}
            onChange={e => set("date", e.target.value)} />
        </div>
      </div>

      {/* ── Row 4: Merchant + Payment Method ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Merchant / Payee</label>
          <input className="input-field" placeholder="e.g. Swiggy"
            value={form.merchant_name} onChange={e => set("merchant_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="input-field" value={form.payment_method}
            onChange={e => set("payment_method", e.target.value)}>
            {["UPI","Card","Cash","NetBanking","Wallet"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* ── Row 5: Essential + Mode ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Essential?</label>
          <select className="input-field" value={form.essential_flag}
            onChange={e => set("essential_flag", e.target.value)}>
            <option value="essential">Essential</option>
            <option value="non-essential">Non-Essential</option>
          </select>
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input-field" value={form.mode}
            onChange={e => set("mode", e.target.value)}>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* ── Row 6: Notes ── */}
      <div>
        <label className="label">Notes</label>
        <input className="input-field" placeholder="Optional note..."
          value={form.description} onChange={e => set("description", e.target.value)} />
      </div>

      {/* ── Row 7: Recurring ── */}
      <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
        <input type="checkbox" id="recurring" checked={form.is_recurring}
          onChange={e => set("is_recurring", e.target.checked)}
          className="w-4 h-4 accent-amber-500 cursor-pointer" />
        <label htmlFor="recurring" className="text-sm text-slate-400 cursor-pointer flex-1">
          Recurring transaction
        </label>
        {form.is_recurring && (
          <select className="input-field w-36" value={form.recurring_frequency || "monthly"}
            onChange={e => set("recurring_frequency", e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
            <option value="daily">Daily</option>
          </select>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button
          onClick={() => onSave(form)}
          disabled={loading || !form.title || !form.amount}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Transaction"}
        </button>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: "create", data: null });
  const [filters, setFilters] = useState({ type: "", category: "", page: 1 });
  const [deleteId, setDeleteId] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 15, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const { data } = await api.get(`/transactions?${params}`);
      setTransactions(data.data);
      setPagination(data.pagination);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal.mode === "create") {
        await api.post("/transactions", { ...form, amount: Number(form.amount) });
      } else {
        await api.put(`/transactions/${modal.data._id}`, { ...form, amount: Number(form.amount) });
      }
      setModal({ open: false, mode: "create", data: null });
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/transactions/${deleteId}`);
    setDeleteId(null);
    fetchTransactions();
  };

  const downloadBlob = (blob, filename) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const handleExportTransactions = async (format) => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });
      const res = await api.get(`/transactions/export?${params.toString()}`, {
        responseType: "blob",
      });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      downloadBlob(res.data, `transactions-report.${ext}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to export transactions");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {["","income","expense"].map(t => (
            <button key={t} onClick={() => setFilters(f => ({ ...f, type: t, page: 1 }))}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filters.type === t ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "btn-ghost"
              }`}>{t || "All"}</button>
          ))}
        </div>
        <select className="input-field w-44" value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto">
          <div className="flex gap-2">
            <button onClick={() => handleExportTransactions("excel")} className="btn-ghost">Export Excel</button>
            <button onClick={() => handleExportTransactions("pdf")} className="btn-ghost">Export PDF</button>
            <button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">
            + Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="glass-card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Total</div>
          <div className="font-display font-bold text-white">{pagination.total}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Page</div>
          <div className="font-display font-bold text-white">{filters.page} / {pagination.pages}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Showing</div>
          <div className="font-display font-bold text-white">{transactions.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : transactions.length === 0 ? (
          <EmptyState icon="⇄" title="No transactions found"
            description="Add your first income or expense to start tracking"
            action={<button onClick={() => setModal({ open: true, mode: "create", data: null })} className="btn-primary">Add Transaction</button>} />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Date","Title","Category","Amount","Method","Flag",""].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn._id} className="border-b border-white/4 hover:bg-white/2 transition-colors group">
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">{fmt.shortDate(txn.date)}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-slate-200">{txn.title}</div>
                      {txn.merchant_name && <div className="text-xs text-slate-600">{txn.merchant_name}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 bg-white/5 rounded-lg text-slate-300">{txn.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-mono font-semibold text-sm ${txn.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {txn.type === "income" ? "+" : "-"}{fmt.currency(txn.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{txn.payment_method}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={txn.essential_flag === "essential" ? "active" : "medium"}>
                        {txn.essential_flag}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ open: true, mode: "edit", data: txn })}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                          Edit
                        </button>
                        <button onClick={() => setDeleteId(txn._id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 transition-all">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
                <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  className="btn-ghost py-1.5 px-3 disabled:opacity-30">← Prev</button>
                <span className="text-sm text-slate-500">Page {filters.page} of {pagination.pages}</span>
                <button disabled={filters.page >= pagination.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  className="btn-ghost py-1.5 px-3 disabled:opacity-30">Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, mode: "create", data: null })}
        title={modal.mode === "create" ? "Add Transaction" : "Edit Transaction"} size="lg">
        <TransactionForm
          initial={modal.data ? {
            ...EMPTY_FORM, ...modal.data,
            date: modal.data.date ? modal.data.date.split("T")[0] : EMPTY_FORM.date,
          } : EMPTY_FORM}
          onSave={handleSave}
          onCancel={() => setModal({ open: false, mode: "create", data: null })}
          loading={saving}
          enableVoiceAutoAdd={modal.mode === "create"}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Transaction" size="sm">
        <p className="text-slate-400 mb-5">Are you sure? This will also update your monthly summary.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}