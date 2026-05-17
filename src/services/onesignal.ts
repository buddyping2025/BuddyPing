import {OneSignal, LogLevel} from 'react-native-onesignal';
import type {PushSubscriptionChangedState} from 'react-native-onesignal';
import {supabase} from './supabase';

const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
if (!oneSignalAppId) {
  throw new Error('Missing ONESIGNAL_APP_ID environment variable');
}

let initialized = false;

// Track which Supabase user we are currently linking so we don't write
// another user's player ID to the row when the user signs out + signs in
// quickly while a subscription event is in flight.
let activeSupabaseUserId: string | null = null;
let lastSyncedPlayerId: string | null = null;

async function trySyncPlayerId(userId: string, playerId: string | null) {
  if (!playerId) return;
  // Snapshot at call time — we'll re-check after the await to catch the
  // case where the user signed out (or switched accounts) between us
  // deciding to sync and the network round-trip completing.
  if (activeSupabaseUserId !== userId) return;
  if (lastSyncedPlayerId === playerId) return;

  const {error} = await supabase
    .from('users')
    .update({onesignal_player_id: playerId})
    .eq('id', userId);

  // After the await, verify the active user hasn't changed before we
  // mark this player ID as "synced" — otherwise a stale sync for user A
  // could mask a needed sync for user B with the same playerId.
  if (activeSupabaseUserId !== userId) return;

  if (error) {
    console.warn('[OneSignal] failed to sync player ID:', error.message);
    return;
  }
  lastSyncedPlayerId = playerId;
}

function onSubscriptionChange(state: PushSubscriptionChangedState) {
  const userId = activeSupabaseUserId;
  if (!userId) return;
  const playerId = state.current?.id;
  if (playerId) trySyncPlayerId(userId, playerId);
}

export function initializeOneSignal(): void {
  if (initialized) return;
  initialized = true;
  try {
    OneSignal.Debug.setLogLevel(LogLevel.Warn);
    OneSignal.initialize(oneSignalAppId!);
    // Subscribe once at startup — we'll filter by activeSupabaseUserId.
    OneSignal.User.pushSubscription.addEventListener(
      'change',
      onSubscriptionChange,
    );
  } catch (err) {
    console.warn('[OneSignal] init failed:', err);
  }
}

/**
 * Link this device's OneSignal subscription to the user's Supabase ID and
 * sync the player ID to the user's row whenever the subscription is ready.
 *
 * Safe to call repeatedly — duplicate writes are guarded.
 */
export function setOneSignalUser(supabaseUserId: string): void {
  // If we're already logged in as the same user there's nothing to do —
  // OneSignal.login is idempotent but resetting lastSyncedPlayerId would
  // force a redundant Supabase update on every token refresh.
  if (activeSupabaseUserId === supabaseUserId) return;

  activeSupabaseUserId = supabaseUserId;
  lastSyncedPlayerId = null;
  try {
    OneSignal.login(supabaseUserId);
  } catch (err) {
    console.warn('[OneSignal] login failed:', err);
  }

  // Subscription ID may already be available; if not, the change event
  // will fire when it becomes available.
  OneSignal.User.pushSubscription
    .getIdAsync()
    .then(id => trySyncPlayerId(supabaseUserId, id))
    .catch(err =>
      console.warn('[OneSignal] getIdAsync failed:', err?.message ?? err),
    );
}

export function clearOneSignalUser(): void {
  activeSupabaseUserId = null;
  lastSyncedPlayerId = null;
  try {
    OneSignal.logout();
  } catch (err) {
    console.warn('[OneSignal] logout failed:', err);
  }
}

export function requestNotificationPermission(): Promise<boolean> {
  return OneSignal.Notifications.requestPermission(true);
}
