# Claude Code Guidelines for TML (The Mood Layer)

This document contains guidelines and instructions for Claude Code when working on this codebase.

## Testing Philosophy

**Do not make band-aid fixes.** When tests fail:

1. **Dig deep** - Don't just fix the symptom to make the error go away
2. **Find the root cause** - Trace back to where the actual problem originates
3. **Fix at the point of inflection** - The fix should address the underlying issue, not patch around it

### Example
If a breadcrumb dropdown test fails because it's showing the wrong options:
- ❌ **Band-aid**: Change the test to expect the current (wrong) behavior
- ❌ **Band-aid**: Add a special case in the test to skip the assertion
- ✅ **Root cause**: Investigate why the dropdown is getting wrong options - is it the data structure? The rendering logic? The route detection?

The goal is a codebase where tests genuinely validate behavior, not tests that are constantly adjusted to match bugs.

## Code Style

- Use TypeScript with strict types
- Use CSS custom properties for theming (var(--primary), var(--foreground), etc.)
- Components should be in `src/components/`
- Stores use Zustand and are in `src/stores/`
- API calls should have action-based error messages that explain what went wrong and what to do

### UI Component Reusability

**Always use existing UI components instead of inline elements with repeated styles.**

When adding or updating page layouts:
- ❌ **Don't**: Create inline `<h1>` with Cormorant font styles repeated across pages
- ✅ **Do**: Use `PageHeader` component which handles elegant typography consistently

Available components in `src/components/ui/`:
| Component | Use Case |
|-----------|----------|
| `PageHeader` | Page titles with optional subtitle and actions |
| `EmptyState` | Empty content placeholders with icon, title, description, and CTA |
| `Button` | All interactive buttons (primary, secondary, ghost variants) |
| `Card` | Content containers with optional interactive states |
| `Modal` | Dialogs and overlays |
| `Input`, `Textarea`, `Select` | Form elements |

**If a pattern doesn't fit existing components:**
1. First check if an existing component can be extended with a new prop/variant
2. If not, create a new reusable component rather than adding inline styles
3. Example: Centered wizard headers → create `WizardHeader` component

This ensures:
- Style changes propagate automatically to all pages
- Consistent typography and spacing across the app
- Less code duplication and easier maintenance

## UI Guidelines

Refer to `UI_GUIDELINES.md` for design system details including:
- Color palette and CSS variables
- Typography scale
- Component patterns
- Spacing conventions

## Key Patterns

### Error Messages
Error messages should be action-oriented:
- ❌ "Failed to fetch"
- ✅ "Unable to connect to server. Check your internet connection and try again."

### Breadcrumb Navigation
- "The Mood Layer" → No dropdown, just home link
- Section names (Layers, Closet, Discover) → Show ROOT_OPTIONS for switching sections
- Specific item names (moodboard name) → Show contextual options for switching items

### TopBar Consistency
- All icon buttons should be consistent size (w-8 h-8)
- Use expandable patterns for space-constrained UI (e.g., search icon → expanded search bar)

## Testing Infrastructure

### Shared Selectors (Single Source of Truth)
When component selectors change, update in ONE place:

- **Source file**: `src/constants/testSelectors.ts` - Complete selector definitions
- **Cypress file**: `cypress/support/commands.ts` - SELECTORS export for E2E tests

Tests import from shared SELECTORS:
```typescript
import { SELECTORS } from '../support/commands';

cy.get(SELECTORS.search.trigger).click();
cy.get(SELECTORS.search.input).should('be.visible');
```

### Extracted Logic for Unit Testing
Complex logic is extracted into testable utilities:

- **Breadcrumb logic**: `src/utils/breadcrumbs.ts` - Pure functions, unit tested
- **Theme colors**: `src/constants/theme.ts` - `getTopbarColors()`, `getAgentModeColors()`

### Test Files
- **Unit tests**: `src/**/*.test.ts` - Jest, for logic
- **E2E tests**: `cypress/e2e/*.cy.ts` - Cypress, for user flows

### Condition-Based Theming
When theming depends on multiple conditions, make ALL conditions explicit:

```typescript
// GOOD: Explicit about page AND theme
backgroundColor: isLooksListPage
  ? 'var(--charcoal)'
  : effectiveTheme === 'dark'
    ? 'var(--cream)'
    : 'var(--charcoal)'

// BAD: Only considers one condition
backgroundColor: isLooksListPage ? '#F4EFED' : '#222222'
```

## Future Enhancements (TODO)

### Shopify Product Enrichment - Immediate Trigger
**Status**: Planned
**Context**: Currently, product enrichment runs via GitHub Actions cron every 15 minutes. For better UX, we should trigger enrichment immediately after a Shopify sync completes.

**Implementation**:
1. Create a GitHub Personal Access Token (PAT) with `repo` scope
2. Add `GITHUB_TOKEN` to Vercel environment variables
3. In `handleSyncRedirect` (shopify.ts), after successful sync:
   ```typescript
   // Fire GitHub Action (non-blocking)
   fetch('https://api.github.com/repos/ramsaptami/TML/dispatches', {
     method: 'POST',
     headers: {
       'Authorization': `token ${process.env.GITHUB_TOKEN}`,
       'Accept': 'application/vnd.github.v3+json',
     },
     body: JSON.stringify({
       event_type: 'enrich-products',
       client_payload: { shop: shopDomain }
     })
   }).catch(e => console.error('GitHub dispatch failed:', e));
   ```
4. The workflow `.github/workflows/enrich-products.yml` already has `repository_dispatch` trigger configured

**Why deferred**: Requires PAT setup which has security considerations for token storage.
