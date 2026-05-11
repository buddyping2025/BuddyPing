import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useAuth} from '../hooks/useAuth';
import {usePermissions} from '../hooks/usePermissions';
import {useFriends} from '../hooks/useFriends';
import {useLocationSync} from '../hooks/useLocationSync';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';
import {LocationPermissionScreen} from '../screens/onboarding/LocationPermissionScreen';
import {SetupProfileScreen} from '../screens/onboarding/SetupProfileScreen';
import {APP_COLORS} from '../constants';

// Separate component so useFriends is called unconditionally within it
function MainApp({userId}: {userId: string}) {
  const {pendingReceived} = useFriends(userId);
  return <MainNavigator pendingRequestCount={pendingReceived.length} />;
}

export function RootNavigator() {
  const {session, appUser, isLoading: authLoading} = useAuth();
  const {foreground, background, notificationPromptDone, isChecking} =
    usePermissions();

  // Keep the user's GPS row fresh whenever they're active — without this
  // a brand-new user would have no last_location until the first ~12h
  // background-fetch tick, so the first day's proximity checks would miss
  // them entirely.
  useLocationSync(appUser?.id, foreground && background);

  // Loading state — Supabase session check in progress
  if (authLoading || isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-subtle">
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
      </View>
    );
  }

  // No session — show auth screens
  if (!session) {
    return <AuthNavigator />;
  }

  // Logged in but no app user profile yet — first-time setup
  if (!appUser) {
    return <SetupProfileScreen />;
  }

  // Onboarding gate: location perms (required) + notification prompt (so
  // we never silently skip the OneSignal opt-in on Android 11+, where the
  // background-location settings round-trip would otherwise unmount the
  // screen as soon as both location perms became true).
  if (!foreground || !background || !notificationPromptDone) {
    return <LocationPermissionScreen />;
  }

  // All good — show main app with live badge count
  return <MainApp userId={appUser.id} />;
}
