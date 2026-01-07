/**
 * Product Image Search SDK
 *
 * Finds reference product images to replace incorrectly cropped user uploads.
 * Instead of fixing bounding box detection issues, we substitute with clean
 * product images from our database or web search.
 *
 * Search Strategy:
 * 1. First: Check enriched_products table for similar products (free, fast, reliable)
 * 2. Second: Web search via Google Custom Search API (paid, comprehensive)
 * 3. Fallback: Use user's cropped image if no match found
 *
 * @example
 * ```typescript
 * const result = await findBestProductImage({
 *   name: 'Bose QuietComfort 45 Headphones',
 *   brand: 'Bose',
 *   category: 'headphones',
 *   tags: ['wireless', 'noise-cancelling'],
 *   colors: ['black'],
 *   confidence: 0.95,
 * });
 *
 * if (result.found) {
 *   console.log('Found image:', result.imageUrl);
 *   console.log('Source:', result.source); // 'database' | 'web_search'
 * }
 * ```
 */

import { createModuleLogger } from '../shared/logger';
import { findBestDatabaseMatch, searchDatabaseForProduct } from './databaseSearch';
import { findBestWebImage, searchWebForProductImage } from './webSearch';
import type {
  DetectedProductInfo,
  ProductImageSearchResult,
  ProductImageSearchConfig,
  DEFAULT_CONFIG,
} from './types';

const logger = createModuleLogger('product-image-search');

// Re-export types and utilities
export * from './types';
export { searchDatabaseForProduct, findBestDatabaseMatch } from './databaseSearch';
export { searchWebForProductImage, findBestWebImage } from './webSearch';

/**
 * Find the best product image for a detected product
 *
 * This is the main entry point for the SDK. It orchestrates the search
 * strategy: database first, then web search, with smart fallbacks.
 *
 * @param detected - Product information from Vision AI detection
 * @param config - Optional configuration overrides
 * @returns Search result with image URL and metadata
 */
export async function findBestProductImage(
  detected: DetectedProductInfo,
  config: ProductImageSearchConfig = {}
): Promise<ProductImageSearchResult> {
  const startTime = Date.now();
  const {
    enableDatabaseSearch = true,
    enableWebSearch = true,
    databaseMinSimilarity = 0.6,
  } = config;

  logger.info({
    name: detected.name,
    brand: detected.brand,
    category: detected.category,
    confidence: detected.confidence,
    enabledSources: {
      database: enableDatabaseSearch,
      web: enableWebSearch,
    },
  }, 'Starting product image search');

  // Strategy 1: Database search (preferred - free, fast, reliable)
  if (enableDatabaseSearch) {
    try {
      const dbMatch = await findBestDatabaseMatch(detected, databaseMinSimilarity);

      if (dbMatch) {
        const searchTime = Date.now() - startTime;

        logger.info({
          source: 'database',
          matchedProduct: dbMatch.product_name,
          similarity: dbMatch.similarity,
          searchTimeMs: searchTime,
        }, 'Found product image in database');

        return {
          found: true,
          imageUrl: dbMatch.image_url,
          source: 'database',
          matchScore: dbMatch.similarity,
          matchedProductId: dbMatch.id,
          matchedProductName: dbMatch.product_name,
          searchTimeMs: searchTime,
        };
      }
    } catch (error) {
      logger.warn({ error }, 'Database search failed, trying web search');
    }
  }

  // Strategy 2: Web search (fallback - paid, comprehensive)
  if (enableWebSearch) {
    try {
      const webResult = await findBestWebImage(detected);

      if (webResult) {
        const searchTime = Date.now() - startTime;

        logger.info({
          source: 'web_search',
          imageUrl: webResult.imageUrl,
          sourceHost: webResult.source,
          searchTimeMs: searchTime,
        }, 'Found product image via web search');

        return {
          found: true,
          imageUrl: webResult.imageUrl,
          source: 'web_search',
          searchQuery: `${detected.brand || ''} ${detected.name} ${detected.category}`.trim(),
          searchTimeMs: searchTime,
        };
      }
    } catch (error) {
      logger.warn({ error }, 'Web search failed');
    }
  }

  // No match found - return unfound result
  const searchTime = Date.now() - startTime;

  logger.info({
    name: detected.name,
    searchTimeMs: searchTime,
  }, 'No product image found, will use user crop');

  return {
    found: false,
    source: 'user_crop',
    searchTimeMs: searchTime,
  };
}

/**
 * Batch search for multiple products
 * Useful for multi-product detection flows
 */
export async function findBestProductImages(
  detectedProducts: DetectedProductInfo[],
  config: ProductImageSearchConfig = {}
): Promise<ProductImageSearchResult[]> {
  const results = await Promise.all(
    detectedProducts.map(detected => findBestProductImage(detected, config))
  );

  // Log summary
  const found = results.filter(r => r.found).length;
  const fromDatabase = results.filter(r => r.source === 'database').length;
  const fromWeb = results.filter(r => r.source === 'web_search').length;
  const userCrop = results.filter(r => r.source === 'user_crop').length;

  logger.info({
    total: detectedProducts.length,
    found,
    sources: {
      database: fromDatabase,
      web: fromWeb,
      userCrop,
    },
  }, 'Batch product image search completed');

  return results;
}

/**
 * Check if a product might benefit from image search
 * Based on category and detection confidence
 */
export function shouldSearchForImage(detected: DetectedProductInfo): boolean {
  // High confidence detections are more likely to have good matches
  if (detected.confidence < 0.7) {
    return false;
  }

  // Categories with distinctive products work better for search
  const searchableCategories = [
    'headphones', 'earphones', 'headwear',
    'shoes', 'sneakers', 'boots', 'footwear',
    'bags', 'handbags', 'backpacks',
    'watches', 'jewelry',
    'sunglasses', 'glasses',
    // Home categories
    'furniture', 'lighting', 'decor',
  ];

  const categoryLower = detected.category.toLowerCase();
  const isSearchableCategory = searchableCategories.some(c =>
    categoryLower.includes(c)
  );

  // If brand is known, search is more likely to succeed
  const hasKnownBrand = detected.brand &&
    detected.brand.toLowerCase() !== 'unknown' &&
    detected.brand.toLowerCase() !== 'my upload';

  return isSearchableCategory || hasKnownBrand;
}
