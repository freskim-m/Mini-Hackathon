import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
  accountActive: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [accountActive, setAccountActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const hydrateAccount = useCallback(async (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;
    setSession(nextSession);
    setUser(nextUser);
    if (!nextUser) {
      setIsAdmin(false);
      setIsSuperadmin(false);
      setAccountActive(true);
      return;
    }
    const [adminResult, profileResult] = await Promise.all([
      supabase.from('admin_users').select('role, active').eq('id', nextUser.id).maybeSingle(),
      supabase.from('user_profiles').select('active').eq('id', nextUser.id).maybeSingle(),
    ]);
    const admin = adminResult.data;
    setIsAdmin(Boolean(admin?.active));
    setIsSuperadmin(admin?.active === true && admin.role === 'superadmin');
    const active = profileResult.data?.active !== false;
    setAccountActive(active);
    // Deactivated accounts must not keep a previously cached browser session.
    if (!active) void supabase.auth.signOut();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      hydrateAccount(data.session).finally(() => setLoading(false));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Do not await network work inside Supabase's auth callback.
      void hydrateAccount(newSession).finally(() => setLoading(false));
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [hydrateAccount]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, isSuperadmin, accountActive, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
