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
    // Auth generation counter. Bumped on every session change so a slow super-admin
    // lookup from an older session can't apply its result to a newer/signed-out one.
    let authEpoch = 0;
    // User id currently reflected in state. Lets applySession distinguish a real
    // identity change (different user / sign-out) from a same-user TOKEN_REFRESHED.
    let appliedUserId: string | undefined;
    const client = supabase;

    if (!client) {
      console.warn('Supabase credentials not found. Auth will be treated as signed out.');
      setLoading(false);
      return;
    }

    const resolveSuperAdmin = async (userId: string | undefined, epoch: number) => {
      let result = false;
      try {
        if (userId) {
          const { data } = await withTimeout(
            client
              .from('users')
              .select('is_super_admin')
              .eq('id', userId)
              .single(),
            AUTH_READY_TIMEOUT_MS,
            'Super-admin lookup timed out',
          );
          result = data?.is_super_admin ?? false;
        }
      } catch (err) {
        console.warn('Super-admin lookup failed:', err);
        result = false;
      }

      // Stale-guard: only the latest auth generation may apply its result and release
      // the loading gate. Without this, an old in-flight lookup could set
      // isSuperAdmin for a session that has since changed or signed out.
      if (cancelled || epoch !== authEpoch) return;
      setIsSuperAdmin(result);
      // Release the gate on every matching-epoch resolve, not just the first: an
      // identity change re-raises `loading` (see applySession), and only the matching
      // epoch's lookup may lower it again.
      initialAuthResolved = true;
      setLoading(false);
    };

    // Single entry point for every session change (initial getSession + later events).
    // Holds `loading` true until the super-admin lookup resolves, so EventContext never
    // branches on a stale isSuperAdmin=false — it picks fetchAllEvents vs fetchEventsForUser
    // off that flag the instant authLoading flips false.
    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      const epoch = ++authEpoch;
      const nextUserId = nextSession?.user?.id;
      const identityChanged = nextUserId !== appliedUserId;
      setSession(nextSession);
      // On a real identity change AFTER the initial resolve (a different user signs in,
      // or sign-out), the previously resolved super-admin flag no longer applies:
      //   - clear it eagerly — useFeatureAccess (useFeatureAccess.ts:9) and EventSwitcher
      //     read isSuperAdmin WITHOUT gating on loading, so a stale `true` would briefly
      //     unlock super-admin UI for the new/normal user;
      //   - re-gate loading — EventContext bails while authLoading, so it won't branch
      //     fetchAllEvents/fetchEventsForUser on the stale flag.
      // The matching epoch's lookup lowers loading again. A same-user TOKEN_REFRESHED
      // leaves identity unchanged, so neither fires — no flicker on token refresh.
      if (initialAuthResolved && identityChanged) {
        setIsSuperAdmin(false);
        setLoading(true);
      }
      appliedUserId = nextUserId;
      // Defer the lookup to a macrotask: onAuthStateChange fires from inside Supabase's
      // auth lock, and any query there re-enters getSession() -> await initializePromise
      // (the promise we're already inside) and deadlocks. setTimeout(0) runs it after the
      // lock releases. Harmless for the getSession path (already outside the lock).
      setTimeout(() => { void resolveSuperAdmin(nextUserId, epoch); }, 0);
    };

    withTimeout(
      client.auth.getSession(),
      AUTH_READY_TIMEOUT_MS,
      'Auth session lookup timed out',
    )
      .then(({ data: { session: s } }) => {
        applySession(s);
      })
      .catch(err => {
        if (cancelled || initialAuthResolved) return;
        console.warn('Auth initialization failed:', err);
        applySession(null);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, newSession) => {
        applySession(newSession);
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
