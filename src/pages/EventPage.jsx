import { useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import WeddingTemplate from '../templates/WeddingTemplate/WeddingTemplate';
import NotFoundPage from './NotFoundPage';

const TEMPLATES = {
  'wedding-default': WeddingTemplate,
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

  const Template = TEMPLATES[event.template_id] ?? WeddingTemplate;
  return <Template event={event} config={event.content_config} />;
}

export default EventPage;
