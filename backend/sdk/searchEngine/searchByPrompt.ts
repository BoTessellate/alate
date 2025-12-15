/**
 * Prompt-Based Product Search with Claude AI
 * Parse natural language queries into search parameters
 */

import Anthropic from '@anthropic-ai/sdk';
import { TagSearchEngine } from './searchByTag';
import { PromptSearchInput, SearchResult, ClaudeSearchParams, SearchSuggestions } from './types';

export class PromptSearchEngine {
  private anthropic: Anthropic;
  private tagSearchEngine: TagSearchEngine;
  private model: string;

  constructor(
    anthropicApiKey: string,
    tagSearchEngine: TagSearchEngine,
    model: string = process.env.SEARCH_MODEL || 'claude-opus-4-5-20251101'
  ) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.tagSearchEngine = tagSearchEngine;
    this.model = model;
  }

  /**
   * Parse natural language prompt into search parameters using Claude
   * @param prompt - User's natural language search query
   * @returns Parsed search parameters
   */
  private async parsePromptWithClaude(prompt: string): Promise<ClaudeSearchParams> {
    const systemPrompt = `You are a product search query parser for Mood Layer, a lifestyle curation platform.

Your task is to parse natural language search queries into structured search parameters.

Extract:
1. **category** - one of: "home", "fashion", "kids", or null if unclear
2. **tags** - array of relevant search tags (2-6 tags)
3. **region** - geographic region if mentioned (e.g., "India", "Japan", "Europe"), or null

Tag Guidelines:
- Extract mood/aesthetic tags: boho, coastal, minimalist, luxury, traditional, modern, rustic, etc.
- Extract material tags: cotton, silk, wood, ceramic, leather, etc.
- Extract occasion tags: wedding, summer, picnic, casual, formal, etc.
- Extract style tags: handmade, artisanal, vintage, contemporary, etc.
- Extract tone tags: warm, cool, pastel, vibrant, neutral, earthy, etc.

Return ONLY a JSON object with this exact structure:
{
  "category": "home" | "fashion" | "kids" | null,
  "tags": ["tag1", "tag2", ...],
  "region": "string" | null,
  "reasoning": "Brief explanation of your parsing"
}

Examples:

Query: "Summer picnic edit for home accessories, pastel tones"
Response:
{
  "category": "home",
  "tags": ["summer", "picnic", "pastel", "outdoor", "casual"],
  "region": null,
  "reasoning": "Home accessories for summer picnics with pastel color scheme"
}

Query: "Traditional Indian wedding saree"
Response:
{
  "category": "fashion",
  "tags": ["traditional", "wedding", "luxury", "silk", "formal"],
  "region": "India",
  "reasoning": "Fashion item, wedding occasion, traditional Indian region"
}

Query: "Cozy living room setup with earthy tones"
Response:
{
  "category": "home",
  "tags": ["cozy", "earthy", "warm", "living-room", "comfortable"],
  "region": null,
  "reasoning": "Home decor for living room with warm, earthy aesthetic"
}`;

    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Parse this search query:\n\n"${prompt}"`
        }
      ],
      system: systemPrompt
    });

    // Extract text response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('');

    try {
      const parsed = JSON.parse(responseText);
      return parsed as ClaudeSearchParams;
    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${responseText}`);
    }
  }

  /**
   * Search products using natural language prompt
   * @param searchInput - Prompt search input
   * @returns Search results with Claude-parsed parameters
   */
  async searchByPrompt(searchInput: PromptSearchInput): Promise<SearchResult> {
    const { prompt, limit = 50 } = searchInput;

    // Step 1: Parse prompt with Claude
    const parsedParams = await this.parsePromptWithClaude(prompt);

    // Step 2: Convert to tag search parameters
    const tagSearchParams = {
      category: parsedParams.category || undefined,
      tags: parsedParams.tags,
      region: parsedParams.region || undefined,
      limit
    };

    // Step 3: Execute tag-based search
    const searchResult = await this.tagSearchEngine.searchByTag(tagSearchParams);

    // Step 4: Return results with parsed parameters
    return {
      ...searchResult,
      query: searchInput,
      parsedParams
    };
  }

  /**
   * Generate suggestions when no matches found
   * @param originalPrompt - Original search prompt
   * @param parsedParams - Parsed search parameters
   * @returns Search suggestions
   */
  async generateSuggestions(
    originalPrompt: string,
    parsedParams: ClaudeSearchParams
  ): Promise<SearchSuggestions> {
    const suggestionPrompt = `The search query "${originalPrompt}" returned no results.

Parsed parameters were:
- Category: ${parsedParams.category || 'none'}
- Tags: ${parsedParams.tags.join(', ')}
- Region: ${parsedParams.region || 'none'}

Suggest alternative search parameters that might yield better results.

Return ONLY a JSON object:
{
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedCategories": ["category1", "category2"],
  "reasoning": "Brief explanation"
}`;

    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: suggestionPrompt
        }
      ]
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('');

    try {
      const suggestions = JSON.parse(responseText);
      return suggestions as SearchSuggestions;
    } catch (error) {
      // Fallback suggestions
      return {
        suggestedTags: ['handmade', 'traditional', 'modern'],
        suggestedCategories: ['home', 'fashion', 'kids'],
        reasoning: 'Try broader search terms or different categories'
      };
    }
  }

  /**
   * Search with fallback suggestions if no results
   * @param searchInput - Prompt search input
   * @returns Search results or suggestions
   */
  async searchWithSuggestions(searchInput: PromptSearchInput): Promise<SearchResult> {
    const result = await this.searchByPrompt(searchInput);

    // If no results, generate suggestions
    if (result.count === 0 && result.parsedParams) {
      const suggestions = await this.generateSuggestions(
        searchInput.prompt,
        result.parsedParams
      );

      // Try search with suggested tags
      const suggestionSearchParams = {
        tags: suggestions.suggestedTags,
        limit: searchInput.limit || 20
      };

      const suggestionResults = await this.tagSearchEngine.searchByTag(suggestionSearchParams);

      return {
        ...suggestionResults,
        query: searchInput,
        parsedParams: {
          ...result.parsedParams,
          reasoning: `Original search returned no results. Showing suggestions: ${suggestions.reasoning}`
        }
      };
    }

    return result;
  }
}

/**
 * Factory function to create PromptSearchEngine
 */
export function createPromptSearchEngine(
  anthropicApiKey: string,
  tagSearchEngine: TagSearchEngine
): PromptSearchEngine {
  return new PromptSearchEngine(anthropicApiKey, tagSearchEngine);
}
