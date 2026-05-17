/**
 * @format
 * Order of imports here is critical — do not reorder.
 */

// 1. URL polyfill must be before any Supabase or fetch usage
import 'react-native-url-polyfill/auto';

// 2. Gesture handler must be registered before NavigationContainer
import 'react-native-gesture-handler';

import BackgroundFetch from 'react-native-background-fetch';
import messaging from '@react-native-firebase/messaging';
import {AppRegistry} from 'react-native';
import {backgroundFetchHeadlessTask} from './src/services/backgroundFetch';
import {wakeAndUploadLocation} from './src/services/wakeLocation';
import App from './App';
import {name as appName} from './app.json';

// Register headless task BEFORE component registration so that if the OS
// wakes the JS context to deliver a stored event during app boot, the
// handler is already known. Transistorsoft documents this as safe in
// either order, but registering first eliminates a small startup race.
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

// FCM background handler: must be registered synchronously at module
// load (RNFB requirement) so the OS can dispatch a data-only push to
// it when waking a killed JS context. The server sends pushes with
// data.type='request_location_update' ~10 min before each proximity-
// check cron tick, ensuring users.last_location is fresh regardless
// of whether the user opened the app today.
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage?.data?.type === 'request_location_update') {
    await wakeAndUploadLocation();
  }
});

AppRegistry.registerComponent(appName, () => App);
