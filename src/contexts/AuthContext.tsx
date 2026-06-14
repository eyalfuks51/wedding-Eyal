import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user:         User | null;
  session:      Session | null;
  loading:      boolean;
  isSuperAdmin: boolean;
  signOut:      () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [loading, setLoading]           = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase!.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);

      // Resolve super admin status before marking auth as ready,
      // so EventContext doesn't fire with stale isSuperAdmin=false.
      const userId = s?.user?.id;
      if (userId) {
        const { data } = await supabase!
          .from('users')
          .select('is_super_admin')
          .eq('id', userId)
          .single();
        if (!cancelled) setIsSuperAdmin(data?.is_super_admin ?? false);
      }

      if (!cancelled) setLoading(false);
    });

    // Supabase deadlock guard: callback fires from inside the auth lock.
    // Any supabase query inside it would re-enter `getSession()` → `await initializePromise`,
    // which is the very promise we're inside. Defer with setTimeout so the query
    // runs after the lock is released.
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      (_event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        const uid = newSession?.user?.id;
        setTimeout(async () => {
          if (cancelled) return;
          if (!uid) {
            setIsSuperAdmin(false);
            return;
          }
          const { data } = await supabase!
            .from('users')
            .select('is_super_admin')
            .eq('id', uid)
            .single();
          if (!cancelled) setIsSuperAdmin(data?.is_super_admin ?? false);
        }, 0);
      }
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase!.auth.signOut();
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
