import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { withTimeout } from './auth-utils';

interface AuthContextValue {
  user:         User | null;
  session:      Session | null;
  loading:      boolean;
  isSuperAdmin: boolean;
  signOut:      () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_READY_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [loading, setLoading]           = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let initialAuthResolved = false;
    const client = supabase;

    if (!client) {
      console.warn('Supabase credentials not found. Auth will be treated as signed out.');
      setLoading(false);
      return;
    }

    const resolveSuperAdmin = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setIsSuperAdmin(false);
        return;
      }

      try {
        const { data } = await withTimeout(
          client
            .from('users')
            .select('is_super_admin')
            .eq('id', userId)
            .single(),
          AUTH_READY_TIMEOUT_MS,
          'Super-admin lookup timed out',
        );
        if (!cancelled) setIsSuperAdmin(data?.is_super_admin ?? false);
      } catch (err) {
        console.warn('Super-admin lookup failed:', err);
        if (!cancelled) setIsSuperAdmin(false);
      }
    };

    const markAuthReady = (nextSession: Session | null) => {
      if (cancelled) return;
      initialAuthResolved = true;
      setSession(nextSession);
      setLoading(false);
      void resolveSuperAdmin(nextSession?.user?.id);
    };

    withTimeout(
      client.auth.getSession(),
      AUTH_READY_TIMEOUT_MS,
      'Auth session lookup timed out',
    )
      .then(async ({ data: { session: s } }) => {
        markAuthReady(s);
      })
      .catch(err => {
        if (cancelled || initialAuthResolved) return;
        console.warn('Auth initialization failed:', err);
        markAuthReady(null);
      });

    // Supabase deadlock guard: onAuthStateChange fires from inside the auth lock.
    // Any supabase query inside it re-enters getSession() -> await initializePromise
    // (the promise we're already inside) and deadlocks. Defer the super-admin lookup
    // with setTimeout so it runs after the lock is released. (withTimeout still bounds it.)
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        if (!initialAuthResolved) {
          initialAuthResolved = true;
          setLoading(false);
        }
        setTimeout(() => {
          if (!cancelled) void resolveSuperAdmin(newSession?.user?.id);
        }, 0);
      }
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
