/**
 * Vision AI Analyzer
 *
 * Analyzes product images to provide intelligent layout recommendations.
 * Uses Claude Vision (primary) or GPT-4V (fallback) to understand:
 * - Product visual weight and prominence
 * - Color harmony and relationships
 * - Optimal placement zones
 * - Scale and rotation suggestions
 *
 * Integrates with the layout generator to improve aesthetic outcomes.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  LayoutArchetypeName,
  VisionLayoutHint,
  VisionLayoutAnalysis,
  BoundingBox
} from '../layoutGenerator/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductAnalysisInput {
  id: string;
  imageBase64: string;
  brand?: string;
  category?: string;
}

export interface VisionAnalyzerConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  preferredProvider?: 'claude' | 'openai';
  model?: string;
}

interface AnalysisResponse {
  products: Array<{
    id: string;
    visualWeight: number;
    isFocalPoint: boolean;
    suggestedScale: number;
    suggestedRotation: number;
    placementZone: number;
    dominantColors: string[];
  }>;
  recommendedArchetype: LayoutArchetypeName;
  aestheticScore: number;
  suggestedAspectRatio: number;
  layoutNotes: string;
}

// =============================================================================
// VISION ANALYZER CLASS
// =============================================================================

export class VisionAnalyzer {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private preferredProvider: 'claude' | 'openai';
  private model: string;

  constructor(config: VisionAnalyzerConfig = {}) {
    const anthropicKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    this.preferredProvider = config.preferredProvider || 'claude';
    this.model = config.model || 'claude-opus-4-5-20251101';

    if (!this.anthropic && !this.openai) {
      console.warn('[VisionAnalyzer] No AI provider configured');
    }
  }

  /**
   * Analyze product images and return layout recommendations
   */
  async analyzeProducts(products: ProductAnalysisInput[]): Promise<VisionLayoutAnalysis> {
    if (products.length === 0) {
      return this.getDefaultAnalysis();
    }

    try {
      // Try preferred provider first
      if (this.preferredProvider === 'claude' && this.anthropic) {
        return await this.analyzeWithClaude(products);
      } else if (this.openai) {
        return await this.analyzeWithOpenAI(products);
      }

      // Fallback to available provider
      if (this.anthropic) {
        return await this.analyzeWithClaude(products);
      } else if (this.openai) {
        return await this.analyzeWithOpenAI(products);
      }

      return this.getDefaultAnalysis();
    } catch (error: any) {
      console.error('[VisionAnalyzer] Analysis failed:', error.message);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Analyze with Claude Vision
   */
  private async analyzeWithClaude(products: ProductAnalysisInput[]): Promise<VisionLayoutAnalysis> {
    if (!this.anthropic) {
      throw new Error('Claude not configured');
    }

    const imageContent = products.map((p, i) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: p.imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    }));

    const prompt = this.buildAnalysisPrompt(products);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return this.parseAnalysisResponse(textContent.text, products);
  }

  /**
   * Analyze with OpenAI Vision
   */
  private async analyzeWithOpenAI(products: ProductAnalysisInput[]): Promise<VisionLayoutAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const imageContent = products.map((p) => ({
      type: 'image_url' as const,
      image_url: {
        url: p.imageBase64.startsWith('data:')
          ? p.imageBase64
          : `data:image/jpeg;base64,${p.imageBase64}`,
      },
    }));

    const prompt = this.buildAnalysisPrompt(products);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAnalysisResponse(text, products);
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(products: ProductAnalysisInput[]): string {
    const productList = products.map((p, i) =>
      `Product ${i + 1} (ID: ${p.id})${p.brand ? ` - ${p.brand}` : ''}${p.category ? ` (${p.category})` : ''}`
    ).join('\n');

    return `Analyze these ${products.length} product images for moodboard layout composition.

Products:
${productList}

For each product, evaluate:
1. Visual weight (0-1): How visually prominent is this product? Consider size, color intensity, detail complexity.
2. Focal point potential (true/false): Should this be a hero/focus item?
3. Suggested scale (0.5-1.5): Relative size recommendation for the layout.
4. Suggested rotation (-15 to 15): Degrees of rotation for dynamic feel (0 for formal products).
5. Placement zone (0-8): Best position (0=top-left, 4=center, 8=bottom-right).
6. Dominant colors: 2-3 hex colors from the product.

Also determine:
- Recommended archetype: One of Minimal, Hero, Dynamic, or Collage
  - Minimal: 2-4 products, clean luxury aesthetic
  - Hero: 3-6 products, clear focal point needed
  - Dynamic: 3-8 products, editorial/fashion feel
  - Collage: 4-12 products, creative/casual
- Overall aesthetic score (0-100): How well do these products work together?
- Suggested aspect ratio: 0.75 (portrait), 1.0 (square), or 1.33 (landscape)
- Layout notes: Brief suggestion for arranging these products

Respond in JSON format:
{
  "products": [
    {
      "id": "product-id",
      "visualWeight": 0.8,
      "isFocalPoint": true,
      "suggestedScale": 1.2,
      "suggestedRotation": 0,
      "placementZone": 4,
      "dominantColors": ["#2C2416", "#E8D9B8"]
    }
  ],
  "recommendedArchetype": "Hero",
  "aestheticScore": 75,
  "suggestedAspectRatio": 1.0,
  "layoutNotes": "The leather bag should be the hero, with accessories arranged around it."
}`;
  }

  /**
   * Parse the AI response into structured analysis
   */
  private parseAnalysisResponse(
    text: string,
    products: ProductAnalysisInput[]
  ): VisionLayoutAnalysis {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                        text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[VisionAnalyzer] Could not parse JSON response');
        return this.getDefaultAnalysis();
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const data: AnalysisResponse = JSON.parse(jsonStr);

      // Build product hints map
      const productHints = new Map<string, VisionLayoutHint>();

      for (const product of data.products) {
        productHints.set(product.id, {
          visualWeight: Math.max(0, Math.min(1, product.visualWeight || 0.5)),
          placementZone: Math.max(0, Math.min(8, product.placementZone || 4)),
          scaleFactor: Math.max(0.5, Math.min(1.5, product.suggestedScale || 1.0)),
          isFocalPoint: product.isFocalPoint || false,
          suggestedRotation: Math.max(-15, Math.min(15, product.suggestedRotation || 0)),
        });
      }

      // Validate archetype
      const validArchetypes: LayoutArchetypeName[] = ['Minimal', 'Hero', 'Dynamic', 'Collage'];
      const archetype = validArchetypes.includes(data.recommendedArchetype as LayoutArchetypeName)
        ? data.recommendedArchetype as LayoutArchetypeName
        : this.getDefaultArchetype(products.length);

      return {
        aestheticScore: Math.max(0, Math.min(100, data.aestheticScore || 50)),
        productHints,
        recommendedArchetype: archetype,
        suggestedAspectRatio: Math.max(0.5, Math.min(2, data.suggestedAspectRatio || 1.0)),
        avoidanceZones: [],
      };
    } catch (error: any) {
      console.error('[VisionAnalyzer] Failed to parse response:', error.message);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Get default analysis when AI is unavailable
   */
  private getDefaultAnalysis(): VisionLayoutAnalysis {
    return {
      aestheticScore: 50,
      productHints: new Map(),
      recommendedArchetype: 'Dynamic',
      suggestedAspectRatio: 1.0,
      avoidanceZones: [],
    };
  }

  /**
   * Get default archetype based on product count
   */
  private getDefaultArchetype(count: number): LayoutArchetypeName {
    if (count <= 3) return 'Minimal';
    if (count <= 5) return 'Hero';
    if (count <= 8) return 'Dynamic';
    return 'Collage';
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a Vision Analyzer instance
 */
export function createVisionAnalyzer(config?: VisionAnalyzerConfig): VisionAnalyzer {
  return new VisionAnalyzer(config);
}

/**
 * Quick analysis helper - analyzes products and returns layout hints
 */
export async function analyzeProductsForLayout(
  products: ProductAnalysisInput[],
  config?: VisionAnalyzerConfig
): Promise<VisionLayoutAnalysis> {
  const analyzer = createVisionAnalyzer(config);
  return analyzer.analyzeProducts(products);
}
