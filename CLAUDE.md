# Claude Code Guidelines for Stel/Moodlayer

## Table of Contents
1. [Project Overview](#project-overview)
2. [Development Setup](#development-setup)
3. [Deployment](#deployment)
4. [Database](#database)
5. [AI Systems](#ai-systems)
6. [Testing](#testing)
7. [Work Tracking](#work-tracking)
8. [Notes for Later](#notes-for-later)

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

## Code Style

### General Rules
- Use TypeScript with strict types
- Use CSS custom properties for theming (`var(--primary)`, `var(--foreground)`, etc.)
- API calls should have action-based error messages

### Error Messages
Error messages should be action-oriented:

| Bad | Good |
|-----|------|
| "Failed to fetch" | "Unable to connect to server. Check your internet connection and try again." |
| "Error" | "Could not save changes. Please try again." |

## Key Patterns

### API Calls
- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- All API routes under `/api/`
- Use proper error handling with try/catch

### State Management (Frontend)
- Zustand for global state
- Local React state for component-specific UI state
- Side panel context for panel state management

### Styling
- CSS variables for theming (defined in globals.css)
- Inline styles for dynamic values
- Tailwind for utility classes
- Design system colors: `var(--primary)`, `var(--surface)`, `var(--foreground)`, etc.

### UI Design Rules (IMPORTANT)
1. **No Decorative Gradients**: Do not use CSS gradients for backgrounds, buttons, or decorative elements unless explicitly requested by the user.
   - **ALLOWED**: Functional gradients (image overlays for text readability, crop masks, fading dividers)
   - **NOT ALLOWED**: Decorative gradients (card backgrounds, button fills, section backgrounds)
   - Use solid `rgba()` colors instead. Example: `rgba(76, 112, 49, 0.1)` for a light green tint.
2. **No Decorative Shadows**: Avoid box-shadows for purely decorative purposes. Only use subtle shadows for functional elevation (modals, dropdowns).
3. **Flat Design**: Prefer flat, clean design over skeuomorphism or excessive depth.
4. **Typography**:
   - Headlines use Cormorant font with italic style
   - Body text uses Jost font (default)
   - Use CSS variable: `fontFamily: 'var(--font-cormorant)'`

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

### Shopify CLI
- **Access:** Via `npx shopify` (from project root or backend directory)
- **Version:** Latest via npx
- **Common Commands:**
  ```bash
  npx shopify app info                    # Show app info and config
  npx shopify app dev                     # Start dev server with ngrok tunnel
  npx shopify app deploy                  # Deploy app to Shopify
  npx shopify app function logs           # View function logs
  npx shopify app env show                # Show environment config
  npx shopify webhook list                # List registered webhooks
  npx shopify webhook trigger <topic>     # Trigger test webhook
  ```
- **Configuration File:** `backend/shopify.app.toml`
- **Webhook Topics:** products/create, products/update, products/delete, inventory_levels/update, app/uninstalled
- **Webhook URL:** `https://backend-tml.vercel.app/api/shopify-webhooks`

### Notes on CLI Usage
- **npx tools** (Vercel, Supabase, Shopify): Use project-local or cached versions, no global install needed
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

### Core Product Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `enriched_products` | Main product data with AI-enriched metadata | ✅ Wired |
| `products` | Raw product data (before enrichment) | ⚠️ LEGACY - Remove |
| `color_mapping` | Hex to fashion color name mapping (100+ colors) | ✅ Wired |
| `user_collections` | User's saved collections | ✅ Wired |

**Note:** `products` table is obsolete. Code goes directly to `enriched_products`. Only remnant use is for `cutout_url` in image-processing.ts which should be migrated.

### Shopify Integration
| Table | Purpose | Status |
|-------|---------|--------|
| `shopify_sessions` | OAuth tokens and shop connections | ✅ Wired |
| `shopify_sync_logs` | Product sync history and status | ✅ Wired |
| `shopify_uninstall_log` | App uninstall events for debugging | ✅ Wired |

### AI Feedback & Learning
| Table | Purpose | Status |
|-------|---------|--------|
| `tag_feedback` | User corrections for tag AI learning | ✅ Wired |
| `layout_feedback` | User adjustments for layout AI learning | ✅ Wired (on export) |
| `label_feedback` | Label placement corrections | ⚡ SDK Ready |
| `detection_feedback` | Product detection bounding box corrections | ✅ Wired (image-processing) |

**Note on `tag_feedback`:**
- ✅ Tag editing UI in `ScrapeUrlContent.tsx` (scrape flow) with +Add and X buttons
- ✅ Tag editing UI in closet Edit modal (`page.tsx`) with TagList + add/remove buttons
- ✅ Both locations call `submitTagFeedback()` to populate the `tag_feedback` table
- Implemented in PR #34

### Photo Upload & Processing
| Table | Purpose | Status |
|-------|---------|--------|
| `uploads` | Uploaded image metadata and processing status | ⚡ SDK Ready |
| `cutouts` | Storage bucket for background-removed images | ⚡ SDK Ready |

**Note:** `cutouts` is a Supabase **storage bucket**, not a table. Used for background removal (OpenAI images.edit API). SDK: `photoUpload/uploadProcessor.ts`

### Moodboards & Compositions
| Table | Purpose | Status |
|-------|---------|--------|
| `moodboards` | User-created moodboard metadata | ✅ Wired |
| `moodboard_compositions` | Rendered moodboard layouts | ⚡ SDK Ready |
| `boards` | Collaboration boards | ❌ Not Implemented |
| `board_drafts` | Draft board states | ⚡ SDK Ready |
| `layouts` | Saved layout templates | ⚡ SDK Ready |
| `exports` | Export history | ⚡ SDK Ready |

### Social & Sharing
| Table | Purpose | Status |
|-------|---------|--------|
| `social_shares` | Social media share tracking | ⚡ SDK Ready |
| `share_events` | Share event analytics | ⚡ SDK Ready |
| `export_links` | Shareable link generation | ⚡ SDK Ready |
| `link_access_events` | Link access analytics | ⚡ SDK Ready |

**Note:** SDK exists in `socialExport/`. Needs frontend share button integration.

### Brand Dashboard (B2B)
| Table | Purpose | Status |
|-------|---------|--------|
| `brands` | Brand accounts | ⚡ SDK Ready |
| `brand_sessions` | Brand auth sessions | ⚡ SDK Ready |
| `brand_integrations` | Brand platform connections | ⚡ SDK Ready |
| `upload_logs` | Brand CSV upload history | ⚡ SDK Ready |

**Note:** Full B2B portal SDK in `brandDashboard/`. Needs dedicated /brand frontend route.

### Plugin Sync (Canva, WooCommerce, etc.)
| Table | Purpose | Status |
|-------|---------|--------|
| `plugin_syncs` | Plugin sync jobs | ⚡ SDK Ready |
| `plugin_sync_logs` | Sync operation logs | ⚡ SDK Ready |
| `plugin_credentials` | Plugin API credentials (encrypted) | ⚡ SDK Ready |
| `sync_logs` | General sync logs | ⚡ SDK Ready |
| `sync_errors` | Sync error tracking | ⚡ SDK Ready |

**Note:** SDK exists in `pluginBridge/`. Supports Canva, WooCommerce, Shopify plugins.

### Security & Audit
| Table | Purpose | Status |
|-------|---------|--------|
| `api_audit_log` | API request audit trail | ⚡ SDK Ready |

**Note:** Implemented in Supabase Edge Function `secure-api/index.ts`. Logs operation, table, user_id, ip_address, request_data, response_status, duration_ms.

### Database Views (Analytics - Not Tables)
These are PostgreSQL **views** that aggregate data from tables above. They show as "tables" in Supabase UI but are read-only.

| View | Source Table | Purpose |
|------|--------------|---------|
| `tag_correction_patterns` | `tag_feedback` | AI learning patterns |
| `tag_addition_patterns` | `tag_feedback` | AI learning patterns |
| `layout_position_patterns` | `layout_feedback` | AI learning patterns |
| `successful_layouts` | `layout_feedback` | High-quality examples |
| `category_layout_preferences` | `layout_feedback` | Category preferences |
| `label_placement_patterns` | `label_feedback` | Label position patterns |
| `detection_error_patterns` | `detection_feedback` | Detection accuracy |
| `detection_position_patterns` | `detection_feedback` | Position correction patterns |
| `detection_size_patterns` | `detection_feedback` | Size correction patterns |

### Status Legend
- ✅ **Wired** - Frontend calls backend, data flows to table
- ⚡ **SDK Ready** - Backend SDK exists, needs frontend integration
- ⚠️ **LEGACY** - Should be removed/migrated
- ❌ **Not Implemented** - No SDK or frontend code

## SQL Migrations

Run these migrations in Supabase SQL Editor:
1. `backend/sdk/migrations/complete_migration.sql` (creates all tables)
2. `backend/sdk/migrations/enable_rls_policies.sql` (enables Row Level Security)

## Security (Row Level Security)

### Standard RLS Pattern
All tables should have RLS enabled. Use this pattern:

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Public read, service_role write (for public data like products)
CREATE POLICY "Public read" ON table_name FOR SELECT USING (true);
CREATE POLICY "Service write" ON table_name FOR ALL USING (auth.role() = 'service_role');

-- Service-only (for sensitive data like sessions, credentials)
CREATE POLICY "Service only" ON table_name FOR ALL USING (auth.role() = 'service_role');
```

### Current RLS Policies

| Table | Read | Write | Notes |
|-------|------|-------|-------|
| `enriched_products` | Public | service_role | Products visible to all |
| `color_mapping` | Public | service_role | Reference data |
| `tag_feedback` | service_role | service_role | Internal AI data |
| `layout_feedback` | service_role | service_role | Internal AI data |
| `label_feedback` | service_role | service_role | Internal AI data |
| `detection_feedback` | service_role | service_role | Internal AI data |
| `shopify_sessions` | service_role | service_role | Contains tokens |
| `plugin_credentials` | service_role | service_role | Contains secrets |

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

# Testing

## Philosophy

**Do not make band-aid fixes.** When tests fail:

1. **Dig deep** - Don't just fix the symptom to make the error go away
2. **Find the root cause** - Trace back to where the actual problem originates
3. **Fix at the point of inflection** - The fix should address the underlying issue, not patch around it

The goal is a codebase where tests genuinely validate behavior, not tests that are constantly adjusted to match bugs.

## Shared Selectors (Single Source of Truth)

When component selectors change, update in **ONE** place:

| File | Purpose |
|------|---------|
| `frontend/src/constants/testSelectors.ts` | Complete selector definitions |
| `frontend/cypress/support/commands.ts` | SELECTORS export for E2E tests |

```typescript
import { SELECTORS } from '../support/commands';

cy.get(SELECTORS.search.trigger).click();
cy.get(SELECTORS.search.input).should('be.visible');
```

## Test Files

| Type | Location | Tool |
|------|----------|------|
| Unit tests | `frontend/src/**/*.test.ts` | Jest |
| E2E tests | `frontend/cypress/e2e/*.cy.ts` | Cypress |
| Layout tests | `frontend/tests/**/*.spec.ts` | Playwright |

## Extracted Logic for Unit Testing

Complex logic is extracted into testable utilities:

| File | Purpose |
|------|---------|
| `frontend/src/utils/breadcrumbs.ts` | Pure functions for breadcrumb logic |
| `frontend/src/constants/theme.ts` | `getTopbarColors()`, `getAgentModeColors()` |

---

# Work Tracking

**MANDATORY RULE:** Every feature, fix, enhancement, or change MUST have:
1. A GitHub Issue to track the work
2. A Pull Request to implement the work
3. PR merged only after review

This ensures all work is traceable, reviewable, and can be reverted if needed.

**Note:** All `gh` commands use the full path (`"C:\Program Files\GitHub CLI\gh.exe"`) for Windows compatibility since it may not be in the shell PATH.

---

## The Golden Rule

**No direct commits to main.** Every change—no matter how small—goes through:
1. **Issue** → Document what needs to be done
2. **Branch** → Isolate the work
3. **PR** → Review and merge

This creates a complete audit trail of all work done on the project.

---

## Feature Workflow

When starting a new feature:

### Step 1: Create Feature Issue
Create an issue to define scope and track progress.

```bash
"C:\Program Files\GitHub CLI\gh.exe" issue create --repo ramsaptami/TML \
  --title "[FEATURE] Brief description" \
  --body "$(cat <<'EOF'
## Overview
What is this feature and why do we need it?

## User Story
As a [user type], I want [goal] so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Approach
High-level implementation plan:
1. Step one
2. Step two
3. Step three

## Files to Create/Modify
- `path/to/file1.ts` - Description
- `path/to/file2.ts` - Description

## Dependencies
- Any blockers or prerequisites

## Out of Scope
What this feature will NOT include (to prevent scope creep).

## Labels
feature, [priority], [area]
EOF
)"
```

### Step 2: Create Feature Branch and PR
Create the branch and immediately open a draft PR to track progress.

```bash
git checkout -b feature/issue-XX-description
git push -u origin feature/issue-XX-description

"C:\Program Files\GitHub CLI\gh.exe" pr create --repo ramsaptami/TML \
  --title "feat: Brief description" \
  --body "$(cat <<'EOF'
## Summary
Brief description of what this PR implements.

Closes #ISSUE_NUMBER

## Changes
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## Screenshots/Demo
(Add screenshots or GIFs if UI changes)

## Test Plan
- [ ] Test case 1
- [ ] Test case 2

## Checklist
- [ ] TypeScript compiles without errors
- [ ] Tests pass
- [ ] No console errors in browser
- [ ] Responsive design verified
EOF
)" --draft
```

### Step 3: Implement and Update
1. Make commits referencing the issue: `feat(area): description (#XX)`
2. Update PR description as work progresses
3. Mark PR ready for review when complete

### Step 4: Review and Merge
1. User reviews PR
2. Address any feedback
3. Squash and merge when approved
4. Issue auto-closes via "Closes #XX" keyword

---

## Bug Workflow

When a bug is reported:

### Step 1: Create Bug Issue
```bash
"C:\Program Files\GitHub CLI\gh.exe" issue create --repo ramsaptami/TML \
  --title "[BUG] Brief description" \
  --body "$(cat <<'EOF'
## Description
Clear description of the bug and its impact.

## Steps to Reproduce
1. Step one
2. Step two
3. Observe the issue

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Root Cause Analysis
- Where in the code does this originate?
- What conditions trigger it?

## Files Affected
- `path/to/file1.ts`
- `path/to/file2.ts`

## Proposed Fix
Description of the fix approach.

## Testing Checklist
- [ ] Test case 1
- [ ] Test case 2

## Labels
bug, [priority], [area]
EOF
)"
```

### Step 2: Fix and Create PR
```bash
git checkout -b fix/issue-XX-description
# ... make fixes ...
git push -u origin fix/issue-XX-description

"C:\Program Files\GitHub CLI\gh.exe" pr create --repo ramsaptami/TML \
  --title "fix: Brief description" \
  --body "$(cat <<'EOF'
## Summary
Brief description of the fix.

Fixes #ISSUE_NUMBER

## Root Cause
What was causing the bug.

## Solution
How this PR fixes it.

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Verified fix resolves the issue
- [ ] No regression in related functionality
EOF
)"
```

### Step 3: Review and Merge
1. User reviews PR
2. Merge when approved
3. Issue auto-closes via "Fixes #XX" keyword

### Step 4: Reopen if Issue Recurs
If the same bug reappears:
1. Reopen the original issue (not a new one)
2. Add comment documenting the recurrence
3. Label as `repeat-issue` for pattern tracking

```bash
"C:\Program Files\GitHub CLI\gh.exe" issue reopen ISSUE_NUMBER --repo ramsaptami/TML
"C:\Program Files\GitHub CLI\gh.exe" issue comment ISSUE_NUMBER --repo ramsaptami/TML \
  --body "## Recurrence Report

**Date:** $(date +%Y-%m-%d)
**Context:** How the bug reappeared

**Why Previous Fix Didn't Hold:**
- Root cause analysis

**Additional Fix Applied:**
- What was done this time"
```

---

## Enhancement/Refactor Workflow

For improvements to existing functionality:

### Create Enhancement Issue and PR
```bash
"C:\Program Files\GitHub CLI\gh.exe" issue create --repo ramsaptami/TML \
  --title "[ENHANCEMENT] Brief description" \
  --body "$(cat <<'EOF'
## Current Behavior
How it works now.

## Proposed Improvement
What should change and why.

## Benefits
- Benefit 1
- Benefit 2

## Implementation Plan
1. Step one
2. Step two

## Labels
enhancement, [priority], [area]
EOF
)"

git checkout -b refactor/issue-XX-description
# or
git checkout -b enhance/issue-XX-description
```

---

## Chore/Maintenance Workflow

For dependency updates, config changes, CI/CD work:

```bash
"C:\Program Files\GitHub CLI\gh.exe" issue create --repo ramsaptami/TML \
  --title "[CHORE] Brief description" \
  --body "$(cat <<'EOF'
## Task
What maintenance work needs to be done.

## Reason
Why this is needed now.

## Changes
- Change 1
- Change 2

## Labels
chore, [priority]
EOF
)"

git checkout -b chore/issue-XX-description
```

---

## Issue Labels

| Label | Use Case |
|-------|----------|
| **Type** | |
| `feature` | New functionality |
| `bug` | Something broken |
| `enhancement` | Improvement to existing feature |
| `refactor` | Code restructuring |
| `chore` | Maintenance/dependencies |
| `docs` | Documentation updates |
| **Priority** | |
| `critical` | Production-breaking, fix immediately |
| `high` | Important, fix soon |
| `medium` | Normal priority |
| `low` | Nice to have |
| **Area** | |
| `frontend` | Frontend/UI work |
| `backend` | Backend/API work |
| `ai` | AI/ML related |
| `ui` | Visual/design |
| `data-quality` | Data integrity |
| `infra` | Infrastructure/CI/CD |
| **Status** | |
| `in-progress` | Actively being worked on |
| `blocked` | Waiting on something |
| `needs-review` | PR ready for review |
| `repeat-issue` | Bug that recurred |

---

## Quick Reference Commands

```bash
# List all open issues
"C:\Program Files\GitHub CLI\gh.exe" issue list --repo ramsaptami/TML

# List by type
"C:\Program Files\GitHub CLI\gh.exe" issue list --repo ramsaptami/TML --label feature
"C:\Program Files\GitHub CLI\gh.exe" issue list --repo ramsaptami/TML --label bug
"C:\Program Files\GitHub CLI\gh.exe" issue list --repo ramsaptami/TML --label enhancement

# List open PRs
"C:\Program Files\GitHub CLI\gh.exe" pr list --repo ramsaptami/TML

# View specific issue/PR
"C:\Program Files\GitHub CLI\gh.exe" issue view ISSUE_NUMBER --repo ramsaptami/TML
"C:\Program Files\GitHub CLI\gh.exe" pr view PR_NUMBER --repo ramsaptami/TML

# Check PR status (CI checks)
"C:\Program Files\GitHub CLI\gh.exe" pr checks PR_NUMBER --repo ramsaptami/TML
```

---

## Common Bug Patterns

Track recurring issues here to identify systemic problems:

| Pattern | Description | Prevention |
|---------|-------------|------------|
| AI-invented data | AI generates fake data instead of null | Use validation utilities (e.g., `brandValidation.ts`) |
| Type mismatches | TypeScript types don't match runtime | Add runtime validation at boundaries |
| Missing null checks | Undefined access errors | Use optional chaining, add guards |
| State sync issues | Frontend/backend state diverges | Add consistency checks |

---

## Label Setup

Labels are defined in `.github/labels.yml`. To sync labels to GitHub:

1. **Automatic:** Push changes to `.github/labels.yml` - the sync-labels workflow runs automatically
2. **Manual:** Go to Actions tab → "Sync Labels" → "Run workflow"

Or create labels manually via CLI:

```bash
# Type labels
gh label create feature --color 0E8A16 --description "New functionality" --repo ramsaptami/TML
gh label create bug --color D73A4A --description "Something isn't working" --repo ramsaptami/TML
gh label create enhancement --color A2EEEF --description "Improvement to existing functionality" --repo ramsaptami/TML
gh label create refactor --color 7057FF --description "Code restructuring" --repo ramsaptami/TML
gh label create chore --color FEF2C0 --description "Maintenance, dependencies" --repo ramsaptami/TML
gh label create docs --color 0075CA --description "Documentation updates" --repo ramsaptami/TML

# Priority labels
gh label create critical --color B60205 --description "Production-breaking" --repo ramsaptami/TML
gh label create high --color D93F0B --description "Important, fix soon" --repo ramsaptami/TML
gh label create medium --color FBCA04 --description "Normal priority" --repo ramsaptami/TML
gh label create low --color C2E0C6 --description "Nice to have" --repo ramsaptami/TML

# Area labels
gh label create frontend --color 1D76DB --description "Frontend/UI work" --repo ramsaptami/TML
gh label create backend --color 5319E7 --description "Backend/API work" --repo ramsaptami/TML
gh label create ai --color BFDADC --description "AI/ML related" --repo ramsaptami/TML
gh label create infra --color E4E669 --description "Infrastructure/CI/CD" --repo ramsaptami/TML

# Status labels
gh label create in-progress --color EDEDED --description "Work in progress" --repo ramsaptami/TML
gh label create blocked --color B60205 --description "Waiting on external dependency" --repo ramsaptami/TML
gh label create needs-review --color 0E8A16 --description "Ready for code review" --repo ramsaptami/TML
gh label create repeat-issue --color D73A4A --description "Issue that has recurred" --repo ramsaptami/TML
```

---

## Documentation Requirements

**MANDATORY:** When making significant changes to the codebase, Claude MUST:

1. **Update claude.md** if the change affects:
   - Project structure or architecture
   - Database schema or new tables
   - API endpoints or SDK functions
   - Development workflows or tooling
   - Bug patterns or known issues

2. **Add code comments** that explain:
   - WHY the code exists, not just WHAT it does
   - Complex business logic or algorithms
   - Non-obvious decisions or workarounds
   - Integration points with external services

3. **Link issues and PRs** to maintain traceability:
   - Every PR must reference an issue
   - Commits should include issue numbers
   - Close issues when work is complete

4. **Prevent loops** by documenting:
   - Root causes of bugs (in the issue AND code comments)
   - Known edge cases and how they're handled
   - Previous approaches that didn't work (so we don't retry them)

### Why This Matters

Without proper documentation:
- We fix the same bug multiple times
- We forget why certain code exists
- Onboarding to areas of the codebase is painful
- We make the same architectural mistakes repeatedly

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

---

## 9. Upstash Redis for Rate Limiting (Optional)
**Status:** Not required now
**Context:** The rate limiter in `backend/sdk/shared/middleware.ts` currently uses in-memory storage with automatic fallback. This works perfectly fine for early-stage apps with low-to-moderate traffic. In serverless (Vercel), each function instance has its own memory, so rate limits are "best effort" rather than exact—but this is acceptable for most use cases.

**When to Set Up:** Only needed if:
- App has high traffic requiring strict rate limiting
- You need accurate rate limiting across all serverless instances
- You're experiencing abuse that in-memory limits can't catch

**Action Required:**
1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database (free tier: 10K commands/day)
3. Copy the REST URL and REST Token from the database details
4. Add to backend `.env` and Vercel environment variables:
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxx
   ```
5. The middleware will automatically use Redis when these variables are present

**Priority:** Low - only needed at scale.

---

## 10. Shopify Product Enrichment - Immediate Trigger

**Status:** Planned

**Context:** Currently, product enrichment runs via GitHub Actions cron every 15 minutes. For better UX, we should trigger enrichment immediately after a Shopify sync completes.

**Implementation:**
1. Create a GitHub Personal Access Token (PAT) with `repo` scope
2. Add `GITHUB_TOKEN` to Vercel environment variables
3. In `handleSyncRedirect` (shopify.ts), after successful sync:
   ```typescript
   // Fire GitHub Action (non-blocking)
   fetch('https://api.github.com/repos/ramsaptami/TML/dispatches', {
     method: 'POST',
     headers: {
       'Authorization': `token ${process.env.GITHUB_TOKEN}`,
       'Accept': 'application/vnd.github.v3+json',
     },
     body: JSON.stringify({
       event_type: 'enrich-products',
       client_payload: { shop: shopDomain }
     })
   }).catch(e => console.error('GitHub dispatch failed:', e));
   ```
4. The workflow `.github/workflows/enrich-products.yml` already has `repository_dispatch` trigger configured

**Why deferred:** Requires PAT setup which has security considerations for token storage.

**Priority:** Low

---

## 11. Secure Google Custom Search API Key Before Production

**Status:** TODO before launch

**Context:** The Google Custom Search API key (`GOOGLE_CUSTOM_SEARCH_API_KEY`) is currently unrestricted for development. Before going live, it needs to be secured.

**Action Required:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Edit the "Google custom search key for TML" API key
3. Under **Application restrictions**:
   - For production: Consider "HTTP referrers" if calling from frontend, or keep "None" for backend-only
4. Under **API restrictions**:
   - Select "Restrict key"
   - Choose only "Custom Search API"
5. Save changes

**Why important:** An unrestricted API key could be abused if leaked, incurring unexpected costs or hitting rate limits.

**Priority:** High (before production launch)
