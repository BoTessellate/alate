# Plugin Bridge SDK

Integration layer for external platforms (Canva, Shopify, WooCommerce).

## Features

- **Canva Integration** - Product search and layout insertion for Canva plugin
- **Shopify Sync** - Automatic product syncing from Shopify stores
- **WooCommerce Sync** - Product import from WooCommerce sites
- **Plugin Authentication** - Secure API token validation
- **Commerce Integration** - Unified interface for e-commerce platforms

## Quick Start

```typescript
import { createCanvaSearchHandler, createShopifySyncHandler } from './sdk/pluginBridge';

// Canva Search
const searchHandler = createCanvaSearchHandler(supabaseUrl, supabaseKey);
const results = await searchHandler.searchProducts({
  query: 'boho cushions',
  tags: ['handmade'],
  limit: 20
});

// Shopify Sync
const shopifyHandler = createShopifySyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
const syncResult = await shopifyHandler.syncProducts({
  platform: 'shopify',
  shop_domain: 'mystore.myshopify.com',
  api_key: 'shpat_xxxxx',
  products: []
});
```

## API Endpoints

### Canva

**POST /api/plugin/canva/search**
```json
{
  "query": "handwoven cushions",
  "tags": ["boho", "handmade"],
  "category": "home-decor",
  "limit": 20
}
```

**POST /api/plugin/canva/insert**
```json
{
  "product_ids": ["uuid1", "uuid2", "uuid3"],
  "layout_type": "LayeredCenterpiece",
  "canvas_size": { "width": 1200, "height": 1200 },
  "format": "json"
}
```

### Shopify Sync

**POST /api/plugin/shopify/sync**
```json
{
  "platform": "shopify",
  "shop_domain": "mystore.myshopify.com",
  "api_key": "shpat_xxxxx"
}
```

### WooCommerce Sync

**POST /api/plugin/woo/sync**
```json
{
  "platform": "woocommerce",
  "shop_domain": "mystore.com",
  "api_key": "ck_xxxxx:cs_xxxxx"
}
```

## Authentication

All plugin endpoints require authentication via Bearer token:

```
Authorization: Bearer <api_key>
X-Plugin-Platform: canva|shopify|woocommerce
```

## Components

- `pluginAuth.ts` - Authentication middleware
- `canva/canvaSearch.ts` - Product search for Canva
- `canva/canvaInsert.ts` - Layout generation for Canva
- `commerce/shopifySync.ts` - Shopify product sync
- `commerce/wooSync.ts` - WooCommerce product sync

## License

Part of the Mood Layer project.
