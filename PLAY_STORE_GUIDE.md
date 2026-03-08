# Play Store — Background Location Declaration Guide

## Overview

BuddyPing declares `ACCESS_BACKGROUND_LOCATION` in its Android manifest. Google Play requires a written justification before it will approve the app.

---

## Manifest Permissions (reference)

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

---

## Play Console Declaration Form

**Path:** Play Console → Your App → Policy → App content → Sensitive permissions → Background location

### Answers

| Field | Value |
|-------|-------|
| Does your app access location in the background? | **Yes** |
| Why does your app need background location? | **Core functionality** |

### Justification Text (copy-paste)

> BuddyPing uses background location to periodically upload the device's GPS coordinates via Android WorkManager (approximately every 12 hours). This is the core feature of the app: a server-side function compares the coordinates of mutual friends and sends a push notification when two friends are within the user-defined proximity threshold. The background location data is used solely for this proximity calculation — no location history is stored beyond the most recent GPS fix, and the coordinates are never exposed to any third party or displayed to other users. Only the calculated distance (e.g. "~2 km away") is shared between accepted friends.

---

## Google Policy Reference

- Background location policy: https://support.google.com/googleplay/android-developer/answer/9799150
- Prominent disclosure requirement: users must be shown a clear in-app explanation before the system permission dialog

## In-App Disclosure (already implemented)

`LocationPermissionScreen` shows the following text on the "Background Location" step before opening Settings:

> "To check proximity even when the app is closed, BuddyPing needs background location access."

This satisfies the prominent disclosure requirement.

---

## Video Demo Requirement

Google may request a screen recording showing:
1. The in-app disclosure text (LocationPermissionScreen — background step)
2. The user tapping "Open Settings"
3. The Android Settings screen where the user selects "Allow all the time"
4. Return to the app and the permission gate advancing

Record at: `adb shell screenrecord /sdcard/demo.mp4`
