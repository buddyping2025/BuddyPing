/**
 * BuddyPing — Android friend-proximity app
 * Pure React Native, no Expo dependencies
 */
import './global.css';

import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {RootNavigator} from './src/navigation/RootNavigator';
import {initializeOneSignal} from './src/services/onesignal';
import {configureBackgroundFetch} from './src/services/backgroundFetch';
import {configureGoogleSignIn} from './src/services/googleSignIn';

// Initialize third-party SDKs at app start (outside React tree)
initializeOneSignal();
configureGoogleSignIn();
configureBackgroundFetch();

export default function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
