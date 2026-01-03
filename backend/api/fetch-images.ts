/**
 * Fetch Missing Product Images API
 * Searches Bing for product images and updates the database
 * Handles: null/empty URLs, local file paths, and invalid URLs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import https from 'https';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

interface Product {
  id: string;
  product_name: string;
  brand?: string;
  category?: string;
  image_url?: string;
}

/**
 * Check if a URL is a valid web URL (not a local file path)
 */
function isValidWebUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  // Reject local file paths (Windows or Unix style)
  if (url.startsWith('C:') || url.startsWith('D:') || url.startsWith('/Users/') || url.startsWith('/home/')) return false;
  // Reject file:// protocol
  if (url.startsWith('file://')) return false;
  // Must be http or https URL
  return url.startsWith('http://') || url.startsWith('https://');
}

interface FetchResult {
  success: boolean;
  total_missing: number;
  updated: number;
  failed: number;
  products: Array<{
    id: string;
    name: string;
    image_url?: string;
    error?: string;
  }>;
  duration_ms: number;
}

/**
 * Search for product images using multiple sources
 * Returns the first valid image URL found
 */
async function searchProductImage(productName: string, brand: string): Promise<string | null> {
  // Clean up product name - remove TEST_ prefix and underscores
  const cleanName = productName
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .trim();

  const cleanBrand = (brand || '')
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .trim();

  // Try multiple search strategies
  const searchQueries = [
    `${cleanName} ${cleanBrand} product`,
    `${cleanName} official product image`,
    `${cleanBrand} ${cleanName}`,
  ];

  for (const query of searchQueries) {
    const imageUrl = await searchBingImages(query);
    if (imageUrl && !isBlockedImage(imageUrl)) {
      return imageUrl;
    }
    // Small delay between attempts
    await new Promise(r => setTimeout(r, 300));
  }

  return null;
}

/**
 * Check if image URL is from a blocked/unreliable source
 */
function isBlockedImage(url: string): boolean {
  const blockedPatterns = [
    'gravatar.com',
    'avatar',
    'profile',
    'user-image',
    'placeholder',
    'no-image',
    'default',
    'blank',
    'spacer',
    'pixel.gif',
    '1x1',
    'facebook.com',
    'linkedin.com',
    'twitter.com',
  ];

  const lowerUrl = url.toLowerCase();
  return blockedPatterns.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Search Bing Images and extract multiple results to find the best one
 */
async function searchBingImages(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:photo-photo&form=IRFLTR&first=1`;

    https.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract ALL murl (media URL) matches from the page
        const murlRegex = /murl&quot;:&quot;(https?:\/\/[^&]+\.(?:jpg|jpeg|png|webp))/gi;
        const matches: string[] = [];
        let match;

        while ((match = murlRegex.exec(data)) !== null && matches.length < 10) {
          const url = decodeURIComponent(match[1].replace(/&amp;/g, '&'));
          if (!isBlockedImage(url)) {
            matches.push(url);
          }
        }

        // Return the first non-blocked image
        if (matches.length > 0) {
          resolve(matches[0]);
          return;
        }

        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Delay helper for rate limiting
 */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Reset duplicate images - clears images that appear more than once (likely bad scrape results)
  if (req.query.action === 'reset-duplicates') {
    try {
      const { data: allProducts } = await supabase
        .from('enriched_products')
        .select('id, image_url');

      if (!allProducts) {
        return res.status(200).json({ reset: 0, message: 'No products found' });
      }

      // Count occurrences of each image URL
      const urlCounts = new Map<string, number>();
      for (const p of allProducts) {
        if (p.image_url && isValidWebUrl(p.image_url)) {
          urlCounts.set(p.image_url, (urlCounts.get(p.image_url) || 0) + 1);
        }
      }

      // Find products with duplicate images (same image used more than twice)
      const productsToReset = allProducts.filter(p =>
        p.image_url && (urlCounts.get(p.image_url) || 0) > 2
      );

      if (productsToReset.length === 0) {
        return res.status(200).json({ reset: 0, message: 'No duplicate images found' });
      }

      // Reset their image URLs to null
      const ids = productsToReset.map(p => p.id);
      const { error } = await supabase
        .from('enriched_products')
        .update({ image_url: null, image_urls: null })
        .in('id', ids);

      if (error) {
        throw new Error(error.message);
      }

      return res.status(200).json({
        reset: productsToReset.length,
        message: `Reset ${productsToReset.length} products with duplicate images`,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset duplicates',
      });
    }
  }

  // If stats=true, return product statistics only
  if (req.query.stats === 'true') {
    try {
      // Get all products to check image URLs properly
      const { data: allProducts, count: totalCount } = await supabase
        .from('enriched_products')
        .select('image_url', { count: 'exact' });

      const total = totalCount || 0;

      // Count products with valid web URLs (not local file paths)
      const withValidImages = (allProducts || []).filter(p => isValidWebUrl(p.image_url)).length;
      const missingOrInvalid = total - withValidImages;

      return res.status(200).json({
        stats: {
          total,
          with_images: withValidImages,
          missing_images: missingOrInvalid,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
      });
    }
  }

  const limit = parseInt(req.query.limit as string || req.body?.limit || '20', 10);
  const dryRun = req.query.dry_run === 'true' || req.body?.dry_run === true;

  const startTime = Date.now();
  const result: FetchResult = {
    success: false,
    total_missing: 0,
    updated: 0,
    failed: 0,
    products: [],
    duration_ms: 0,
  };

  try {
    // Fetch all products to filter those needing images
    // We need to check for: null, empty string, or local file paths
    const { data: allProducts, error: fetchError } = await supabase
      .from('enriched_products')
      .select('id, product_name, brand, category, image_url');

    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    // Filter products that need images (null, empty, or local file paths)
    const productsNeedingImages = (allProducts || [])
      .filter(p => !isValidWebUrl(p.image_url))
      .slice(0, limit);

    if (productsNeedingImages.length === 0) {
      result.success = true;
      result.duration_ms = Date.now() - startTime;
      return res.status(200).json({
        ...result,
        message: 'All products already have valid web images',
      });
    }

    const products = productsNeedingImages;
    result.total_missing = products.length;

    // Process each product
    for (const product of products as Product[]) {
      try {
        const imageUrl = await searchProductImage(product.product_name, product.brand || '');

        if (imageUrl) {
          if (!dryRun) {
            // Update database - both image_url and image_urls object
            const { error: updateError } = await supabase
              .from('enriched_products')
              .update({
                image_url: imageUrl,
                image_urls: {
                  original: imageUrl,
                  large: imageUrl,
                  preview: imageUrl,
                  thumb: imageUrl,
                },
              })
              .eq('id', product.id);

            if (updateError) {
              throw new Error(updateError.message);
            }
          }

          result.updated++;
          result.products.push({
            id: product.id,
            name: product.product_name,
            image_url: imageUrl,
          });
        } else {
          result.failed++;
          result.products.push({
            id: product.id,
            name: product.product_name,
            error: 'No image found',
          });
        }
      } catch (err) {
        result.failed++;
        result.products.push({
          id: product.id,
          name: product.product_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Rate limiting - wait 500ms between requests
      await delay(500);
    }

    result.success = result.updated > 0 || result.total_missing === 0;
    result.duration_ms = Date.now() - startTime;

    return res.status(200).json(result);

  } catch (error) {
    result.duration_ms = Date.now() - startTime;
    return res.status(500).json({
      ...result,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
