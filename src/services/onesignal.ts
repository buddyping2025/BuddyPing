import {OneSignal, LogLevel} from 'react-native-onesignal';
import {supabase} from './supabase';

const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
if (!oneSignalAppId) {
  throw new Error('Missing ONESIGNAL_APP_ID environment variable');
}

export function initializeOneSignal(): void {
  OneSignal.Debug.setLogLevel(LogLevel.Warn);
  OneSignal.initialize(oneSignalAppId!);
  // Permission is requested in LocationPermissionScreen after location perms are sorted
}

/**
 * Link this device's OneSignal subscription to the user's Supabase ID.
 * Called after sign-in so proximity notifications are routed correctly.
 */
export function setOneSignalUser(supabaseUserId: string): void {
  OneSignal.login(supabaseUserId);
}

export function clearOneSignalUser(): void {
  OneSignal.logout();
}

/**
 * Read the OneSignal push subscription player ID and store it in Supabase.
 * The edge function uses this ID to send targeted push notifications.
 * Call this after the user grants notification permission.
 */
export async function syncPlayerIdToSupabase(userId: string): Promise<void> {
  const playerId = OneSignal.User.pushSubscription.id;
  if (!playerId) return;

  const {error} = await supabase
    .from('users')
    .update({onesignal_player_id: playerId})
    .eq('id', userId);

  if (error) {
    console.warn('[OneSignal] failed to sync player ID:', error.message);
  }
}

export function requestNotificationPermission(): Promise<boolean> {
  return OneSignal.Notifications.requestPermission(true);
}
