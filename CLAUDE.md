# Claude Code Guidelines for Stel/Moodlayer

## Pre-Commit Verification Checklist

Before presenting any code changes as complete, verify:

### 1. Code Review
- [ ] All imports are correct and used
- [ ] No syntax errors or TypeScript issues
- [ ] Consistent styling with existing codebase (CSS variables, component patterns)
- [ ] No hardcoded values that should be configurable

### 2. Logic Verification
- [ ] Trace through the primary user flow mentally
- [ ] Verify state transitions are correct
- [ ] Check that callbacks/handlers are properly bound
- [ ] Ensure async operations have proper error handling

### 3. Edge Cases
- [ ] Empty states handled (null, undefined, empty arrays)
- [ ] Loading states implemented
- [ ] Error states with user-friendly messages
- [ ] Boundary conditions (max length, special characters, etc.)

### 4. UI/UX Consistency
- [ ] Uses design system colors: `var(--primary)`, `var(--surface)`, `var(--foreground)`, etc.
- [ ] Responsive considerations for different panel sizes
- [ ] Hover/focus states for interactive elements
- [ ] Consistent spacing and typography

## Project Structure

```
stel/
├── frontend/          # Next.js frontend
│   └── src/
│       ├── components/
│       │   └── ui/    # Reusable UI components
│       └── stores/    # Zustand stores
├── backend/           # Vercel serverless functions
│   ├── api/           # API endpoints
│   └── sdk/           # Internal SDKs
│       ├── productEnrichment/
│       ├── searchEngine/
│       └── shared/
```

## Key Patterns

### API Calls
- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- All API routes under `/api/`
- Use proper error handling with try/catch

### State Management
- Zustand for global state
- Local React state for component-specific UI state
- Side panel context for panel state management

### Styling
- CSS variables for theming (defined in globals.css)
- Inline styles for dynamic values
- Tailwind for utility classes

## AI Enrichment Flow
1. Scrape URL → Extract product metadata + image URL
2. Send to `/api/ai?action=enrich`
3. **Color Extraction** (pixel-level accuracy):
   - Extract dominant colors from image using pixel sampling
   - Map hex codes to fashion names via `color_mapping` database table
   - Returns accurate colors like "burgundy", "ivory", "slate" (not generic "blue")
4. **AI Enrichment** (for semantic understanding):
   - Claude/GPT analyzes product context for tags, category, vibe
   - Uses few-shot learning from user corrections
5. User can edit tags (add/remove)
6. Save to `enriched_products` table in Supabase
7. On close/add another, submit tag feedback to `/api/ai?action=feedback`

## Color Extraction System (Implemented)

### Architecture Decision
- **DO NOT** rely on AI vision for color accuracy (AI describes colors, doesn't measure them)
- **USE** pixel-level color extraction for accurate hex codes
- **MAP** hex codes to fashion-friendly names via database lookup

### Implementation Details
The enrichment pipeline (`/api/ai?action=enrich`) now:
1. **First** extracts colors from the product image using pixel-level analysis (sharp library)
2. **Then** calls AI for semantic understanding (tags, category, material, texture)
3. **Merges** pixel-accurate colors with AI-generated metadata

API Response includes:
- `color_extraction`: "pixel-accurate" | "ai-fallback" | "demo-fallback"
- `color_hex_codes`: Array of actual hex values extracted from image
- `product.color_palette`: Fashion-friendly color names (mapped from hex codes)

### Components
- `colorExtractor.ts` - Extracts dominant colors from images via pixel sampling (k-means clustering)
  - `extractColorsFromImage()` - Gets raw pixel data, clusters colors
  - `mapColorsToNames()` - Maps hex codes to fashion names via Supabase
  - `extractAndNameColors()` - Full pipeline combining both
- `color_mapping` table - Maps hex codes to descriptive names (100+ fashion colors)
- `find_closest_color()` SQL function - Finds nearest named color for any hex

### Color Naming Hierarchy
1. `hex_code`: Exact color value (e.g., "#2C3E50")
2. `basic_name`: Simple name (e.g., "blue")
3. `descriptive_name`: Detailed name (e.g., "dark slate blue")
4. `fashion_name`: Industry term (e.g., "slate")

### Future Enhancements
- [ ] Add OpenAI GPT-4 Vision or Gemini for texture/material analysis
- [ ] Client-side canvas-based color picking for real-time feedback

## AI Feedback Loop (Learning System)

The system learns from user tag corrections through a 3-layer approach:

### Layer 1: Few-shot Learning (Implemented)
- Recent tag corrections are fetched from `tag_feedback` table
- Included in the AI prompt as examples
- AI learns patterns like "users remove 'casual' from Giorgio Armani products"

### Layer 2: Tag Feedback Database (Implemented)
- `tag_feedback` table stores:
  - `ai_generated_tags`: Original AI output
  - `user_final_tags`: After user edits
  - `tags_added`: What AI missed
  - `tags_removed`: What AI got wrong
  - Context: brand, category, source_url
- Views: `tag_correction_patterns`, `tag_addition_patterns`
- Function: `get_recent_tag_corrections(brand, category, limit)`

### Layer 3: Periodic Fine-tuning (Future)
- Aggregate feedback data monthly
- Fine-tune a model on correction patterns
- Deploy as custom enrichment model

## Layout Feedback System (AI Learning for Layouts)

The vision AI learns from user layout adjustments through a similar feedback loop:

### How It Works
1. AI generates initial layout with product positions and label placements
2. User adjusts positions, sizes, or label locations
3. On export/save, frontend submits adjustments to `/api/ai?action=layout-feedback`
4. AI uses past corrections for few-shot learning in future layouts

### Layout Feedback Database
- `layout_feedback` table stores:
  - `ai_generated_layout`: Original AI output (JSONB)
  - `user_final_layout`: After user adjustments (JSONB)
  - `adjustments`: Detailed diff of what changed
  - `elements_moved`, `elements_resized`, `labels_repositioned`: Metrics
  - `was_exported`: Quality signal (user liked it enough to export)
  - `time_spent_adjusting`: Less time = better initial layout
  - Context: layout_type, product_count, product_categories, vibe_layer

### Smart Labels with Learning
The `/api/ai?action=labels` endpoint now:
1. Fetches recent layout corrections via `getRecentLayoutCorrections()`
2. Fetches successful layout examples via `getSuccessfulLayoutExamples()`
3. Includes these in the AI prompt as few-shot examples
4. Returns `learning_context` in response showing how many examples were used

### Frontend Integration (Moodboard Editor)
The moodboard editor (`/looks/[collectionSlug]/page.tsx`) now tracks layout adjustments:

**State Tracking:**
- `aiGeneratedLayout`: Stores the original AI-generated layout when user applies auto-layout
- `layoutType`: The layout type used (minimal, hero, dynamic, collage)
- `layoutStartTime`: Timestamp for calculating time spent adjusting
- `adjustmentHistory`: Array of all moves, resizes, rotations, and deletions

**Tracked Adjustments:**
- Element moves (drag and drop position changes)
- Element deletions
- All adjustments include: itemId, from/to positions, timestamp

**Visual Indicator:**
- Purple "Learning from adjustments" badge appears when AI layout is active
- Shows count of adjustments made
- Pulses to indicate active learning

**Feedback Submission:**
- Triggered on Export button click in floating toolbar
- Triggered on AI Compose Download
- Submits to `/api/ai?action=layout-feedback` with full layout diff
- Includes quality signals: was_exported, time_spent_adjusting, elements_moved count

**Dependencies:**
- `html2canvas`: For canvas-to-image export (added to package.json)

### Database Views
- `layout_position_patterns`: Common adjustments by layout type
- `successful_layouts`: Exported layouts with minimal corrections
- `category_layout_preferences`: Best layouts for product category combos
- `label_placement_patterns`: Where users prefer labels by category

### Database Tables
- `enriched_products` - Stored enriched product data
- `tag_feedback` - User corrections for tag AI learning
- `color_mapping` - Hex to fashion color name mapping
- `layout_feedback` - User adjustments for layout AI learning
- `label_feedback` - Label placement corrections

### SQL Migrations
Run these migrations in Supabase SQL Editor:
1. `backend/sdk/migrations/complete_migration.sql` (creates all tables)
2. `backend/sdk/migrations/enable_rls_policies.sql` (enables Row Level Security)

### Security (Row Level Security)
All tables have RLS enabled with these policies:
- **enriched_products**: Public read, service_role write
- **color_mapping**: Public read (reference data), service_role write
- **tag_feedback**: Service role only (contains learning data)
- **layout_feedback**: Service role only (contains learning data)
- **label_feedback**: Service role only (contains learning data)

The backend API uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for writes.

## Testing New Features
When implementing new features, spawn a test agent to verify:
- Component renders without errors
- User interactions work as expected
- API calls succeed with proper payloads
- Edge cases are handled gracefully
