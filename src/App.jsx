import { Routes, Route } from 'react-router-dom';
import EventPage from './pages/EventPage';
import NotFoundPage from './pages/NotFoundPage';
import Dashboard from './pages/Dashboard';
import AutomationTimeline from './pages/AutomationTimeline';
import DashboardSettings from './pages/DashboardSettings';

function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/timeline" element={<AutomationTimeline />} />
      <Route path="/dashboard/settings" element={<DashboardSettings />} />
      <Route path="/:slug" element={<EventPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
