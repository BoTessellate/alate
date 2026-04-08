import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../shared/logger';

const log = createModuleLogger('tagFeedback');

export interface TagFeedback {
  product_id?: string;
  brand?: string;
  category?: string;
  price_range?: string;
  ai_generated_tags: string[];
  user_final_tags: string[];
  source_url?: string;
  session_id?: string;
}

/**
 * Save tag feedback for AI learning
 * Called when user finishes editing tags
 *
 * @param feedback - Tag feedback data
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service key
 * @returns true if save succeeded, false otherwise
 */
export async function saveTagFeedback(
  feedback: TagFeedback,
  supabaseUrl: string,
  supabaseKey: string
): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured, skipping tag feedback save');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate what was added and removed
    const aiTags = new Set(feedback.ai_generated_tags);
    const userTags = new Set(feedback.user_final_tags);

    const tags_added = feedback.user_final_tags.filter(t => !aiTags.has(t));
    const tags_removed = feedback.ai_generated_tags.filter(t => !userTags.has(t));

    // Only save if there were actual changes
    if (tags_added.length === 0 && tags_removed.length === 0) {
      log.info('No tag changes, skipping feedback save');
      return true;
    }

    const { error } = await supabase
      .from('tag_feedback')
      .insert({
        product_id: feedback.product_id || null,
        brand: feedback.brand || null,
        category: feedback.category || null,
        price_range: feedback.price_range || null,
        ai_generated_tags: feedback.ai_generated_tags,
        user_final_tags: feedback.user_final_tags,
        tags_added,
        tags_removed,
        source_url: feedback.source_url || null,
        session_id: feedback.session_id || null,
      });

    if (error) {
      log.error({ error }, 'Failed to save tag feedback');
      return false;
    }

    log.info({ tags_added, tags_removed }, 'Tag feedback saved for AI learning');
    return true;
  } catch (err) {
    log.error({ error: err }, 'Tag feedback save error');
    return false;
  }
}
