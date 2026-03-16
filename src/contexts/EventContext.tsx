import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEventsForUser, fetchAllEvents } from '@/lib/supabase';

export interface EventData {
  id:               string;
  slug:             string;
  template_id:      string;
  content_config:   Record<string, unknown> | null;
  event_date:       string | null;
  automation_config: Record<string, unknown> | null;
  status:           'draft' | 'active';
  partner1_name:    string | null;
  partner2_name:    string | null;
}

interface EventContextValue {
  events:       EventData[];
  currentEvent: EventData | null;
  isActive:     boolean;
  isLoading:    boolean;
  switchEvent:  (id: string) => void;
  refetch:      () => void;
}

const STORAGE_KEY = 'currentEventId';

function sortEvents(events: EventData[]): EventData[] {
  return [...events].sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
}

function resolveCurrentEvent(events: EventData[]): EventData | null {
  if (events.length === 0) return null;
  const storedId = localStorage.getItem(STORAGE_KEY);
  if (storedId) {
    const match = events.find(e => e.id === storedId);
    if (match) return match;
    // Stale ID — remove silently and fall back to first
    localStorage.removeItem(STORAGE_KEY);
  }
  return events[0];
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin }        = useAuth();
  const [events, setEvents]           = useState<EventData[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [isLoading, setLoading]       = useState(true);
  const [tick, setTick]               = useState(0);

  useEffect(() => {
    // Guard: do not fetch until a user is authenticated
    if (!user?.id) {
      setEvents([]);
      setCurrentEvent(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchFn = isSuperAdmin ? fetchAllEvents : fetchEventsForUser;

    fetchFn()
      .then((data: unknown) => {
        if (cancelled) return;
        const sorted = sortEvents((data as EventData[]) ?? []);
        setEvents(sorted);
        setCurrentEvent(resolveCurrentEvent(sorted));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setCurrentEvent(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id, isSuperAdmin, tick]);

  const switchEvent = useCallback((id: string) => {
    const match = events.find(e => e.id === id);
    if (!match) return;
    setCurrentEvent(match);
    localStorage.setItem(STORAGE_KEY, id);
  }, [events]);

  return (
    <EventContext.Provider value={{
      events,
      currentEvent,
      isActive:    currentEvent?.status === 'active',
      isLoading,
      switchEvent,
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
