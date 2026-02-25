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
import App from './App';
import {name as appName} from './app.json';
import {backgroundFetchHeadlessTask} from './src/services/backgroundFetch';

AppRegistry.registerComponent(appName, () => App);

// Register headless task so background fetch works when app is killed
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);
