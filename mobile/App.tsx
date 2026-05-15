/**
 * Fit Check - Cross-platform Mobile App
 * Know if it fits BEFORE you buy
 */

import React, { useCallback } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ShareIntentProvider } from './src/utils/shareIntent';
import { initSentry, SentryWrap } from './src/utils/sentry';
import { initCrashlytics } from './src/services/crashlytics';

// Silence known dev-mode noise that otherwise covers the UI with a warning
// banner. These are Firebase/RN deprecation warnings — tracked in the
// crashlytics migration backlog, not actionable for users.
// Using regex so we catch every variant (one per method).
LogBox.ignoreLogs([
  /React Native Firebase namespaced API/i,
  /Please use `getApp\(\)` instead/i,
  /Bridgeless doesn't support CatalystInstance/i,
  /setCrashlyticsCollectionEnabled/,
  /Method called was/i,
  /rnfirebase\.io\/migrating-to-v22/,
  /SafeAreaView has been deprecated/i,
  /expo-linear-gradient/i,
]);

import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';
import { useFitHistoryStore } from './src/store/fitHistoryStore';
import { DEV_FIT_ENTRIES } from './src/devSeed';

// Keep the splash visible while we initialise telemetry.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialise telemetry as early as possible (before any component renders).
// Sentry catches JS + native crashes via its RN SDK; Crashlytics adds a
// second channel for native-side faults and ANRs that stream to BigQuery.
initSentry();
initCrashlytics();

// Dev-only: populate an empty history with 15 fixture entries so the
// cover flow has something to scroll during visual review. No-op in
// production builds (__DEV__ is false) and no-op when the user already
// has real history, so it never clobbers anything.
if (__DEV__) {
  useFitHistoryStore.getState().seedDevHistory(DEV_FIT_ENTRIES);
}

function App() {
  // Display serif used by all heading tokens (see theme.ts). Splash stays up
  // (preventAutoHideAsync above) until both the font is loaded AND onLayout
  // fires, so the first visible frame renders in the real face, not a
  // fallback that would then snap over.
  const [fontsLoaded] = useFonts({
    // Marcellus (Google Fonts, OFL) — single-weight roman serif. The
    // app's only bundled font: body, labels, buttons AND headings all
    // render in it (see theme.ts). Single-weight (Regular only) so
    // every weight token points at this one file — Android synthesises
    // bolder strokes where needed. Page-title chrome renders via TAN
    // Nightingale SVG paths (HeadingImage), not a bundled face.
    'Marcellus-Regular': require('./assets/fonts/Marcellus-Regular.ttf'),
  });

  const onLayoutReady = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutReady}>
      <SafeAreaProvider>
        <ShareIntentProvider>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <AppNavigator />
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap with Sentry's error boundary so unhandled render errors are reported
export default SentryWrap(App);
