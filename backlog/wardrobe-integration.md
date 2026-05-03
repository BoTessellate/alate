# Wardrobe-management integration — V2 plan

How Alate connects with Indyx, Whering, Acloset, Stylebook, Save Your Wardrobe, etc. Incremental, honest, marketing-safe.

> **One-line read**: ship one-tap export to any wardrobe app via the system share sheet in V2.0. Open partnership conversations in parallel. Only announce specific app names once signed. Build our own wardrobe in V3+.

---

## 1. Reality check (what's actually integrable)

| App | Public API | Notes |
|---|---|---|
| Indyx | None known | Marketing site unreachable from my probes; no public dev docs surfaced |
| Whering | None | Has a user-installed Chrome extension (their version of share-from-retailer) |
| Save Your Wardrobe | B2B / enterprise | Their "API" is for brands + DPP, not consumer apps |
| Acloset | None | |
| Stylebook | None | iOS-paid, no developer surface |
| Cladwell, Smart Closet, Pureple, Closest | None | Same story — consumer apps, no platform layer |

**Conclusion**: no consumer wardrobe app in this category has the kind of public API/OAuth flow that would let Alate "integrate" the way users imagine the word. Every realistic path goes through OS primitives (share sheet, deep links) or signed partnerships.

This shapes everything below.

---

## 2. Integration tiers — what each gives us

| Tier | Mechanism | Coverage | Effort | What user sees |
|---|---|---|---|---|
| **0** | Manual (no integration) | Universal | Zero | User screenshots fit result, opens wardrobe app, adds manually |
| **1** | System share sheet (export) | Every wardrobe app on iOS/Android | Low (~3 days) | Tap "Save to wardrobe" → OS share sheet → pick Indyx/Whering/whatever they have installed |
| **2** | Per-app deep links / URL schemes | App-specific | Med per app | Tap "Save to Indyx" → opens Indyx with the item pre-loaded |
| **3** | Partnership API (custom backend handshake) | One app at a time | High — 2-3 months sales + integration | "Connect your Indyx account" — bidirectional, true integration |
| **4** | Build our own wardrobe (Alate-native) | N/A — we own it | Months of product work | Wardrobe lives inside Alate |

Tier 1 is the only one we can ship in v2.0 unilaterally. Tier 2 is opportunistic. Tier 3 is the long-tail. Tier 4 is the eventual answer.

---

## 3. Phased plan

### Phase v2.0 — "Save to wardrobe" (ship in V2 release)

**What ships**:
- New "Save to wardrobe" button on FitResultScreen (next to "Open product page")
- Tap → builds an export payload (product image + brand + name + size rec + product URL) and opens the system share sheet
- User picks any installed app — works with every wardrobe app that accepts images or URLs (and a lot do)

**Marketing copy**: "Send any product to your wardrobe app — works with what you already use"
*(Note: doesn't name specific apps. True statement, no partnership claims.)*

**Effort**: ~2-3 days. Reuses `expo-sharing` already in deps for the V2 story-share editor.

**Tests**: smoke + share-payload shape unit test.

### Phase v2.1 — Deep-link upgrades (opportunistic)

For each wardrobe app the team confirms supports a custom URL scheme (research per-app):
- Add a dedicated "Save to Indyx" / "Save to Whering" button that uses the deep link directly instead of the OS share sheet
- Skips the share-sheet step → one fewer tap

**Risk**: undocumented schemes break on app updates. Wrap each in a `Linking.canOpenURL()` check + fallback to share sheet.

**Marketing**: hold this announcement until ~3 deep links work. Then: "We've cut a tap — direct save to Indyx, Whering, and Acloset."

### Phase v2.2 — Partnership integrations (run in parallel from day 1 of v2.0)

Reach out to wardrobe-app teams in priority order:
1. Indyx (if popular with target user)
2. Whering (UK overlap)
3. Save Your Wardrobe (their brand-side API might let us push as a brand partner)
4. Cladwell (US, outfit-rec angle)

**What we ask for**:
- Webhook endpoint we POST to with structured product data
- OR OAuth flow so users connect once and we push directly
- OR a "shared with Alate" inbox in their app

**Cycle**: 2-3 months from cold email to integration live. Don't gate v2.0 on this.

**Marketing**: "We're talking to [App]" → only after signed term sheet, never on speculation.

### Phase v2.3 — Wardrobe import (read direction)

Asymmetric: export is easy, import is hard.

For users who let us, pull their existing wardrobe so Alate can:
- Cross-reference brand fit history ("you've worn ASOS M well — this Cos M will fit similarly")
- Flag duplicates ("you already have 3 black dresses")

**How**:
- CSV import for apps that support export (Cladwell, some others)
- Photo-roll scanner — user opens Alate, points camera at their closet, OCR/CV extracts items (very ambitious, may slip to V3)
- Per-app partnership reads — only if Phase 2.2 partnerships include read scope

**Marketing**: this is the "your closet, smarter" feature. Big announcement but only after proven on at least one source.

### Phase v3 — Alate-native wardrobe

Build it. Replaces dependency on third-party apps for users who prefer all-in-one. Doesn't remove integration — keeps the export so users who already live in Indyx/Whering aren't forced to switch.

**Trigger**: V2 retention metrics show users hitting the "I want to track my actual closet" need post-fit-check.

---

## 4. Marketing announcement framework

| Stage | What you can honestly say | What you CANNOT say |
|---|---|---|
| Now (pre-launch) | "V2 will work with your existing wardrobe apps" | "Indyx integration coming" (implies a partnership) |
| v2.0 ship | "Save any product to your wardrobe app — Indyx, Whering, Acloset, Stylebook, anywhere you organise outfits" *(naming as supported share-sheet targets is fine — they're consumers of a standard OS feature, not partners)* | "We're partnered with [App]" |
| v2.1 (deep links land) | "Direct one-tap save to [list of apps where deep-link verified]" | "Endorsed by [App]" |
| v2.2 (first partnership signs) | "Official [App] integration — [App] users can now connect their account in Profile" | Nothing more than what's in the actual integration scope |
| v2.3 (wardrobe import) | "Bring your closet to Alate — see fit predictions in context with what you already own" | Anything about owning the data |
| v3 (own wardrobe) | "Now with built-in wardrobe — keep your existing app or move in" | Disparage other apps |

**Universal rules**:
- Never imply a partnership that isn't signed
- Never announce a feature before it's in TestFlight/internal builds
- "Coming soon" only with a date you can hit
- Specific app logos in marketing only with permission (treat their trademarks like brand-name SVGs in `BrandHeading` — get explicit licence)

---

## 5. Anti-patterns (DON'T DO THESE)

| Don't | Why |
|---|---|
| Scrape a wardrobe app's backend to "import" without consent | Legal + relationship-poisoning. Same family as the existing project anti-pattern: no scrape catalogue without brand consent. |
| Reverse-engineer their API and ship a "user-friendly OAuth" | They WILL block you and bad-mouth Alate to other partners. Long-tail damage. |
| Announce "Whering integration" because share-sheet works | Misleading. Users hear partnership. We lose trust when they realise it's just OS share. |
| Bundle a Chrome extension that competes with Whering's Chrome extension | Wrong battle. We're a fit-check tool that exports, not a wardrobe-from-anywhere collector. |
| Promise "we'll integrate with X" in roadmaps without a signed term sheet | Sets the user up for disappointment when the partnership doesn't happen. |
| Build wardrobe-import (Phase 2.3) before any of Phase 2.0/2.1/2.2 | Hard problem first → ships nothing for v2 |

---

## 6. Open questions / actions

| Q | How to answer | Owner |
|---|---|---|
| Does Indyx have a hidden share-extension target on Android? | Install Indyx, share an image from another app, see if Indyx appears as a share target | Manual QA — 10 min per app |
| Same for Whering, Acloset, Stylebook, Cladwell | Same | Same |
| Which wardrobe app is your target user actually using? | Survey, or pick top 1-2 from app-store charts in the regions you ship | You |
| Will any of those teams take a partnership call? | Cold email partnerships@whering.co.uk, ditto others. Use the FIL story / portfolio-comeback context if it helps build rapport (it's genuine) | You |
| Should we build a Chrome extension to match Whering's existing one? | Probably no for V2. Mobile-first stays the focus. Re-evaluate if Chrome extension is the only path to wardrobe-import we can ship. | You |

---

## 7. What I'd ship in v2.0 specifically

A single new component + button. Smallest possible v2 wardrobe-export commitment that's honest.

### File plan
- `mobile/src/utils/wardrobeExport.ts` — builds the share payload (image URI + metadata caption)
- `mobile/src/components/SaveToWardrobeButton.tsx` — button that triggers it
- Wire into `FitResultScreen` next to "Open product page"
- Test: `wardrobeExport.test.ts` — payload shape, currency formatting, nullable fields

### Behaviour spec
1. Button label: "Save to wardrobe"
2. Tap → fetch product image to a temp file (so wardrobe apps that consume images get a real file, not a remote URL)
3. Build caption: `${brand}\n${productName}\nSize ${recommendedSize} · ${price}\n${productURL}`
4. Open share sheet with image + caption
5. User picks their wardrobe app (or anywhere else — message app, notes, etc.)

### What it doesn't do
- No claim to be "integrated"
- No app-specific routing
- No write-back from the wardrobe app

### Effort
- 1 day implementation + 0.5 day tests + 0.5 day manual QA on Indyx/Whering/Acloset
- Can ship before all the V2 features lock — minimal coupling

---

## 8. What this doc DOESN'T cover

Out of scope, flagged so they don't get forgotten:
- **Resale / consignment integration** (Vestiaire, Vinted, Depop) — different category, separate planning
- **Style-AI integrations** (e.g. Cladwell outfit recs) — could pair with v2.3 wardrobe-import
- **Brand-loyalty programmes** — the "for brands" side of Save Your Wardrobe might be a B2B revenue stream, but it's a different product
- **Photo-CV wardrobe scan** — interesting but a V3 stretch goal
