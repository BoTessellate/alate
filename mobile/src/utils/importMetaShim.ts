/**
 * Shim for import.meta.env
 * This file should be imported at the very top of index.ts
 */

// Only run on web
if (typeof document !== 'undefined') {
  // Create a fake import.meta.env
  const fakeEnv = {
    MODE: __DEV__ ? 'development' : 'production',
    DEV: __DEV__,
    PROD: !__DEV__,
  };

  // Try to patch globalThis
  try {
    Object.defineProperty(globalThis, 'import', {
      value: { meta: { env: fakeEnv } },
      writable: false,
      configurable: true,
    });
  } catch (e) {
    // Ignore if already defined
  }
}

export {};
