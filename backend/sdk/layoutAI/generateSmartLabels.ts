/**
 * Smart Label Generation
 * Uses vision AI to place labels optimally on layouts
 *
 * Supports two modes:
 * - GPT-4V: Image-based analysis (USE_GPT4V=true)
 * - Claude: Text-based analysis (default)
 */

import {
  createVisionClient,
  VisionRequest,
  getLabelPlacementsFromVision,
  LayoutVisionInput,
  LabelPlacementResult,
} from './visionClient';
import { LayoutOutput } from '../layoutGenerator/types';

// Configuration
const USE_GPT4V = process.env.USE_GPT4V === 'true';

export interface SmartLabelOptions {
  useGPT4V?: boolean;
  canvasImage?: string; // base64 PNG for GPT-4V mode
  layoutGoal?: string;
  apiKey?: string;
}

/**
 * Generate smart labels using vision AI
 *
 * Automatically chooses GPT-4V or Claude based on config:
 * - If USE_GPT4V=true and canvasImage provided: uses GPT-4V
 * - Otherwise: uses Claude
 */
export async function generateSmartLabels(
  layout: LayoutOutput,
  anthropicApiKey: string,
  options?: SmartLabelOptions
): Promise<LayoutOutput> {
  const useGPT4V = options?.useGPT4V ?? USE_GPT4V;
  const canvasImage = options?.canvasImage;

  // Use GPT-4V if enabled and canvas image is provided
  if (useGPT4V && canvasImage) {
    return generateSmartLabelsWithGPT4V(layout, canvasImage, options);
  }

  // Default: Use Claude-based client
  return generateSmartLabelsWithClaude(layout, anthropicApiKey);
}

/**
 * Generate smart labels using GPT-4V (image-based)
 */
async function generateSmartLabelsWithGPT4V(
  layout: LayoutOutput,
  canvasImage: string,
  options?: SmartLabelOptions
): Promise<LayoutOutput> {
  try {
    // Build GPT-4V input
    const imageElements = layout.elements.filter((el) => el.type === 'image');

    const input: LayoutVisionInput = {
      canvasImage,
      products: imageElements.map((el, i) => ({
        id: el.id || `product-${i}`,
        x: el.position.x,
        y: el.position.y,
        width: el.size?.width || 100,
        height: el.size?.height || 100,
        brand: el.text || 'Product',
        price: '', // Price extracted separately if available
      })),
      layoutGoal: options?.layoutGoal || 'clean, no label overlap, professional moodboard',
    };

    const placements = await getLabelPlacementsFromVision(input, {
      forceGPT4V: true,
      apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    });

    // Update label positions in layout
    const updatedElements = layout.elements.map((el) => {
      if (el.type === 'label') {
        const smartPlacement = placements.find((p) => {
          // Match by product name or index
          const matchingImage = imageElements.find((img) => img.text === el.text);
          return matchingImage && p.id === (matchingImage.id || `product-${imageElements.indexOf(matchingImage)}`);
        });

        if (smartPlacement) {
          return {
            ...el,
            position: { x: smartPlacement.labelX, y: smartPlacement.labelY },
          };
        }
      }
      return el;
    });

    return { ...layout, elements: updatedElements };
  } catch (error: any) {
    console.error('[generateSmartLabelsWithGPT4V] Failed:', error.message);
    // Return original layout unchanged on error
    return layout;
  }
}

/**
 * Generate smart labels using Claude (text-based)
 */
async function generateSmartLabelsWithClaude(
  layout: LayoutOutput,
  anthropicApiKey: string
): Promise<LayoutOutput> {
  try {
    const visionClient = createVisionClient(anthropicApiKey);

    // Extract image positions with safe access to size
    const imagePositions = layout.elements
      .filter((el) => el.type === 'image')
      .map((el) => ({
        x: el.position.x,
        y: el.position.y,
        width: el.size?.width || 100,
        height: el.size?.height || 100,
        product_name: el.text || 'Product',
      }));

    const visionRequest: VisionRequest = {
      canvas_size: layout.canvas_size,
      image_positions: imagePositions,
      label_style: {
        font_size: 18,
        color: '#2C2416',
        placement_preference: 'auto',
      },
    };

    const result = await visionClient.getSmartLabelPlacements(visionRequest);

    // Update label positions in layout
    const updatedElements = layout.elements.map((el) => {
      if (el.type === 'label') {
        const smartPlacement = result.label_placements.find((p) => p.product_name === el.text);
        if (smartPlacement) {
          return { ...el, position: smartPlacement.position };
        }
      }
      return el;
    });

    return { ...layout, elements: updatedElements };
  } catch (error: any) {
    console.error('[generateSmartLabelsWithClaude] Failed:', error.message);
    // Return original layout unchanged on error
    return layout;
  }
}

/**
 * Get raw label placements without updating layout
 * Useful for previewing placements before applying
 */
export async function getSmartLabelPlacements(
  layout: LayoutOutput,
  options?: SmartLabelOptions & { anthropicApiKey?: string }
): Promise<LabelPlacementResult> {
  const useGPT4V = options?.useGPT4V ?? USE_GPT4V;
  const canvasImage = options?.canvasImage;

  if (useGPT4V && canvasImage) {
    const imageElements = layout.elements.filter((el) => el.type === 'image');

    const input: LayoutVisionInput = {
      canvasImage,
      products: imageElements.map((el, i) => ({
        id: el.id || `product-${i}`,
        x: el.position.x,
        y: el.position.y,
        width: el.size?.width || 100,
        height: el.size?.height || 100,
        brand: el.text || 'Product',
        price: '',
      })),
      layoutGoal: options?.layoutGoal || 'clean, no label overlap, professional moodboard',
    };

    return getLabelPlacementsFromVision(input, {
      forceGPT4V: true,
      apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  // Claude fallback - convert response format
  const anthropicKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('Anthropic API key required');
  }

  const visionClient = createVisionClient(anthropicKey);
  const imageElements = layout.elements.filter((el) => el.type === 'image');

  const visionRequest: VisionRequest = {
    canvas_size: layout.canvas_size,
    image_positions: imageElements.map((el) => ({
      x: el.position.x,
      y: el.position.y,
      width: el.size?.width || 100,
      height: el.size?.height || 100,
      product_name: el.text || 'Product',
    })),
    label_style: {
      font_size: 18,
      color: '#2C2416',
      placement_preference: 'auto',
    },
  };

  const result = await visionClient.getSmartLabelPlacements(visionRequest);

  return result.label_placements.map((p, i) => ({
    id: imageElements[i]?.id || `product-${i}`,
    labelX: p.position.x,
    labelY: p.position.y,
    fontSize: 14,
    style: 'bold' as const,
    notes: p.justification,
  }));
}
