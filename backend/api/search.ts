/**
 * Search API - Vercel Serverless Function
 * Hybrid search: Fast keyword matching + optional AI enhancement
 * Prioritizes exact matches for speed and relevance
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';

const log = createModuleLogger('search');

interface Product {
  id: string;
  product_name: string;
  brand: string;
  category: string;
  tags: string[];
  color_palette: string[];
  material?: string;
  texture?: string;
  tone?: string;
  [key: string]: unknown;
}

interface SearchResult extends Product {
  _relevance_score: number;
  _match_type: 'exact' | 'partial' | 'semantic';
}

/**
 * Fast keyword search - searches product_name, brand, category, material, tags
 * Returns results ranked by relevance
 * Products matching multiple terms get boosted scores
 */
async function keywordSearch(
  supabase: SupabaseClient,
  searchTerms: string[],
  limit: number
): Promise<SearchResult[]> {
  const results: Map<string, SearchResult & { _matched_terms: Set<string> }> = new Map();

  // Helper to update result with term tracking
  const addResult = (p: Product, score: number, matchType: 'exact' | 'partial' | 'semantic', term: string) => {
    const existing = results.get(p.id);
    if (existing) {
      existing._matched_terms.add(term);
      // Boost score for each additional term matched (cumulative)
      existing._relevance_score = Math.max(existing._relevance_score, score) + (existing._matched_terms.size - 1) * 50;
    } else {
      const matchedTerms = new Set<string>([term]);
      results.set(p.id, { ...p, _relevance_score: score, _match_type: matchType, _matched_terms: matchedTerms });
    }
  };

  // Search each term across multiple fields
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();

    // 1. Exact match on product_name (highest priority)
    const { data: exactName } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('product_name', `%${term}%`)
      .limit(limit);

    exactName?.forEach((p: Product) => {
      const isExact = p.product_name.toLowerCase().includes(lowerTerm);
      addResult(p, isExact ? 100 : 80, 'exact', term);
    });

    // 2. Match on brand
    const { data: brandMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('brand', `%${term}%`)
      .limit(limit);

    brandMatch?.forEach((p: Product) => {
      addResult(p, 70, 'exact', term);
    });

    // 3. Match on category
    const { data: categoryMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('category', `%${term}%`)
      .limit(limit);

    categoryMatch?.forEach((p: Product) => {
      addResult(p, 60, 'partial', term);
    });

    // 4. Match on material
    const { data: materialMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('material', `%${term}%`)
      .limit(limit);

    materialMatch?.forEach((p: Product) => {
      addResult(p, 55, 'partial', term);
    });

    // 5. Match in tags array
    const { data: tagMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('tags', [term])
      .limit(limit);

    tagMatch?.forEach((p: Product) => {
      addResult(p, 50, 'semantic', term);
    });

    // 6. Match in color_palette
    const { data: colorMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('color_palette', [term])
      .limit(limit);

    colorMatch?.forEach((p: Product) => {
      addResult(p, 45, 'semantic', term);
    });
  }

  // Sort by relevance score and return top results
  // Products matching more terms will have higher scores due to the +50 boost per additional term
  return Array.from(results.values())
    .map(({ _matched_terms, ...rest }) => rest) // Remove internal tracking field
    .sort((a, b) => b._relevance_score - a._relevance_score)
    .slice(0, limit);
}

/**
 * Extract search terms from query
 * Removes common stop words and normalizes
 */
function extractSearchTerms(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
    'want', 'looking', 'find', 'show', 'get', 'some', 'any'
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word));
}

/**
 * Check if query is simple enough for keyword-only search
 */
function isSimpleQuery(query: string): boolean {
  const terms = extractSearchTerms(query);
  // Simple if 1-3 terms and no complex phrases
  return terms.length <= 3 && !query.includes(' that ') && !query.includes(' like ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle GET (tag search) or POST (prompt search)
  if (req.method === 'GET') {
    // Tag-based search - direct database query, no AI needed
    const { category, tags, region, limit = '20', q } = req.query;

    try {
      // If 'q' param provided, do keyword search
      if (q) {
        const searchTerms = extractSearchTerms(q as string);
        const results = await keywordSearch(supabase, searchTerms, parseInt(limit as string));

        return res.status(200).json({
          mode: 'keyword',
          products: results,
          total: results.length,
          search_terms: searchTerms
        });
      }

      // Otherwise do traditional tag-based search
      let query = supabase.from('enriched_products').select('*');

      if (category) {
        query = query.eq('category', category);
      }

      if (tags) {
        const tagList = (tags as string).split(',').map(t => t.trim());
        query = query.contains('tags', tagList);
      }

      if (region) {
        query = query.eq('region', region);
      }

      query = query.limit(parseInt(limit as string));

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        mode: 'tag',
        products: data || [],
        total: data?.length || 0
      });
    } catch (error) {
      log.error({ error }, 'Tag search failed');
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  }

  if (req.method === 'POST') {
    const { prompt, limit = 20, useAI = 'auto' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Search prompt is required' });
    }

    try {
      const searchTerms = extractSearchTerms(prompt);
      const simple = isSimpleQuery(prompt);

      // STEP 1: Always do fast keyword search first
      const keywordResults = await keywordSearch(supabase, searchTerms, limit);

      // If we have good keyword results OR query is simple, return immediately
      if (keywordResults.length >= 3 || (simple && useAI !== 'always')) {
        return res.status(200).json({
          mode: 'keyword',
          products: keywordResults,
          total: keywordResults.length,
          search_terms: searchTerms,
          ai_used: false
        });
      }

      // STEP 2: For complex queries with few results, enhance with AI
      if (useAI !== 'never') {
        const parsePrompt = `Parse this product search query into keywords. Return JSON only:
Query: "${prompt}"
{
  "keywords": ["product-specific words to search"],
  "colors": ["colors mentioned"],
  "category": "category if mentioned",
  "style_tags": ["style descriptors like bohemian, modern, rustic"]
}`;

        const aiResponse = await callClaude(parsePrompt, { maxTokens: 200 });
        let parsedQuery = null;

        if (aiResponse.success && aiResponse.text) {
          parsedQuery = parseJSONFromResponse(aiResponse.text);
        }

        if (parsedQuery) {
          // Combine AI-extracted terms with original terms
          const aiTerms = [
            ...(parsedQuery.keywords || []),
            ...(parsedQuery.colors || []),
            ...(parsedQuery.style_tags || [])
          ].filter(Boolean);

          const allTerms = Array.from(new Set([...searchTerms, ...aiTerms]));
          const enhancedResults = await keywordSearch(supabase, allTerms, limit);

          // Merge results, preferring higher scores
          const merged = new Map<string, SearchResult>();
          [...keywordResults, ...enhancedResults].forEach(p => {
            const existing = merged.get(p.id);
            if (!existing || existing._relevance_score < p._relevance_score) {
              merged.set(p.id, p);
            }
          });

          const finalResults = Array.from(merged.values())
            .sort((a, b) => b._relevance_score - a._relevance_score)
            .slice(0, limit);

          return res.status(200).json({
            mode: 'hybrid',
            products: finalResults,
            total: finalResults.length,
            search_terms: allTerms,
            parsed_query: parsedQuery,
            ai_used: true
          });
        }
      }

      // Fallback to keyword results
      return res.status(200).json({
        mode: 'keyword',
        products: keywordResults,
        total: keywordResults.length,
        search_terms: searchTerms,
        ai_used: false,
        suggestions: keywordResults.length === 0 ? [
          'Try using different keywords',
          'Search for a specific product type',
          'Browse by category'
        ] : undefined
      });
    } catch (error) {
      log.error({ error }, 'Search failed');
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
