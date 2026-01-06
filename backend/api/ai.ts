/**
 * AI API - Consolidated Endpoint
 * Combines product enrichment, image generation, and layout AI functionality
 *
 * Routes:
 * POST /api/ai?action=enrich    - Enrich product with AI-generated metadata
 * POST /api/ai?action=compose   - AI moodboard composition
 * POST /api/ai?action=tryon     - Virtual try-on
 * GET  /api/ai?action=layouts   - List available layout types
 * POST /api/ai?action=layout    - Generate moodboard layout
 * POST /api/ai?action=labels    - AI-powered label placement
 *
 * This consolidation reduces serverless function count for Vercel Hobby plan limits.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import {
  callClaude,
  callClaudeWithVision,
  callGemini,
  callGeminiWithVision,
  callOpenAI,
  callOpenAIWithVision,
  parseJSONFromResponse
} from '../sdk/shared/secureAI';
import {
  createImageGenerator,
  MoodboardCompositionInput,
  VirtualTryOnInput,
  TryOnType,
} from '../sdk/imageGeneration';
import { createClient } from '@supabase/supabase-js';
import { extractAndNameColors } from '../sdk/productEnrichment/colorExtractor';

const log = createModuleLogger('ai');

// Demo mode flag - defaults to false (real AI processing)
// Set DEMO_MODE=true to return mock data without API calls
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Initialize Supabase for image storage (lazy)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

// Enrichment types
interface RawProduct {
  name: string;
  description?: string;
  brand?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  source_url?: string;
}

interface EnrichedProduct extends RawProduct {
  tags: string[];
  color_palette: string[];
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  vibe_layer?: string;
  pairs_with?: string[];
  enriched_at: string;
}

// Image AI types
interface ComposeRequest {
  productImages: Array<{ url?: string; base64?: string }>;
  style?: {
    aesthetic?: string;
    colorPalette?: string[];
    mood?: string;
    lighting?: 'natural' | 'studio' | 'warm' | 'cool' | 'dramatic';
  };
  arrangement?: 'balanced' | 'asymmetric' | 'collage' | 'grid' | 'organic';
  canvasSize?: '1024x1024' | '1536x1024' | '1024x1536';
  lookId?: string;
}

interface TryOnRequest {
  baseImage: { url?: string; base64?: string };
  productImages: Array<{ url?: string; base64?: string }>;
  type: TryOnType;
  preserveBackground?: boolean;
}

// Layout types
interface ProductPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  z_index: number;
}

interface ImagePosition {
  product_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabelStyle {
  font_size: number;
  color: string;
  placement_preference?: 'above' | 'below' | 'beside' | 'auto';
}

interface LabelPlacement {
  product_name: string;
  position: { x: number; y: number };
  justification: string;
}

type LayoutType = 'zigzag' | 'centerpiece' | 'grid' | 'asymmetric' | 'stacked' | 'diagonal' | 'cluster' | 'magazine';

// ============================================================================
// DEMO DATA FOR ENRICHMENT
// ============================================================================

const DEMO_ENRICHMENTS: Record<string, any> = {
  default: {
    tags: ['handcrafted', 'artisan', 'sustainable', 'boho'],
    color_palette: ['terracotta', 'cream', 'sage green', 'natural wood'],
    material: 'cotton',
    texture: 'woven',
    tone: 'earthy',
    category: 'home decor'
  },
  cushion: {
    tags: ['handwoven', 'traditional', 'boho', 'textured'],
    color_palette: ['indigo', 'cream', 'gold', 'rust'],
    material: 'cotton',
    texture: 'woven',
    tone: 'warm',
    category: 'textiles'
  },
  ceramic: {
    tags: ['handmade', 'artisan', 'minimalist', 'organic'],
    color_palette: ['terracotta', 'white', 'speckled cream'],
    material: 'ceramic',
    texture: 'matte',
    tone: 'earthy',
    category: 'home decor'
  },
  furniture: {
    tags: ['handcrafted', 'sustainable', 'modern', 'natural'],
    color_palette: ['walnut', 'oak', 'natural wood', 'brass'],
    material: 'wood',
    texture: 'smooth',
    tone: 'warm',
    category: 'furniture'
  }
};

function getDemoEnrichment(productName: string): any {
  const name = productName.toLowerCase();
  if (name.includes('cushion') || name.includes('pillow') || name.includes('textile')) {
    return DEMO_ENRICHMENTS.cushion;
  }
  if (name.includes('ceramic') || name.includes('pottery') || name.includes('vase')) {
    return DEMO_ENRICHMENTS.ceramic;
  }
  if (name.includes('chair') || name.includes('table') || name.includes('furniture') || name.includes('wood')) {
    return DEMO_ENRICHMENTS.furniture;
  }
  return DEMO_ENRICHMENTS.default;
}

// ============================================================================
// LAYOUT GENERATORS
// ============================================================================

function generateZigZagLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.35;
  const itemHeight = canvasHeight * 0.4;
  const padding = 20;

  products.forEach((product, i) => {
    const isLeft = i % 2 === 0;
    positions.push({
      id: product.id || `product-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: isLeft ? padding : canvasWidth - itemWidth - padding,
      y: padding + (i * (itemHeight * 0.6)),
      width: itemWidth,
      height: itemHeight,
      z_index: i
    });
  });

  return positions;
}

function generateCenterpieceLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  if (products.length === 0) return positions;

  const heroWidth = canvasWidth * 0.5;
  const heroHeight = canvasHeight * 0.5;
  positions.push({
    id: products[0].id || 'hero',
    name: products[0].name || 'Hero Product',
    x: (canvasWidth - heroWidth) / 2,
    y: (canvasHeight - heroHeight) / 2,
    width: heroWidth,
    height: heroHeight,
    z_index: products.length
  });

  const supportWidth = canvasWidth * 0.25;
  const supportHeight = canvasHeight * 0.25;
  const corners = [
    { x: 20, y: 20 },
    { x: canvasWidth - supportWidth - 20, y: 20 },
    { x: 20, y: canvasHeight - supportHeight - 20 },
    { x: canvasWidth - supportWidth - 20, y: canvasHeight - supportHeight - 20 }
  ];

  products.slice(1, 5).forEach((product, i) => {
    if (corners[i]) {
      positions.push({
        id: product.id || `support-${i}`,
        name: product.name || `Product ${i + 2}`,
        x: corners[i].x,
        y: corners[i].y,
        width: supportWidth,
        height: supportHeight,
        z_index: i
      });
    }
  });

  return positions;
}

function generateGridLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const cols = Math.ceil(Math.sqrt(products.length));
  const rows = Math.ceil(products.length / cols);
  const padding = 15;
  const itemWidth = (canvasWidth - padding * (cols + 1)) / cols;
  const itemHeight = (canvasHeight - padding * (rows + 1)) / rows;

  products.forEach((product, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      id: product.id || `grid-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: padding + col * (itemWidth + padding),
      y: padding + row * (itemHeight + padding),
      width: itemWidth,
      height: itemHeight,
      z_index: i
    });
  });

  return positions;
}

function generateAsymmetricLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const sizes = [
    { w: 0.45, h: 0.55 },
    { w: 0.35, h: 0.4 },
    { w: 0.3, h: 0.35 },
    { w: 0.4, h: 0.45 },
    { w: 0.25, h: 0.3 }
  ];

  let currentX = 20;
  let currentY = 20;
  let maxRowHeight = 0;

  products.forEach((product, i) => {
    const sizeIndex = i % sizes.length;
    const width = canvasWidth * sizes[sizeIndex].w;
    const height = canvasHeight * sizes[sizeIndex].h;

    if (currentX + width > canvasWidth - 20) {
      currentX = 20;
      currentY += maxRowHeight + 15;
      maxRowHeight = 0;
    }

    positions.push({
      id: product.id || `asym-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: currentX,
      y: currentY,
      width,
      height,
      z_index: i
    });

    currentX += width + 15;
    maxRowHeight = Math.max(maxRowHeight, height);
  });

  return positions;
}

function generateStackedLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.6;
  const itemHeight = canvasHeight * 0.4;
  const offsetX = 30;
  const offsetY = 50;

  products.forEach((product, i) => {
    positions.push({
      id: product.id || `stack-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: (canvasWidth - itemWidth) / 2 + (i * offsetX),
      y: 50 + (i * offsetY),
      width: itemWidth,
      height: itemHeight,
      z_index: products.length - i
    });
  });

  return positions;
}

function generateDiagonalLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.3;
  const itemHeight = canvasHeight * 0.35;

  products.forEach((product, i) => {
    const progress = i / Math.max(products.length - 1, 1);
    positions.push({
      id: product.id || `diag-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: 20 + progress * (canvasWidth - itemWidth - 40),
      y: 20 + progress * (canvasHeight - itemHeight - 40),
      width: itemWidth,
      height: itemHeight,
      rotation: -5 + (i * 2),
      z_index: i
    });
  });

  return positions;
}

function generateClusterLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.35;
  const itemSize = canvasWidth * 0.2;

  products.forEach((product, i) => {
    const angle = (i / products.length) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius - itemSize / 2;
    const y = centerY + Math.sin(angle) * radius - itemSize / 2;

    positions.push({
      id: product.id || `cluster-${i}`,
      name: product.name || `Product ${i + 1}`,
      x,
      y,
      width: itemSize,
      height: itemSize,
      z_index: i
    });
  });

  return positions;
}

function generateMagazineLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];

  if (products.length > 0) {
    positions.push({
      id: products[0].id || 'featured',
      name: products[0].name || 'Featured',
      x: 20,
      y: 20,
      width: canvasWidth * 0.6,
      height: canvasHeight * 0.65,
      z_index: 0
    });
  }

  const sidebarWidth = canvasWidth * 0.35;
  const sidebarHeight = canvasHeight * 0.3;
  const sidebarX = canvasWidth - sidebarWidth - 20;

  products.slice(1, 3).forEach((product, i) => {
    positions.push({
      id: product.id || `sidebar-${i}`,
      name: product.name || `Sidebar ${i + 1}`,
      x: sidebarX,
      y: 20 + i * (sidebarHeight + 15),
      width: sidebarWidth,
      height: sidebarHeight,
      z_index: i + 1
    });
  });

  const bottomWidth = canvasWidth * 0.28;
  const bottomHeight = canvasHeight * 0.25;
  products.slice(3, 6).forEach((product, i) => {
    positions.push({
      id: product.id || `bottom-${i}`,
      name: product.name || `Bottom ${i + 1}`,
      x: 20 + i * (bottomWidth + 15),
      y: canvasHeight - bottomHeight - 20,
      width: bottomWidth,
      height: bottomHeight,
      z_index: i + 3
    });
  });

  return positions;
}

const layoutGenerators: Record<LayoutType, typeof generateGridLayout> = {
  zigzag: generateZigZagLayout,
  centerpiece: generateCenterpieceLayout,
  grid: generateGridLayout,
  asymmetric: generateAsymmetricLayout,
  stacked: generateStackedLayout,
  diagonal: generateDiagonalLayout,
  cluster: generateClusterLayout,
  magazine: generateMagazineLayout
};

// ============================================================================
// HELPERS
// ============================================================================

async function uploadToStorage(
  base64Data: string,
  folder: string,
  fileName: string
): Promise<string | undefined> {
  if (!supabaseUrl || !supabaseKey) return undefined;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const path = `${folder}/${fileName}`;
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase.storage
      .from('moodboards')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('moodboards')
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch (err) {
    log.warn({ error: err }, 'Failed to upload to storage');
  }
  return undefined;
}

function buildVisionPrompt(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): string {
  return `You are a moodboard layout assistant. Given product image positions on a canvas, determine optimal label placement.

Canvas size: ${canvas_size.width}x${canvas_size.height}

Product images positioned at:
${image_positions.map((pos, i) =>
  `${i + 1}. "${pos.product_name}" at (${pos.x}, ${pos.y}), size ${pos.width}x${pos.height}`
).join('\n')}

Label style: ${label_style.font_size}px, color ${label_style.color}, preference: ${label_style.placement_preference || 'auto'}

Task: Determine optimal label placement for each product that:
1. Avoids UNSIGHTLY overlaps with images (artistic/intentional overlaps are OK if they enhance the design)
2. Maintains visual hierarchy and balance
3. Is easily readable with good contrast
4. Follows modern moodboard design best practices (labels can be positioned creatively)
5. Considers the overall aesthetic - some strategic overlaps can create visual interest

Note: Moodboards often have intentional, aesthetic overlaps. Avoid only those overlaps that would:
- Obscure important product details
- Make text unreadable
- Create visual confusion
- Break the design hierarchy

Return ONLY a JSON array in this exact format:
[
  {
    "product_name": "product name",
    "position": { "x": 100, "y": 200 },
    "justification": "brief reason"
  }
]`;
}

function generateRuleBasedLabels(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): LabelPlacement[] {
  return image_positions.map(pos => {
    let x = pos.x;
    let y = pos.y;
    let justification = '';

    const preference = label_style.placement_preference || 'auto';

    switch (preference) {
      case 'above':
        y = pos.y - label_style.font_size - 10;
        justification = 'Placed above image as requested';
        break;
      case 'below':
        y = pos.y + pos.height + 10;
        justification = 'Placed below image as requested';
        break;
      case 'beside':
        x = pos.x + pos.width + 10;
        y = pos.y + pos.height / 2;
        justification = 'Placed beside image as requested';
        break;
      default:
        if (pos.y + pos.height + label_style.font_size + 10 < canvas_size.height) {
          y = pos.y + pos.height + 10;
          justification = 'Auto-placed below image';
        } else if (pos.y - label_style.font_size - 10 > 0) {
          y = pos.y - label_style.font_size - 10;
          justification = 'Auto-placed above (no room below)';
        } else {
          y = pos.y + pos.height - label_style.font_size - 5;
          justification = 'Overlaid on image (constrained space)';
        }
    }

    x = Math.max(10, Math.min(x, canvas_size.width - 100));
    y = Math.max(10, Math.min(y, canvas_size.height - label_style.font_size - 5));

    return {
      product_name: pos.product_name,
      position: { x, y },
      justification
    };
  });
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleEnrich(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product } = req.body as { product: RawProduct };

  if (!product || !product.name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    // Extract brand from URL if not provided or if it's a generic site name
    let inferredBrand = product.brand || '';
    const sourceUrl = product.source_url || '';

    // Multi-brand houses with sub-brands - extract sub-brand from URL path
    // Format: { domain: { pathPattern: 'Brand Name', ... } }
    const multiBrandHouses: Record<string, Record<string, string>> = {
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
    const simpleBrandPatterns: Record<string, string> = {
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

    // Extract brand from URL
    if (sourceUrl) {
      try {
        const urlObj = new URL(sourceUrl);
        const hostname = urlObj.hostname.replace('www.', '');
        const pathname = urlObj.pathname.toLowerCase();

        // Check multi-brand houses first - extract sub-brand from URL path
        for (const [domain, subBrands] of Object.entries(multiBrandHouses)) {
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
          for (const [pattern, brandName] of Object.entries(simpleBrandPatterns)) {
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
    const nameParts = product.name.split('|').map(s => s.trim());
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
      if (sourceUrl.includes('armani.com') && inferredBrand.toLowerCase() === 'armani') {
        inferredBrand = 'Giorgio Armani';
      } else if (inferredBrand.toLowerCase().includes('production')) {
        inferredBrand = '';
      }
    }

    // Extract colors from image using pixel-level analysis (not AI)
    // This gives us accurate hex codes that we can map to fashion names
    let extractedColors: { hexCodes: string[]; colorNames: string[]; warmth: 'warm' | 'cool' | 'neutral' } | null = null;
    if (product.image_url) {
      log.info({ imageUrl: product.image_url }, 'Extracting colors from image using pixel analysis...');
      try {
        extractedColors = await extractAndNameColors(
          product.image_url,
          supabaseUrl,
          supabaseKey,
          5 // Extract top 5 dominant colors
        );
        if (extractedColors) {
          log.info({
            colorNames: extractedColors.colorNames,
            hexCodes: extractedColors.hexCodes,
            warmth: extractedColors.warmth
          }, 'Colors extracted from image');
        }
      } catch (colorError) {
        log.warn({ error: colorError }, 'Color extraction failed, will use AI fallback');
      }
    }

    // Demo mode - return realistic mock data without API calls
    if (DEMO_MODE) {
      log.info({ productName: product.name, brand: inferredBrand, demoMode: true }, 'Using demo enrichment data');
      const demoEnrichment = getDemoEnrichment(product.name);

      const enrichedProduct: EnrichedProduct = {
        ...product,
        brand: inferredBrand || product.brand,
        tags: demoEnrichment.tags,
        // Use extracted colors if available, otherwise use demo colors
        color_palette: extractedColors?.colorNames || demoEnrichment.color_palette,
        material: demoEnrichment.material,
        texture: demoEnrichment.texture,
        tone: extractedColors?.warmth || demoEnrichment.tone,
        category: demoEnrichment.category,
        enriched_at: new Date().toISOString()
      };

      // Save to database
      await saveEnrichedProduct(enrichedProduct);

      return res.status(200).json({
        success: true,
        product: enrichedProduct,
        model_used: 'demo-mode',
        color_extraction: extractedColors ? 'pixel-accurate' : 'demo-fallback',
        _demo: true,
        _note: 'Demo mode active. Set DEMO_MODE=false and add API credits for real AI enrichment.'
      });
    }

    // Fetch recent tag corrections for few-shot learning
    const recentCorrections = await getRecentTagCorrections(inferredBrand, undefined, 5);
    const fewShotExamples = buildFewShotExamples(recentCorrections);

    // Check if we have an image to analyze
    const hasImage = !!product.image_url;

    // Build color context for AI prompt (if we have extracted colors)
    const colorContext = extractedColors
      ? `\nACCURATE COLORS (from pixel analysis): ${extractedColors.colorNames.join(', ')} (${extractedColors.warmth} palette)`
      : '';

    const prompt = `You are a luxury lifestyle and product analyst specializing in fashion, home decor, fragrance, and floral design. Analyze this product and return comprehensive metadata for mood/vibe curation.
${hasImage ? '\nIMPORTANT: A product image is provided. Use visual analysis to identify textures, materials, and style details.' : ''}${colorContext}
Product Information:
- Name: ${product.name}
- Description: ${product.description || 'N/A'}
- Detected Brand/Sub-brand: ${inferredBrand || product.brand || 'Unknown'}
- Price: ${product.price ? `${product.currency || ''} ${product.price}` : 'N/A'}
- Source URL: ${sourceUrl || 'N/A'}
${hasImage ? '- Image: [Provided - analyze for texture, material, style details]' : '- Image: Not available'}

IMPORTANT BRAND RULES:
1. For multi-brand houses, use the SPECIFIC sub-brand (e.g., "Giorgio Armani" not just "Armani", "Emporio Armani" for younger line, "Armani/Fiori" for florals, "Armani/Casa" for home)
2. Extract the sub-brand from the URL path or product title
3. Each sub-brand has distinct positioning - capture that in the tone
${fewShotExamples}
Return a JSON object with these fields:
{
  "brand": "The specific brand/sub-brand name (e.g., 'Giorgio Armani', 'Emporio Armani', 'Armani/Fiori', 'Armani/Casa')",
  "tags": ["10-15 descriptive tags covering multiple dimensions:
    - Style: minimalist, bohemian, classic, modern, contemporary, avant-garde
    - Occasion: formal, casual, evening, day-to-night, special-occasion, everyday
    - Season: summer, winter, all-season, transitional, resort
    - Aesthetic: elegant, edgy, sophisticated, romantic, dramatic, refined
    - Mood/Vibe: serene, energetic, cozy, luxurious, understated, bold
    - Lifestyle: urban, resort-living, countryside, metropolitan
    - Sensory: aromatic, tactile, visual-impact
    For fashion: tailored, structured, flowing, oversized, fitted
    For decor: statement-piece, accent, functional, decorative
    For florals: fresh, dried, sculptural, romantic, wild, curated
    For fragrance: woody, floral, citrus, oriental, fresh, warm"],
  "material": "primary material (identify from image if possible - for fabric: 'cupro blend', 'silk charmeuse'; for decor: 'ceramic', 'brass'; for florals: 'fresh orchids', 'dried pampas')",
  "texture": "tactile quality FROM THE IMAGE (e.g., 'smooth', 'textured', 'matte', 'lustrous', 'soft', 'crisp')",
  "tone": "overall mood/atmosphere (e.g., 'luxurious refinement', 'understated elegance', 'modern sophistication', 'relaxed luxury')",
  "category": "specific category from:
    Fashion: blazers-jackets, dresses, tops, bottoms, outerwear, accessories, footwear, bags
    Home: furniture, lighting, textiles, tableware, decorative-objects, art
    Lifestyle: floral-arrangements, fragrance, candles, wellness, stationery
    Beauty: skincare, makeup, haircare",
  "vibe_layer": "how this fits into a lifestyle mood board (e.g., 'evening-sophistication', 'weekend-retreat', 'power-dressing', 'cozy-evening', 'garden-party')",
  "pairs_with": ["2-3 complementary categories this would pair with in a mood board, e.g., 'neutral-knits', 'statement-jewelry', 'fresh-florals', 'ambient-candles']
}

NOTE: Colors are extracted separately using pixel-level analysis for accuracy. Focus on tags, material, texture, and semantic understanding.

Be specific and evocative. For luxury items, capture the brand's DNA and positioning. Think about how this product contributes to an overall lifestyle aesthetic and mood.
Return ONLY valid JSON, no explanation.`;

    log.info({ productName: product.name, inferredBrand, hasImage, fewShotCount: recentCorrections.length }, 'Calling AI for enrichment (Gemini → GPT-4o-mini → Claude)...');

    // Try Gemini first (free tier), then GPT-4o-mini (cheap), then Claude (fallback)
    let aiResponse: { success: boolean; text?: string; error?: string };
    let modelUsed = 'gemini';

    // Use vision API if image is available, otherwise use text-only
    if (hasImage) {
      // Try Gemini first
      aiResponse = await callGeminiWithVision(prompt, product.image_url, { maxTokens: 1000 });
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'Gemini vision failed, trying GPT-4o-mini...');
        // Try GPT-4o-mini as second fallback
        aiResponse = await callOpenAIWithVision(prompt, product.image_url, { maxTokens: 1000 });
        modelUsed = 'gpt-4o-mini';
      }
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'GPT-4o-mini vision failed, trying Claude...');
        // Final fallback to Claude
        aiResponse = await callClaudeWithVision(prompt, product.image_url, { maxTokens: 1000 });
        modelUsed = 'claude-fallback';
      }
    } else {
      // Try Gemini first
      aiResponse = await callGemini(prompt, { maxTokens: 800 });
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'Gemini failed, trying GPT-4o-mini...');
        // Try GPT-4o-mini as second fallback
        aiResponse = await callOpenAI(prompt, { maxTokens: 800 });
        modelUsed = 'gpt-4o-mini';
      }
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'GPT-4o-mini failed, trying Claude...');
        // Final fallback to Claude
        aiResponse = await callClaude(prompt, { maxTokens: 800 });
        modelUsed = 'claude-fallback';
      }
    }

    let enrichment;
    if (aiResponse.success && aiResponse.text) {
      log.info({ productName: product.name, modelUsed }, 'AI response received, parsing...');
      enrichment = parseJSONFromResponse(aiResponse.text);
    } else {
      log.warn({ productName: product.name, error: aiResponse.error }, 'All AI providers failed');
    }

    if (!enrichment) {
      log.warn({ productName: product.name }, 'Failed to parse AI response, using defaults');
      enrichment = {
        brand: inferredBrand || product.brand || 'Unknown',
        tags: ['product', 'fashion'],
        material: null,
        texture: null,
        tone: 'neutral',
        category: 'general'
      };
      modelUsed = 'defaults';
    }

    // IMPORTANT: Use pixel-extracted colors (accurate hex codes mapped to fashion names)
    // Fall back to AI-suggested colors only if pixel extraction failed
    const finalColorPalette = extractedColors?.colorNames || enrichment.color_palette || ['neutral'];

    const enrichedProduct: EnrichedProduct = {
      ...product,
      brand: enrichment.brand || inferredBrand || product.brand,
      tags: enrichment.tags || [],
      // Pixel-accurate colors take priority over AI-suggested colors
      color_palette: finalColorPalette,
      material: enrichment.material,
      texture: enrichment.texture,
      // Use extracted warmth for tone if available, otherwise use AI tone
      tone: extractedColors?.warmth || enrichment.tone,
      category: enrichment.category,
      vibe_layer: enrichment.vibe_layer,
      pairs_with: enrichment.pairs_with || [],
      enriched_at: new Date().toISOString()
    };

    // Save to database
    const savedProduct = await saveEnrichedProduct(enrichedProduct);

    return res.status(200).json({
      success: true,
      product: { ...enrichedProduct, id: savedProduct?.id },
      model_used: modelUsed,
      color_extraction: extractedColors ? 'pixel-accurate' : 'ai-fallback',
      color_hex_codes: extractedColors?.hexCodes || [],
      saved_to_db: !!savedProduct,
      _debug: {
        aiSuccess: aiResponse.success,
        aiError: aiResponse.error,
        usedDefaults: modelUsed === 'defaults',
        inferredBrand,
        colorMethod: extractedColors ? 'pixel-sampling' : 'ai-vision',
        extractedWarmth: extractedColors?.warmth
      }
    });
  } catch (error) {
    log.error({ error, productName: product.name }, 'Enrichment failed');
    return res.status(500).json({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Batch enrich all pending products
 * Used by admin dashboard to retry enrichment for products without enriched_at
 */
async function handleEnrichAll(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const startTime = Date.now();
  const limit = parseInt(req.body?.limit || '20', 10); // Process up to 20 products per request

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get products without enriched_at
    const { data: pendingProducts, error: fetchError } = await supabase
      .from('enriched_products')
      .select('id, product_name, brand, image_url, source_url, price, description')
      .is('enriched_at', null)
      .limit(limit);

    if (fetchError) {
      log.error({ error: fetchError }, 'Failed to fetch pending products');
      return res.status(500).json({ error: 'Failed to fetch pending products' });
    }

    if (!pendingProducts || pendingProducts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No products pending enrichment',
        enriched_count: 0,
        failed_count: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    log.info({ count: pendingProducts.length }, 'Starting batch enrichment...');

    let enrichedCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

    // Process each product
    for (const product of pendingProducts) {
      try {
        log.info({ id: product.id, name: product.product_name }, 'Enriching product...');

        // Build enrichment prompt
        const hasImage = !!product.image_url;
        const prompt = `You are a luxury lifestyle and product analyst. Analyze this product and return comprehensive metadata.
${hasImage ? '\nIMPORTANT: A product image is provided. Use visual analysis to identify textures, materials, and style details.' : ''}
Product Information:
- Name: ${product.product_name || 'Unknown'}
- Brand: ${product.brand || 'Unknown'}
- Description: ${product.description || 'N/A'}
- Price: ${product.price || 'N/A'}
- Source: ${product.source_url || 'N/A'}

Return a JSON object with these fields:
{
  "tags": ["10-15 descriptive tags covering style, occasion, season, aesthetic, mood"],
  "material": "primary material",
  "texture": "tactile quality",
  "tone": "overall mood/atmosphere",
  "category": "specific category (e.g., blazers-jackets, dresses, tops, bottoms, accessories, furniture, lighting)",
  "vibe_layer": "how this fits into a lifestyle mood board",
  "pairs_with": ["2-3 complementary categories"]
}
Return ONLY valid JSON.`;

        // Try Gemini → GPT-4o-mini → Claude fallback chain
        let aiResponse: { success: boolean; text?: string; error?: string };
        let modelUsed = 'gemini';

        if (hasImage) {
          aiResponse = await callGeminiWithVision(prompt, product.image_url, { maxTokens: 800 });
          if (!aiResponse.success) {
            aiResponse = await callOpenAIWithVision(prompt, product.image_url, { maxTokens: 800 });
            modelUsed = 'gpt-4o-mini';
          }
          if (!aiResponse.success) {
            aiResponse = await callClaudeWithVision(prompt, product.image_url, { maxTokens: 800 });
            modelUsed = 'claude';
          }
        } else {
          aiResponse = await callGemini(prompt, { maxTokens: 600 });
          if (!aiResponse.success) {
            aiResponse = await callOpenAI(prompt, { maxTokens: 600 });
            modelUsed = 'gpt-4o-mini';
          }
          if (!aiResponse.success) {
            aiResponse = await callClaude(prompt, { maxTokens: 600 });
            modelUsed = 'claude';
          }
        }

        let enrichment = null;
        if (aiResponse.success && aiResponse.text) {
          enrichment = parseJSONFromResponse(aiResponse.text);
        }

        if (!enrichment) {
          enrichment = {
            tags: ['product'],
            material: null,
            texture: null,
            tone: 'neutral',
            category: 'general',
          };
          modelUsed = 'defaults';
        }

        // Update the product with enrichment data
        const { error: updateError } = await supabase
          .from('enriched_products')
          .update({
            tags: enrichment.tags || [],
            material: enrichment.material || null,
            texture: enrichment.texture || null,
            tone: enrichment.tone || null,
            category: enrichment.category || 'general',
            vibe_layer: enrichment.vibe_layer || null,
            pairs_with: enrichment.pairs_with || [],
            enriched_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        enrichedCount++;
        results.push({ id: product.id, name: product.product_name, success: true });
        log.info({ id: product.id, name: product.product_name, modelUsed }, 'Product enriched successfully');

      } catch (productError) {
        failedCount++;
        results.push({
          id: product.id,
          name: product.product_name,
          success: false,
          error: productError instanceof Error ? productError.message : 'Unknown error',
        });
        log.error({ id: product.id, error: productError }, 'Failed to enrich product');
      }
    }

    const duration = Date.now() - startTime;
    log.info({ enrichedCount, failedCount, duration }, 'Batch enrichment complete');

    return res.status(200).json({
      success: true,
      message: `Enriched ${enrichedCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      enriched_count: enrichedCount,
      failed_count: failedCount,
      total_processed: pendingProducts.length,
      duration_ms: duration,
      results,
    });

  } catch (error) {
    log.error({ error }, 'Batch enrichment failed');
    return res.status(500).json({
      error: 'Batch enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Save enriched product to Supabase
async function saveEnrichedProduct(product: EnrichedProduct): Promise<{ id: string } | null> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured, skipping database save');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map to database schema
    const dbProduct = {
      product_name: product.name,
      brand: product.brand || 'Unknown',
      category: product.category || 'general',
      price: product.price || null,
      color_palette: product.color_palette || [],
      tags: product.tags || [],
      texture: product.texture || null,
      material: product.material || null,
      tone: product.tone || null,
      vibe_layer: product.vibe_layer || null,
      pairs_with: product.pairs_with || [],
      image_url: product.image_url || null,
      source_url: product.source_url || null,
      enriched_at: product.enriched_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('enriched_products')
      .insert(dbProduct)
      .select('id')
      .single();

    if (error) {
      log.error({ error, product: product.name }, 'Failed to save to database');
      return null;
    }

    log.info({ id: data.id, product: product.name }, 'Product saved to enriched_products');
    return data;
  } catch (err) {
    log.error({ error: err }, 'Database save error');
    return null;
  }
}

// ============================================================================
// TAG FEEDBACK FUNCTIONS (AI Learning)
// ============================================================================

interface TagFeedback {
  product_id?: string;
  brand?: string;
  category?: string;
  price_range?: string;
  ai_generated_tags: string[];
  user_final_tags: string[];
  source_url?: string;
  session_id?: string;
}

/**
 * Save tag feedback for AI learning
 * Called when user finishes editing tags
 */
async function saveTagFeedback(feedback: TagFeedback): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured, skipping tag feedback save');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate what was added and removed
    const aiTags = new Set(feedback.ai_generated_tags);
    const userTags = new Set(feedback.user_final_tags);

    const tags_added = feedback.user_final_tags.filter(t => !aiTags.has(t));
    const tags_removed = feedback.ai_generated_tags.filter(t => !userTags.has(t));

    // Only save if there were actual changes
    if (tags_added.length === 0 && tags_removed.length === 0) {
      log.info('No tag changes, skipping feedback save');
      return true;
    }

    const { error } = await supabase
      .from('tag_feedback')
      .insert({
        product_id: feedback.product_id || null,
        brand: feedback.brand || null,
        category: feedback.category || null,
        price_range: feedback.price_range || null,
        ai_generated_tags: feedback.ai_generated_tags,
        user_final_tags: feedback.user_final_tags,
        tags_added,
        tags_removed,
        source_url: feedback.source_url || null,
        session_id: feedback.session_id || null,
      });

    if (error) {
      log.error({ error }, 'Failed to save tag feedback');
      return false;
    }

    log.info({ tags_added, tags_removed }, 'Tag feedback saved for AI learning');
    return true;
  } catch (err) {
    log.error({ error: err }, 'Tag feedback save error');
    return false;
  }
}

/**
 * Get recent tag corrections for few-shot learning
 * Returns examples of user corrections to include in AI prompt
 */
async function getRecentTagCorrections(
  brand?: string,
  category?: string,
  limit: number = 5
): Promise<Array<{ brand: string; category: string; removed: string[]; added: string[] }>> {
  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('tag_feedback')
      .select('brand, category, tags_removed, tags_added')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by brand if provided (partial match)
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    // Only return entries that have actual corrections
    return data
      .filter((d: any) =>
        (d.tags_removed && d.tags_removed.length > 0) ||
        (d.tags_added && d.tags_added.length > 0)
      )
      .map((d: any) => ({
        brand: d.brand || 'Unknown',
        category: d.category || 'general',
        removed: d.tags_removed || [],
        added: d.tags_added || [],
      }));
  } catch (err) {
    log.error({ error: err }, 'Failed to fetch tag corrections');
    return [];
  }
}

/**
 * Build few-shot examples string for AI prompt
 */
function buildFewShotExamples(
  corrections: Array<{ brand: string; category: string; removed: string[]; added: string[] }>
): string {
  if (corrections.length === 0) {
    return '';
  }

  const examples = corrections.map(c => {
    const parts: string[] = [];
    if (c.removed.length > 0) {
      parts.push(`removed: [${c.removed.join(', ')}]`);
    }
    if (c.added.length > 0) {
      parts.push(`added: [${c.added.join(', ')}]`);
    }
    return `- ${c.brand} (${c.category}): ${parts.join(', ')}`;
  });

  return `
LEARNING FROM USER FEEDBACK:
Recent corrections users made to AI-generated tags:
${examples.join('\n')}

Use these patterns to improve your tag suggestions. Avoid tags that users frequently remove, and consider including tags that users often add.
`;
}

/**
 * Handle tag feedback submission
 */
async function handleTagFeedback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { feedback } = req.body as { feedback: TagFeedback };

  if (!feedback || !feedback.ai_generated_tags || !feedback.user_final_tags) {
    return res.status(400).json({ error: 'feedback with ai_generated_tags and user_final_tags is required' });
  }

  const success = await saveTagFeedback(feedback);

  return res.status(200).json({
    success,
    message: success ? 'Feedback saved for AI learning' : 'Failed to save feedback',
  });
}

async function handleCompose(body: ComposeRequest, res: VercelResponse) {
  if (!body.productImages || body.productImages.length === 0) {
    return res.status(400).json({ error: 'At least one product image is required' });
  }

  if (body.productImages.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 product images allowed' });
  }

  // Demo mode
  if (DEMO_MODE) {
    log.info({ productCount: body.productImages.length, demoMode: true }, 'Demo mode active');
    return res.status(200).json({
      success: true,
      moodboard: {
        imageUrl: null,
        productCount: body.productImages.length,
        arrangement: body.arrangement || 'balanced',
        model: 'demo-mode',
        latencyMs: 0,
      },
      _demo: true,
      _note: 'Demo mode active. Set DEMO_MODE=false and configure OPENAI_API_KEY for real AI composition.',
      _fallback: '/api/ai?action=layout',
    });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({
      success: false,
      error: 'OpenAI API key not configured',
      _fallback: '/api/ai?action=layout',
    });
  }

  log.info(
    { productCount: body.productImages.length, arrangement: body.arrangement },
    'Starting AI moodboard composition'
  );

  const imageGenerator = createImageGenerator();

  const input: MoodboardCompositionInput = {
    productImages: body.productImages.map((img) => ({
      url: img.url,
      base64: img.base64,
    })),
    style: body.style,
    arrangement: body.arrangement,
    canvasSize: body.canvasSize,
    mood: body.style?.mood,
  };

  const result = await imageGenerator.composeMoodboard(input);

  // Upload to storage
  let publicUrl: string | undefined;
  if (result.imageBase64) {
    publicUrl = await uploadToStorage(
      result.imageBase64,
      `moodboards/${body.lookId || 'temp'}`,
      `${Date.now()}.png`
    );
  }

  log.info(
    { productCount: body.productImages.length, latencyMs: result.latencyMs },
    'Moodboard composition complete'
  );

  return res.status(200).json({
    success: true,
    moodboard: {
      imageUrl: publicUrl || result.imageUrl,
      imageBase64: result.imageBase64,
      productCount: result.productCount,
      arrangement: result.arrangement,
      model: result.model,
      latencyMs: result.latencyMs,
      revisedPrompt: result.revisedPrompt,
    },
  });
}

async function handleTryOn(body: TryOnRequest, res: VercelResponse) {
  // Validation
  if (!body.baseImage || (!body.baseImage.url && !body.baseImage.base64)) {
    return res.status(400).json({
      error: 'Base image is required',
      hint: 'Provide a person photo (for clothing) or room photo (for furniture)',
    });
  }

  if (!body.productImages || body.productImages.length === 0) {
    return res.status(400).json({ error: 'At least one product image is required' });
  }

  if (body.productImages.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 product images allowed per try-on' });
  }

  const validTypes: TryOnType[] = ['clothing', 'accessory', 'furniture', 'decor'];
  if (!body.type || !validTypes.includes(body.type)) {
    return res.status(400).json({
      error: 'Invalid try-on type',
      hint: 'Use one of: clothing, accessory, furniture, decor',
    });
  }

  // Demo mode
  if (DEMO_MODE) {
    log.info({ type: body.type, productCount: body.productImages.length, demoMode: true }, 'Demo mode active');
    return res.status(200).json({
      success: true,
      result: {
        imageUrl: null,
        type: body.type,
        productCount: body.productImages.length,
        model: 'demo-mode',
        latencyMs: 0,
      },
      _demo: true,
      _note: 'Demo mode active. Set DEMO_MODE=false and configure OPENAI_API_KEY for real virtual try-on.',
    });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'OpenAI API key not configured',
    });
  }

  log.info(
    { type: body.type, productCount: body.productImages.length },
    'Starting virtual try-on'
  );

  const imageGenerator = createImageGenerator();

  const input: VirtualTryOnInput = {
    baseImage: {
      url: body.baseImage.url,
      base64: body.baseImage.base64,
    },
    productImages: body.productImages.map((img) => ({
      url: img.url,
      base64: img.base64,
    })),
    type: body.type,
    preserveBackground: body.preserveBackground ?? true,
  };

  const result = await imageGenerator.virtualTryOn(input);

  // Upload to storage
  let publicUrl: string | undefined;
  if (result.imageBase64) {
    publicUrl = await uploadToStorage(result.imageBase64, `tryons/${body.type}`, `${Date.now()}.png`);
  }

  log.info(
    { type: body.type, productCount: body.productImages.length, latencyMs: result.latencyMs },
    'Virtual try-on complete'
  );

  return res.status(200).json({
    success: true,
    result: {
      imageUrl: publicUrl || result.imageUrl,
      imageBase64: result.imageBase64,
      type: result.type,
      productCount: result.productCount,
      model: result.model,
      latencyMs: result.latencyMs,
      revisedPrompt: result.revisedPrompt,
    },
  });
}

function handleListLayouts(res: VercelResponse) {
  return res.status(200).json({
    layouts: [
      { type: 'zigzag', name: 'ZigZag', description: 'Alternating left-right placement' },
      { type: 'centerpiece', name: 'Centerpiece', description: 'Hero product in center' },
      { type: 'grid', name: 'Grid', description: 'Balanced grid layout' },
      { type: 'asymmetric', name: 'Asymmetric', description: 'Pinterest-style dynamic' },
      { type: 'stacked', name: 'Stacked', description: 'Vertical cascade with overlaps' },
      { type: 'diagonal', name: 'Diagonal', description: 'Products along diagonal' },
      { type: 'cluster', name: 'Cluster', description: 'Circular grouping' },
      { type: 'magazine', name: 'Magazine', description: 'Editorial style layout' }
    ]
  });
}

function handleGenerateLayout(req: VercelRequest, res: VercelResponse) {
  const { layout_type, products, canvas_width = 1200, canvas_height = 800 } = req.body;

  if (!layout_type) {
    return res.status(400).json({ error: 'layout_type is required' });
  }

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ error: 'products array is required' });
  }

  const generator = layoutGenerators[layout_type as LayoutType];

  if (!generator) {
    return res.status(400).json({
      error: `Invalid layout_type. Available: ${Object.keys(layoutGenerators).join(', ')}`
    });
  }

  const positions = generator(products, canvas_width, canvas_height);

  return res.status(200).json({
    layout_type,
    canvas_size: { width: canvas_width, height: canvas_height },
    products: positions
  });
}

async function handleSmartLabels(req: VercelRequest, res: VercelResponse) {
  const {
    image_positions,
    label_style,
    canvas_size,
    layout_type
  } = req.body as {
    image_positions: ImagePosition[];
    label_style: LabelStyle;
    canvas_size: { width: number; height: number };
    layout_type?: string;
  };

  if (!image_positions || !Array.isArray(image_positions)) {
    return res.status(400).json({ error: 'image_positions array is required' });
  }

  const defaultLabelStyle = label_style || { font_size: 14, color: '#000000' };
  const defaultCanvasSize = canvas_size || { width: 1200, height: 800 };

  try {
    // Fetch past corrections and successful examples for few-shot learning
    const productCount = image_positions.length;
    const [recentCorrections, successfulExamples] = await Promise.all([
      getRecentLayoutCorrections(layout_type, productCount, 3),
      getSuccessfulLayoutExamples(layout_type, productCount, 2)
    ]);

    const fewShotExamples = buildLayoutFewShotExamples(recentCorrections, successfulExamples);

    // Build enhanced prompt with few-shot learning
    const basePrompt = buildVisionPrompt(image_positions, defaultLabelStyle, defaultCanvasSize);
    const enhancedPrompt = fewShotExamples
      ? `${fewShotExamples}\n\n${basePrompt}`
      : basePrompt;

    log.info({
      productCount,
      layout_type,
      correctionsCount: recentCorrections.length,
      successfulCount: successfulExamples.length
    }, 'Calling AI for smart label placement with few-shot learning...');

    const aiResponse = await callClaude(enhancedPrompt, { maxTokens: 1024 });

    let placements: LabelPlacement[] = [];

    if (aiResponse.success && aiResponse.text) {
      const parsed = parseJSONFromResponse(aiResponse.text);
      if (Array.isArray(parsed)) {
        placements = parsed;
      }
    }

    if (placements.length === 0) {
      log.info('AI label placement failed, using rule-based fallback');
      placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

      return res.status(200).json({
        success: true,
        label_placements: placements,
        method: 'rule-based-fallback'
      });
    }

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'ai',
      model_used: 'claude-via-edge-function',
      learning_context: {
        corrections_used: recentCorrections.length,
        successful_examples_used: successfulExamples.length
      }
    });
  } catch (error) {
    log.error({ error }, 'Smart label generation failed');

    const placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'rule-based-fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// LAYOUT FEEDBACK FUNCTIONS (AI Learning)
// ============================================================================

interface LayoutFeedback {
  moodboard_id?: string;
  look_id?: string;
  layout_type: string;
  product_count: number;
  canvas_width: number;
  canvas_height: number;
  product_categories?: string[];
  product_brands?: string[];
  color_palettes?: string[];
  vibe_layer?: string;
  ai_generated_layout: any;
  user_final_layout: any;
  adjustments?: any[];
  user_rating?: number;
  was_exported?: boolean;
  time_spent_adjusting?: number;
  session_id?: string;
}

/**
 * Save layout feedback for AI learning
 * Called when user finishes adjusting a layout
 */
async function saveLayoutFeedback(feedback: LayoutFeedback): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured, skipping layout feedback save');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate adjustment metrics
    let elements_moved = 0;
    let elements_resized = 0;
    let elements_rotated = 0;
    let labels_repositioned = 0;
    let z_order_changed = false;

    if (feedback.adjustments && Array.isArray(feedback.adjustments)) {
      for (const adj of feedback.adjustments) {
        switch (adj.type) {
          case 'move': elements_moved++; break;
          case 'resize': elements_resized++; break;
          case 'rotate': elements_rotated++; break;
          case 'label_move': labels_repositioned++; break;
          case 'z_order': z_order_changed = true; break;
        }
      }
    }

    const { error } = await supabase
      .from('layout_feedback')
      .insert({
        moodboard_id: feedback.moodboard_id || null,
        look_id: feedback.look_id || null,
        layout_type: feedback.layout_type,
        product_count: feedback.product_count,
        canvas_width: feedback.canvas_width,
        canvas_height: feedback.canvas_height,
        product_categories: feedback.product_categories || [],
        product_brands: feedback.product_brands || [],
        color_palettes: feedback.color_palettes || [],
        vibe_layer: feedback.vibe_layer || null,
        ai_generated_layout: feedback.ai_generated_layout,
        user_final_layout: feedback.user_final_layout,
        elements_moved,
        elements_resized,
        elements_rotated,
        z_order_changed,
        labels_repositioned,
        adjustments: feedback.adjustments || [],
        user_rating: feedback.user_rating || null,
        was_exported: feedback.was_exported || false,
        time_spent_adjusting: feedback.time_spent_adjusting || null,
        session_id: feedback.session_id || null,
      });

    if (error) {
      log.error({ error }, 'Failed to save layout feedback');
      return false;
    }

    log.info({
      layout_type: feedback.layout_type,
      elements_moved,
      elements_resized,
      labels_repositioned,
      was_exported: feedback.was_exported
    }, 'Layout feedback saved for AI learning');
    return true;
  } catch (err) {
    log.error({ error: err }, 'Layout feedback save error');
    return false;
  }
}

/**
 * Get recent layout corrections for few-shot learning
 */
async function getRecentLayoutCorrections(
  layoutType?: string,
  productCount?: number,
  limit: number = 3
): Promise<Array<{ layout_type: string; adjustments: any; was_exported: boolean }>> {
  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('layout_feedback')
      .select('layout_type, product_count, adjustments, was_exported, ai_generated_layout, user_final_layout')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (layoutType) {
      query = query.eq('layout_type', layoutType);
    }

    if (productCount) {
      query = query.gte('product_count', productCount - 1).lte('product_count', productCount + 1);
    }

    // Only get layouts that had adjustments
    query = query.or('elements_moved.gt.0,elements_resized.gt.0,labels_repositioned.gt.0');

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((d: any) => ({
      layout_type: d.layout_type,
      adjustments: d.adjustments,
      was_exported: d.was_exported,
    }));
  } catch (err) {
    log.error({ error: err }, 'Failed to fetch layout corrections');
    return [];
  }
}

/**
 * Get successful layout examples for context
 */
async function getSuccessfulLayoutExamples(
  layoutType?: string,
  productCount?: number,
  limit: number = 2
): Promise<Array<{ layout_type: string; product_count: number; final_layout: any }>> {
  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('layout_feedback')
      .select('layout_type, product_count, user_final_layout, user_rating')
      .eq('was_exported', true)
      .lte('elements_moved', 2)  // Minimal corrections = good initial layout
      .order('user_rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (layoutType) {
      query = query.eq('layout_type', layoutType);
    }

    if (productCount) {
      query = query.gte('product_count', productCount - 1).lte('product_count', productCount + 1);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((d: any) => ({
      layout_type: d.layout_type,
      product_count: d.product_count,
      final_layout: d.user_final_layout,
    }));
  } catch (err) {
    log.error({ error: err }, 'Failed to fetch successful layouts');
    return [];
  }
}

/**
 * Build few-shot examples for layout/label AI prompt
 */
function buildLayoutFewShotExamples(
  corrections: Array<{ layout_type: string; adjustments: any; was_exported: boolean }>,
  successfulExamples: Array<{ layout_type: string; product_count: number; final_layout: any }>
): string {
  if (corrections.length === 0 && successfulExamples.length === 0) {
    return '';
  }

  const parts: string[] = [];

  // Add correction patterns
  if (corrections.length > 0) {
    parts.push('LEARNING FROM PAST ADJUSTMENTS:');
    parts.push('Users typically make these corrections to AI-generated layouts:');
    for (const c of corrections) {
      if (c.adjustments && Array.isArray(c.adjustments)) {
        const moveCount = c.adjustments.filter((a: any) => a.type === 'move').length;
        const labelMoves = c.adjustments.filter((a: any) => a.type === 'label_move').length;
        if (moveCount > 0 || labelMoves > 0) {
          parts.push(`- ${c.layout_type}: ${moveCount} elements repositioned, ${labelMoves} labels moved`);
        }
      }
    }
    parts.push('');
  }

  // Add successful examples
  if (successfulExamples.length > 0) {
    parts.push('EXAMPLES OF SUCCESSFUL LAYOUTS (minimal user corrections needed):');
    for (const ex of successfulExamples) {
      if (ex.final_layout && ex.final_layout.products) {
        const products = ex.final_layout.products;
        parts.push(`- ${ex.layout_type} with ${ex.product_count} products:`);
        // Summarize positioning patterns
        const avgX = products.reduce((sum: number, p: any) => sum + p.x, 0) / products.length;
        const avgY = products.reduce((sum: number, p: any) => sum + p.y, 0) / products.length;
        parts.push(`  Average position: (${Math.round(avgX)}, ${Math.round(avgY)})`);
      }
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Handle layout feedback submission
 */
async function handleLayoutFeedback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { feedback } = req.body as { feedback: LayoutFeedback };

  if (!feedback || !feedback.layout_type || !feedback.ai_generated_layout || !feedback.user_final_layout) {
    return res.status(400).json({
      error: 'feedback with layout_type, ai_generated_layout, and user_final_layout is required'
    });
  }

  const success = await saveLayoutFeedback(feedback);

  return res.status(200).json({
    success,
    message: success ? 'Layout feedback saved for AI learning' : 'Failed to save feedback',
  });
}

// ============================================================================
// PARSE PRODUCT DETAILS (Natural Language)
// ============================================================================

interface ParsedProductDetails {
  brand: string | null;
  size: string | null;
  material: string | null;
  estimated_price: number | null;
  currency: string | null;
  additional_tags: string[];
}

/**
 * Parse natural language product description into structured fields
 * Uses Gemini (same as chat agent) for consistency
 *
 * Example input: "It's a Zara blazer, size M, wool blend, paid $80"
 * Example output: { brand: "Zara", size: "M", material: "wool blend", estimated_price: 80, currency: "USD" }
 */
async function handleParseProductDetails(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, context = 'fashion' } = req.body as {
    description: string;
    context?: 'fashion' | 'home';
  };

  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description is required' });
  }

  if (description.length > 500) {
    return res.status(400).json({ error: 'description too long (max 500 characters)' });
  }

  const prompt = `Extract structured product details from this natural language description.

User said: "${description}"
Context: ${context} (${context === 'fashion' ? 'clothing/accessories' : 'home decor/furniture'})

Extract the following fields if mentioned (return null if not mentioned):
- brand: The brand name (e.g., "Zara", "Nike", "IKEA")
- size: Size information (e.g., "M", "Large", "42", "10", "One Size")
- material: Material or fabric (e.g., "wool blend", "cotton", "leather", "oak wood")
- estimated_price: Numeric price value (just the number, no currency symbol)
- currency: Currency if mentioned (e.g., "USD", "EUR", "GBP", "INR") - default to "USD" if price mentioned without currency
- additional_tags: Array of additional descriptive tags extracted (e.g., ["navy", "formal", "vintage"])

Return ONLY valid JSON in this exact format:
{
  "brand": "extracted brand or null",
  "size": "extracted size or null",
  "material": "extracted material or null",
  "estimated_price": number or null,
  "currency": "currency code or null",
  "additional_tags": ["tag1", "tag2"]
}`;

  try {
    log.info({ description, context }, 'Parsing natural language product details with Gemini...');

    // Use Gemini (same as chat agent) for consistency
    let aiResponse = await callGemini(prompt, { maxTokens: 300 });
    let modelUsed = 'gemini';

    // Fallback to Claude if Gemini fails
    if (!aiResponse.success) {
      log.warn({ error: aiResponse.error }, 'Gemini failed, trying Claude...');
      aiResponse = await callClaude(prompt, { maxTokens: 300 });
      modelUsed = 'claude';
    }

    if (!aiResponse.success || !aiResponse.text) {
      log.warn('All AI providers failed for parse-details');
      return res.status(200).json({
        success: false,
        error: 'Failed to parse description',
        parsed: {
          brand: null,
          size: null,
          material: null,
          estimated_price: null,
          currency: null,
          additional_tags: [],
        },
        confidence: 0,
      });
    }

    const parsed = parseJSONFromResponse(aiResponse.text) as ParsedProductDetails | null;

    if (!parsed) {
      log.warn('Failed to parse JSON from AI response');
      return res.status(200).json({
        success: false,
        error: 'Failed to parse AI response',
        parsed: {
          brand: null,
          size: null,
          material: null,
          estimated_price: null,
          currency: null,
          additional_tags: [],
        },
        confidence: 0,
      });
    }

    // Validate and clean the parsed data
    const cleanedParsed: ParsedProductDetails = {
      brand: parsed.brand && typeof parsed.brand === 'string' ? parsed.brand.trim() : null,
      size: parsed.size && typeof parsed.size === 'string' ? parsed.size.trim() : null,
      material: parsed.material && typeof parsed.material === 'string' ? parsed.material.trim() : null,
      estimated_price: typeof parsed.estimated_price === 'number' ? parsed.estimated_price : null,
      currency: parsed.currency && typeof parsed.currency === 'string' ? parsed.currency.toUpperCase() : null,
      additional_tags: Array.isArray(parsed.additional_tags)
        ? parsed.additional_tags.filter((t): t is string => typeof t === 'string').map(t => t.trim())
        : [],
    };

    // Calculate confidence based on how many fields were extracted
    const fieldsExtracted = [
      cleanedParsed.brand,
      cleanedParsed.size,
      cleanedParsed.material,
      cleanedParsed.estimated_price,
      cleanedParsed.additional_tags.length > 0,
    ].filter(Boolean).length;
    const confidence = Math.min(1, fieldsExtracted / 3); // At least 3 fields = full confidence

    log.info({
      parsed: cleanedParsed,
      modelUsed,
      confidence,
      fieldsExtracted
    }, 'Natural language parsing complete');

    return res.status(200).json({
      success: true,
      parsed: cleanedParsed,
      confidence,
      model_used: modelUsed,
    });

  } catch (error) {
    log.error({ error }, 'Parse product details failed');
    return res.status(500).json({
      error: 'Parse failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  const action = req.query.action as string;

  // GET request for layout list
  if (req.method === 'GET' && action === 'layouts') {
    return handleListLayouts(res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'enrich':
        return handleEnrich(req, res);

      case 'enrich-all':
        return handleEnrichAll(req, res);

      case 'compose':
        return handleCompose(req.body as ComposeRequest, res);

      case 'tryon':
        return handleTryOn(req.body as TryOnRequest, res);

      case 'layout':
        return handleGenerateLayout(req, res);

      case 'labels':
        return handleSmartLabels(req, res);

      case 'feedback':
        return handleTagFeedback(req, res);

      case 'layout-feedback':
        return handleLayoutFeedback(req, res);

      case 'parse-details':
        return handleParseProductDetails(req, res);

      default:
        return res.status(400).json({
          error: 'Invalid action',
          hint: 'Use ?action=enrich|enrich-all|compose|tryon|layouts|layout|labels|feedback|layout-feedback|parse-details',
          examples: {
            enrich: 'POST /api/ai?action=enrich',
            'enrich-all': 'POST /api/ai?action=enrich-all (batch enrich pending products)',
            compose: 'POST /api/ai?action=compose',
            tryon: 'POST /api/ai?action=tryon',
            layouts: 'GET /api/ai?action=layouts',
            layout: 'POST /api/ai?action=layout',
            labels: 'POST /api/ai?action=labels',
            feedback: 'POST /api/ai?action=feedback (tag feedback)',
            'layout-feedback': 'POST /api/ai?action=layout-feedback (layout adjustments)',
            'parse-details': 'POST /api/ai?action=parse-details (natural language product details)',
          },
        });
    }
  } catch (error) {
    log.error({ error, action }, 'AI operation failed');
    return res.status(500).json({
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
