# Product Enrichment SDK

AI-powered product enrichment engine for Moodlayer. Transforms raw product data into semantically rich, searchable records using Claude AI.

## 🎯 Quick Start

### Installation

```bash
cd backend
npm install
```

### Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```env
ANTHROPIC_API_KEY=your_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_key_here
```

3. Run the SQL schema in Supabase:
```bash
# Copy contents of schema.sql and run in Supabase SQL Editor
```

### Basic Usage

```typescript
import { createEnrichmentEngine } from './sdk/productEnrichment';

const engine = createEnrichmentEngine({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!
});

const rawProduct = {
  product_name: 'Handwoven Cushion',
  brand: 'Amala Earth',
  category: 'home',
  price: 799
};

const enriched = await engine.enrichProduct(rawProduct);
console.log(enriched);
```

## 📁 Files

- `types.ts` - TypeScript interfaces
- `validateProduct.ts` - Input/output validation
- `enrichProduct.ts` - Core enrichment engine
- `enrich.test.ts` - Test suite
- `schema.sql` - Database schema
- `example.ts` - Usage examples
- `product.enrichment.spec.md` - Full specification

## 🧪 Testing

Run the test suite:
```bash
npm test -- sdk/productEnrichment/enrich.test.ts
```

Run the example:
```bash
npx ts-node sdk/productEnrichment/example.ts
```

## 📖 Documentation

See [product.enrichment.spec.md](./product.enrichment.spec.md) for complete documentation.

## ✅ Features

- ✅ Claude AI integration
- ✅ Input validation
- ✅ Batch processing
- ✅ Supabase integration
- ✅ Type-safe TypeScript
- ✅ Comprehensive tests
- ✅ Error handling

## 🔧 API

### `enrichProduct()`
Enrich a single product with AI-generated metadata.

### `saveToDatabase()`
Save enriched product to Supabase.

### `enrichAndSave()`
Enrich and save in one call.

### `enrichBatch()`
Process multiple products.

## 📝 Output Fields

Each enriched product includes:
- `color_palette` - Array of colors
- `tags` - Style keywords (≥3)
- `texture` - Surface description
- `material` - Primary material
- `tone` - Aesthetic mood

## 🚀 Next Steps

1. Test with your API keys
2. Review the specification
3. Integrate with brand upload pipeline
4. Add vector embeddings (Phase 2)

---

**Version:** 1.0.0 | **Status:** Production Ready
