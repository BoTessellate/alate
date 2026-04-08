# Product Enrichment SDK Specification

**Version:** 1.0.0
**Status:** Day 1 Implementation Complete
**Last Updated:** December 12, 2025

---

## 📋 Overview

The Product Enrichment SDK is the core backend module for Moodlayer that transforms raw product data into semantically enriched, searchable records. It uses Claude AI to analyze product metadata and generate style tags, color palettes, textures, materials, and tonal descriptors.

### Key Features

- ✅ AI-powered product enrichment using Claude 3.5 Sonnet
- ✅ Input validation and sanitization
- ✅ Supabase database integration
- ✅ Batch processing support
- ✅ Comprehensive error handling
- ✅ TypeScript type safety
- ✅ Test suite with 5+ product mocks

---

## 🗂 Architecture

### Module Structure

```
sdk/productEnrichment/
├── types.ts                      # TypeScript interfaces
├── validateProduct.ts            # Input/output validation
├── enrichProduct.ts              # Core enrichment engine
├── enrich.test.ts               # Test suite
├── schema.sql                    # Database schema
└── product.enrichment.spec.md   # This file
```

### Data Flow

```
Raw Product Input
    ↓
validateRawProduct()
    ↓
sanitizeInputs()
    ↓
callClaudeForEnrichment()
    ↓
validateEnrichedFields()
    ↓
saveToDatabase() (optional)
    ↓
Enriched Product Output
```

---

## 📊 Database Schema

### Table: `products`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key (auto-generated) |
| `product_name` | TEXT | NO | Product name (sanitized) |
| `brand` | TEXT | NO | Brand name |
| `category` | TEXT | NO | Product category (normalized) |
| `price` | DECIMAL(10,2) | YES | Product price |
| `region` | TEXT | YES | Geographic origin |
| `color_palette` | TEXT[] | YES | AI-generated color array |
| `tags` | TEXT[] | YES | Style keywords (≥3) |
| `texture` | TEXT | YES | Surface description |
| `material` | TEXT | YES | Primary material |
| `dimensions` | TEXT | YES | Size specification |
| `tone` | TEXT | YES | Aesthetic mood |
| `flags` | TEXT[] | YES | Optional attributes |
| `enriched_at` | TIMESTAMPTZ | YES | Enrichment timestamp |
| `created_at` | TIMESTAMPTZ | NO | Record creation time |
| `updated_at` | TIMESTAMPTZ | NO | Last update time |

### Indexes

- `idx_products_brand` on `brand`
- `idx_products_category` on `category`
- `idx_products_region` on `region`
- `idx_products_tags` GIN index on `tags` (for array search)

---

## 🧠 Claude AI Integration

### Model

- **Default:** `claude-3-5-sonnet-20241022`
- **Alternative:** Configurable via `EnrichmentConfig`

### Prompt Template

The enrichment prompt asks Claude to analyze:

1. **color_palette** - 2-5 distinct colors
2. **tags** - 3-5 style keywords
3. **texture** - Single descriptive term
4. **material** - Primary material class
5. **tone** - Overall aesthetic mood

### Example Prompt

```
Given the product below, analyze and enrich it:

Product Details:
- Product Name: "Handwoven Ikat Cushion"
- Brand: "Amala Earth"
- Category: "home"
- Price: 799
- Region: "India"

Output Format (JSON only):
{
  "color_palette": ["indigo", "cream", "brick red"],
  "tags": ["handwoven", "traditional", "boho", "textured"],
  "texture": "woven",
  "material": "cotton",
  "tone": "earthy"
}
```

### Expected Response

Claude returns structured JSON that conforms to `ClaudeEnrichmentResponse` interface.

---

## 🔍 Validation Rules

### Raw Product Input

✅ **Required Fields:**
- `product_name` - Non-empty string
- `brand` - Non-empty string
- `category` - Non-empty string

✅ **Optional Fields:**
- `price` - Must be ≥ 0 if provided
- `region` - Non-empty if provided
- `dimensions` - Any string

### Enriched Output

✅ **color_palette:**
- Array with ≥ 2 distinct colors
- No duplicates allowed

✅ **tags:**
- Array with ≥ 3 keywords
- Descriptive style terms

✅ **texture:**
- Non-empty string
- Single descriptive word

✅ **material:**
- Non-empty string
- Material class name

✅ **tone:**
- Non-empty string
- No vague terms ("nice", "good", "normal")

---

## 🚀 Usage Examples

### Basic Enrichment

```typescript
import { createEnrichmentEngine } from './sdk/productEnrichment/enrichProduct';

const engine = createEnrichmentEngine({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!
});

const rawProduct = {
  product_name: 'Handwoven Ikat Cushion',
  brand: 'Amala Earth',
  category: 'home',
  price: 799,
  region: 'India'
};

const enriched = await engine.enrichProduct(rawProduct);
console.log(enriched);
```

### Enrich and Save

```typescript
const saved = await engine.enrichAndSave(rawProduct);
console.log('Saved with ID:', saved.id);
```

### Batch Processing

```typescript
const products = [product1, product2, product3];
const enrichedBatch = await engine.enrichBatch(products);

// Or enrich and save all at once
const savedBatch = await engine.enrichAndSaveBatch(products);
```

---

## 🧪 Testing

### Running Tests

```bash
cd backend
npm test -- sdk/productEnrichment/enrich.test.ts
```

### Test Coverage

The test suite includes:

1. ✅ **Validation Tests**
   - Valid input acceptance
   - Missing required fields
   - Invalid price values
   - Empty string detection
   - Color palette validation
   - Tag count validation
   - Tone vagueness detection

2. ✅ **Sanitization Tests**
   - Whitespace normalization
   - Category lowercasing

3. ✅ **Enrichment Engine Tests** (require API keys)
   - Home decor enrichment
   - Fashion enrichment
   - Kids product enrichment
   - Minimalist style detection
   - Luxury tone detection
   - Batch processing

4. ✅ **Database Tests** (require Supabase)
   - Product saving
   - ID generation
   - Timestamp creation

### Mock Products

The test suite includes 5 diverse product mocks:

| Product | Category | Brand | Price | Region |
|---------|----------|-------|-------|--------|
| Handwoven Ikat Cushion | home | Amala Earth | 799 | India |
| Organic Cotton Kurta | fashion | FabIndia | 1499 | India |
| Wooden Alphabet Blocks | kids | Kinder Toys | 599 | Germany |
| Ceramic Matte Black Vase | home | Studio Pottery | 1200 | Japan |
| Silk Embroidered Saree | fashion | Sabyasachi | 25000 | India |

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
ANTHROPIC_API_KEY=your_anthropic_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
```

### EnrichmentConfig Interface

```typescript
interface EnrichmentConfig {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  model?: string;  // Default: claude-3-5-sonnet-20241022
}
```

---

## 📈 Performance Considerations

### Rate Limiting

- Claude API has rate limits based on your tier
- Implement delay between batch requests if needed
- Consider queuing for large batches

### Cost Optimization

- Each enrichment call uses ~500-1000 tokens
- Batch processing is more efficient than individual calls
- Cache enriched products to avoid re-processing

### Database

- Use batch inserts for multiple products
- Indexes optimize search on brand, category, region
- GIN index on tags enables fast array searches

---

## 🔮 Future Enhancements

### Phase 2 (Planned)

- [ ] Add vision model integration for image analysis
- [ ] Generate vector embeddings for Pinecone
- [ ] Add `flags` field (e.g., eco_friendly, handmade)
- [ ] Implement similarity matching
- [ ] Add caching layer (Redis)
- [ ] Webhook support for real-time enrichment
- [ ] Multi-language support
- [ ] Bulk CSV upload endpoint

### Phase 3 (Planned)

- [ ] Advanced color extraction from images
- [ ] Style clustering and recommendations
- [ ] Brand-specific enrichment rules
- [ ] A/B testing for prompt variations
- [ ] Analytics dashboard

---

## ❗ Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid product input` | Missing required fields | Check validation errors array |
| `Invalid enrichment output` | Claude returned incomplete data | Retry or adjust prompt |
| `Failed to parse Claude response` | JSON parsing error | Check Claude response format |
| `Failed to save to database` | Supabase error | Check connection and RLS policies |

### Error Recovery

```typescript
try {
  const enriched = await engine.enrichProduct(product);
} catch (error) {
  if (error.message.includes('Invalid product input')) {
    // Handle validation errors
    console.error('Validation failed:', error);
  } else if (error.message.includes('Claude response')) {
    // Retry enrichment
    console.error('Claude API error:', error);
  }
}
```

---

## 📝 API Reference

### `ProductEnrichmentEngine`

#### Constructor

```typescript
new ProductEnrichmentEngine(config: EnrichmentConfig)
```

#### Methods

**`enrichProduct(rawProduct: RawProductInput): Promise<EnrichedProduct>`**
- Enriches a single product using Claude AI
- Returns enriched product with all AI-generated fields

**`saveToDatabase(enrichedProduct: EnrichedProduct): Promise<EnrichedProduct>`**
- Saves enriched product to Supabase
- Returns saved product with database ID

**`enrichAndSave(rawProduct: RawProductInput): Promise<EnrichedProduct>`**
- End-to-end pipeline: enrich + save
- Returns saved product with ID

**`enrichBatch(rawProducts: RawProductInput[]): Promise<EnrichedProduct[]>`**
- Enriches multiple products
- Continues on individual failures

**`enrichAndSaveBatch(rawProducts: RawProductInput[]): Promise<EnrichedProduct[]>`**
- Batch enrich + save in one transaction
- Returns all saved products

### Validation Functions

**`validateRawProduct(product: RawProductInput): ValidationResult`**
- Validates input before enrichment
- Returns `{ isValid, errors }`

**`validateEnrichedFields(enriched: EnrichedProductFields): ValidationResult`**
- Validates Claude output
- Ensures minimum field requirements

**`sanitizeProductName(name: string): string`**
- Removes extra whitespace
- Normalizes product name

**`normalizeCategory(category: string): string`**
- Converts to lowercase
- Trims whitespace

---

## 🎯 Completion Checklist

- ✅ Folder structure created
- ✅ TypeScript types defined
- ✅ Validation module implemented
- ✅ Enrichment engine built
- ✅ Claude AI integration complete
- ✅ Supabase integration complete
- ✅ Test suite with 5+ mocks
- ✅ Database schema defined
- ✅ Specification documentation written
- ✅ Error handling implemented
- ✅ Batch processing support
- ✅ Type safety enforced

**Status:** ✅ **Day 1 Task Complete**

---

## 📞 Support

For issues or questions:
- Check error messages in console
- Review validation errors array
- Verify API keys in `.env`
- Check Supabase RLS policies
- Run test suite to verify setup

---

*Generated for Moodlayer SDK - Product Enrichment Engine*
*Day 1 Build Task - December 2025*
