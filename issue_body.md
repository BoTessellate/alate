## Overview
When users upload photos of their products, the Vision AI correctly identifies the product (name, brand, tags, colors) but frequently provides incorrect bounding box coordinates, causing the cropped image to show the wrong area (e.g., ceiling instead of headphones).

Instead of trying to perfect bounding box detection, **replace the displayed image with a reference product image** that matches what the AI detected.

## User Story
As a user uploading my wardrobe items, I want to see a clear product image in my closet, so that I can easily identify items without dealing with incorrectly cropped photos.

## The Problem (Current State)
1. User uploads photo with headphones
2. AI correctly detects: "Bose QuietComfort 45 Headphones" with accurate tags
3. BUT bounding box points to ceiling area
4. User sees ceiling image, has to manually adjust crop
5. Wastes AI tokens and user time

## The Solution (Proposed)
1. User uploads photo
2. AI detects product metadata (name, brand, tags) - bounding box is optional fallback
3. System searches for reference product image:
   - First: Check enriched_products table (Shopify-synced products have clean images)
   - Second: Web image search (Google Custom Search or SerpApi)
4. Display the reference product image
5. Store both: original user photo + reference product image

## Acceptance Criteria
- [ ] New SDK: backend/sdk/productImageSearch/ with search functionality
- [ ] DB search: Query enriched_products for similar products (name/brand similarity)
- [ ] Web search: Fallback to Google Custom Search API for products not in DB
- [ ] Modified upload flow: Use reference images instead of cropped user images
- [ ] Store both URLs: original_image_url (user photo) + image_url (reference)
- [ ] Cost tracking: Log search API usage for monitoring

## Technical Approach
1. Create productImageSearch SDK:
   - searchInDatabase(name, brand, category) - fuzzy match enriched_products
   - searchOnWeb(query) - Google Custom Search API
   - findBestProductImage(detection) - orchestrator function

2. Modify multiProductProcessor.ts:
   - After AI detection, call findBestProductImage()
   - Use reference image as image_url
   - Keep original uploaded image as original_image_url

3. Update ProcessedProduct type:
   - Add reference_image_source: 'database' | 'web_search' | 'user_crop'
   - Add detection_confidence: number

## Files to Create/Modify
- **NEW:** backend/sdk/productImageSearch/index.ts
- **NEW:** backend/sdk/productImageSearch/databaseSearch.ts
- **NEW:** backend/sdk/productImageSearch/webSearch.ts
- **NEW:** backend/sdk/productImageSearch/types.ts
- **MODIFY:** backend/sdk/photoUpload/multiProductProcessor.ts
- **MODIFY:** backend/sdk/photoUpload/types.ts

## Cost Analysis
| Current Approach | New Approach |
|-----------------|--------------|
| Multiple re-crop API calls | One image search (~$0.005) |
| User frustration + manual fixes | Clean product images automatically |
| Wasted AI tokens on retries | Single detection pass |

## Out of Scope
- Keeping the crop adjuster as fallback for edge cases (custom/unique items)
- Image embedding similarity (separate feature in plan)

## Labels
feature, high, ai, backend
