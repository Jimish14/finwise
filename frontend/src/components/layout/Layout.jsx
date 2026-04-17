import Sidebar from "./Sidebar";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const { pathname } = useLocation();

  // Page title mapping
  const titles = {
    "/": "Dashboard",
    "/transactions": "Transactions",
    "/goals": "Goals",
    "/investments": "Investments",
    "/ai/predictor": "AI Expense Predictor",
    "/ai/health-guard": "Financial Health Guard",
    "/ai/goal-calc": "Smart Goal Calculator",
    "/profile": "Profile",
  };
  const title = titles[pathname] || "FinWise";

  return (
    <div className="min-h-screen bg-navy-950 flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-navy-950/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-white">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-mono">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}