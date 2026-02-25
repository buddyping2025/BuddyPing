/**
 * BuddyPing — proximity-check Edge Function
 *
 * Triggered twice daily by pg_cron (8:00 AM and 8:00 PM UTC).
 * For each accepted friendship pair, it:
 *   1. Calculates the GPS distance between the two users.
 *   2. Checks each user's own distance threshold.
 *   3. Sends a OneSignal push notification if within threshold.
 *   4. Enforces a max of 2 notifications per user/friend pair per day.
 *   5. Logs sent notifications to notification_logs for deduplication.
 *
 * Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   - SUPABASE_URL           (auto-set by Supabase)
 *   - SUPABASE_SERVICE_ROLE_KEY  (auto-set by Supabase)
 *   - ONESIGNAL_APP_ID
 *   - ONESIGNAL_REST_API_KEY
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID')!;
const oneSignalRestKey = Deno.env.get('ONESIGNAL_REST_API_KEY')!;

// Use service_role key to bypass RLS — this function runs server-side only
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ProximityPair {
  user_a_id: string;
  user_a_display_name: string;
  user_a_player_id: string | null;
  user_a_threshold: number;
  user_b_id: string;
  user_b_display_name: string;
  user_b_player_id: string | null;
  user_b_threshold: number;
  distance_meters: number;
}

/** Count how many notifications were sent today for a given user/friend pair */
async function getNotifCountToday(
  userId: string,
  friendId: string,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const {count, error} = await supabase
    .from('notification_logs')
    .select('*', {count: 'exact', head: true})
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .gte('notified_at', startOfDay.toISOString());

  if (error) {
    console.error('getNotifCountToday error:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** Format distance for the notification message */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `~${Math.round(meters)}m`;
  }
  const km = meters / 1000;
  return `~${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)}km`;
}

/** Send a push notification via OneSignal REST API */
async function sendPushNotification(
  playerId: string,
  message: string,
): Promise<void> {
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${oneSignalRestKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      include_player_ids: [playerId],
      contents: {en: message},
      headings: {en: 'BuddyPing 📍'},
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('OneSignal error:', response.status, body);
  }
}

Deno.serve(async (_req: Request) => {
  try {
    // Fetch all accepted friendship pairs with their distances
    const {data: pairs, error: pairsError} =
      await supabase.rpc('get_proximity_pairs');

    if (pairsError) {
      throw new Error(`get_proximity_pairs failed: ${pairsError.message}`);
    }

    let notifsSent = 0;
    let notifsSkipped = 0;

    for (const pair of (pairs as ProximityPair[]) ?? []) {
      const distLabel = formatDistance(pair.distance_meters);

      // ── Notify user_a about user_b ─────────────────────────────────
      if (
        pair.distance_meters <= pair.user_a_threshold &&
        pair.user_a_player_id
      ) {
        const count = await getNotifCountToday(pair.user_a_id, pair.user_b_id);
        if (count < 2) {
          await sendPushNotification(
            pair.user_a_player_id,
            `${pair.user_b_display_name} is ${distLabel} away from you`,
          );
          await supabase.from('notification_logs').insert({
            user_id: pair.user_a_id,
            friend_id: pair.user_b_id,
            distance_meters: pair.distance_meters,
          });
          notifsSent++;
        } else {
          notifsSkipped++;
        }
      }

      // ── Notify user_b about user_a ─────────────────────────────────
      if (
        pair.distance_meters <= pair.user_b_threshold &&
        pair.user_b_player_id
      ) {
        const count = await getNotifCountToday(pair.user_b_id, pair.user_a_id);
        if (count < 2) {
          await sendPushNotification(
            pair.user_b_player_id,
            `${pair.user_a_display_name} is ${distLabel} away from you`,
          );
          await supabase.from('notification_logs').insert({
            user_id: pair.user_b_id,
            friend_id: pair.user_a_id,
            distance_meters: pair.distance_meters,
          });
          notifsSent++;
        } else {
          notifsSkipped++;
        }
      }
    }

    const summary = {
      ok: true,
      pairs_checked: (pairs as ProximityPair[])?.length ?? 0,
      notifications_sent: notifsSent,
      notifications_skipped_dedup: notifsSkipped,
    };
    console.log('proximity-check complete:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch (err) {
    console.error('proximity-check error:', err);
    return new Response(JSON.stringify({ok: false, error: String(err)}), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    });
  }
});
