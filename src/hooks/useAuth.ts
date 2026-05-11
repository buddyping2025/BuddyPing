import {useEffect, useState} from 'react';
import {Session, User} from '@supabase/supabase-js';
import {supabase} from '../services/supabase';
import {setOneSignalUser, clearOneSignalUser} from '../services/onesignal';
import type {User as AppUser} from '../types';

type AuthState = {
  session: Session | null;
  supabaseUser: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
};

// Module-level singleton state — every useAuth() instance shares this so
// triggering a refresh from one screen propagates to all others.
let state: AuthState = {
  session: null,
  supabaseUser: null,
  appUser: null,
  isLoading: true,
  isSignedIn: false,
};

// Set to true while a sign-up flow is mid-way through inserting the
// public.users row. Forces RootNavigator to keep the loader showing
// instead of briefly flashing SetupProfileScreen between the SIGNED_IN
// auth event and the insert completing.
let profileCreationInFlight = false;

const listeners = new Set<() => void>();
let initialized = false;
let inFlightUserId: string | null = null;

function emit() {
  listeners.forEach(l => l());
}

function setState(next: Partial<AuthState>) {
  state = {...state, ...next};
  emit();
}

async function fetchAppUser(userId: string) {
  // Guard against duplicate concurrent fetches for the same user.
  if (inFlightUserId === userId) return;
  inFlightUserId = userId;
  setState({isLoading: true});
  try {
    const {data, error} = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[useAuth] fetchAppUser error:', error.message);
    }
    // Discard the result if the session changed mid-flight (e.g. signed
    // out, signed in as a different user) — otherwise we'd overwrite the
    // new session's appUser with the old user's row.
    if (state.session?.user?.id === userId) {
      setState({appUser: (data as AppUser | null) ?? null});
    }
  } finally {
    if (inFlightUserId === userId) inFlightUserId = null;
    if (state.session?.user?.id === userId) {
      setState({isLoading: false});
    }
  }
}

function applySession(s: Session | null) {
  setState({
    session: s,
    supabaseUser: s?.user ?? null,
    isSignedIn: !!s,
  });
  if (s?.user) {
    setOneSignalUser(s.user.id);
    fetchAppUser(s.user.id);
  } else {
    setState({appUser: null, isLoading: false});
    clearOneSignalUser();
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;

  supabase.auth
    .getSession()
    .then(({data}) => applySession(data.session))
    .catch(err => {
      console.warn('[useAuth] getSession error:', err);
      setState({isLoading: false});
    });

  supabase.auth.onAuthStateChange((_event, s) => applySession(s));
}

/**
 * Force a refetch of the current user's profile row.
 * Call this after any mutation that touches public.users (sign-up,
 * profile setup, profile edit) so all useAuth() instances see the change.
 */
export async function refreshAppUser(): Promise<void> {
  const userId = state.session?.user?.id;
  if (!userId) return;
  // Reset the in-flight guard so we always fetch fresh data after a mutation.
  inFlightUserId = null;
  await fetchAppUser(userId);
}

/**
 * Set/clear a flag that pretends auth is still loading while the sign-up
 * flow inserts the profile row. Without this, the SIGNED_IN auth event
 * would briefly render SetupProfileScreen before the insert completes,
 * confusing the user (and risking a duplicate-insert if they tap fast).
 */
export function setProfileCreationInFlight(value: boolean): void {
  if (profileCreationInFlight === value) return;
  profileCreationInFlight = value;
  emit();
}

export function useAuth(): AuthState {
  // Force re-render when global state changes.
  const [, setVersion] = useState(0);

  useEffect(() => {
    initialize();
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...state,
    isLoading: state.isLoading || profileCreationInFlight,
  };
}
