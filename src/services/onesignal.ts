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
  if (lastSyncedPlayerId === playerId && activeSupabaseUserId === userId) {
    return; // already up to date
  }
  if (activeSupabaseUserId !== userId) return;

  const {error} = await supabase
    .from('users')
    .update({onesignal_player_id: playerId})
    .eq('id', userId);

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
  OneSignal.Debug.setLogLevel(LogLevel.Warn);
  OneSignal.initialize(oneSignalAppId!);
  // Subscribe once at startup — we'll filter by activeSupabaseUserId.
  OneSignal.User.pushSubscription.addEventListener(
    'change',
    onSubscriptionChange,
  );
}

/**
 * Link this device's OneSignal subscription to the user's Supabase ID and
 * sync the player ID to the user's row whenever the subscription is ready.
 *
 * Safe to call repeatedly — duplicate writes are guarded.
 */
export function setOneSignalUser(supabaseUserId: string): void {
  activeSupabaseUserId = supabaseUserId;
  lastSyncedPlayerId = null;
  OneSignal.login(supabaseUserId);

  // Subscription ID may already be available; if not, the change event will
  // fire when it becomes available.
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
  OneSignal.logout();
}

export function requestNotificationPermission(): Promise<boolean> {
  return OneSignal.Notifications.requestPermission(true);
}
