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
import { useShareIntentContext } from '../utils/shareIntent';

import { colors, spacing, typography } from '../constants/theme';
import { ScrapedProduct, FitWarning, scrapeProduct } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { usePendingShareStore } from '../store/pendingShareStore';

// Screens
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AvatarSetupScreen from '../screens/AvatarSetupScreen';
import FitResultScreen from '../screens/FitResultScreen';
import AccountScreen from '../screens/AccountScreen';

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  AvatarSetup: undefined;
  FitResult: {
    product: ScrapedProduct;
    url: string;
    historyEntryId?: string;
    precomputed?: {
      fitScore: 'great' | 'moderate' | 'poor';
      warnings: FitWarning[];
      sizeRecommendation?: { size: string; confidence: 'high' | 'medium' | 'low'; note?: string };
      enrichedProduct?: { category?: string; material?: string; tags?: string[] };
      checkedAt?: string;
    };
  };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab icon names mapping
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
const TAB_ICONS: Record<string, FeatherIconName> = {
  Home: 'search',
  History: 'server',
  Account: 'user',
};

// Tab Bar Icon Component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICONS[name] || 'circle';

  return (
    <View style={styles.tabIconContainer}>
      <Feather
        name={iconName}
        size={22}
        color={focused ? colors.primary : colors.textSecondary}
        style={focused ? styles.tabIconFocused : undefined}
      />
    </View>
  );
}

// Main Tab Navigator
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
          height: 70 + insets.bottom,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Account" focused={focused} />,
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
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const processingRef = useRef(false);

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
          component={AvatarSetupScreen}
          options={{
            title: 'Body Profile',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="FitResult"
          component={FitResultScreen}
          options={{
            title: 'Fit Analysis',
            headerBackTitle: 'Back',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
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
