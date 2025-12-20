/**
 * Region Matcher SDK
 * Task 16: Region-Aware Product Recommendation
 *
 * Matches products to user regions using aliases, keywords, and hierarchies.
 */

import {
  RegionAliasConfig,
  RegionMatch,
  RegionExtraction,
  RegionMatcherConfig,
  RegionSearchContext,
} from './types';
import regionAliases from './region_aliases.json';

// Default configuration
const DEFAULT_CONFIG: Required<RegionMatcherConfig> = {
  exactMatchScore: 1.0,
  aliasMatchScore: 0.9,
  keywordMatchScore: 0.7,
  hierarchyMatchScore: 0.5,
  globalFallbackScore: 0.3,
  homeRegionBoost: 1.2,
};

/**
 * Region Matcher class for geographic product matching
 */
export class RegionMatcher {
  private config: Required<RegionMatcherConfig>;
  private aliases: RegionAliasConfig;
  private keywordIndex: Map<string, string[]>;
  private aliasIndex: Map<string, string[]>;

  constructor(config?: RegionMatcherConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aliases = regionAliases as RegionAliasConfig;
    this.keywordIndex = this.buildKeywordIndex();
    this.aliasIndex = this.buildAliasIndex();
  }

  /**
   * Build keyword index for fast lookup
   */
  private buildKeywordIndex(): Map<string, string[]> {
    const index = new Map<string, string[]>();

    for (const [region, info] of Object.entries(this.aliases.regions)) {
      for (const keyword of info.keywords) {
        const normalized = keyword.toLowerCase();
        const existing = index.get(normalized) || [];
        existing.push(region);
        index.set(normalized, existing);
      }
    }

    return index;
  }

  /**
   * Build alias index for fast lookup
   */
  private buildAliasIndex(): Map<string, string[]> {
    const index = new Map<string, string[]>();

    for (const [alias, regions] of Object.entries(this.aliases.aliases)) {
      index.set(alias.toLowerCase(), regions);
    }

    return index;
  }

  /**
   * Extract region hints from a text query
   */
  extractRegionFromText(text: string): RegionExtraction {
    const normalizedText = text.toLowerCase();
    const hints: string[] = [];
    const foundRegions = new Set<string>();

    // Check for exact alias matches
    for (const [alias, regions] of this.aliasIndex.entries()) {
      if (normalizedText.includes(alias)) {
        hints.push(alias);
        regions.forEach(r => foundRegions.add(r));
      }
    }

    // Check for region name matches
    for (const region of Object.keys(this.aliases.regions)) {
      if (normalizedText.includes(region.toLowerCase())) {
        hints.push(region);
        foundRegions.add(region);
      }
    }

    // Check for keyword matches
    for (const [keyword, regions] of this.keywordIndex.entries()) {
      if (normalizedText.includes(keyword)) {
        hints.push(keyword);
        regions.forEach(r => foundRegions.add(r));
      }
    }

    // Check for hierarchy matches
    for (const hierarchy of Object.keys(this.aliases.hierarchies)) {
      if (normalizedText.includes(hierarchy.toLowerCase())) {
        hints.push(hierarchy);
        foundRegions.add(hierarchy);
      }
    }

    const regions = Array.from(foundRegions);
    const primary = regions.length > 0 ? regions[0] : null;
    const confidence = Math.min(1.0, hints.length * 0.25 + (regions.length > 0 ? 0.5 : 0));

    return {
      primary,
      regions,
      confidence,
      hints,
    };
  }

  /**
   * Match a product region against a target region
   */
  matchRegion(productRegion: string | undefined, targetRegion: string): RegionMatch {
    if (!productRegion) {
      return {
        region: 'Global',
        score: this.config.globalFallbackScore,
        matchType: 'partial',
        matchedOn: 'no region specified',
      };
    }

    const normalizedProduct = productRegion.toLowerCase().trim();
    const normalizedTarget = targetRegion.toLowerCase().trim();

    // Exact match
    if (normalizedProduct === normalizedTarget) {
      return {
        region: productRegion,
        score: this.config.exactMatchScore,
        matchType: 'exact',
        matchedOn: productRegion,
      };
    }

    // Check if product region is an alias for target
    const productAliases = this.aliasIndex.get(normalizedProduct);
    if (productAliases?.some(a => a.toLowerCase() === normalizedTarget)) {
      return {
        region: productRegion,
        score: this.config.aliasMatchScore,
        matchType: 'alias',
        matchedOn: `${productRegion} -> ${targetRegion}`,
      };
    }

    // Check if target is an alias for product region
    const targetAliases = this.aliasIndex.get(normalizedTarget);
    if (targetAliases?.some(a => a.toLowerCase() === normalizedProduct)) {
      return {
        region: productRegion,
        score: this.config.aliasMatchScore,
        matchType: 'alias',
        matchedOn: `${targetRegion} -> ${productRegion}`,
      };
    }

    // Check hierarchy match
    const hierarchyMatch = this.checkHierarchyMatch(normalizedProduct, normalizedTarget);
    if (hierarchyMatch) {
      return {
        region: productRegion,
        score: this.config.hierarchyMatchScore,
        matchType: 'hierarchy',
        matchedOn: hierarchyMatch,
      };
    }

    // Check keyword match
    const productInfo = this.aliases.regions[productRegion];
    if (productInfo) {
      for (const keyword of productInfo.keywords) {
        if (normalizedTarget.includes(keyword.toLowerCase())) {
          return {
            region: productRegion,
            score: this.config.keywordMatchScore,
            matchType: 'keyword',
            matchedOn: keyword,
          };
        }
      }
    }

    // No match - return global fallback
    return {
      region: productRegion,
      score: this.config.globalFallbackScore,
      matchType: 'partial',
      matchedOn: 'no match',
    };
  }

  /**
   * Check if two regions are related through hierarchy
   */
  private checkHierarchyMatch(region1: string, region2: string): string | null {
    // Check if region2 is a parent of region1
    for (const [parent, children] of Object.entries(this.aliases.hierarchies)) {
      const normalizedChildren = children.map(c => c.toLowerCase());
      const normalizedParent = parent.toLowerCase();

      if (normalizedParent === region2 && normalizedChildren.includes(region1)) {
        return `${region1} is in ${parent}`;
      }

      if (normalizedParent === region1 && normalizedChildren.includes(region2)) {
        return `${region2} is in ${parent}`;
      }

      // Check if both are in same hierarchy
      if (normalizedChildren.includes(region1) && normalizedChildren.includes(region2)) {
        return `both in ${parent}`;
      }
    }

    // Check region parent info
    const region1Info = Object.entries(this.aliases.regions).find(
      ([r]) => r.toLowerCase() === region1
    );
    const region2Info = Object.entries(this.aliases.regions).find(
      ([r]) => r.toLowerCase() === region2
    );

    if (region1Info && region2Info) {
      const [, info1] = region1Info;
      const [, info2] = region2Info;

      if (info1.parent.toLowerCase() === region2) {
        return `${region1} parent is ${info1.parent}`;
      }

      if (info2.parent.toLowerCase() === region1) {
        return `${region2} parent is ${info2.parent}`;
      }

      if (info1.parent === info2.parent) {
        return `both in ${info1.parent}`;
      }
    }

    return null;
  }

  /**
   * Calculate region score for a product given search context
   */
  calculateRegionScore(
    productRegion: string | undefined,
    context: RegionSearchContext
  ): number {
    const { queryRegions = [], userRegion, preferLocal = true } = context;

    // If no regions specified in query or user, return global score
    if (queryRegions.length === 0 && !userRegion) {
      return this.config.globalFallbackScore;
    }

    let maxScore = this.config.globalFallbackScore;

    // Check against query regions
    for (const targetRegion of queryRegions) {
      const match = this.matchRegion(productRegion, targetRegion);
      if (match.score > maxScore) {
        maxScore = match.score;
      }
    }

    // Check against user region with boost
    if (userRegion && preferLocal) {
      const userMatch = this.matchRegion(productRegion, userRegion);
      const boostedScore = userMatch.score * this.config.homeRegionBoost;
      if (boostedScore > maxScore) {
        maxScore = Math.min(1.0, boostedScore);
      }
    }

    return maxScore;
  }

  /**
   * Get all regions that match a given region (including aliases and hierarchy)
   */
  getRelatedRegions(region: string): string[] {
    const related = new Set<string>();
    related.add(region);

    const normalized = region.toLowerCase();

    // Add aliases
    const aliases = this.aliasIndex.get(normalized);
    if (aliases) {
      aliases.forEach(a => related.add(a));
    }

    // Check if this is an alias and add the original
    for (const [alias, regions] of this.aliasIndex.entries()) {
      if (regions.some(r => r.toLowerCase() === normalized)) {
        related.add(alias);
        regions.forEach(r => related.add(r));
      }
    }

    // Add hierarchy relations
    const regionInfo = this.aliases.regions[region];
    if (regionInfo) {
      related.add(regionInfo.parent);
    }

    // Add children from hierarchies
    const children = this.aliases.hierarchies[region];
    if (children) {
      children.forEach(c => related.add(c));
    }

    return Array.from(related);
  }

  /**
   * Infer region from brand name or domain
   */
  inferRegionFromBrand(brandName: string, domain?: string): string | null {
    const normalizedBrand = brandName.toLowerCase();

    // Check keywords in brand name
    for (const [keyword, regions] of this.keywordIndex.entries()) {
      if (normalizedBrand.includes(keyword)) {
        return regions[0];
      }
    }

    // Check domain TLD
    if (domain) {
      const tldMap: Record<string, string> = {
        '.in': 'India',
        '.co.in': 'India',
        '.jp': 'Japan',
        '.co.jp': 'Japan',
        '.kr': 'South Korea',
        '.co.kr': 'South Korea',
        '.uk': 'UK',
        '.co.uk': 'UK',
        '.fr': 'France',
        '.de': 'Germany',
        '.it': 'Italy',
        '.es': 'Spain',
        '.au': 'Australia',
        '.nz': 'New Zealand',
        '.sg': 'Singapore',
        '.id': 'Indonesia',
        '.th': 'Thailand',
        '.my': 'Malaysia',
        '.vn': 'Vietnam',
        '.mx': 'Mexico',
        '.br': 'Brazil',
        '.ae': 'UAE',
        '.za': 'South Africa',
      };

      for (const [tld, region] of Object.entries(tldMap)) {
        if (domain.endsWith(tld)) {
          return region;
        }
      }
    }

    return null;
  }
}

/**
 * Create a region matcher instance
 */
export function createRegionMatcher(config?: RegionMatcherConfig): RegionMatcher {
  return new RegionMatcher(config);
}

// Default instance for convenience
let defaultMatcher: RegionMatcher | null = null;

/**
 * Get the default region matcher instance
 */
export function getRegionMatcher(): RegionMatcher {
  if (!defaultMatcher) {
    defaultMatcher = createRegionMatcher();
  }
  return defaultMatcher;
}

/**
 * Extract region from text using default matcher
 */
export function extractRegion(text: string): RegionExtraction {
  return getRegionMatcher().extractRegionFromText(text);
}

/**
 * Calculate region score using default matcher
 */
export function calculateRegionScore(
  productRegion: string | undefined,
  context: RegionSearchContext
): number {
  return getRegionMatcher().calculateRegionScore(productRegion, context);
}

/**
 * Infer region from brand using default matcher
 */
export function inferRegionFromBrand(brandName: string, domain?: string): string | null {
  return getRegionMatcher().inferRegionFromBrand(brandName, domain);
}
