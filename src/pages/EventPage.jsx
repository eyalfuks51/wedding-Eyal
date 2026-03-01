import { useState, useEffect } from 'react';
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

function EventPage({ isPreview = false }) {
  const { slug } = useParams();
  const { event, loading, notFound } = useEvent(slug);
  const [configOverride, setConfigOverride] = useState(null);

  // ── postMessage bridge (preview mode only) ──────────────────────────────────
  useEffect(() => {
    if (!isPreview) return;

    // Hide scrollbar track in the iframe without disabling scroll
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar { display: none }
      html { scrollbar-width: none; -ms-overflow-style: none; }
    `;
    document.head.appendChild(style);

    const handler = (e) => {
      // Accept only same-origin messages with the correct shape
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'preview-config' && e.data.config) {
        setConfigOverride(e.data.config);
      }
    };
    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
      document.head.removeChild(style);
    };
  }, [isPreview]);

  if (loading) return <LoadingSpinner />;
  if (notFound || !event) return <NotFoundPage />;

  console.log('Current Template ID:', event.template_id);
  const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;

  // In preview mode, use the parent's draft config once received; fall back to DB
  const config = (isPreview && configOverride) ? configOverride : (event.content_config ?? {});

  return <Template event={event} config={config} />;
}

export default EventPage;
