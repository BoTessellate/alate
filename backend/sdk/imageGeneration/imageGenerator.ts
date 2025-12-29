/**
 * Image Generation SDK for Mood Layer
 *
 * Uses OpenAI GPT-image-1.5 for:
 * - AI-powered moodboard composition (replacing algorithmic layouts)
 * - Virtual try-on for clothing and furniture
 * - Product background removal
 * - Custom background generation
 */

import OpenAI from 'openai';
import axios from 'axios';
import { createModuleLogger, logApiCall } from '../shared/logger';
import { ExternalServiceError, ConfigurationError, ValidationError } from '../shared/errors';
import {
  ImageGenerationConfig,
  ImageInput,
  ImageSize,
  ImageQuality,
  MoodboardCompositionInput,
  MoodboardCompositionResponse,
  VirtualTryOnInput,
  VirtualTryOnResponse,
  TryOnType,
  ImageGenerationResponse,
} from './types';

const logger = createModuleLogger('imageGenerator');

// ============================================================================
// PROMPTS
// ============================================================================

const MOODBOARD_COMPOSITION_PROMPT = `Create a cohesive, professionally styled moodboard composition from these product images.

Requirements:
- Arrange products in a visually pleasing {arrangement} layout
- Style: {style}
- Mood: {mood}
- Preserve product visibility and natural appearance
- Use consistent lighting across all products
- Ensure high visual harmony between items
- Create a magazine-quality editorial look
- No text, watermarks, or logos

The composition should look like a curated designer moodboard with thoughtful spacing and visual flow.`;

const CLOTHING_TRYON_PROMPT = `Edit the image to dress the person using the provided clothing items.

CRITICAL - Do not change:
- Face, facial features, skin tone
- Body shape, pose, proportions
- Hair and expression
- Background and environment
- Camera angle and framing

Replace ONLY the clothing:
- Fit garments naturally to the existing pose
- Realistic fabric behavior (draping, folds, creases)
- Match lighting, shadows, and color temperature to original photo
- Photorealistic integration

Do not add accessories, text, logos, or watermarks.`;

const FURNITURE_TRYON_PROMPT = `Edit the image to place the furniture/decor item in the room.

CRITICAL - Do not change:
- Room structure, walls, floor, ceiling
- Existing furniture positions
- Lighting sources and quality
- Camera angle and perspective

Replace/add ONLY the specified item:
- Scale appropriately to room dimensions
- Realistic shadows and reflections
- Match room's lighting and color temperature
- Natural integration with existing decor

Do not add text, logos, or watermarks.`;

const PRODUCT_EXTRACTION_PROMPT = `Extract the product from the input image.

Output requirements:
- Transparent background (RGBA PNG)
- Crisp, clean silhouette with no halos or fringing
- Preserve product geometry and proportions exactly
- Keep all labels and text perfectly legible
- Optional: subtle, realistic contact shadow in alpha channel

Do not restyle, recolor, or modify the product in any way.`;

const BACKGROUND_GENERATION_PROMPT = `Generate a clean, minimal background suitable for a {theme} moodboard.

Style requirements:
- Color scheme: {colors}
- Mood: {mood}
- Subtle texture or gradient
- No patterns that compete with product images
- Professional, editorial quality

The background should complement products placed on it without distraction.`;

// ============================================================================
// IMAGE GENERATOR CLASS
// ============================================================================

export class ImageGenerator {
  private openai: OpenAI;
  private defaultSize: ImageSize;
  private defaultQuality: ImageQuality;

  constructor(config: ImageGenerationConfig) {
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new ConfigurationError(
        'OpenAI API key is required for image generation. Set OPENAI_API_KEY environment variable.'
      );
    }

    this.openai = new OpenAI({ apiKey });
    this.defaultSize = config.defaultSize || '1024x1024';
    this.defaultQuality = config.defaultQuality || 'high';

    logger.info(
      {
        defaultSize: this.defaultSize,
        defaultQuality: this.defaultQuality,
      },
      'Image generator initialized'
    );
  }

  /**
   * Compose a moodboard from multiple product images using AI
   * This replaces the algorithmic layout system with intelligent composition
   */
  async composeMoodboard(input: MoodboardCompositionInput): Promise<MoodboardCompositionResponse> {
    const startTime = Date.now();

    if (input.productImages.length === 0) {
      throw new ValidationError('At least one product image is required');
    }

    if (input.productImages.length > 10) {
      throw new ValidationError('Maximum 10 product images allowed per moodboard');
    }

    try {
      // Convert images to format OpenAI expects
      const imageFiles = await this.prepareImages(input.productImages);

      // Build the prompt
      const prompt = MOODBOARD_COMPOSITION_PROMPT
        .replace('{arrangement}', input.arrangement || 'balanced')
        .replace('{style}', input.style?.aesthetic || 'modern, minimalist')
        .replace('{mood}', input.mood || 'sophisticated and curated');

      logger.info(
        { productCount: input.productImages.length, arrangement: input.arrangement },
        'Composing moodboard with AI'
      );

      // Call OpenAI image edit API
      const response = await this.openai.images.edit({
        model: 'gpt-image-1',
        image: imageFiles,
        prompt,
        size: input.canvasSize || this.defaultSize,
      });

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'openai', 'images.edit', startTime, true, {
        productCount: input.productImages.length,
      });

      const imageData = response.data?.[0];
      return {
        imageBase64: imageData?.b64_json,
        imageUrl: imageData?.url,
        revisedPrompt: imageData?.revised_prompt,
        model: 'gpt-image-1',
        latencyMs,
        productCount: input.productImages.length,
        arrangement: input.arrangement || 'balanced',
      };
    } catch (error: any) {
      logApiCall(logger, 'openai', 'images.edit', startTime, false, {
        error: error.message,
      });
      throw new ExternalServiceError('OpenAI Image Generation', error.message, error);
    }
  }

  /**
   * Virtual try-on for clothing or furniture
   * Supports both person + clothing and room + furniture
   */
  async virtualTryOn(input: VirtualTryOnInput): Promise<VirtualTryOnResponse> {
    const startTime = Date.now();

    if (input.productImages.length === 0) {
      throw new ValidationError('At least one product image is required');
    }

    try {
      // Prepare all images (base + products)
      const allImages = [input.baseImage, ...input.productImages];
      const imageFiles = await this.prepareImages(allImages);

      // Select appropriate prompt based on type
      const prompt = this.getTryOnPrompt(input.type);

      logger.info(
        { type: input.type, productCount: input.productImages.length },
        'Starting virtual try-on'
      );

      // Call OpenAI image edit API
      const response = await this.openai.images.edit({
        model: 'gpt-image-1',
        image: imageFiles,
        prompt,
        size: this.defaultSize,
      });

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'openai', 'images.edit', startTime, true, {
        type: input.type,
        productCount: input.productImages.length,
      });

      const imageData = response.data?.[0];
      return {
        imageBase64: imageData?.b64_json,
        imageUrl: imageData?.url,
        revisedPrompt: imageData?.revised_prompt,
        model: 'gpt-image-1',
        latencyMs,
        type: input.type,
        productCount: input.productImages.length,
      };
    } catch (error: any) {
      logApiCall(logger, 'openai', 'images.edit', startTime, false, {
        error: error.message,
      });
      throw new ExternalServiceError('OpenAI Image Generation', error.message, error);
    }
  }

  /**
   * Extract product from background (create transparent PNG)
   */
  async extractProduct(image: ImageInput): Promise<ImageGenerationResponse> {
    const startTime = Date.now();

    try {
      const imageFiles = await this.prepareImages([image]);

      const response = await this.openai.images.edit({
        model: 'gpt-image-1',
        image: imageFiles,
        prompt: PRODUCT_EXTRACTION_PROMPT,
        size: this.defaultSize,
      });

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'openai', 'images.edit', startTime, true);

      const imageData = response.data?.[0];
      return {
        imageBase64: imageData?.b64_json,
        imageUrl: imageData?.url,
        model: 'gpt-image-1',
        latencyMs,
      };
    } catch (error: any) {
      logApiCall(logger, 'openai', 'images.edit', startTime, false, {
        error: error.message,
      });
      throw new ExternalServiceError('OpenAI Image Generation', error.message, error);
    }
  }

  /**
   * Generate a custom background for moodboards
   */
  async generateBackground(
    theme: string,
    colors: string[],
    mood: string
  ): Promise<ImageGenerationResponse> {
    const startTime = Date.now();

    try {
      const prompt = BACKGROUND_GENERATION_PROMPT
        .replace('{theme}', theme)
        .replace('{colors}', colors.join(', '))
        .replace('{mood}', mood);

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: this.defaultSize,
        quality: this.defaultQuality,
        n: 1,
      });

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'openai', 'images.generate', startTime, true);

      const imageData = response.data?.[0];
      return {
        imageBase64: imageData?.b64_json,
        imageUrl: imageData?.url,
        revisedPrompt: imageData?.revised_prompt,
        model: 'gpt-image-1',
        latencyMs,
      };
    } catch (error: any) {
      logApiCall(logger, 'openai', 'images.generate', startTime, false, {
        error: error.message,
      });
      throw new ExternalServiceError('OpenAI Image Generation', error.message, error);
    }
  }

  /**
   * Helper: Get appropriate prompt for try-on type
   */
  private getTryOnPrompt(type: TryOnType): string {
    switch (type) {
      case 'clothing':
      case 'accessory':
        return CLOTHING_TRYON_PROMPT;
      case 'furniture':
      case 'decor':
        return FURNITURE_TRYON_PROMPT;
      default:
        return CLOTHING_TRYON_PROMPT;
    }
  }

  /**
   * Helper: Convert ImageInput[] to format OpenAI expects
   * OpenAI images.edit accepts File objects or base64
   */
  private async prepareImages(images: ImageInput[]): Promise<any[]> {
    const prepared: any[] = [];

    for (const image of images) {
      if (image.buffer) {
        // Already have buffer, convert to file-like object
        prepared.push(image.buffer);
      } else if (image.base64) {
        // Convert base64 to buffer
        const buffer = Buffer.from(image.base64, 'base64');
        prepared.push(buffer);
      } else if (image.url) {
        // Fetch image from URL
        try {
          const response = await axios.get(image.url, {
            responseType: 'arraybuffer',
            timeout: 10000,
          });
          prepared.push(Buffer.from(response.data));
        } catch (error: any) {
          throw new ExternalServiceError(
            'Image Fetch',
            `Failed to fetch image from URL: ${image.url}`,
            error
          );
        }
      } else {
        throw new ValidationError('Image must have url, base64, or buffer');
      }
    }

    return prepared;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an image generator with environment variables
 */
export function createImageGenerator(config?: Partial<ImageGenerationConfig>): ImageGenerator {
  return new ImageGenerator({
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    defaultSize: config?.defaultSize,
    defaultQuality: config?.defaultQuality,
  });
}
