# TML Frontend Performance Analysis

> **Date**: December 31, 2025
> **Status**: Analysis Complete - Ready for Implementation

---

## Executive Summary

The TML frontend has several critical performance issues affecting page load times and user experience. The primary bottlenecks are:

1. **Image Loading**: Raw `<img>` tags without optimization
2. **No Virtualization**: Large grids load all items at once
3. **No API Caching**: Redundant API calls on navigation
4. **Modal Overhead**: 80+ hidden modal instances in DOM

**Estimated Improvement**: 25-40% faster interactive pages

---

## 1. Image Loading Issues

### 1.1 Raw `<img>` Tags (HIGH)

**Problem**: Using raw HTML `<img>` tags instead of Next.js `Image` component

**Files Affected**:
| File | Lines | Context |
|------|-------|---------|
| `src/components/ProductCard.tsx` | 87-91 | Product images in cards |
| `src/components/SaveToCollectionModal.tsx` | 206-212 | Collection covers (CSS bg) |
| `src/app/collections/[id]/page.tsx` | 322-326 | Collection product grid |
| `src/app/looks/[collectionSlug]/page.tsx` | 1096-1102, 1381-1385 | Canvas items, product suggestions |
| `src/app/discover/page.tsx` | 160-163 | ProductCard grid |
| `src/app/closet/personal/page.tsx` | 94-98 | Personal collection items |
| `src/components/VirtualTryOnModal.tsx` | 276-279, 334-353 | Try-on images |

**Current Code** (ProductCard.tsx:87-91):
```tsx
{product.image_url ? (
  <img
    src={product.image_url}
    alt={product.product_name}
    className="w-full h-full object-cover"
  />
```

**Recommended Fix**:
```tsx
import Image from 'next/image';

{product.image_url ? (
  <Image
    src={product.image_url}
    alt={product.product_name}
    fill
    className="object-cover"
    sizes="(max-width: 768px) 50vw, 25vw"
    placeholder="blur"
    blurDataURL={getProductImage(product.product_name, product.color_palette)}
  />
```

**Benefits**:
- Automatic WebP/AVIF conversion
- Responsive image sizing
- Built-in lazy loading
- Reduced CLS with placeholders

### 1.2 No Lazy Loading (HIGH)

**Problem**: All images in grids load immediately, blocking render

**Affected Areas**:
- Discover page: 4 columns x multiple rows
- Collection detail: 5-column product grid
- Moodboard editor: 50 products in 2-3 columns
- TopBar search: Results dropdown images

**Recommendation**:
- Use `react-window` or `@tanstack/virtual` for virtualization
- Next.js Image already lazy loads, but grids need virtualization

### 1.3 Missing Placeholders (MEDIUM)

**Problem**: No blur placeholders cause layout shift (CLS)

**Existing Utility**: `src/utils/placeholder.ts` exists but underutilized

**Recommendation**:
- Generate SVG blur placeholders using `getProductImage()`
- Use `placeholder="blur"` with `blurDataURL`

---

## 2. Component Lazy Loading

### 2.1 Modals Loading Upfront (MEDIUM)

**Problem**: Heavy modals are imported and rendered in every ProductCard

**Files**:
| Modal | Lines | Size |
|-------|-------|------|
| `SaveToCollectionModal.tsx` | 320 | Imported in ProductCard |
| `VirtualTryOnModal.tsx` | 416 | Imported in ProductCard |
| `PhotoUploadModal.tsx` | 553 | Rendered in AppLayout |

**Current Pattern** (ProductCard.tsx):
```tsx
import SaveToCollectionModal from './SaveToCollectionModal';
import VirtualTryOnModal from './VirtualTryOnModal';

// Each ProductCard renders both modals (hidden)
<SaveToCollectionModal isOpen={showSaveModal} ... />
<VirtualTryOnModal isOpen={showTryOnModal} ... />
```

**Impact**:
- Discover page shows ~40 ProductCards
- Each has 2 modal instances
- Total: 80 hidden modals in DOM

**Recommended Fix**:
```tsx
// Option 1: Dynamic import
import dynamic from 'next/dynamic';

const SaveToCollectionModal = dynamic(
  () => import('./SaveToCollectionModal'),
  { loading: () => null }
);

// Option 2: Move modals to page level (preferred)
// Single modal instance shared across all ProductCards
```

### 2.2 TopBar Complexity (LOW)

**Problem**: TopBar.tsx is 740 lines with multiple dropdowns

**Recommendation**:
- Extract search results, currency dropdown, user menu to sub-components
- Use `React.lazy()` for dropdown contents

---

## 3. API/Data Fetching

### 3.1 No Request Deduplication (HIGH)

**Problem**: Raw `fetch()` calls without caching or deduplication

**Files**:
| File | Lines | Issue |
|------|-------|-------|
| `src/app/discover/page.tsx` | 22-56 | No cache, refetches on every visit |
| `src/components/TopBar.tsx` | 98-121 | Search without response cache |
| `src/app/looks/[collectionSlug]/page.tsx` | 175-193 | Products fetch without cache |

**Current Code** (Discover page):
```tsx
const fetchProducts = async (query: string = '') => {
  setLoading(true);
  // No cache check
  const response = await fetch(`${API_BASE_URL}/api/search`, ...);
};
```

**Recommended Fix** (using SWR):
```tsx
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const { data, error, isLoading } = useSWR(
  `${API_BASE_URL}/api/search?q=${query}`,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute cache
  }
);
```

**Benefits**:
- Automatic request deduplication
- Background revalidation
- Built-in caching
- Retry on error

### 3.2 Missing Loading States (MEDIUM)

**Problem**: Basic spinners instead of skeleton screens

**Recommendation**:
- Implement skeleton grids for product lists
- Add error boundaries with retry

---

## 4. Zustand Store Patterns

### 4.1 Store Subscription Without Selectors (MEDIUM)

**Problem**: Components subscribe to entire store, causing unnecessary re-renders

**Current Pattern** (TopBar.tsx:32):
```tsx
const { agentModeEnabled, setAgentMode, currencyDisplayMode, ... } = useSettingsStore();
```

**Recommended Fix**:
```tsx
// Selector-based subscription (each causes re-render only when its value changes)
const agentModeEnabled = useSettingsStore(state => state.agentModeEnabled);
const setAgentMode = useSettingsStore(state => state.setAgentMode);
const currencyDisplayMode = useSettingsStore(state => state.currencyDisplayMode);
```

**Files Needing Update**:
- `TopBar.tsx` (line 32)
- `ProductCard.tsx` (lines 34-35)
- `AppLayout.tsx` (line 19)
- `collections/[id]/page.tsx` (lines 37-43)

### 4.2 Missing React.memo() (MEDIUM)

**Problem**: Grid item components re-render unnecessarily

**Files**:
- `src/app/collections/page.tsx` (lines 180-339)
- `src/app/looks/page.tsx` (lines 188-355)

**Recommended Fix**:
```tsx
const CollectionCard = React.memo(({ collection, onEdit, onDelete }) => (
  // render
));

// Use in parent
{collections.map(col => (
  <CollectionCard key={col.id} collection={col} onEdit={...} onDelete={...} />
))}
```

---

## 5. Specific Bottlenecks

### 5.1 TopBar Search Results

**File**: `src/components/TopBar.tsx` (lines 455-483)

**Problem**: Search dropdown renders raw `<img>` tags, no virtualization

**Impact**: Slow search with many results

### 5.2 Moodboard Editor Product Grid

**File**: `src/app/looks/[collectionSlug]/page.tsx` (lines 1360-1434)

**Problem**: 50 products fetched and displayed immediately in sidebar

**Recommendation**:
- Implement virtualization with `react-window`
- Add intersection observer for image loading

### 5.3 Modal Instance Multiplication

**Problem**: Each ProductCard creates 2 modal instances

**Impact**: 80 hidden modals in Discover page DOM

---

## 6. Implementation Plan

### Phase 1: Quick Wins (Week 1)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| Replace `<img>` with `next/image` in ProductCard | ProductCard.tsx | 1 hour |
| Add blur placeholders | ProductCard.tsx | 30 min |
| Implement Zustand selectors | TopBar, ProductCard, AppLayout | 2 hours |
| Add React.memo() to grid items | Collections, Looks pages | 1 hour |
| Move modals to page level | ProductCard, Discover page | 2 hours |

### Phase 2: Caching & Virtualization (Week 2)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| Install and configure SWR | package.json, Discover page | 1 hour |
| Implement SWR for search | TopBar.tsx | 2 hours |
| Add virtualization to product grids | Discover, Editor | 4 hours |
| Lazy load modals with next/dynamic | ProductCard, AppLayout | 2 hours |

### Phase 3: Polish (Week 3)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| Skeleton loading screens | Discover, Collections | 3 hours |
| Extract TopBar sub-components | TopBar.tsx | 2 hours |
| Error boundaries | App pages | 2 hours |
| Performance monitoring setup | _app.tsx | 1 hour |

---

## 7. Metrics to Track

After implementation, measure:

1. **Core Web Vitals**
   - LCP (Largest Contentful Paint): Target < 2.5s
   - FID (First Input Delay): Target < 100ms
   - CLS (Cumulative Layout Shift): Target < 0.1

2. **Custom Metrics**
   - Time to Interactive (TTI)
   - API response times
   - Image load times

3. **Tools**
   - Chrome DevTools Performance tab
   - Lighthouse CI
   - Vercel Analytics (if deployed there)

---

## 8. Dependencies to Add

```bash
npm install swr @tanstack/react-virtual
```

---

## 9. Summary Table

| Category | Issue Count | Severity |
|----------|-------------|----------|
| Image Loading | 7 files | HIGH |
| Lazy Loading | 4 components | MEDIUM |
| API Caching | 3 files | HIGH |
| Store Patterns | 4 files | MEDIUM |
| Virtualization | 3 grids | HIGH |

**Total Estimated Improvement**: 25-40% faster page loads

---

*Analysis by Claude Code - December 31, 2025*
