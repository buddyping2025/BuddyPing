import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useAuth} from '../hooks/useAuth';
import {usePermissions} from '../hooks/usePermissions';
import {useFriends} from '../hooks/useFriends';
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
  const {foreground, background, isChecking} = usePermissions();

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

  // Logged in but location permissions not granted — block access
  if (!foreground || !background) {
    return <LocationPermissionScreen />;
  }

  // All good — show main app with live badge count
  return <MainApp userId={appUser.id} />;
}
