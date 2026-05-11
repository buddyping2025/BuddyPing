# Supabase Setup — BuddyPing

A step-by-step guide to provisioning the BuddyPing backend from a brand
new Supabase account. Follow the steps in order — later steps depend on
earlier ones.

**Time estimate:** 30–45 minutes the first time.

You will need:

- A Supabase account (free tier is fine for development).
- A Google Cloud / Firebase project (for Google Sign-In).
- A OneSignal account with the BuddyPing app already created (the App
  ID is already in `.env`: `a655d68c-44cc-48aa-be39-44a7d51a6808`).
- The repo cloned locally with the `.env` file present.

If anything is unclear, check the architecture doc at
`functionality.md` for the *why* behind each step.

---

## 0. Glossary

| Term                    | What it is                                            |
|-------------------------|-------------------------------------------------------|
| Project ref             | The subdomain of your Supabase URL — e.g. `abcdwxyz` from `https://abcdwxyz.supabase.co`. |
| Anon key                | Public client key. Goes in the mobile app `.env`. RLS-restricted. |
| Service role key        | **Secret** server-side key that bypasses RLS. Never put in the app. |
| RLS                     | Row Level Security — Postgres policies that decide which rows each user can read/write. |
| `auth.uid()`            | A Postgres function that returns the currently signed-in user's UUID inside an RLS policy. |
| Edge Function           | Server-side TypeScript code Supabase runs on Deno Deploy. Used for the proximity check. |
| `pg_cron`               | Postgres extension that schedules SQL on a cron expression. |
| `pg_net`                | Postgres extension that lets SQL make outbound HTTP calls. Used by `pg_cron` to call the Edge Function. |
| PostGIS                 | Postgres extension for geographic types. We store user GPS as `GEOGRAPHY(POINT, 4326)`. |

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> and sign in.
2. Click **New project** in your organisation.
3. Fill in:
   - **Name:** `buddyping` (or whatever you want).
   - **Database password:** generate a strong one and **save it in
     your password manager**. You will rarely need it day-to-day, but
     you cannot view it later.
   - **Region:** pick the region closest to your users. Cron jobs run
     in this region.
4. Wait ~2 minutes for the project to provision.

You now have a project. Note the **project ref** — it is the random
string in your Supabase URL (e.g. `abcdwxyz` in
`https://abcdwxyz.supabase.co`). You will need it later.

---

## 2. Grab the API keys

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy:
   - **Project URL** → goes into `.env` as `SUPABASE_URL`.
   - **`anon` `public` key** → goes into `.env` as `SUPABASE_ANON_KEY`.
   - **`service_role` `secret` key** → save in your password manager.
     Used in step 6 (cron). **Never** commit it or put it in the
     mobile `.env`.

Update your local `.env` file:

```
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
ONESIGNAL_APP_ID=a655d68c-44cc-48aa-be39-44a7d51a6808
GOOGLE_WEB_CLIENT_ID=  # filled in step 7
```

---

## 3. Enable the required Postgres extensions

The schema uses three extensions. Enable them before running the
migration.

1. Go to **Database → Extensions**.
2. Search for each and toggle ON:
   - `postgis` — geographic types and distance functions.
   - `pg_cron` — scheduled SQL jobs.
   - `pg_net` — outbound HTTP from SQL.

If `pg_cron` is not visible, your project is in a region that doesn't
support it yet. Pick a different region (you'll need to recreate the
project) or contact Supabase support.

---

## 4. Run the database migration

The migration creates tables, indexes, RLS policies, triggers, and a
helper SQL function (`get_proximity_pairs`).

1. Open `supabase/migrations/001_initial_schema.sql` in your editor.
2. Copy the **entire** file contents.
3. In the Supabase dashboard, go to **SQL Editor**.
4. Click **New query**.
5. Paste the contents and click **Run**.
6. You should see "Success. No rows returned." If you see an error
   about an extension not existing, go back to step 3.

Verify by going to **Table Editor** — you should see three tables:

- `users`
- `friendships`
- `notification_logs`

> **Important:** Leave the `pg_cron` block at the bottom of the
> migration commented out for now. We will run it in step 6, after
> the Edge Function exists.

### Run the second migration

1. Open `supabase/migrations/002_notification_logs_select.sql`.
2. Paste into a new SQL Editor query and **Run**.

This adds a `select` policy on `notification_logs` so the mobile app
can read each user's own ping history. Without it, the "last seen at
~2 km, 3h ago" badge on each friend card is silently empty.

### Sanity-check the schema

Run this in SQL Editor — it should return 3 rows (one per table) with
`rls_enabled = true`:

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
```

---

## 5. Deploy the proximity-check Edge Function

The Edge Function calls `get_proximity_pairs()`, evaluates each pair,
and sends OneSignal pushes via REST.

### 5a. Install the Supabase CLI

Pick whichever installer matches your OS:

```bash
# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS / Linux (Homebrew)
brew install supabase/tap/supabase

# Or via npm (any platform)
npm install -g supabase
```

Verify:

```bash
supabase --version
```

### 5b. Log in and link the project

```bash
supabase login
# (browser opens; paste the access token it shows you)

# From the repo root:
supabase link --project-ref YOUR_PROJECT_REF
```

You'll be prompted for the database password from step 1 (you saved
it in your password manager — right?).

### 5c. Set the OneSignal secrets on the Edge Function

The function needs two env vars beyond what Supabase auto-provides:

```bash
supabase secrets set \
  ONESIGNAL_APP_ID=a655d68c-44cc-48aa-be39-44a7d51a6808 \
  ONESIGNAL_REST_API_KEY=PASTE_THE_REST_API_KEY_HERE
```

The OneSignal REST API key lives in **OneSignal Dashboard → Settings →
Keys & IDs → Rest API Key**. (It is **not** the App ID; it's the long
key on the same page.)

You do **not** need to set `SUPABASE_URL` or
`SUPABASE_SERVICE_ROLE_KEY` — Supabase auto-injects these into every
Edge Function.

### 5d. Deploy

```bash
supabase functions deploy proximity-check
```

You should see:

```
Deployed Function proximity-check
URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check
```

### 5e. Smoke test the function

In SQL Editor, run:

```sql
select net.http_post(
  url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body    := '{}'::jsonb
);
```

Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY`. You should see
a row with `status_code = 200`. If it fails:

- Check **Edge Functions → proximity-check → Logs** in the dashboard.
- 401 = secret/auth wrong. 500 = a runtime error inside the function.

If you have no users with locations yet, the function will return
`{"ok":true,"pairs_checked":0,...}` — that is the correct
behaviour, not an error.

---

## 6. Schedule the cron jobs

`pg_cron` triggers the Edge Function twice daily at 8 AM and 8 PM
**UTC**. (This is timezone-fixed by design — the app uses UTC for
its dedup window too.)

In SQL Editor, run:

```sql
select cron.schedule(
  'proximity-check-morning',
  '0 8 * * *',   -- 8:00 AM UTC daily
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'proximity-check-evening',
  '0 20 * * *',  -- 8:00 PM UTC daily
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
```

Replace **both** `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY`
placeholders before running.

Verify:

```sql
select jobid, jobname, schedule, active
from cron.job
order by jobname;
```

You should see two rows, both with `active = true`.

To inspect the most recent runs:

```sql
select jobid, runid, status, return_message, start_time
from cron.job_run_details
order by start_time desc
limit 10;
```

---

## 7. Configure Google Sign-In

Google OAuth requires a Web OAuth client (not the Android one — even
though the app runs on Android, the @react-native-google-signin SDK
exchanges an ID token issued to the *Web* client).

### 7a. Get the Web Client ID

If you already have a Firebase project for this app:

1. Go to **Firebase Console → Project Settings → General**.
2. Scroll to **Your apps**. Make sure the Android app `com.buddyping`
   is listed; if not, add it.
3. Open the linked GCP project in **APIs & Services → Credentials**.
4. Find the **OAuth 2.0 Client IDs** section.
5. There should be a **Web client (auto created by Google Service)** —
   copy its Client ID. It looks like
   `1234567890-xxxxxxxxxxxxxxx.apps.googleusercontent.com`.

If there is no Web client, click **Create Credentials → OAuth client
ID → Web application**, name it "BuddyPing Web", and create. The
authorized redirect URI Supabase will need is filled in step 7c.

Paste the ID into your local `.env`:

```
GOOGLE_WEB_CLIENT_ID=1234567890-xxxxxxxxxxxxxxx.apps.googleusercontent.com
```

### 7b. Download `google-services.json`

1. In Firebase Console, **Project Settings → General → Your apps**,
   click the Android `com.buddyping` app.
2. Click **Download `google-services.json`**.
3. Save it to `android/app/google-services.json` in this repo. It is
   gitignored on purpose; do not commit it.

### 7c. Enable Google in Supabase Auth

1. Supabase dashboard → **Authentication → Providers → Google**.
2. Toggle **Enable**.
3. Paste the **Web Client ID** from 7a into "Client ID".
4. Paste the corresponding **Client secret** (also from the Credentials
   page in GCP).
5. Copy the **Callback URL** Supabase shows you — back in GCP
   Credentials, edit your Web OAuth client and add this URL to
   **Authorized redirect URIs**.
6. Click **Save** in Supabase.

### 7d. (Optional) Disable email confirmation for development

By default Supabase requires email verification before a sign-up
session is created. The app handles this correctly (it routes the user
back to SignIn with a "check your email" alert), but for development
it's faster to disable it.

1. **Authentication → Providers → Email**.
2. Toggle **Confirm email** off.
3. Click **Save**.

Re-enable before going to production.

---

## 8. Configure OneSignal ↔ Firebase

Push notifications on Android go through Firebase Cloud Messaging,
which OneSignal proxies for you.

1. **Firebase Console → Project Settings → Cloud Messaging**.
2. If "Cloud Messaging API (V1)" is not enabled, click **Enable**.
3. Go down to **Service account → Manage service accounts** and either:
   - Generate a new private key for the default service account, or
   - Use an existing one with the **Firebase Cloud Messaging API
     Admin** role.
4. Download the JSON file.
5. **OneSignal Dashboard → your app → Settings → Android (FCM)**.
6. Paste in the Firebase Service Account JSON file you downloaded.
7. Save.

OneSignal will start using the new credentials immediately. No app
rebuild required.

---

## 9. End-to-end test

Now check the whole pipeline.

1. Start the app: `npm run android`.
2. Sign up with email/password. (You should land on the profile setup
   screen if email confirmation is disabled, or get the "check your
   email" prompt if it isn't.)
3. Pick a username and continue. You should reach the location
   permission flow.
4. Grant foreground, background ("Allow all the time"), and
   notification permissions.
5. You should land on the Home tab with an empty friends list.
6. In Supabase **Table Editor → users**, find your row. Confirm:
   - `last_location` is populated (a `0101000020...` hex blob — that's
     PostGIS WKB, the binary form of `POINT(lng lat)`).
   - `onesignal_player_id` is populated.
7. To smoke-test the proximity check end to end without a friend,
   create a second test account on a second device or emulator, send a
   friend request, accept it, and re-trigger the function manually
   (step 5e). You should receive a push notification within seconds if
   you are within each other's threshold.

---

## 10. Common issues

### "permission denied for table users" when inserting a profile

The signed-in user's `auth.uid()` does not match the row's `id`
column. This means either:

- The user was signed in with one provider and the insert is using a
  different ID — make sure you don't manually pass an `id`; use
  `(await supabase.auth.getUser()).data.user.id`.
- Email confirmation is enabled and the session hasn't been created
  yet. Enable email auto-confirm (step 7d) for development, or wait
  for the user to click the confirmation link.

### `useFriends` returns no `last_ping` info even after a notification was sent

You skipped migration 002. Re-run
`supabase/migrations/002_notification_logs_select.sql`.

### Edge Function logs say "permission denied for function get_proximity_pairs"

The function was created without `security definer`, or the migration
ran as a non-owner role. Re-run the function definition section of
migration 001.

### Cron job is `active=true` but never runs

Check `cron.job_run_details` (query in step 6) for `status = 'failed'`
and read `return_message`. The most common cause is a typo in the URL
or service role key in the cron schedule body.

### "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables"

The mobile app was started without the `.env` file or the values are
empty. The app reads env vars **at build time** via babel — restart
Metro after editing `.env`:

```bash
# kill any running Metro, then:
npm run start -- --reset-cache
```

### Google Sign-In silently returns no `idToken`

Most likely the **Web** Client ID is wrong (you used the Android one
by mistake), or `google-services.json` doesn't match the package name
(`com.buddyping`). Re-check steps 7a and 7b.

### "ONESIGNAL_REST_API_KEY is not set" in Edge Function logs

Run `supabase secrets list` and confirm the value is there. If you
set it but the function still doesn't see it, redeploy:

```bash
supabase functions deploy proximity-check
```

---

## 11. What's safe to share, what isn't

| Value                          | Safe to commit? | Goes where        |
|--------------------------------|-----------------|-------------------|
| `SUPABASE_URL`                 | yes (it's just the public URL) | mobile `.env` |
| `SUPABASE_ANON_KEY`            | yes (RLS-protected)            | mobile `.env` |
| `SUPABASE_SERVICE_ROLE_KEY`    | **NO**          | password manager + Supabase secrets only |
| `ONESIGNAL_APP_ID`             | yes             | mobile `.env` + Supabase secrets |
| `ONESIGNAL_REST_API_KEY`       | **NO**          | Supabase secrets only |
| `GOOGLE_WEB_CLIENT_ID`         | yes             | mobile `.env` |
| Google OAuth client **secret** | **NO**          | Supabase Auth → Providers → Google |
| `google-services.json`         | **NO**          | `android/app/google-services.json` (gitignored) |

The repo's `.gitignore` already excludes `.env` and
`google-services.json`. Don't override it.

---

## 12. Where to look when something breaks

- App-side issues — Metro logs in the terminal, Logcat for native
  errors (`adb logcat | grep -i buddyping`).
- Auth issues — **Authentication → Logs** in the Supabase dashboard.
- Database / RLS issues — **Database → Logs**.
- Edge Function issues — **Edge Functions → proximity-check → Logs**.
- Cron issues — `select * from cron.job_run_details order by start_time desc;`
  in SQL Editor.
- Push delivery issues — **OneSignal Dashboard → Delivery** for each
  notification's status.

If you've checked all of those and you're still stuck, ping the
maintainer with:

1. Which step in this doc you're on.
2. The exact error message (copy/paste, not screenshot).
3. Project ref (NOT the service role key).
