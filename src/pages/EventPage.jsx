import { useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import WeddingDefaultTemplate from '../templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '../templates/ElegantTemplate/ElegantTemplate';
import NotFoundPage from './NotFoundPage';

// Register new templates here. The key must match event.template_id in the DB.
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
};

function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '2rem' }}>💍</div>
    </div>
  );
}

function EventPage() {
  const { slug } = useParams();
  const { event, loading, notFound } = useEvent(slug);

  if (loading) return <LoadingSpinner />;
  if (notFound || !event) return <NotFoundPage />;

  // Fallback to WeddingDefaultTemplate when template_id is null / not registered
  const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;
  const config = event.content_config ?? {};

  return <Template event={event} config={config} />;
}

export default EventPage;
