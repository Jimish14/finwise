import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import Login        from "./pages/auth/Login";
import Register     from "./pages/auth/Register";
import Dashboard    from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Goals        from "./pages/Goals";
import Investments  from "./pages/Investments";
import Profile      from "./pages/Profile";
import AIPredictor  from "./pages/ai/AIPredictor";
import HealthGuard  from "./pages/ai/HealthGuard";
import GoalCalculator from "./pages/ai/GoalCalculator";
import { Spinner }  from "./components/ui/index.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected */}
      <Route path="/"                element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/transactions"    element={<PrivateRoute><Transactions /></PrivateRoute>} />
      <Route path="/goals"           element={<PrivateRoute><Goals /></PrivateRoute>} />
      <Route path="/investments"     element={<PrivateRoute><Investments /></PrivateRoute>} />
      <Route path="/profile"         element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/ai/predictor"    element={<PrivateRoute><AIPredictor /></PrivateRoute>} />
      <Route path="/ai/health-guard" element={<PrivateRoute><HealthGuard /></PrivateRoute>} />
      <Route path="/ai/goal-calc"    element={<PrivateRoute><GoalCalculator /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}