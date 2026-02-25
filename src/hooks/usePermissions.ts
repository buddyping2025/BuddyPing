import {useState, useEffect, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {checkLocationPermissions} from '../services/location';

type PermissionState = {
  foreground: boolean;
  background: boolean;
  isChecking: boolean;
  recheck: () => void;
};

export function usePermissions(): PermissionState {
  const [foreground, setForeground] = useState(false);
  const [background, setBackground] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const appState = useRef(AppState.currentState);

  const check = async () => {
    setIsChecking(true);
    try {
      const perms = await checkLocationPermissions();
      setForeground(perms.foreground);
      setBackground(perms.background);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    check();

    // Re-check when user returns from Settings (AppState changes to active)
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          check();
        }
        appState.current = nextState;
      },
    );

    return () => subscription.remove();
  }, []);

  return {
    foreground,
    background,
    isChecking,
    recheck: check,
  };
}
