/**
 * Brand Inference Module
 * Infers brand/sub-brand from product name and source URL
 *
 * Extracted from backend/api/ai.ts (lines 255-412)
 */

import { createModuleLogger } from '../../shared/logger';

const log = createModuleLogger('brandInference');

// Multi-brand houses with sub-brands - extract sub-brand from URL path
// Format: { domain: { pathPattern: 'Brand Name', ... } }
const MULTI_BRAND_HOUSES: Record<string, Record<string, string>> = {
  'armani.com': {
    'giorgio-armani': 'Giorgio Armani',
    'emporio-armani': 'Emporio Armani',
    'armani-exchange': 'Armani Exchange',
    'ea7': 'EA7 Emporio Armani',
    'armani-casa': 'Armani/Casa',
    'armani-fiori': 'Armani/Fiori',
    'armani-beauty': 'Armani Beauty',
    'armani-prive': 'Armani Privé',
    'armani-ristorante': 'Armani/Ristorante',
    'armani-hotel': 'Armani Hotel',
    'armani-silos': 'Armani/Silos',
  },
  'lvmh.com': {
    'louis-vuitton': 'Louis Vuitton',
    'dior': 'Dior',
    'fendi': 'Fendi',
    'givenchy': 'Givenchy',
    'celine': 'Celine',
    'loewe': 'Loewe',
    'kenzo': 'Kenzo',
    'marc-jacobs': 'Marc Jacobs',
  },
  'kering.com': {
    'gucci': 'Gucci',
    'saint-laurent': 'Saint Laurent',
    'bottega-veneta': 'Bottega Veneta',
    'balenciaga': 'Balenciaga',
    'alexander-mcqueen': 'Alexander McQueen',
  },
};

// Simple brand mappings (single brand per domain)
const SIMPLE_BRAND_PATTERNS: Record<string, string> = {
  'gucci.com': 'Gucci',
  'prada.com': 'Prada',
  'louisvuitton.com': 'Louis Vuitton',
  'hermes.com': 'Hermès',
  'chanel.com': 'Chanel',
  'dior.com': 'Dior',
  'burberry.com': 'Burberry',
  'versace.com': 'Versace',
  'balenciaga.com': 'Balenciaga',
  'fendi.com': 'Fendi',
  'zara.com': 'Zara',
  'hm.com': 'H&M',
  'uniqlo.com': 'Uniqlo',
  'nike.com': 'Nike',
  'adidas.com': 'Adidas',
  'amazon.com': '', // Don't use marketplace as brand
  'amazon.in': '',
  'flipkart.com': '',
  'etsy.com': '',
};

/**
 * Infers brand name from product name and source URL
 * Handles multi-brand houses (e.g., Armani sub-brands) and marketplace filtering
 */
export function inferBrand(productName: string, sourceUrl?: string): string {
  let inferredBrand = '';

  // Extract brand from URL
  if (sourceUrl) {
    try {
      const urlObj = new URL(sourceUrl);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathname = urlObj.pathname.toLowerCase();

      // Check multi-brand houses first - extract sub-brand from URL path
      for (const [domain, subBrands] of Object.entries(MULTI_BRAND_HOUSES)) {
        if (hostname.includes(domain)) {
          // Look for sub-brand in URL path
          for (const [pathKey, brandName] of Object.entries(subBrands)) {
            if (pathname.includes(pathKey) || pathname.includes(`/${pathKey}/`)) {
              inferredBrand = brandName;
              log.info({ hostname, pathname, inferredBrand }, 'Extracted sub-brand from multi-brand house');
              break;
            }
          }
          break;
        }
      }

      // If no sub-brand found, check simple brand patterns
      if (!inferredBrand) {
        for (const [pattern, brandName] of Object.entries(SIMPLE_BRAND_PATTERNS)) {
          if (hostname.includes(pattern.replace('www.', ''))) {
            if (brandName) inferredBrand = brandName;
            break;
          }
        }
      }

      // For armani.com specifically, also check URL path segments
      if (hostname.includes('armani.com') && !inferredBrand) {
        const pathSegments = pathname.split('/').filter(s => s.length > 0);
        // Look for brand indicator in path (e.g., /en-wx/giorgio-armani/product)
        for (const segment of pathSegments) {
          const normalizedSegment = segment.toLowerCase();
          if (normalizedSegment.includes('giorgio')) {
            inferredBrand = 'Giorgio Armani';
            break;
          } else if (normalizedSegment.includes('emporio')) {
            inferredBrand = 'Emporio Armani';
            break;
          } else if (normalizedSegment.includes('exchange') || normalizedSegment === 'ax') {
            inferredBrand = 'Armani Exchange';
            break;
          } else if (normalizedSegment.includes('casa')) {
            inferredBrand = 'Armani/Casa';
            break;
          } else if (normalizedSegment.includes('fiori')) {
            inferredBrand = 'Armani/Fiori';
            break;
          } else if (normalizedSegment.includes('beauty')) {
            inferredBrand = 'Armani Beauty';
            break;
          } else if (normalizedSegment === 'ea7') {
            inferredBrand = 'EA7 Emporio Armani';
            break;
          }
        }
      }
    } catch (e) {
      // Invalid URL, ignore
    }
  }

  // Check if brand/sub-brand in product name (e.g., "Single-breasted jacket | Giorgio Armani")
  const nameParts = productName.split('|').map(s => s.trim());
  if (nameParts.length > 1) {
    const possibleBrand = nameParts[nameParts.length - 1];
    // Prefer sub-brand from title if it's more specific
    if (possibleBrand && possibleBrand.length < 50 && possibleBrand.length > 2) {
      // Only override if we don't have a sub-brand yet, or title has more specific info
      if (!inferredBrand ||
          (possibleBrand.toLowerCase().includes('armani') && inferredBrand === 'Armani') ||
          possibleBrand.split(' ').length > inferredBrand.split(' ').length) {
        inferredBrand = possibleBrand;
      }
    }
  }

  // Clean up generic/invalid brand names
  if (inferredBrand && (
    inferredBrand.toLowerCase().includes('production') ||
    inferredBrand.toLowerCase().includes('website') ||
    inferredBrand.toLowerCase().includes('shop') ||
    inferredBrand.toLowerCase() === 'armani' || // Too generic, need sub-brand
    inferredBrand.length < 2
  )) {
    // For armani.com without sub-brand, default to Giorgio Armani (main line)
    if (sourceUrl && sourceUrl.includes('armani.com') && inferredBrand.toLowerCase() === 'armani') {
      inferredBrand = 'Giorgio Armani';
    } else if (inferredBrand.toLowerCase().includes('production')) {
      inferredBrand = '';
    }
  }

  return inferredBrand;
}
