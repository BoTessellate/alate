/**
 * Shared types for The Mood Layer application
 */

// Bounding box for crop regions (normalized 0-1 coordinates)
export interface BoundingBox {
  x: number;      // Top-left x (0-1)
  y: number;      // Top-left y (0-1)
  width: number;  // Width (0-1)
  height: number; // Height (0-1)
}

// Product interface (standardized across the app)
export interface Product {
  id: string;
  product_name: string;
  brand: string;
  price: number;
  currency?: string;
  image_url: string;
  tags: string[];
  color_palette: string[];
  category: string;
  material?: string;
  texture?: string;
  tone?: string;
  canonical_tags?: string[];
  vibe_layer?: string;    // 'evening-sophistication', 'power-dressing', 'cozy-morning', etc.
  pairs_with?: string[];  // ['statement-jewelry', 'elegant-footwear', 'neutral-knits']
  // Fields for user-uploaded products
  size?: string;
  source?: 'upload' | 'scrape' | 'api';
  original_image_url?: string;
  uploaded_at?: string;
  // Bounding box for re-crop adjustment (uploaded products only)
  boundingBox?: BoundingBox;
}

// Collection with saved products
export interface Collection {
  id: string;
  name: string;
  description?: string;
  products: Product[];
  coverImages: string[];
  createdAt: string;
  updatedAt: string;
}

// User style preferences from onboarding
export interface StylePreferences {
  selectedTags: string[];
  selectedCategories: string[];
  completedOnboarding: boolean;
  onboardingCompletedAt?: string;
}

// Aggregated metadata from a collection (for search context)
export interface CollectionMetadata {
  tags: string[];
  colors: string[];
  materials: string[];
  textures: string[];
  tones: string[];
  categories: string[];
}

// Predefined style categories for onboarding
export const STYLE_CATEGORIES = [
  { id: 'minimalist', label: 'Minimalist', emoji: '〇' },
  { id: 'bohemian', label: 'Bohemian', emoji: '🌿' },
  { id: 'scandinavian', label: 'Scandinavian', emoji: '❄️' },
  { id: 'industrial', label: 'Industrial', emoji: '🏭' },
  { id: 'mid-century', label: 'Mid-Century Modern', emoji: '🪑' },
  { id: 'coastal', label: 'Coastal', emoji: '🌊' },
  { id: 'farmhouse', label: 'Farmhouse', emoji: '🏡' },
  { id: 'contemporary', label: 'Contemporary', emoji: '✨' },
  { id: 'traditional', label: 'Traditional', emoji: '🏛️' },
  { id: 'eclectic', label: 'Eclectic', emoji: '🎨' },
  { id: 'japandi', label: 'Japandi', emoji: '🎋' },
  { id: 'art-deco', label: 'Art Deco', emoji: '💎' },
] as const;

export type StyleCategoryId = (typeof STYLE_CATEGORIES)[number]['id'];
