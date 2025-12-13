/**
 * Search Engine Types
 * Type definitions for tag-based and prompt-based product search
 */

import { EnrichedProduct } from '../productEnrichment/types';

/**
 * Tag-based search input parameters
 */
export interface TagSearchInput {
  category?: string;
  tags?: string[];
  region?: string;
  limit?: number;
}

/**
 * Prompt-based search input
 */
export interface PromptSearchInput {
  prompt: string;
  limit?: number;
}

/**
 * Claude's parsed search parameters from natural language prompt
 */
export interface ClaudeSearchParams {
  category: string | null;
  tags: string[];
  region: string | null;
  reasoning?: string; // Claude's explanation of the parse
}

/**
 * Search result response
 */
export interface SearchResult {
  results: EnrichedProduct[];
  count: number;
  query: TagSearchInput | PromptSearchInput;
  parsedParams?: ClaudeSearchParams; // For prompt searches
}

/**
 * No match fallback suggestions from Claude
 */
export interface SearchSuggestions {
  suggestedTags: string[];
  suggestedCategories: string[];
  reasoning: string;
}

/**
 * Search error response
 */
export interface SearchError {
  error: string;
  suggestions?: SearchSuggestions;
}
