/**
 * App Navigator - Fit Check Tool
 */

import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useShareIntentContext } from '../utils/shareIntent';

import { colors, spacing, typography, fontFamily, whiteAlpha } from '../constants/theme';
import { isEnabled } from '../constants/featureFlags';
import { ScrapedProduct, FitWarning, scrapeProduct } from '../services/api';
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

// Wrap each screen with an error boundary so a crash shows a fallback
// instead of a white screen. The `name` prop tags the Sentry report.
const SafeHome = () => <ScreenErrorBoundary name="HomeScreen"><HomeScreen /></ScreenErrorBoundary>;
const SafeHistory = () => <ScreenErrorBoundary name="HistoryScreen"><HistoryScreen /></ScreenErrorBoundary>;
const SafeAccount = () => <ScreenErrorBoundary name="AccountScreen"><AccountScreen /></ScreenErrorBoundary>;
const SafeAvatarSetup = () => <ScreenErrorBoundary name="AvatarSetupScreen"><AvatarSetupScreen /></ScreenErrorBoundary>;
const SafeFitResult = () => <ScreenErrorBoundary name="FitResultScreen"><FitResultScreen /></ScreenErrorBoundary>;
const SafePickImage = () => <ScreenErrorBoundary name="PickImageScreen"><PickImageScreen /></ScreenErrorBoundary>;
const SafeOverlayEditor = () => <ScreenErrorBoundary name="OverlayEditorScreen"><OverlayEditorScreen /></ScreenErrorBoundary>;

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  AvatarSetup: undefined;
  /** v2: Story share — gated by featureFlags.V2 */
  PickImage: undefined;
  /** v2: Story share — gated by featureFlags.V2 */
  OverlayEditor: undefined;
  FitResult: {
    /** Optional — when present, FitResult skips its internal scrape
     *  step and goes straight to enrichment + fit-check. Sources that
     *  already have product data (history mode, share-intent post-
     *  scrape) pass it. The HomeScreen URL-paste flow does NOT pass
     *  this — FitResult does the scrape itself, eliminating the
     *  double-loader regression where users saw HomeScreen's loader
     *  followed by FitResult's loader back-to-back. */
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
const TAB_ICONS: Record<string, FeatherIconName> = {
  Home: 'home',
  History: 'clock',
  Account: 'user',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICONS[name] || 'circle';
  return (
    <Feather
      name={iconName}
      size={22}
      color={focused ? colors.primary : colors.text}
      style={{ opacity: focused ? 1 : 0.45 }}
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
          // Full pill — borderRadius matches the height/2 cap so the
          // shape is unambiguously capsule-shaped at any width.
          borderRadius: 32,
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
          fontFamily: fontFamily.primary,
          fontSize: 10,
          fontWeight: '600',
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
        }}
      />
      <Tab.Screen
        name="History"
        component={SafeHistory}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
          tabBarButtonTestID: 'tab-history',
        }}
      />
      <Tab.Screen
        name="Account"
        component={SafeAccount}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Account" focused={focused} />,
          tabBarButtonTestID: 'tab-account',
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
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const processingRef = useRef(false);

  // First-launch age gate — blocks everything until the user confirms
  // they're 16+. Measurements are GDPR Article 8 / DPDPA-sensitive data,
  // so we gate collection behind an explicit confirmation. The store
  // persists the confirmation timestamp, so this only shows on first
  // install (or after body-profile deletion if we later wire that to
  // reset the gate).
  if (!ageConfirmedAt) {
    return <AgeGateOverlay />;
  }

  useEffect(() => {
    if (!hasShareIntent || processingRef.current) return;

    const url = shareIntent?.webUrl || shareIntent?.text;
    if (!url || !isValidUrl(url)) {
      resetShareIntent();
      return;
    }

    handleSharedUrl(url);
  }, [hasShareIntent, shareIntent]);

  const handleSharedUrl = async (url: string) => {
    processingRef.current = true;
    setIsProcessingShare(true);

    // If no avatar, store URL and redirect to avatar setup
    if (!avatar) {
      setPendingUrl(url);
      resetShareIntent();
      processingRef.current = false;
      setIsProcessingShare(false);
      setTimeout(() => {
        navigationRef.current?.navigate('AvatarSetup');
      }, 100);
      return;
    }

    try {
      const result = await scrapeProduct(url);
      if (result.success && result.data) {
        resetShareIntent();
        setTimeout(() => {
          navigationRef.current?.navigate('FitResult', {
            product: result.data!,
            url,
          });
        }, 100);
      } else {
        resetShareIntent();
      }
    } catch (error) {
      console.error('Share intent processing failed:', error);
      resetShareIntent();
    } finally {
      processingRef.current = false;
      setIsProcessingShare(false);
    }
  };

  // Show loading overlay when processing share intent
  if (isProcessingShare) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Processing shared URL...</Text>
      </View>
    );
  }

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
            fontWeight: '600',
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
    borderRadius: 32,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
