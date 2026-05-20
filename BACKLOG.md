# Alate — backlog

Durable record of work that's out of scope for the current push but
shouldn't be lost. Each item includes enough context to start the work
cold without this file's author present.

When an item lands, strike it through and add the merge commit link.
When priorities change, move items between sections rather than
deleting them.

---

## P0 — pre-App-Store launch

### Set up email aliases on the `tessellate.co.in` domain

**Status:** not done — `tessellate.co.in` is owned by Tessellate but has
no mail configured yet.

The app and its published docs reference addresses on this domain that
must actually receive mail before / shortly after launch:

| Address | Used by | Why it must work |
|---|---|---|
| `connect@tessellate.co.in` | Play Console → Store listing → Contact details (`mobile/store-listing.md`) | Google and users contact the app here; the listing field needs a real address |
| `privacy@tessellate.co.in` | Privacy policy (live at `app_privacy_policy/alate/privacy-policy.html`, v3.2) | Already **published** as the data-deletion / data-access request address — a user emailing it today would bounce. Compliance gap until fixed. |

**What to do:** create catch-all or per-name aliases on `tessellate.co.in`
(e.g. via the domain registrar's email-forwarding, or Google Workspace /
Zoho Mail) so both addresses deliver to a monitored inbox. Plan per the
owner: lightweight aliases now, dedicated domain + mailboxes once the app
scales.

**Related:** the BrandIntegration "Get in touch" P0 item below also needs
a real destination — fold a `partners@tessellate.co.in` alias into the
same setup if that route stays email-based.

### Move `googleUser` from AsyncStorage to `expo-secure-store`

**Path:** `mobile/src/store/accountStore.ts` — the `account-storage`
zustand `persist` currently uses `createJSONStorage(() => AsyncStorage)`.

`googleUser` (`{ id, email, name, picture }`) is persisted in
**plaintext AsyncStorage**. The OAuth access token is NOT persisted
(used transiently in `GoogleSignInCardConfigured` then discarded —
keep it that way), so this is the only signed-in artefact at rest.

**Severity:** low. It's the user's own email/name on the user's own
device; the genuinely sensitive data (body measurements) is already
device-local by design (anti-pattern #4). Flagged during the OWASP
review of the sign-in path (2026-05-06) under **Mobile M9 — Insecure
Data Storage**. Acceptable for closed testing; tighten before public
launch.

**Fix:** swap the persist storage adapter to a thin
`expo-secure-store`-backed implementation (Keychain on iOS, Keystore
on Android). `expo-secure-store` has a per-item size cap (~2 KB) but
the `googleUser` object is far under it. Adapter shape:

```ts
import * as SecureStore from 'expo-secure-store';
const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};
```

TDD: extend `accountStore.test.ts` to assert the secure adapter is
used and round-trips. Note migration — existing testers signed in
under the AsyncStorage key will appear signed-out once after the
swap; acceptable (sign-in is optional, one re-tap).

### "Get in touch" on the BrandIntegration page needs a real destination

**Path:** `mobile/src/screens/BrandIntegrationScreen.tsx` →
`PARTNER_INQUIRY_EMAIL` constant + `handleGetInTouch`.

Currently the CTA opens a `mailto:ramsaptami@gmail.com` with a
structured subject + body template (added May 3 2026 PM as a
placeholder so the button at least *did* something). For v1 launch
this needs:

  1. A dedicated inbox alias (e.g. `partners@alate.app`) so
     incoming inquiries don't mix with personal mail.
  2. EITHER a follow-up rule that auto-replies + tags the thread
     for triage, OR an in-app form posting to a new
     `/api/partner-inquiry` endpoint that lands in a Supabase
     `partner_inquiries` table (modelled on `brand_requests`).
     The form path is more durable — gives us structured data
     (brand name, storefront URL, catalogue size, contact)
     queryable from a dashboard, doesn't depend on mailto
     working on every device, and captures inquiries even when
     the user has no mail client installed.
  3. Update `PARTNER_INQUIRY_EMAIL` (or the form endpoint URL) and
     consider gating the CTA behind an `isEnabled('PARTNER_INQUIRY')`
     flag if the destination isn't ready by ship.

User flagged May 4 2026: "setup 'get in touch' before v1 launch on
brand connect page". Worth tracking the click-through count via
Sentry breadcrumb (already wired) so we know whether the demand
warrants the form-path investment over the mailto-path.

### ~~Privacy-policy entry + delete-my-data path for brand_requests.requester_email~~ — DONE 2026-05-02

Local copies updated in this worktree:
  - `mobile/privacy-policy.html` (v2.1, effective 2026-05-02) — added
    section 1(f) Brand Request Data, section 2 bullet, section 5
    retention rule (notify email purged within 30 days of send / on
    request), section 6 deletion CTA, section 11 App Store details.
  - `mobile/delete-account.html` — added "Delete a Brand-Request
    Notify Email" section pointing at the privacy mailbox with a
    pre-filled subject line.

**Manual sync still required:** the canonical privacy pages live in
`BoTessellate/app_privacy_policy` (rendered via GitHub Pages at
`ramsaptami.github.io/app_privacy_policy/alate/*`). Copy the diffs
across to that repo and push before App Store submission.

The CTA copy on the FitResultErrorCard input is plain English ("your@email.com")
with the explicit purpose visible in the privacy-policy + the
"notify me when added" button label. No further mobile copy
change needed.

Rest of launch readiness — see `project_anti_patterns.md` checklist
in memory.

### Fabric / material extraction misses on certain storefronts

User-flagged May 5 2026 — material/fabric details aren't being
surfaced on the FitResult `MATERIAL` row for these representative
URLs:

- `https://www.armani.com/en-in/emporio-armani/short-sleeved-jumper-with-perforated-knit-cod-EW004675-AF25815-F1054/`
  (Armani — likely a non-Shopify storefront with bespoke product
  schema. The product name itself contains "perforated knit" so the
  signal exists; we just don't extract it.)
- `https://oshinsarin.in/products/felled-seam-set` (Oshin — Shopify;
  the JSON product payload may not surface a `material` key, or
  ours sits in a `tags` field we're not scanning for material hints.)

Investigation steps when picked up:
  1. Hit each URL via `scrapeProduct()` directly and inspect the
     returned `material` field — null vs missing vs empty.
  2. If null, check whether `inferMaterial({ title, tags })` in
     `mobile/src/utils/productInference.ts` would catch the
     keywords ("knit", "linen", "silk", "felled" etc.). The
     keyword table may need extending.
  3. For Armani specifically — the URL handle has the fabric type
     baked in (`perforated-knit`), so a URL-handle pass in the
     same inference step should be cheap to add.
  4. Add the URLs as fixtures to `productInference.test.ts` so a
     regression doesn't reintroduce empty material on these pages.

Related but separate: user also reports that an Armani link sometimes
fails via the share-route while pasting the same link works. That's
a share-intent debounce / dedup question, NOT a scraper question;
filed as its own backlog item below.

### ~~Share-intent route fails where direct paste succeeds (Armani)~~ — LANDED 2026-05-20

**Files:** [`mobile/src/utils/shareIntent.ts`](mobile/src/utils/shareIntent.ts),
  [`mobile/src/navigation/AppNavigator.tsx`](mobile/src/navigation/AppNavigator.tsx),
  [`mobile/src/__tests__/shareIntent.test.ts`](mobile/src/__tests__/shareIntent.test.ts)

User-flagged 2026-05-05: shared an Emporio Armani product link via
the system share-sheet → "this brand isn't on the platform". Pasted
the SAME URL into Home → fit card. Two code paths, same URL.

Root cause confirmed: share-sheet payloads carry whitespace, wrapper
text around the URL, and/or a `#fragment` that the scrape rejects.
The home-paste path normalised; the share-intent path didn't.

**Fixed:** new `extractSharedUrl()` in `shareIntent.ts` trims, pulls
the first `http(s)` token out of a longer blob, and strips trailing
punctuation + `#fragment`. `AppNavigator`'s share-intent effect
calls it; the dead local `isValidUrl` helper is gone. 10 new tests
in `shareIntent.test.ts`; full suite 407/407 green.

History note: this fix was first written 2026-05-16 on the orphan
branch `claude/unruffled-leakey-dacdab` (commit b9269e4) and was
incorrectly recorded as shipped in regression log row #35. It only
actually landed on master on 2026-05-20.

### Apple-TV-style "expand from card" transition for History → FitResult

User direction May 5 2026 PM: "history → fit screen transition is
currently a slide right (?) effect, it needs to be expand like how
Apple TV does it to be precise". Currently the global Stack
screenOptions sets `animation: 'slide_from_right'` (iOS-style on
both iOS + Android). Apple TV's "expand from card" is a
shared-element transition — the tapped card morphs in place, scales
up to fill the screen, and the destination's hero image continues
that scale.

**Why deferred:** native-stack alone can't do this. Needs
`react-native-reanimated` v3 shared transitions (or
`react-native-shared-element`), bound elements on both sides
(history coverflow card + FitResult hero image), and a layout
animator that crossfades the chrome around the morphing image.
Estimated half-day implementation + risk of regressions in the
already-tuned cover-flow animation.

**Implementation plan:**

  1. **Library check.** We're on `react-native-reanimated` v4 per
     the May 4 worklets-mock comment in `jest.setup.js`. v3+ ships
     shared-element transitions out of the box (no `react-native-
     shared-element` dependency required). Confirm the API surface
     hasn't changed in v4 vs the v3 docs.

  2. **Tag both ends with the same `sharedTransitionTag`:**
       - **History side** (`HistoryCoverFlow.tsx`,
         `CoverFlowCard`'s `<Image source={{uri: entry.productImage}}>`
         per-card): wrap in `<Animated.Image>` with
         `sharedTransitionTag={\`hero-image-${entry.id}\`}`.
       - **FitResult side** (`FitResultScreen.tsx`'s product image
         backdrop, line ~1042 `<Image source={{uri: product.image}}>`):
         same wrap + same tag computed from `activeEntry?.id` (or
         `historyEntryId` route param).

  3. **Override the per-screen animation.** Stack default is
     `slide_from_right`. Override on `FitResult`'s screen options:
     `animation: 'fade'` (or `'none'`) so the shared-transition
     drives the visual instead of the stack slide. The
     fade-on-other-elements + image-morph-in-place is what reads
     as "expand from card".

  4. **Tune the spring.** Pass
     `sharedTransitionStyle={(values) => 'worklet'; ...}` if the
     default spring overshoots — Apple TV's expand is critically
     damped, no bounce. Likely `{ damping: 24, stiffness: 220 }`.

  5. **Reverse path.** Going BACK from FitResult to History: the
     same shared element animates in reverse (hero image shrinks
     back into the cover-flow slot). Reanimated handles this
     automatically when the source tag is still mounted.

  6. **Edge cases:**
       - **History entry deleted while FitResult is open.** Source
         tag unmounts — reanimated will fall back to a cross-fade.
         Acceptable.
       - **FitResult opened from Home (URL-paste flow), not
         History.** No source tag to morph from; default fade
         transition runs. Acceptable.
       - **Cover-flow rubber-band animation**. The card-tap fires
         `navigation.navigate`; reanimated captures the source's
         current transform. Confirm rubber-band overshoot doesn't
         leave the source mid-spring when the tag is captured.

  7. **Test plan.**
       - History → tap card → FitResult: image morphs.
       - Back from FitResult: image morphs back.
       - History → tap → FitResult → swipe-sift to sibling → back:
         image morph back to original card (or new sibling card —
         decide UX).
       - Home → paste URL → FitResult: standard fade in (no
         source).
       - Reduce-motion enabled: shared transitions must be
         skipped (set sharedTransitionStyle to a no-op when
         `useReducedMotion()` returns true).

  8. **Files touched:**
       - `mobile/src/components/HistoryCoverFlow.tsx` — wrap card
         image with `Animated.Image` + tag.
       - `mobile/src/screens/FitResultScreen.tsx` — wrap hero
         image with `Animated.Image` + tag, plus per-screen
         `animation: 'fade'` override in route options OR in
         `mobile/src/navigation/AppNavigator.tsx`.
       - Optional: `mobile/src/utils/useReducedMotion.ts` (if
         not already there) for the a11y guard.

## P1 — near-term polish

### ~~Apply the Supabase migration for `blocked_brands`~~ — ALREADY APPLIED, verified 2026-05-20
**Path:** `backend/supabase/migrations/blocked_brands.sql`

Verified live on project `alate` (`ancuwmmivgdvommzigwv`) via MCP
`list_tables`: `public.blocked_brands` exists with the expected
columns (`origin PK`, `reason`, `requested_by_email`, `notes`,
`blocked_at`), RLS enabled, "Brands that have opted out…" comment
in place, "Service role only" policy active.

Provenance note: the project's `supabase_migrations.schema_migrations`
table only tracks one migration row (`20250707123502`), so
`list_migrations` did not surface this one — `blocked_brands` was
applied via the SQL editor (or an early manual apply) and isn't
recorded in the migrations table. **Trust `list_tables` over
`list_migrations` when verifying applied state on this project.**
Same caveat applies to `brand_requests` (also live, 6 rows, not in
the migrations list).

### ~~Brand-nudge UX inside FitResult error card (email-the-brand version)~~ — REJECTED 2026-05-02

Original plan was a "Nudge {brand}" CTA that fires an email to the
brand's `info@` inbox from alate. **Decision: don't do this.** Cold
email from a small app to a brand customer-service inbox doesn't
reach integration decision-makers, and lets any user spam any brand
under alate's name. Demand signal is real gold; the email is not the
way to capture it.

**Replacement plan: three-layer demand capture (see below).**

### ~~Demand capture v1 — silent tracking + "we'll notify you" CTA~~ — SHIPPED 2026-05-02
**Files:** `mobile/src/screens/FitResultScreen.tsx`,
  `mobile/src/components/FitResultErrorCard.tsx`,
  `backend/api/brand-request.ts`,
  `backend/supabase/migrations/brand_requests.sql`

Migration applied to live Supabase 2026-05-02. The endpoint is
deployable as soon as the next Vercel build runs.

When FitResult's scrape fails with `kind === 'unsupported'`, the error
card surfaces:
  - "[brand] isn't supported yet" headline
  - Body copy that the brand is being tracked, with the count of
    other users who've requested it (if > 0): "23 others have asked
    for this brand"
  - Optional email-capture: "we'll let you know when [brand] is added"
  - The existing Go Back + Visit Store CTAs stay

No email goes out to the brand. Backend logs the unsupported URL +
extracted brand + (optional) requester email to `brand_requests`
(Supabase). The aggregate count powers both the in-app social proof
("N others want this") and a marketing/BD dashboard.

Schema (sketch):
```sql
CREATE TABLE brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_handle text NOT NULL,         -- normalized: lowercase host minus tld
  brand_display text,                  -- as scraped from URL
  source_url text NOT NULL,
  requester_email text,                -- nullable; only if user opts in
  user_id text,                        -- if signed in
  created_at timestamptz DEFAULT now()
);
CREATE INDEX brand_requests_handle_idx ON brand_requests(brand_handle);
```

Aggregate query (called when error card mounts):
```sql
SELECT count(*) FROM brand_requests WHERE brand_handle = $1;
```

testIDs: `fit-result-error-brand-request-card`,
`fit-result-error-notify-input`, `fit-result-error-notify-submit`.

### Demand capture v2 — user-as-advocate social share
**Trigger:** v1 ships and we have ~20 brand requests/week.

When a brand crosses N requests, the error card adds a "tell [brand]
you want them on alate" CTA that opens a pre-drafted Instagram story
or tweet tagging the brand from the **user's** account. Brands
respond to social mentions; this is the clout play. No app-as-spammer
risk because nothing originates from alate.

Out of scope for v1 — needs the social-share infrastructure from the
P2 story-compose feature anyway.

### Demand capture v3 — armed B2B outreach dashboard
**Trigger:** v1 ships and we have a meaningful demand corpus.

Internal-only Supabase view + simple admin page that ranks brands by
request volume, shows the top requesting cities/countries (from
request metadata if available), and exports a contact list. This is
the data that makes a cold pitch warm: "we have 5,000 unsupported
pastes for COS in 30 days" beats a deck.

Out of scope for v1 — purely a query layer on the v1 table.

---

## P2 — features planned for v2

### "Calibrate from a garment you own" — parked for v2

**Status:** parked 2026-05-17. Code kept on disk, not deleted.

The feature: the user records garments they already own that fit well
(brand + size + perfect/tight/loose); the app estimates their real cm
measurements and averages them into the calibration data used on every
fit check — a strong size-recommendation signal.

**Why parked:**
- The UI (`mobile/src/components/FitCalibrationCard.tsx`) was already
  not rendered anywhere — the feature was dark.
- The backend `calibrate-garment` action sends body measurements to a
  third-party AI (Claude). That conflicts with the "body data doesn't
  go to third parties" posture (anti-pattern #4) and would have to be
  disclosed in the privacy policy + Play Data Safety form.

**What's on disk (dormant, commented as PARKED):**
- `mobile/src/components/FitCalibrationCard.tsx` — the UI card.
- `calibrateGarment` in `mobile/src/services/api.ts` — the API call.
- `handleCalibrateGarment` in `backend/api/ai.ts` — the endpoint.
- `mobile/src/store/calibrationStore.ts` — still wired into `checkFit`
  (passes calibration data when present); harmless while empty.

**Before un-parking in v2:**
1. Decide whether calibration must use an AI at all — a non-AI option
   is a generic size-chart table (size + gender → standard cm, adjusted
   for fit feedback). Cheaper, no third-party body-data transfer, but
   less brand-specific. See the 2026-05-17 analysis in chat / regression
   log.
2. If it keeps the AI: update the privacy policy + Play Data Safety
   declaration to disclose body measurements going to the AI provider,
   and reconcile with anti-pattern #4.
3. Re-render `FitCalibrationCard` (re-add the import + JSX in
   `AccountScreen`).

### ~~Shopify availability section on the fit card~~ — SHIPPED v1.1

Done — `mobile/src/utils/availability.ts` + persisted on
`FitHistoryEntry.availability`. Renders as a row in the meta section
of the FitResult overlay (visible when docked).

States: `in_stock` (green) / `out_of_stock` (red) / `unknown`. We
intentionally skipped `low_stock` because Shopify's public JSON
endpoint doesn't expose inventory counts — only whether
`inventory_management` is set. The merchant-plugin v2 will expose
real counts via webhook; revisit `low_stock` then.

No new backend endpoint was needed: Shopify direct-fetch already
returns `availableSizes` filtered to variants with shopify-managed
inventory, so the same scrape that produces the verdict also
answers "is your size stocked?". Source-of-truth comparison is the
recommended size from `sizeRec` against that list.

**Future iteration ideas (not blocking launch):**
- Real-time inventory counts via Shopify merchant-plugin webhook
- "Notify me when back in stock" CTA on the out-of-stock state
- Background refresh of availability on history entries older than
  24h (currently the snapshot is frozen at scrape time)

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

### Delete legacy `backend/api/brand-nudge.ts` + its sender env var
**Path:** `backend/api/brand-nudge.ts`

This endpoint emails `info@<brand-domain>` with a pitch when a user
nudges. The email-the-brand path was rejected 2026-05-02 (see
"Demand capture" above). The mobile client no longer calls this
endpoint — `nudgeBrand` was replaced with `logBrandRequest`. The
file is unreachable from production but still on disk; `NUDGE_SENDER_EMAIL`
env var is still set in Vercel.

Clean kill (separate small PR):
  1. `git rm backend/api/brand-nudge.ts`
  2. Remove `NUDGE_SENDER_EMAIL` from Vercel env vars
  3. Confirm no internal docs reference `/api/brand-nudge`

Left in this PR to keep the diff focused on the demand-capture v1
swap. Safe to delete any time.

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

## P4 — post-V2 (deferred until demand validates)

### Wardrobe-app integration (Indyx, Whering, Acloset, etc.) + Alate-native capsule wardrobe
**Detail doc:** [`backlog/wardrobe-integration.md`](backlog/wardrobe-integration.md)

Status: parked. Reconsider once social listening on Reddit / Instagram /
Pinterest validates which wardrobe app the target user is actually
using and whether the demand is for "save to my existing app" vs
"Alate has its own closet".

Quick read of the detail doc:
- **No consumer wardrobe app has a public API** — verified across Indyx,
  Whering, Acloset, Stylebook, Save Your Wardrobe (the last is B2B,
  not consumer). Plan must work around that.
- **Tier 1 (universal share-sheet export)** is the only path that
  ships unilaterally. ~2 days work. Marketing-safe to call this
  "Save to your wardrobe app" without naming partners.
- **Tier 2 (per-app deep links)** is opportunistic per-app QA.
- **Tier 3 (signed partnerships)** are 2-3 month sales cycles — start
  in parallel, never block a release on them.
- **Tier 4 (Alate-native wardrobe)** is the V3+ play; only commit when
  V2 retention shows the wardrobe-shaped need.

**Don't unblock until** the social-listening cheat-sheet from the
2026-05-03 conversation produces enough signal to pick a target user
+ target app. Marketing announcements before then risk implying
partnerships that don't exist.

---

## Dismissed / out of scope

None currently.
