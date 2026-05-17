/**
 * @format
 * Order of imports here is critical — do not reorder.
 */

// 1. URL polyfill must be before any Supabase or fetch usage
import 'react-native-url-polyfill/auto';

// 2. Gesture handler must be registered before NavigationContainer
import 'react-native-gesture-handler';

import BackgroundFetch from 'react-native-background-fetch';
import {AppRegistry} from 'react-native';
import {backgroundFetchHeadlessTask} from './src/services/backgroundFetch';
import App from './App';
import {name as appName} from './app.json';

// Register headless task BEFORE component registration so that if the OS
// wakes the JS context to deliver a stored event during app boot, the
// handler is already known. Transistorsoft documents this as safe in
// either order, but registering first eliminates a small startup race.
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

AppRegistry.registerComponent(appName, () => App);
