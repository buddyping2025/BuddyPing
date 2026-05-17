import {useEffect, useState} from 'react';
import {Session, User} from '@supabase/supabase-js';
import messaging from '@react-native-firebase/messaging';
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
// Monotonic token: each fetchAppUser call increments and captures this.
// When the result arrives, we only apply it if no newer fetch has started
// in the meantime. This prevents a slow fetch from overwriting a freshly
// applied result (e.g. after a refreshAppUser() call following a write).
let fetchSequence = 0;
// Tracks which user we last linked OneSignal to so token-refresh events
// don't re-issue OneSignal.login for the same user on every refresh.
let lastLoggedInOneSignalUserId: string | null = null;
// Same idea for FCM: only re-sync the token to Supabase when the active
// user actually changes, not on every silent TOKEN_REFRESHED event.
let lastFcmSyncedUserId: string | null = null;
// Unsubscribe handle for the FCM onTokenRefresh listener. Registered once
// per signed-in user; removed on sign-out so a future user's listener
// isn't double-fired.
let fcmTokenRefreshUnsub: (() => void) | null = null;

function emit() {
  listeners.forEach(l => l());
}

function setState(next: Partial<AuthState>) {
  state = {...state, ...next};
  emit();
}

async function fetchAppUser(userId: string, isInitial: boolean) {
  const mySequence = ++fetchSequence;
  // Only flip the global loading flag during the initial fetch. Otherwise
  // every TOKEN_REFRESHED event would flash the loading spinner across
  // the whole app tree.
  if (isInitial && !state.isLoading) setState({isLoading: true});
  try {
    const {data, error} = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[useAuth] fetchAppUser error:', error.message);
    }

    // Discard the result if (a) a newer fetch superseded this one, or
    // (b) the session changed mid-flight (signed out, signed in as a
    // different user). Either way, applying this would corrupt state.
    if (mySequence !== fetchSequence) return;
    if (state.session?.user?.id !== userId) return;

    setState({appUser: (data as AppUser | null) ?? null});
  } catch (err) {
    if (mySequence === fetchSequence) {
      console.warn('[useAuth] fetchAppUser threw:', err);
    }
  } finally {
    if (mySequence === fetchSequence && state.session?.user?.id === userId) {
      if (state.isLoading) setState({isLoading: false});
    }
  }
}

/**
 * Write the device's FCM token to the signed-in user's row, then start
 * listening for FCM token rotations so the row stays in sync. Used by
 * wake-location-refresh to send a silent push that wakes the killed app
 * ~10 min before each proximity-check tick.
 *
 * Also clears the token off any OTHER user row that previously held it
 * — without this, signing in as a different user on the same device
 * would leave two users sharing a single FCM token, and the wake push
 * intended for the first user would be delivered to the second.
 */
async function syncFcmTokenForUser(userId: string): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (!token) return;

    await supabase
      .from('users')
      .update({fcm_token: null})
      .eq('fcm_token', token)
      .neq('id', userId);

    const {error} = await supabase
      .from('users')
      .update({fcm_token: token})
      .eq('id', userId);
    if (error) {
      console.warn('[useAuth] fcm_token write failed:', error.message);
      return;
    }

    fcmTokenRefreshUnsub?.();
    fcmTokenRefreshUnsub = messaging().onTokenRefresh(async newToken => {
      const {error: refreshErr} = await supabase
        .from('users')
        .update({fcm_token: newToken})
        .eq('id', userId);
      if (refreshErr) {
        console.warn(
          '[useAuth] fcm_token refresh write failed:',
          refreshErr.message,
        );
      }
    });
  } catch (err) {
    console.warn('[useAuth] syncFcmTokenForUser threw:', err);
  }
}

async function clearFcmTokenForUser(userId: string): Promise<void> {
  fcmTokenRefreshUnsub?.();
  fcmTokenRefreshUnsub = null;
  try {
    await supabase
      .from('users')
      .update({fcm_token: null})
      .eq('id', userId);
  } catch (err) {
    console.warn('[useAuth] clearFcmTokenForUser threw:', err);
  }
}

function applySession(s: Session | null) {
  const previousUserId = state.session?.user?.id ?? null;
  const nextUserId = s?.user?.id ?? null;
  const userChanged = previousUserId !== nextUserId;

  setState({
    session: s,
    supabaseUser: s?.user ?? null,
    isSignedIn: !!s,
  });

  if (s?.user) {
    if (userChanged) {
      // New (or different) user — clear stale appUser before refetch so
      // the previous user's row never flashes in the UI.
      if (state.appUser && state.appUser.id !== s.user.id) {
        setState({appUser: null});
      }
      if (lastLoggedInOneSignalUserId !== s.user.id) {
        setOneSignalUser(s.user.id);
        lastLoggedInOneSignalUserId = s.user.id;
      }
      if (lastFcmSyncedUserId !== s.user.id) {
        lastFcmSyncedUserId = s.user.id;
        syncFcmTokenForUser(s.user.id);
      }
      fetchAppUser(s.user.id, true);
    } else {
      // Same user (token refresh, USER_UPDATED, etc.) — refetch profile
      // silently without toggling the loading flag.
      fetchAppUser(s.user.id, false);
    }
  } else {
    // Signed out — reset everything.
    ++fetchSequence; // invalidate any in-flight fetches
    setState({appUser: null, isLoading: false});
    if (lastLoggedInOneSignalUserId) {
      clearOneSignalUser();
      lastLoggedInOneSignalUserId = null;
    }
    if (lastFcmSyncedUserId) {
      clearFcmTokenForUser(lastFcmSyncedUserId);
      lastFcmSyncedUserId = null;
    }
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
  await fetchAppUser(userId, false);
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
