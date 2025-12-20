/**
 * API Contracts for Mood Layer SDK
 *
 * Provides type-safe API contracts between frontend and backend:
 * - Request/Response types for all endpoints
 * - Zod schemas for runtime validation
 * - OpenAPI-compatible type definitions
 *
 * This file can be shared with the frontend for full type safety.
 */

import { z } from 'zod';

// ============================================================================
// COMMON TYPES
// ============================================================================

// Pagination
export const paginatedRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginatedRequest = z.infer<typeof paginatedRequestSchema>;

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    total_pages: z.number(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

// API Response wrapper
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    meta: z.object({
      request_id: z.string().optional(),
      timestamp: z.string(),
      duration_ms: z.number().optional(),
    }).optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    request_id?: string;
    timestamp: string;
    duration_ms?: number;
  };
};

// ============================================================================
// PRODUCT ENRICHMENT API
// ============================================================================

export const enrichProductRequestSchema = z.object({
  url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  product_name: z.string().min(1).max(500),
  brand: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
}).refine(data => data.url || data.image_url, {
  message: 'Either url or image_url is required',
});

export type EnrichProductRequest = z.infer<typeof enrichProductRequestSchema>;

export const enrichedProductSchema = z.object({
  id: z.string().uuid(),
  product_name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  source_url: z.string().nullable(),
  image_url: z.string().nullable(),
  color_palette: z.array(z.string()),
  tags: z.array(z.string()),
  texture: z.string().nullable(),
  material: z.string().nullable(),
  tone: z.string().nullable(),
  enriched_at: z.string(),
  created_at: z.string(),
});

export type EnrichedProduct = z.infer<typeof enrichedProductSchema>;

export const enrichProductResponseSchema = apiResponseSchema(enrichedProductSchema);
export type EnrichProductResponse = ApiResponse<EnrichedProduct>;

export const batchEnrichRequestSchema = z.object({
  products: z.array(enrichProductRequestSchema).min(1).max(50),
});

export type BatchEnrichRequest = z.infer<typeof batchEnrichRequestSchema>;

export const batchEnrichResponseSchema = apiResponseSchema(z.object({
  successful: z.array(enrichedProductSchema),
  failed: z.array(z.object({
    index: z.number(),
    error: z.string(),
  })),
}));

export type BatchEnrichResponse = ApiResponse<{
  successful: EnrichedProduct[];
  failed: { index: number; error: string }[];
}>;

// ============================================================================
// SEARCH API
// ============================================================================

export const searchRequestSchema = z.object({
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
  ...paginatedRequestSchema.shape,
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchResultSchema = z.object({
  products: z.array(enrichedProductSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  facets: z.object({
    brands: z.array(z.object({ value: z.string(), count: z.number() })),
    categories: z.array(z.object({ value: z.string(), count: z.number() })),
    materials: z.array(z.object({ value: z.string(), count: z.number() })),
    tones: z.array(z.object({ value: z.string(), count: z.number() })),
  }).optional(),
  suggestions: z.array(z.string()).optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = apiResponseSchema(searchResultSchema);
export type SearchResponse = ApiResponse<SearchResult>;

// ============================================================================
// BOARD API
// ============================================================================

export const boardElementSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'text', 'shape', 'label']),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number().default(0),
    z_index: z.number().default(0),
  }),
  content: z.object({
    image_url: z.string().optional(),
    text: z.string().optional(),
    font_size: z.number().optional(),
    font_family: z.string().optional(),
    color: z.string().optional(),
    background_color: z.string().optional(),
  }).optional(),
  metadata: z.object({
    product_id: z.string().optional(),
    brand: z.string().optional(),
    price: z.string().optional(),
    source_url: z.string().optional(),
  }).optional(),
});

export type BoardElement = z.infer<typeof boardElementSchema>;

export const boardStateSchema = z.object({
  elements: z.array(boardElementSchema),
  canvas: z.object({
    width: z.number(),
    height: z.number(),
    background_color: z.string().default('#ffffff'),
  }),
  theme: z.object({
    colors: z.record(z.string()).optional(),
    typography: z.object({
      font_family: z.string().optional(),
      heading_size: z.number().optional(),
      body_size: z.number().optional(),
    }).optional(),
  }).optional(),
});

export type BoardState = z.infer<typeof boardStateSchema>;

export const createBoardRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  state: boardStateSchema.optional(),
  is_public: z.boolean().default(false),
});

export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;

export const boardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  current_version: z.number(),
  state: boardStateSchema,
  is_public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_accessed_at: z.string().nullable(),
});

export type Board = z.infer<typeof boardSchema>;

export const boardResponseSchema = apiResponseSchema(boardSchema);
export type BoardResponse = ApiResponse<Board>;

export const boardListResponseSchema = apiResponseSchema(paginatedResponseSchema(boardSchema));
export type BoardListResponse = ApiResponse<PaginatedResponse<Board>>;

export const updateBoardRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  state: boardStateSchema.optional(),
  is_public: z.boolean().optional(),
});

export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>;

// ============================================================================
// LAYOUT API
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

export const generateLayoutRequestSchema = z.object({
  archetype: layoutArchetypeSchema,
  canvas_size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  products: z.array(z.object({
    id: z.string(),
    image_url: z.string().url(),
    aspect_ratio: z.number().positive().optional(),
  })).min(1).max(50),
  options: z.object({
    spacing: z.number().min(0).max(100).default(16),
    padding: z.number().min(0).max(200).default(24),
    show_labels: z.boolean().default(true),
  }).optional(),
});

export type GenerateLayoutRequest = z.infer<typeof generateLayoutRequestSchema>;

export const layoutPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  z_index: z.number().default(0),
});

export type LayoutPosition = z.infer<typeof layoutPositionSchema>;

export const generatedLayoutSchema = z.object({
  positions: z.array(z.object({
    product_id: z.string(),
    image: layoutPositionSchema,
    label: layoutPositionSchema.optional(),
  })),
  archetype: layoutArchetypeSchema,
  canvas_size: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export type GeneratedLayout = z.infer<typeof generatedLayoutSchema>;

export const layoutResponseSchema = apiResponseSchema(generatedLayoutSchema);
export type LayoutResponse = ApiResponse<GeneratedLayout>;

// ============================================================================
// THEME API
// ============================================================================

export const extractThemeRequestSchema = z.object({
  products: z.array(z.object({
    color_palette: z.array(z.string()).optional(),
  })).min(1),
  canvas_size: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export type ExtractThemeRequest = z.infer<typeof extractThemeRequestSchema>;

export const themeTokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
    neutral: z.string().optional(),
  }),
  typography: z.object({
    font_family: z.string(),
    heading_size: z.number().optional(),
    body_size: z.number().optional(),
    line_height: z.number().optional(),
  }),
  export_formats: z.object({
    css: z.string().optional(),
    figma: z.record(z.unknown()).optional(),
    tailwind: z.record(z.unknown()).optional(),
  }).optional(),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeResponseSchema = apiResponseSchema(themeTokensSchema);
export type ThemeResponse = ApiResponse<ThemeTokens>;

// ============================================================================
// EXPORT API
// ============================================================================

export const exportFormatSchema = z.enum(['png', 'jpg', 'pdf', 'svg', 'webp']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

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

export const exportRequestSchema = z.object({
  board_id: z.string().uuid(),
  format: exportFormatSchema,
  quality: z.number().min(1).max(100).default(90),
  scale: z.number().min(0.1).max(4).default(1),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const socialExportRequestSchema = z.object({
  board_id: z.string().uuid(),
  platform: socialPlatformSchema,
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
});

export type SocialExportRequest = z.infer<typeof socialExportRequestSchema>;

export const exportResultSchema = z.object({
  download_url: z.string().url(),
  expires_at: z.string(),
  format: exportFormatSchema,
  size_bytes: z.number(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export type ExportResult = z.infer<typeof exportResultSchema>;

export const exportResponseSchema = apiResponseSchema(exportResultSchema);
export type ExportResponse = ApiResponse<ExportResult>;

// ============================================================================
// PLUGIN API
// ============================================================================

export const pluginPlatformSchema = z.enum([
  'shopify',
  'woocommerce',
  'wix',
  'squarespace',
  'bigcommerce',
]);
export type PluginPlatform = z.infer<typeof pluginPlatformSchema>;

export const connectPluginRequestSchema = z.object({
  platform: pluginPlatformSchema,
  store_url: z.string().url(),
  credentials: z.object({
    api_key: z.string().optional(),
    access_token: z.string().optional(),
  }).optional(),
});

export type ConnectPluginRequest = z.infer<typeof connectPluginRequestSchema>;

export const pluginConnectionSchema = z.object({
  id: z.string().uuid(),
  platform: pluginPlatformSchema,
  store_url: z.string(),
  store_name: z.string().nullable(),
  status: z.enum(['connected', 'disconnected', 'error']),
  last_synced_at: z.string().nullable(),
  product_count: z.number(),
  created_at: z.string(),
});

export type PluginConnection = z.infer<typeof pluginConnectionSchema>;

export const pluginConnectionResponseSchema = apiResponseSchema(pluginConnectionSchema);
export type PluginConnectionResponse = ApiResponse<PluginConnection>;

export const syncProductsRequestSchema = z.object({
  connection_id: z.string().uuid(),
  product_ids: z.array(z.string()).optional(),
  sync_all: z.boolean().default(false),
});

export type SyncProductsRequest = z.infer<typeof syncProductsRequestSchema>;

export const syncResultSchema = z.object({
  synced_count: z.number(),
  failed_count: z.number(),
  new_products: z.number(),
  updated_products: z.number(),
  errors: z.array(z.object({
    product_id: z.string(),
    error: z.string(),
  })),
});

export type SyncResult = z.infer<typeof syncResultSchema>;

export const syncResponseSchema = apiResponseSchema(syncResultSchema);
export type SyncResponse = ApiResponse<SyncResult>;

// ============================================================================
// USER API
// ============================================================================

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  role: z.enum(['guest', 'free', 'pro', 'team', 'admin']),
  created_at: z.string(),
  usage: z.object({
    boards_count: z.number(),
    products_count: z.number(),
    storage_used_mb: z.number(),
  }),
  limits: z.object({
    max_boards: z.number(),
    max_products_per_board: z.number(),
    max_enrichments_per_day: z.number(),
    max_exports_per_day: z.number(),
    max_storage_mb: z.number(),
  }),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const userProfileResponseSchema = apiResponseSchema(userProfileSchema);
export type UserProfileResponse = ApiResponse<UserProfile>;

// ============================================================================
// HELPER: Create paginated response
// ============================================================================

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    total,
    page,
    limit,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

// ============================================================================
// HELPER: Create API response
// ============================================================================

export function createApiResponse<T>(
  data: T,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
