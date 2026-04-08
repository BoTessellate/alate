/**
 * Tag Feedback Module
 * Fetches recent tag corrections for few-shot learning
 *
 * Extracted from backend/api/ai.ts (lines 994-1073)
 */

import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../shared/logger';

const log = createModuleLogger('tagFeedback');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

/**
 * Get recent tag corrections for few-shot learning
 * Returns examples of user corrections to include in AI prompt
 */
export async function getRecentTagCorrections(
  brand?: string,
  category?: string,
  limit: number = 5
): Promise<Array<{ brand: string; category: string; removed: string[]; added: string[] }>> {
  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('tag_feedback')
      .select('brand, category, tags_removed, tags_added')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by brand if provided (partial match)
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    // Only return entries that have actual corrections
    return data
      .filter((d: any) =>
        (d.tags_removed && d.tags_removed.length > 0) ||
        (d.tags_added && d.tags_added.length > 0)
      )
      .map((d: any) => ({
        brand: d.brand || 'Unknown',
        category: d.category || 'general',
        removed: d.tags_removed || [],
        added: d.tags_added || [],
      }));
  } catch (err) {
    log.error({ error: err }, 'Failed to fetch tag corrections');
    return [];
  }
}

/**
 * Build few-shot examples string for AI prompt
 */
export function buildFewShotExamples(
  corrections: Array<{ brand: string; category: string; removed: string[]; added: string[] }>
): string {
  if (corrections.length === 0) {
    return '';
  }

  const examples = corrections.map(c => {
    const parts: string[] = [];
    if (c.removed.length > 0) {
      parts.push(`removed: [${c.removed.join(', ')}]`);
    }
    if (c.added.length > 0) {
      parts.push(`added: [${c.added.join(', ')}]`);
    }
    return `- ${c.brand} (${c.category}): ${parts.join(', ')}`;
  });

  return `
LEARNING FROM USER FEEDBACK:
Recent corrections users made to AI-generated tags:
${examples.join('\n')}

Use these patterns to improve your tag suggestions. Avoid tags that users frequently remove, and consider including tags that users often add.
`;
}
