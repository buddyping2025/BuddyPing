import {useEffect, useState, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {checkLocationPermissions} from '../services/location';

const ONBOARDING_NOTIF_KEY = 'buddyping.onboarding.notif_prompted';

type PermissionState = {
  foreground: boolean;
  background: boolean;
  /**
   * Tracks whether the user has been through the notification permission
   * step in onboarding. Independent of grant outcome — once they have
   * been prompted (or chose to skip), we stop blocking on this gate.
   */
  notificationPromptDone: boolean;
  isChecking: boolean;
  recheck: () => Promise<void>;
  markNotificationPromptDone: () => Promise<void>;
};

// Module-level singleton state, shared across every usePermissions()
// caller. This matters because RootNavigator and LocationPermissionScreen
// both subscribe — without shared state, "Continue" from the screen would
// only update the local hook and never re-render the gate above it.
let state = {
  foreground: false,
  background: false,
  notificationPromptDone: false,
  isChecking: true,
};

const listeners = new Set<() => void>();
let initialized = false;
let appState: AppStateStatus = AppState.currentState;

function emit() {
  listeners.forEach(l => l());
}

function setState(next: Partial<typeof state>) {
  state = {...state, ...next};
  emit();
}

async function readOnboardingNotifDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_NOTIF_KEY)) === '1';
  } catch {
    return false;
  }
}

async function refreshState() {
  if (!state.isChecking) setState({isChecking: true});
  try {
    const [perms, notifDone] = await Promise.all([
      checkLocationPermissions(),
      readOnboardingNotifDone(),
    ]);
    setState({
      foreground: perms.foreground,
      background: perms.background,
      notificationPromptDone: notifDone,
      isChecking: false,
    });
  } catch {
    setState({isChecking: false});
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;
  refreshState();
  AppState.addEventListener('change', next => {
    if (
      typeof appState === 'string' &&
      appState.match(/inactive|background/) &&
      next === 'active'
    ) {
      refreshState();
    }
    appState = next;
  });
}

export async function markOnboardingNotifDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_NOTIF_KEY, '1');
  setState({notificationPromptDone: true});
}

export function usePermissions(): PermissionState {
  const [, setVersion] = useState(0);

  useEffect(() => {
    initialize();
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const recheck = useCallback(() => refreshState(), []);
  const markNotificationPromptDone = useCallback(
    () => markOnboardingNotifDone(),
    [],
  );

  return {
    foreground: state.foreground,
    background: state.background,
    notificationPromptDone: state.notificationPromptDone,
    isChecking: state.isChecking,
    recheck,
    markNotificationPromptDone,
  };
}
