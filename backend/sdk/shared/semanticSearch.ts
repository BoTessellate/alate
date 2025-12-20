/**
 * Semantic Search Intelligence for Mood Layer SDK
 *
 * Provides advanced search capabilities:
 * - Vector embedding generation using OpenAI
 * - Semantic similarity search via Pinecone
 * - Query understanding with Claude
 * - Auto-suggestions based on user behavior
 * - Search analytics and ranking optimization
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Pinecone, Index } from '@pinecone-database/pinecone';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createModuleLogger, logApiCall } from './logger';
import { ExternalServiceError, ConfigurationError } from './errors';

const logger = createModuleLogger('semanticSearch');

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticSearchConfig {
  pineconeApiKey: string;
  pineconeIndexName: string;
  supabaseUrl: string;
  supabaseKey: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  searchHistoryTable?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

export interface SearchableItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  colors?: string[];
  category?: string;
  brand?: string;
  material?: string;
  tone?: string;
  imageUrl?: string;
  price?: number;
  metadata?: Record<string, unknown>;
}

// Pinecone metadata type - values cannot be undefined
export type PineconeMetadataValue = string | string[] | number | boolean;
export type PineconeMetadata = Record<string, PineconeMetadataValue>;

// Helper to remove undefined values from metadata
function cleanMetadata(obj: Record<string, unknown>): PineconeMetadata {
  const result: PineconeMetadata = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = value as PineconeMetadataValue;
    }
  }
  return result;
}

export interface SearchResult<T = SearchableItem> {
  item: T;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface ParsedQuery {
  intent: 'search' | 'browse' | 'filter' | 'compare';
  keywords: string[];
  filters: {
    category?: string;
    brand?: string;
    colors?: string[];
    priceRange?: { min?: number; max?: number };
    material?: string;
    tone?: string;
    style?: string[];
  };
  modifiers: {
    sortBy?: 'relevance' | 'price' | 'newest' | 'popular';
    limit?: number;
  };
  confidence: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'related' | 'trending';
  score: number;
}

// ============================================================================
// SEMANTIC SEARCH ENGINE (PINECONE)
// ============================================================================

export class SemanticSearchEngine {
  private pinecone: Pinecone;
  private pineconeIndex: Index;
  private supabase: SupabaseClient;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private searchHistoryTable: string;
  private embeddingModel: string;
  private embeddingDimensions: number;

  constructor(config: SemanticSearchConfig) {
    // Initialize Pinecone
    this.pinecone = new Pinecone({
      apiKey: config.pineconeApiKey,
    });
    this.pineconeIndex = this.pinecone.index(config.pineconeIndexName);

    // Initialize Supabase (for search history and suggestions)
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.searchHistoryTable = config.searchHistoryTable || 'search_history';

    // Embedding config
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small';
    this.embeddingDimensions = config.embeddingDimensions || 1536;

    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }

    logger.info({
      hasOpenAI: !!this.openai,
      hasAnthropic: !!this.anthropic,
      pineconeIndex: config.pineconeIndexName,
      embeddingModel: this.embeddingModel,
    }, 'Semantic search engine initialized with Pinecone');
  }

  // ==========================================================================
  // EMBEDDING GENERATION
  // ==========================================================================

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new ConfigurationError('OpenAI API key required for embeddings');
    }

    const startTime = Date.now();

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: this.embeddingDimensions,
      });

      logApiCall(logger, 'openai', 'embeddings', startTime, true);
      return response.data[0].embedding;
    } catch (error: any) {
      logApiCall(logger, 'openai', 'embeddings', startTime, false, { error: error.message });
      throw new ExternalServiceError('OpenAI', `Failed to generate embedding: ${error.message}`, error);
    }
  }

  /**
   * Generate embedding for a searchable item
   */
  async generateItemEmbedding(item: SearchableItem): Promise<number[]> {
    const textContent = this.itemToText(item);
    return this.generateEmbedding(textContent);
  }

  /**
   * Convert item to searchable text representation
   */
  private itemToText(item: SearchableItem): string {
    const parts = [
      item.title,
      item.description,
      item.category,
      item.brand,
      item.material,
      item.tone,
      ...(item.tags || []),
      ...(item.colors || []),
    ].filter(Boolean);

    return parts.join(' ');
  }

  // ==========================================================================
  // PINECONE INDEX MANAGEMENT
  // ==========================================================================

  /**
   * Index a single item in Pinecone
   */
  async indexItem(item: SearchableItem): Promise<void> {
    const startTime = Date.now();
    const textContent = this.itemToText(item);
    const embedding = await this.generateEmbedding(textContent);

    const metadata = cleanMetadata({
      title: item.title,
      category: item.category,
      brand: item.brand,
      material: item.material,
      tone: item.tone,
      tags: item.tags,
      colors: item.colors,
      imageUrl: item.imageUrl,
      price: item.price,
      textContent,
    });

    try {
      await this.pineconeIndex.upsert([
        {
          id: item.id,
          values: embedding,
          metadata,
        },
      ]);

      logger.debug({ itemId: item.id, duration: Date.now() - startTime }, 'Item indexed in Pinecone');
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Failed to index item: ${error.message}`, error);
    }
  }

  /**
   * Batch index multiple items in Pinecone
   */
  async indexItems(items: SearchableItem[]): Promise<{
    indexed: number;
    failed: { id: string; error: string }[];
  }> {
    const results = { indexed: 0, failed: [] as { id: string; error: string }[] };

    // Process in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Generate embeddings for batch
      const vectors: { id: string; values: number[]; metadata: PineconeMetadata }[] = [];

      for (const item of batch) {
        try {
          const textContent = this.itemToText(item);
          const embedding = await this.generateEmbedding(textContent);

          vectors.push({
            id: item.id,
            values: embedding,
            metadata: cleanMetadata({
              title: item.title,
              category: item.category,
              brand: item.brand,
              material: item.material,
              tone: item.tone,
              tags: item.tags,
              colors: item.colors,
              imageUrl: item.imageUrl,
              price: item.price,
              textContent,
            }),
          });
        } catch (error: any) {
          results.failed.push({ id: item.id, error: error.message });
        }
      }

      // Upsert batch to Pinecone
      if (vectors.length > 0) {
        try {
          await this.pineconeIndex.upsert(vectors);
          results.indexed += vectors.length;
        } catch (error: any) {
          // Mark all items in batch as failed
          vectors.forEach((v) => {
            results.failed.push({ id: v.id, error: error.message });
          });
          results.indexed -= vectors.length;
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info({ indexed: results.indexed, failed: results.failed.length }, 'Batch indexing complete');
    return results;
  }

  /**
   * Remove item from Pinecone index
   */
  async removeFromIndex(itemId: string): Promise<void> {
    try {
      await this.pineconeIndex.deleteOne(itemId);
      logger.debug({ itemId }, 'Item removed from Pinecone index');
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Failed to remove from index: ${error.message}`, error);
    }
  }

  /**
   * Remove multiple items from Pinecone index
   */
  async removeItemsFromIndex(itemIds: string[]): Promise<void> {
    try {
      await this.pineconeIndex.deleteMany(itemIds);
      logger.debug({ count: itemIds.length }, 'Items removed from Pinecone index');
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Failed to remove items from index: ${error.message}`, error);
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    totalVectors: number;
    dimension: number;
  }> {
    try {
      const stats = await this.pineconeIndex.describeIndexStats();
      return {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || this.embeddingDimensions,
      };
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Failed to get index stats: ${error.message}`, error);
    }
  }

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  /**
   * Perform semantic similarity search using Pinecone
   */
  async semanticSearch<T extends SearchableItem>(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filters?: Partial<ParsedQuery['filters']>;
    } = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 20, threshold = 0.5, filters } = options;
    const startTime = Date.now();

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Build Pinecone filter
    const pineconeFilter: Record<string, any> = {};
    if (filters) {
      if (filters.category) {
        pineconeFilter.category = { $eq: filters.category };
      }
      if (filters.brand) {
        pineconeFilter.brand = { $eq: filters.brand };
      }
      if (filters.material) {
        pineconeFilter.material = { $eq: filters.material };
      }
      if (filters.tone) {
        pineconeFilter.tone = { $eq: filters.tone };
      }
      if (filters.priceRange) {
        if (filters.priceRange.min !== undefined) {
          pineconeFilter.price = { ...pineconeFilter.price, $gte: filters.priceRange.min };
        }
        if (filters.priceRange.max !== undefined) {
          pineconeFilter.price = { ...pineconeFilter.price, $lte: filters.priceRange.max };
        }
      }
    }

    try {
      const queryResponse = await this.pineconeIndex.query({
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true,
        filter: Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
      });

      const results = (queryResponse.matches || [])
        .filter((match) => (match.score || 0) >= threshold)
        .map((match) => {
          const metadata = (match.metadata || {}) as Record<string, PineconeMetadataValue>;
          return {
            item: {
              id: match.id,
              title: metadata.title as string,
              category: metadata.category as string | undefined,
              brand: metadata.brand as string | undefined,
              material: metadata.material as string | undefined,
              tone: metadata.tone as string | undefined,
              tags: metadata.tags as string[] | undefined,
              colors: metadata.colors as string[] | undefined,
              imageUrl: metadata.imageUrl as string | undefined,
              price: metadata.price as number | undefined,
            } as T,
            score: match.score || 0,
            matchType: 'semantic' as const,
          };
        });

      logger.info({
        query,
        resultCount: results.length,
        duration: Date.now() - startTime,
      }, 'Pinecone semantic search completed');

      return results;
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Semantic search failed: ${error.message}`, error);
    }
  }

  /**
   * Hybrid search combining semantic and keyword filtering
   */
  async hybridSearch<T extends SearchableItem>(
    query: string,
    options: {
      limit?: number;
      semanticWeight?: number;
      filters?: Partial<ParsedQuery['filters']>;
    } = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 20, filters } = options;

    // Parse query for filters
    const parsedQuery = await this.parseQuery(query);

    // Merge parsed filters with provided filters
    const mergedFilters = {
      ...parsedQuery.filters,
      ...filters,
    };

    // Run semantic search with merged filters
    return this.semanticSearch<T>(query, {
      limit,
      filters: mergedFilters,
    });
  }

  /**
   * Find similar items to a given item
   */
  async findSimilar<T extends SearchableItem>(
    itemId: string,
    options: {
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 10, threshold = 0.7 } = options;

    try {
      // Fetch the item's vector from Pinecone
      const fetchResponse = await this.pineconeIndex.fetch([itemId]);
      const record = fetchResponse.records[itemId];

      if (!record || !record.values) {
        throw new Error(`Item ${itemId} not found in index`);
      }

      // Query for similar items
      const queryResponse = await this.pineconeIndex.query({
        vector: record.values,
        topK: limit + 1, // +1 to exclude the item itself
        includeMetadata: true,
      });

      return (queryResponse.matches || [])
        .filter((match) => match.id !== itemId && (match.score || 0) >= threshold)
        .slice(0, limit)
        .map((match) => {
          const metadata = (match.metadata || {}) as Record<string, PineconeMetadataValue>;
          return {
            item: {
              id: match.id,
              title: metadata.title as string,
              category: metadata.category as string | undefined,
              brand: metadata.brand as string | undefined,
              material: metadata.material as string | undefined,
              tone: metadata.tone as string | undefined,
              tags: metadata.tags as string[] | undefined,
              colors: metadata.colors as string[] | undefined,
              imageUrl: metadata.imageUrl as string | undefined,
              price: metadata.price as number | undefined,
            } as T,
            score: match.score || 0,
            matchType: 'semantic' as const,
          };
        });
    } catch (error: any) {
      throw new ExternalServiceError('Pinecone', `Find similar failed: ${error.message}`, error);
    }
  }

  // ==========================================================================
  // QUERY UNDERSTANDING
  // ==========================================================================

  /**
   * Parse natural language query using Claude
   */
  async parseQuery(query: string): Promise<ParsedQuery> {
    if (!this.anthropic) {
      // Fallback to simple keyword extraction
      return this.simpleQueryParse(query);
    }

    const startTime = Date.now();

    const prompt = `Analyze this product search query and extract structured information.

Query: "${query}"

Return a JSON object with:
- intent: "search" | "browse" | "filter" | "compare"
- keywords: array of important search terms
- filters: object with optional fields:
  - category: product category if mentioned
  - brand: brand name if mentioned
  - colors: array of colors if mentioned
  - priceRange: { min, max } if price mentioned
  - material: material type if mentioned
  - tone: style/aesthetic tone if mentioned
  - style: array of style descriptors
- modifiers: object with optional fields:
  - sortBy: "relevance" | "price" | "newest" | "popular" if mentioned
  - limit: number if a quantity is mentioned
- confidence: 0-1 score of how well you understood the query

Return ONLY valid JSON, no explanation.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      logApiCall(logger, 'claude', 'parseQuery', startTime, true);
      return JSON.parse(jsonMatch[0]) as ParsedQuery;
    } catch (error: any) {
      logApiCall(logger, 'claude', 'parseQuery', startTime, false, { error: error.message });
      // Fallback to simple parsing
      return this.simpleQueryParse(query);
    }
  }

  /**
   * Simple query parsing without AI
   */
  private simpleQueryParse(query: string): ParsedQuery {
    const words = query.toLowerCase().split(/\s+/);

    // Common color words
    const colorWords = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple', 'orange', 'brown', 'gray', 'grey', 'beige', 'navy', 'cream', 'gold', 'silver'];
    const colors = words.filter((w) => colorWords.includes(w));

    // Common material words
    const materialWords = ['wood', 'wooden', 'metal', 'glass', 'ceramic', 'cotton', 'linen', 'leather', 'velvet', 'silk', 'wool', 'plastic', 'marble', 'stone'];
    const material = words.find((w) => materialWords.includes(w));

    // Common style words
    const styleWords = ['modern', 'vintage', 'minimalist', 'boho', 'bohemian', 'rustic', 'industrial', 'scandinavian', 'traditional', 'contemporary', 'luxury', 'cozy'];
    const style = words.filter((w) => styleWords.includes(w));

    return {
      intent: 'search',
      keywords: words.filter((w) => w.length > 2 && !colorWords.includes(w) && !materialWords.includes(w) && !styleWords.includes(w)),
      filters: {
        colors: colors.length > 0 ? colors : undefined,
        material,
        style: style.length > 0 ? style : undefined,
      },
      modifiers: {},
      confidence: 0.5,
    };
  }

  // ==========================================================================
  // SUGGESTIONS (via Supabase)
  // ==========================================================================

  /**
   * Get search suggestions
   */
  async getSuggestions(
    partialQuery: string,
    userId?: string,
    limit = 10
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Get recent searches for user
    if (userId) {
      const recentSearches = await this.getRecentSearches(userId, 5);
      suggestions.push(...recentSearches.map((query) => ({
        text: query,
        type: 'recent' as const,
        score: 0.9,
      })));
    }

    // Get popular searches matching prefix
    const popularSearches = await this.getPopularSearches(partialQuery, 5);
    suggestions.push(...popularSearches.map((item) => ({
      text: item.query,
      type: 'popular' as const,
      score: item.count / 100, // Normalize
    })));

    // Deduplicate and sort
    const seen = new Set<string>();
    return suggestions
      .filter((s) => {
        if (seen.has(s.text.toLowerCase())) return false;
        seen.add(s.text.toLowerCase());
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get recent searches for user
   */
  private async getRecentSearches(userId: string, limit: number): Promise<string[]> {
    const { data } = await this.supabase
      .from(this.searchHistoryTable)
      .select('query')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((row: any) => row.query);
  }

  /**
   * Get popular searches
   */
  private async getPopularSearches(
    prefix: string,
    limit: number
  ): Promise<{ query: string; count: number }[]> {
    const { data } = await this.supabase
      .from(this.searchHistoryTable)
      .select('query')
      .ilike('query', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!data) return [];

    // Count occurrences
    const counts = new Map<string, number>();
    for (const row of data) {
      const query = row.query.toLowerCase();
      counts.set(query, (counts.get(query) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Record search for analytics
   */
  async recordSearch(
    query: string,
    userId?: string,
    resultCount?: number
  ): Promise<void> {
    await this.supabase.from(this.searchHistoryTable).insert({
      query,
      user_id: userId,
      result_count: resultCount,
      created_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create semantic search engine with environment variables
 */
export function createSemanticSearchEngine(
  config?: Partial<SemanticSearchConfig>
): SemanticSearchEngine {
  return new SemanticSearchEngine({
    pineconeApiKey: config?.pineconeApiKey || process.env.PINECONE_API_KEY || '',
    pineconeIndexName: config?.pineconeIndexName || process.env.PINECONE_INDEX_NAME || 'mood-layer-products',
    supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL || '',
    supabaseKey: config?.supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    searchHistoryTable: config?.searchHistoryTable,
    embeddingModel: config?.embeddingModel,
    embeddingDimensions: config?.embeddingDimensions,
  });
}
