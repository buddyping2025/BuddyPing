import {useEffect, useState, useCallback} from 'react';
import {AppState, AppStateStatus, NativeEventSubscription} from 'react-native';
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
let appStateSubscription: NativeEventSubscription | null = null;
let inFlightRefresh: Promise<void> | null = null;

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

async function refreshState(): Promise<void> {
  // Coalesce overlapping calls — if a refresh is in flight we ride along
  // with it instead of issuing parallel permission checks.
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
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
    } catch (err) {
      console.warn('[usePermissions] refresh failed:', err);
      setState({isChecking: false});
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

function initialize() {
  if (initialized) return;
  initialized = true;
  refreshState();
  // Remove any existing handle defensively (e.g. after Fast Refresh in
  // development) before subscribing again.
  appStateSubscription?.remove();
  appStateSubscription = AppState.addEventListener('change', next => {
    if (
      typeof appState === 'string' &&
      /inactive|background/.test(appState) &&
      next === 'active'
    ) {
      refreshState();
    }
    appState = next;
  });
}

export async function markOnboardingNotifDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_NOTIF_KEY, '1');
  } catch (err) {
    console.warn('[usePermissions] markOnboardingNotifDone storage error:', err);
  }
  setState({notificationPromptDone: true});
}

/** Test-only — tears down the singleton so each test gets a clean slate. */
export function __resetPermissionsForTest(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
  listeners.clear();
  state = {
    foreground: false,
    background: false,
    notificationPromptDone: false,
    isChecking: true,
  };
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
