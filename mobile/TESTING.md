# Alate Mobile — Testing Guide

## Test Layers

```
┌─────────────────────────────────────────┐
│  E2E (WebdriverIO + Appium)             │  slow, highest confidence
│  mobile/e2e/*.spec.ts                   │
├─────────────────────────────────────────┤
│  Integration (Jest + store + API mocks) │  medium, primary safety net
│  mobile/src/__tests__/integration/      │
├─────────────────────────────────────────┤
│  Unit (Jest)                            │  fast, fine-grained
│  mobile/src/__tests__/*.test.ts         │
└─────────────────────────────────────────┘
```

## Critical User Journeys

1. **First-Time User** — No avatar → paste URL → setup avatar → fit check → history
2. **Recurring Fit Check** — Avatar exists → paste URL → fit check → history
3. **History Re-evaluation** — Open history entry → re-evaluate with updated avatar

## What's Scaffolded

### Integration (`src/__tests__/integration/`)
| File | Covers |
|---|---|
| `firstTimeUserJourney.test.ts` | Pending URL → avatar setup → scrape/enrich/checkFit chain → history add |
| `recurringFitCheck.test.ts` | URL validation, full chain, scrape-failure handling, brand extraction |
| `historyReevaluation.test.ts` | Add/update/remove, 50-entry cap, re-evaluation with updated avatar |

### E2E (`e2e/`)
| File | Covers |
|---|---|
| `shareIntent.spec.ts` | App launch smoke (existing) |
| `firstTimeUser.spec.ts` | Home → avatar setup → fit check scaffold |
| `recurringFitCheck.spec.ts` | Home → paste URL → fit result → history |
| `helpers/selectors.ts` | Centralized Appium selectors |
| `helpers/flows.ts` | Reusable user actions (paste URL, setup avatar, navigate tabs) |

## Running Tests

```bash
# Unit + Integration (fast)
cd mobile
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E (slow, needs emulator + built APK)
npm run test:e2e
```

## E2E Prerequisites

- Android emulator running (`emulator-5554`)
- Debug APK built: `cd android && ./gradlew assembleDebug`
- Appium + WebdriverIO installed (already in devDeps)
- Backend reachable — use staging, **NOT production**, to avoid test pollution

## TODOs Before Production

### High priority
- [ ] Add `testID` props to React Native components referenced in `e2e/helpers/selectors.ts`
- [ ] Replace stub assertions in E2E specs with real element checks
- [ ] Seed AsyncStorage in `recurringFitCheck.spec.ts` beforeAll (ADB or deeplink)
- [ ] Point E2E tests at staging backend, not production
- [ ] Write tests for `accountStore` (Google auth flow)

### Medium priority
- [ ] Screen component tests (HomeScreen, FitResultScreen, AvatarSetupScreen) using `@testing-library/react-native`
- [ ] API error-path tests (timeout, 500, malformed response)
- [ ] Brand nudge flow test (scrape fail → nudge card → nudgeBrand call)

### Nice to have
- [ ] Visual regression tests (screen snapshots)
- [ ] Accessibility tests (a11y roles, contrast)
- [ ] Performance budget tests (JS thread, render times)

## How to Extend

### Adding an integration test
1. Create file in `src/__tests__/integration/yourFeature.test.ts`
2. Mock the API layer: `jest.mock('../../services/api', () => ({ ... }))`
3. Reset stores in `beforeEach`
4. Assert state changes + API call signatures

### Adding an E2E test
1. Create `e2e/yourFeature.spec.ts`
2. Import helpers from `./helpers/flows` and `./helpers/selectors`
3. Add new selectors to `helpers/selectors.ts` as needed
4. Never rely on text content — prefer `testID`

## Shopify

Shopify integration tests are intentionally excluded from this scaffold. Add them when Shopify flow is stable.
