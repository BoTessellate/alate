/**
 * Type definitions for Image Generation SDK
 * Uses OpenAI GPT-image-1.5 for moodboard composition and virtual try-on
 */

import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ImageGenerationConfig {
  openaiApiKey?: string;           // OpenAI for general image gen (primary)
  geminiApiKey?: string;           // Gemini for virtual try-on (primary) and general fallback
  defaultSize?: ImageSize;
  defaultQuality?: ImageQuality;
  geminiModel?: string;            // Default: imagen-3.0-generate-001
}

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface ImageInput {
  url?: string;
  base64?: string;
  buffer?: Buffer;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface MoodboardCompositionInput {
  productImages: ImageInput[];
  style?: MoodboardStyle;
  canvasSize?: ImageSize;
  arrangement?: 'balanced' | 'asymmetric' | 'collage' | 'grid' | 'organic';
  colorScheme?: string[];
  mood?: string;
}

export interface VirtualTryOnInput {
  baseImage: ImageInput;
  productImages: ImageInput[];
  type: TryOnType;
  preserveBackground?: boolean;
}

export type TryOnType = 'clothing' | 'accessory' | 'furniture' | 'decor';

export interface MoodboardStyle {
  aesthetic?: string;
  colorPalette?: string[];
  mood?: string;
  lighting?: 'natural' | 'studio' | 'warm' | 'cool' | 'dramatic';
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export interface ImageGenerationResponse {
  imageUrl?: string;
  imageBase64?: string;
  revisedPrompt?: string;
  model: string;
  latencyMs: number;
}

export interface MoodboardCompositionResponse extends ImageGenerationResponse {
  productCount: number;
  arrangement: string;
}

export interface VirtualTryOnResponse extends ImageGenerationResponse {
  type: TryOnType;
  productCount: number;
}

// ============================================================================
// RESPONSE SCHEMAS (for validation)
// ============================================================================

export const imageGenerationResponseSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  revisedPrompt: z.string().optional(),
  model: z.string(),
  latencyMs: z.number(),
});

export const moodboardCompositionResponseSchema = imageGenerationResponseSchema.extend({
  productCount: z.number().min(1),
  arrangement: z.string(),
});

export const virtualTryOnResponseSchema = imageGenerationResponseSchema.extend({
  type: z.enum(['clothing', 'accessory', 'furniture', 'decor']),
  productCount: z.number().min(1),
});
