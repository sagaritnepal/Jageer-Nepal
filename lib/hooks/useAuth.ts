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
  // Deliberately does NOT clear saved fingerprint sign-in credentials here -
  // signing out is the only way to ever reach the login screen's fingerprint
  // button, so wiping them on every sign-out would defeat the feature
  // entirely (see lib/utils/biometricLogin.ts - they're only cleared when
  // the saved password stops working, e.g. it was changed elsewhere).
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

    // A separate getSession() call here used to race the INITIAL_SESSION
    // event below - on a cold start, whichever one happened to resolve
    // last would win and could stomp a real restored session with null,
    // silently forcing the user back to the login screen. onAuthStateChange
    // alone already fires once with the fully-restored session (or null)
    // as soon as the client finishes reading it from storage, so that's
    // the only source of truth this needs.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
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
