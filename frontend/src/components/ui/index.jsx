import { createPortal } from "react-dom";

// ── StatCard ────────────────────────────────────────────────────
export function StatCard({ label, value, sub, trend, icon, accent = "amber", loading }) {
  const colors = {
    amber:   { border: "border-amber-500/20",   icon: "text-amber-400",   bg: "bg-amber-500/8"  },
    emerald: { border: "border-emerald-500/20", icon: "text-emerald-400", bg: "bg-emerald-500/8"},
    rose:    { border: "border-rose-500/20",    icon: "text-rose-400",    bg: "bg-rose-500/8"   },
    blue:    { border: "border-blue-500/20",    icon: "text-blue-400",    bg: "bg-blue-500/8"   },
  };
  const c = colors[accent] || colors.amber;

  if (loading) return (
    <div className="glass-card p-5">
      <div className="skeleton h-4 w-24 rounded mb-3" />
      <div className="skeleton h-8 w-32 rounded mb-2" />
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  );

  return (
    <div className={`glass-card p-5 border ${c.border} group hover:scale-[1.01] transition-transform duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{label}</span>
        {icon && (
          <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center ${c.icon} text-sm`}>
            {icon}
          </div>
        )}
      </div>
      <div className="stat-value mb-1">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-xs mt-2 font-medium ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={`relative bg-card border border-white/8 rounded-2xl shadow-2xl w-full ${sizes[size]} flex flex-col`}
        style={{ maxHeight: "85vh", zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
          <h2 className="font-display font-bold text-lg text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );

  // Portal renders modal directly on document.body,
  // escaping any parent stacking context (animate-fade-up transform etc.)
  return createPortal(modal, document.body);
}

// ── Loading Spinner ──────────────────────────────────────────────
export function Spinner({ size = "md" }) {
  const s = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className={`${s[size]} border-2 border-white/10 border-t-amber-500 rounded-full animate-spin`} />
  );
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm animate-pulse">Loading...</p>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────
export function EmptyState({ icon = "◉", title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-5xl mb-4 text-slate-700">{icon}</div>
      <h3 className="font-display font-semibold text-slate-400 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

// ── Alert ────────────────────────────────────────────────────────
export function Alert({ type = "info", title, message, onClose }) {
  const styles = {
    info:    "bg-blue-500/10 border-blue-500/20 text-blue-300",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    error:   "bg-rose-500/10 border-rose-500/20 text-rose-300",
  };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${styles[type]}`}>
      <div className="flex-1">
        {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
        <div className="text-sm opacity-80">{message}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-50 hover:opacity-100 text-lg">×</button>
      )}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────
export function Badge({ children, variant = "default" }) {
  const v = {
    default:  "bg-slate-700/50 text-slate-300",
    income:   "bg-emerald-500/15 text-emerald-400",
    expense:  "bg-rose-500/15 text-rose-400",
    high:     "bg-rose-500/15 text-rose-400",
    medium:   "bg-amber-500/15 text-amber-400",
    low:      "bg-blue-500/15 text-blue-400",
    active:   "bg-emerald-500/15 text-emerald-400",
    paused:   "bg-slate-500/15 text-slate-400",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${v[variant] || v.default}`}>
      {children}
    </span>
  );
}

// ── Format helpers ───────────────────────────────────────────────
export const fmt = {
  currency: (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
  pct:      (v) => `${Number(v || 0).toFixed(1)}%`,
  date:     (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
  shortDate:(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
};