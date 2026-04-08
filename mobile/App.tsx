/**
 * Fit Check - Cross-platform Mobile App
 * Know if it fits BEFORE you buy
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider } from './src/utils/shareIntent';
import { initSentry, SentryWrap } from './src/utils/sentry';

import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';

// Initialise Sentry as early as possible (before any component renders)
initSentry();

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShareIntentProvider>
          <StatusBar style="light" backgroundColor={colors.background} />
          <AppNavigator />
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap with Sentry's error boundary so unhandled render errors are reported
export default SentryWrap(App);
