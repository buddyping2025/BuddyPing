import BackgroundFetch from 'react-native-background-fetch';
import {supabase} from './supabase';
import {uploadLocation} from './location';

/** Shared inner logic for foreground + headless fetch ticks. */
async function performFetch(taskId: string): Promise<void> {
  try {
    const {
      data: {session},
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn('[BackgroundFetch] getSession error:', error.message);
      return;
    }

    if (!session?.user?.id) {
      // No signed-in user — nothing to sync. This is normal after sign-out.
      return;
    }

    await uploadLocation(session.user.id);
    console.log('[BackgroundFetch] location uploaded for', session.user.id);
  } catch (err) {
    console.warn('[BackgroundFetch] task', taskId, 'failed:', err);
  }
}

/**
 * Headless task handler — called when the app is terminated.
 * Registered in index.js via BackgroundFetch.registerHeadlessTask().
 */
export async function backgroundFetchHeadlessTask(event: {
  taskId: string;
  timeout: boolean;
}): Promise<void> {
  console.log('[BackgroundFetch] headless task', event.taskId);

  // The OS may invoke the headless task with `timeout: true` to signal
  // we're being shut down — must finish quickly and not start work.
  if (event.timeout) {
    console.warn('[BackgroundFetch] headless task timed out');
    BackgroundFetch.finish(event.taskId);
    return;
  }

  await performFetch(event.taskId);
  // finish() must always be called or WorkManager will refuse to
  // schedule future ticks for this app.
  BackgroundFetch.finish(event.taskId);
}

/**
 * Configure and start the background fetch scheduler.
 * Uses Android WorkManager under the hood.
 *
 * Interval is set to ~12 hours. WorkManager does not guarantee exact
 * timing — the OS may batch or defer tasks. This is intentional for
 * battery efficiency and Play Store compliance. The server-side pg_cron
 * runs at exact times (8am/8pm).
 */
export async function configureBackgroundFetch(): Promise<void> {
  try {
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
      async (taskId: string) => {
        console.log('[BackgroundFetch] foreground task', taskId);
        await performFetch(taskId);
        BackgroundFetch.finish(taskId);
      },
      (taskId: string) => {
        console.warn('[BackgroundFetch] timeout', taskId);
        BackgroundFetch.finish(taskId);
      },
    );
    console.log('[BackgroundFetch] configured, status:', status);
  } catch (err) {
    console.warn('[BackgroundFetch] configure threw:', err);
  }
}
