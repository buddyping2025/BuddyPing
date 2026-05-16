Step 1 — Pre-flight: inspect both user rows and decode last_location

 Run this single query in the Supabase SQL Editor (Dashboard → SQL Editor → New query). It decodes the PostGIS point to lat/lng, surfaces every gating column the Edge Function reads,
 and shows freshness:

 select
   id,
   email,
   display_name,
   ST_Y(last_location::geometry) as latitude,
   ST_X(last_location::geometry) as longitude,
   last_location_updated_at,
   age(now(), last_location_updated_at) as location_age,
   distance_threshold_meters,
   onesignal_player_id is not null as has_onesignal_id
 from public.users
 order by created_at;

 Why ST_Y is latitude and ST_X is longitude: WKT order is POINT(lng lat), so ST_X returns longitude and ST_Y returns latitude (per CLAUDE.md "Location Data Format" note). Reversing
 this in a sanity check is the most common error.

 The user manually verifies:
 - Each (latitude, longitude) pair matches the real-world location they expect for that account (e.g. paste into Google Maps).
 - last_location_updated_at is recent (within hours, not days).
 - has_onesignal_id = true for both rows.
 - distance_threshold_meters matches what they configured in the app (default 5000).

 If onesignal_player_id is null for an account, that account will not receive a push even if it's within threshold — supabase/functions/proximity-check/index.ts:116,138. The user
 needs to open the app on that account's device to register the player ID.

 ---
 Step 2 — Pre-flight: verify accepted friendship between the two accounts

 select
   f.id,
   f.requester_id,
   f.addressee_id,
   f.status,
   f.created_at,
   ur.display_name as requester_name,
   ua.display_name as addressee_name
 from public.friendships f
 join public.users ur on ur.id = f.requester_id
 join public.users ua on ua.id = f.addressee_id
 order by f.created_at desc;

 Pass: exactly one row connecting the two test accounts with status = 'accepted'. The get_proximity_pairs() function at supabase/migrations/001_initial_schema.sql:154-191 requires
 status = 'accepted' and emits no rows otherwise.

 If only pending exists: the addressee account must accept it from inside the app before continuing.

 ---
 Step 3 — Pre-flight: compute the actual distance and predict the outcome

 Before invoking, predict what the function should do, so the run validates expectation rather than reveals it.

 select
   ua.display_name as user_a,
   ub.display_name as user_b,
   ua.distance_threshold_meters as user_a_threshold,
   ub.distance_threshold_meters as user_b_threshold,
   ST_Distance(ua.last_location::geography, ub.last_location::geography) as distance_meters,
   ST_Distance(ua.last_location::geography, ub.last_location::geography) <= ua.distance_threshold_meters as user_a_should_be_notified,
   ST_Distance(ua.last_location::geography, ub.last_location::geography) <= ub.distance_threshold_meters as user_b_should_be_notified
 from public.friendships f
 join public.users ua on ua.id = f.requester_id
 join public.users ub on ub.id = f.addressee_id
 where f.status = 'accepted';

 This mirrors what the Edge Function will compute internally (supabase/functions/proximity-check/index.ts uses distance_meters returned by get_proximity_pairs() and compares it
 independently against each user's threshold — index.ts:108-150).

 Note for the user: if both accounts share the same physical phone location (likely, since both belong to them), the distance will be ~0 and both users should be notified. If the
 locations are far apart, neither should be — that is still a valid validation; we'll verify the function correctly emits zero notifications.

 ---
 Step 4 — Check today's dedup state in notification_logs

 The Edge Function skips any pair that has already received ≥ 2 logs today (UTC midnight floor) — supabase/functions/proximity-check/index.ts:42-61, 118-119, 140-141. If the user has
 been testing earlier today, they may have already hit the cap.

 select
   user_id,
   friend_id,
   notified_at,
   distance_meters
 from public.notification_logs
 where notified_at >= date_trunc('day', now() at time zone 'UTC')
 order by notified_at desc;

 If a (user_id, friend_id) pair already has 2 rows today, the upcoming invocation will skip that direction. Options at that point — both require the user's explicit approval before we
  touch anything:

 - Delete today's rows for that pair so the run sends fresh notifications (destructive — needs approval).
 - Accept that the invocation will report notifications_skipped_dedup and validate just that the function ran without error.

 We will pause and ask the user which path before doing anything destructive.

 ---
 Step 5 — Invoke the Edge Function from the Supabase SQL Editor

 The user pastes this into the SQL Editor, substituting their project ref and service role key:

 select net.http_post(
   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/proximity-check',
   headers := jsonb_build_object(
     'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
     'Content-Type', 'application/json'
   ),
   body := '{}'::jsonb
 );

 net.http_post returns a single row with status_code, headers, content (and may be wrapped depending on pg_net version — the user can select (net.http_post(...)).* if needed).

 Expected response (function body):
 {
   "ok": true,
   "pairs_checked": 1,
   "notifications_sent": <0 or 1 or 2>,
   "notifications_skipped_dedup": <0 or more>
 }

 Cross-reference notifications_sent against the prediction from Step 3 — they should match (modulo dedup from Step 4).

 ---
 Step 6 — Verify the run end-to-end

 Three independent verification surfaces:

 a) Edge Function logs
 - Supabase Dashboard → Edge Functions → proximity-check → Logs (real-time).
 - Look for console.log('proximity-check complete:', summary) from index.ts:164.
 - Any console.error lines indicate failure modes (OneSignal REST error, get_proximity_pairs failure, dedup query failure — index.ts:57, 93, 104, 171).

 b) Fresh rows in notification_logs
 select * from public.notification_logs
 order by notified_at desc
 limit 5;
 A successful send writes one row per notified user. So if both users were within threshold and neither was deduped, two new rows should appear (one per direction).

 c) OneSignal delivery
 - OneSignal Dashboard → Messages / Delivery tab.
 - Confirm two pushes (or however many notifications_sent reported) were dispatched, and check delivery status to each player ID.

 d) Phone-side
 - If both accounts are signed in on the user's device(s), the actual push notification should appear. If only one phone is used, only that account's push will be visible on the
 device; the other account's push will still be logged by OneSignal but won't surface anywhere visible to the user.

 b) Fresh rows in notification_logs
 select * from public.notification_logs
 order by notified_at desc
 limit 5;
 A successful send writes one row per notified user. So if both users were within threshold and neither was deduped, two new rows should appear (one per direction).

 c) OneSignal delivery
 - OneSignal Dashboard → Messages / Delivery tab.
 - Confirm two pushes (or however many notifications_sent reported) were dispatched, and check delivery status to each player ID.

 d) Phone-side
 - If both accounts are signed in on the user's device(s), the actual push notification should appear. If only one phone is used, only that account's push will be visible on the
 device; the other account's push will still be logged by OneSignal but won't surface anywhere visible to the user.

 ---
 Critical files (read-only references, not modified)

 - supabase/functions/proximity-check/index.ts — Edge Function logic (HTTP entry, dedup, OneSignal POST, summary log).
 - supabase/migrations/001_initial_schema.sql:154-191 — get_proximity_pairs() definition; lines 16-38 (users), 47-60 (friendships), 71-81 (notification_logs).
 - SUPABASE_SETUP.md:141-235 — deployment + manual invocation reference, only consulted if Step 0 reveals the function is not deployed.
 - .env — source of SUPABASE_URL (for project ref) and ONESIGNAL_APP_ID.

 ---
 What this plan does NOT do

 - No code changes to the Edge Function, SQL, or app.
 - No deploy of the Edge Function (the user approves that separately if Step 0 shows it's missing).
 - No deletion of notification_logs rows (the user approves that separately if Step 4 shows dedup is blocking).
 - No setting of secrets (the user provides the value and approves the supabase secrets set call if Step 0 shows one is missing).
 - No change to either account's data (location, threshold, player ID).

 Every action that touches state is gated behind explicit user approval after a finding from a read-only step.
