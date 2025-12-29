/**
 * Shared types for The Mood Layer application
 */

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
  // Fields for user-uploaded products
  size?: string;
  source?: 'upload' | 'scrape' | 'api';
  original_image_url?: string;
  uploaded_at?: string;
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
