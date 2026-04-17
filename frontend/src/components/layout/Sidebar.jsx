import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { path: "/",           icon: "⬡",  label: "Dashboard" },
  { path: "/transactions",icon: "⇄",  label: "Transactions" },
  { path: "/goals",       icon: "◎",  label: "Goals" },
  { path: "/investments", icon: "◈",  label: "Investments" },
];

const AI_NAV = [
  { path: "/ai/predictor",   icon: "◉", label: "Expense Predictor" },
  { path: "/ai/health-guard",icon: "♥", label: "Health Guard" },
  { path: "/ai/goal-calc",   icon: "⊕", label: "Goal Calculator" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-navy-800 border-r border-white/5 flex flex-col z-40">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-navy-900 font-display font-bold text-lg">₹</div>
          <div>
            <div className="font-display font-bold text-white text-sm leading-none">FinWise</div>
            <div className="text-xs text-slate-500 mt-0.5">AI Expense Tracker</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="mb-1">
          <div className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Main</div>
          {NAV.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"} className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }>
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-5">
          <div className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            AI Features
          </div>
          {AI_NAV.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }>
              <span className="text-base w-5 text-center text-amber-500/60">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/5">
        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-display font-bold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-300 truncate">{user?.name}</div>
            <div className="text-[10px] text-slate-600 truncate">{user?.email}</div>
          </div>
        </NavLink>
        <button onClick={logout} className="sidebar-link w-full mt-1 text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/5">
          <span className="text-base w-5 text-center">⊗</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}