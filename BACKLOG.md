# Alate — backlog

Durable record of work that's out of scope for the current push but
shouldn't be lost. Each item includes enough context to start the work
cold without this file's author present.

When an item lands, strike it through and add the merge commit link.
When priorities change, move items between sections rather than
deleting them.

---

## P0 — pre-App-Store launch

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

## P1 — near-term polish

### Apply the Supabase migration for `blocked_brands`
**Path:** `backend/supabase/migrations/blocked_brands.sql`

Migration file exists but hasn't been applied to the live Supabase
instance. Copy the SQL into the Supabase SQL editor or run via your
migration runner. Until applied, the `/api/brand-optout` endpoint
returns 500 and the scraper's blocklist check fails open (no-op). Not
a blocker — safe default is "nothing gets blocked" — but needed
before the opt-out feature is real.

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

## Dismissed / out of scope

None currently.
