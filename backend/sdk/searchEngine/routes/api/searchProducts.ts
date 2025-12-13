/**
 * Search Products API Endpoint
 * REST API for tag-based and prompt-based product search
 */

import { Request, Response } from 'express';
import { createTagSearchEngine } from '../../searchByTag';
import { createPromptSearchEngine } from '../../searchByPrompt';
import { TagSearchInput, PromptSearchInput } from '../../types';

/**
 * Main search endpoint handler
 * Supports both tag-based and prompt-based search
 *
 * Query parameters:
 * - Tag-based: ?category=home&tags=boho,handmade&region=India&limit=20
 * - Prompt-based: ?prompt=cozy+living+room+setup&limit=10
 */
export async function searchProductsHandler(req: Request, res: Response) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Server configuration error: Supabase credentials missing'
      });
    }

    // Initialize search engines
    const tagSearchEngine = createTagSearchEngine(supabaseUrl, supabaseKey);

    // Check if this is a prompt-based search
    const { prompt } = req.query;

    if (prompt && typeof prompt === 'string') {
      // Prompt-based search
      if (!anthropicApiKey) {
        return res.status(500).json({
          error: 'Prompt search unavailable: Anthropic API key not configured'
        });
      }

      const promptSearchEngine = createPromptSearchEngine(
        anthropicApiKey,
        tagSearchEngine
      );

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const searchInput: PromptSearchInput = {
        prompt: prompt.trim(),
        limit
      };

      const result = await promptSearchEngine.searchWithSuggestions(searchInput);

      return res.json({
        mode: 'prompt',
        ...result
      });
    } else {
      // Tag-based search
      const { category, tags, region, limit } = req.query;

      const searchParams: TagSearchInput = {
        category: category as string | undefined,
        tags: tags ? (tags as string).split(',').map(t => t.trim()) : undefined,
        region: region as string | undefined,
        limit: limit ? parseInt(limit as string) : 50
      };

      const result = await tagSearchEngine.searchByTag(searchParams);

      return res.json({
        mode: 'tag',
        ...result
      });
    }
  } catch (error: any) {
    console.error('Search error:', error);

    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}

/**
 * Express route setup
 */
export function setupSearchRoutes(app: any) {
  app.get('/api/searchProducts', searchProductsHandler);
}
