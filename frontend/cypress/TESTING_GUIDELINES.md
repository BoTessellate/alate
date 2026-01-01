# Cypress Testing Guidelines

## Core Philosophy: No Band-Aid Fixes

When a Cypress test fails, **do not** simply adjust the test or add workarounds to make it pass. Instead:

### 1. Investigate the Root Cause

Ask yourself:
- Why is this test failing?
- What is the actual behavior vs expected behavior?
- Where in the code does the behavior diverge from expectations?

### 2. Find the Point of Inflection

Trace the issue back to its source:
- Is it a rendering issue?
- Is it a state management problem?
- Is it incorrect data being passed?
- Is it a routing/navigation issue?

### 3. Fix at the Source

Apply the fix where the actual problem exists, not where the symptom appears.

## Examples

### ❌ Bad: Band-Aid Fixes

```typescript
// Test was checking for "Search..." button but now it's an icon
// BAD: Just change the test to look for something else
cy.get('header button[aria-label="Search"]').should('be.visible');

// BAD: Skip the test entirely
it.skip('should display search bar', () => { ... });

// BAD: Add overly broad selectors that pass regardless
cy.get('header').find('button').first().click();
```

### ✅ Good: Root Cause Fixes

```typescript
// Test fails because search is now icon-based
// GOOD: Investigate if the component changed intentionally
// If yes, update test to reflect new correct behavior with proper selectors
// If no, fix the component to maintain expected behavior

// After investigation: Search was intentionally changed to icon
// Update test with semantic selector that matches new design
cy.get('header button[aria-label="Search"]').click();
cy.get('header input[placeholder*="Search"]').should('be.visible');
```

## Test Maintenance Rules

1. **Tests describe expected behavior** - If a test fails, the first assumption should be that something broke, not that the test is wrong

2. **Understand before changing** - Read the component code before modifying any test

3. **Document intentional changes** - If behavior legitimately changed, update test AND add a comment explaining why

4. **Keep selectors semantic** - Use `aria-label`, `data-testid`, or meaningful class names, not brittle position-based selectors

## When Tests Fail Checklist

- [ ] Read the error message carefully
- [ ] Check what the test expects vs actual DOM
- [ ] Inspect the component code for recent changes
- [ ] Identify if this is a bug or intentional change
- [ ] If bug: Fix the component, not the test
- [ ] If intentional: Update test to match new correct behavior
- [ ] Run related tests to ensure no regression
