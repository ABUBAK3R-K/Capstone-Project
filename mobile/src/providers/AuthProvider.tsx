import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type AccountType = 'customer' | 'business';

interface Profile {
  id: string;
  name: string | null;
  role: string;
  account_type: AccountType;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Defaults to 'customer' while the profile is loading or under DEV_SKIP_AUTH, so routing never stalls. */
  accountType: AccountType;
  /** True while the persisted session is being restored from storage. */
  initializing: boolean;
  /** True while a signed-in session's profile row is being fetched. */
  loadingProfile: boolean;
  /** True when browsing via DEV_SKIP_AUTH without a real session. */
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    options?: { accountType?: AccountType; name?: string },
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Account type gates which tab navigator RootNavigator renders, so it has
  // to be known before routing — fetched separately from the auth session
  // because Supabase Auth has no concept of our `profiles` table.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }

    let active = true;
    setLoadingProfile(true);
    supabase
      .from('profiles')
      .select('id, name, role, account_type')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Failed to load profile', error);
          setProfile(null);
        } else {
          setProfile(data as Profile | null);
        }
        setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      accountType: profile?.account_type ?? 'customer',
      initializing,
      loadingProfile,
      isGuest: env.devSkipAuth && !session,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password, options) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              account_type: options?.accountType ?? 'customer',
              name: options?.name,
            },
          },
        });
        if (error) throw error;
        // With email confirmation on, Supabase returns a user but no session.
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [initializing, loadingProfile, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
