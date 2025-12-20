/**
 * GPT-4 Vision Aesthetic Scoring Client
 *
 * Analyzes canvas layouts and provides:
 * - A layout quality score (0-10)
 * - Written aesthetic notes
 * - Recommendations for improvement
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Configuration
const USE_GPT4V = process.env.USE_GPT4V === 'true';

// Input types
export type AestheticScoreInput = {
  canvasImage: string; // base64 of full canvas
  layoutIntent: string; // e.g. "clean, modern, symmetric"
};

// Output types
export type AestheticScoreResult = {
  score: number; // 0-10
  notes: string[]; // e.g. ["Too many elements on left", "Nice spacing"]
  summary: string; // One-line summary
  suggestions?: string[]; // Optional improvement suggestions
};

/**
 * GPT-4V Vision Score Client
 * Uses image analysis for accurate aesthetic scoring
 */
export class VisionScoreClient {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Score canvas aesthetics using GPT-4 Vision
   */
  async scoreAesthetics(input: AestheticScoreInput): Promise<AestheticScoreResult> {
    const systemPrompt = `You are an expert visual designer evaluating moodboard layouts.
Analyze the provided canvas image and score its aesthetic quality.

Evaluation criteria:
1. Visual Balance - Are elements well-distributed?
2. Spacing - Is there appropriate whitespace?
3. Alignment - Are elements properly aligned?
4. Hierarchy - Is there clear visual hierarchy?
5. Cohesion - Do elements work together?
6. Label Readability - Are labels clear and well-placed?
7. Overall Impression - Professional and polished appearance?

Be constructive in your feedback.`;

    const userPrompt = `Layout Intent: ${input.layoutIntent}

Analyze this moodboard canvas and provide:
1. A score from 0-10 (be fair but critical)
2. Specific notes about what works and what doesn't
3. A one-line summary
4. Optional suggestions for improvement

Return ONLY a JSON object in this exact format:
{
  "score": 7.5,
  "notes": ["Positive note 1", "Needs improvement: area"],
  "summary": "One sentence summary",
  "suggestions": ["Optional suggestion 1"]
}`;

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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from GPT-4V response');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate and sanitize
      return {
        score: Math.min(10, Math.max(0, Number(result.score) || 5)),
        notes: Array.isArray(result.notes) ? result.notes.map(String) : ['No specific notes'],
        summary: String(result.summary || 'Layout analyzed'),
        suggestions: Array.isArray(result.suggestions) ? result.suggestions.map(String) : undefined,
      };
    } catch (error: any) {
      console.error('[VisionScoreClient] Aesthetic scoring failed:', error.message);
      // Return a neutral fallback score
      return {
        score: 5,
        notes: ['Could not analyze layout - using default score'],
        summary: 'Analysis unavailable',
        suggestions: ['Try again with a clearer image'],
      };
    }
  }
}

/**
 * Claude-based aesthetic scoring (text-based, no image)
 * Used as fallback when GPT-4V is not available
 */
export class ClaudeScoreClient {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Score layout aesthetics using Claude (text-based metadata only)
   */
  async scoreAestheticsFromMetadata(
    layoutMetadata: {
      canvasSize: { width: number; height: number };
      elementCount: number;
      elementTypes: string[];
      labelCount: number;
      imageCount: number;
      averageSpacing?: number;
    },
    layoutIntent: string
  ): Promise<AestheticScoreResult> {
    const prompt = `You are an expert visual designer evaluating a moodboard layout.

Layout metadata:
- Canvas size: ${layoutMetadata.canvasSize.width}x${layoutMetadata.canvasSize.height}
- Total elements: ${layoutMetadata.elementCount}
- Element types: ${layoutMetadata.elementTypes.join(', ')}
- Images: ${layoutMetadata.imageCount}
- Labels: ${layoutMetadata.labelCount}
${layoutMetadata.averageSpacing ? `- Average spacing: ${layoutMetadata.averageSpacing}px` : ''}

Layout intent: ${layoutIntent}

Based on this metadata, estimate the aesthetic quality of this layout.
Consider: balance, spacing, hierarchy, and overall composition.

Return ONLY a JSON object:
{
  "score": 7.5,
  "notes": ["Observation 1", "Observation 2"],
  "summary": "One sentence summary",
  "suggestions": ["Suggestion if score < 7"]
}`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(10, Math.max(0, Number(result.score) || 5)),
          notes: Array.isArray(result.notes) ? result.notes.map(String) : ['Analyzed from metadata'],
          summary: String(result.summary || 'Layout analyzed from metadata'),
          suggestions: Array.isArray(result.suggestions) ? result.suggestions.map(String) : undefined,
        };
      }

      throw new Error('Could not parse response');
    } catch (error: any) {
      console.error('[ClaudeScoreClient] Aesthetic scoring failed:', error.message);
      return {
        score: 5,
        notes: ['Metadata-based analysis unavailable'],
        summary: 'Default score applied',
      };
    }
  }
}

/**
 * Create vision score client (GPT-4V)
 */
export function createVisionScoreClient(apiKey?: string): VisionScoreClient {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key required for vision score client');
  }
  return new VisionScoreClient(key);
}

/**
 * Create Claude score client (fallback)
 */
export function createClaudeScoreClient(apiKey?: string): ClaudeScoreClient {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('Anthropic API key required for Claude score client');
  }
  return new ClaudeScoreClient(key);
}

/**
 * Score aesthetics - automatically chooses client based on config
 *
 * Fallback chain:
 * 1. GPT-4V (if USE_GPT4V=true and canvasImage provided)
 * 2. Claude metadata-based scoring (if layoutMetadata provided)
 * 3. Static default score
 */
export async function scoreAesthetics(
  input: AestheticScoreInput & {
    layoutMetadata?: {
      canvasSize: { width: number; height: number };
      elementCount: number;
      elementTypes: string[];
      labelCount: number;
      imageCount: number;
      averageSpacing?: number;
    };
  },
  options?: { forceGPT4V?: boolean; apiKey?: string }
): Promise<AestheticScoreResult> {
  const useGPT4V = options?.forceGPT4V ?? USE_GPT4V;

  // Try GPT-4V first if enabled and image provided
  if (useGPT4V && input.canvasImage) {
    try {
      const client = createVisionScoreClient(options?.apiKey);
      return await client.scoreAesthetics(input);
    } catch (error: any) {
      console.warn('[scoreAesthetics] GPT-4V failed, falling back to Claude:', error.message);
      // Fall through to Claude fallback
    }
  }

  // Fallback to Claude metadata-based scoring
  if (input.layoutMetadata) {
    try {
      const anthropicKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        const claudeClient = createClaudeScoreClient(anthropicKey);
        return await claudeClient.scoreAestheticsFromMetadata(input.layoutMetadata, input.layoutIntent);
      }
    } catch (error: any) {
      console.warn('[scoreAesthetics] Claude fallback failed:', error.message);
      // Fall through to static default
    }
  }

  // Final fallback - static default score
  return {
    score: 5,
    notes: [
      'No scoring engine available',
      'Provide OPENAI_API_KEY with USE_GPT4V=true for image scoring',
      'Or provide layoutMetadata with ANTHROPIC_API_KEY for metadata scoring',
    ],
    summary: 'Default score - no AI scoring configured',
    suggestions: ['Configure GPT-4V or Claude for accurate aesthetic scoring'],
  };
}
