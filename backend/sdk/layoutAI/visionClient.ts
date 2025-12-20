/**
 * Vision Model Client
 * Integrates with GPT-4V or Claude for visual intelligence
 *
 * Supports two modes:
 * - GPT-4V: For image-based analysis (requires base64 canvas image)
 * - Claude: For text-based layout analysis (uses position metadata)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Configuration
const USE_GPT4V = process.env.USE_GPT4V === 'true';

export interface VisionRequest {
  canvas_size: { width: number; height: number };
  image_positions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    product_name: string;
  }>;
  label_style: {
    font_size: number;
    color: string;
    placement_preference?: 'above' | 'below' | 'beside' | 'auto';
  };
}

// GPT-4V specific input type (includes base64 image)
export type LayoutVisionInput = {
  canvasImage: string; // base64 PNG of full board
  products: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    brand: string;
    price: string;
  }[];
  layoutGoal: string; // e.g. "clean, no label overlap, group at bottom"
};

// GPT-4V specific output type
export type LabelPlacementResult = {
  id: string;
  labelX: number;
  labelY: number;
  fontSize: number;
  style?: 'bold' | 'italic';
  notes?: string;
}[];

export interface VisionResponse {
  success: boolean;
  label_placements: Array<{
    product_name: string;
    position: { x: number; y: number };
    justification: string;
  }>;
}

/**
 * Vision Model Client (using Claude with vision capabilities)
 */
export class VisionClient {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Get smart label placements using vision model
   */
  async getSmartLabelPlacements(request: VisionRequest): Promise<VisionResponse> {
    try {
      const prompt = this.buildVisionPrompt(request);

      const message = await this.anthropic.messages.create({
        model: process.env.LABEL_PLACEMENT_MODEL || 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const placements = this.parseVisionResponse(responseText, request);

      return {
        success: true,
        label_placements: placements
      };

    } catch (error) {
      console.error('Vision model error:', error);
      // Fallback to rule-based placement
      return this.getFallbackPlacements(request);
    }
  }

  /**
   * Build prompt for vision model
   */
  private buildVisionPrompt(request: VisionRequest): string {
    const { canvas_size, image_positions, label_style } = request;

    return `You are a design expert analyzing a moodboard layout.

Canvas dimensions: ${canvas_size.width}x${canvas_size.height}px

Product images positioned at:
${image_positions.map((pos, i) =>
  `${i + 1}. "${pos.product_name}" at (${pos.x}, ${pos.y}), size ${pos.width}x${pos.height}`
).join('\n')}

Label style: ${label_style.font_size}px, color ${label_style.color}, preference: ${label_style.placement_preference || 'auto'}

Task: Determine optimal label placement for each product that:
1. Avoids UNSIGHTLY overlaps with images (artistic/intentional overlaps are OK if they enhance the design)
2. Maintains visual hierarchy and balance
3. Is easily readable with good contrast
4. Follows modern moodboard design best practices (labels can be positioned creatively)
5. Considers the overall aesthetic - some strategic overlaps can create visual interest

Note: Moodboards often have intentional, aesthetic overlaps. Avoid only those overlaps that would:
- Obscure important product details
- Make text unreadable
- Create visual confusion
- Break the design hierarchy

Return ONLY a JSON array in this exact format:
[
  {
    "product_name": "product name",
    "position": { "x": 100, "y": 200 },
    "justification": "brief reason"
  }
]`;
  }

  /**
   * Parse vision model response
   */
  private parseVisionResponse(responseText: string, request: VisionRequest): VisionResponse['label_placements'] {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse vision response:', error);
    }

    // Fallback to rule-based
    return this.getFallbackPlacements(request).label_placements;
  }

  /**
   * Fallback rule-based label placement
   */
  private getFallbackPlacements(request: VisionRequest): VisionResponse {
    const { image_positions, label_style } = request;
    const offset = label_style.font_size + 10;

    const placements = image_positions.map(img => {
      let position: { x: number; y: number };

      switch (label_style.placement_preference) {
        case 'above':
          position = { x: img.x, y: img.y - offset };
          break;
        case 'beside':
          position = { x: img.x + img.width + 20, y: img.y + img.height / 2 };
          break;
        case 'below':
        default:
          position = { x: img.x, y: img.y + img.height + offset };
      }

      return {
        product_name: img.product_name,
        position,
        justification: 'Rule-based placement (vision model unavailable)'
      };
    });

    return {
      success: true,
      label_placements: placements
    };
  }
}

export function createVisionClient(apiKey: string): VisionClient {
  return new VisionClient(apiKey);
}

// =============================================================================
// GPT-4V VISION CLIENT
// =============================================================================

/**
 * GPT-4V Vision Client for image-based label placement
 * Uses actual image analysis for more accurate results
 */
export class GPT4VisionClient {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Get label placements from GPT-4 Vision using actual canvas image
   */
  async getLabelPlacementsFromVision(input: LayoutVisionInput): Promise<LabelPlacementResult> {
    const systemPrompt = `You are a visual layout assistant specializing in moodboard design.
Analyze the provided canvas image and suggest optimal label placements for product brand names and prices.

Rules:
- Labels must not overlap with product images in ways that obscure important details
- Labels must not overlap with each other
- Prefer placing labels below or to the side of products
- Use consistent font sizes for visual harmony
- Consider the overall layout goal provided
- Artistic/intentional overlaps are acceptable if they enhance the design

Return a JSON array with placement suggestions for each product.`;

    const userPrompt = `Layout Goal: ${input.layoutGoal}

Products to label:
${input.products.map((p) => `- ID: ${p.id}, Position: (${p.x}, ${p.y}), Size: ${p.width}x${p.height}, Brand: "${p.brand}", Price: "${p.price}"`).join('\n')}

Analyze the canvas image and provide label placements as a JSON array with this structure:
[
  {
    "id": "product-id",
    "labelX": number,
    "labelY": number,
    "fontSize": number (10-18),
    "style": "bold" | "italic" (optional),
    "notes": "placement reasoning" (optional)
  }
]

Return ONLY the JSON array, no other text.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${input.canvasImage}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4V');
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from GPT-4V response');
      }

      const placements = JSON.parse(jsonMatch[0]) as LabelPlacementResult;

      // Validate and sanitize placements
      return placements.map((p) => ({
        id: String(p.id),
        labelX: Math.round(Number(p.labelX) || 0),
        labelY: Math.round(Number(p.labelY) || 0),
        fontSize: Math.min(18, Math.max(10, Number(p.fontSize) || 14)),
        style: p.style === 'italic' ? 'italic' : p.style === 'bold' ? 'bold' : undefined,
        notes: p.notes ? String(p.notes) : undefined,
      }));
    } catch (error: any) {
      console.error('[GPT4VisionClient] Label placement failed:', error.message);
      // Fallback to mock placements on error
      return this.generateFallbackPlacements(input.products);
    }
  }

  /**
   * Generate fallback placements based on product positions
   */
  private generateFallbackPlacements(products: LayoutVisionInput['products']): LabelPlacementResult {
    return products.map((product) => ({
      id: product.id,
      labelX: product.x + product.width / 2,
      labelY: product.y + product.height + 20,
      fontSize: 14,
      style: 'bold' as const,
      notes: 'fallback: centered below product',
    }));
  }
}

/**
 * Create GPT-4V client instance
 */
export function createGPT4VisionClient(apiKey?: string): GPT4VisionClient {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key required for GPT-4V client');
  }
  return new GPT4VisionClient(key);
}

/**
 * Get label placements - automatically chooses GPT-4V or Claude based on config
 */
export async function getLabelPlacementsFromVision(
  input: LayoutVisionInput,
  options?: { forceGPT4V?: boolean; apiKey?: string }
): Promise<LabelPlacementResult> {
  const useGPT4V = options?.forceGPT4V ?? USE_GPT4V;

  if (useGPT4V) {
    const client = createGPT4VisionClient(options?.apiKey);
    return client.getLabelPlacementsFromVision(input);
  }

  // Fallback to Claude-based client (convert input format)
  const anthropicKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('Anthropic API key required for Claude client');
  }

  const claudeClient = createVisionClient(anthropicKey);
  const visionRequest: VisionRequest = {
    canvas_size: { width: 800, height: 600 }, // Default canvas size
    image_positions: input.products.map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      product_name: p.brand,
    })),
    label_style: {
      font_size: 14,
      color: '#2C2416',
      placement_preference: 'auto',
    },
  };

  const result = await claudeClient.getSmartLabelPlacements(visionRequest);

  // Convert Claude response to GPT-4V format
  return result.label_placements.map((p, i) => ({
    id: input.products[i]?.id || `product-${i}`,
    labelX: p.position.x,
    labelY: p.position.y,
    fontSize: 14,
    style: 'bold' as const,
    notes: p.justification,
  }));
}
