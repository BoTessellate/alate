/**
 * Input Type Detector
 * Analyzes user input to determine if it's a URL, image attachment, or text search
 */

export interface InputAnalysis {
  type: 'url' | 'image' | 'text';
  isEcommerceUrl?: boolean;
  detectedDomain?: string;
  cleanUrl?: string;
  confidence: number;
}

// Common e-commerce domains
const ECOMMERCE_DOMAINS = [
  // Major retailers
  'amazon', 'ebay', 'walmart', 'target', 'costco', 'bestbuy',
  // Fashion
  'nordstrom', 'macys', 'bloomingdales', 'saks', 'neiman',
  'zara', 'hm', 'uniqlo', 'gap', 'oldnavy', 'bananarepublic',
  'jcrew', 'madewell', 'anthropologie', 'freepeople', 'urbanoutfitters',
  'asos', 'revolve', 'shopbop', 'net-a-porter', 'farfetch', 'ssense',
  'nike', 'adidas', 'puma', 'reebok', 'newbalance', 'asics',
  'lululemon', 'athleta', 'gymshark', 'alo', 'fabletics',
  // Home & furniture
  'wayfair', 'overstock', 'westelm', 'potterybarn', 'crateandbarrel',
  'cb2', 'ikea', 'article', 'allmodern', 'homedepot', 'lowes',
  // Luxury
  'gucci', 'prada', 'louisvuitton', 'chanel', 'dior', 'hermes',
  'burberry', 'versace', 'balenciaga', 'bottegaveneta', 'celine',
  // E-commerce platforms
  'shopify', 'etsy', 'depop', 'poshmark', 'mercari', 'grailed',
  // International
  'aliexpress', 'shein', 'aritzia', 'zalando', 'boozt',
];

// URL pattern - matches http(s) URLs
const URL_PATTERN = /^(https?:\/\/[^\s]+)/i;

// Stricter URL pattern for validation
const STRICT_URL_PATTERN = /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/[^\s]*)?$/i;

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Check if domain is a known e-commerce site
 */
function isEcommerceDomain(domain: string): boolean {
  const domainLower = domain.toLowerCase();
  return ECOMMERCE_DOMAINS.some((ecom) => domainLower.includes(ecom));
}

/**
 * Clean and normalize URL
 */
function cleanUrl(url: string): string {
  // Trim whitespace
  let cleaned = url.trim();

  // Ensure https if no protocol
  if (!cleaned.match(/^https?:\/\//i)) {
    cleaned = 'https://' + cleaned;
  }

  return cleaned;
}

/**
 * Analyze input to determine its type
 *
 * @param text - The text input from user
 * @param hasImage - Whether an image is attached
 * @returns InputAnalysis object with type and metadata
 */
export function analyzeInput(text: string, hasImage: boolean): InputAnalysis {
  // Priority 1: If image is attached, type is 'image'
  if (hasImage) {
    return {
      type: 'image',
      confidence: 1.0,
    };
  }

  const trimmedText = text.trim();

  // Priority 2: Check for URL pattern
  const urlMatch = trimmedText.match(URL_PATTERN);

  if (urlMatch) {
    const url = urlMatch[1];
    const cleaned = cleanUrl(url);
    const domain = extractDomain(cleaned);
    const isValidUrl = STRICT_URL_PATTERN.test(cleaned);
    const isEcommerce = isEcommerceDomain(domain);

    if (isValidUrl) {
      return {
        type: 'url',
        isEcommerceUrl: isEcommerce,
        detectedDomain: domain,
        cleanUrl: cleaned,
        confidence: isEcommerce ? 0.95 : 0.8,
      };
    }
  }

  // Priority 3: Default to text (AI search)
  return {
    type: 'text',
    confidence: 1.0,
  };
}

/**
 * Get a user-friendly description of the detected input
 */
export function getInputDescription(analysis: InputAnalysis): string {
  switch (analysis.type) {
    case 'image':
      return 'Image attached';
    case 'url':
      if (analysis.isEcommerceUrl) {
        return `Product from ${analysis.detectedDomain}`;
      }
      return `Link from ${analysis.detectedDomain || 'website'}`;
    case 'text':
      return 'Search query';
    default:
      return 'Input';
  }
}

/**
 * Check if text looks like it might be a URL (even partial)
 * Used for showing URL icon highlight in input
 */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  // Check for protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }

  // Check for common domain patterns
  if (trimmed.includes('.com') || trimmed.includes('.net') ||
      trimmed.includes('.org') || trimmed.includes('.io') ||
      trimmed.includes('.co')) {
    return true;
  }

  // Check for www prefix
  if (trimmed.startsWith('www.')) {
    return true;
  }

  return false;
}
