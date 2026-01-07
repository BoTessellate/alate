/**
 * Product Image Search SDK Types
 *
 * This SDK finds reference product images to replace incorrectly cropped
 * user uploads. Instead of fixing bounding box issues, we substitute
 * with clean product images from our database or web search.
 */

/**
 * Product detection result from Vision AI
 */
export interface DetectedProductInfo {
  /** AI-detected product name (e.g., "Bose QuietComfort 45 Headphones") */
  name: string;
  /** Detected or inferred brand */
  brand?: string;
  /** Product category */
  category: string;
  /** Style tags from AI */
  tags: string[];
  /** Detected colors */
  colors: string[];
  /** Detection confidence (0-1) */
  confidence: number;
}

/**
 * Result from product image search
 */
export interface ProductImageSearchResult {
  /** Whether a suitable image was found */
  found: boolean;
  /** URL of the reference product image */
  imageUrl?: string;
  /** Where the image came from */
  source: 'database' | 'web_search' | 'user_crop';
  /** Similarity/match score (0-1) */
  matchScore?: number;
  /** Product ID if matched from database */
  matchedProductId?: string;
  /** Product name from the matched source */
  matchedProductName?: string;
  /** Search query used (for debugging/logging) */
  searchQuery?: string;
  /** Processing time in ms */
  searchTimeMs: number;
}

/**
 * Database search options
 */
export interface DatabaseSearchOptions {
  /** Minimum similarity score to consider a match (0-1) */
  minSimilarity?: number;
  /** Maximum results to return */
  limit?: number;
  /** Filter by category */
  category?: string;
  /** Filter by brand */
  brand?: string;
}

/**
 * Web search options
 */
export interface WebSearchOptions {
  /** Maximum results to fetch */
  maxResults?: number;
  /** Preferred image size */
  imageSize?: 'small' | 'medium' | 'large';
  /** Filter by image type */
  imageType?: 'photo' | 'clipart' | 'lineart';
  /** Safe search level */
  safeSearch?: 'off' | 'moderate' | 'strict';
}

/**
 * Configuration for the product image search service
 */
export interface ProductImageSearchConfig {
  /** Whether to enable database search */
  enableDatabaseSearch?: boolean;
  /** Whether to enable web search as fallback */
  enableWebSearch?: boolean;
  /** Minimum similarity score for database matches */
  databaseMinSimilarity?: number;
  /** API key for Google Custom Search (optional, uses env if not provided) */
  googleApiKey?: string;
  /** Google Custom Search Engine ID */
  googleSearchEngineId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<ProductImageSearchConfig> = {
  enableDatabaseSearch: true,
  enableWebSearch: true,
  databaseMinSimilarity: 0.7,
  googleApiKey: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '',
  googleSearchEngineId: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '',
};

/**
 * Database product match result
 */
export interface DatabaseProductMatch {
  id: string;
  product_name: string;
  brand: string;
  image_url: string;
  category: string;
  tags: string[];
  similarity: number;
}

/**
 * Web search result item
 */
export interface WebSearchResultItem {
  title: string;
  link: string;
  thumbnailLink?: string;
  displayLink: string;
  snippet?: string;
  mime?: string;
  width?: number;
  height?: number;
}
