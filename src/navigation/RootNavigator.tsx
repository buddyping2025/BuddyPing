import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useAuth} from '../hooks/useAuth';
import {usePermissions} from '../hooks/usePermissions';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';
import {LocationPermissionScreen} from '../screens/onboarding/LocationPermissionScreen';
import {SetupProfileScreen} from '../screens/onboarding/SetupProfileScreen';

export function RootNavigator() {
  const {session, appUser, isLoading: authLoading} = useAuth();
  const {foreground, background, isChecking} = usePermissions();

  // Loading state — Supabase session check in progress
  if (authLoading || isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#6366F1" />
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

  // All good — show main app
  return <MainNavigator />;
}
