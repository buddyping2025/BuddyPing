# BuddyPing — Functionality & Architecture

A pure React Native (Android-only, no Expo) friend-proximity app. Two
times a day a server-side cron job checks every accepted friendship pair
and sends a push notification whenever two friends are within each
user's configured distance threshold of one another.

---

## 1. High-level data flow

```
 ┌───────────────────────┐         ┌──────────────────────┐
 │  Android device (RN)  │         │   Supabase backend   │
 │                       │         │                      │
 │  Foreground:          │  GPS    │  Postgres + PostGIS  │
 │   useLocationSync ───▶│ upload  │   public.users       │
 │   uploadLocation()    │────────▶│   public.friendships │
 │                       │         │   public.notification_logs
 │  Background (12h):    │  GPS    │                      │
 │   WorkManager ───────▶│ upload  │                      │
 │   headless task       │────────▶│                      │
 │                       │         │  pg_cron @ 8am/8pm   │
 │  OneSignal SDK        │         │   ▼                  │
 │   push receiver  ◀────┼─────────┼──Edge Function       │
 │                       │  push   │   proximity-check    │
 │                       │  via    │   ▼                  │
 │                       │  REST   │   OneSignal REST API │
 └───────────────────────┘         └──────────────────────┘
```

Every user persists three pieces of state in `public.users`:

- `last_location` — `GEOGRAPHY(POINT, 4326)`, written in `POINT(lng lat)`
  WKT (longitude first; reversing silently produces wrong distances).
- `distance_threshold_meters` — *that user's own* threshold. The per-user
  threshold determines whether *they* receive a notification. The friend
  on the other side has their own independent threshold.
- `onesignal_player_id` — the device subscription ID, used by the Edge
  Function to address pushes via OneSignal's REST API.

---

## 2. Entry point load order (load-bearing)

`index.js`:

1. `react-native-url-polyfill/auto` — must run before any Supabase or
   `fetch` usage (Supabase relies on the WHATWG URL parser).
2. `react-native-gesture-handler` — must be imported before
   `NavigationContainer` mounts.
3. Headless task registration (`BackgroundFetch.registerHeadlessTask`).
4. `AppRegistry.registerComponent`.

`App.tsx`:

1. `initializeOneSignal()` — runs **at module scope**, not in an effect.
   The OneSignal SDK has to be initialised before any
   `OneSignal.User.pushSubscription.*` call, including the subscription
   change observer that auto-syncs the player ID.
2. `configureGoogleSignIn()` — also at module scope.
3. `configureBackgroundFetch()` — schedules the WorkManager task.

`babel.config.js`:

- `react-native-reanimated/plugin` must remain the **last** plugin.
- Env vars are inlined at build time via
  `babel-plugin-transform-inline-environment-variables`. There is no
  runtime `dotenv` lookup in app code; values are read as
  `process.env.NAME` and replaced by the babel plugin.

---

## 3. Navigation state machine (`RootNavigator`)

`RootNavigator` is the single source of truth for which screen tree is
mounted. It evaluates gates in priority order:

1. `authLoading || isChecking` → spinner.
2. No session → `AuthNavigator` (`SignIn` / `SignUp`).
3. Session but no `appUser` row → `SetupProfileScreen`.
4. `!foreground || !background || !notificationPromptDone` →
   `LocationPermissionScreen`.
5. All clear → `MainNavigator` (Home / Search / Requests / Profile).

`notificationPromptDone` is an `AsyncStorage`-backed flag set the first
time the user is shown the notification prompt step (regardless of
grant/deny). Without this gate, Android 11+ would skip the OneSignal
opt-in entirely: granting background location requires a Settings
round-trip, and as soon as the user returns the parent's
`usePermissions` instance would see both perms granted and unmount the
screen before the notification step ever rendered.

`MainApp` (the inner component that renders `MainNavigator`) calls
`useFriends(appUser.id)` so the Requests tab badge stays live.

Adding a new required onboarding gate belongs here, not inside
individual screens.

---

## 4. Hooks (state singletons)

Three hooks own the cross-screen runtime state. Each uses a module-level
singleton + listener set so every component reading the hook sees the
same state and a mutation in one place re-renders the whole tree.

### `useAuth`

Owns: `session`, `supabaseUser` (Supabase JWT user — `User` type from
`@supabase/supabase-js`), `appUser` (the row from `public.users` —
`User` type from `src/types`), `isLoading`, `isSignedIn`.

- Subscribes once to `supabase.auth.onAuthStateChange` and to
  `supabase.auth.getSession()` on first mount.
- `fetchAppUser(userId)` is guarded by an in-flight token; results are
  discarded if the session changed mid-flight, so a slow fetch from a
  signed-out user can't overwrite a freshly signed-in user's row.
- `PGRST116` (row not found) is **not** an error — it's the expected
  signal that this is a brand-new user who needs `SetupProfileScreen`.
- Exports `refreshAppUser()` — called after every mutation that touches
  `public.users` (sign-up, profile setup, profile edit). Without this
  the tree would not re-render after writes.
- Exports `setProfileCreationInFlight(bool)` — sign-up sets it true
  before `supabase.auth.signUp` and clears it after the profile insert
  completes. While set, `isLoading` stays true so RootNavigator shows
  the spinner instead of flashing `SetupProfileScreen` between the
  `SIGNED_IN` event and the insert finishing.

### `usePermissions`

Owns: `foreground`, `background`, `notificationPromptDone`,
`isChecking`, plus `recheck()` and `markNotificationPromptDone()`.

- Reads location perms via `PermissionsAndroid.check`.
- Reads notification-prompt-done from
  `AsyncStorage[buddyping.onboarding.notif_prompted]`.
- Re-checks on `AppState` `inactive|background → active` so the user
  returning from the system Settings app picks up freshly granted perms
  without manual refresh (required for the Android 11+ background
  location flow, which has no programmatic dialog).

### `useFriends(userId)`

Owns: `friends` (with last-ping metadata), `pendingReceived`,
`pendingSent`, plus mutation methods. Local to each consumer (not a
singleton — it's a query hook).

- `friends` joins `public.friendships` to `public.users` for both sides
  and folds in the most recent `notification_logs` row per pair.
- `pendingReceived` joins the requester's user row for the request card.
- `searchUsers(query)` ILIKE-matches on `email` and `username`. Input is
  escaped (commas/parens stripped, percent/underscore backslash-escaped)
  to prevent breaking PostgREST's `.or()` filter syntax or its ILIKE
  pattern syntax.
- `sendFriendRequest(target)` validates UUID, rejects self, and only
  blocks on `pending`/`accepted` rows — `declined` rows are
  re-requestable.

### `useLocationSync(userId, enabled)`

Foreground GPS sync used by `RootNavigator`. Without it a brand-new user
would have no `last_location` until the first ~12h WorkManager tick, so
their entire first day in the app would produce zero proximity
notifications.

- Initial sync forces an upload immediately when enabled.
- Subsequent syncs throttled to `MIN_INTERVAL_MS = 30 min`, triggered by
  `AppState` `→ active`.
- `inFlightRef` prevents concurrent uploads.

---

## 5. Auth flow

### Email / password sign-up

1. `supabase.auth.signUp({email, password})`.
2. If the response has no `session` (Supabase project requires email
   confirmation), the screen alerts the user to check their email and
   routes back to `SignIn`. The profile insert is **not** attempted —
   without `auth.uid()` it would fail RLS.
3. Otherwise insert into `public.users` with the user-supplied
   `display_name` / `username`. On `23505` (unique violation) we
   surface "Username Taken" without signing the user out, so they can
   pick a new handle from `SetupProfileScreen` without re-auth.
4. `refreshAppUser()` propagates the new row to all `useAuth()`
   consumers; `RootNavigator` advances to `LocationPermissionScreen`.

### Email / password sign-in

`supabase.auth.signInWithPassword`. The `onAuthStateChange` listener
picks up `SIGNED_IN`, calls `fetchAppUser`, and `RootNavigator` decides
the next screen.

### Google OAuth

`@react-native-google-signin/google-signin` returns an `idToken`, which
is exchanged via `supabase.auth.signInWithIdToken({provider: 'google'})`.
Google sign-in always creates a session, so `fetchAppUser` runs; new
Google users land on `SetupProfileScreen` (no profile row yet).

### Sign-out

`ProfileScreen` clears OneSignal, signs out of Google, and signs out of
Supabase in that order. `clearOneSignalUser()` resets the in-memory
`activeSupabaseUserId` so any in-flight subscription event is dropped
instead of writing to the previous user's row.

### Session persistence

Supabase is configured with `storage: AsyncStorage`, **not** SecureStore.
This is intentional: the background-fetch headless task runs outside the
React tree, and it must read the same session the foreground app does.
`autoRefreshToken: true` keeps the JWT fresh; refresh failures fire
`SIGNED_OUT` via `onAuthStateChange`, which `useAuth` handles by
clearing local state.

---

## 6. Permissions flow (Android-specific)

Three permissions are requested in sequence in `LocationPermissionScreen`:

| Step          | Method                                  | Notes |
|---------------|-----------------------------------------|-------|
| Foreground    | `PermissionsAndroid.request(ACCESS_FINE_LOCATION)` | Standard dialog. |
| Background    | API ≥ 30: `Linking.openSettings()`. API ≤ 29: `PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION)`. | Android 11+ silently rejects programmatic background-location requests. |
| Notification  | `OneSignal.Notifications.requestPermission(true)` | Required only on Android 13+; no-ops on earlier versions. |

Constraints:

- `FOREGROUND_SERVICE_LOCATION` is needed for Android 14+.
- `VisionCamera_enableCodeScanner=true` must remain in
  `android/gradle.properties` or the QR scan tab won't build.
- `google-services.json` must be placed manually at
  `android/app/google-services.json` (not committed).

The screen advances steps reactively: a `useEffect` on
`(foreground, background)` advances the local step state when the live
permissions catch up. This is what makes the Android 11+ Settings
round-trip work — the AppState listener in `usePermissions` re-checks,
the singleton emits, and the local step jumps to `notification`.

---

## 7. Friendship model

`public.friendships`:

```
unique (requester_id, addressee_id)   -- only blocks the same pair
                                         in the same direction
check (requester_id != addressee_id)  -- no self-friendship
status                                -- pending → accepted
                                         pending → declined
```

`useFriends.sendFriendRequest` does an OR query in *both* directions
before inserting, so user A can't send a request to B if B already sent
one to A. RLS enforces:

- Insert: only if `requester_id = auth.uid()`.
- Update: only if `addressee_id = auth.uid()` (so only the recipient
  can accept/decline).
- Select: only if you are part of the friendship.

### QR adding

The QR encodes the user's raw Supabase UUID — not a deep link. `QRScanner`
(react-native-vision-camera v4 with the built-in code scanner) returns
the scanned string, which is validated as a UUID and then handed to
`sendFriendRequest`. Self-scan is rejected client-side.

---

## 8. Push notifications (OneSignal)

Initialisation (`src/services/onesignal.ts`):

- `initializeOneSignal()` runs once at module scope from `App.tsx`. It
  registers a single `pushSubscription` change observer that filters by
  `activeSupabaseUserId`.
- `setOneSignalUser(supabaseUserId)` calls `OneSignal.login(...)` and
  immediately tries `getIdAsync()` (the v5 replacement for the
  deprecated `getPushSubscriptionId()`). If the subscription isn't
  ready yet the change observer will fire when it becomes available.
- `clearOneSignalUser()` calls `OneSignal.logout()` and clears the
  active-user reference so a late-arriving subscription event from the
  previous user can't write the new player ID to the wrong row.

The player ID lands in `public.users.onesignal_player_id` only after a
successful, RLS-allowed update. Duplicate writes are guarded by the
`lastSyncedPlayerId` check.

---

## 9. Proximity check (server-side)

`pg_cron` schedules:

```
0 8  * * *   -- 8 AM UTC
0 20 * * *   -- 8 PM UTC
```

Each tick calls the `proximity-check` Edge Function via `pg_net.http_post`
with the service role key.

The function:

1. Calls the `get_proximity_pairs()` SQL helper. This is a
   `SECURITY DEFINER` function that bypasses RLS to return every
   accepted friendship pair where both sides have a `last_location`,
   joined to each user's `display_name`, `onesignal_player_id`, and
   `distance_threshold_meters`.
2. For each pair, evaluates **each side independently**:
   `distance_meters <= user_a_threshold` and
   `distance_meters <= user_b_threshold` are separate decisions. User A
   and user B can have different thresholds and only one of them gets
   notified.
3. Per-user-per-friend dedup: at most 2 sends per UTC day, counted via
   `notification_logs` (and `pg_cron` runs twice a day, so this is the
   natural rate-limit).
4. Sends via `POST https://onesignal.com/api/v1/notifications` with
   `include_player_ids: [playerId]`.
5. Inserts into `notification_logs` (service role only — see RLS below).

### RLS on `notification_logs`

- Insert/update: `service_role` only (the Edge Function).
- Select: `auth.uid() = user_id` (added in migration 002). The
  foreground app reads its own logs to populate the "last ping" badge
  on each friend card. Without this policy the read silently returns
  an empty array.

---

## 10. Background fetch

`react-native-background-fetch` (Android WorkManager) is configured in
`src/services/backgroundFetch.ts`:

- `minimumFetchInterval: 720` (12 hours).
- `stopOnTerminate: false`, `startOnBoot: true`, `enableHeadless: true`.
- Foreground handler (app running): reads the session, calls
  `uploadLocation`, `BackgroundFetch.finish`.
- Headless handler (app killed): same, registered separately in
  `index.js` via `BackgroundFetch.registerHeadlessTask`.

WorkManager **does not guarantee exact timing** — it batches/defers for
battery. That is why the *exact* 8 AM / 8 PM cadence lives server-side
in `pg_cron`. The client-side schedule is just "make sure each user has
a fresh location at least twice a day on average". Foreground sync via
`useLocationSync` covers the gap when the user is actively using the
app.

---

## 11. Styling

NativeWind v4 + Tailwind v3. The token palette in
`tailwind.config.js`:

- `brand` — indigo primary (500/600/700).
- `surface` — gray backgrounds (`surface-subtle`, `surface-muted`).
- `border` — subtle borders.
- `content` — text (`content-primary/secondary/muted/inverse`).

Use `className` wherever possible. `APP_COLORS` in `src/constants` is
only for imperative colour values that can't take a className —
`ActivityIndicator` `color`, `RefreshControl` `tintColor`, etc. Never
inline raw hex codes.

Path alias: `@/*` resolves to `src/*` (configured in both `tsconfig.json`
and the babel preset).

---

## 12. Environment variables

`.env` is required and must contain:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
ONESIGNAL_APP_ID=...
GOOGLE_WEB_CLIENT_ID=...
```

`process.env.<NAME>` references are inlined at build time by
`babel-plugin-transform-inline-environment-variables`. They are not
available at runtime — there is no `dotenv` import in app code. Tests,
typecheck, and `react-native bundle` all run through the same babel
config and pick up the same values.

`src/env.d.ts` declares the global `process.env` typings so TypeScript
understands these references without pulling in `@types/node`.

---

## 13. Tests, lint, build

- `npm test` — Jest. `jest.setup.js` mocks every native module
  (gesture-handler, reanimated/worklets, OneSignal, Camera, Geolocation,
  Google SignIn, AsyncStorage, Supabase) and `__mocks__/styleMock.js`
  handles the `global.css` import. Reanimated specifically requires a
  separate stub at `__mocks__/react-native-reanimated.js` because the
  shipped `react-native-reanimated/mock` re-imports the real
  `react-native-worklets`, which fails outside the native runtime.
- `npm run lint` — ESLint with the React Native preset. The "no-inline
  styles" warnings are by design (lots of imperative inline styles in
  the screens); only errors should block.
- `npx tsc --noEmit` — full strict typecheck. `supabase/functions/**` is
  excluded (Deno globals would error otherwise).
- `npx react-native bundle --platform android --dev false …` — quickest
  full-tree validation when an Android emulator isn't available.

---

## 14. Supabase setup checklist

1. Create the Supabase project; in **Database → Extensions** enable
   `postgis`, `pg_cron`, `pg_net`.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Run `supabase/migrations/002_notification_logs_select.sql` (grants
   the foreground app SELECT on its own `notification_logs` rows).
4. Deploy the `proximity-check` Edge Function. Set the secrets
   `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` in **Edge Functions →
   Secrets** (the Supabase URL and service role key are auto-set).
5. Uncomment the `pg_cron` block at the bottom of migration 001 and run
   it in the SQL Editor with your project ref + service role key
   filled in.
6. **Auth → Providers → Google**: enable, paste the Web Client ID +
   Secret from Firebase / GCP. The Android client uses the **Web** OAuth
   client ID, not the Android one.

## 15. File map

```
App.tsx                           module-load init: OneSignal, Google, BG fetch
index.js                          load order; headless task registration

src/
  navigation/
    RootNavigator.tsx             auth + permission gates
    AuthNavigator.tsx             SignIn / SignUp stack
    MainNavigator.tsx             Home / Search / Requests / Profile tabs
  screens/
    auth/SignInScreen.tsx
    auth/SignUpScreen.tsx
    onboarding/SetupProfileScreen.tsx
    onboarding/LocationPermissionScreen.tsx
    main/HomeScreen.tsx
    main/SearchScreen.tsx
    main/RequestsScreen.tsx
    main/ProfileScreen.tsx
  hooks/
    useAuth.ts                    session + appUser singleton
    usePermissions.ts             location + notif-prompt singleton
    useFriends.ts                 friend list + mutations
    useLocationSync.ts            foreground GPS sync
  services/
    supabase.ts                   client (AsyncStorage session)
    location.ts                   GPS + Android perms
    backgroundFetch.ts            WorkManager scheduling
    onesignal.ts                  init, login/logout, player-ID sync
    googleSignIn.ts               Google OAuth → Supabase
  components/
    common/                       Avatar, Badge, Button, Input,
                                  SectionHeader, SkeletonLoader
    friends/FriendCard.tsx
    friends/FriendRequestCard.tsx
    qr/QRCodeDisplay.tsx
    qr/QRScanner.tsx
  utils/
    formatDistance.ts             "~450 m" / "~2.5 km" / "2h ago"
    generateUsername.ts           suggest + validate
  types/index.ts                  shared row types
  constants/index.ts              DISTANCE_PRESETS, APP_COLORS
  env.d.ts                        process.env typings

supabase/
  migrations/001_initial_schema.sql
  migrations/002_notification_logs_select.sql
  functions/proximity-check/index.ts
```
