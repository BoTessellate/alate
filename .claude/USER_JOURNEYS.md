# Alate User Journeys

**Purpose:** Document how users experience the website. Track what's implemented vs gaps.

---

## Journey 1: Product Discovery

**User Goal:** Browse and find products that match their style

**Current Implementation:**
- ✅ Magazine-style product grid ([frontend/src/app/discover/page.tsx](../frontend/src/app/discover/page.tsx))
- ✅ AI-powered search ([backend/sdk/searchEngine/](../backend/sdk/searchEngine/))
- ✅ Filter by category, color, brand ([frontend/src/app/discover/page.tsx:45-60](../frontend/src/app/discover/page.tsx#L45-L60))

**Gaps:**
- ❌ Save search preferences
- ❌ Price filtering
- ❌ Sort options (newest, popular, etc.) (not our UX goal)

---

## Journey 2: Avatar Setup & Fit Prediction

**User Goal:** Create avatar with body measurements for fit warnings

**Current Implementation:**
- ✅ Avatar creation flow ([frontend/src/app/avatar/](../frontend/src/app/avatar/))
- ✅ Body measurement input
- ⚠️ Fit prediction (partial - needs garment measurement data)

**Gaps:**
- ❌ Garment measurement database
- ❌ Actual fit warnings on product pages
- ❌ Size recommendations

---

## Journey 3: Flat Lay Outfit Preview

**User Goal:** Visualize outfit combinations before purchasing

**Current Implementation:**
- ✅ Flat lay canvas ([frontend/src/app/avatar/preview/page.tsx](../frontend/src/app/avatar/preview/page.tsx))
- ✅ Product arrangement by category
- ✅ Shuffle combinations ([frontend/src/app/avatar/preview/page.tsx:180-200](../frontend/src/app/avatar/preview/page.tsx#L180-L200))
- ✅ Background removal ([backend/api/remove-background.ts](../backend/api/remove-background.ts))

**Gaps:**
- ❌ Save outfit combinations
- ❌ Share outfits with friends (deffered)
- ❌ Add products from flat lay to cart

---

## Journey 4: Product Shortlist (Collections)

**User Goal:** Save products for later consideration

**Current Implementation:**
- ✅ Add to collection ([frontend/src/app/collections/page.tsx](../frontend/src/app/collections/page.tsx))
- ✅ View saved products

**Gaps:**
- ❌ Multiple collections (currently single "shortlist")
- ❌ Collection sharing
- ❌ Notes on products

---

## Journey 5: Onboarding to Flatlay (Golden Path)

**User Goal:** New user completes onboarding and creates their first outfit flatlay.

This is the complete end-to-end journey for a new user from first visit to visualizing outfit combinations.

### Step 1: Home Page (Entry Point)

**File:** [frontend/src/app/page.tsx](../frontend/src/app/page.tsx)

**What Happens:**
- User lands on personalized home with greeting, weather context, closet stats
- Quick action cards: Discover, AI Styling (coming soon), Collections
- Time-based mini moodboard

**Next Step:** Click "Discover" card → `/discover`

### Step 2: Product Discovery

**File:** [frontend/src/app/discover/page.tsx](../frontend/src/app/discover/page.tsx)

**What Happens:**
- User browses product catalog (20 per page)
- Multi-select products via checkboxes (lines 38-49)
- Click "Preview on Avatar" button

**Key Data Flow:**
- Selected product IDs → `localStorage: selectedProducts`
- Check if avatar exists → Route to setup or preview

### Step 3: Avatar Setup (If Needed)

**File:** [frontend/src/app/avatar/setup/page.tsx](../frontend/src/app/avatar/setup/page.tsx)

**When:** Only if user has no avatar in `user_avatars` table

**What Happens:**
- Input height (cm/inches with conversion)
- Select body type (Average, Curvy, Petite, Athletic, Tall)
- Pick skin tone (7 options)
- Save to Supabase `user_avatars` table (lines 44-104)

**Completion:** Redirect to `/avatar/preview`

### Step 4: Flatlay Preview (Outfit Composition)

**File:** [frontend/src/app/avatar/preview/page.tsx](../frontend/src/app/avatar/preview/page.tsx)

**Data Loading:**
- Load product IDs from localStorage (line 72)
- Fetch full product data via API (line 83)
- Load avatar for fit warnings (lines 92-109)
- Generate outfit combinations (lines 118-141)

**Canvas Features:**
- 3D flat-lay style layout (center + side products)
- Zoom controls (lines 364-370)
- Shuffle/refresh combinations (lines 262-296)
- Background removal on images (lines 298-328)
- Fit warnings based on avatar (lines 150-213)

**Save Action:** "Add to Shortlist" → Creates collection → Redirect to `/collections`

**Alternative:** "Back to Discover" → `/discover`

### Step 5: Collections (Saved Outfits)

**File:** [frontend/src/app/collections/page.tsx](../frontend/src/app/collections/page.tsx)

**What Happens:**
- View all saved collections
- Create/rename/delete collections
- Click collection to view products

**State:** `useCollectionsStore` syncs to Supabase `user_collections` table

---

### Golden Path Summary

```
/ (Home) → /discover → /avatar/setup → /avatar/preview → /collections
```

| Step | Route | Trigger | Data Saved |
|------|-------|---------|------------|
| 1. Home | `/` | Direct visit | - |
| 2. Discover | `/discover` | Click from home | Selected product IDs (localStorage) |
| 3. Avatar Setup | `/avatar/setup` | No avatar exists | Avatar measurements (Supabase) |
| 4. Flatlay | `/avatar/preview` | Products selected | Rotation state (localStorage) |
| 5. Collections | `/collections` | Save outfit | Collection + products (Supabase) |

### Key Stores

| Store | File | Purpose |
|-------|------|---------|
| `useCollectionsStore` | [stores/useCollectionsStore.ts](../frontend/src/stores/useCollectionsStore.ts) | Collections CRUD, Supabase sync |
| `useSettingsStore` | [stores/useSettingsStore.ts](../frontend/src/stores/useSettingsStore.ts) | User name, currency |

### Current Implementation Status

- ✅ Home page with personalized greeting
- ✅ Product discovery with multi-select
- ✅ Avatar setup with measurements
- ✅ Flatlay canvas with shuffle/zoom
- ✅ Background removal on product images
- ✅ Basic fit warnings
- ✅ Save to collections

### Gaps

- ❌ AI Styling recommendations (home page shows "coming soon")
- ❌ Virtual try-on (advanced fit visualization)
- ❌ Share outfits with friends
- ❌ Direct "Add to Cart" from flatlay

---

## How to Update This File

When implementing features:
1. Add code references with file paths and line numbers
2. Move items from "Gaps" to "Current Implementation"
3. Add new gaps discovered during implementation
4. Link to specific code: `[description](path/to/file.ts:startLine-endLine)`

**Example:**
```markdown
- ✅ Search functionality ([backend/sdk/searchEngine/index.ts:45-120](../backend/sdk/searchEngine/index.ts#L45-L120))
```
