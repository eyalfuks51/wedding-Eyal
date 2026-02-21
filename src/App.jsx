import { Routes, Route } from 'react-router-dom';
import EventPage from './pages/EventPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route path="/:slug" element={<EventPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
