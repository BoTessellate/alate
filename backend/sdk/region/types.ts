/**
 * Region Recommendation Types
 * Task 16: Region-Aware Product Recommendation
 */

/**
 * Region aliases configuration
 */
export interface RegionAliasConfig {
  version: string;
  description: string;
  aliases: Record<string, string[]>;
  regions: Record<string, RegionInfo>;
  hierarchies: Record<string, string[]>;
}

/**
 * Region information with parent and keywords
 */
export interface RegionInfo {
  parent: string;
  keywords: string[];
}

/**
 * Region match result with score
 */
export interface RegionMatch {
  region: string;
  score: number;
  matchType: 'exact' | 'alias' | 'keyword' | 'hierarchy' | 'partial';
  matchedOn?: string;
}

/**
 * Region extraction result from prompt
 */
export interface RegionExtraction {
  primary: string | null;
  regions: string[];
  confidence: number;
  hints: string[];
}

/**
 * Product with region scoring
 */
export interface RegionScoredProduct {
  id: string;
  region?: string;
  regionScore: number;
  matchDetails?: RegionMatch;
}

/**
 * Region matcher configuration
 */
export interface RegionMatcherConfig {
  /** Score for exact region match */
  exactMatchScore?: number;
  /** Score for alias match (e.g., Bali -> Indonesia) */
  aliasMatchScore?: number;
  /** Score for keyword match */
  keywordMatchScore?: number;
  /** Score for hierarchy match (e.g., India -> South Asia) */
  hierarchyMatchScore?: number;
  /** Score for global/unspecified products */
  globalFallbackScore?: number;
  /** Boost multiplier for user's home region */
  homeRegionBoost?: number;
}

/**
 * Search query with region context
 */
export interface RegionSearchContext {
  /** User's query text */
  query: string;
  /** User's account/preference region */
  userRegion?: string;
  /** Extracted regions from query */
  queryRegions?: string[];
  /** Whether to boost local results */
  preferLocal?: boolean;
}
