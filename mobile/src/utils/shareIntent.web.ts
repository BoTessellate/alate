/**
 * Web stub for expo-share-intent
 * Share intent is mobile-only, this provides a no-op implementation for web
 */

import React from 'react';

export const useShareIntentContext = () => ({
  shareIntent: null,
  hasShareIntent: false,
  resetShareIntent: () => {},
});

export const ShareIntentProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};
