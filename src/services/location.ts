import Geolocation from 'react-native-geolocation-service';
import {PermissionsAndroid, Platform, Linking} from 'react-native';
import {supabase} from './supabase';

export async function requestForegroundPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'BuddyPing Needs Your Location',
      message:
        'BuddyPing uses your location to let your friends know how close you are. ' +
        'Your exact location is never shared — only approximate distance.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Deny',
      buttonPositive: 'Allow',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Request background location permission.
 *
 * On Android 11+ (API 30+) the OS will not show a dialog — you MUST
 * send the user to Settings and ask them to choose "Allow all the time".
 * On Android 10 and below, a dialog is shown.
 *
 * Returns true only if the permission is already granted (caller must
 * re-check after the user returns from Settings on Android 11+).
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // First check if already granted (e.g. user comes back from Settings)
  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  );
  if (alreadyGranted) return true;

  if ((Platform.Version as number) >= 30) {
    // Android 11+: programmatic request silently fails — open Settings
    await Linking.openSettings();
    return false; // caller must re-check via AppState listener
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    {
      title: 'Always-On Location Required',
      message:
        'BuddyPing needs background location access to check how close ' +
        'your friends are even when the app is closed. ' +
        'Please select "Allow all the time" on the next screen.',
      buttonPositive: 'Open Settings',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  if (Platform.OS !== 'android') return {foreground: true, background: true};

  const foreground = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  const background = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  );
  return {foreground, background};
}

export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
      },
    );
  });
}

/**
 * Get current GPS position and write it to the user's row in Supabase.
 * Stores only the LATEST location — no history is kept.
 * PostGIS expects POINT(longitude latitude) — longitude comes first.
 */
export async function uploadLocation(userId: string): Promise<void> {
  const coords = await getCurrentPosition();

  const {error} = await supabase
    .from('users')
    .update({
      last_location: `POINT(${coords.longitude} ${coords.latitude})`,
      last_location_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to upload location: ${error.message}`);
  }
}
