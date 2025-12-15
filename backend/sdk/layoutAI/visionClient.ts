/**
 * Vision Model Client
 * Integrates with GPT-4V or Gemini for visual intelligence
 */

import Anthropic from '@anthropic-ai/sdk';

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
