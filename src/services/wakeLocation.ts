import {supabase} from './supabase';
import {uploadLocation} from './location';

/**
 * Invoked from the FCM background message handler when the server sends
 * a `{type: "request_location_update"}` data-only push. Runs in a brief
 * background JS context — even when the app is killed — and pushes
 * fresh GPS coords to Supabase so the upcoming proximity-check tick
 * sees a current location for this user.
 *
 * Mirrors the behaviour of backgroundFetch's performFetch(): pull the
 * signed-in user from the cached Supabase session (AsyncStorage, which
 * is what makes this work outside the React tree), then defer to the
 * shared uploadLocation() so there is only one place that writes GPS.
 */
export async function wakeAndUploadLocation(): Promise<void> {
  try {
    const {
      data: {session},
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn('[wakeLocation] getSession error:', error.message);
      return;
    }

    if (!session?.user?.id) {
      return;
    }

    await uploadLocation(session.user.id);
    console.log('[wakeLocation] uploaded for', session.user.id);
  } catch (err) {
    console.warn('[wakeLocation] failed:', err);
  }
}
