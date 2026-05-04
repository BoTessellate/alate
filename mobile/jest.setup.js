// Jest setup file

// Mock expo-share-intent
jest.mock('expo-share-intent', () => ({
  ShareIntentProvider: ({ children }) => children,
  useShareIntentContext: jest.fn(() => ({
    shareIntent: null,
    hasShareIntent: false,
    resetShareIntent: jest.fn(),
  })),
}));

// Mock react-native-reanimated — v4 bundles worklets natively which blows up
// in node, so we provide a hand-rolled API surface instead of loading the
// package's own mock (which itself imports the native worklets module).
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Animated = { View, createAnimatedComponent: (c) => c, call: () => {} };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (cb) => ({ value: cb ? cb() : undefined }),
    withSpring: (v) => v,
    withTiming: (v, _c, cb) => {
      if (cb) cb(true);
      return v;
    },
    withDelay: (_d, v) => v,
    withSequence: (...args) => args[args.length - 1],
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (v) => v,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend' },
  };
});

// Mock react-native-worklets (new Reanimated 4 dep) — same blast radius fix
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  makeShareableCloneRecursive: jest.fn(),
  runOnUI: (fn) => fn,
  runOnJS: (fn) => fn,
}), { virtual: true });

// Mock react-native-gesture-handler's GestureDetector as a passthrough View
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children }) => children ?? null;
  const chainable = () => {
    const proxy = new Proxy(() => proxy, {
      get: () => () => proxy,
    });
    return proxy;
  };
  return {
    GestureDetector: passthrough,
    GestureHandlerRootView: ({ children, style }) =>
      React.createElement(View, { style }, children),
    Gesture: {
      Pan: chainable,
      Pinch: chainable,
      Rotation: chainable,
      LongPress: chainable,
      Tap: chainable,
      Simultaneous: (...gestures) => ({ simultaneous: gestures }),
      Race: (...gestures) => ({ race: gestures }),
    },
    State: {},
    Directions: {},
  };
});

// Mock expo-blur — BlurView is a native component, render as a passthrough View in tests
jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style, ...props }) =>
      React.createElement(View, { style, ...props }, children),
  };
});

// Mock @sbaiahmed1/react-native-blur — Fabric-ready Turbo Module for real
// Android glass. Passthrough View in tests so layout assertions work
// without the native renderer.
jest.mock('@sbaiahmed1/react-native-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style, ...props }) =>
      React.createElement(View, { style, ...props }, children),
  };
});


// Mock expo modules
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// v2 story share — flag-gated editor dependencies. Tests never hit the
// native image picker / snapshotter / share sheet; they verify the JS
// glue compiles and the screens render.
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  captureRef: jest.fn(() => Promise.resolve('file:///tmp/mock-snapshot.png')),
  default: { captureRef: jest.fn() },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @sentry/react-native — tests must never ship events to real Sentry.
// Keep the wrapper API surface matching src/utils/sentry.ts consumers.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  setExtra: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((fn) => fn({
    setTag: jest.fn(),
    setContext: jest.fn(),
    setExtra: jest.fn(),
    setLevel: jest.fn(),
  })),
  ReactNavigationInstrumentation: jest.fn(),
  ReactNativeTracing: jest.fn(),
  ErrorBoundary: ({ children }) => children,
}));

// Mock @react-native-firebase/crashlytics — tests must not hit native Firebase.
jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  default: () => ({
    log: jest.fn(),
    recordError: jest.fn(),
    setUserId: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
    crash: jest.fn(),
  }),
}), { virtual: true });

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({ name: '[DEFAULT]' })),
  },
}), { virtual: true });

// react-native-image-colors hits native pickers (UIImage on iOS,
// Palette on Android) — neither is available under jest. Stub to a
// resolved promise so `useImageBrightness` paths through cleanly in
// component tests. Mid-grey colour resolves to "dark" via the
// luminance threshold, exercising the default-text-stays-white path.
jest.mock('react-native-image-colors', () => ({
  __esModule: true,
  getColors: jest.fn(() =>
    Promise.resolve({
      platform: 'android',
      dominant: '#444444',
      average: '#444444',
      vibrant: '#444444',
      darkVibrant: '#222222',
      lightVibrant: '#666666',
      darkMuted: '#333333',
      lightMuted: '#555555',
      muted: '#444444',
    })
  ),
}), { virtual: true });

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
