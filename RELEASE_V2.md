# V2 release — single source of truth

Single index for everything gated by `featureFlags.V2`. Every feature here ships dark — flip the one flag in [src/constants/featureFlags.ts](mobile/src/constants/featureFlags.ts) to cut the whole release over.

> **Rule**: any new V2 work reuses this same flag. New v2 features do NOT get their own flag. See note in [featureFlags.ts](mobile/src/constants/featureFlags.ts).

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Built and behind the flag |
| 🟡 | Scaffolded — code shipped, asset/data still TODO |
| 🟠 | Stubbed — interface exists, no real implementation |
| ⚪ | Planned, not started |
| ⛔ | Explicitly deferred (post-V2 or never) |

---

## Features

### 1. Story-share editor — ✅ / 🟡

Pick a photo → drop draggable preset text + Spotify now-playing → export PNG → native share sheet.

| Piece | Status | File |
|---|---|---|
| Pick screen (gallery + camera) | ✅ | [src/screens/PickImageScreen.tsx](mobile/src/screens/PickImageScreen.tsx) |
| Overlay editor (canvas + gestures + share) | ✅ | [src/screens/OverlayEditorScreen.tsx](mobile/src/screens/OverlayEditorScreen.tsx) |
| Editor state (image + overlays + track) | ✅ | [src/store/editorStore.ts](mobile/src/store/editorStore.ts) |
| Preset chip words | ✅ | [src/constants/presetWords.ts](mobile/src/constants/presetWords.ts) |
| Routes + Safe wrappers | ✅ | [src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) (gated render) |
| Home entry tile | ✅ | [src/screens/HomeScreen.tsx](mobile/src/screens/HomeScreen.tsx) (gated render) |
| Tests | ✅ | `editorStore.test.ts`, `screenSmoke.test.tsx` (PickImage + OverlayEditor) |

**Dependencies installed** (in `mobile/package.json`):
- `expo-image-picker`
- `expo-file-system`
- `expo-sharing`
- `react-native-view-shot` (used for canvas snapshot — Skia was the listed primary, view-shot is the simpler-stack fallback)

### 2. Spotify "now-playing" pill — 🟠

Inside the overlay editor, a top-strip pill shows the user's current Spotify track. Tap to drop track metadata onto the canvas.

| Piece | Status | File |
|---|---|---|
| Music store (tokens + currentTrack + refresh) | ✅ | [src/store/musicStore.ts](mobile/src/store/musicStore.ts) |
| `fetchNowPlaying` (GET `/me/player/currently-playing`) | ✅ | same |
| Token refresh on 401 | ✅ | same |
| SecureStore persistence | ✅ | same |
| Tests | ✅ | `musicStore.test.ts` |
| **OAuth `connect()` flow (PKCE, code → token exchange)** | 🟠 stub | not yet wired — `expo-auth-session` already in deps |
| Manual fallback (text input "listening to…") | ✅ | OverlayEditorScreen |

### 3. Story templates (BHL / archive.org backdrops) — 🟡

Editorial-style scenes: solid bg + ghost type + PD botanical/butterfly/bird illustration + text slots. User's reference screenshots ([TAN Type Co](https://tantypeco.com) aesthetic).

| Piece | Status | File |
|---|---|---|
| `StoryTemplate` type | ✅ | [src/constants/storyTemplates.ts](mobile/src/constants/storyTemplates.ts) |
| 3 starter templates (sage-bouquet, rust-nightingale, sage-butterfly) | ✅ | same |
| `tryRequire()` so missing PNGs don't crash bundle | ✅ | same |
| Source curation list (BHL + archive.org URLs + cutout workflow) | ✅ | [assets/templates/SOURCES.md](mobile/assets/templates/SOURCES.md) |
| **Actual PD plate PNGs in `assets/templates/`** | ⚪ TODO (user) | `mobile/assets/templates/` |
| Template picker screen | ⚪ TODO | wire as new route gated by V2 |
| OverlayEditor seeding from a template | ⚪ TODO | `OverlayEditorScreen` accepts `templateId` route param |
| Multi-layer z-order (bg → ghost → illo → text → eyebrow) | ⚪ TODO | currently flat overlay stack |
| Fixed-aspect story export (1080×1920) | ⚪ TODO | view-shot supports it; needs crop wrapper |

### 4. BrandHeading — Canva-SVG via TAN Nightingale — ✅ / 🟡

Render brand names as TAN Nightingale via Canva-exported SVGs without a separate font license. Falls back to Viaoda Libre Italic when no SVG.

| Piece | Status | File |
|---|---|---|
| `BrandHeading` component | ✅ | [src/components/BrandHeading.tsx](mobile/src/components/BrandHeading.tsx) |
| `slugifyBrand()` (handles `&`, `H&M`, `Levi's`, etc.) | ✅ | same |
| Wired into FitResult hero, HomeScreen Recent, History folio | ✅ | 3 screens |
| Brand-name SVG drop folder + workflow | ✅ | [assets/images/brands/README.md](mobile/assets/images/brands/README.md) |
| **SVG path V2-gated** (or `__DEV__` for cost validation) | ✅ | inline gate in component |
| **Actual brand-name SVG exports** | ⚪ TODO (user) | drop into `assets/images/brands/` + uncomment registry line |

> Component itself ships unflagged; **only the SVG render path** is V2-gated. Day-one visible output is identical to before (Viaoda Libre fallback).

---

## Cross-cutting changes (NOT V2-gated, ship now)

These changed in service of V2 work but apply unflagged:

| Change | File | Why unflagged |
|---|---|---|
| `BrandHeading` component live in production | 3 screens | Visually identical to old `<Text>` until SVG path activates |
| `lastChangedAt` timestamp on avatar | [src/store/avatarStore.ts](mobile/src/store/avatarStore.ts) | Drives stale-fit detection — bug fix, not a V2 feature |
| Stale-fit auto re-evaluation | [src/screens/FitResultScreen.tsx](mobile/src/screens/FitResultScreen.tsx) | Bug fix — see [regression log](../../.claude/projects/C--Users-mailt-Documents-alate/memory/project_regression_log.md) |
| Price range store + AffordabilityIcon + 3 surfaces | several | User-facing feature, not editorial — ships standalone |
| Viaoda Libre font load | App.tsx + theme.ts | Font work paused per user direction; "Viaoda Libre" family name with space (regression-log lesson) |

---

## Explicitly deferred — ⛔

| Thing | Why |
|---|---|
| Skia canvas (instead of view-shot) | Listed as primary in original spec but adds substantial native-build complexity; view-shot covers 80% with the gesture-handler + reanimated stack already installed |
| Apple Music integration | MusicKit JS is web-only; no first-party path on RN |
| Android NotificationListener route for system-wide now-playing | Only maintained RN wrapper stale since 2022; not worth the maintenance tail |
| Animated stickers / GIF export | Out of scope, post-V2 |
| Cloud save / social feed for stories | Out of scope |
| Custom font for marketing site beyond Canva | Awaiting font-licensing decision (TAN Type Co reply) |

---

## What flips when V2 goes live

In order of user-visible impact:

1. **Home screen** gets a new "make a story" tile (entry to story-share editor)
2. **Stack navigator** registers `PickImage` + `OverlayEditor` routes — they become reachable
3. **`BrandHeading` SVG path** activates in production (was already on in `__DEV__`) — every brand with a committed SVG renders in TAN Nightingale instead of Viaoda Libre fallback
4. **Story templates** (when picker screen lands) become accessible from PickImage as an alternative to the gallery/camera flow

Production behaviour with `V2: false` is unchanged from pre-V2 work — that's the whole point of one umbrella flag.

---

## Test coverage

| Suite | Count | Covers |
|---|---|---|
| `editorStore.test.ts` | 8 | overlay add/update/remove/reset, image setting |
| `musicStore.test.ts` | 5 | fetch behaviour: no-token, 200, 204, network err, disconnect |
| `featureFlags.test.ts` | 1 | flag default = false |
| `BrandHeading.test.tsx` | 8 | slug edge cases + render + V2-gated SVG |
| `priceRangeStore.test.ts` | 7 | bounds, NaN, swap, clear, isConfigured |
| `affordability.test.ts` | 9 | bucket logic, currency mismatch, overBudget, edge ranges |
| `AffordabilityIcon.test.tsx` | 6 | renders correct $/$$/$$$ + null states |
| `avatarStore.changedAt.test.ts` | 5 | timestamp bumps, no-op skip, clearAvatar |
| `staleEntryReeval.test.ts` | 5 | stale comparison logic |
| `screenSmoke.test.tsx` | + 3 V2 rows | PickImage, OverlayEditor (empty + seeded) |
| **Total** | **242** | All passing |

---

## Memory + audit pointers

External docs that live OUTSIDE this repo (in user's Claude memory):

- [project_anti_patterns.md](C:/Users/mailt/.claude/projects/C--Users-mailt-Documents-alate/memory/project_anti_patterns.md) — anti-patterns referenced by V2 work (no image re-hosting, attribution footer, no hardcoded fonts, etc.)
- [project_regression_log.md](C:/Users/mailt/.claude/projects/C--Users-mailt-Documents-alate/memory/project_regression_log.md) — bug fixes incl. the stale-fit one
- [project_font_tan_nightingale.md](C:/Users/mailt/.claude/projects/C--Users-mailt-Documents-alate/memory/project_font_tan_nightingale.md) — TAN Nightingale licensing posture
- [USER_PATHS.md](USER_PATHS.md) — user-flow audit (one V2 row)

---

## Pending decisions

| Decision | Owner | Blocks |
|---|---|---|
| TAN Nightingale licensing tier (Canva loophole vs purchase) | User; emailed TAN Type Co | Brand-name SVG strategy at scale |
| Font approach in this worktree (paused — different approach in another worktree) | User | Heading rendering across screens |
| "Consented size-chart" wording change | Awaiting clarification — phrase not found in this worktree | Profile copy update |
| Whether to ship Skia canvas later | Post-V2 evaluation | Higher-fidelity story editing |

---

**Maintain this file**: when you add a V2 piece, update the table here BEFORE writing tests. When you flip status, update the symbol. When something deferred becomes feasible, move it back into the active table.
