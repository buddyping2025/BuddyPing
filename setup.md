# BuddyPing — Windows Setup Guide

Step-by-step instructions to take a brand-new Windows machine to a
running BuddyPing build on an Android device or emulator.

**Time estimate:** 2–3 hours the first time (most of it is downloading
the Android SDK and NDK). After this, day-to-day starts in a single
`npm run android` command.

**Target Windows version:** Windows 10 / 11 (64-bit). The architecture
build uses x86_64; ARM Windows is unsupported.

---

## What you'll end up with

```
C:\Users\<you>\learnreact\reactnative\BuddyPing\        repo
  .env                                                  secrets (not in git)
  android\app\google-services.json                      Firebase config (not in git)

C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot\   JDK 17
C:\Users\<you>\AppData\Local\Android\Sdk\               Android SDK
C:\Users\<you>\.gradle\                                 Gradle cache
```

And environment variables:

```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot
ANDROID_HOME=C:\Users\<you>\AppData\Local\Android\Sdk
```

---

## 1. Install Node.js 22 LTS

The repo requires Node `>= 22.11.0` (see `package.json` "engines"
field).

1. Go to <https://nodejs.org/>.
2. Download the **LTS** Windows installer (`.msi`).
3. Run the installer with all defaults. **Check** the box that says
   "Automatically install the necessary tools" — it adds Node, npm,
   and the build tools to your `PATH`.
4. Open a fresh **PowerShell** window (existing windows won't see the
   new `PATH`) and verify:

   ```powershell
   node --version   # should print v22.x.x
   npm --version    # should print 10.x.x or higher
   ```

If `node --version` is below 22.11.0, your Windows had an older Node
installed. Uninstall it from **Settings → Apps**, then reinstall the
LTS.

---

## 2. Install Git

If you haven't already:

1. Download from <https://git-scm.com/download/win>.
2. Run the installer. Defaults are fine. The only setting worth
   choosing intentionally is **"Use Git from the Windows Command
   Prompt"** so `git` works from PowerShell.

Verify in a new PowerShell window:

```powershell
git --version
```

---

## 3. Install JDK 17

React Native 0.84 + Gradle 9.0 require **Java 17**. Java 21 also
works; Java 8 / 11 / 23 will fail the build.

1. Go to <https://adoptium.net/temurin/releases/?version=17>.
2. Download the **Windows x64 MSI** for **Temurin 17 (LTS)**.
3. Run the installer. On the **Custom Setup** step, expand the tree
   and enable:
   - **Set JAVA_HOME variable**.
   - **Add to PATH**.
4. Click through to finish.

Open a **fresh** PowerShell window and verify:

```powershell
java -version
# openjdk version "17.0.x" 2024-xx-xx LTS

$env:JAVA_HOME
# C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot\
```

If `$env:JAVA_HOME` is empty, set it manually:

1. Press **Win** and search "Environment Variables" → click
   **Edit the system environment variables** → **Environment
   Variables…**.
2. Under **System variables**, click **New…**:
   - Variable name: `JAVA_HOME`
   - Variable value: the JDK install path (e.g.
     `C:\Program Files\Eclipse Adoptium\jdk-17.0.4.7-hotspot`).
3. Find `Path` in **System variables**, click **Edit…**, **New**, and
   add `%JAVA_HOME%\bin`.
4. Click OK on every dialog and open a new PowerShell window.

---

## 4. Install Android Studio + the Android SDK

Android Studio is the simplest way to install the Android SDK
components React Native needs (SDK Platform, Build Tools, NDK,
Platform Tools).

### 4a. Install Android Studio

1. Go to <https://developer.android.com/studio>.
2. Download the Windows (64-bit) installer.
3. Run it. Accept the defaults. Let it install Android Studio plus
   the bundled Android SDK.
4. On first launch, the **Setup Wizard** will appear. Choose
   **Standard** install. It will download ~1–2 GB of SDK components.

### 4b. Install the exact SDK / NDK versions BuddyPing uses

Open Android Studio → **More Actions** → **SDK Manager** (or, if a
project is open, **Tools → SDK Manager**).

In the **SDK Platforms** tab:

1. Check **Show Package Details** (top right).
2. Expand **Android 14 (API 36)** — the repo uses
   `compileSdkVersion = 36` and `targetSdkVersion = 36`.
3. Check:
   - `Android SDK Platform 36`
   - `Sources for Android 36`
4. Also expand **Android 7.0 (API 24)** — the repo's `minSdkVersion`
   — and check `Android SDK Platform 24` so the build can resolve
   minSdk-tagged classes.
5. Click **Apply** and let it download.

In the **SDK Tools** tab, **check Show Package Details** and check:

- **Android SDK Build-Tools** → expand and pick exactly `36.0.0`.
- **NDK (Side by side)** → expand and pick exactly `27.1.12297006`.
- **Android SDK Command-line Tools (latest)**.
- **Android SDK Platform-Tools**.
- **Android Emulator**.
- **Google Play services**.

Click **Apply**, accept licenses, wait for the download to finish.

### 4c. Set ANDROID_HOME

1. Press **Win** → "Environment Variables" → **Edit the system
   environment variables** → **Environment Variables…**.
2. Under **User variables**, click **New…**:
   - Variable name: `ANDROID_HOME`
   - Variable value: `C:\Users\<your-username>\AppData\Local\Android\Sdk`
     (this is the default Android Studio install location — confirm
     the exact path in **SDK Manager → Android SDK Location** at
     the top).
3. Edit your user `Path` and add these four entries (each one a
   separate line in the Path editor):
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
   - `%ANDROID_HOME%\cmdline-tools\latest\bin`
   - `%ANDROID_HOME%\build-tools\36.0.0`
4. OK out of every dialog and open a fresh PowerShell window.

Verify:

```powershell
$env:ANDROID_HOME           # C:\Users\<you>\AppData\Local\Android\Sdk
adb --version               # Android Debug Bridge version 1.0.41
sdkmanager --version        # 11.0 or similar
```

If `adb` / `sdkmanager` aren't found, your `Path` edits didn't take.
Try logging out and back in, or close and reopen PowerShell.

---

## 5. Create an Android Virtual Device (emulator) — optional

Skip this section if you'll always use a physical device.

1. Android Studio → **More Actions** → **Virtual Device Manager**.
2. Click **Create device**.
3. Pick a **Pixel 7** (or similar phone profile). Click **Next**.
4. **System Image:** pick `UpsideDownCake` / API 34, with **Google
   Play Services** in the row. Click **Next**, **Finish**. (API 34
   works fine for testing even though we compile against 36 — Android
   is forward-compatible at the OS level.)
5. Boot it once from the device list to make sure it works.

The first boot can take 5+ minutes. Subsequent boots are much faster.

---

## 6. Enable a physical device — optional

If you'd rather develop on a real phone:

1. On the phone, go to **Settings → About phone** and tap **Build
   number** seven times to enable Developer Options.
2. **Settings → System → Developer options** → enable **USB
   debugging**.
3. Plug the phone into the PC with a **data-capable** USB cable (some
   cables are charge-only).
4. The phone will pop up an **Allow USB debugging?** dialog the first
   time — accept it, and check "Always allow from this computer".
5. In a new PowerShell on the PC:

   ```powershell
   adb devices
   # List of devices attached
   # XXXXXXXX  device
   ```

If you see `unauthorized` instead of `device`, redo the prompt on the
phone. If you see nothing, install your phone's USB driver from its
manufacturer's site and try a different cable.

---

## 7. Clone the repo and install dependencies

```powershell
# pick wherever you keep your projects
cd $HOME\learnreact\reactnative
git clone <repo-url> BuddyPing
cd BuddyPing
npm install
```

`npm install` will:

- Download all JS dependencies into `node_modules\`.
- Run `react-native` post-install, which compiles native modules'
  shared code.

This step takes 3–5 minutes the first time. If it fails on a
permission error, **close any open Android Studio windows** (they
sometimes lock files in `node_modules`) and retry.

---

## 8. Set up the `.env` file

The mobile app reads four environment variables at build time. They
are inlined into the JS bundle by `babel-plugin-transform-inline-
environment-variables`. There is no runtime `dotenv` lookup.

1. Copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` in your editor and fill in:

   ```
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   ONESIGNAL_APP_ID=a655d68c-44cc-48aa-be39-44a7d51a6808
   GOOGLE_WEB_CLIENT_ID=1234567890-xxxxxxxxxxxxxxx.apps.googleusercontent.com
   ```

   - The OneSignal App ID is project-wide — the value above is correct.
   - For Supabase URL/anon key and Google Web Client ID, follow
     `SUPABASE_SETUP.md` (the Supabase steps cover both).

3. **Do not** check `.env` into git. The repo's `.gitignore` already
   excludes it.

---

## 9. Place `google-services.json`

The Android side of Google Sign-In + Firebase Cloud Messaging needs
a `google-services.json` from your Firebase project.

1. Follow `SUPABASE_SETUP.md` step **7b** to download it.
2. Save it to **exactly** `android\app\google-services.json` in this
   repo.

The build will fail with "File `google-services.json` is missing" if
you skip this step.

---

## 10. Provision the Supabase backend

Follow `SUPABASE_SETUP.md` end-to-end. This sets up the database,
RLS, Edge Functions, and the cron schedules, plus Google OAuth in
Supabase Auth and OneSignal ↔ Firebase. Without this, sign-in and
notifications will not work.

You can do steps 1–9 of *this* setup doc in parallel with sections
1–4 of `SUPABASE_SETUP.md`. The point you can't proceed past is
running `npm run android` — the app crashes immediately if
`SUPABASE_URL` / `ONESIGNAL_APP_ID` / `GOOGLE_WEB_CLIENT_ID` are
empty.

---

## 11. Run it

Open **two** PowerShell windows in the repo root.

### Window 1 — Metro bundler

```powershell
npm run start
```

You should see the Metro splash screen and the message:

```
Welcome to Metro
Fast - Scalable - Integrated
```

Leave this window running. It serves the JS bundle to the device.

### Window 2 — install + launch on Android

```powershell
npm run android
```

The first run takes 5–10 minutes (Gradle downloads the Android
Gradle Plugin, NDK builds reanimated/worklets, etc.). Subsequent
runs are ~30 seconds.

When the build finishes:

- The app installs onto the connected device or emulator.
- The launcher icon **BuddyPing** appears, and the app boots
  straight into the SignIn screen.

---

## 12. Verify it actually works

1. **SignIn screen renders.** If Metro shows a red error screen
   instead, the bundle failed to build — check Metro's terminal for
   the actual error.
2. **Sign up** with email / password. (If you turned off email
   confirmation in `SUPABASE_SETUP.md` step 7d you go straight to the
   profile setup screen; otherwise check your email first.)
3. **Profile setup** — pick a username, continue.
4. **Permissions screen** — grant foreground location, then
   background ("Allow all the time"), then notifications.
5. **Home tab** loads with an empty friends list.
6. In the Supabase dashboard, **Table Editor → users** — your row
   should now have `last_location` (a hex blob) and
   `onesignal_player_id` populated. If those are still null, the
   foreground sync didn't run (check `useLocationSync` permissions
   logic in Metro logs).

---

## 13. Day-to-day commands

| Command                                  | What it does |
|------------------------------------------|--------------|
| `npm run start`                          | Start Metro (JS bundler). Hot-reload server. |
| `npm run android`                        | Build native, install on device/emulator. |
| `npm run lint`                           | ESLint over the whole tree. |
| `npm test`                               | Jest. |
| `npx tsc --noEmit`                       | Full TypeScript check, no emit. |
| `adb logcat *:E ReactNative:V ReactNativeJS:V` | Live native logs filtered to errors + RN. |
| `adb reverse tcp:8081 tcp:8081`          | Forward Metro's port to the device (if hot reload doesn't connect). |

To clear caches when something is acting weird:

```powershell
# JS / Metro
npm run start -- --reset-cache

# Gradle (after gradle plugin or NDK changes)
cd android
./gradlew clean
cd ..

# Nuclear option: wipe and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force android\app\build
npm install
```

---

## 14. Useful PowerShell snippets

Check that everything's wired up:

```powershell
# Quick env-var sanity check
"JAVA_HOME=$env:JAVA_HOME"
"ANDROID_HOME=$env:ANDROID_HOME"
"node=$(node --version)  npm=$(npm --version)  java=$((java -version 2>&1)[0])"
adb devices
```

Tail Metro logs in a new window without stopping the bundler:

```powershell
adb logcat ReactNativeJS:V ReactNative:V *:S
```

Reverse-port if the emulator/device can't reach Metro:

```powershell
adb reverse tcp:8081 tcp:8081
```

---

## 15. Troubleshooting

### `'react-native' is not recognized as the name of a cmdlet`

You're trying to run the React Native CLI globally. Don't — use the
npm scripts (`npm run android`) which call the local
`node_modules\.bin\react-native`.

### `Could not find tools.jar` / `Unsupported class file major version`

`JAVA_HOME` points to a JDK that is too old or too new. Confirm:

```powershell
java -version
$env:JAVA_HOME
```

It must be a **JDK 17** (or 21). Reinstall JDK 17 via Adoptium and
re-set `JAVA_HOME`.

### `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable`

Either `ANDROID_HOME` is unset, or you set it but PowerShell is using
a stale shell. Open a **new** PowerShell window and re-check
`$env:ANDROID_HOME`. If still empty, redo step 4c.

### Gradle build hangs at `> Configure project :app`

You have insufficient RAM or are running low on disk space. Close
Chrome / IntelliJ / other Gradle daemons and retry. The first build
needs ~3 GB of free RAM.

### `Execution failed for task ':app:processDebugGoogleServices'.`

You skipped step 9. Drop `google-services.json` into
`android\app\` and rerun.

### `Error: spawn EPERM` during `npm install`

Windows file locking — close Android Studio and any running Metro,
then re-run `npm install`. If that doesn't help, run PowerShell as
Administrator just for the install.

### App boots, then immediately crashes with `Missing SUPABASE_URL`

`.env` is empty or missing. After editing `.env`, restart Metro with
`npm run start -- --reset-cache` so the babel plugin picks up the new
values.

### `adb devices` shows nothing

- Cable is charge-only — try a different one.
- USB debugging not authorised — re-plug and accept the prompt on
  the phone.
- For some Chinese-OEM phones (Xiaomi, Vivo, etc.) you also need to
  enable **Install via USB** in Developer Options.

### "Unable to load script" red screen on the device

Metro isn't reachable from the device. Try:

```powershell
adb reverse tcp:8081 tcp:8081
```

If that doesn't work, shake the device → **Settings → Debug server
host & port for device** → enter `localhost:8081`.

### Reanimated build error: `'react-native-worklets' is required`

Reanimated 4 requires the worklets package — already in
`package.json`. If you see this, you have stale `node_modules`:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
cd android
./gradlew clean
```

### "Vision Camera code scanner is not enabled"

The QR scan screen needs `VisionCamera_enableCodeScanner=true` in
`android\gradle.properties`. This is in the repo by default — if
you've edited that file and removed the line, put it back.

---

## 16. What's safe to commit

The repo `.gitignore` already excludes:

- `.env`
- `node_modules/`
- `android/app/build/`
- `android/app/google-services.json`
- `*.keystore`

You should never commit:

- Anything from your password manager (service role key, OAuth
  client secret, OneSignal REST API key).
- A signing keystore (release builds need one — see
  `PLAY_STORE_GUIDE.md` if you're shipping).

You can safely commit:

- `.env.example` (no real values).
- `android/gradle.properties` (project-level config flags).
- The migrations under `supabase/migrations/`.

---

## 17. Where to go next

- `functionality.md` — architecture overview. Read this before
  changing the auth/permission flow or the proximity-check logic.
- `SUPABASE_SETUP.md` — backend provisioning. Mandatory before
  the app can sign in.
- `CLAUDE.md` — repo conventions and the things you must not break
  (load order, plugin ordering, longitude-first WKT, etc.).
- `PLAY_STORE_GUIDE.md` — release-build / signing instructions.
