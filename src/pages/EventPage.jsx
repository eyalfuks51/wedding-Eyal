import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import WeddingDefaultTemplate from '../templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '../templates/ElegantTemplate/ElegantTemplate';
import WeddingModernTemplate from '../templates/WeddingModernTemplate/WeddingModernTemplate';
import ConstructivistTemplate from '../templates/ConstructivistTemplate/ConstructivistTemplate';
import SynesthesiaTemplate from '../templates/SynesthesiaTemplate/SynesthesiaTemplate';
import NotFoundPage from './NotFoundPage';

// Register new templates here. The key must match event.template_id in the DB.
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
  'wedding-modern':  WeddingModernTemplate,
  'constructivist':  ConstructivistTemplate,
  'synesthesia':     SynesthesiaTemplate,
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
  const { event: dbEvent, loading, notFound } = useEvent(slug);
  const [configOverride, setConfigOverride] = useState(null);
  const [previewEvent, setPreviewEvent] = useState(null);

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
      if (e.data?.type === 'preview-config') {
        if (e.data.config) setConfigOverride(e.data.config);
        if (e.data.event)  setPreviewEvent(e.data.event);
      }
    };
    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
      document.head.removeChild(style);
    };
  }, [isPreview]);

  // Preview renders from the parent's postMessage: the iframe is anon and anon
  // RLS hides draft events, so its own DB fetch returns nothing. Public pages
  // (active only) use the DB row. ponytail: reuse parent's event, no new RLS grant.
  const event = isPreview ? previewEvent : dbEvent;

  if (isPreview) {
    if (!event) return <LoadingSpinner />;        // waiting for parent's first message
  } else {
    if (loading) return <LoadingSpinner />;
    if (notFound || !event) return <NotFoundPage />;
  }

  const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;
  const config = (isPreview && configOverride) ? configOverride : (event.content_config ?? {});

  return <Template event={event} config={config} />;
}

export default EventPage;
