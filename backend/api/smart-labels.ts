/**
 * Smart Label Placement API - Vercel Serverless Function
 * Uses Claude via Supabase Edge Function for AI-guided label positioning
 * API keys remain secure in Supabase secrets
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';

const log = createModuleLogger('smartLabels');

interface ImagePosition {
  product_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabelStyle {
  font_size: number;
  color: string;
  placement_preference?: 'above' | 'below' | 'beside' | 'auto';
}

interface LabelPlacement {
  product_name: string;
  position: { x: number; y: number };
  justification: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    image_positions,
    label_style,
    canvas_size
  } = req.body as {
    image_positions: ImagePosition[];
    label_style: LabelStyle;
    canvas_size: { width: number; height: number };
  };

  if (!image_positions || !Array.isArray(image_positions)) {
    return res.status(400).json({ error: 'image_positions array is required' });
  }

  const defaultLabelStyle = label_style || { font_size: 14, color: '#000000' };
  const defaultCanvasSize = canvas_size || { width: 1200, height: 800 };

  try {
    // Try AI-powered placement via secure Edge Function
    const prompt = buildVisionPrompt(image_positions, defaultLabelStyle, defaultCanvasSize);
    const aiResponse = await callClaude(prompt, { maxTokens: 1024 });

    let placements: LabelPlacement[] = [];

    if (aiResponse.success && aiResponse.text) {
      const parsed = parseJSONFromResponse(aiResponse.text);
      if (Array.isArray(parsed)) {
        placements = parsed;
      }
    }

    // If AI failed or returned invalid data, use rule-based fallback
    if (placements.length === 0) {
      log.info('AI label placement failed, using rule-based fallback');
      placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

      return res.status(200).json({
        success: true,
        label_placements: placements,
        method: 'rule-based-fallback'
      });
    }

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'ai',
      model_used: 'claude-via-edge-function'
    });
  } catch (error) {
    log.error({ error }, 'Smart label generation failed');

    // Fallback to rule-based
    const placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'rule-based-fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function buildVisionPrompt(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): string {
  return `You are a moodboard layout assistant. Given product image positions on a canvas, determine optimal label placement.

Canvas size: ${canvas_size.width}x${canvas_size.height}

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

function generateRuleBasedLabels(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): LabelPlacement[] {
  return image_positions.map(pos => {
    let x = pos.x;
    let y = pos.y;
    let justification = '';

    const preference = label_style.placement_preference || 'auto';

    switch (preference) {
      case 'above':
        y = pos.y - label_style.font_size - 10;
        justification = 'Placed above image as requested';
        break;
      case 'below':
        y = pos.y + pos.height + 10;
        justification = 'Placed below image as requested';
        break;
      case 'beside':
        x = pos.x + pos.width + 10;
        y = pos.y + pos.height / 2;
        justification = 'Placed beside image as requested';
        break;
      default:
        // Auto: prefer below, but check bounds
        if (pos.y + pos.height + label_style.font_size + 10 < canvas_size.height) {
          y = pos.y + pos.height + 10;
          justification = 'Auto-placed below image';
        } else if (pos.y - label_style.font_size - 10 > 0) {
          y = pos.y - label_style.font_size - 10;
          justification = 'Auto-placed above (no room below)';
        } else {
          y = pos.y + pos.height - label_style.font_size - 5;
          justification = 'Overlaid on image (constrained space)';
        }
    }

    // Ensure within canvas bounds
    x = Math.max(10, Math.min(x, canvas_size.width - 100));
    y = Math.max(10, Math.min(y, canvas_size.height - label_style.font_size - 5));

    return {
      product_name: pos.product_name,
      position: { x, y },
      justification
    };
  });
}
