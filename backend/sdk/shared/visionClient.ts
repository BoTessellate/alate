/**
 * Vision Model Proxy Layer for Mood Layer SDK
 *
 * Provides a unified interface for vision AI operations using:
 * - GPT-4 Vision (OpenAI) for image analysis
 * - Claude (Anthropic) as fallback for text-based analysis
 *
 * Use cases:
 * - Product image analysis
 * - Color palette extraction
 * - Style/aesthetic classification
 * - Visual similarity detection
 * - Layout analysis
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createModuleLogger, logApiCall } from './logger';
import { ExternalServiceError, ConfigurationError, ValidationError } from './errors';
import { z } from 'zod';

const logger = createModuleLogger('visionClient');

// ============================================================================
// TYPES
// ============================================================================

export interface VisionConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  defaultModel?: VisionModel;
  maxTokens?: number;
  temperature?: number;
}

export type VisionModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';

export interface ImageInput {
  url?: string;
  base64?: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface VisionResponse<T = unknown> {
  result: T;
  model: VisionModel;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const colorPaletteResponseSchema = z.object({
  colors: z.array(z.object({
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    name: z.string(),
    percentage: z.number().min(0).max(100).optional(),
  })).min(1).max(10),
  dominantColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  mood: z.string(),
  contrast: z.enum(['low', 'medium', 'high']),
});

export type ColorPaletteResponse = z.infer<typeof colorPaletteResponseSchema>;

export const productAnalysisResponseSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  material: z.string(),
  texture: z.string(),
  style: z.array(z.string()),
  colors: z.array(z.string()),
  tags: z.array(z.string()),
  suggestedPrice: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }).optional(),
  quality: z.enum(['budget', 'mid-range', 'premium', 'luxury']),
  seasonality: z.array(z.enum(['spring', 'summer', 'fall', 'winter', 'all-season'])),
});

export type ProductAnalysisResponse = z.infer<typeof productAnalysisResponseSchema>;

export const layoutAnalysisResponseSchema = z.object({
  composition: z.enum(['symmetrical', 'asymmetrical', 'radial', 'grid', 'organic']),
  balance: z.enum(['balanced', 'left-heavy', 'right-heavy', 'top-heavy', 'bottom-heavy']),
  focalPoint: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }).optional(),
  whitespace: z.enum(['minimal', 'moderate', 'generous']),
  density: z.enum(['sparse', 'moderate', 'dense']),
  suggestions: z.array(z.string()),
});

export type LayoutAnalysisResponse = z.infer<typeof layoutAnalysisResponseSchema>;

export const styleMatchResponseSchema = z.object({
  similarityScore: z.number().min(0).max(1),
  matchingElements: z.array(z.string()),
  conflictingElements: z.array(z.string()),
  overallHarmony: z.enum(['harmonious', 'complementary', 'contrasting', 'clashing']),
  recommendations: z.array(z.string()),
});

export type StyleMatchResponse = z.infer<typeof styleMatchResponseSchema>;

// ============================================================================
// VISION CLIENT CLASS
// ============================================================================

export class VisionClient {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private defaultModel: VisionModel;
  private maxTokens: number;
  private temperature: number;

  constructor(config: VisionConfig) {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }

    if (!this.openai && !this.anthropic) {
      throw new ConfigurationError(
        'At least one API key (OpenAI or Anthropic) must be provided'
      );
    }

    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 1024;
    this.temperature = config.temperature || 0.3;

    logger.info(
      {
        hasOpenAI: !!this.openai,
        hasAnthropic: !!this.anthropic,
        defaultModel: this.defaultModel,
      },
      'Vision client initialized'
    );
  }

  /**
   * Analyze an image with a custom prompt
   */
  async analyze<T>(
    image: ImageInput,
    prompt: string,
    options: {
      model?: VisionModel;
      schema?: z.ZodType<T>;
      maxTokens?: number;
    } = {}
  ): Promise<VisionResponse<T>> {
    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const result = model.startsWith('gpt')
        ? await this.analyzeWithOpenAI(image, prompt, model, options.maxTokens)
        : await this.analyzeWithClaude(image, prompt, model, options.maxTokens);

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'vision', 'analyze', startTime, true, { model });

      // Parse and validate result if schema provided
      let parsedResult: T;
      if (options.schema) {
        try {
          const jsonMatch = result.text.match(/```json\n?([\s\S]*?)\n?```/) ||
            result.text.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.text;
          parsedResult = options.schema.parse(JSON.parse(jsonStr));
        } catch (parseError: any) {
          throw new ValidationError(
            `Failed to parse vision response: ${parseError.message}`,
            [result.text]
          );
        }
      } else {
        parsedResult = result.text as T;
      }

      return {
        result: parsedResult,
        model,
        usage: result.usage,
        latencyMs,
      };
    } catch (error: any) {
      logApiCall(logger, 'vision', 'analyze', startTime, false, { model, error: error.message });
      throw error;
    }
  }

  /**
   * Extract color palette from an image
   */
  async extractColors(image: ImageInput): Promise<VisionResponse<ColorPaletteResponse>> {
    const prompt = `Analyze this image and extract its color palette.

Return a JSON object with:
- colors: Array of colors found (hex code, name, approximate percentage)
- dominantColor: The most prominent color (hex)
- mood: The overall mood/feeling of the color scheme (e.g., "warm and inviting", "cool and minimal")
- contrast: Level of contrast (low/medium/high)

Return ONLY valid JSON, no explanation.`;

    return this.analyze(image, prompt, { schema: colorPaletteResponseSchema });
  }

  /**
   * Analyze a product image
   */
  async analyzeProduct(image: ImageInput): Promise<VisionResponse<ProductAnalysisResponse>> {
    const prompt = `Analyze this product image for an e-commerce moodboard application.

Return a JSON object with:
- category: Product category (e.g., "furniture", "decor", "textile")
- subcategory: More specific category
- material: Primary material
- texture: Texture description (one word)
- style: Array of style tags (e.g., ["modern", "minimalist", "scandinavian"])
- colors: Array of main colors (names, not hex)
- tags: 5-8 descriptive tags for search
- suggestedPrice: { min, max, currency } price range estimate (optional)
- quality: Perceived quality tier (budget/mid-range/premium/luxury)
- seasonality: Array of seasons this item fits

Return ONLY valid JSON, no explanation.`;

    return this.analyze(image, prompt, { schema: productAnalysisResponseSchema });
  }

  /**
   * Analyze layout/composition of a moodboard
   */
  async analyzeLayout(image: ImageInput): Promise<VisionResponse<LayoutAnalysisResponse>> {
    const prompt = `Analyze this moodboard or design layout image.

Return a JSON object with:
- composition: Type of composition (symmetrical/asymmetrical/radial/grid/organic)
- balance: Visual balance assessment
- focalPoint: { x, y } normalized coordinates (0-1) of the focal point, if any
- whitespace: Amount of whitespace (minimal/moderate/generous)
- density: Visual density (sparse/moderate/dense)
- suggestions: 2-3 suggestions for improving the layout

Return ONLY valid JSON, no explanation.`;

    return this.analyze(image, prompt, { schema: layoutAnalysisResponseSchema });
  }

  /**
   * Check style compatibility between images
   */
  async checkStyleMatch(
    image1: ImageInput,
    image2: ImageInput
  ): Promise<VisionResponse<StyleMatchResponse>> {
    // For style matching, we use a multi-image prompt
    const prompt = `Compare these two product/design images for style compatibility in a moodboard context.

Return a JSON object with:
- similarityScore: 0-1 score of how well they match stylistically
- matchingElements: List of elements that work well together
- conflictingElements: List of elements that clash
- overallHarmony: Overall assessment (harmonious/complementary/contrasting/clashing)
- recommendations: 2-3 suggestions for making them work better together

Return ONLY valid JSON, no explanation.`;

    // Multi-image analysis requires OpenAI
    if (!this.openai) {
      throw new ConfigurationError('Multi-image analysis requires OpenAI API key');
    }

    const startTime = Date.now();

    try {
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: 'text', text: prompt },
      ];

      // Add first image
      if (image1.url) {
        content.push({ type: 'image_url', image_url: { url: image1.url } });
      } else if (image1.base64) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${image1.mimeType || 'image/jpeg'};base64,${image1.base64}` },
        });
      }

      // Add second image
      if (image2.url) {
        content.push({ type: 'image_url', image_url: { url: image2.url } });
      } else if (image2.base64) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${image2.mimeType || 'image/jpeg'};base64,${image2.base64}` },
        });
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const text = response.choices[0]?.message?.content || '';
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const parsed = styleMatchResponseSchema.parse(JSON.parse(jsonStr));

      const latencyMs = Date.now() - startTime;
      logApiCall(logger, 'vision', 'checkStyleMatch', startTime, true);

      return {
        result: parsed,
        model: 'gpt-4o',
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        latencyMs,
      };
    } catch (error: any) {
      logApiCall(logger, 'vision', 'checkStyleMatch', startTime, false, { error: error.message });
      throw new ExternalServiceError('OpenAI Vision', error.message, error);
    }
  }

  /**
   * Internal: Analyze with OpenAI
   */
  private async analyzeWithOpenAI(
    image: ImageInput,
    prompt: string,
    model: string,
    maxTokens?: number
  ): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
    if (!this.openai) {
      throw new ConfigurationError('OpenAI API key not configured');
    }

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
    ];

    if (image.url) {
      content.push({ type: 'image_url', image_url: { url: image.url } });
    } else if (image.base64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}` },
      });
    } else {
      throw new ValidationError('Image URL or base64 data required');
    }

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: maxTokens || this.maxTokens,
      temperature: this.temperature,
    });

    return {
      text: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Internal: Analyze with Claude
   */
  private async analyzeWithClaude(
    image: ImageInput,
    prompt: string,
    model: string,
    maxTokens?: number
  ): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
    if (!this.anthropic) {
      throw new ConfigurationError('Anthropic API key not configured');
    }

    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    if (image.url) {
      // Claude requires base64 for images, so we'd need to fetch the URL
      // For now, throw an error suggesting to use base64
      throw new ValidationError(
        'Claude vision requires base64 image data. Use image.base64 instead of image.url'
      );
    } else if (image.base64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mimeType || 'image/jpeg',
          data: image.base64,
        },
      });
    } else {
      throw new ValidationError('Image base64 data required for Claude');
    }

    content.push({ type: 'text', text: prompt });

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens || this.maxTokens,
      messages: [{ role: 'user', content }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a vision client with environment variables
 */
export function createVisionClient(config?: Partial<VisionConfig>): VisionClient {
  return new VisionClient({
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    defaultModel: config?.defaultModel,
    maxTokens: config?.maxTokens,
    temperature: config?.temperature,
  });
}
