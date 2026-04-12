# Alate — Claude Code Instructions

## Project
React Native Android app (Expo 55, RN 0.81.5, React 19). Monorepo: `/mobile` (app) + `/backend` (Vercel API).

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
