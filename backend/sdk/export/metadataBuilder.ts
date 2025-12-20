/**
 * Metadata Builder Module
 * Assembles moodboard metadata JSON for export
 */

import {
  MoodboardMetadata,
  ExportProductInfo,
  ExportTheme,
  MoodboardExportInput
} from './types';

const METADATA_VERSION = '1.0.0';

/**
 * Build metadata JSON from moodboard data
 * @param input - Moodboard export input
 * @returns Structured metadata object
 */
export function buildMetadata(input: MoodboardExportInput): MoodboardMetadata {
  return {
    id: input.id,
    name: input.name,
    products: normalizeProducts(input.products),
    theme: normalizeTheme(input.theme),
    layout: input.layout,
    generated_at: new Date().toISOString(),
    version: METADATA_VERSION
  };
}

/**
 * Normalize product data for export
 * @param products - Raw product array
 * @returns Cleaned product array
 */
export function normalizeProducts(products: ExportProductInfo[]): ExportProductInfo[] {
  return products.map(product => ({
    brand: product.brand || 'Unknown',
    name: product.name || 'Untitled Product',
    url: product.url || '',
    price: formatPrice(product.price),
    tags: Array.isArray(product.tags) ? product.tags : [],
    image_url: product.image_url
  }));
}

/**
 * Format price string consistently
 * @param price - Raw price value
 * @returns Formatted price string
 */
export function formatPrice(price?: string | number): string | undefined {
  if (price === undefined || price === null) {
    return undefined;
  }

  if (typeof price === 'number') {
    return `$${price.toFixed(2)}`;
  }

  // Already formatted string
  return price;
}

/**
 * Normalize theme colors
 * @param theme - Raw theme object
 * @returns Normalized theme with valid hex colors
 */
export function normalizeTheme(theme: Partial<ExportTheme>): ExportTheme {
  return {
    primary: normalizeColor(theme.primary) || '#000000',
    secondary: normalizeColor(theme.secondary) || '#ffffff',
    accent: normalizeColor(theme.accent),
    background: normalizeColor(theme.background)
  };
}

/**
 * Normalize color to hex format
 * @param color - Color string (hex, rgb, or name)
 * @returns Hex color or undefined
 */
export function normalizeColor(color?: string): string | undefined {
  if (!color) return undefined;

  // Already hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  // Short hex (#fff -> #ffffff)
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  // RGB format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // Return as-is if can't normalize (might be a color name)
  return color;
}

/**
 * Serialize metadata to JSON string
 * @param metadata - Metadata object
 * @param pretty - Use pretty printing
 * @returns JSON string
 */
export function serializeMetadata(metadata: MoodboardMetadata, pretty: boolean = true): string {
  return JSON.stringify(metadata, null, pretty ? 2 : 0);
}

/**
 * Parse metadata from JSON string
 * @param json - JSON string
 * @returns Parsed metadata
 */
export function parseMetadata(json: string): MoodboardMetadata {
  const parsed = JSON.parse(json);

  // Validate required fields
  if (!parsed.id || !parsed.products || !parsed.theme || !parsed.layout) {
    throw new Error('Invalid metadata: missing required fields');
  }

  return parsed as MoodboardMetadata;
}

/**
 * Validate metadata structure
 * @param metadata - Metadata to validate
 * @returns Validation result
 */
export function validateMetadata(metadata: MoodboardMetadata): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.id) {
    errors.push('Missing id');
  }

  if (!Array.isArray(metadata.products)) {
    errors.push('Products must be an array');
  }

  if (!metadata.theme?.primary || !metadata.theme?.secondary) {
    errors.push('Theme must have primary and secondary colors');
  }

  if (!metadata.layout) {
    errors.push('Missing layout');
  }

  if (!metadata.generated_at) {
    errors.push('Missing generated_at timestamp');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract product summary for display
 * @param metadata - Moodboard metadata
 * @returns Summary object
 */
export function extractSummary(metadata: MoodboardMetadata): {
  productCount: number;
  brands: string[];
  totalTags: string[];
  colorPalette: string[];
} {
  const brands = [...new Set(metadata.products.map(p => p.brand))];
  const totalTags = [...new Set(metadata.products.flatMap(p => p.tags))];
  const colorPalette = [
    metadata.theme.primary,
    metadata.theme.secondary,
    metadata.theme.accent,
    metadata.theme.background
  ].filter((c): c is string => !!c);

  return {
    productCount: metadata.products.length,
    brands,
    totalTags,
    colorPalette
  };
}
