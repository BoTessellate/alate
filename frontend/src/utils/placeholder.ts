/**
 * Placeholder Image Utility
 * Generates placeholder images for products without image_url
 */

// Color palette for placeholders (muted, aesthetic colors)
const PLACEHOLDER_COLORS = [
  '#E8DFD5', // Warm beige
  '#D4C4B5', // Soft tan
  '#C9D6DF', // Light blue-gray
  '#D5E1DD', // Sage green
  '#E5D5D5', // Dusty rose
  '#DDD8C4', // Sand
  '#C4CCD4', // Steel blue
  '#D8CFC4', // Taupe
];

/**
 * Generate a consistent color based on product name/id
 * This ensures the same product always gets the same color
 */
function getColorForProduct(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

/**
 * Generate a data URL for an SVG placeholder image
 * @param productName - Product name for display
 * @param width - Image width
 * @param height - Image height
 */
export function generatePlaceholderSVG(
  productName: string,
  width: number = 200,
  height: number = 200
): string {
  const bgColor = getColorForProduct(productName);
  const textColor = '#666666';

  // Get initials or first characters of product name
  const words = productName.replace(/^TEST_/i, '').replace(/_/g, ' ').split(' ');
  const initials = words
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${Math.min(width, height) * 0.25}px"
        font-weight="500"
        fill="${textColor}"
      >${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Get a placeholder image URL using an external service
 * Uses placehold.co for reliable placeholder images
 */
export function getPlaceholderURL(
  width: number = 200,
  height: number = 200,
  text?: string
): string {
  // Using placehold.co - a reliable placeholder service
  const bgColor = 'E8DFD5';
  const textColor = '666666';
  const displayText = text || 'No Image';

  return `https://placehold.co/${width}x${height}/${bgColor}/${textColor}?text=${encodeURIComponent(displayText)}`;
}

/**
 * Get a product image URL with fallback to placeholder
 * @param imageUrl - The product's image URL (may be null/undefined)
 * @param productName - Product name for placeholder
 * @param size - Desired image size
 */
export function getProductImage(
  imageUrl: string | null | undefined,
  productName: string,
  size: { width: number; height: number } = { width: 200, height: 200 }
): string {
  if (imageUrl && imageUrl.trim()) {
    return imageUrl;
  }

  // Use SVG placeholder for better performance (no network request)
  return generatePlaceholderSVG(productName, size.width, size.height);
}

/**
 * Sample product images for testing purposes
 * Uses curated Unsplash images that match home decor/lifestyle aesthetic
 */
export const SAMPLE_PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop', // Sofa
  'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=400&fit=crop', // Chair
  'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&h=400&fit=crop', // Living room
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=400&fit=crop', // Decor
  'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400&h=400&fit=crop', // Couch
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop', // Interior
  'https://images.unsplash.com/photo-1618220179428-22790b461013?w=400&h=400&fit=crop', // Furniture
  'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=400&fit=crop', // Lamp
  'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=400&h=400&fit=crop', // Cushion
  'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=400&h=400&fit=crop', // Vase
];

/**
 * Get a random sample image (for testing)
 */
export function getRandomSampleImage(): string {
  return SAMPLE_PRODUCT_IMAGES[Math.floor(Math.random() * SAMPLE_PRODUCT_IMAGES.length)];
}

/**
 * Get a deterministic sample image based on product ID (for consistent testing)
 */
export function getSampleImageForProduct(productId: string): string {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    const char = productId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return SAMPLE_PRODUCT_IMAGES[Math.abs(hash) % SAMPLE_PRODUCT_IMAGES.length];
}

/**
 * Brand URL mappings - maps brand names to their website search patterns
 * Format: { brandPattern: { domain, searchPath } }
 */
const BRAND_URL_MAPPINGS: Record<string, { domain: string; searchPath: string }> = {
  // Major furniture retailers
  'west elm': { domain: 'westelm.com', searchPath: '/search/results.html?words=' },
  'westelm': { domain: 'westelm.com', searchPath: '/search/results.html?words=' },
  'cb2': { domain: 'cb2.com', searchPath: '/search?query=' },
  'crate and barrel': { domain: 'crateandbarrel.com', searchPath: '/search?query=' },
  'crate & barrel': { domain: 'crateandbarrel.com', searchPath: '/search?query=' },
  'pottery barn': { domain: 'potterybarn.com', searchPath: '/search/results.html?words=' },
  'potterybarn': { domain: 'potterybarn.com', searchPath: '/search/results.html?words=' },
  'restoration hardware': { domain: 'rh.com', searchPath: '/search/results.jsp?Ntt=' },
  'rh': { domain: 'rh.com', searchPath: '/search/results.jsp?Ntt=' },
  'ikea': { domain: 'ikea.com', searchPath: '/us/en/search/?q=' },
  'wayfair': { domain: 'wayfair.com', searchPath: '/keyword.html?keyword=' },
  'article': { domain: 'article.com', searchPath: '/search?query=' },
  'joybird': { domain: 'joybird.com', searchPath: '/search?q=' },
  'anthropologie': { domain: 'anthropologie.com', searchPath: '/search/?q=' },
  'urban outfitters': { domain: 'urbanoutfitters.com', searchPath: '/search?q=' },
  'target': { domain: 'target.com', searchPath: '/s?searchTerm=' },
  'amazon': { domain: 'amazon.com', searchPath: '/s?k=' },
  'etsy': { domain: 'etsy.com', searchPath: '/search?q=' },
  'overstock': { domain: 'overstock.com', searchPath: '/Home-Garden/?query=' },
  'allmodern': { domain: 'allmodern.com', searchPath: '/keyword.html?keyword=' },
  'world market': { domain: 'worldmarket.com', searchPath: '/search?q=' },
  'cost plus world market': { domain: 'worldmarket.com', searchPath: '/search?q=' },
  'homesense': { domain: 'homesense.com', searchPath: '/search?q=' },
  'homegoods': { domain: 'homegoods.com', searchPath: '/search?q=' },
  'tj maxx': { domain: 'tjmaxx.com', searchPath: '/search?q=' },
  'marshalls': { domain: 'marshalls.com', searchPath: '/search?q=' },
  'z gallerie': { domain: 'zgallerie.com', searchPath: '/search?q=' },
  'arhaus': { domain: 'arhaus.com', searchPath: '/search?q=' },
  'room and board': { domain: 'roomandboard.com', searchPath: '/search?query=' },
  'room & board': { domain: 'roomandboard.com', searchPath: '/search?query=' },
  'design within reach': { domain: 'dwr.com', searchPath: '/search/?q=' },
  'dwr': { domain: 'dwr.com', searchPath: '/search/?q=' },
  'blu dot': { domain: 'bludot.com', searchPath: '/search?q=' },
  'hay': { domain: 'hay.com', searchPath: '/search?q=' },
  'muuto': { domain: 'muuto.com', searchPath: '/search?q=' },
  'knoll': { domain: 'knoll.com', searchPath: '/search?q=' },
  'herman miller': { domain: 'hermanmiller.com', searchPath: '/search?q=' },
  'kartell': { domain: 'kartell.com', searchPath: '/search?q=' },
  'ferm living': { domain: 'fermliving.com', searchPath: '/search?q=' },
  'normann copenhagen': { domain: 'normann-copenhagen.com', searchPath: '/search?q=' },
  'menu': { domain: 'menudesignshop.com', searchPath: '/search?q=' },
  'h&m home': { domain: 'hm.com', searchPath: '/en_us/search-results.html?q=' },
  'h&m': { domain: 'hm.com', searchPath: '/en_us/search-results.html?q=' },
  'zara home': { domain: 'zarahome.com', searchPath: '/search?term=' },
  'made': { domain: 'made.com', searchPath: '/search?q=' },
  'habitat': { domain: 'habitat.co.uk', searchPath: '/search?searchTerm=' },
};

/**
 * Normalize brand name for matching
 */
function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s&]/g, '')
    .trim();
}

/**
 * Normalize product name for URL
 */
function normalizeProductName(productName: string): string {
  return productName
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();
}

/**
 * Generate a product URL based on brand and product name
 * Tries to match known brands first, falls back to Google search
 *
 * @param brand - Product brand name
 * @param productName - Product name
 * @returns URL string to find/purchase the product
 */
export function getProductUrl(brand: string, productName: string): string {
  const normalizedBrand = normalizeBrand(brand);
  const normalizedProduct = normalizeProductName(productName);

  // Check for known brand mapping
  for (const [brandKey, config] of Object.entries(BRAND_URL_MAPPINGS)) {
    if (normalizedBrand.includes(brandKey) || brandKey.includes(normalizedBrand)) {
      const searchQuery = encodeURIComponent(normalizedProduct);
      return `https://www.${config.domain}${config.searchPath}${searchQuery}`;
    }
  }

  // Fallback to Google Shopping search
  const searchQuery = encodeURIComponent(`${normalizedBrand} ${normalizedProduct}`);
  return `https://www.google.com/search?tbm=shop&q=${searchQuery}`;
}

/**
 * Check if we have a direct brand URL mapping
 */
export function hasDirectBrandUrl(brand: string): boolean {
  const normalizedBrand = normalizeBrand(brand);
  return Object.keys(BRAND_URL_MAPPINGS).some(
    brandKey => normalizedBrand.includes(brandKey) || brandKey.includes(normalizedBrand)
  );
}
