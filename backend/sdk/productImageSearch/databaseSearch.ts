/**
 * Database Search for Product Images
 *
 * Searches the enriched_products table for similar products based on
 * name, brand, and category. Uses fuzzy matching to find the best
 * reference image for a detected product.
 */

import { getSupabase } from '../shared/supabase';
import { createLogger } from '../shared/logger';
import type {
  DetectedProductInfo,
  DatabaseSearchOptions,
  DatabaseProductMatch,
} from './types';

const logger = createLogger('product-image-search:database');

/**
 * Calculate text similarity using Levenshtein-based approach
 * Returns a score between 0 (no match) and 1 (exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length < s2.length ? s2 : s1;
    return shorter.length / longer.length;
  }

  // Word overlap similarity
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate overall match score between detected product and database product
 */
function calculateMatchScore(
  detected: DetectedProductInfo,
  dbProduct: {
    product_name: string;
    brand: string;
    category: string;
    tags: string[];
  }
): number {
  // Weight factors for different attributes
  const weights = {
    name: 0.4,
    brand: 0.25,
    category: 0.2,
    tags: 0.15,
  };

  // Name similarity
  const nameSim = calculateSimilarity(detected.name, dbProduct.product_name);

  // Brand similarity (exact match weighted higher)
  let brandSim = 0;
  if (detected.brand && dbProduct.brand) {
    const detBrand = detected.brand.toLowerCase();
    const dbBrand = dbProduct.brand.toLowerCase();
    if (detBrand === dbBrand || detBrand.includes(dbBrand) || dbBrand.includes(detBrand)) {
      brandSim = 1;
    } else {
      brandSim = calculateSimilarity(detected.brand, dbProduct.brand);
    }
  }

  // Category similarity
  const catSim = calculateSimilarity(detected.category, dbProduct.category);

  // Tag overlap similarity
  let tagSim = 0;
  if (detected.tags.length > 0 && dbProduct.tags.length > 0) {
    const detTags = new Set(detected.tags.map(t => t.toLowerCase()));
    const dbTags = new Set(dbProduct.tags.map(t => t.toLowerCase()));
    const intersection = new Set([...detTags].filter(t => dbTags.has(t)));
    tagSim = intersection.size / Math.max(detTags.size, dbTags.size);
  }

  // Weighted score
  const score =
    weights.name * nameSim +
    weights.brand * brandSim +
    weights.category * catSim +
    weights.tags * tagSim;

  return Math.min(1, Math.max(0, score));
}

/**
 * Search the database for similar products
 */
export async function searchDatabaseForProduct(
  detected: DetectedProductInfo,
  options: DatabaseSearchOptions = {}
): Promise<DatabaseProductMatch[]> {
  const {
    minSimilarity = 0.5,
    limit = 5,
    category,
    brand,
  } = options;

  const startTime = Date.now();

  try {
    const supabase = getSupabase();

    // Build query - get products with images
    let query = supabase
      .from('enriched_products')
      .select('id, product_name, brand, image_url, category, tags')
      .not('image_url', 'is', null)
      .limit(100); // Fetch more to filter client-side

    // Filter by category if specified or detected
    const searchCategory = category || detected.category;
    if (searchCategory) {
      query = query.ilike('category', `%${searchCategory}%`);
    }

    // Filter by brand if specified or detected
    const searchBrand = brand || detected.brand;
    if (searchBrand) {
      query = query.ilike('brand', `%${searchBrand}%`);
    }

    const { data: products, error } = await query;

    if (error) {
      logger.error({ error }, 'Database search failed');
      return [];
    }

    if (!products || products.length === 0) {
      logger.debug({ detected: detected.name, category: searchCategory, brand: searchBrand }, 'No products found in database');
      return [];
    }

    // Calculate similarity scores for each product
    const scoredProducts: DatabaseProductMatch[] = products
      .map(product => ({
        id: product.id,
        product_name: product.product_name,
        brand: product.brand || 'Unknown',
        image_url: product.image_url,
        category: product.category || '',
        tags: product.tags || [],
        similarity: calculateMatchScore(detected, {
          product_name: product.product_name,
          brand: product.brand || '',
          category: product.category || '',
          tags: product.tags || [],
        }),
      }))
      .filter(p => p.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    const searchTime = Date.now() - startTime;

    logger.info({
      detectedName: detected.name,
      totalProducts: products.length,
      matchingProducts: scoredProducts.length,
      topMatch: scoredProducts[0]?.product_name,
      topScore: scoredProducts[0]?.similarity,
      searchTimeMs: searchTime,
    }, 'Database search completed');

    return scoredProducts;

  } catch (error) {
    logger.error({ error }, 'Database search error');
    return [];
  }
}

/**
 * Find the best matching product image from the database
 * Returns null if no suitable match is found
 */
export async function findBestDatabaseMatch(
  detected: DetectedProductInfo,
  minSimilarity: number = 0.6
): Promise<DatabaseProductMatch | null> {
  const matches = await searchDatabaseForProduct(detected, {
    minSimilarity,
    limit: 1,
  });

  return matches.length > 0 ? matches[0] : null;
}
