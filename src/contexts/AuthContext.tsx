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
    supabase!.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Secondary fetch: resolve isSuperAdmin whenever the authenticated user changes.
  // Runs independently of the loading flag — does not block initial auth resolution.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setIsSuperAdmin(false);
      return;
    }

    let cancelled = false;
    supabase!
      .from('users')
      .select('is_super_admin')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setIsSuperAdmin(false);
          return;
        }
        setIsSuperAdmin(data?.is_super_admin ?? false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id]);

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
