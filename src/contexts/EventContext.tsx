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
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [events, setEvents]           = useState<EventData[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [isLoading, setLoading]       = useState(true);
  // The user id the loaded events belong to. Lets readiness be derived
  // synchronously, so the previous user's events can't be observed during the
  // one-render gap after authLoading drops (see the readiness gate below).
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [tick, setTick]               = useState(0);

  useEffect(() => {
    // Guard: defer until auth (including isSuperAdmin) is fully resolved
    if (authLoading) return;

    // Guard: do not fetch until a user is authenticated
    if (!user?.id) {
      setEvents([]);
      setCurrentEvent(null);
      setDataOwnerId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const ownerId = user.id;
    setLoading(true);

    const fetchFn = isSuperAdmin ? fetchAllEvents : fetchEventsForUser;

    fetchFn()
      .then((data) => {
        if (cancelled) return;
        // supabase.js returns untyped data; cast at boundary
        const sorted = sortEvents((data ?? []) as EventData[]);
        setEvents(sorted);
        setCurrentEvent(resolveCurrentEvent(sorted));
        setDataOwnerId(ownerId);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setCurrentEvent(null);
        setDataOwnerId(ownerId);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id, isSuperAdmin, authLoading, tick]);

  const switchEvent = useCallback((id: string) => {
    const match = events.find(e => e.id === id);
    if (!match) return;
    setCurrentEvent(match);
    localStorage.setItem(STORAGE_KEY, id);
  }, [events]);

  // Synchronous readiness gate. The loaded events belong to `dataOwnerId`; until
  // that matches the currently authenticated user (and both auth + fetch have
  // settled), the data is stale or not yet fetched. This closes the one-render
  // window after authLoading drops but before the fetch effect re-raises
  // isLoading: ProtectedRouteInner (ProtectedRoute.tsx:37) gates children on
  // isLoading, so reporting !isReady there keeps the previous user's
  // events/isActive from reaching useFeatureAccess / EventSwitcher. The exposed
  // values are also guarded as defense-in-depth for any future ungated consumer.
  const currentOwner = user?.id ?? null;
  const isReady = !authLoading && !isLoading && dataOwnerId === currentOwner;

  return (
    <EventContext.Provider value={{
      events:       isReady ? events : [],
      currentEvent: isReady ? currentEvent : null,
      isActive:     isReady && currentEvent?.status === 'active',
      isLoading:    !isReady,
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
