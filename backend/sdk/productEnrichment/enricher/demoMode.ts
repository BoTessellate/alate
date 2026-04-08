/**
 * Demo Mode Data Generator
 * Returns mock enrichment data for testing without AI API calls
 *
 * Extracted from backend/api/ai.ts (lines 137-184)
 */

export interface DemoEnrichment {
  tags: string[];
  color_palette: string[];
  material: string;
  texture: string;
  tone: string;
  category: string;
}

const DEMO_ENRICHMENTS: Record<string, DemoEnrichment> = {
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

/**
 * Returns demo enrichment data based on product name
 * Analyzes product name to return context-appropriate mock data
 */
export function getDemoEnrichment(productName?: string): DemoEnrichment {
  if (!productName) {
    return DEMO_ENRICHMENTS.default;
  }

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
