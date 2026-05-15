# BuddyPing — Release Build on Ubuntu

Complete setup guide for building a release APK on a clean Ubuntu system.

---

## Part 1 — One-time system setup

### 1. Java 17

```bash
sudo apt update
sudo apt install openjdk-17-jdk -y
java --version   # must show 17.x
```

### 2. Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # must show 22.x
npm --version
```

### 3. Android SDK command-line tools

Download the Linux ZIP from https://developer.android.com/studio#command-line-tools-only

```bash
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
unzip ~/Downloads/commandlinetools-linux-*.zip
mv cmdline-tools latest
```

Add to `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/ndk/27.1.12297006
```

Apply immediately:

```bash
source ~/.bashrc
```

### 4. Android SDK components

Install exactly these versions (they match what the build expects):

```bash
yes | sdkmanager --licenses
sdkmanager \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;27.1.12297006"
```

Verify:

```bash
sdkmanager --list_installed | grep -E "ndk|build-tools|platforms;android-36"
```

---

## Part 2 — One-time project setup

### 1. Get the project

```bash
git clone <your-repo-url> BuddyPing
cd BuddyPing
```

### 2. Copy the three files that are not in git

These must be copied from Windows each time you set up on a new machine:

| File | What it is |
|------|-----------|
| `android/app/google-services.json` | Firebase config — download from Firebase Console |
| `.env` | API keys — copy from your Windows `.env` |
| `android/app/buddyping-release.jks` | Release keystore — copy from Windows |

From Windows you can copy them over SCP, a USB drive, or Google Drive.

### 3. Set your keystore passwords

Open `android/gradle.properties` and replace the two placeholder lines at the bottom:

```
BUDDYPING_RELEASE_STORE_PASSWORD=your_actual_keystore_password
BUDDYPING_RELEASE_KEY_PASSWORD=your_actual_key_password
```

> Do not commit this file after adding real passwords. Add it to your gitignore,
> or keep passwords only in a local copy of the file.

### 4. Install Node dependencies

```bash
npm install
```

---

## Part 3 — Building the APK

```bash
./scripts/build-release.sh
```

The script checks for required files, runs `npm install` if needed, builds, and prints the APK path.

**Manual equivalent:**

```bash
cd android
./gradlew clean assembleRelease
```

Output APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## Part 4 — Sharing with friends

Send `app-release.apk` directly (WhatsApp, Google Drive, email, AirDrop to Android, etc.).

Friends must enable **Settings → Apps → Install unknown apps** (exact path varies by Android version) before installing.

---

## Troubleshooting

**`SDK location not found`**
Gradle can't find the Android SDK. Create `android/local.properties`:
```bash
echo "sdk.dir=$HOME/android-sdk" > android/local.properties
```

**`Couldn't determine Hermesc location`**
The Windows hermesc binary is missing — this is expected. On Ubuntu the Linux hermesc is present and auto-detected. Make sure you did not add a `hermesCommand` line pointing to `win64-bin` in `android/app/build.gradle`.

**`License for package NDK not accepted`**
```bash
yes | sdkmanager --licenses
```

**`JAVA_HOME not set` or wrong Java version**
```bash
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
java --version   # confirm 17.x
```

**Build runs out of memory**
`android/gradle.properties` already sets `-Xmx2048m`. If builds still fail, increase to `-Xmx4096m`.
