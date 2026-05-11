import React, {useState, useEffect} from 'react';
import {View, Text, Platform, Alert} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import {
  MapPin,
  RefreshCw,
  Bell,
  CheckCircle2,
} from 'lucide-react-native';
import {
  requestForegroundPermission,
  requestBackgroundPermission,
} from '../../services/location';
import {requestNotificationPermission} from '../../services/onesignal';
import {Button} from '../../components/common/Button';
import {usePermissions} from '../../hooks/usePermissions';

type Step = 'foreground' | 'background' | 'notification' | 'done';
const STEPS: Step[] = ['foreground', 'background', 'notification', 'done'];

const STEP_ICONS: Record<Step, React.ComponentType<any>> = {
  foreground: MapPin,
  background: RefreshCw,
  notification: Bell,
  done: CheckCircle2,
};

function StepDot({isActive, isPast}: {isActive: boolean; isPast: boolean}) {
  const dotWidth = useSharedValue(isActive ? 24 : 8);

  useEffect(() => {
    dotWidth.value = withSpring(isActive ? 24 : 8, {damping: 20, stiffness: 300});
  }, [isActive, dotWidth]);

  const animStyle = useAnimatedStyle(() => ({width: dotWidth.value}));

  const bgColor = isActive ? '#6366F1' : isPast ? '#C7D2FE' : '#E5E7EB';

  return (
    <Animated.View
      style={[{height: 8, borderRadius: 4, backgroundColor: bgColor}, animStyle]}
    />
  );
}

export function LocationPermissionScreen() {
  const {recheck, markNotificationPromptDone, foreground, background} =
    usePermissions();
  const [step, setStep] = useState<Step>('foreground');
  const [isLoading, setIsLoading] = useState(false);

  // Advance to the right step whenever the live permission state catches
  // up (e.g. user restarted app mid-onboarding, or just returned from the
  // Settings app on Android 11+ after granting background location).
  useEffect(() => {
    setStep(prev => {
      if (prev === 'done') return prev;
      if (foreground && background) {
        return prev === 'foreground' || prev === 'background'
          ? 'notification'
          : prev;
      }
      if (foreground) {
        return prev === 'foreground' ? 'background' : prev;
      }
      return prev;
    });
  }, [foreground, background]);

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
        await requestBackgroundPermission();
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
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNotificationPermission() {
    setIsLoading(true);
    try {
      // Player ID is synced automatically via the OneSignal subscription
      // observer set up in initializeOneSignal(). The result of the
      // permission dialog (granted or denied) doesn't gate the app — the
      // user can change their mind in Settings later.
      await requestNotificationPermission();
    } catch (err) {
      console.warn('[LocationPermissionScreen] notification permission:', err);
    } finally {
      // Mark prompt as completed regardless of grant outcome so we don't
      // re-block the user on future launches.
      try {
        await markNotificationPromptDone();
      } catch {}
      setStep('done');
      recheck();
      setIsLoading(false);
    }
  }

  const screens: Record<
    Step,
    {title: string; body: string; buttonLabel: string; onPress: () => void}
  > = {
    foreground: {
      title: 'Location Access',
      body:
        'BuddyPing uses your location to let friends know how close you are. ' +
        'Your exact location is never visible to anyone — only approximate distance.',
      buttonLabel: 'Allow Location',
      onPress: handleForegroundPermission,
    },
    background: {
      title: 'Background Location',
      body:
        'To check proximity even when the app is closed, BuddyPing needs background location access. ' +
        ((Platform.Version as number) >= 30
          ? 'On the next screen, tap "Location" → "Allow all the time".'
          : 'Please select "Allow all the time" when prompted.'),
      buttonLabel:
        (Platform.Version as number) >= 30
          ? 'Open Settings'
          : 'Allow Background Location',
      onPress: handleBackgroundPermission,
    },
    notification: {
      title: 'Push Notifications',
      body:
        'Allow notifications so BuddyPing can alert you when a friend is nearby. ' +
        'We send at most 2 notifications per day.',
      buttonLabel: 'Allow Notifications',
      onPress: handleNotificationPermission,
    },
    done: {
      title: "You're all set!",
      body: 'BuddyPing is ready. Loading your friends…',
      buttonLabel: 'Continue',
      onPress: recheck,
    },
  };

  const current = screens[step];
  const stepIndex = STEPS.indexOf(step);
  const IconComponent = STEP_ICONS[step];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}>
      {/* Animated content keyed by step */}
      <Animated.View
        key={step}
        entering={FadeInUp.duration(300)}
        style={{alignItems: 'center', width: '100%'}}>
        {/* Icon circle */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: '#E0E7FF',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}>
          <IconComponent size={48} color="#6366F1" strokeWidth={1.5} />
        </View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#111827',
            textAlign: 'center',
            marginBottom: 16,
          }}>
          {current.title}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: 40,
          }}>
          {current.body}
        </Text>
      </Animated.View>

      {/* Step indicator dots */}
      <View style={{flexDirection: 'row', gap: 8, marginBottom: 40}}>
        {STEPS.map((s, i) => (
          <StepDot key={s} isActive={s === step} isPast={i < stepIndex} />
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
