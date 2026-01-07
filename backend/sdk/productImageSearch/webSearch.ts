/**
 * Web Image Search for Product Images
 *
 * Uses Google Custom Search API to find product images on the web.
 * This is a fallback when the product isn't found in our database.
 */

import { createModuleLogger } from '../shared/logger';
import type {
  DetectedProductInfo,
  WebSearchOptions,
  WebSearchResultItem,
} from './types';

const logger = createModuleLogger('product-image-search:web');

// Google Custom Search API endpoint
const GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1';

/**
 * Build search query from detected product info
 * Creates an optimized query for finding product images
 */
function buildSearchQuery(detected: DetectedProductInfo): string {
  const parts: string[] = [];

  // Add brand if available (most specific identifier)
  if (detected.brand && detected.brand.toLowerCase() !== 'unknown') {
    parts.push(detected.brand);
  }

  // Add product name
  parts.push(detected.name);

  // Add category for context if not already in name
  const nameLower = detected.name.toLowerCase();
  const categoryLower = detected.category.toLowerCase();
  if (!nameLower.includes(categoryLower)) {
    parts.push(detected.category);
  }

  // Join and add "product" to improve results
  const query = parts.join(' ') + ' product';

  return query;
}

/**
 * Search Google Images for product
 */
export async function searchWebForProductImage(
  detected: DetectedProductInfo,
  options: WebSearchOptions = {}
): Promise<WebSearchResultItem[]> {
  const {
    maxResults = 3,
    imageSize = 'large',
    imageType = 'photo',
    safeSearch = 'moderate',
  } = options;

  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    logger.warn('Google Custom Search API not configured. Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID');
    return [];
  }

  const startTime = Date.now();
  const query = buildSearchQuery(detected);

  try {
    // Build API URL with parameters
    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: query,
      searchType: 'image',
      num: String(Math.min(maxResults, 10)), // API max is 10
      imgSize: imageSize,
      imgType: imageType,
      safe: safeSearch,
      // Filter for product-related images
      rights: 'cc_publicdomain,cc_attribute,cc_sharealike',
    });

    const url = `${GOOGLE_SEARCH_API}?${params.toString()}`;

    logger.debug({ query, url: url.replace(apiKey, 'REDACTED') }, 'Searching Google Images');

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({
        status: response.status,
        error: errorText,
        query,
      }, 'Google Custom Search API error');
      return [];
    }

    const data = await response.json();
    const searchTime = Date.now() - startTime;

    // Parse results
    const items: WebSearchResultItem[] = (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      thumbnailLink: item.image?.thumbnailLink,
      displayLink: item.displayLink,
      snippet: item.snippet,
      mime: item.mime,
      width: item.image?.width,
      height: item.image?.height,
    }));

    logger.info({
      query,
      resultsCount: items.length,
      totalResults: data.searchInformation?.totalResults,
      searchTimeMs: searchTime,
    }, 'Web search completed');

    return items;

  } catch (error) {
    logger.error({ error, query }, 'Web search failed');
    return [];
  }
}

/**
 * Find the best product image from web search
 * Returns the most suitable image URL or null if none found
 */
export async function findBestWebImage(
  detected: DetectedProductInfo
): Promise<{ imageUrl: string; source: string } | null> {
  const results = await searchWebForProductImage(detected, {
    maxResults: 5,
    imageSize: 'large',
    imageType: 'photo',
  });

  if (results.length === 0) {
    return null;
  }

  // Filter for high-quality images
  const goodResults = results.filter(r => {
    // Prefer larger images
    if (r.width && r.height && (r.width < 200 || r.height < 200)) {
      return false;
    }
    // Skip if it looks like a placeholder
    if (r.title?.toLowerCase().includes('placeholder')) {
      return false;
    }
    // Skip if link contains common spam indicators
    const badPatterns = ['spam', 'ad', 'tracking', 'pixel'];
    if (badPatterns.some(p => r.link.toLowerCase().includes(p))) {
      return false;
    }
    return true;
  });

  const best = goodResults[0] || results[0];

  return {
    imageUrl: best.link,
    source: best.displayLink,
  };
}

/**
 * Alternative: Use SerpApi for more reliable results (if configured)
 * SerpApi provides cleaner results but costs money per search
 */
export async function searchSerpApiForProductImage(
  detected: DetectedProductInfo
): Promise<WebSearchResultItem[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    logger.debug('SerpApi not configured, skipping');
    return [];
  }

  const query = buildSearchQuery(detected);
  const startTime = Date.now();

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: 'google_images',
      q: query,
      ijn: '0', // First page
      safe: 'active',
    });

    const url = `https://serpapi.com/search?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      logger.error({ status: response.status }, 'SerpApi error');
      return [];
    }

    const data = await response.json();
    const searchTime = Date.now() - startTime;

    const items: WebSearchResultItem[] = (data.images_results || [])
      .slice(0, 5)
      .map((item: any) => ({
        title: item.title,
        link: item.original,
        thumbnailLink: item.thumbnail,
        displayLink: item.source,
        width: item.original_width,
        height: item.original_height,
      }));

    logger.info({
      query,
      resultsCount: items.length,
      searchTimeMs: searchTime,
    }, 'SerpApi search completed');

    return items;

  } catch (error) {
    logger.error({ error }, 'SerpApi search failed');
    return [];
  }
}
