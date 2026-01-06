# Claude Code Guidelines for Stel/Moodlayer

## Table of Contents
1. [Project Overview](#project-overview)
2. [Development Setup](#development-setup)
3. [Deployment](#deployment)
4. [Database](#database)
5. [AI Systems](#ai-systems)
6. [Notes for Later](#notes-for-later)

---

# Project Overview

## Project Structure

```
TML/
├── frontend/          # Next.js frontend
│   └── src/
│       ├── components/
│       │   └── ui/    # Reusable UI components
│       ├── hooks/     # Custom React hooks
│       └── stores/    # Zustand stores
├── backend/           # Vercel serverless functions
│   ├── api/           # API endpoints
│   └── sdk/           # Internal SDKs
│       ├── productEnrichment/
│       ├── searchEngine/
│       ├── imageEmbedding/
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
- Design system colors: `var(--primary)`, `var(--surface)`, `var(--foreground)`, etc.

---

# Development Setup

## CLI Tools Reference

These tools are used for development, deployment, and database management. All are authenticated and ready to use.

### Git
- **Location:** Standard PATH
- **Version:** 2.51.2
- **Usage:** Standard git commands work directly

### GitHub CLI (gh)
- **Location:** `C:\Program Files\GitHub CLI\gh.exe`
- **Version:** 2.83.2
- **Note:** May need full path if not in shell PATH
- **Common Commands:**
  ```bash
  gh pr create --title "Title" --body "Description"
  gh pr list
  gh pr view 123
  gh pr merge 123
  ```

### Vercel CLI
- **Access:** Via `npx vercel`
- **Version:** 50.1.3
- **Common Commands:**
  ```bash
  cd backend && npx vercel ls          # List deployments
  npx vercel inspect <deployment-url>  # Inspect deployment
  npx vercel inspect <id> --logs       # Get build logs
  npx vercel                           # Deploy preview
  npx vercel --prod                    # Deploy to production
  ```

### Supabase CLI
- **Access:** Via `npx supabase`
- **Version:** 2.71.0
- **Common Commands:**
  ```bash
  npx supabase login
  npx supabase link --project-ref <project-id>
  npx supabase db push
  npx supabase gen types typescript --project-id <id> > types/supabase.ts
  npx supabase functions logs
  ```

### Notes on CLI Usage
- **npx tools** (Vercel, Supabase): Use project-local or cached versions, no global install needed
- **GitHub CLI**: Installed globally, may need full path in some shells
- **Authentication**: All tools are already authenticated in this environment

---

## Git Workflow

**Always use feature branches + PRs** for all changes (not direct commits to master).

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `chore/description` - Maintenance tasks

### Workflow
1. Create branch: `git checkout -b feature/xyz`
2. Make changes and commit
3. Push branch: `git push -u origin feature/xyz`
4. Create PR with summary and test plan
5. User reviews and merges

### Benefits
- Clear history of all features in PR list
- Easy to revert entire features
- Code review opportunity before merge
- Better traceability for debugging

---

## Pre-Commit Verification Checklist

Before presenting any code changes as complete, verify:

### 1. Code Review
- [ ] All imports are correct and used
- [ ] No syntax errors or TypeScript issues
- [ ] Consistent styling with existing codebase
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
- [ ] Uses design system colors
- [ ] Responsive considerations for different panel sizes
- [ ] Hover/focus states for interactive elements
- [ ] Consistent spacing and typography

---

## Testing New Features

When implementing new features, spawn a test agent to verify:
- Component renders without errors
- User interactions work as expected
- API calls succeed with proper payloads
- Edge cases are handled gracefully

---

# Deployment

## Vercel Configuration

This is a monorepo with two separate Vercel projects:
- **Backend** (backend-tml.vercel.app): Serverless API functions
- **Frontend** (frontend-tml.vercel.app): Next.js application

### Required Dashboard Settings
Both projects MUST have their **Root Directory** configured:
- Backend project → Settings → General → Root Directory: `backend`
- Frontend project → Settings → General → Root Directory: `frontend`

If root directory is not set, Vercel will run from repo root and use root `package.json`, which causes cross-project build failures.

### Environment Variables

**Backend project needs:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`

**Frontend project needs:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (points to backend-tml.vercel.app)

### Debugging Deployments

```bash
cd backend && npx vercel ls                              # List deployments
npx vercel inspect <deployment-url>                      # Inspect deployment
npx vercel inspect dpl_CncGhe1r5pWkZgUNYawUSnUDzciN --logs  # Get build logs
```

### Common Issues

**"supabaseUrl is required" in backend build:**
- Cause: Backend project is building from repo root, triggering frontend build
- Fix: Set Root Directory to `backend` in Vercel dashboard

**Frontend cancelled:**
- Cause: Usually linked to backend failure in same push
- Fix: Fix backend first, frontend will build on next push

**ignoreCommand not working:**
- Each project's `vercel.json` has `ignoreCommand` to skip builds when that folder hasn't changed
- Only works when Root Directory is properly set

---

# Database

## Tables

| Table | Purpose |
|-------|---------|
| `enriched_products` | Stored enriched product data |
| `color_mapping` | Hex to fashion color name mapping (100+ colors) |
| `tag_feedback` | User corrections for tag AI learning |
| `layout_feedback` | User adjustments for layout AI learning |
| `label_feedback` | Label placement corrections |

## SQL Migrations

Run these migrations in Supabase SQL Editor:
1. `backend/sdk/migrations/complete_migration.sql` (creates all tables)
2. `backend/sdk/migrations/enable_rls_policies.sql` (enables Row Level Security)

## Security (Row Level Security)

All tables have RLS enabled with these policies:

| Table | Read | Write |
|-------|------|-------|
| `enriched_products` | Public | service_role |
| `color_mapping` | Public | service_role |
| `tag_feedback` | service_role | service_role |
| `layout_feedback` | service_role | service_role |
| `label_feedback` | service_role | service_role |

The backend API uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for writes.

---

# AI Systems

## Overview: AI Enrichment Flow

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

---

## Color Extraction System

### Architecture Decision
- **DO NOT** rely on AI vision for color accuracy (AI describes colors, doesn't measure them)
- **USE** pixel-level color extraction for accurate hex codes
- **MAP** hex codes to fashion-friendly names via database lookup

### Implementation
The enrichment pipeline (`/api/ai?action=enrich`) now:
1. **First** extracts colors from the product image using pixel-level analysis (sharp library)
2. **Then** calls AI for semantic understanding (tags, category, material, texture)
3. **Merges** pixel-accurate colors with AI-generated metadata

### API Response Fields
- `color_extraction`: "pixel-accurate" | "ai-fallback" | "demo-fallback"
- `color_hex_codes`: Array of actual hex values extracted from image
- `product.color_palette`: Fashion-friendly color names (mapped from hex codes)

### Components
- `colorExtractor.ts` - Extracts dominant colors via pixel sampling (k-means clustering)
  - `extractColorsFromImage()` - Gets raw pixel data, clusters colors
  - `mapColorsToNames()` - Maps hex codes to fashion names via Supabase
  - `extractAndNameColors()` - Full pipeline combining both
- `color_mapping` table - Maps hex codes to descriptive names
- `find_closest_color()` SQL function - Finds nearest named color for any hex

### Color Naming Hierarchy
1. `hex_code`: Exact color value (e.g., "#2C3E50")
2. `basic_name`: Simple name (e.g., "blue")
3. `descriptive_name`: Detailed name (e.g., "dark slate blue")
4. `fashion_name`: Industry term (e.g., "slate")

---

## AI Feedback Loop (Tags)

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
See [Notes for Later](#4-periodic-model-fine-tuning) section.

---

## Layout Feedback System

The vision AI learns from user layout adjustments through a similar feedback loop.

### How It Works
1. AI generates initial layout with product positions and label placements
2. User adjusts positions, sizes, or label locations
3. On export/save, frontend submits adjustments to `/api/ai?action=layout-feedback`
4. AI uses past corrections for few-shot learning in future layouts

### Layout Feedback Database
`layout_feedback` table stores:
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

**State Tracking** (`/looks/[collectionSlug]/page.tsx`):
- `aiGeneratedLayout`: Stores the original AI-generated layout
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

### Database Views
- `layout_position_patterns`: Common adjustments by layout type
- `successful_layouts`: Exported layouts with minimal corrections
- `category_layout_preferences`: Best layouts for product category combos
- `label_placement_patterns`: Where users prefer labels by category

---

# Notes for Later

## 1. Background Removal - DISABLED FOR NOW
**Status:** Temporarily disabled while perfecting product detection
**Context:** Background removal should be the LAST step in the image upload process, happening AFTER product detection and other processing steps.
**Action Required:** Once product detection is perfected, re-enable background removal as the final step in the upload pipeline.
**Priority:** Pick this up after product detection is complete.

---

## 2. AI Vision for Texture/Material Analysis
**Status:** Not started
**Context:** Current color extraction uses pixel-level analysis which is accurate for colors but doesn't understand textures or materials.
**Action Required:** Add OpenAI GPT-4 Vision or Google Gemini for texture/material analysis (leather, silk, wool, etc.).
**Priority:** Medium - enhances enrichment quality.

---

## 3. Client-Side Color Picking
**Status:** Not started
**Context:** Currently colors are extracted server-side during enrichment.
**Action Required:** Implement client-side canvas-based color picking for real-time feedback during product upload.
**Priority:** Low - nice-to-have UX improvement.

---

## 4. Periodic Model Fine-tuning
**Status:** Not started (Layer 3 of AI Learning System)
**Context:** Currently using few-shot learning from `tag_feedback` table. This works but has limits.
**Action Required:**
- Aggregate feedback data monthly
- Fine-tune a model on correction patterns
- Deploy as custom enrichment model
**Priority:** Low - requires significant feedback data first.

---

## 5. Time-Context Personalization
**Status:** Not started
**Context:** The home page shows time of day with generic suggestions (e.g., "Evening" → "dinner, dates").
**Action Required:** Adapt to user's personal schedule:
- Allow users to set their typical schedule in Settings (work hours, gym time, etc.)
- Integrate with calendar APIs (Google Calendar, Outlook) for real context
- Use ML to learn user patterns from app usage (when they create layers, what types)
- Combine time + weather + schedule for smart layer suggestions
- Store schedule preferences in user settings (useSettingsStore)
**Priority:** Low - future personalization feature.

---

## 6. Settings UI for Location Override
**Status:** Not started
**Context:** WeatherWidget now uses browser geolocation (navigator.geolocation) with IP fallback. Location is cached in useSettingsStore.
**Action Required:** Add a "Location" section to Settings page allowing users to:
- See their detected location
- Manually type a city name to override
- Clear cached location to re-detect
**Priority:** Low - nice-to-have UX improvement.

---

## 7. User-Configurable API Keys
**Status:** Not started
**Context:** Currently AI features (enrichment, chat, search) use backend API keys. Users may want to use their own keys for higher rate limits, cost control, or privacy.
**Action Required:**
- Add "AI Settings" section to Settings page
- Allow users to input their own API keys (OpenAI, Anthropic, Google Gemini)
- Secure storage options (encrypted in Supabase or localStorage)
- UI: Show masked key with "Edit" button, "Test" button to verify
- Backend: Accept user API key in request headers, fall back to system keys
**Priority:** Medium - enables power users and reduces backend costs.

---

## 8. DB-Based Auto-Tagging for Basics
**Status:** Not started
**Context:** Current image embedding similarity (Issue 1) compares uploaded products to user's existing closet items. This is great for finding duplicates during upload.

However, there's a different use case: auto-tagging "basics" is a harder problem best left for the user to define metadata.

**Key Insight:** Unique items should be user-defined.

**Priority:** Medium.
