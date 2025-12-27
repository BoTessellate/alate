/**
 * Shopify SDK
 * Main exports for Shopify integration
 */

// Types
export * from './types';

// Auth utilities
export {
  encryptToken,
  decryptToken,
  isValidShopDomain,
  generateStateNonce,
  buildAuthUrl,
  exchangeCodeForToken,
  verifyCallbackHmac,
  verifyWebhookHmac,
  isSessionExpired,
  sanitizeShopDomain,
  getShopifyConfig,
} from './auth';

// GraphQL client
export { ShopifyGraphQLClient, createShopifyClient } from './client';

// Product transformation
export {
  transformShopifyProduct,
  transformShopifyProducts,
  generateFitTags,
} from './transformer';

// Sync operations
export {
  syncShopProducts,
  getShopSyncStatus,
  updateLastSyncTime,
  handleProductWebhook,
  handleProductDeleteWebhook,
  getISTTimestamp,
} from './sync';
