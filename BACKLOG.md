# Alate — backlog

Durable record of work that's out of scope for the current push but
shouldn't be lost. Each item includes enough context to start the work
cold without this file's author present.

When an item lands, strike it through and add the merge commit link.
When priorities change, move items between sections rather than
deleting them.

---

## P0 — pre-App-Store launch

Nothing. See `project_anti_patterns.md` checklist in memory for the
confirmed launch-readiness state.

## P1 — near-term polish

### Apply the Supabase migration for `blocked_brands`
**Path:** `backend/supabase/migrations/blocked_brands.sql`

Migration file exists but hasn't been applied to the live Supabase
instance. Copy the SQL into the Supabase SQL editor or run via your
migration runner. Until applied, the `/api/brand-optout` endpoint
returns 500 and the scraper's blocklist check fails open (no-op). Not
a blocker — safe default is "nothing gets blocked" — but needed
before the opt-out feature is real.

### Brand-nudge UX inside FitResult error card (replaces HomeScreen card)
**Files:** `mobile/src/screens/FitResultScreen.tsx`

Done: single-loader architecture. HomeScreen navigates immediately on
URL detection; FitResult runs scrape → enrich → fit-check under one
loading state. Brand-nudge / blocked-brand cards moved from HomeScreen
into FitResult's `scrapeError` state.

**Still to add:** the nudge CTA path. FitResult currently shows a
generic "we couldn't read this product" error card with Go Back +
Visit Store buttons. The pre-refactor flow had a "Nudge {brand}" CTA
that fired an email to the brand's `info@` address. Restore that CTA
inside the FitResult error card so unsupported-brand discovery still
ends in a customer-acquisition email, not a dead-end.

Implementation:
- In `FitResultScreen.tsx` error card, when `scrapeError.kind ===
  'unsupported'`, add a `Nudge {brandName}` button using
  `extractBrandFromUrl(routeUrl)` for the brand
- `nudgeBrand` API call already exists in `services/api.ts`
- After successful nudge, swap to "Thanks — we've reached out to
  {brand}" copy, same as the old HomeScreen flow
- testID `fit-result-nudge-brand-button` for E2E coverage

### Wire up real email sending for `/api/brand-nudge`
**Path:** `backend/api/brand-nudge.ts`

Currently logs the nudge request but doesn't send. Pre-existing
`TODO` in the file points at Resend / SendGrid / nodemailer. Add a
`NUDGE_SENDER_EMAIL` env var, pick a provider, wire it. Not a launch
blocker (the UI already shows confirmation copy optimistically).

---

## P2 — features planned for v2

### Shopify availability section on the fit card
Surface in-stock / out-of-stock status on the fit-analysis overlay,
fed by the (future) Shopify merchant plugin, with a "last checked
Nm ago" timestamp shown succinctly.

**Scope:**
- Availability pill next to SIZE / CONFIDENCE / FIT — states:
  `In stock` (green), `Low stock ≤5` (warn), `Out of stock` (error),
  `Availability unknown` (muted grey-purple fallback)
- Relative-time formatter already exists at
  `mobile/src/utils/relativeTime.ts` — reuse it
- Extend `FitHistoryEntry` (in `mobile/src/store/fitHistoryStore.ts`):
  ```
  availability?: {
    status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
    checkedAt: string;
    count?: number;
  }
  ```
- New API: `checkAvailability(productUrl, shopifyHandle)` →
  `POST /api/availability/check` (backend TBD)
- Until the backend exists: stub always returns `unknown` so the UI
  renders cleanly

**TDD-first per CLAUDE.md:** unit tests for the relative-time utility
(already in place), store action `updateAvailability`, and
FitResultScreen smoke tests for all four states.

### Story-compose feature: image + now-playing + text overlay
Instagram-story-esque: user picks an image, the app auto-fetches
their currently-playing track via Spotify OAuth, user drops preset
text overlays ("Peace", "Create", "Soft Launch"), exports a
shareable image.

**Library stack (all MIT/Apache, all Fabric-ready):**
- `expo-image-picker` — gallery / camera
- `@shopify/react-native-skia` v2.6.2+ — canvas + draggable text +
  snapshot export
- `react-native-view-shot` v4.0.3 — simpler fallback if Skia's
  learning curve bites
- `@spotify/web-api-ts-sdk` + `expo-auth-session` — OAuth PKCE flow
  for currently-playing track
- `expo-file-system` + `expo-sharing` — write + native share sheet

**The hard truth on music integration:** iOS cannot read system-wide
now-playing (Apple blocks it). Android technically can via
`NotificationListenerService` but the only maintained RN wrapper is
stale since 2022. The realistic cross-platform answer is Spotify
OAuth — label as "Connect Spotify" in the UI, fallback to manual
text input if not connected.

**State shape:**
```ts
// mobile/src/store/editorStore.ts
interface TextOverlay {
  id: string; word: string;
  x: number; y: number; scale: number; rotate: number;
}
interface EditorState {
  imageUri: string | null;
  overlays: TextOverlay[];
  trackMetadata?: { title: string; artist: string; albumArt?: string };
}
```

### v2 themed redesign of the privacy / delete / opt-out pages
**Repo:** `BoTessellate/app_privacy_policy`
**Files:** `alate/privacy-policy.html`, `alate/delete-account.html`,
  `alate/brand-optout.html`

Currently v1 — generic system-font styling, legally complete but
visually unrelated to the app. Redesign to match Alate's grey-purple
+ TAN Nightingale identity. Feature-flag under `/alate/v2/*` URLs;
keep v1 canonical until v2 is reviewed, then flip the default in
`index.html`.

**Do NOT rewrite legal content** — v1 is authoritative. Only restyle.
Embed SVGs inline (no external deps). Palette + tokens from
`mobile/src/constants/theme.ts`.

### Retire `HeadingImage` component
**Path:** `mobile/src/components/HeadingImage.tsx`

Trigger: user licenses TAN Nightingale (planned purchase — see
`project_font_tan_nightingale.md` memory). When the TTF/OTF lands in
`mobile/assets/fonts/`:

1. Register via `expo-font` in `App.tsx`
2. Replace the `headingSerif` mixin in `mobile/src/constants/theme.ts`
3. Grep `HeadingImage` → replace every callsite with plain `<Text
   style={typography.displayLarge}>` using the fallback string
4. Delete `mobile/assets/images/headings/*.svg` +
   `react-native-svg-transformer` from metro config (if no other SVG
   usage)
5. Delete `HeadingImage.tsx`

---

## P3 — nice-to-haves

### Build the Shopify merchant plugin
Longer-term play: merchants install your app on their Shopify admin,
you get real-time catalog sync + variant-level stock + consented data
access. Current scraper is the acquisition layer; plugin is the
retention + moat. Not a launch blocker.

### Reintroduce the Preferences section on Account
Previous placeholder was removed per the launch-hardening round
because nothing was wired to it. When real preferences exist (fit
preference, notifications, theme toggle), bring back the section
backed by a `preferencesStore` (Zustand + AsyncStorage).

### Body croquis v2
See `project_body_croquis_plan.md` memory. User has failed this once;
architecture split (model vs renderer) is the key. Out of scope until
after App Store.

---

## Dismissed / out of scope

None currently.
