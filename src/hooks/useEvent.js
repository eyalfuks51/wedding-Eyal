import { useState, useEffect } from 'react';
import { fetchEventBySlug } from '../lib/supabase';

export function useEvent(slug) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(!!slug);
  const [notFound, setNotFound] = useState(!slug);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    fetchEventBySlug(slug)
      .then((data) => {
        if (!cancelled) {
          setEvent(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { event, loading, notFound };
}
