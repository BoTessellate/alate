/**
 * Search API - Vercel Serverless Function
 * Hybrid search: Keyword + AI-enhanced + Vision + Pinecone Semantic
 *
 * v3.0 - Smart tag prediction, vision-based search, Pinecone integration
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';

const log = createModuleLogger('search');

// ============================================================================
// TYPES
// ============================================================================

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
  price?: number;
  image_url?: string;
  // Vision fields
  vision_colors?: any[];
  vision_textures?: string[];
  vision_patterns?: string[];
  vision_materials?: string[];
  vision_style_tags?: string[];
  predicted_tags?: string[];
  [key: string]: unknown;
}

interface SearchResult extends Product {
  _relevance_score: number;
  _match_type: 'exact' | 'partial' | 'semantic' | 'vision' | 'predicted';
  _match_reasons?: string[];
}

interface ParsedQuery {
  keywords: string[];
  colors: string[];
  category?: string;
  style_tags: string[];
  materials?: string[];
  textures?: string[];
  patterns?: string[];
  price_range?: { min?: number; max?: number };
  intent?: 'search' | 'browse' | 'similar' | 'compare';
}

// ============================================================================
// SMART TAG PREDICTION
// ============================================================================

/**
 * Predict additional relevant tags for a search query using AI
 */
async function predictSearchTags(query: string): Promise<string[]> {
  const prompt = `Given this product search query, predict 5-10 additional relevant tags that might help find matching products.

Query: "${query}"

Consider:
- Style descriptors (modern, vintage, bohemian, minimalist, etc.)
- Material types (wood, metal, fabric, leather, etc.)
- Color families (warm tones, cool tones, neutrals, etc.)
- Use cases (living room, bedroom, outdoor, office, etc.)
- Aesthetic moods (cozy, elegant, rustic, industrial, etc.)

Return ONLY a JSON array of lowercase tag strings, nothing else.
Example: ["bohemian", "natural", "handmade", "warm tones", "living room"]`;

  try {
    const response = await callClaude(prompt, { maxTokens: 200 });
    if (response.success && response.text) {
      const parsed = parseJSONFromResponse(response.text);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === 'string').slice(0, 10);
      }
    }
  } catch (error) {
    log.warn({ error, query }, 'Failed to predict tags');
  }
  return [];
}

// ============================================================================
// KEYWORD SEARCH (Enhanced)
// ============================================================================

/**
 * Enhanced keyword search including vision fields and predicted tags
 */
async function keywordSearch(
  supabase: SupabaseClient,
  searchTerms: string[],
  limit: number,
  includeVision: boolean = true
): Promise<SearchResult[]> {
  const results: Map<string, SearchResult & { _matched_terms: Set<string> }> = new Map();

  const addResult = (
    p: Product,
    score: number,
    matchType: SearchResult['_match_type'],
    term: string,
    reason?: string
  ) => {
    const existing = results.get(p.id);
    if (existing) {
      existing._matched_terms.add(term);
      existing._relevance_score = Math.max(existing._relevance_score, score) + (existing._matched_terms.size - 1) * 50;
      if (reason && existing._match_reasons) {
        existing._match_reasons.push(reason);
      }
    } else {
      const matchedTerms = new Set<string>([term]);
      results.set(p.id, {
        ...p,
        _relevance_score: score,
        _match_type: matchType,
        _matched_terms: matchedTerms,
        _match_reasons: reason ? [reason] : []
      });
    }
  };

  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();

    // 1. Product name (highest priority)
    const { data: nameMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('product_name', `%${term}%`)
      .limit(limit);

    nameMatch?.forEach((p: Product) => {
      addResult(p, 100, 'exact', term, 'name_match');
    });

    // 2. Brand match
    const { data: brandMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('brand', `%${term}%`)
      .limit(limit);

    brandMatch?.forEach((p: Product) => {
      addResult(p, 70, 'exact', term, 'brand_match');
    });

    // 3. Category match
    const { data: categoryMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('category', `%${term}%`)
      .limit(limit);

    categoryMatch?.forEach((p: Product) => {
      addResult(p, 60, 'partial', term, 'category_match');
    });

    // 4. Material match
    const { data: materialMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('material', `%${term}%`)
      .limit(limit);

    materialMatch?.forEach((p: Product) => {
      addResult(p, 55, 'partial', term, 'material_match');
    });

    // 5. Tags array
    const { data: tagMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('tags', [term])
      .limit(limit);

    tagMatch?.forEach((p: Product) => {
      addResult(p, 50, 'semantic', term, 'tag_match');
    });

    // 6. Color palette
    const { data: colorMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('color_palette', [term])
      .limit(limit);

    colorMatch?.forEach((p: Product) => {
      addResult(p, 45, 'semantic', term, 'color_match');
    });

    // 7. Predicted tags (AI-generated)
    const { data: predictedMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('predicted_tags', [term])
      .limit(limit);

    predictedMatch?.forEach((p: Product) => {
      addResult(p, 40, 'predicted', term, 'predicted_tag_match');
    });

    // 8. Canonical tags
    const { data: canonicalMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .contains('canonical_tags', [term])
      .limit(limit);

    canonicalMatch?.forEach((p: Product) => {
      addResult(p, 42, 'semantic', term, 'canonical_tag_match');
    });

    // Vision-based search (when enabled)
    if (includeVision) {
      // Vision textures
      const { data: visionTextureMatch } = await supabase
        .from('enriched_products')
        .select('*')
        .contains('vision_textures', [term])
        .limit(limit);

      visionTextureMatch?.forEach((p: Product) => {
        addResult(p, 48, 'vision', term, 'vision_texture_match');
      });

      // Vision patterns
      const { data: visionPatternMatch } = await supabase
        .from('enriched_products')
        .select('*')
        .contains('vision_patterns', [term])
        .limit(limit);

      visionPatternMatch?.forEach((p: Product) => {
        addResult(p, 48, 'vision', term, 'vision_pattern_match');
      });

      // Vision materials
      const { data: visionMaterialMatch } = await supabase
        .from('enriched_products')
        .select('*')
        .contains('vision_materials', [term])
        .limit(limit);

      visionMaterialMatch?.forEach((p: Product) => {
        addResult(p, 47, 'vision', term, 'vision_material_match');
      });

      // Vision style tags
      const { data: visionStyleMatch } = await supabase
        .from('enriched_products')
        .select('*')
        .contains('vision_style_tags', [term])
        .limit(limit);

      visionStyleMatch?.forEach((p: Product) => {
        addResult(p, 46, 'vision', term, 'vision_style_match');
      });
    }

    // Texture field
    const { data: textureMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('texture', `%${term}%`)
      .limit(limit);

    textureMatch?.forEach((p: Product) => {
      addResult(p, 35, 'partial', term, 'texture_match');
    });

    // Tone field
    const { data: toneMatch } = await supabase
      .from('enriched_products')
      .select('*')
      .ilike('tone', `%${term}%`)
      .limit(limit);

    toneMatch?.forEach((p: Product) => {
      addResult(p, 35, 'semantic', term, 'tone_match');
    });
  }

  return Array.from(results.values())
    .map(({ _matched_terms, ...rest }) => rest)
    .sort((a, b) => b._relevance_score - a._relevance_score)
    .slice(0, limit);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// British to American spelling map for common words
const spellingVariants: Record<string, string[]> = {
  'colour': ['color'],
  'colourful': ['colorful'],
  'coloured': ['colored'],
  'grey': ['gray'],
  'favour': ['favor'],
  'favourite': ['favorite'],
  'honour': ['honor'],
  'behaviour': ['behavior'],
  'centre': ['center'],
  'fibre': ['fiber'],
  'metre': ['meter'],
  'litre': ['liter'],
  'jewellery': ['jewelry'],
  'travelling': ['traveling'],
  'catalogue': ['catalog'],
  'defence': ['defense'],
  'offence': ['offense'],
  'licence': ['license'],
  'practise': ['practice'],
  'analyse': ['analyze'],
  'organise': ['organize'],
  'realise': ['realize'],
  'minimise': ['minimize'],
  'maximise': ['maximize'],
  'customise': ['customize'],
  // Add reverse mappings (American to British)
  'color': ['colour'],
  'colorful': ['colourful'],
  'colored': ['coloured'],
  'gray': ['grey'],
  'favor': ['favour'],
  'favorite': ['favourite'],
};

/**
 * Expand search term with spelling variants
 */
function expandWithVariants(term: string): string[] {
  const variants = spellingVariants[term.toLowerCase()];
  if (variants) {
    return [term, ...variants];
  }
  return [term];
}

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

  const baseTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word));

  // Expand with spelling variants
  const expandedTerms = baseTerms.flatMap(expandWithVariants);

  // Return unique terms
  return [...new Set(expandedTerms)];
}

function isSimpleQuery(query: string): boolean {
  const terms = extractSearchTerms(query);
  return terms.length <= 3 && !query.includes(' that ') && !query.includes(' like ');
}

/**
 * Parse query with AI for deeper understanding
 */
async function parseQueryWithAI(query: string): Promise<ParsedQuery | null> {
  const prompt = `Parse this product search query into structured components. Return JSON only:

Query: "${query}"

{
  "keywords": ["specific product words"],
  "colors": ["any colors mentioned"],
  "category": "product category if clear",
  "style_tags": ["style descriptors: modern, vintage, bohemian, etc."],
  "materials": ["material types: wood, metal, fabric, etc."],
  "textures": ["texture types: smooth, rough, woven, etc."],
  "patterns": ["pattern types: striped, floral, geometric, etc."],
  "intent": "search | browse | similar | compare"
}`;

  try {
    const response = await callClaude(prompt, { maxTokens: 300 });
    if (response.success && response.text) {
      return parseJSONFromResponse(response.text) as ParsedQuery;
    }
  } catch (error) {
    log.warn({ error }, 'Failed to parse query with AI');
  }
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET: Tag/filter search or keyword search
  if (req.method === 'GET') {
    const { category, tags, region, limit = '20', q, vision = 'true' } = req.query;

    try {
      if (q) {
        const searchTerms = extractSearchTerms(q as string);
        const includeVision = vision !== 'false';
        const results = await keywordSearch(supabase, searchTerms, parseInt(limit as string), includeVision);

        return res.status(200).json({
          mode: 'keyword',
          products: results,
          total: results.length,
          search_terms: searchTerms,
          vision_enabled: includeVision
        });
      }

      // Standard tag-based search
      let query = supabase.from('enriched_products').select('*');

      if (category) query = query.eq('category', category);
      if (tags) {
        const tagList = (tags as string).split(',').map(t => t.trim());
        query = query.contains('tags', tagList);
      }
      if (region) query = query.eq('region', region);

      query = query.limit(parseInt(limit as string));

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({
        mode: 'tag',
        products: data || [],
        total: data?.length || 0
      });
    } catch (error) {
      log.error({ error }, 'Search failed');
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  }

  // POST: Smart search with AI enhancement
  if (req.method === 'POST') {
    const {
      prompt,
      limit = 20,
      useAI = 'auto',
      usePredictedTags = true,
      useVision = true,
      includeSuggestions = false
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Search prompt is required' });
    }

    try {
      const startTime = Date.now();
      const searchTerms = extractSearchTerms(prompt);
      const simple = isSimpleQuery(prompt);

      // STEP 1: Fast keyword search (always)
      let keywordResults = await keywordSearch(supabase, searchTerms, limit, useVision);

      // If good results and simple query, return fast
      if (keywordResults.length >= 5 || (simple && useAI !== 'always')) {
        return res.status(200).json({
          mode: 'keyword',
          products: keywordResults,
          total: keywordResults.length,
          search_terms: searchTerms,
          ai_used: false,
          duration_ms: Date.now() - startTime
        });
      }

      // STEP 2: AI-enhanced search for complex queries
      let allTerms = [...searchTerms];
      let parsedQuery: ParsedQuery | null = null;
      let predictedTags: string[] = [];

      if (useAI !== 'never') {
        // Parse query with AI
        parsedQuery = await parseQueryWithAI(prompt);

        if (parsedQuery) {
          allTerms = Array.from(new Set([
            ...searchTerms,
            ...(parsedQuery.keywords || []),
            ...(parsedQuery.colors || []),
            ...(parsedQuery.style_tags || []),
            ...(parsedQuery.materials || []),
            ...(parsedQuery.textures || []),
            ...(parsedQuery.patterns || [])
          ]));
        }

        // Predict additional tags
        if (usePredictedTags && keywordResults.length < 3) {
          predictedTags = await predictSearchTags(prompt);
          allTerms = Array.from(new Set([...allTerms, ...predictedTags]));
        }

        // Re-search with enhanced terms
        const enhancedResults = await keywordSearch(supabase, allTerms, limit, useVision);

        // Merge results
        const merged = new Map<string, SearchResult>();
        [...keywordResults, ...enhancedResults].forEach(p => {
          const existing = merged.get(p.id);
          if (!existing || existing._relevance_score < p._relevance_score) {
            merged.set(p.id, p);
          }
        });

        keywordResults = Array.from(merged.values())
          .sort((a, b) => b._relevance_score - a._relevance_score)
          .slice(0, limit);
      }

      // Build response
      const response: any = {
        mode: parsedQuery ? 'hybrid' : 'keyword',
        products: keywordResults,
        total: keywordResults.length,
        search_terms: allTerms,
        ai_used: !!parsedQuery || predictedTags.length > 0,
        duration_ms: Date.now() - startTime
      };

      if (parsedQuery) {
        response.parsed_query = parsedQuery;
      }

      if (predictedTags.length > 0) {
        response.predicted_tags = predictedTags;
      }

      // Add suggestions for empty results
      if (includeSuggestions && keywordResults.length === 0) {
        response.suggestions = [
          'Try different keywords',
          'Search for a specific product type',
          'Browse by category',
          'Use simpler terms'
        ];

        // Suggest related categories
        const { data: categories } = await supabase
          .from('enriched_products')
          .select('category')
          .not('category', 'is', null)
          .limit(10);

        if (categories) {
          const uniqueCategories = [...new Set(categories.map(c => c.category))];
          response.available_categories = uniqueCategories.slice(0, 5);
        }
      }

      return res.status(200).json(response);

    } catch (error) {
      log.error({ error }, 'Search failed');
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
