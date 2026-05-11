import {useEffect, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {uploadLocation} from '../services/location';

// Throttle foreground location uploads — proximity is checked twice a day
// server-side, so once every ~30 minutes from the foreground app is more
// than enough fidelity without burning the user's battery.
const MIN_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Keeps the user's `last_location` row fresh while the app is in the
 * foreground. Without this, a brand-new user would have to wait for the
 * next ~12h background-fetch tick before any proximity check could find
 * them — meaning their first day in the app produces no notifications.
 */
export function useLocationSync(
  userId: string | undefined,
  enabled: boolean,
): void {
  const lastUploadRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!userId || !enabled) return;

    const trySync = async (force: boolean = false) => {
      if (inFlightRef.current) return;
      const now = Date.now();
      if (!force && now - lastUploadRef.current < MIN_INTERVAL_MS) return;
      inFlightRef.current = true;
      try {
        await uploadLocation(userId);
        lastUploadRef.current = Date.now();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'unknown error';
        console.warn('[useLocationSync] upload failed:', message);
      } finally {
        inFlightRef.current = false;
      }
    };

    // Initial sync — force, ignoring throttle.
    trySync(true);

    const sub = AppState.addEventListener('change', next => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        trySync();
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, [userId, enabled]);
}
