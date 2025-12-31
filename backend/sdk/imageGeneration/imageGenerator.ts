/**
 * Image Generation SDK for Mood Layer
 *
 * Uses OpenAI GPT-image-1 (primary) with Gemini fallback for:
 * - AI-powered moodboard composition (replacing algorithmic layouts)
 * - Product background removal
 * - Custom background generation
 *
 * Virtual try-on uses Gemini (primary) with OpenAI fallback for better results
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  private openai: OpenAI | null;
  private gemini: GoogleGenerativeAI | null;
  private defaultSize: ImageSize;
  private defaultQuality: ImageQuality;
  private geminiModel: string;

  constructor(config: ImageGenerationConfig) {
    const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

    // Initialize OpenAI if available
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    } else {
      this.openai = null;
      logger.warn('OpenAI API key not provided - OpenAI image gen disabled');
    }

    // Initialize Gemini if available
    if (geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(geminiApiKey);
    } else {
      this.gemini = null;
      logger.warn('Gemini API key not provided - Gemini image gen disabled');
    }

    // Ensure at least one provider is available
    if (!this.openai && !this.gemini) {
      throw new ConfigurationError(
        'At least one AI provider (OpenAI or Gemini) must be configured for image generation.'
      );
    }

    this.defaultSize = config.defaultSize || '1024x1024';
    this.defaultQuality = config.defaultQuality || 'high';
    this.geminiModel = config.geminiModel || process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

    logger.info(
      {
        defaultSize: this.defaultSize,
        defaultQuality: this.defaultQuality,
        hasOpenAI: !!this.openai,
        hasGemini: !!this.gemini,
      },
      'Image generator initialized'
    );
  }

  /**
   * Compose a moodboard from multiple product images using AI
   * OpenAI primary, Gemini fallback
   */
  async composeMoodboard(input: MoodboardCompositionInput): Promise<MoodboardCompositionResponse> {
    const startTime = Date.now();

    if (input.productImages.length === 0) {
      throw new ValidationError('At least one product image is required');
    }

    if (input.productImages.length > 10) {
      throw new ValidationError('Maximum 10 product images allowed per moodboard');
    }

    // Build the prompt
    const prompt = MOODBOARD_COMPOSITION_PROMPT
      .replace('{arrangement}', input.arrangement || 'balanced')
      .replace('{style}', input.style?.aesthetic || 'modern, minimalist')
      .replace('{mood}', input.mood || 'sophisticated and curated');

    logger.info(
      { productCount: input.productImages.length, arrangement: input.arrangement },
      'Composing moodboard with AI'
    );

    // Try OpenAI first if available
    if (this.openai) {
      try {
        const imageFiles = await this.prepareImages(input.productImages);

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
      } catch (openaiError: any) {
        logger.warn({ error: openaiError.message }, 'OpenAI moodboard failed, trying Gemini fallback');
        logApiCall(logger, 'openai', 'images.edit', startTime, false, {
          error: openaiError.message,
        });
      }
    }

    // Gemini fallback
    if (this.gemini) {
      return await this.composeMoodboardWithGemini(input, prompt, startTime);
    }

    throw new ExternalServiceError('Image Generation', 'All providers failed for moodboard composition');
  }

  /**
   * Compose moodboard using Gemini (fallback)
   */
  private async composeMoodboardWithGemini(
    input: MoodboardCompositionInput,
    prompt: string,
    startTime: number
  ): Promise<MoodboardCompositionResponse> {
    if (!this.gemini) {
      throw new ConfigurationError('Gemini not configured');
    }

    try {
      const model = this.gemini.getGenerativeModel({ model: this.geminiModel });

      // Prepare images as inline data for Gemini
      const imageParts = await this.prepareImagesForGemini(input.productImages);

      const result = await model.generateContent([
        prompt,
        ...imageParts,
      ]);

      const response = await result.response;
      const latencyMs = Date.now() - startTime;

      logApiCall(logger, 'gemini', 'generateContent', startTime, true, {
        productCount: input.productImages.length,
      });

      // Extract image from Gemini response
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if ('inlineData' in part && part.inlineData) {
            return {
              imageBase64: part.inlineData.data,
              model: this.geminiModel,
              latencyMs,
              productCount: input.productImages.length,
              arrangement: input.arrangement || 'balanced',
            };
          }
        }
      }

      throw new Error('Gemini did not return an image');
    } catch (error: any) {
      logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
        error: error.message,
      });
      throw new ExternalServiceError('Gemini Image Generation', error.message, error);
    }
  }

  /**
   * Virtual try-on for clothing or furniture
   * Gemini primary, OpenAI fallback (Gemini has better try-on results)
   */
  async virtualTryOn(input: VirtualTryOnInput): Promise<VirtualTryOnResponse> {
    const startTime = Date.now();

    if (input.productImages.length === 0) {
      throw new ValidationError('At least one product image is required');
    }

    // Select appropriate prompt based on type
    const prompt = this.getTryOnPrompt(input.type);

    logger.info(
      { type: input.type, productCount: input.productImages.length },
      'Starting virtual try-on'
    );

    // Try Gemini first for try-on (primary)
    if (this.gemini) {
      try {
        return await this.virtualTryOnWithGemini(input, prompt, startTime);
      } catch (geminiError: any) {
        logger.warn({ error: geminiError.message }, 'Gemini try-on failed, trying OpenAI fallback');
        logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
          error: geminiError.message,
        });
      }
    }

    // OpenAI fallback for try-on
    if (this.openai) {
      try {
        const allImages = [input.baseImage, ...input.productImages];
        const imageFiles = await this.prepareImages(allImages);

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
          model: 'gpt-image-1 (fallback)',
          latencyMs,
          type: input.type,
          productCount: input.productImages.length,
        };
      } catch (openaiError: any) {
        logApiCall(logger, 'openai', 'images.edit', startTime, false, {
          error: openaiError.message,
        });
      }
    }

    throw new ExternalServiceError('Virtual Try-On', 'All providers failed for virtual try-on');
  }

  /**
   * Virtual try-on using Gemini (primary)
   */
  private async virtualTryOnWithGemini(
    input: VirtualTryOnInput,
    prompt: string,
    startTime: number
  ): Promise<VirtualTryOnResponse> {
    if (!this.gemini) {
      throw new ConfigurationError('Gemini not configured');
    }

    const model = this.gemini.getGenerativeModel({ model: this.geminiModel });

    // Prepare all images (base + products) for Gemini
    const allImages = [input.baseImage, ...input.productImages];
    const imageParts = await this.prepareImagesForGemini(allImages);

    const result = await model.generateContent([
      prompt,
      ...imageParts,
    ]);

    const response = await result.response;
    const latencyMs = Date.now() - startTime;

    logApiCall(logger, 'gemini', 'generateContent', startTime, true, {
      type: input.type,
      productCount: input.productImages.length,
    });

    // Extract image from Gemini response
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if ('inlineData' in part && part.inlineData) {
          return {
            imageBase64: part.inlineData.data,
            model: this.geminiModel,
            latencyMs,
            type: input.type,
            productCount: input.productImages.length,
          };
        }
      }
    }

    throw new Error('Gemini did not return an image for try-on');
  }

  /**
   * Extract product from background (create transparent PNG)
   * OpenAI primary, Gemini fallback
   */
  async extractProduct(image: ImageInput): Promise<ImageGenerationResponse> {
    const startTime = Date.now();

    // Try OpenAI first
    if (this.openai) {
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
      } catch (openaiError: any) {
        logger.warn({ error: openaiError.message }, 'OpenAI extractProduct failed, trying Gemini');
        logApiCall(logger, 'openai', 'images.edit', startTime, false, {
          error: openaiError.message,
        });
      }
    }

    // Gemini fallback
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({ model: this.geminiModel });
        const imageParts = await this.prepareImagesForGemini([image]);

        const result = await model.generateContent([
          PRODUCT_EXTRACTION_PROMPT,
          ...imageParts,
        ]);

        const response = await result.response;
        const latencyMs = Date.now() - startTime;
        logApiCall(logger, 'gemini', 'generateContent', startTime, true);

        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if ('inlineData' in part && part.inlineData) {
              return {
                imageBase64: part.inlineData.data,
                model: this.geminiModel,
                latencyMs,
              };
            }
          }
        }
        throw new Error('Gemini did not return an image');
      } catch (geminiError: any) {
        logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
          error: geminiError.message,
        });
      }
    }

    throw new ExternalServiceError('Product Extraction', 'All providers failed');
  }

  /**
   * Generate a custom background for moodboards
   * OpenAI primary, Gemini fallback
   */
  async generateBackground(
    theme: string,
    colors: string[],
    mood: string
  ): Promise<ImageGenerationResponse> {
    const startTime = Date.now();

    const prompt = BACKGROUND_GENERATION_PROMPT
      .replace('{theme}', theme)
      .replace('{colors}', colors.join(', '))
      .replace('{mood}', mood);

    // Try OpenAI first
    if (this.openai) {
      try {
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
      } catch (openaiError: any) {
        logger.warn({ error: openaiError.message }, 'OpenAI background gen failed, trying Gemini');
        logApiCall(logger, 'openai', 'images.generate', startTime, false, {
          error: openaiError.message,
        });
      }
    }

    // Gemini fallback
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({ model: this.geminiModel });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const latencyMs = Date.now() - startTime;

        logApiCall(logger, 'gemini', 'generateContent', startTime, true);

        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if ('inlineData' in part && part.inlineData) {
              return {
                imageBase64: part.inlineData.data,
                model: this.geminiModel,
                latencyMs,
              };
            }
          }
        }
        throw new Error('Gemini did not return an image');
      } catch (geminiError: any) {
        logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
          error: geminiError.message,
        });
      }
    }

    throw new ExternalServiceError('Background Generation', 'All providers failed');
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

  /**
   * Helper: Convert ImageInput[] to format Gemini expects
   * Gemini uses inline data with base64 and mimeType
   */
  private async prepareImagesForGemini(images: ImageInput[]): Promise<any[]> {
    const parts: any[] = [];

    for (const image of images) {
      let base64Data: string;
      let mimeType = image.mimeType || 'image/jpeg';

      if (image.buffer) {
        base64Data = image.buffer.toString('base64');
      } else if (image.base64) {
        base64Data = image.base64;
      } else if (image.url) {
        try {
          const response = await axios.get(image.url, {
            responseType: 'arraybuffer',
            timeout: 10000,
          });
          base64Data = Buffer.from(response.data).toString('base64');
          // Try to detect mime type from URL or response
          const contentType = response.headers['content-type'];
          if (contentType) {
            mimeType = contentType.split(';')[0] as any;
          }
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

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    return parts;
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
    geminiApiKey: config?.geminiApiKey || process.env.GEMINI_API_KEY,
    defaultSize: config?.defaultSize,
    defaultQuality: config?.defaultQuality,
    geminiModel: config?.geminiModel,
  });
}
