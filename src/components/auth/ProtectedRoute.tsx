import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EventProvider, useEventContext } from '@/contexts/EventContext';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRouteInner({ children }: { children: ReactNode }) {
  const { user, loading: authLoading }                          = useAuth();
  const { events, isLoading: eventLoading, refetch }            = useEventContext();
  const [retryCount, setRetryCount]                             = useState(0);

  // INT-02: Retry logic for onboarding race condition.
  // When events are empty but localStorage has a currentEventId, it may be a
  // propagation delay (e.g., first sign-in after onboarding). Retry refetch up
  // to 3 times with a 500 ms gap before falling through to /onboarding redirect.
  useEffect(() => {
    if (authLoading || eventLoading) return;
    if (events.length > 0) return;
    if (!localStorage.getItem('currentEventId')) return;

    if (retryCount < 3) {
      const timer = setTimeout(() => {
        refetch();
        setRetryCount(c => c + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, eventLoading, events.length, retryCount, refetch]);

  if (authLoading || eventLoading) return <Spinner />;
  if (!user)              return <Navigate to="/login"      replace />;

  // Still retrying — show spinner instead of premature /onboarding redirect
  if (events.length === 0 && retryCount < 3 && localStorage.getItem('currentEventId')) {
    return <Spinner />;
  }

  if (events.length === 0) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

/**
 * Wraps all /dashboard/* routes.
 * Provides a single EventProvider so all dashboard pages share one context instance.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </EventProvider>
  );
}
