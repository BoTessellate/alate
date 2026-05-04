/**
 * App Navigator - Fit Check Tool
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useShareIntentContext } from '../utils/shareIntent';

import { colors, spacing, typography, fontFamily, whiteAlpha, borderRadius } from '../constants/theme';
import { isEnabled } from '../constants/featureFlags';
import { ScrapedProduct, FitWarning } from '../services/api';

/** Steps the AvatarSetup screen scrolls to when navigated with a
 *  `focusKey`. Mirrors the STEPS array's `key` field; centralised
 *  here so tap-to-edit affordances elsewhere (Account screen profile
 *  rows) stay in sync without duplicating the literal union. */
export type AvatarFocusKey =
  | 'gender'
  | 'height'
  | 'shoulders'
  | 'bust'
  | 'waist'
  | 'tummy'
  | 'hips'
  | 'thighs'
  | 'torso';
import type { FitHistoryEntry } from '../store/fitHistoryStore';
import { useAvatarStore } from '../store/avatarStore';
import { usePendingShareStore } from '../store/pendingShareStore';
import { useAgeGateStore } from '../store/ageGateStore';
import ScreenErrorBoundary from '../components/ScreenErrorBoundary';
import AgeGateOverlay from '../components/AgeGateOverlay';

// Screens
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AvatarSetupScreen from '../screens/AvatarSetupScreen';
import FitResultScreen from '../screens/FitResultScreen';
import AccountScreen from '../screens/AccountScreen';
import PickImageScreen from '../screens/PickImageScreen';
import OverlayEditorScreen from '../screens/OverlayEditorScreen';
import BrandIntegrationScreen from '../screens/BrandIntegrationScreen';

// Wrap each screen with an error boundary so a crash shows a fallback
// instead of a white screen. The `name` prop tags the Sentry report.
const SafeHome = () => <ScreenErrorBoundary name="HomeScreen"><HomeScreen /></ScreenErrorBoundary>;
const SafeHistory = () => <ScreenErrorBoundary name="HistoryScreen"><HistoryScreen /></ScreenErrorBoundary>;
const SafeAccount = () => <ScreenErrorBoundary name="AccountScreen"><AccountScreen /></ScreenErrorBoundary>;
const SafeAvatarSetup = () => <ScreenErrorBoundary name="AvatarSetupScreen"><AvatarSetupScreen /></ScreenErrorBoundary>;
const SafeFitResult = () => <ScreenErrorBoundary name="FitResultScreen"><FitResultScreen /></ScreenErrorBoundary>;
const SafePickImage = () => <ScreenErrorBoundary name="PickImageScreen"><PickImageScreen /></ScreenErrorBoundary>;
const SafeOverlayEditor = () => <ScreenErrorBoundary name="OverlayEditorScreen"><OverlayEditorScreen /></ScreenErrorBoundary>;
const SafeBrandIntegration = () => <ScreenErrorBoundary name="BrandIntegrationScreen"><BrandIntegrationScreen /></ScreenErrorBoundary>;

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  AvatarSetup: { focusKey?: AvatarFocusKey } | undefined;
  /** "For Brands" pitch screen — opened from the Account tab's
   *  "Are you a brand?" CTA. */
  BrandIntegration: undefined;
  /** v2: Story share — gated by featureFlags.V2 */
  PickImage: undefined;
  /** v2: Story share — gated by featureFlags.V2 */
  OverlayEditor: undefined;
  FitResult: {
    /** Optional — when present, FitResult skips its internal scrape
     *  step and goes straight to enrichment + fit-check. Sources that
     *  already have product data (history mode) pass it. The
     *  URL-paste and share-intent flows do NOT pass this — FitResult
     *  does the scrape itself, eliminating the double-loader regression
     *  where users saw an intermediate loader followed by FitResult's
     *  loader back-to-back. */
    product?: ScrapedProduct;
    url: string;
    historyEntryId?: string;
    precomputed?: {
      fitScore: 'great' | 'moderate' | 'poor';
      warnings: FitWarning[];
      sizeRecommendation?: { size: string; confidence: 'high' | 'medium' | 'low'; note?: string };
      enrichedProduct?: { category?: string; material?: string; tags?: string[] };
      checkedAt?: string;
    };
    // When navigating from History, pass the full entries list + the
    // starting index so the user can horizontally swipe to sift through
    // the rest from inside fit analysis — no fetch, it's all local.
    historyEntries?: FitHistoryEntry[];
    currentIndex?: number;
  };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab icon + label mapping — Claude Design uses a floating glass pill
// with three tabs: Check / History / Profile (not "Home"/"Account").
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
// The "Check" tab is the paste-a-URL entry point, not a home page —
// the previous `home` (house) glyph read as a misdirect. `link` mirrors
// the URL-paste action of the screen and pairs visually with the link
// icon inside the paste pill on HomeScreen.
const TAB_ICONS: Record<string, FeatherIconName> = {
  Home: 'link',
  History: 'clock',
  Account: 'user',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICONS[name] || 'circle';
  // Inactive icon opacity bumped 0.45 → 0.7 (May 3 2026 PM contrast
  // pass). At 0.45 the dark `colors.text` glyph blended with the
  // light frosted tab-bar background to a mid-grey-on-mid-grey pair
  // measuring ~2.5:1 — fails WCAG 1.4.11 (3:1 for non-text UI). At
  // 0.7 the same icon clears 4:1 while still reading visibly less
  // active than the focused tab (which sits at opacity 1 + the
  // primary brand colour). Hierarchy preserved, contrast restored.
  return (
    <Feather
      name={iconName}
      size={22}
      color={focused ? colors.primary : colors.text}
      style={{ opacity: focused ? 1 : 0.7 }}
    />
  );
}

// Floating glass tab bar background — blur + white tint + hairline edge,
// matching the design's `.a-glass` card styling.
function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
      <View style={styles.tabBarTint} />
    </View>
  );
}

// Main Tab Navigator — floating glass pill at the bottom (not docked).
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          // Tucked in further from all edges so the pill reads as a
          // floating element rather than a docked bar snapped to the
          // bottom. 40px inset on sides (was 24) so the pill no longer
          // stretches almost edge-to-edge on phone widths — sits as a
          // discrete capsule with visible gradient backdrop on either
          // side. 24+insets on bottom.
          left: 40,
          right: 40,
          // Bottom offset reduced from +24 → +10 so the pill sits
          // closer to the device gesture-bar without crowding it.
          // Per user direction "drop the placement of the floating
          // nav bar by a few more pixels, it floats a little too
          // high right now". 10px clears the edge on phones with no
          // home indicator; on devices with insets.bottom > 0 the
          // safe-area inset already covers the gesture-bar so the
          // +10 is pure breathing room.
          bottom: (insets.bottom > 0 ? insets.bottom : 0) + 10,
          height: 64,
          // Rounded rectangle (May 3 2026) — matches the search-pill
          // and Recent card corner radius (borderRadius.xl = 16) on
          // the Home screen so the nav bar reads as a tile in the
          // same family, not a separate capsule shape. Was 32 (full
          // pill) — felt visually disconnected from the rest.
          borderRadius: borderRadius.xl,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: whiteAlpha.borderSoft,
          shadowColor: '#2f2937',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 24,
          elevation: 14,
          // Background transparent — TabBarBackground renders the blur.
          backgroundColor: 'transparent',
          // Clip the BlurView + tint to the rounded edge. Without this
          // the corners show sharp blur rectangles outside the pill.
          overflow: 'hidden',
          paddingTop: 8,
          paddingBottom: 6,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: fontFamily.primarySemiBold,
          fontSize: 10,
          fontWeight: '400',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarItemStyle: { opacity: 1 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={SafeHome}
        options={{
          tabBarLabel: 'Check',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
          tabBarButtonTestID: 'tab-home',
          // Spell out the role for TalkBack — the visible "Check"
          // label is just two syllables; the SR announcement should
          // explain what tapping it does.
          tabBarAccessibilityLabel: 'Check, paste a product link to check fit',
        }}
      />
      <Tab.Screen
        name="History"
        component={SafeHistory}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
          tabBarButtonTestID: 'tab-history',
          tabBarAccessibilityLabel: 'History, your saved fit checks',
        }}
      />
      <Tab.Screen
        name="Account"
        component={SafeAccount}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Account" focused={focused} />,
          tabBarButtonTestID: 'tab-account',
          tabBarAccessibilityLabel: 'Profile, account and body measurements',
        }}
      />
    </Tab.Navigator>
  );
}

// URL validation helper
function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Root Stack Navigator with Share Intent Handler
export default function AppNavigator() {
  const { shareIntent, hasShareIntent, resetShareIntent } = useShareIntentContext();
  const { avatar } = useAvatarStore();
  const { setPendingUrl } = usePendingShareStore();
  const ageConfirmedAt = useAgeGateStore((s) => s.confirmedAt);
  // Hard block on share-intent when the user self-declared under 16.
  // The age gate already keeps them on the deflection screen, but
  // ShareIntent is OS-level — Android can deliver a URL via the share
  // sheet to a backgrounded app, which would otherwise navigate them
  // INTO the avatar / fit flow regardless of the deflection. This
  // flag short-circuits the handler before any data-collection path
  // can fire.
  const declaredUnder16 = useAgeGateStore((s) => s.declaredUnder16);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const processingRef = useRef(false);

  // Share-intent handler — runs on every render; bails out internally
  // when the gate is closed or when there's nothing to process. Stays
  // ABOVE the early-return below because React requires hooks to be
  // called in the same order every render, and the AgeGate early-
  // return would otherwise add/remove this hook between renders (the
  // exact bug that produced the white screen on April 29 2026 after
  // confirming the age gate — pre-confirm React saw 7 hooks, post-
  // confirm it saw 8, and crashed the tree on the count change).
  useEffect(() => {
    // Drop any incoming share intent without processing when the
    // user is under 16. The intent is reset so it won't re-fire
    // when the age state later flips.
    if (declaredUnder16) {
      if (hasShareIntent) resetShareIntent();
      return;
    }
    if (!ageConfirmedAt) return;
    if (!hasShareIntent || processingRef.current) return;

    const url = shareIntent?.webUrl || shareIntent?.text;
    if (!url || !isValidUrl(url)) {
      resetShareIntent();
      return;
    }

    handleSharedUrl(url);
  }, [hasShareIntent, shareIntent, ageConfirmedAt, declaredUnder16]);

  // First-launch age gate — blocks everything until the user confirms
  // they're 16+. Measurements are GDPR Article 8 / DPDPA-sensitive
  // data, so we gate collection behind an explicit confirmation. The
  // store persists the timestamp, so this only shows on first install
  // (or after body-profile deletion if we later wire that to reset
  // the gate). Render-level early return — DO NOT add hooks below.
  if (!ageConfirmedAt) {
    return <AgeGateOverlay />;
  }

  const handleSharedUrl = (url: string) => {
    processingRef.current = true;

    // If no avatar, store URL and redirect to avatar setup. The URL
    // is replayed once the user finishes onboarding.
    if (!avatar) {
      setPendingUrl(url);
      resetShareIntent();
      processingRef.current = false;
      setTimeout(() => {
        navigationRef.current?.navigate('AvatarSetup');
      }, 100);
      return;
    }

    // Hand the URL straight to FitResult — it scrapes + enriches +
    // fit-checks under a single FitLoader. No intermediate "Processing
    // shared URL..." screen; FitLoader IS the processing UI, just on
    // the destination screen so the transition feels seamless. Mirrors
    // the HomeScreen URL-paste flow.
    //
    // We `reset` rather than `replace` so the resulting stack is
    // [Main(History tab focused), FitResult] instead of [FitResult]:
    //   1. Back from FitResult lands on the History tab — once the
    //      fit completes it's saved to history, so the user can
    //      scroll past the just-shared item to access prior searches.
    //      Same UX as navigating into FitResult from History.
    //   2. `reset` rebuilds the stack from scratch, which forces a
    //      remount even when the user was already viewing FitResult.
    //      That preserves the fix for the April 29 2026 regression
    //      where stale useState lazy initialisers carried through
    //      (shared product missing from history, wrong scrape details,
    //      male-profile users seeing women's-fit results from the
    //      previous mount).
    resetShareIntent();
    processingRef.current = false;
    setTimeout(() => {
      navigationRef.current?.reset({
        index: 1,
        routes: [
          {
            name: 'Main',
            state: {
              index: 1,
              routes: [
                { name: 'Home' },
                { name: 'History' },
                { name: 'Account' },
              ],
            },
          },
          { name: 'FitResult', params: { url } },
        ],
      });
    }, 100);
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '400',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AvatarSetup"
          component={SafeAvatarSetup}
          options={{
            // Hide the native stack header — the screen paints its own
            // TAN Nightingale "body profile" title via HeadingImage, so
            // the native title + back button would duplicate what the
            // screen already owns. Back navigation is handled by the
            // screen's own back chevron.
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="FitResult"
          component={SafeFitResult}
          options={{
            // Hide the native stack header entirely — the screen paints its
            // product image edge-to-edge as the page background, with its
            // own in-card brand/name hero and a floating back chevron. The
            // native 'Fit Analysis' header would otherwise (a) cover the
            // top of the image and (b) add a second redundant back arrow.
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="BrandIntegration"
          component={SafeBrandIntegration}
          options={{
            // Native header retired May 3 2026 PM per user feedback:
            // (a) the title "For Brands" duplicated the in-screen
            // wordmark in the top header AND made content scroll
            // under the bar; (b) the screen now paints its own
            // back chevron in the brand purple. Same pattern as
            // FitResult / AvatarSetup.
            headerShown: false,
            presentation: 'modal',
          }}
        />
        {/* v2: Story share. Routes are only registered when the flag is
            on so there's no way to reach them in a production build until
            the feature ships. */}
        {isEnabled('V2') && (
          <>
            <Stack.Screen
              name="PickImage"
              component={SafePickImage}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="OverlayEditor"
              component={SafeOverlayEditor}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  // Glass tint layer inside the floating tab bar pill — sits over the
  // BlurView to keep labels legible on any background. Matches the
  // tab bar's borderRadius so it clips cleanly inside the capsule.
  tabBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: whiteAlpha.surfaceFrost,
    // Matches tabBarStyle.borderRadius above so the tint clips
    // cleanly inside the rounded-rectangle bar.
    borderRadius: borderRadius.xl,
  },
});
