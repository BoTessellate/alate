/**
 * Morphic Prompts Utility
 *
 * Dynamic AI prompts that adapt to context without manual editing.
 * Based on Morphic Programming's Morphability principle:
 * - Natural language functions as adaptable code
 * - Prompts can be "morphed" with inline modifications
 * - Context is injected dynamically based on activity
 *
 * Usage:
 * ```typescript
 * import { morphPrompt, loadBasePrompt, getEnrichmentContext } from './morphicPrompts';
 *
 * // Get base prompt
 * const basePrompt = loadBasePrompt('enrichment');
 *
 * // Get activity-specific context
 * const context = await getEnrichmentContext(product);
 *
 * // Morph the prompt with context
 * const finalPrompt = morphPrompt(basePrompt, context, ['focus on luxury brands']);
 * ```
 */

import { getSupabaseClient } from './supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptContext {
  // System context (domain-wide constraints)
  domain: string;
  style: string;
  constraints: string[];

  // Activity context (per-call)
  recentFeedback?: FeedbackEntry[];
  categoryPatterns?: TagPattern[];
  userPreferences?: UserPrefs;
}

export interface FeedbackEntry {
  aiGenerated: string[];
  userFinal: string[];
  tagsAdded: string[];
  tagsRemoved: string[];
  brand?: string;
  category?: string;
}

export interface TagPattern {
  category: string;
  commonTags: string[];
  frequentlyRemoved: string[];
  frequentlyAdded: string[];
}

export interface UserPrefs {
  preferredTone?: string;
  preferredStyle?: string;
  excludedTags?: string[];
}

export type PromptTemplate = 'enrichment' | 'search' | 'layout' | 'label';

// =============================================================================
// SYSTEM CONTEXT (Domain-wide constraints)
// =============================================================================

/**
 * Default system context for Alate domain
 * This is always loaded as the foundation
 */
export const SYSTEM_CONTEXT: Omit<PromptContext, 'recentFeedback' | 'categoryPatterns' | 'userPreferences'> = {
  domain: 'fashion moodboard platform',
  style: 'modern, editorial, lifestyle brands',
  constraints: [
    'Use lowercase for all values',
    'Use fashion-appropriate terminology',
    'Color names should be fashion-friendly (e.g., "indigo" not "blue #1")',
    'Tags should be searchable and user-friendly'
  ]
};

// =============================================================================
// BASE PROMPT TEMPLATES
// =============================================================================

const BASE_PROMPTS: Record<PromptTemplate, string> = {
  enrichment: `You are an expert product analyst specializing in home decor, fashion, and lifestyle products.

Given the product below, analyze and enrich it with accurate metadata.

{{PRODUCT_DETAILS}}

{{CONSTRAINTS}}

{{FEW_SHOT_EXAMPLES}}

{{MORPH_INSTRUCTIONS}}

Return ONLY valid JSON without any markdown formatting or explanations.`,

  search: `You are a search query interpreter for a fashion moodboard platform.

Parse the user's natural language query and extract:
- Relevant tags to search for
- Filters to apply (category, brand, color, price range)
- Search intent (browsing, specific item, style inspiration)

{{QUERY}}

{{CONSTRAINTS}}

{{FEW_SHOT_EXAMPLES}}

{{MORPH_INSTRUCTIONS}}

Return ONLY valid JSON with extracted_tags, filters, and intent.`,

  layout: `You are an expert visual designer specializing in moodboard composition.

Given the products and layout archetype, generate optimal positioning.

{{PRODUCTS}}

{{ARCHETYPE}}

{{CONSTRAINTS}}

{{MORPH_INSTRUCTIONS}}

Return ONLY valid JSON with positions for each product.`,

  label: `You are an expert in visual design and typography placement.

Given the product positions in a moodboard, determine optimal label placements.

Rules:
- Labels should be readable (sufficient contrast)
- Avoid ugly overlaps (artistic/intentional overlaps are OK)
- Maintain visual hierarchy
- Position labels near their products without obscuring key details

{{LAYOUT}}

{{PRODUCTS}}

{{CONSTRAINTS}}

{{MORPH_INSTRUCTIONS}}

Return ONLY valid JSON with label positions.`
};

// =============================================================================
// PROMPT LOADING
// =============================================================================

/**
 * Load a base prompt template
 */
export function loadBasePrompt(template: PromptTemplate): string {
  return BASE_PROMPTS[template];
}

// =============================================================================
// CONTEXT LOADING FUNCTIONS
// =============================================================================

/**
 * Get recent feedback for few-shot learning
 * Fetches from tag_feedback table for enrichment context
 */
export async function getRecentFeedback(
  brand?: string,
  category?: string,
  limit = 5
): Promise<FeedbackEntry[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('tag_feedback')
    .select('ai_generated_tags, user_final_tags, tags_added, tags_removed, brand, category')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Add filters if provided
  if (brand) {
    query = query.ilike('brand', `%${brand}%`);
  }
  if (category) {
    query = query.ilike('category', `%${category}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[MorphicPrompts] Failed to fetch feedback:', error);
    return [];
  }

  return (data || []).map(row => ({
    aiGenerated: row.ai_generated_tags || [],
    userFinal: row.user_final_tags || [],
    tagsAdded: row.tags_added || [],
    tagsRemoved: row.tags_removed || [],
    brand: row.brand,
    category: row.category
  }));
}

/**
 * Get tag patterns for a category
 * Aggregates common corrections from feedback
 */
export async function getCategoryPatterns(category: string): Promise<TagPattern | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tag_correction_patterns')
    .select('*')
    .ilike('category', `%${category}%`)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    category: data.category,
    commonTags: data.common_tags || [],
    frequentlyRemoved: data.frequently_removed || [],
    frequentlyAdded: data.frequently_added || []
  };
}

/**
 * Build enrichment-specific context
 */
export async function getEnrichmentContext(product: {
  brand?: string;
  category?: string;
}): Promise<PromptContext> {
  // Get recent feedback for this brand/category
  const feedback = await getRecentFeedback(product.brand, product.category, 3);

  // Get category patterns if available
  const patterns = product.category
    ? await getCategoryPatterns(product.category)
    : null;

  return {
    ...SYSTEM_CONTEXT,
    recentFeedback: feedback,
    categoryPatterns: patterns ? [patterns] : undefined
  };
}

/**
 * Build search-specific context
 */
export async function getSearchContext(): Promise<PromptContext> {
  return {
    ...SYSTEM_CONTEXT,
    constraints: [
      ...SYSTEM_CONTEXT.constraints,
      'Extract semantic intent from natural language',
      'Map colloquial terms to standard tags',
      'Infer filters from context (e.g., "under $100" → price_max: 100)'
    ]
  };
}

// =============================================================================
// PROMPT MORPHING
// =============================================================================

/**
 * Morph a base prompt with context and inline instructions
 *
 * @param basePrompt - The template prompt
 * @param context - Activity-specific context
 * @param morphInstructions - Inline modifications (e.g., "focus on luxury brands")
 * @returns Final prompt ready for AI
 */
export function morphPrompt(
  basePrompt: string,
  context: PromptContext,
  morphInstructions?: string[]
): string {
  let prompt = basePrompt;

  // Inject constraints
  const constraintsSection = context.constraints.length > 0
    ? `**CONSTRAINTS:**\n${context.constraints.map(c => `- ${c}`).join('\n')}`
    : '';
  prompt = prompt.replace('{{CONSTRAINTS}}', constraintsSection);

  // Inject few-shot examples from recent feedback
  const fewShotSection = buildFewShotSection(context.recentFeedback);
  prompt = prompt.replace('{{FEW_SHOT_EXAMPLES}}', fewShotSection);

  // Inject morph instructions
  const morphSection = morphInstructions && morphInstructions.length > 0
    ? `**ADDITIONAL INSTRUCTIONS:**\n${morphInstructions.map(m => `- ${m}`).join('\n')}`
    : '';
  prompt = prompt.replace('{{MORPH_INSTRUCTIONS}}', morphSection);

  // Clean up any remaining unused placeholders
  prompt = prompt.replace(/\{\{[A-Z_]+\}\}/g, '');

  return prompt.trim();
}

/**
 * Build few-shot examples section from feedback
 */
function buildFewShotSection(feedback?: FeedbackEntry[]): string {
  if (!feedback || feedback.length === 0) {
    return '';
  }

  const examples = feedback
    .filter(f => f.tagsRemoved.length > 0 || f.tagsAdded.length > 0)
    .slice(0, 3)
    .map((f, i) => {
      const lines = [`Example ${i + 1}:`];
      if (f.brand) lines.push(`  Brand: ${f.brand}`);
      if (f.category) lines.push(`  Category: ${f.category}`);
      if (f.tagsRemoved.length > 0) {
        lines.push(`  Tags to AVOID: ${f.tagsRemoved.join(', ')}`);
      }
      if (f.tagsAdded.length > 0) {
        lines.push(`  Tags users ADD: ${f.tagsAdded.join(', ')}`);
      }
      return lines.join('\n');
    });

  if (examples.length === 0) {
    return '';
  }

  return `**LEARN FROM RECENT CORRECTIONS:**\n${examples.join('\n\n')}`;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Build a complete enrichment prompt with all context
 */
export async function buildEnrichmentPrompt(
  product: {
    product_name: string;
    brand?: string;
    category?: string;
    description?: string;
    price?: number;
  },
  morphInstructions?: string[]
): Promise<string> {
  // Get context
  const context = await getEnrichmentContext(product);

  // Start with base prompt
  let prompt = loadBasePrompt('enrichment');

  // Inject product details
  const productDetails = `**Product Details:**
- Product Name: "${product.product_name}"
${product.brand ? `- Brand: "${product.brand}"` : ''}
${product.category ? `- Category: "${product.category}"` : ''}
${product.price ? `- Price: ${product.price}` : ''}
${product.description ? `\n**Description:**\n${product.description}` : ''}`;

  prompt = prompt.replace('{{PRODUCT_DETAILS}}', productDetails);

  // Apply morphing
  return morphPrompt(prompt, context, morphInstructions);
}

/**
 * Build a complete search prompt with context
 */
export async function buildSearchPrompt(
  query: string,
  morphInstructions?: string[]
): Promise<string> {
  const context = await getSearchContext();
  let prompt = loadBasePrompt('search');

  prompt = prompt.replace('{{QUERY}}', `**User Query:** "${query}"`);

  return morphPrompt(prompt, context, morphInstructions);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  loadBasePrompt,
  morphPrompt,
  getEnrichmentContext,
  getSearchContext,
  getRecentFeedback,
  getCategoryPatterns,
  buildEnrichmentPrompt,
  buildSearchPrompt,
  SYSTEM_CONTEXT
};
