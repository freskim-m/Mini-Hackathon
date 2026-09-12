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

type DemoRole = 'superadmin' | 'admin' | 'user';

const DEMO_ACCOUNTS: Record<DemoRole, { id: string; email: string; password: string }> = {
  superadmin: { id: '00000000-0000-4000-8000-000000000001', email: 'superadmin@demo.local', password: 'Demo123!' },
  admin: { id: '00000000-0000-4000-8000-000000000002', email: 'admin@demo.local', password: 'Admin123!' },
  user: { id: '00000000-0000-4000-8000-000000000003', email: 'user@demo.local', password: 'User123!' },
};
const DEMO_STORAGE_KEY = 'prishtina_raporton_demo_role';

function getDemoUser(role: DemoRole): User {
  const account = DEMO_ACCOUNTS[role];
  return { id: account.id, email: account.email } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [accountActive, setAccountActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const hydrateAccount = useCallback(async (nextSession: Session | null): Promise<boolean> => {
    const nextUser = nextSession?.user ?? null;
    if (!nextUser && typeof window !== 'undefined') {
      const demoRole = localStorage.getItem(DEMO_STORAGE_KEY) as DemoRole | null;
      if (demoRole && DEMO_ACCOUNTS[demoRole]) {
        setSession(null);
        setUser(getDemoUser(demoRole));
        setIsAdmin(demoRole !== 'user');
        setIsSuperadmin(demoRole === 'superadmin');
        setAccountActive(true);
        return true;
      }
    }
    setSession(nextSession);
    setUser(nextUser);
    if (!nextUser) {
      setIsAdmin(false);
      setIsSuperadmin(false);
      setAccountActive(true);
      return true;
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
    return active;
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
    const demoRole = (Object.keys(DEMO_ACCOUNTS) as DemoRole[]).find((role) => {
      const account = DEMO_ACCOUNTS[role];
      return account.email === email.trim().toLowerCase() && account.password === password;
    });
    if (demoRole) {
      localStorage.setItem(DEMO_STORAGE_KEY, demoRole);
      setSession(null);
      setUser(getDemoUser(demoRole));
      setIsAdmin(demoRole !== 'user');
      setIsSuperadmin(demoRole === 'superadmin');
      setAccountActive(true);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const active = await hydrateAccount(data.session);
    return { error: active ? null : 'Kjo llogari është çaktivizuar.' };
  }, [hydrateAccount]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.session) await hydrateAccount(data.session);
    return { error: null };
  }, [hydrateAccount]);
  const signOut = useCallback(async () => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
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
