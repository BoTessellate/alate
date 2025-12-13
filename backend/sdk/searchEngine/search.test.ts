/**
 * Search Engine Test Suite
 * Comprehensive tests for tag-based and prompt-based search
 */

import { createTagSearchEngine } from './searchByTag';
import { createPromptSearchEngine } from './searchByPrompt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Tag-Based Search Tests', () => {
  const tagSearchEngine = createTagSearchEngine(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  test('Search by single tag returns matching products', async () => {
    const result = await tagSearchEngine.searchByTag({
      tags: ['handwoven']
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.results.length).toBeLessThanOrEqual(50);

    // Verify all results contain the tag
    result.results.forEach(product => {
      expect(product.tags).toContain('handwoven');
    });
  });

  test('Search by category returns category-specific products', async () => {
    const result = await tagSearchEngine.searchByCategory('home', 10);

    expect(result.count).toBeGreaterThan(0);
    expect(result.results.length).toBeLessThanOrEqual(10);

    // Verify all results are in home category
    result.results.forEach(product => {
      expect(product.category).toBe('home');
    });
  });

  test('Search with multiple tags uses OR logic', async () => {
    const result = await tagSearchEngine.searchByTag({
      tags: ['handwoven', 'traditional', 'modern']
    });

    expect(result.count).toBeGreaterThan(0);

    // Each product should have at least one of the tags
    result.results.forEach(product => {
      const hasAnyTag = ['handwoven', 'traditional', 'modern'].some(
        tag => product.tags?.includes(tag)
      );
      expect(hasAnyTag).toBe(true);
    });
  });

  test('Search by region filters correctly', async () => {
    const result = await tagSearchEngine.searchByRegion('India', 10);

    if (result.count > 0) {
      result.results.forEach(product => {
        expect(product.region).toBe('India');
      });
    }
  });

  test('Combined search filters work together', async () => {
    const result = await tagSearchEngine.searchByTag({
      category: 'fashion',
      tags: ['traditional'],
      region: 'India',
      limit: 5
    });

    if (result.count > 0) {
      result.results.forEach(product => {
        expect(product.category).toBe('fashion');
        expect(product.region).toBe('India');
        expect(product.tags).toContain('traditional');
      });
    }
  });

  test('Advanced search with sorting works', async () => {
    const result = await tagSearchEngine.advancedSearch(
      { category: 'home' },
      'created_at',
      'desc'
    );

    expect(result.count).toBeGreaterThan(0);

    // Verify results are sorted by created_at descending
    for (let i = 0; i < result.results.length - 1; i++) {
      const current = new Date(result.results[i].created_at!);
      const next = new Date(result.results[i + 1].created_at!);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });
});

describe('Prompt-Based Search Tests', () => {
  const tagSearchEngine = createTagSearchEngine(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  const promptSearchEngine = createPromptSearchEngine(
    process.env.ANTHROPIC_API_KEY!,
    tagSearchEngine
  );

  test('Free-text prompt is parsed correctly by Claude', async () => {
    const result = await promptSearchEngine.searchByPrompt({
      prompt: 'Summer picnic edit for home accessories, pastel tones'
    });

    expect(result.parsedParams).toBeDefined();
    expect(result.parsedParams?.category).toBe('home');
    expect(result.parsedParams?.tags).toContain('summer');
    expect(result.parsedParams?.tags).toContain('pastel');
    expect(result.parsedParams?.reasoning).toBeDefined();
  });

  test('Traditional Indian wedding query parsed correctly', async () => {
    const result = await promptSearchEngine.searchByPrompt({
      prompt: 'Traditional Indian wedding saree'
    });

    expect(result.parsedParams?.category).toBe('fashion');
    expect(result.parsedParams?.tags).toContain('traditional');
    expect(result.parsedParams?.tags).toContain('wedding');
    expect(result.parsedParams?.region).toBe('India');
  });

  test('Cozy living room query returns relevant results', async () => {
    const result = await promptSearchEngine.searchByPrompt({
      prompt: 'Cozy living room setup with earthy tones'
    });

    expect(result.parsedParams?.category).toBe('home');
    expect(result.parsedParams?.tags).toEqual(
      expect.arrayContaining(['cozy', 'earthy'])
    );
  });

  test('Ambiguous query returns reasonable parameters', async () => {
    const result = await promptSearchEngine.searchByPrompt({
      prompt: 'Something nice for a gift'
    });

    expect(result.parsedParams).toBeDefined();
    expect(result.parsedParams?.tags.length).toBeGreaterThan(0);
  });

  test('No match returns suggestions', async () => {
    const result = await promptSearchEngine.searchWithSuggestions({
      prompt: 'Futuristic holographic quantum furniture'
    });

    // Should either have results or have reasoning explaining suggestions
    expect(
      result.count > 0 || result.parsedParams?.reasoning?.includes('suggestions')
    ).toBe(true);
  });
});

describe('Edge Cases and Error Handling', () => {
  const tagSearchEngine = createTagSearchEngine(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  test('Empty search parameters return all products (limited)', async () => {
    const result = await tagSearchEngine.searchByTag({ limit: 10 });

    expect(result.results.length).toBeLessThanOrEqual(10);
  });

  test('Non-existent category returns empty results', async () => {
    const result = await tagSearchEngine.searchByTag({
      category: 'nonexistent-category'
    });

    expect(result.count).toBe(0);
    expect(result.results).toEqual([]);
  });

  test('Non-existent tag returns empty results', async () => {
    const result = await tagSearchEngine.searchByTag({
      tags: ['xyzzz-nonexistent-tag-123']
    });

    expect(result.count).toBe(0);
  });

  test('Limit parameter is respected', async () => {
    const limit = 3;
    const result = await tagSearchEngine.searchByTag({
      category: 'home',
      limit
    });

    expect(result.results.length).toBeLessThanOrEqual(limit);
  });
});

// Integration test examples (commented out - run manually)
/*
describe('Integration Tests (Manual)', () => {
  test('Full search flow: prompt -> parse -> tag search -> results', async () => {
    const tagSearchEngine = createTagSearchEngine(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );

    const promptSearchEngine = createPromptSearchEngine(
      process.env.ANTHROPIC_API_KEY!,
      tagSearchEngine
    );

    // User's natural language query
    const userQuery = 'Show me boho coastal home decor from India';

    // Execute search
    const result = await promptSearchEngine.searchByPrompt({
      prompt: userQuery,
      limit: 10
    });

    console.log('Query:', userQuery);
    console.log('Parsed Params:', result.parsedParams);
    console.log('Results Count:', result.count);
    console.log('Sample Products:', result.results.slice(0, 3).map(p => ({
      name: p.product_name,
      tags: p.tags,
      region: p.region
    })));

    expect(result.count).toBeGreaterThan(0);
  });
});
*/
