/**
 * Product Validation Module
 * Validates raw product input before enrichment
 */

import { RawProductInput, ValidationResult, EnrichedProductFields } from './types';

/**
 * Validates raw product input
 * @param product - Raw product data to validate
 * @returns ValidationResult with isValid flag and error messages
 */
export function validateRawProduct(product: RawProductInput): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!product.product_name || product.product_name.trim().length === 0) {
    errors.push('product_name is required and cannot be empty');
  }

  if (!product.brand || product.brand.trim().length === 0) {
    errors.push('brand is required and cannot be empty');
  }

  if (!product.category || product.category.trim().length === 0) {
    errors.push('category is required and cannot be empty');
  }

  // Optional field validation
  if (product.price !== undefined && product.price < 0) {
    errors.push('price must be a positive number');
  }

  if (product.region && product.region.trim().length === 0) {
    errors.push('region cannot be an empty string if provided');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates enriched product fields returned by Claude
 * @param enriched - Enriched fields from Claude API
 * @returns ValidationResult with isValid flag and error messages
 */
export function validateEnrichedFields(enriched: EnrichedProductFields): ValidationResult {
  const errors: string[] = [];

  // Validate color_palette
  if (!enriched.color_palette || !Array.isArray(enriched.color_palette)) {
    errors.push('color_palette must be an array');
  } else if (enriched.color_palette.length < 2) {
    errors.push('color_palette must contain at least 2 colors');
  } else if (new Set(enriched.color_palette).size < 2) {
    errors.push('color_palette must contain at least 2 distinct colors');
  }

  // Validate tags
  if (!enriched.tags || !Array.isArray(enriched.tags)) {
    errors.push('tags must be an array');
  } else if (enriched.tags.length < 3) {
    errors.push('tags must contain at least 3 style keywords');
  }

  // Validate texture
  if (!enriched.texture || enriched.texture.trim().length === 0) {
    errors.push('texture is required and cannot be empty');
  }

  // Validate material
  if (!enriched.material || enriched.material.trim().length === 0) {
    errors.push('material is required and cannot be empty');
  }

  // Validate tone
  if (!enriched.tone || enriched.tone.trim().length === 0) {
    errors.push('tone is required and cannot be empty');
  }

  // Optional: Flag vague tone values
  const vagueTones = ['nice', 'good', 'normal', 'regular', 'standard'];
  if (enriched.tone && vagueTones.includes(enriched.tone.toLowerCase())) {
    errors.push(`tone "${enriched.tone}" is too vague, provide more descriptive value`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes product name by removing extra whitespace and special characters
 */
export function sanitizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes category to lowercase
 */
export function normalizeCategory(category: string): string {
  return category.toLowerCase().trim();
}
