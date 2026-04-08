/**
 * Web polyfills for React Native Web compatibility
 * Must be imported before any other modules
 */

// Polyfill import.meta for libraries that use it (e.g., Zustand)
if (typeof window !== 'undefined') {
  // @ts-ignore
  if (!window.import_meta_env) {
    // @ts-ignore
    window.import_meta_env = { MODE: 'development', DEV: true, PROD: false };
  }
}

// This needs to be a module
export {};
