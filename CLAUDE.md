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
│       ├── layoutGenerator/    # 8 layout archetypes
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
│  Layout Generation (8 archetypes)                           │
│  Smart Label Placement (Vision AI)                          │
│  Theme Token Extraction                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  IMAGE GENERATION                           │
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

---

## Brand Colors

```css
/* Primary palette */
--primary: #4c7031;           /* TML Green */
--primary-light: #649341;     /* Lighter green */
--primary-dark: #3d5a27;      /* Darker green */

/* Neutral palette */
--cream: #4fefed;             /* Cyan/Turquoise accent */
--charcoal: #222222;          /* Dark base */

/* Semantic colors */
--success: #4c7031;           /* Primary green */
--warning: #c4a35a;           /* Gold */
--error: #a84032;             /* Red-brown */
--info: #4a7c9b;              /* Blue */
```

### Reserved Color Combo (Secondary - Analogous Greens)
When updating secondary color, consider this analogous palette:
- **#4C7031** (primary)
- **#317035** (deeper forest green)
- **#6B7031** (olive/khaki green)

Current secondary: `#8b6b4a` (warm brown) - used in page.tsx BookHeart icon

---

## High-Level Plan

### Completed

- [x] Core moodboard creation and editing
- [x] Product enrichment with Claude AI
- [x] Shopify integration (OAuth, sync, webhooks)
- [x] 8 layout archetypes for moodboard generation
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

- [ ] **Test coverage improvement** (currently ~3% frontend)
- [ ] **Cypress E2E testing setup**
- [ ] WooCommerce plugin completion
- [ ] Social sharing optimization

### Pending / Planned

- [ ] Collaboration features (real-time editing)
- [ ] Advanced search filters UI
- [ ] Brand dashboard analytics
- [ ] Subscription/payment integration
- [ ] Pinterest-style discovery feed
- [ ] AR try-on for mobile
- [ ] Performance optimization (lazy loading, caching)
- [ ] Accessibility audit (WCAG compliance)

---

## Test Coverage Status

### Frontend (Jest + React Testing Library)

```
Overall: ~3% statement coverage
Most coverage: settings/page.tsx (has tests)
Missing: components, hooks, stores, utils (0%)
```

**Failing tests to fix:**
- Password change validation
- Export data functionality
- Sign out state
- Modal interactions

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

Missing: @vitest/coverage-v8 dependency for coverage reports
```

### Recommended: Cypress E2E

Ready to add Cypress for:
1. User flows (onboarding, moodboard creation)
2. Shopify OAuth flow testing
3. AI feature integration tests
4. Export functionality
5. Cross-browser compatibility

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
