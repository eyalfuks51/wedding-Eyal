import { Routes, Route } from 'react-router-dom';
import EventPage         from './pages/EventPage';
import NotFoundPage      from './pages/NotFoundPage';
import Dashboard         from './pages/Dashboard';
import AutomationTimeline from './pages/AutomationTimeline';
import DashboardSettings  from './pages/DashboardSettings';
import LoginPage         from './pages/LoginPage';
import OnboardingPage    from './pages/OnboardingPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/preview/:slug" element={<EventPage isPreview={true} />} />
      <Route path="/:slug"         element={<EventPage />} />

      {/* Auth-required, no event needed */}
      <Route path="/onboarding" element={<OnboardingPage />} />

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
