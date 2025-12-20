/**
 * Zod Validation Schemas and Middleware for Mood Layer SDK
 *
 * Provides centralized input validation across all SDK modules.
 * Uses Zod for type-safe schema validation with excellent error messages.
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Pagination schema for list endpoints
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Hex color validation
 */
export const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color format');

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.start_date <= data.end_date;
    }
    return true;
  },
  { message: 'start_date must be before or equal to end_date' }
);

// ============================================================================
// PRODUCT ENRICHMENT SCHEMAS
// ============================================================================

export const productEnrichmentSchema = z.object({
  url: urlSchema.optional(),
  image_url: urlSchema.optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  brand: z.string().max(200).optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
}).refine(
  (data) => data.url || data.image_url,
  { message: 'Either url or image_url must be provided' }
);

export type ProductEnrichmentInput = z.infer<typeof productEnrichmentSchema>;

export const batchEnrichmentSchema = z.object({
  products: z.array(productEnrichmentSchema).min(1).max(50),
});

export type BatchEnrichmentInput = z.infer<typeof batchEnrichmentSchema>;

// ============================================================================
// SEARCH ENGINE SCHEMAS
// ============================================================================

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    brand: z.string().optional(),
    category: z.string().optional(),
    min_price: z.number().positive().optional(),
    max_price: z.number().positive().optional(),
    colors: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    material: z.string().optional(),
    tone: z.string().optional(),
  }).optional(),
  ...paginationSchema.shape,
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const semanticSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  top_k: z.number().int().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.5),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

// ============================================================================
// LAYOUT GENERATOR SCHEMAS
// ============================================================================

export const layoutArchetypeSchema = z.enum([
  'grid',
  'zigzag',
  'centerpiece',
  'asymmetric',
  'stacked',
  'diagonal',
  'cluster',
  'magazine',
]);

export type LayoutArchetype = z.infer<typeof layoutArchetypeSchema>;

export const canvasSizeSchema = z.object({
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});

export type CanvasSize = z.infer<typeof canvasSizeSchema>;

export const layoutRequestSchema = z.object({
  archetype: layoutArchetypeSchema,
  canvas_size: canvasSizeSchema,
  product_count: z.number().int().min(1).max(50),
  spacing: z.number().min(0).max(100).default(16),
  padding: z.number().min(0).max(200).default(24),
});

export type LayoutRequestInput = z.infer<typeof layoutRequestSchema>;

export const layoutPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(-360).max(360).default(0),
  z_index: z.number().int().default(0),
});

export type LayoutPosition = z.infer<typeof layoutPositionSchema>;

// ============================================================================
// EXPORT ENGINE SCHEMAS
// ============================================================================

export const exportFormatSchema = z.enum([
  'png',
  'jpg',
  'pdf',
  'svg',
  'webp',
]);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportRequestSchema = z.object({
  board_id: uuidSchema,
  format: exportFormatSchema,
  quality: z.number().int().min(1).max(100).default(90),
  scale: z.number().min(0.1).max(4).default(1),
  include_metadata: z.boolean().default(false),
});

export type ExportRequestInput = z.infer<typeof exportRequestSchema>;

// ============================================================================
// SOCIAL EXPORT SCHEMAS
// ============================================================================

export const socialPlatformSchema = z.enum([
  'instagram_post',
  'instagram_story',
  'pinterest',
  'facebook',
  'twitter',
  'linkedin',
  'tiktok',
]);

export type SocialPlatform = z.infer<typeof socialPlatformSchema>;

export const socialExportSchema = z.object({
  board_id: uuidSchema,
  platform: socialPlatformSchema,
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
});

export type SocialExportInput = z.infer<typeof socialExportSchema>;

// ============================================================================
// THEME TOKENS SCHEMAS
// ============================================================================

export const colorPaletteSchema = z.object({
  primary: hexColorSchema,
  secondary: hexColorSchema,
  accent: hexColorSchema,
  background: hexColorSchema,
  text: hexColorSchema,
  neutral: hexColorSchema.optional(),
});

export type ColorPalette = z.infer<typeof colorPaletteSchema>;

export const typographySchema = z.object({
  fontFamily: z.string().min(1).max(200),
  headingSize: z.number().positive().optional(),
  bodySize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
});

export type Typography = z.infer<typeof typographySchema>;

export const themeExtractionSchema = z.object({
  products: z.array(z.object({
    color_palette: z.array(hexColorSchema).optional(),
    colors: z.array(hexColorSchema).optional(),
  })).min(1).max(100),
  canvas_size: canvasSizeSchema,
});

export type ThemeExtractionInput = z.infer<typeof themeExtractionSchema>;

// ============================================================================
// MOODBOARD COMPOSER SCHEMAS
// ============================================================================

export const moodboardItemSchema = z.object({
  id: uuidSchema.optional(),
  type: z.enum(['image', 'text', 'shape']),
  position: layoutPositionSchema,
  content: z.string().optional(),
  image_url: urlSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type MoodboardItem = z.infer<typeof moodboardItemSchema>;

export const moodboardSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  canvas_size: canvasSizeSchema,
  items: z.array(moodboardItemSchema).max(200),
  theme: z.object({
    colors: colorPaletteSchema.optional(),
    typography: typographySchema.optional(),
  }).optional(),
  is_public: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export type MoodboardInput = z.infer<typeof moodboardSchema>;

// ============================================================================
// PLUGIN BRIDGE SCHEMAS
// ============================================================================

export const pluginPlatformSchema = z.enum([
  'shopify',
  'woocommerce',
  'wix',
  'squarespace',
  'bigcommerce',
]);

export type PluginPlatform = z.infer<typeof pluginPlatformSchema>;

export const pluginConnectionSchema = z.object({
  platform: pluginPlatformSchema,
  store_url: urlSchema,
  api_key: z.string().min(1).max(500).optional(),
  access_token: z.string().min(1).max(2000).optional(),
});

export type PluginConnectionInput = z.infer<typeof pluginConnectionSchema>;

export const productSyncSchema = z.object({
  platform: pluginPlatformSchema,
  product_ids: z.array(z.string()).min(1).max(100).optional(),
  sync_all: z.boolean().default(false),
  include_variants: z.boolean().default(true),
});

export type ProductSyncInput = z.infer<typeof productSyncSchema>;

// ============================================================================
// BRAND DASHBOARD SCHEMAS
// ============================================================================

export const brandDashboardQuerySchema = z.object({
  ...dateRangeSchema.shape,
  metrics: z.array(z.enum([
    'total_boards',
    'total_products',
    'product_usage',
    'color_trends',
    'category_distribution',
    'engagement',
  ])).optional(),
});

export type BrandDashboardQueryInput = z.infer<typeof brandDashboardQuerySchema>;

// ============================================================================
// LAYOUT AI SCHEMAS
// ============================================================================

export const layoutAIRequestSchema = z.object({
  canvas_size: canvasSizeSchema,
  products: z.array(z.object({
    id: z.string(),
    image_url: urlSchema,
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    importance: z.number().min(0).max(1).optional(),
  })).min(1).max(50),
  style_preference: z.enum([
    'balanced',
    'dynamic',
    'minimal',
    'dense',
    'editorial',
  ]).default('balanced'),
  labels: z.object({
    show_brand: z.boolean().default(true),
    show_price: z.boolean().default(true),
    font_size: z.number().min(8).max(72).default(14),
  }).optional(),
});

export type LayoutAIRequestInput = z.infer<typeof layoutAIRequestSchema>;

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Creates Express middleware for validating request body against a Zod schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
          { field: error.errors[0]?.path.join('.') }
        );
        res.status(validationError.statusCode).json(validationError.toJSON());
      } else {
        next(error);
      }
    }
  };
}

/**
 * Creates Express middleware for validating request query params against a Zod schema
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Query parameter validation failed',
          error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
          { field: error.errors[0]?.path.join('.') }
        );
        res.status(validationError.statusCode).json(validationError.toJSON());
      } else {
        next(error);
      }
    }
  };
}

/**
 * Creates Express middleware for validating request params against a Zod schema
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'URL parameter validation failed',
          error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
          { field: error.errors[0]?.path.join('.') }
        );
        res.status(validationError.statusCode).json(validationError.toJSON());
      } else {
        next(error);
      }
    }
  };
}

/**
 * Utility to validate data directly (not as middleware)
 */
export async function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Validation failed',
        error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      );
    }
    throw error;
  }
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParse<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
