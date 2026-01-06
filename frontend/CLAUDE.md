# Claude Code Guidelines - Frontend

Frontend-specific guidelines for the TML Next.js application. For project-wide guidelines, testing infrastructure, and TODOs, see the root [CLAUDE.md](../CLAUDE.md).

## Table of Contents
1. [Code Style](#code-style)
2. [UI Components](#ui-components)
3. [Key Patterns](#key-patterns)

---

# Code Style

## General Rules
- Use TypeScript with strict types
- Use CSS custom properties for theming (`var(--primary)`, `var(--foreground)`, etc.)
- Components should be in `src/components/`
- Stores use Zustand and are in `src/stores/`
- API calls should have action-based error messages

## Error Messages
Error messages should be action-oriented:

| Bad | Good |
|-----|------|
| "Failed to fetch" | "Unable to connect to server. Check your internet connection and try again." |
| "Error" | "Could not save changes. Please try again." |

---

# UI Components

## Always Use Existing Components

**Never create inline elements with repeated styles.** Use the design system.

| Component | Use Case |
|-----------|----------|
| `PageHeader` | Page titles with optional subtitle and actions |
| `EmptyState` | Empty content placeholders with icon, title, description, and CTA |
| `Button` | All interactive buttons (primary, secondary, ghost variants) |
| `Card` | Content containers with optional interactive states |
| `Modal` | Dialogs and overlays |
| `Input`, `Textarea`, `Select` | Form elements |

### If a Pattern Doesn't Fit
1. First check if an existing component can be extended with a new prop/variant
2. If not, create a new reusable component rather than adding inline styles
3. Example: Centered wizard headers → create `WizardHeader` component

### Benefits
- Style changes propagate automatically to all pages
- Consistent typography and spacing across the app
- Less code duplication and easier maintenance

## UI Guidelines Reference
See `UI_GUIDELINES.md` for full design system details:
- Color palette and CSS variables
- Typography scale
- Component patterns
- Spacing conventions

---

# Key Patterns

## Breadcrumb Navigation

| Level | Behavior |
|-------|----------|
| "The Mood Layer" | No dropdown, just home link |
| Section names (Layers, Closet, Discover) | Show ROOT_OPTIONS for switching sections |
| Specific item names (moodboard name) | Show contextual options for switching items |

## TopBar Consistency
- All icon buttons should be consistent size (`w-8 h-8`)
- Use expandable patterns for space-constrained UI (e.g., search icon → expanded search bar)

## Condition-Based Theming
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
