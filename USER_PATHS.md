# User-path audit (post-priceRange + stale-fit fix)

A short walk through every meaningful path a user can take through the
app, with what should happen and what could break. Intended as a working
doc — when a path drifts, fix the path, then update this file.

## Happy paths

| # | Path | Outcome |
|---|---|---|
| 1 | First launch → Home → paste URL → no avatar set → AvatarSetup → fill out → return → fit check runs → FitResult shows verdict | ✓ tested via `firstTimeUserJourney.test.ts` |
| 2 | First launch → no avatar → tab to Profile → set body profile → tab back to Home → paste URL → fit check runs | ✓ avatar persists via AsyncStorage |
| 3 | Returning user → Home → paste URL → existing avatar → fit check runs immediately | ✓ tested |
| 4 | Returning user → tab to History → swipe through cards → tap card → FitResult opens with that entry's stored verdict | ✓ history-mode lazy state init, no network |
| 5 | First launch → Profile → set price range (min/max/currency) → tab to Home → Recent cards show $/$$/$$$ chip next to size | ✓ AffordabilityIcon respects currency match |
| 6 | Story share (V2 only) → Home tile → PickImage → camera/gallery → OverlayEditor → drop preset chips → share PNG | ✓ flag-gated, view-shot snapshot path |
| 7 | Sign in with Google → user persists → sign-out clears | ✓ AccountStore + ErrorBoundary on hook |

## Edge / negative paths covered

| # | Path | What graceful looks like |
|---|---|---|
| 1 | Paste an unsupported brand URL | "Unable to fetch product details" + brand-nudge card; no crash |
| 2 | Network drop mid fit-check | Loader ends, no history entry created, error path captured to Sentry |
| 3 | enrichProduct fails | Fit-check still runs (fallback to plain category), no crash — covered by FitResultScreen test |
| 4 | checkFit rejects | Loader ends, no history added — covered |
| 5 | Share-intent receives non-URL payload | `isValidUrl` rejects, intent reset cleanly |
| 6 | History sift swipe past either edge | Bounded by `localIndex < entriesLen - 1` / `> 0` |
| 7 | AvatarSetup save with no changes | No-op via deep-equal in setAvatar — does NOT bump `lastChangedAt` → no spurious re-evals |
| 8 | History card delete | Confirms first, then removes → cover-flow re-clamps active index |
| 9 | Sign-in hook crashes (Android redirect URI missing) | Caught by `GoogleSignInErrorBoundary`, falls back to "Not configured" card |
| 10 | URL scrape geo-routes to wrong region (Reistor INR) | Backend pinned to `bom1`; option-aware size detection |
| 11 | Currency mismatch between price and user range | `AffordabilityIcon` returns null instead of guessing |
| 12 | Partial price range (only min OR only max) | `computeAffordability` returns null → no chip rendered |

## Bug fixed this branch

| # | Path | Was | Now |
|---|---|---|---|
| 13 | View card A → tab to Profile → Edit body profile → save → tab to History → tap card A | Card A showed STALE fit verdict (avatar changed but reeval gate was off) | `lastChangedAt` timestamp bumped on save → focus effect detects `entry.checkedAt < lastChangedAt` → auto-reeval, regardless of nav path |

## Paths still uncovered (worth thinking about)

| # | Path | Risk |
|---|---|---|
| 14 | User sets price range, then deletes a history entry that was within budget | History "N within budget" updates correctly because it's derived — but worth a spot test if the count ever falls behind |
| 15 | User changes currency on Profile while history has entries in mixed currencies | Affordability chip on mismatched-currency entries goes null (correct) — but the "N within budget" count drops with no explanation. Consider: surface as "N of M comparable" instead of just "N" |
| 16 | Story-share editor — long-press to delete an overlay during a pinch gesture | Composed simultaneous gestures might race; long-press is set to 550ms which usually bounds it. Manual QA only |
| 17 | Avatar setup → user backs out without saving, comes back to FitResult | Avatar unchanged → `lastChangedAt` unchanged → no spurious reeval. ✓ |
| 18 | Two cards with identical `productImage` → swipe between them | Image cache should de-dupe. Visual confusion possible if names also match. Low priority |
| 19 | User clears history while a FitResult is mounted with one of those entries | `removeEntry` filters store; FitResult's `activeEntry` would resolve to undefined. Component should fall back to `routeProduct` or pop the screen. Worth checking |

## How to read this doc

- One row per path, status = covered / fixed / uncovered.
- When you fix something, move from uncovered → fixed and update the
  regression log with the symptom + root cause + fix lines.
- When you ship a new feature, add at least one happy-path row + one
  failure-path row.
- Don't over-mock — test the seams, not the leaves.
