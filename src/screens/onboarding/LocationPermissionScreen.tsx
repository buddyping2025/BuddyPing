import React, {useState} from 'react';
import {View, Text, Platform, Alert} from 'react-native';
import {
  requestForegroundPermission,
  requestBackgroundPermission,
  checkLocationPermissions,
} from '../../services/location';
import {
  requestNotificationPermission,
  syncPlayerIdToSupabase,
} from '../../services/onesignal';
import {supabase} from '../../services/supabase';
import {Button} from '../../components/common/Button';
import {usePermissions} from '../../hooks/usePermissions';

type Step = 'foreground' | 'background' | 'notification' | 'done';

const STEPS: Step[] = ['foreground', 'background', 'notification', 'done'];

export function LocationPermissionScreen() {
  const {recheck} = usePermissions();
  const [step, setStep] = useState<Step>('foreground');
  const [isLoading, setIsLoading] = useState(false);

  async function handleForegroundPermission() {
    setIsLoading(true);
    try {
      const granted = await requestForegroundPermission();
      if (granted) {
        setStep('background');
      } else {
        Alert.alert(
          'Location Required',
          'BuddyPing cannot work without location access. Please allow location in your device Settings.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBackgroundPermission() {
    setIsLoading(true);
    try {
      if ((Platform.Version as number) >= 30) {
        // Android 11+: opens Settings — user must select "Allow all the time"
        // The AppState listener in usePermissions() will re-check when they return
        await requestBackgroundPermission();
        // Don't advance — wait for AppState to detect the change
        Alert.alert(
          'Select "Allow all the time"',
          'In the Settings screen that just opened, tap "Permissions" → "Location" → "Allow all the time". Then return here.',
        );
      } else {
        const granted = await requestBackgroundPermission();
        if (granted) {
          setStep('notification');
        } else {
          Alert.alert(
            'Background Location Required',
            'Please allow background location access to continue.',
          );
        }
      }
      // Do NOT call recheck() here — the AppState listener in usePermissions() handles it
    } finally {
      setIsLoading(false);
    }
  }

  // Called by AppState listener when permissions are detected as granted
  async function handlePermissionsGranted() {
    const perms = await checkLocationPermissions();
    if (perms.foreground && perms.background) {
      setStep('notification');
    }
  }

  async function handleNotificationPermission() {
    setIsLoading(true);
    try {
      await requestNotificationPermission();
      // Sync OneSignal player ID to Supabase regardless of whether granted
      const {
        data: {user},
      } = await supabase.auth.getUser();
      if (user) {
        await syncPlayerIdToSupabase(user.id);
      }
      setStep('done');
      recheck(); // this triggers RootNavigator to advance
    } finally {
      setIsLoading(false);
    }
  }

  const screens: Record<
    Step,
    {
      emoji: string;
      title: string;
      body: string;
      buttonLabel: string;
      onPress: () => void;
    }
  > = {
    foreground: {
      emoji: '📍',
      title: 'Location Access',
      body:
        'BuddyPing uses your location to let friends know how close you are. ' +
        'Your exact location is never visible to anyone — only approximate distance.',
      buttonLabel: 'Allow Location',
      onPress: handleForegroundPermission,
    },
    background: {
      emoji: '🔄',
      title: 'Background Location',
      body:
        'To check proximity even when the app is closed, BuddyPing needs background location access. ' +
        (Platform.Version as number) >= 30
          ? 'On the next screen, tap "Location" → "Allow all the time".'
          : 'Please select "Allow all the time" when prompted.',
      buttonLabel:
        (Platform.Version as number) >= 30
          ? 'Open Settings'
          : 'Allow Background Location',
      onPress: handleBackgroundPermission,
    },
    notification: {
      emoji: '🔔',
      title: 'Push Notifications',
      body:
        'Allow notifications so BuddyPing can alert you when a friend is nearby. ' +
        'We send at most 2 notifications per day.',
      buttonLabel: 'Allow Notifications',
      onPress: handleNotificationPermission,
    },
    done: {
      emoji: '✅',
      title: "You're all set!",
      body: 'BuddyPing is ready. Loading your friends…',
      buttonLabel: 'Continue',
      onPress: recheck,
    },
  };

  // Check if back button was pressed after returning from settings
  React.useEffect(() => {
    if (step === 'background') {
      handlePermissionsGranted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const current = screens[step];

  return (
    <View className="flex-1 bg-surface-subtle items-center justify-center px-8">
      <Text className="text-6xl mb-6">{current.emoji}</Text>
      <Text className="text-2xl font-bold text-content-primary text-center mb-4">
        {current.title}
      </Text>
      <Text className="text-base text-content-secondary text-center leading-6 mb-10">
        {current.body}
      </Text>

      {/* Step indicators */}
      <View className="flex-row gap-2 mb-10">
        {STEPS.map(s => (
          <View
            key={s}
            className={`h-2 rounded-full ${
              s === step
                ? 'w-6 bg-brand-500'
                : STEPS.indexOf(s) < STEPS.indexOf(step)
                ? 'w-2 bg-brand-200'
                : 'w-2 bg-border'
            }`}
          />
        ))}
      </View>

      <Button
        title={current.buttonLabel}
        onPress={current.onPress}
        isLoading={isLoading}
        fullWidth
      />
    </View>
  );
}
