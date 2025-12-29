/**
 * Photo Upload SDK Types
 * Types for the user photo upload and processing pipeline
 */

export interface PhotoUploadInput {
  /** Base64 encoded image data */
  base64: string;
  /** MIME type of the image */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Optional original filename */
  fileName?: string;
  /** Product type for enrichment context */
  productType: 'fashion' | 'home';
}

export interface ProcessedProduct {
  /** Generated UUID for the product */
  id: string;
  /** URL of the original uploaded image */
  original_image_url: string;
  /** URL of the processed cutout image */
  image_url: string;
  /** AI-suggested product name */
  product_name: string;
  /** Default brand placeholder */
  brand: string;
  /** Default price (0) */
  price: number;
  /** Default currency */
  currency: string;
  /** AI-generated style tags */
  tags: string[];
  /** AI-extracted color palette */
  color_palette: string[];
  /** AI-detected category */
  category: string;
  /** AI-detected material */
  material?: string;
  /** AI-detected texture */
  texture?: string;
  /** AI-detected tone/mood */
  tone?: string;
  /** Source identifier */
  source: 'upload';
  /** Upload timestamp */
  uploaded_at: string;
}

export interface PhotoUploadResponse {
  success: boolean;
  product: ProcessedProduct;
  processingTime: {
    uploadMs: number;
    backgroundRemovalMs: number;
    enrichmentMs: number;
    totalMs: number;
  };
  /** Flag for demo mode responses */
  _demo?: boolean;
}

export interface PhotoUploadError {
  success: false;
  error: string;
  code: 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | 'ENRICHMENT_FAILED';
  details?: string;
}

export interface UploadConfig {
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSizeBytes?: number;
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  /** Skip background removal (use original image) */
  skipBackgroundRemoval?: boolean;
  /** Skip AI enrichment (return defaults) */
  skipEnrichment?: boolean;
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  skipBackgroundRemoval: false,
  skipEnrichment: false,
};

// Demo mode enrichment data by product type
export const DEMO_ENRICHMENTS = {
  fashion: {
    clothing: {
      product_name: 'Uploaded Garment',
      tags: ['casual', 'everyday', 'comfortable', 'versatile'],
      color_palette: ['navy', 'white', 'gray'],
      category: 'clothing',
      material: 'cotton blend',
      texture: 'soft',
      tone: 'casual',
    },
    accessory: {
      product_name: 'Uploaded Accessory',
      tags: ['stylish', 'modern', 'minimal', 'everyday'],
      color_palette: ['black', 'silver', 'tan'],
      category: 'accessories',
      material: 'leather',
      texture: 'smooth',
      tone: 'sophisticated',
    },
  },
  home: {
    furniture: {
      product_name: 'Uploaded Furniture',
      tags: ['modern', 'minimalist', 'functional', 'elegant'],
      color_palette: ['walnut', 'cream', 'natural wood'],
      category: 'furniture',
      material: 'wood',
      texture: 'smooth',
      tone: 'warm',
    },
    decor: {
      product_name: 'Uploaded Decor',
      tags: ['artisan', 'handcrafted', 'boho', 'textured'],
      color_palette: ['terracotta', 'cream', 'sage'],
      category: 'home decor',
      material: 'ceramic',
      texture: 'textured',
      tone: 'earthy',
    },
  },
};
