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
    // Viaoda Libre retired May 4 2026 late-PM ("replace all VL font
    // with jost please. I'm keeping only jost and tan nightingale").
    // The ttf file is left on disk but no longer registered or
    // referenced — Jost-Regular carries the display tier now and TAN
    // Nightingale SVGs handle proper page-title chrome.
    // DM Sans (Google Fonts, OFL) — body / label / button face,
    // replacing the platform system serif (May 2 2026). Loaded as four
    // discrete weight files because RN Android's font weight resolution
    // is unreliable across sub-families (Medium and SemiBold register
    // as their own family per the ttf name table — `'DM Sans Medium'`,
    // `'DM Sans SemiBold'`). Reference each weight by its expo-font
    // key directly in styles (`fontFamily: 'DMSans-Medium'`) instead of
    // relying on the family + fontWeight resolver — same defensive
    // pattern as Viaoda Libre.
    //
    // Each ttf is also bundled into
    // `android/app/src/main/assets/fonts/` so RN Android's typeface
    // manager can resolve by file basename — same belt-and-braces as
    // Viaoda Libre (see project_regression_log.md font-binding saga).
    'DMSans-Regular': require('./assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('./assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('./assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('./assets/fonts/DMSans-Bold.ttf'),
    // Marcellus (Google Fonts, OFL) — single-weight roman serif. Trial
    // swap May 3 2026: replaces DM Sans on body / labels AND Viaoda
    // Libre on headings to put the entire app on a single typographic
    // voice. Font is single-weight (Regular only) so the
    // medium/semibold/bold tokens point at the same file — Android
    // synthesises bolder strokes where needed; expect uniform weight
    // visually.
    'Marcellus-Regular': require('./assets/fonts/Marcellus-Regular.ttf'),
    // Jost (Google Fonts, OFL) — geometric humanist sans-serif. Trial
    // body face on the Home screen only (May 3 2026): paired with
    // Marcellus to test a sans/serif voice mix on the landing
    // surface. Bundled as the static "Book" weight (the indestructible-
    // type repo's 400-Book ttf, registered as Jost-Regular). NameID 1
    // is "Jost*" with an asterisk; resolve via the file basename / key.
    'Jost-Regular': require('./assets/fonts/Jost-Regular.ttf'),
    // Jost Light (300 weight) — applied on the FitResult error
    // overlay body text. Sister of Jost-Regular; trial pairing with
    // Marcellus headings (May 3 2026).
    'Jost-Light': require('./assets/fonts/Jost-Light.ttf'),
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
