

# Search Engine SDK

Dual-mode product search engine for Mood Layer with tag-based filtering and AI-powered natural language queries.

## Features

- **Tag-Based Search** - Filter products by category, tags, and region
- **Prompt-Based Search** - Natural language queries powered by Claude AI
- **Smart Suggestions** - AI-generated alternatives when no matches found
- **REST API Endpoint** - Ready-to-use Express routes
- **Comprehensive Tests** - Full test coverage for both search modes

## Installation

The SDK is already part of the backend. Dependencies are installed:

```bash
cd backend
npm install  # Already includes @supabase/supabase-js and @anthropic-ai/sdk
```

## Quick Start

### Tag-Based Search

```typescript
import { createTagSearchEngine } from './sdk/searchEngine';

const searchEngine = createTagSearchEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Search by tags
const result = await searchEngine.searchByTag({
  category: 'home',
  tags: ['boho', 'coastal'],
  region: 'India',
  limit: 20
});

console.log(`Found ${result.count} products`);
```

### Prompt-Based Search

```typescript
import { createTagSearchEngine, createPromptSearchEngine } from './sdk/searchEngine';

const tagEngine = createTagSearchEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const promptEngine = createPromptSearchEngine(
  process.env.ANTHROPIC_API_KEY!,
  tagEngine
);

// Natural language search
const result = await promptEngine.searchByPrompt({
  prompt: 'Summer picnic edit for home accessories, pastel tones',
  limit: 10
});

console.log('Claude parsed:', result.parsedParams);
console.log('Results:', result.results);
```

## API Endpoint Usage

### Tag-Based Search

```bash
GET /api/searchProducts?category=home&tags=boho,handmade&region=India&limit=20
```

**Response:**
```json
{
  "mode": "tag",
  "results": [...],
  "count": 12,
  "query": {
    "category": "home",
    "tags": ["boho", "handmade"],
    "region": "India",
    "limit": 20
  }
}
```

### Prompt-Based Search

```bash
GET /api/searchProducts?prompt=cozy+living+room+setup&limit=10
```

**Response:**
```json
{
  "mode": "prompt",
  "results": [...],
  "count": 8,
  "query": {
    "prompt": "cozy living room setup",
    "limit": 10
  },
  "parsedParams": {
    "category": "home",
    "tags": ["cozy", "living-room", "comfortable", "warm"],
    "region": null,
    "reasoning": "Home decor for living room with cozy aesthetic"
  }
}
```

## Search Methods

### TagSearchEngine

```typescript
// Basic tag search
searchByTag(params: TagSearchInput): Promise<SearchResult>

// Search by single tag
searchByOneTag(tag: string, limit?: number): Promise<SearchResult>

// Search by category
searchByCategory(category: string, limit?: number): Promise<SearchResult>

// Search by region
searchByRegion(region: string, limit?: number): Promise<SearchResult>

// Advanced search with sorting
advancedSearch(
  params: TagSearchInput,
  sortBy?: 'created_at' | 'price' | 'product_name',
  sortOrder?: 'asc' | 'desc'
): Promise<SearchResult>
```

### PromptSearchEngine

```typescript
// Natural language search
searchByPrompt(input: PromptSearchInput): Promise<SearchResult>

// Search with AI suggestions on no match
searchWithSuggestions(input: PromptSearchInput): Promise<SearchResult>

// Generate suggestions for failed searches
generateSuggestions(
  prompt: string,
  parsedParams: ClaudeSearchParams
): Promise<SearchSuggestions>
```

## Search Parameters

### TagSearchInput

```typescript
{
  category?: 'home' | 'fashion' | 'kids';
  tags?: string[];
  region?: string;
  limit?: number;  // Default: 50
}
```

### PromptSearchInput

```typescript
{
  prompt: string;
  limit?: number;  // Default: 50
}
```

## Response Types

### SearchResult

```typescript
{
  results: EnrichedProduct[];
  count: number;
  query: TagSearchInput | PromptSearchInput;
  parsedParams?: ClaudeSearchParams;  // For prompt searches
}
```

### ClaudeSearchParams

```typescript
{
  category: string | null;
  tags: string[];
  region: string | null;
  reasoning: string;
}
```

## Examples

See [example.ts](./example.ts) for comprehensive usage examples:

1. Tag-based search
2. Single tag search
3. Prompt-based search
4. Cultural context search
5. Advanced search with sorting
6. Search with AI suggestions

Run examples:
```bash
npx ts-node sdk/searchEngine/example.ts
```

## Testing

Run the test suite:

```bash
npm test sdk/searchEngine/search.test.ts
```

Tests cover:
- Tag-based searches (single tag, category, region, combined)
- Prompt parsing with Claude
- Advanced search with sorting
- No match scenarios
- Edge cases and error handling

## Claude AI Prompt Parsing

The prompt search engine uses Claude 3.5 Sonnet to parse natural language queries.

**Example Parsing:**

Query: `"Summer picnic edit for home accessories, pastel tones"`

Parsed to:
```json
{
  "category": "home",
  "tags": ["summer", "picnic", "pastel", "outdoor", "casual"],
  "region": null,
  "reasoning": "Home accessories for summer picnics with pastel color scheme"
}
```

## Tag Categories

Common tag categories recognized by the system:

- **Mood/Aesthetic**: boho, coastal, minimalist, luxury, traditional, modern, rustic
- **Material**: cotton, silk, wood, ceramic, leather
- **Occasion**: wedding, summer, picnic, casual, formal
- **Style**: handmade, artisanal, vintage, contemporary
- **Tone**: warm, cool, pastel, vibrant, neutral, earthy

## Configuration

Required environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
ANTHROPIC_API_KEY=sk-ant-api03-...  # Required for prompt search
```

## Integration

### Express Server Setup

```typescript
import express from 'express';
import { setupSearchRoutes } from './sdk/searchEngine';

const app = express();
setupSearchRoutes(app);

app.listen(3000, () => {
  console.log('Search API running on http://localhost:3000');
});
```

### Frontend Integration

```typescript
// Tag-based search
const response = await fetch(
  '/api/searchProducts?category=home&tags=boho,coastal&limit=20'
);
const data = await response.json();

// Prompt-based search
const response = await fetch(
  '/api/searchProducts?prompt=' + encodeURIComponent('cozy living room')
);
const data = await response.json();
```

## Performance Considerations

- **Tag Search**: <100ms typical query time
- **Prompt Search**: ~2-3 seconds (includes Claude API call)
- **Database Indexing**: GIN index on tags array for fast containment queries
- **Caching**: Consider implementing Redis cache for frequent queries

## Error Handling

All search methods throw errors with descriptive messages:

```typescript
try {
  const result = await searchEngine.searchByTag(params);
} catch (error) {
  console.error('Search failed:', error.message);
}
```

API endpoint returns error responses:

```json
{
  "error": "Search failed",
  "message": "Detailed error description"
}
```

## Future Enhancements

- [ ] Fuzzy tag matching
- [ ] Search result ranking/scoring
- [ ] User search history
- [ ] Popular searches analytics
- [ ] Multi-language support
- [ ] Image-based search
- [ ] Price range filtering
- [ ] Color palette filtering

## License

Part of the Mood Layer project.
