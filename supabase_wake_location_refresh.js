/**
 * BuddyPing — wake-location-refresh Edge Function
 *
 * Triggered by pg_cron at 02:20 UTC (07:50 IST) and 14:20 UTC (19:50 IST) —
 * 10 minutes before the proximity-check function runs at 02:30 / 14:30 UTC.
 *
 * Sends an FCM data-only push to every user whose last_location is older
 * than ~11 hours, waking their app (even when killed) so it grabs fresh
 * GPS coordinates before proximity-check reads from users.last_location.
 *
 * Different transport from OneSignal on purpose: OneSignal RN SDK cannot
 * run JS handlers when the app is killed without a native Notification
 * Service Extension. FCM v1 + @react-native-firebase/messaging's
 * setBackgroundMessageHandler runs JS reliably in that state.
 *
 * Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   - SUPABASE_URL               (auto-set by Supabase)
 *   - SUPABASE_SERVICE_ROLE_KEY  (auto-set by Supabase)
 *   - FCM_SERVICE_ACCOUNT_JSON   — entire JSON from Firebase Console →
 *                                  Project Settings → Service Accounts →
 *                                  Generate new private key (paste the
 *                                  whole file contents as one secret).
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://esm.sh/jose@5';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')!;

console.log('[boot] SUPABASE_URL:', supabaseUrl);
console.log(
  '[boot] FCM_SERVICE_ACCOUNT_JSON length:',
  fcmServiceAccountJson?.length,
);

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
}

const serviceAccount: ServiceAccount = JSON.parse(fcmServiceAccountJson);
console.log('[boot] FCM project_id:', serviceAccount.project_id);
console.log('[boot] FCM client_email:', serviceAccount.client_email);

/**
 * Exchange the service-account private key for a short-lived OAuth 2.0
 * access token scoped to FCM. Token is valid for ~1h; we acquire a fresh
 * one per function invocation since cron only fires twice a day.
 */
async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const privateKey = await jose.importPKCS8(
    serviceAccount.private_key,
    'RS256',
  );
  const assertion = await new jose.SignJWT(claims)
    .setProtectedHeader({alg: 'RS256', typ: 'JWT'})
    .sign(privateKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`OAuth token exchange failed: ${tokenRes.status} ${body}`);
  }

  const {access_token: accessToken} = (await tokenRes.json()) as {
    access_token: string;
  };
  return accessToken;
}

/**
 * Send a data-only high-priority FCM push to a single device.
 * `priority: HIGH` is what bypasses Doze on Android; without it the
 * message would be batched and may not arrive for hours on idle devices.
 */
async function sendWakePush(
  accessToken: string,
  fcmToken: string,
): Promise<void> {
  const url =
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const body = {
    message: {
      token: fcmToken,
      data: {type: 'request_location_update'},
      android: {priority: 'HIGH'},
      apns: {
        headers: {'apns-priority': '5', 'apns-push-type': 'background'},
        payload: {aps: {'content-available': 1}},
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`FCM send failed: ${res.status} ${errBody}`);
  }
}

Deno.serve(async (_req: Request) => {
  try {
    // Stale-only: anyone whose last_location_updated_at is within 11h
    // is fresh enough; skip them to avoid wasted pushes. Also skip users
    // with no fcm_token (not on a current build, or push disabled).
    const elevenHoursAgo = new Date(
      Date.now() - 11 * 60 * 60 * 1000,
    ).toISOString();

    const {data: users, error: usersError} = await supabase
      .from('users')
      .select('id, fcm_token, last_location_updated_at')
      .not('fcm_token', 'is', null)
      .or(
        `last_location_updated_at.is.null,last_location_updated_at.lt.${elevenHoursAgo}`,
      );

    if (usersError) {
      throw new Error(`fetch stale users failed: ${usersError.message}`);
    }

    const targets = (users ?? []) as {id: string; fcm_token: string}[];
    console.log(`[wake] ${targets.length} stale users to wake`);

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ok: true, requested: 0, succeeded: 0, failed: 0}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      );
    }

    const accessToken = await getFcmAccessToken();

    let succeeded = 0;
    let failed = 0;
    for (const user of targets) {
      try {
        await sendWakePush(accessToken, user.fcm_token);
        succeeded++;
      } catch (err) {
        failed++;
        console.warn(`[wake] failed for user ${user.id}:`, String(err));
        // If FCM reports the token as unregistered (UNREGISTERED /
        // NOT_FOUND), clear it so we don't keep retrying every 12h.
        const msg = String(err);
        if (msg.includes('UNREGISTERED') || msg.includes('NOT_FOUND')) {
          await supabase
            .from('users')
            .update({fcm_token: null})
            .eq('id', user.id);
        }
      }
    }

    const summary = {
      ok: true,
      requested: targets.length,
      succeeded,
      failed,
    };
    console.log('[wake] complete:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch (err) {
    console.error('[wake] error:', err);
    return new Response(JSON.stringify({ok: false, error: String(err)}), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    });
  }
});
