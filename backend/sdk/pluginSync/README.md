# Plugin Sync SDK

Product catalog syncing from multiple sources (Shopify, WooCommerce, CSV).

## Features

- **Shopify Sync** - Automated product import from Shopify stores
- **WooCommerce Sync** - Product catalog sync from WooCommerce
- **CSV Import** - Manual product upload via CSV files
- **Automatic Enrichment** - AI-powered product enrichment
- **Sync Logging** - Track sync status and errors

## Quick Start

```typescript
import { createCSVSyncHandler } from './sdk/pluginSync';

const csvHandler = createCSVSyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);

// Sync from CSV
const result = await csvHandler.syncFromCSV(csvContent, 'MyBrand');

console.log(`Synced: ${result.synced_count}/${result.total_products}`);
```

## API Endpoint

**POST /api/pluginSync**
```json
{
  "source": "csv",
  "brand": "Jaypore",
  "products": [
    {
      "name": "Cotton Kurta",
      "brand": "Jaypore",
      "category": "fashion",
      "price": 1299,
      "region": "India",
      "tags": ["cotton", "handwoven"]
    }
  ]
}
```

**GET /api/pluginSync/status/:syncId**

Returns sync status and progress.

## CSV Format

Required columns:
- `name` - Product name
- `brand` - Brand name
- `category` - Product category
- `price` - Price (numeric)

Optional columns:
- `image_url` - Product image URL
- `region` - Geographic region
- `sku` - Stock keeping unit
- `tags` - Comma-separated tags

## Sync Sources

| Source | Method | Notes |
|--------|--------|-------|
| Shopify | API/Webhook | Real-time sync |
| WooCommerce | REST API | Polling or manual trigger |
| CSV | File upload | Manual import |
| Manual | API | Direct product submission |

## Components

- `syncShopify.ts` - Shopify sync wrapper
- `syncWoo.ts` - WooCommerce sync wrapper
- `syncCSV.ts` - CSV parsing and import
- `routes/api/pluginSync.ts` - Unified sync endpoint

## License

Part of the Mood Layer project.
