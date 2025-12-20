/**
 * Moodboard Export Types
 * Types for export metadata and bundling
 */

/**
 * Product info for export metadata
 */
export interface ExportProductInfo {
  brand: string;
  name: string;
  url: string;
  price?: string;
  tags: string[];
  image_url?: string;
}

/**
 * Theme/color palette for export
 */
export interface ExportTheme {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
}

/**
 * Moodboard metadata JSON structure
 */
export interface MoodboardMetadata {
  id: string;
  name?: string;
  products: ExportProductInfo[];
  theme: ExportTheme;
  layout: string;
  generated_at: string;
  version: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'png' | 'jpg';
  quality?: number;          // 1-100 for jpg
  includeMetadata?: boolean; // Include JSON file
  includeWatermark?: boolean;
  watermarkText?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  imageBuffer?: Buffer;
  metadata?: MoodboardMetadata;
  zipBuffer?: Buffer;        // Combined zip when includeMetadata=true
  error?: string;
  exportedAt: string;
}

/**
 * Moodboard data input for export
 */
export interface MoodboardExportInput {
  id: string;
  name?: string;
  imageData: Buffer | string;  // Buffer or base64
  products: ExportProductInfo[];
  theme: ExportTheme;
  layout: string;
}
