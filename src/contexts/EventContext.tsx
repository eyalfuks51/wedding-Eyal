import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchEventForUser } from '@/lib/supabase';

export interface EventData {
  id:               string;
  slug:             string;
  template_id:      string;
  content_config:   Record<string, unknown> | null;
  event_date:       string | null;
  automation_config: Record<string, unknown> | null;
  status:           'draft' | 'active';
}

interface EventContextValue {
  event:     EventData | null;
  isActive:  boolean;
  isLoading: boolean;
  refetch:   () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [event, setEvent]       = useState<EventData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [tick, setTick]         = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEventForUser()
      .then(data  => { if (!cancelled) { setEvent(data as EventData | null); setLoading(false); } })
      .catch(()   => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <EventContext.Provider value={{
      event,
      isActive:  event?.status === 'active',
      isLoading,
      refetch: () => setTick(t => t + 1),
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEventContext must be inside EventProvider');
  return ctx;
}
