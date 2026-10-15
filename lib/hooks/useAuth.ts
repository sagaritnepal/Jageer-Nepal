// lib/hooks/useAuth.ts
import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase, AUTH_STORAGE_KEY } from '../supabase';
import { SecureAuthStorage } from '../utils/secureAuthStorage';
import { queryClient } from '../providers/QueryProvider';
import type { Profile, UserRole } from '../../types/database.types';
import { useCartStore } from './useCart';
import { unregisterThisDevice } from './usePushNotifications';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  /** The profile could not be read even after retrying. Without this the app
   * waits on a null profile forever and the portal sits on a blank spinner. */
  profileError: boolean;
  setProfileError: (failed: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  profileError: false,
  setProfileError: (profileError) => set({ profileError }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  // Deliberately does NOT clear saved fingerprint sign-in credentials here -
  // signing out is the only way to ever reach the login screen's fingerprint
  // button, so wiping them on every sign-out would defeat the feature
  // entirely (see lib/utils/biometricLogin.ts - they're only cleared when
  // the saved password stops working, e.g. it was changed elsewhere).
  //
  // `scope: 'global'` revokes every refresh token this user has - not just
  // this device's - so "Sign Out" actually invalidates the session in the
  // database, not just the local app state. Best-effort: if that network
  // call throws or the server rejects it for a real reason (not one of the
  // already-tolerated 401/403/404/session-missing cases), supabase-js
  // deliberately skips clearing its own persisted session (see its
  // `_signOut`) - left alone, that session could silently resurrect on the
  // next app launch even though this screen already shows signed out. The
  // explicit storage removal below forces the local wipe unconditionally,
  // and clearing the query cache stops a second account signing in on this
  // device from briefly seeing the previous user's cached data.
  signOut: async () => {
    // While still signed in: stop pushing to this device for the person leaving,
    // so the next person to use it is not sent their notifications.
    await unregisterThisDevice();
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Offline or the server errored - already logged nowhere useful to
      // surface this to the user for a Sign Out button, so fall through to
      // the unconditional local wipe below regardless.
    }
    await SecureAuthStorage.removeItem(AUTH_STORAGE_KEY);
    queryClient.clear();
    // The cart is in-memory app state, not a query - without this the next
    // account to sign in on the device inherited (and could check out) the
    // previous user's cart.
    useCartStore.getState().clearCart();
    set({ session: null, profile: null });
  },
}));

/** Reads the signed-in user's profile, retrying a few times: a dropped request
 * on a cold start used to leave the profile null for good and the portal
 * frozen on its loading state. After the last failure `profileError` is set so
 * the app can offer a retry instead of spinning forever. */
export async function loadProfileWithRetry(userId: string, isActive: () => boolean = () => true) {
  const { setProfile, setProfileError } = useAuthStore.getState();
  setProfileError(false);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!isActive()) return;
    if (!error && data) {
      setProfile(data as Profile);
      return;
    }
    // PGRST116: no profile row at all - the login exists but the account was
    // removed (or never finished registering). Retrying cannot help, and the
    // saved session would trap every launch on the loading screen, so sign out.
    if (error?.code === 'PGRST116' || (!error && !data)) {
      await useAuthStore.getState().signOut();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  if (isActive()) setProfileError(true);
}

/**
 * Bootstraps the auth session and keeps it in sync with Supabase auth
 * state changes. Mount this once near the root of the app (see app/_layout.tsx).
 */
export function useAuthListener() {
  const { setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const loadProfile = (userId: string) => loadProfileWithRetry(userId, () => isMounted);

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
