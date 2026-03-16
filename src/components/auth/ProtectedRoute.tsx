import { ReactNode } from 'react';
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
  const { user, loading: authLoading }                    = useAuth();
  const { events, isLoading: eventLoading }               = useEventContext();

  if (authLoading || eventLoading) return <Spinner />;
  if (!user)              return <Navigate to="/login"      replace />;
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
