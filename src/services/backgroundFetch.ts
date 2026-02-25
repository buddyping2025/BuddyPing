import BackgroundFetch from 'react-native-background-fetch';
import {supabase} from './supabase';
import {uploadLocation} from './location';

/**
 * Headless task handler — called when the app is terminated.
 * Registered in index.js via BackgroundFetch.registerHeadlessTask().
 */
export async function backgroundFetchHeadlessTask(event: {
  taskId: string;
  timeout: boolean;
}): Promise<void> {
  console.log('[BackgroundFetch] headless task', event.taskId);

  if (event.timeout) {
    console.warn('[BackgroundFetch] headless task timed out');
    BackgroundFetch.finish(event.taskId);
    return;
  }

  try {
    const {
      data: {session},
    } = await supabase.auth.getSession();

    if (session?.user?.id) {
      await uploadLocation(session.user.id);
      console.log('[BackgroundFetch] location uploaded for', session.user.id);
    }
  } catch (err) {
    console.error('[BackgroundFetch] error:', err);
  } finally {
    BackgroundFetch.finish(event.taskId);
  }
}

/**
 * Configure and start the background fetch scheduler.
 * Uses Android WorkManager under the hood.
 *
 * Interval is set to ~12 hours. WorkManager does not guarantee exact timing —
 * the OS may batch or defer tasks. This is intentional for battery efficiency
 * and Play Store compliance. The server-side pg_cron runs at exact times (8am/8pm).
 */
export async function configureBackgroundFetch(): Promise<void> {
  const status = await BackgroundFetch.configure(
    {
      minimumFetchInterval: 720, // 720 minutes = 12 hours
      stopOnTerminate: false, // continue after app is swiped away
      startOnBoot: true, // re-schedule after device reboot
      enableHeadless: true, // run headless task when app is terminated
      forceAlarmManager: false, // prefer WorkManager (battery-efficient)
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      requiresCharging: false,
      requiresDeviceIdle: false,
      requiresBatteryNotLow: false,
      requiresStorageNotLow: false,
    },
    // Foreground handler (app is running or in background)
    async (taskId: string) => {
      console.log('[BackgroundFetch] foreground task', taskId);
      try {
        const {
          data: {session},
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await uploadLocation(session.user.id);
        }
      } catch (err) {
        console.error('[BackgroundFetch] foreground error:', err);
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    // Timeout handler
    (taskId: string) => {
      console.warn('[BackgroundFetch] timeout', taskId);
      BackgroundFetch.finish(taskId);
    },
  );

  console.log('[BackgroundFetch] configured, status:', status);
}
