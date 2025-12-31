# CLAUDE.md - Project Context for AI Assistants

## Project Overview

**TML - The Mood Layer** is a full-stack AI-powered moodboard platform for curating and visualizing product collections. It enables brands and users to create beautiful, shoppable moodboards with intelligent product enrichment and layout generation.

---

## Architecture

### Folder Structure

```
stel/
├── frontend/                 # Next.js 16 + React 19 web app
│   └── src/
│       ├── app/              # Next.js App Router pages
│       │   ├── admin/        # Admin dashboard
│       │   ├── closet/       # User wardrobe
│       │   ├── collections/  # Collection pages
│       │   ├── discover/     # Discovery/browse
│       │   ├── looks/        # Moodboard pages
│       │   ├── onboarding/   # User onboarding
│       │   └── settings/     # User preferences
│       ├── components/       # Reusable React components
│       ├── hooks/            # Custom React hooks
│       ├── stores/           # Zustand state management
│       ├── lib/              # External integrations (Supabase)
│       ├── types/            # TypeScript definitions
│       └── utils/            # Utility functions
│
├── backend/                  # Node.js + Express + Vercel Functions
│   ├── api/                  # Serverless API endpoints
│   │   ├── ai.ts             # AI enrichment
│   │   ├── ai-status.ts      # AI provider health (24h cache)
│   │   ├── search.ts         # Product search
│   │   ├── shopify.ts        # Shopify integration
│   │   └── ...
│   └── sdk/                  # Modular SDK (20 modules)
│       ├── productEnrichment/  # Claude AI tagging
│       ├── searchEngine/       # Product discovery
│       ├── layoutGenerator/    # 4 layout archetypes (Minimal, Hero, Dynamic, Collage)
│       ├── layoutAI/           # Smart label placement
│       ├── imageGeneration/    # OpenAI/Gemini image gen
│       ├── exportEngine/       # PNG/JPG export
│       ├── pluginBridge/       # E-commerce integrations
│       ├── brandDashboard/     # Brand management
│       ├── shared/             # Common utilities
│       └── ...
│
├── mobile/                   # React Native + Expo app
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── navigation/
│       └── store/
│
└── integrations/             # E-commerce plugins
    ├── shopify-app/
    └── woocommerce-plugin/
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCT INGESTION                       │
├─────────────────────────────────────────────────────────────┤
│  CSV Upload / Shopify Sync / WooCommerce / Manual Entry     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PRODUCT ENRICHMENT (AI)                        │
├─────────────────────────────────────────────────────────────┤
│  Primary: Claude Opus 4.5                                   │
│  Fallback: Gemini 2.5 Flash                                 │
│  Output: color_palette, tags, texture, material, tone       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   SEARCH & DISCOVERY                        │
├─────────────────────────────────────────────────────────────┤
│  Semantic search, tag filtering, AI-powered query parsing   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              MOODBOARD COMPOSITION                          │
├─────────────────────────────────────────────────────────────┤
│  Layout Generation (4 archetypes + Vision AI)               │
│  Smart Label Placement (Vision AI)                          │
│  Theme Token Extraction                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  IMAGE GENERATION  (AI)                     │
├─────────────────────────────────────────────────────────────┤
│  Moodboard Composition: OpenAI GPT-image-1 → Gemini         │
│  Virtual Try-On: Gemini → OpenAI (fallback)                 │
│  Background Gen: OpenAI → Gemini                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPORT & SHARE                           │
├─────────────────────────────────────────────────────────────┤
│  PNG/JPG/WebP export, Social sharing, Embed codes           │
└─────────────────────────────────────────────────────────────┘
```

### AI Provider Fallback Chains

| Feature | Primary | Fallback |
|---------|---------|----------|
| Product Enrichment | Claude Opus 4.5 | Gemini 2.5 Flash |
| Image Generation | OpenAI GPT-image-1 | Gemini 2.0 Flash Exp |
| Virtual Try-On | Gemini | OpenAI |
| Search Query Parsing | Claude | Gemini |
| Smart Labels | Claude | Gemini |

---

## Coding Conventions

### General

- **TypeScript** everywhere - strict mode enabled
- **Functional components** with hooks (no class components)
- **Zustand** for state management (not Redux)
- **CSS Variables** for theming (defined in globals.css)
- **No emojis** in code/comments unless user requests

### File Naming

```
components/ProductCard.tsx      # PascalCase for components
hooks/usePhotoUpload.ts         # camelCase with 'use' prefix
stores/useLooksStore.ts         # camelCase with 'use' prefix
utils/currency.ts               # camelCase for utilities
types/index.ts                  # Centralized type exports
*.test.ts                       # Test files co-located or in __tests__/
```

### Component Structure

```tsx
'use client';  // Only if needed for Next.js client components

import { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';
import { useSomeStore } from '@/stores/useSomeStore';

interface Props {
  // Props interface defined inline or imported
}

export default function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks first
  const [state, setState] = useState();
  const storeValue = useSomeStore(s => s.value);

  // 2. Effects
  useEffect(() => {}, []);

  // 3. Handlers
  const handleClick = () => {};

  // 4. Render
  return (
    <div style={{ color: 'var(--foreground)' }}>
      {/* Use CSS variables for theming */}
    </div>
  );
}
```

### Backend SDK Pattern

```typescript
/**
 * Module description
 * Primary: Provider A
 * Fallback: Provider B
 */

export class ModuleName {
  private providerA: ProviderA | null;
  private providerB: ProviderB | null;

  constructor(config: ModuleConfig) {
    // Initialize both providers if keys available
    // Ensure at least one is configured
  }

  async doThing(input: Input): Promise<Output> {
    // Try primary first
    if (this.providerA) {
      try {
        return await this.providerA.doThing(input);
      } catch (error) {
        logger.warn('Primary failed, trying fallback');
      }
    }

    // Fallback
    if (this.providerB) {
      return await this.providerB.doThing(input);
    }

    throw new Error('All providers failed');
  }
}
```

### Styling

- Use **CSS variables** from globals.css
- Inline styles preferred for dynamic values
- Tailwind classes for layout/spacing
- Component-scoped styles when needed

```tsx
// Good
<div style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>

// Also good
<div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
```

### Error Handling

```typescript
// Use custom error classes from shared/errors.ts
throw new ValidationError('Invalid input');
throw new ExternalServiceError('OpenAI', 'Rate limited');
throw new ConfigurationError('API key missing');
```

### Page Creation

All pages should follow a consistent header pattern:

```tsx
{/* Page Header */}
<div className="px-8 pt-8 pb-6 max-w-7xl mx-auto flex items-baseline gap-3">
  <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
    Page Title
  </h1>
  <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
    Brief description of the page
  </span>
</div>
```

**Page Header Rules:**
- Heading: `text-3xl font-bold` with `var(--foreground)`
- Subheading: `text-sm` with `var(--foreground-muted)`
- Layout: `flex items-baseline gap-3` (inline, baseline aligned)
- Container: `px-8 pt-8 pb-6 max-w-7xl mx-auto`
- Background: `var(--background)` on page wrapper
- **No stacked layouts** - always use inline baseline alignment

### CTA & Interactive States

All interactive elements (buttons, links, cards) must have three states:

```tsx
{/* Example: Text link with arrow */}
<Link
  href="/destination"
  className="text-sm font-medium transition-all flex items-center gap-1"
  style={{ color: 'var(--primary)' }}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = 'var(--primary-dark)';
    e.currentTarget.style.transform = 'translateX(2px)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = 'var(--primary)';
    e.currentTarget.style.transform = 'translateX(0)';
  }}
  onMouseDown={(e) => {
    e.currentTarget.style.transform = 'translateX(1px) scale(0.98)';
  }}
  onMouseUp={(e) => {
    e.currentTarget.style.transform = 'translateX(2px)';
  }}
>
  View all
  <ArrowRight size={14} />
</Link>
```

**CTA State Rules:**
| State | Visual Change |
|-------|---------------|
| Normal | Base color, no transform |
| Hover | Darker color (`--primary-dark`), subtle movement |
| Active/Clicked | Scale down (0.98), reduced movement |

**Button patterns:**
- Primary: `bg: var(--primary)` → hover: `var(--primary-light)` → active: scale(0.98)
- Secondary: `bg: var(--surface)` → hover: border `var(--primary)` → active: scale(0.98)
- Text links: `color: var(--primary)` → hover: `var(--primary-dark)` + translateX

---

## Brand Colors

```css
/* Primary palette */
--primary: #4c7031;           /* TML Green */
--primary-light: #546c22;     /* Lighter green */
--primary-dark: #3D522D;      /* Darker green - headings, bold typefaces */

/* Neutral palette */
--cream: #F4EFED;             /* Parchment */
--charcoal: #222222;          /* Dark base */

/* Semantic colors */
--success: #4c7031;           /* Primary green */
--warning: #c4a35a;           /* Gold */
--error: #a84032;             /* Red-brown */
--info: #4a7c9b;              /* Blue */
```

### Brand Logo Rules

The TML logo consists of a **circle** and a **pill shape**. Color usage varies by mode:

**Standard Mode:**
| Mode | Circle | Pill |
|------|--------|------|
| Light Mode | charcoal (#222222) | primary-light (#546c22) |
| Dark Mode | cream (#F4EFED) | primary-light (#546c22) |

**Agent Mode Toggle:**
| Mode | Default State | Clicked/Active State |
|------|---------------|---------------------|
| Dark Mode | circle: cream, pill: primary-light | circle: primary-light, pill: cream |
| Light Mode | circle: primary-dark, pill: cream | circle: cream, pill: primary-dark |

**Typography:**
- `--primary-dark` (#3D522D) is used for headings and bold typefaces

### Reserved Color Combo (Secondary)
When updating secondary color, consider this:
-- **#546c22** (deeper forest green)

Current secondary: `#8b6b4a` (warm brown) - used in page.tsx BookHeart icon

---

## High-Level Plan

### Completed

- [x] Core moodboard creation and editing
- [x] Product enrichment with Claude AI
- [x] Shopify integration (OAuth, sync, webhooks)
- [x] 4 layout archetypes for moodboard generation (simplified from 8)
- [x] Smart label placement with Vision AI
- [x] Export to PNG/JPG/WebP
- [x] User authentication (Supabase)
- [x] Settings page with theme selection
- [x] Onboarding flow
- [x] **AI provider fallbacks** (Claude/Gemini/OpenAI)
- [x] **AI status dashboard** on /admin (24h cache)
- [x] Virtual try-on (Gemini primary)
- [x] Mobile app foundation (React Native + Expo)

### In Progress

- [ ] WooCommerce plugin completion
- [ ] Social sharing optimization

### Pending / Planned

- [ ] Collaboration features (real-time editing) NOT PLANNED FOR NOW
- [ ] Advanced search filters UI
- [ ] Brand dashboard analytics NOT PLANNED FOR NOW
- [ ] Subscription/payment integration NOT PLANNED FOR NOW
- [ ] Pinterest-style discovery feed
- [ ] AR try-on for mobile
- [ ] Accessibility audit (WCAG compliance) - Analysis complete, ready for implementation

### Recently Completed

- [x] **Performance optimization** - Implemented lazy loading, caching, and virtualization:
  - Next.js Image with blur placeholders (ProductCard, VirtualizedSidebarProducts)
  - SWR caching for API calls (useProductSearch hook)
  - Virtualized grids for large lists (VirtualizedProductGrid, VirtualizedSidebarProducts)
  - Zustand selector pattern for store subscriptions
  - React.memo on grid components
  - Dynamic imports for modals (SaveToCollectionModal, VirtualTryOnModal, PhotoUploadModal)
- [x] **Test coverage improvement** - 471 tests passing across 12 suites (stores, components, hooks, utils)
- [x] **Cypress E2E testing setup** - Installed with 4 E2E test suites (onboarding, settings, navigation, looks)
- [x] **Fixed failing frontend tests** - Settings page tests now 31 passing
- [x] **AI mode renamed to Agent mode** - Unified terminology across project

---

## Test Coverage Status

### Frontend (Jest + React Testing Library)

```
Total: 12 test suites, 471 tests passing
settings/page.tsx: 31 tests passing
stores/: 4 test files (useSettingsStore, useLooksStore, useCollectionsStore, useUploadStore)
components/: 4 test files (TopBar, Sidebar, ProductCard, AppLayout) - 123 tests
hooks/utils/: 3 test files (useCurrency, currency.ts, placeholder.ts)
```

**Test Files:**
- `src/app/settings/__tests__/page.test.tsx` - 31 tests (settings page)
- `src/stores/__tests__/useSettingsStore.test.ts` - Theme, agent mode, notifications, currency
- `src/stores/__tests__/useLooksStore.test.ts` - Moodboard CRUD, slug generation
- `src/stores/__tests__/useCollectionsStore.test.ts` - Collection CRUD, products
- `src/stores/__tests__/useUploadStore.test.ts` - Upload flow, file management
- `src/components/__tests__/TopBar.test.tsx` - 39 tests (navigation, agent mode)
- `src/components/__tests__/Sidebar.test.tsx` - 32 tests (navigation links)
- `src/components/__tests__/ProductCard.test.tsx` - 32 tests (product display)
- `src/components/__tests__/AppLayout.test.tsx` - 20 tests (layout wrapper)
- `src/utils/__tests__/currency.test.ts` - Currency formatting, conversion
- `src/utils/__tests__/placeholder.test.ts` - SVG placeholder generation
- `src/hooks/__tests__/useCurrency.test.ts` - Currency hook

### Cypress E2E

```
Test Suites: 7
- onboarding.cy.ts: 12 tests (onboarding flow)
- settings.cy.ts: 25 tests (settings page)
- navigation.cy.ts: 20 tests (TopBar navigation)
- looks.cy.ts: 18 tests (moodboard page)
- shopify.cy.ts: 25 tests (Shopify OAuth, connect/disconnect, product sync)
- ai-features.cy.ts: 30 tests (AI search, enrichment, virtual try-on, composition, agent mode)
- export.cy.ts: 28 tests (moodboard export, social sharing, collection export, embed code)
```

**NPM Scripts:**
- `npm run cy:open` - Open Cypress Test Runner
- `npm run cy:run` - Run tests headlessly
- `npm run e2e` - Start server and run Cypress tests

### Backend (Vitest)

```
Test files exist for:
- sdk/productEnrichment/enrich.test.ts
- sdk/searchEngine/search.test.ts
- sdk/layoutGenerator/*.test.ts
- sdk/layoutAI/generateSmartLabels.test.ts
- sdk/exportEngine/export.test.ts
- sdk/brandDashboard/*.test.ts
- sdk/shared/errors.test.ts
- sdk/__tests__/ai-fallbacks.test.ts

Coverage: npm run test:coverage (uses @vitest/coverage-v8)
```

### Cypress E2E Coverage Summary

All recommended E2E tests implemented:
- [x] User flows (onboarding, moodboard creation)
- [x] Shopify OAuth flow testing
- [x] AI feature integration tests
- [x] Export functionality
- [ ] Cross-browser compatibility (run with `--browser chrome/firefox/edge`)

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

### Backend (.env)
```
# AI Providers
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# Models (optional - defaults provided)
ENRICHMENT_MODEL=claude-opus-4-5-20251101
GEMINI_ENRICHMENT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.0-flash-exp

# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
```

---

## Quick Commands

```bash
# Frontend
cd frontend
npm run dev          # Start dev server
npm test             # Run tests
npm run test:coverage # Coverage report

# Backend
cd backend
npm run dev          # Start Vercel dev
npm test             # Run Vitest
npm run deploy       # Deploy to Vercel

# Mobile
cd mobile
npm start            # Expo dev server
```

---

## Notes for AI Assistants

1. **Always check AI provider availability** before suggesting AI features
2. **Use CSS variables** for colors - never hardcode hex values in components
3. **Fallback chains are critical** - ensure both providers work before deploying
4. **Test coverage is low** - prioritize tests for critical paths
5. **Mobile app shares stores/types** with web where possible
6. **Shopify is the primary integration** - WooCommerce is secondary
7. **Keep the High-Level Plan section updated** - When completing tasks mentioned in the "In Progress" section, move them to "Completed" and update the "Test Coverage Status" section with current metrics. This helps maintain project visibility.
8. **Run all commands directly** - Claude Code should execute commands to spin up dev servers, run tests, and perform builds rather than just providing commands for the user to copy.
