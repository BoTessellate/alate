/**
 * Image Description Generator
 *
 * Uses GPT-4o-mini Vision to generate rich text descriptions of product images.
 * These descriptions are then converted to embeddings for similarity matching.
 */

import { callOpenAIWithVision, callClaudeWithVision } from '../shared/secureAI';
import { createModuleLogger } from '../shared/logger';

const logger = createModuleLogger('description-generator');

export interface DescriptionResult {
  success: boolean;
  description?: string;
  error?: string;
}

/**
 * Fashion-specific prompt for generating embeddings-optimized descriptions
 */
const FASHION_DESCRIPTION_PROMPT = `Analyze this fashion/clothing product image and generate a detailed description optimized for similarity matching.

Include ALL of the following aspects in your description:

1. **Item Type**: What is this item? (e.g., blazer, dress, sneakers, handbag)
2. **Colors**: Primary and secondary colors, gradients, patterns
3. **Material/Texture**: How does it look? (leather, wool, denim, silk, cotton, knit, etc.)
4. **Style**: What style is it? (casual, formal, sporty, bohemian, minimalist, vintage, etc.)
5. **Silhouette/Fit**: Fitted, oversized, A-line, straight, cropped, etc.
6. **Details**: Notable features (buttons, zippers, pockets, embroidery, prints, logos, etc.)
7. **Occasion**: When would you wear this? (work, casual, evening, athletic, etc.)
8. **Season**: What season is this best for? (summer, winter, transitional, all-season)

Write as a dense, descriptive paragraph (not bullet points). Be specific about colors (e.g., "burgundy" not "red", "slate gray" not "gray").

Focus on visual characteristics that would help identify similar items in a closet.`;

/**
 * Generate a rich text description of a product image using GPT-4o-mini Vision
 *
 * @param imageUrl - URL of the product image
 * @returns Description result with success status and description text
 */
export async function generateImageDescription(
  imageUrl: string
): Promise<DescriptionResult> {
  if (!imageUrl) {
    return { success: false, error: 'Image URL is required' };
  }

  // Try OpenAI Vision first (GPT-4o-mini)
  const openaiResult = await callOpenAIWithVision(
    FASHION_DESCRIPTION_PROMPT,
    imageUrl,
    { model: 'gpt-4o-mini', maxTokens: 500 }
  );

  if (openaiResult.success && openaiResult.text) {
    return {
      success: true,
      description: openaiResult.text,
    };
  }

  // Fallback to Claude Vision if OpenAI fails
  logger.warn({ error: openaiResult.error }, 'OpenAI Vision failed, trying Claude');

  const claudeResult = await callClaudeWithVision(
    FASHION_DESCRIPTION_PROMPT,
    imageUrl,
    { maxTokens: 500 }
  );

  if (claudeResult.success && claudeResult.text) {
    return {
      success: true,
      description: claudeResult.text,
    };
  }

  return {
    success: false,
    error: `Vision API failed: ${openaiResult.error || claudeResult.error}`,
  };
}

/**
 * Generate a minimal description for quick comparisons
 * Used when we need faster processing with lower cost
 */
export async function generateQuickDescription(
  imageUrl: string
): Promise<DescriptionResult> {
  if (!imageUrl) {
    return { success: false, error: 'Image URL is required' };
  }

  const quickPrompt = `Describe this fashion item in 2-3 sentences. Include: item type, color(s), material appearance, and style. Be specific about colors (e.g., "navy" not "blue").`;

  const result = await callOpenAIWithVision(quickPrompt, imageUrl, {
    model: 'gpt-4o-mini',
    maxTokens: 150,
  });

  if (result.success && result.text) {
    return {
      success: true,
      description: result.text,
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to generate quick description',
  };
}

/**
 * Enhance an existing product's metadata into an embedding-ready description
 * Used when we have metadata but want to create a searchable embedding
 */
export function metadataToDescription(metadata: {
  productName?: string;
  brand?: string;
  category?: string;
  tags?: string[];
  colors?: string[];
  material?: string;
  texture?: string;
  tone?: string;
}): string {
  const parts: string[] = [];

  if (metadata.productName) {
    parts.push(metadata.productName);
  }

  if (metadata.brand) {
    parts.push(`by ${metadata.brand}`);
  }

  if (metadata.category) {
    parts.push(`in category ${metadata.category}`);
  }

  if (metadata.colors && metadata.colors.length > 0) {
    parts.push(`colors: ${metadata.colors.join(', ')}`);
  }

  if (metadata.material) {
    parts.push(`made of ${metadata.material}`);
  }

  if (metadata.texture) {
    parts.push(`with ${metadata.texture} texture`);
  }

  if (metadata.tone) {
    parts.push(`${metadata.tone} tone`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    parts.push(`tags: ${metadata.tags.join(', ')}`);
  }

  return parts.join('. ');
}
