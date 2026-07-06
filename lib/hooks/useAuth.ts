// lib/hooks/useAuth.ts
import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { Profile, UserRole } from '../../types/database.types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));

/**
 * Bootstraps the auth session and keeps it in sync with Supabase auth
 * state changes. Mount this once near the root of the app (see app/_layout.tsx).
 */
export function useAuthListener() {
  const { setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function loadProfile(userId: string) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!error && isMounted) setProfile(data as Profile);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);
}

export function useRole(): UserRole | null {
  return useAuthStore((state) => state.profile?.role ?? null);
}
