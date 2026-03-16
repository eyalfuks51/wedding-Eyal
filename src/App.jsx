import { Routes, Route, Navigate } from 'react-router-dom';
import EventPage         from './pages/EventPage';
import NotFoundPage      from './pages/NotFoundPage';
import Dashboard         from './pages/Dashboard';
import AutomationTimeline from './pages/AutomationTimeline';
import DashboardSettings  from './pages/DashboardSettings';
import LoginPage         from './pages/LoginPage';
import OnboardingPage    from './pages/OnboardingPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-violet-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/preview/:slug" element={<EventPage isPreview={true} />} />
      <Route path="/:slug"         element={<EventPage />} />

      {/* Auth-required, no event needed */}
      <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

      {/* Protected dashboard — ProtectedRoute wraps each tab */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/timeline"
        element={<ProtectedRoute><AutomationTimeline /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/settings"
        element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>}
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
