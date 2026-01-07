## Summary

- Add new `productImageSearch` SDK that finds reference product images from database or web
- Integrate reference image substitution into multi-product processing flow
- Replace incorrectly cropped user images with clean product images when Vision AI correctly identifies the product

## Problem

Vision AI correctly detects product names, tags, colors, and categories but bounding box coordinates are often incorrect (e.g., pointing to ceiling instead of actual product). This results in wrong images being displayed even when the AI knows what the product is.

## Solution

Instead of trying to fix bounding box issues, substitute with reference product images:

1. **Database Search**: Check `enriched_products` table for similar products using fuzzy name/brand/category matching
2. **Web Search**: If not in database, search Google Images via Custom Search API
3. **Fallback**: Use the processed user crop if no reference found

## New Files

| File | Description |
|------|-------------|
| `backend/sdk/productImageSearch/types.ts` | Type definitions |
| `backend/sdk/productImageSearch/databaseSearch.ts` | Fuzzy matching against enriched_products |
| `backend/sdk/productImageSearch/webSearch.ts` | Google Custom Search API integration |
| `backend/sdk/productImageSearch/index.ts` | Orchestrator with fallback strategy |

## Modified Files

| File | Changes |
|------|---------|
| `backend/sdk/photoUpload/multiProductProcessor.ts` | Added Step 5: Reference Image Search after enrichment |
| `backend/sdk/photoUpload/types.ts` | Added `image_source`, `matched_product_id`, `matched_product_name`, `detection_confidence` fields |

## Test Plan

- [ ] Upload product that exists in enriched_products database → should show database image
- [ ] Upload recognizable branded product not in database → should show web search image
- [ ] Upload obscure/custom product → should fallback to processed user crop
- [ ] Verify ProcessedProduct includes correct `image_source` tracking

## Configuration

Requires environment variables for web search:
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`

Closes #35

🤖 Generated with [Claude Code](https://claude.com/claude-code)
