# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Whenever working with any third-party library, you MUST look up the official documentation to ensure you're working with up-to-date information. Use the DocsExplorer subagent for efficient documentation lookup.

## Commands

```bash
# Run on Android device/emulator
npm run android

# Start Metro bundler
npm run start

# Lint
npm run lint

# Run tests
npm test

# Run a single test file
npx jest path/to/test.test.ts
```

All scripts use `dotenv-cli` to inject `.env` variables. The `.env` file must exist and contain `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ONESIGNAL_APP_ID`, and `GOOGLE_WEB_CLIENT_ID`.

## Architecture

### Navigation State Machine

`RootNavigator.tsx` is the entry point into the UI and drives the entire auth/onboarding flow. It conditionally renders based on priority order:

1. Loading → spinner
2. No session → `AuthNavigator` (sign in / sign up)
3. Session but no `appUser` profile → `SetupProfileScreen`
4. Missing location permissions → `LocationPermissionScreen`
5. All clear → `MainNavigator` (bottom tabs: Home, Requests, Search, Profile)

Adding a new required onboarding gate belongs in `RootNavigator.tsx`, not inside individual screens.

### Data Hooks

All Supabase data access goes through hooks in `src/hooks/`:

- **`useAuth`** — session state, Supabase `User` (JWT), and app `User` (profile row). These are two different types: `supabaseUser` is from `@supabase/supabase-js`, `appUser` is from `src/types/index.ts`. `appUser` is null until the `public.users` row is fetched. PGRST116 (row not found) means a new user who needs profile setup — this is handled, not an error.
- **`useFriends(userId)`** — accepted friends with last ping data, pending requests (sent and received), plus mutation methods: `sendFriendRequest`, `acceptRequest`, `declineRequest`, `searchUsers`. Call with `appUser?.id` — returns empty state safely if undefined.
- **`usePermissions`** — foreground/background location permission state. Automatically re-checks via `AppState` listener when the user returns from the Settings app (required for Android 11+ background location flow).

### Entry Point Import Order (`index.js`)

The order of imports in `index.js` is load-bearing:
1. `react-native-url-polyfill/auto` — must be before any Supabase or fetch usage
2. `react-native-gesture-handler` — must be before NavigationContainer mounts
3. Background fetch headless task registration
4. `AppRegistry`

Do not reorder these.

### Babel Config Constraint

`react-native-reanimated/plugin` must be the **last** plugin in `babel.config.js`. Do not add plugins after it.

### Environment Variables

Variables are inlined at build time via `babel-plugin-transform-inline-environment-variables`. Access them as `process.env.VARIABLE_NAME` — no runtime lookup, no `dotenv` in app code.

### Supabase Session & Background Fetch

Supabase uses `AsyncStorage` (not SecureStore) for session persistence. This is intentional: the background fetch headless task runs outside the React tree and must access the session the same way the foreground app does.

The background fetch is configured for ~12h intervals via Android WorkManager. WorkManager does not guarantee exact timing — the server-side `pg_cron` job handles exact 8am/8pm UTC scheduling.

### Location Data Format

Location is stored in Postgres as `GEOGRAPHY(POINT, 4326)`. WKT format requires **longitude first**: `POINT(lng lat)`. Reversing this will silently produce wrong proximity results. Only the latest location is stored — no history.

### Styling

Use NativeWind classes (Tailwind) on React Native components wherever possible. The custom design token palette lives in `tailwind.config.js` under `theme.extend.colors`:
- `brand` — indigo-based primary (500/600/700)
- `surface` — gray backgrounds (includes `surface-subtle`, `surface-muted`)
- `border` — subtle borders
- `content` — text colors (`content-primary`, `content-secondary`, `content-muted`, `content-inverse`)

Use `APP_COLORS` from `src/constants/index.ts` only for imperative color values that can't use `className` (e.g., `ActivityIndicator` tint, `RefreshControl` tint). Never use raw hex values.

### Path Alias

`@/*` resolves to `src/*` (configured in `tsconfig.json` and Babel). Use this for all internal imports.

### Friendship Data Model

The `friendships` table has a unique constraint on `(requester_id, addressee_id)` — it only prevents the same pair in the same direction. The `sendFriendRequest` function guards against both directions with an OR query before inserting.

Friendship status transitions: `pending` → `accepted` or `pending` → `declined`. Only the addressee can update status (enforced by RLS).

### QR Friend Adding

The QR code encodes the user's Supabase UUID (not a deep link or custom URL). Scanning resolves to a user ID which is passed directly to `sendFriendRequest`. `react-native-vision-camera` v4 with the built-in code scanner is used. `VisionCamera_enableCodeScanner=true` must remain in `android/gradle.properties` or the scanner will not build.

### Push Notifications

`onesignal.ts` initializes OneSignal in `App.tsx` before any React rendering. The OneSignal App ID is read from `process.env.ONESIGNAL_APP_ID`. Do not move initialization into a hook or effect — it must run at module load time.

### Proximity Notification Logic

Notifications are server-driven: a `pg_cron` job fires at 8am/8pm UTC, calling the `proximity-check` Edge Function (`supabase/functions/proximity-check/`). The function calls `get_proximity_pairs()` (a `SECURITY DEFINER` SQL function that bypasses RLS) and sends OneSignal pushes via their REST API.

Each user's **own** `distance_threshold_meters` determines whether *they* receive a notification — not the friend's threshold. Deduplication is enforced via `notification_logs` (max 2 per user/friend pair per day, counted from UTC midnight).

The `notification_logs` RLS policy currently only grants access to `service_role`. The `useFriends` hook reads this table with the anon key to show last-ping metadata on friend cards — this read will silently return an empty array if the policy has not been updated to allow authenticated reads of own rows.

### Android-Specific Notes

- Background location on Android 11+ (API ≥ 30): `requestBackgroundPermission` opens Settings via `Linking.openSettings()` rather than showing a dialog — the OS silently rejects programmatic requests. `usePermissions` listens to `AppState` changes to re-check after the user returns.
- `FOREGROUND_SERVICE_LOCATION` permission is needed for Android 14+.
- `google-services.json` must be placed manually at `android/app/google-services.json` (not in repo).

### Supabase Backend Setup

Required Postgres extensions: `postgis`, `pg_cron`, `pg_net`. The migration in `supabase/migrations/001_initial_schema.sql` creates all tables, indexes, RLS policies, triggers, and the `get_proximity_pairs()` helper function. The `pg_cron` schedules are commented out at the bottom of the migration and must be run manually after deploying the Edge Function with the correct project ref and service role key.

The Edge Function also needs two secrets set in the Supabase Dashboard: `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`.
