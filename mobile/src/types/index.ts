/**
 * Core Type Definitions
 */

// Product types
export interface Product {
  id: string;
  name: string;
  brand?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  source_url?: string;
  description?: string;
  tags?: string[];
  color_palette?: string[];
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  created_at: string;
  enriched_at?: string;
}

export interface ScrapedProduct {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
}

// Moodboard types
export interface Moodboard {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  products: MoodboardProduct[];
  theme?: MoodboardTheme;
  canvas_size: CanvasSize;
  created_at: string;
  updated_at: string;
}

export interface MoodboardProduct {
  id: string;
  product_id: string;
  product: Product;
  position: Position;
  size: Size;
  rotation?: number;
  z_index: number;
  label?: LabelPlacement;
}

export interface MoodboardTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    textSecondary: string;
  };
  fonts?: {
    heading: string;
    body: string;
  };
}

// Canvas types
export interface CanvasSize {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

// Label types
export interface LabelPlacement {
  product_name?: string;
  position: Position;
  text?: string;
  justification?: string;
  style?: LabelStyle;
}

export interface LabelStyle {
  font_size: number;
  color: string;
  placement_preference?: 'above' | 'below' | 'beside' | 'auto';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ScrapeResponse {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  _debug?: {
    requestedUrl: string;
    finalUrl: string;
    htmlLength: number;
    usedPuppeteer: boolean;
  };
}

export interface EnrichResponse {
  success: boolean;
  product: Product;
  model_used: string;
}

export interface SearchResult {
  product_id: string;
  score: number;
  product: Product;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  model_used: string;
}

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  MoodboardDetail: { moodboardId: string };
  ProductDetail: { productId: string };
  AddProduct: { moodboardId?: string };
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Create: undefined;
  Library: undefined;
  Profile: undefined;
};
