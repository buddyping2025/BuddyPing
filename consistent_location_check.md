# Consistent Background Location Check

## Why this exists

`react-native-background-fetch` (current setup, `src/services/backgroundFetch.ts:67`, `minimumFetchInterval: 720`) is best-effort. Android Doze, App Standby Buckets, OEM background killers (MIUI, EMUI, ColorOS, One UI), and user force-stops will silently skip ticks — so on a meaningful fraction of devices, `users.last_location` will be days stale when the proximity-check cron runs at 02:30 / 14:30 UTC (= 08:00 / 20:00 IST). Requirement: every 12h at any cost, even if the app is not opened.

The only mechanism that reliably wakes a killed Android app on a server's schedule is a **high-priority data-only push from the server**. The OS treats FCM high-priority data messages as user-visible enough to bypass Doze, even when the app is in the `restricted` bucket. The RN library `@react-native-firebase/messaging` exposes a `setBackgroundMessageHandler` that runs JS in a brief background context when this push arrives — including when the app is killed. The handler grabs GPS and writes to Supabase, exactly the same path the existing foreground/background fetch already uses.

This sits **on top of** `react-native-background-fetch` (don't remove it — it's free insurance) and is pg_cron-triggered from the server, 10 minutes before each proximity-check tick.

## Architecture

```
pg_cron (02:20 UTC / 14:20 UTC, 10 min before proximity-check)
  ↓ net.http_post →  Edge Function `wake-location-refresh`
                       ↓ select users where last_location_updated_at < now() - 11h
                       ↓ for each → FCM v1 HTTP API, data-only push, priority=high
                                       ↓
                                  Device receives FCM message
                                       ↓ (OS wakes app's JS context briefly)
                                  setBackgroundMessageHandler in index.js
                                       ↓ if data.type === 'request_location_update'
                                       ↓ getCurrentPosition() + uploadLocation()
                                       ↓ Supabase users.last_location updated

pg_cron (02:30 UTC / 14:30 UTC) → proximity-check → reads fresh last_location → OneSignal pushes
```

OneSignal is kept exclusively for **user-visible** proximity notifications. FCM is added solely for the **silent wake** — different transport, different purpose, no overlap.

## Why FCM and not OneSignal silent push

OneSignal RN SDK does **not** invoke JS handlers when the app is killed for silent/data-only payloads — its background-receive path requires implementing a Notification Service Extension natively (Kotlin `MainApplication` override on Android, Swift NSE target on iOS). For RN apps, `@react-native-firebase/messaging` solves the same problem with a single JS function registered in `index.js`, no native module to write. `google-services.json` is already in place per `CLAUDE.md`, so the Firebase project is provisioned.

## Changes

### Server side

**1. New Supabase Edge Function: `wake-location-refresh`** (pasted into the Dashboard as a new function, same workflow as `proximity-check`)

Single new file `/home/logicgates/BuddyPing/supabase_wake_location_refresh.js` (a reference copy that gets pasted into Dashboard → Edge Functions → New function → `wake-location-refresh`). It will:

- Read secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT_JSON` (new — the entire Firebase service account JSON, pasted as a single secret).
- Select all users where `fcm_token IS NOT NULL` and `last_location_updated_at < now() - interval '11 hours'` (skip already-fresh users to avoid push spam and keep FCM quotas low).
- Sign a short-lived JWT (RS256, `aud=https://oauth2.googleapis.com/token`, `scope=https://www.googleapis.com/auth/firebase.messaging`) using the service account's private key, exchange it for an OAuth access token at `https://oauth2.googleapis.com/token`.
- For each stale user, POST to `https://fcm.googleapis.com/v1/projects/<project-id>/messages:send` with:
  ```json
  {
    "message": {
      "token": "<user fcm_token>",
      "data": { "type": "request_location_update" },
      "android": { "priority": "HIGH" },
      "apns": {
        "headers": { "apns-priority": "5", "apns-push-type": "background" },
        "payload": { "aps": { "content-available": 1 } }
      }
    }
  }
  ```
  `data`-only with `android.priority=HIGH` is the magic that bypasses Doze.
- Reuse the OAuth access token across the loop (cache for ~50 min — token lifetime is 1h).
- Log per-user success/failure; return `{ ok, requested, succeeded, failed }`.

**2. New DB column on `users`:** `fcm_token text` (nullable).

```sql
alter table public.users add column if not exists fcm_token text;
create index if not exists idx_users_fcm_token
  on public.users(fcm_token)
  where fcm_token is not null;
```

(`onesignal_player_id` stays untouched — separate transport for separate purpose.)

**3. New pg_cron jobs** (run in SQL Editor, alongside the existing `proximity-check-*` schedules):

```sql
select cron.schedule(
  'wake-location-morning',
  '20 2 * * *',   -- 02:20 UTC = 07:50 IST, 10 min before proximity-check-morning
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/wake-location-refresh',
      headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
select cron.schedule(
  'wake-location-evening',
  '20 14 * * *',  -- 14:20 UTC = 19:50 IST, 10 min before proximity-check-evening
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/wake-location-refresh',
      headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
```

**4. New Supabase Edge Function secret:** `FCM_SERVICE_ACCOUNT_JSON` — the full JSON of a Firebase service account with the `Firebase Cloud Messaging Admin` role (Firebase Console → Project Settings → Service Accounts → Generate new private key, paste entire JSON as the secret value).

### Client side

**5. Add dependencies** (`package.json`):

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

`google-services.json` is already at `android/app/google-services.json` per `CLAUDE.md` — no Gradle work needed beyond what RNFB's autolinking does. iOS would need additional config, but the project is Android-focused per CLAUDE.md so iOS is out of scope here.

**6. Register the FCM background handler in `index.js`** — must be the *very first* thing after the polyfill imports, before `AppRegistry.registerComponent`, because the OS spins up the JS context fresh and the handler must be registered synchronously at module load:

```js
import messaging from '@react-native-firebase/messaging';
import {wakeAndUploadLocation} from './src/services/wakeLocation';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage?.data?.type === 'request_location_update') {
    await wakeAndUploadLocation();
  }
});
```

**7. New file `/home/logicgates/BuddyPing/src/services/wakeLocation.ts`** — thin wrapper that reuses the existing `performFetch`/`uploadLocation` path:

```ts
import {supabase} from '@/lib/supabase';
import {uploadLocation} from '@/services/location';

export async function wakeAndUploadLocation(): Promise<void> {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await uploadLocation(session.user.id);
}
```

Uses existing `uploadLocation()` at `src/services/location.ts:117` — no new GPS logic, no new Supabase writer.

**8. FCM token registration** — extend `src/hooks/useAuth.ts` (or wherever post-sign-in setup runs alongside OneSignal player_id registration):

```ts
import messaging from '@react-native-firebase/messaging';

// after appUser is loaded:
const fcmToken = await messaging().getToken();
if (fcmToken && fcmToken !== appUser.fcm_token) {
  await supabase.from('users').update({fcm_token: fcmToken}).eq('id', appUser.id);
}

// also subscribe to token refresh:
const unsub = messaging().onTokenRefresh(async newToken => {
  await supabase.from('users').update({fcm_token: newToken}).eq('id', appUser.id);
});
```

The `useFriends` and `useAuth` hooks already perform user-row writes, so the pattern is established. FCM token rotates occasionally; the refresh listener keeps `users.fcm_token` in sync.

**9. `AndroidManifest.xml`** — RNFB's autolinking adds the FCM `Service` automatically; no manual entries required.

## Critical files

- **New:** `/home/logicgates/BuddyPing/supabase_wake_location_refresh.js` — reference copy of the new Edge Function (pasted into Dashboard).
- **New:** `/home/logicgates/BuddyPing/src/services/wakeLocation.ts` — `wakeAndUploadLocation()`.
- **Edit:** `/home/logicgates/BuddyPing/index.js` — register `setBackgroundMessageHandler` *before* `AppRegistry.registerComponent` and after the existing polyfill/gesture-handler imports (the load-bearing order called out in `CLAUDE.md`).
- **Edit:** `/home/logicgates/BuddyPing/src/hooks/useAuth.ts` — capture FCM token on sign-in + refresh.
- **Edit:** `/home/logicgates/BuddyPing/package.json` — add `@react-native-firebase/app`, `@react-native-firebase/messaging`.
- **DB migration:** add `users.fcm_token` column (run in Supabase SQL Editor, also append to `supabase/migrations/001_initial_schema.sql` for reproducibility).
- **Schedule:** two new `cron.schedule(...)` blocks (run in SQL Editor, also append commented-out to `supabase/migrations/001_initial_schema.sql`).
- **Secret:** `FCM_SERVICE_ACCOUNT_JSON` set in Supabase Dashboard → Edge Functions → Secrets.
- **Reused:** `src/services/location.ts:117` (`uploadLocation`), `src/services/backgroundFetch.ts` (kept as-is for additional best-effort coverage).

## Trade-offs / things to be aware of

- **Adds one dependency family** (`@react-native-firebase/*`). Bumps Android APK size by ~1 MB.
- **Adds one new secret** (Firebase service account JSON — keep it in Supabase secrets, never commit).
- **Push quota:** FCM is free at the volumes BuddyPing is at (well under millions/day). No cost concern.
- **Battery:** ~2 wake-ups/day × ~1 second of JS execution + 1 GPS read. Negligible.
- **Per-user opt-out:** if a user disables push notifications entirely at the OS level, the FCM wake won't fire — same constraint already applies to OneSignal proximity notifications, so no regression.
- **iOS:** plan above is Android-correct. iOS background data delivery via FCM works but requires NSE setup. Out of scope until iOS becomes a target.
- **Doesn't replace `react-native-background-fetch`:** keep it. It catches users who have FCM disabled, and runs the same `uploadLocation` path so there's no risk of divergence.

## Verification

1. **DB:** `select column_name from information_schema.columns where table_name='users' and column_name='fcm_token';` returns one row.
2. **Token registration:** sign in on a test device, then in SQL Editor: `select id, fcm_token, last_location_updated_at from users where id = '<test-user-id>';` — `fcm_token` should be a ~150-char string.
3. **Edge Function isolated test:** in SQL Editor, force the test user to look stale:
   ```sql
   update users set last_location_updated_at = now() - interval '12 hours' where id = '<test-user-id>';
   ```
   Then manually trigger the new function:
   ```sql
   select net.http_post(
     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/wake-location-refresh',
     headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type','application/json'),
     body    := '{}'::jsonb
   );
   ```
   Wait ~10 s and re-query `last_location_updated_at` — should be `now()`. Function logs (Dashboard → Edge Functions → `wake-location-refresh` → Logs) should show `{ requested: 1, succeeded: 1, failed: 0 }`.
4. **App-killed test:** install on a physical Android device, sign in, force-stop the app, repeat step 3. `last_location_updated_at` should still refresh — this is the definitive proof the wake works without user interaction.
5. **End-to-end timing test:** wait for the actual 02:20 UTC tick (or temporarily reschedule to `*/15 * * * *` for 15 min). Check `cron.job_run_details` for `wake-location-refresh-*` jobs (`succeeded`), check `net._http_response` for `200`, check Edge Function logs, check `users.last_location_updated_at` deltas across the user base.
6. **OEM check:** repeat step 4 on a Xiaomi/Realme/Vivo device if available — these are where best-effort approaches fail and where this architecture should hold up. If a specific OEM still blocks, the only remaining lever is asking the user to add the app to autostart / battery whitelist (Settings deeplink helper).

## Rollout order

To avoid a broken intermediate state, do it in this order:

1. Add `fcm_token` column (no app changes yet — safe additive migration).
2. Set `FCM_SERVICE_ACCOUNT_JSON` secret.
3. Deploy the `wake-location-refresh` Edge Function (works even with zero FCM tokens — just no-ops).
4. Ship a client release that adds RNFB, registers FCM token on sign-in, and registers the background handler.
5. After most users have updated and their `fcm_token` is populated, add the two `cron.schedule(...)` jobs.
6. Watch Dashboard logs for 2–3 days; confirm `last_location_updated_at` distribution tightens.
