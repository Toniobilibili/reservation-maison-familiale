'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/lib/types';

type AuthState = {
  user: SessionUser | null;
  profile: Profile | null;
  loading: boolean;
};

type SessionUser = {
  id: string;
  email: string | null;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      if (sessionUser) {
        setUser({ id: sessionUser.id, email: sessionUser.email });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }

    if (user) {
      loadProfile();
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
