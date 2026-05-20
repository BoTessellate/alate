# Alate — Claude Code Instructions

## How to communicate with me — ALWAYS (unless I say otherwise)

Every reply must be structured in this exact order:

1. **What is needed** — in plain, simple words. No technical jargon.
   Save the jargon for the PR description or any document you're asked
   to prepare.
2. **What needs to be done by me** — the actions only the user can take.
3. **What can be done by you** — the actions Claude can do and take off
   the user's hands.
4. **Summary of what was done / needs doing** — brief, only if a task
   was assigned.
5. **Summary of documents updated / to be updated, and why** — brief,
   only if a task was assigned.

## Security — OWASP is non-negotiable

Follow OWASP guidance at all times. Any violation of OWASP is, by
definition, an anti-pattern — treat it with the same weight as the
rules in `project_anti_patterns.md`.

## User-facing docs — use the template

Any step-by-step / runbook / how-to doc prepared for the user must
follow [`docs/_USER_DOC_TEMPLATE.md`](./docs/_USER_DOC_TEMPLATE.md):
plain-language "what this is" → numbered "what you need to do" with real
links → "how to verify it worked". No jargon in the instructions.

## Branch placement — AUTOMATIC, do not ask

When the user assigns a task whose changes do NOT belong on the
currently checked-out branch, cut a new branch off `master`
automatically. **Do not ask.** Signals that a fix doesn't belong on
the current branch:
- Current branch name implies a different scope (e.g. `ci/...`,
  `docs/...`, `chore/...`) while the task is a feature/fix.
- The current branch has unrelated uncommitted edits already in
  flight.
- The fix would mix concerns across PR boundaries.

Default branch naming: `fix/<short-slug>`, `feat/<short-slug>`,
`docs/<short-slug>`, `chore/<short-slug>`. Cut from `master`, not
the current branch. Use `git worktree add` when the current branch
has uncommitted work that must be preserved.

Within the new branch, separate code commits from doc commits
(`feedback_work_style` memory). Run the full `npx jest --no-coverage`
before either commit.

## Orphan-branch fixes — port AUTOMATICALLY, do not ask

If a regression-log entry, BACKLOG entry, or audit reveals that a
fix already exists as a commit on an unmerged/orphan branch
(typically `claude/<adjective>-<noun>-<hash>` from a prior session)
and the current task requires that fix, port the commit to a fresh
branch off `master` (per "Branch placement" above) **without
asking**. Verify the regression log and BACKLOG entries that
referenced the old commit get corrected — a logged fix's SHA must
be reachable from `master` (`git branch --contains <sha>` lists
`master`) before the entry is marked shipped.

When porting:
1. Cherry-pick or replay the diff on the new branch.
2. Run `npx jest --no-coverage` — the orphan-branch tests should
   pass on master too; if they don't, fix forward, don't skip.
3. Update BACKLOG.md / regression log to reference the new
   merged SHA, not the orphan one.

## Project
React Native Android app (Expo 55, RN 0.81.5, React 19). Monorepo: `/mobile` (app) + `/backend` (Vercel API).

## Planning docs — start here for any V2 / strategy / scope question
- [`RELEASE_V2.md`](./RELEASE_V2.md) — single source of truth for V2 release status (what's built, what's pending, what flips at launch)
- [`BACKLOG.md`](./BACKLOG.md) — durable record of out-of-scope work, P0–P4 sections; check before proposing "should we build X?"
- [`USER_PATHS.md`](./USER_PATHS.md) — happy + edge + still-uncovered user flows; update when a flow drifts or a new path is added
- [`backlog/`](./backlog/) — long-form planning docs for parked items (referenced from `BACKLOG.md` entries)
- `~/.claude/projects/C--Users-mailt-Documents-alate/memory/` — project-wide memory: regression log, anti-patterns, design vision, font plans (referenced in the bug-fix pre-flight rule below)

## Bug-fix Pre-flight — ALWAYS Reference the Regression Log First

Before writing any code in response to a user-reported bug:

1. **Read `~/.claude/projects/C--Users-mailt-Documents-alate/memory/project_regression_log.md`** end to end (it's short — a few minutes' read at most). Skim for matching symptoms.
2. **If the symptom matches a logged entry**: link to it in your reply, check whether the prior fix has regressed (run the regression test it references), and patch from that starting point. Don't re-discover.
3. **If it doesn't match**: proceed to the TDD loop below. Once the fix lands, **add a new entry** to `project_regression_log.md` (symptom → root cause → fix → test → lesson). Even one-liners get logged — institutional memory across sessions is the whole point.
4. **If you spot a recurring class** (3+ entries on the same theme — hooks bugs, scrape-pricing, native-resource sync, etc.): promote it to its own anti-pattern in `project_anti_patterns.md` and reference the log entries.

This step happens **before any build, before any commit, before writing the first test**. Builds take 3+ minutes; reading the log takes 30 seconds.

## TDD Rule — Write Tests First
When implementing any new feature or fixing any bug:
1. **Write the test first** — describe the expected behavior before writing the implementation
2. **Run the test** — confirm it fails for the right reason
3. **Write the code** to make the test pass
4. **Run the full suite** — `npx jest --no-coverage` must stay green (all tests pass)

This applies to:
- New screens → add a render smoke test in `src/__tests__/screenSmoke.test.tsx`
- New store actions → add unit tests in `src/__tests__/{storeName}.test.ts`
- New API functions → add error-path tests in `src/__tests__/api.test.ts`
- New components with logic → add component tests in `src/__tests__/{Component}.test.tsx`
- Bug fixes → add a regression test that reproduces the bug before fixing it

## Error Boundaries
Every screen is wrapped in `ScreenErrorBoundary` (see `AppNavigator.tsx`). If you add a new screen:
1. Create a `Safe{ScreenName}` wrapper in `AppNavigator.tsx`
2. Use it in the navigator instead of the raw screen component
3. Add a smoke test in `screenSmoke.test.tsx`

## Testing
- Unit/component tests: `npx jest --no-coverage` (runs ~150+ tests)
- E2E tests live in the **guinea-pig** repo (separate): `github.com/BoTessellate/guinea-pig`
- testIDs are the contract between alate and guinea-pig E2E — do not remove them without updating guinea-pig's `TEST_ID_CONTRACT.md`

## Crash Monitoring
- Sentry + Firebase Crashlytics are both wired in
- `captureError()` from `src/utils/sentry.ts` for JS errors
- `recordError()` from `src/services/crashlytics.ts` for native-side reporting
- Crash monitor runs daily, creates fix PRs or flags config issues

## Code Style
- Do not add GradientBackground — the app uses solid `colors.background` (#e4e2e9)
- Glass cards use `rgba(255,255,255,0.75)` with subtle shadow on the solid bg
- Package ID: `com.tessellate.alate`

## Source-of-Truth Anti-Pattern (Mood Layer split)
Mood Layer (the brand-side Shopify embedded app, separate `Tessellate/mood-layer` repo) and Alate (this repo, the consumer app) own different data:
- **Shopify** owns catalog (title, description, images), price, inventory, shipping zones — read live via Storefront API at view time. **Never persist these in Mood Layer's DB.**
- **Mood Layer** owns enrichments keyed to Shopify product IDs: AI tags, vision colors/textures, brand-pushed size charts / regional lead-times / customization options.
- **Alate** consumes a single composed endpoint on Mood Layer (`GET /api/products/:id`) that fans out to Shopify Storefront API + Mood Layer enrichments DB and returns a merged payload.

When working in this repo, do not add columns to `enriched_products` (or any successor table) that shadow Shopify-owned fields. If you need catalog/inventory/price, fetch via the composed endpoint, not via local DB.
