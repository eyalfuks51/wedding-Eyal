import { useState, useEffect } from 'react';
import { fetchEventBySlug } from '../lib/supabase';

export function useEvent(slug) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    fetchEventBySlug(slug)
      .then((data) => {
        setEvent(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.code === 'PGRST116' || err.details?.includes('0 rows')) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [slug]);

  return { event, loading, notFound };
}
