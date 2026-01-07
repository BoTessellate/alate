# Claude Code Guidelines - Frontend

Frontend-specific guidelines for the TML Next.js application. For project-wide guidelines (code style, testing, TODOs), see the root [CLAUDE.md](../CLAUDE.md).

## Table of Contents
1. [UI Components](#ui-components)
2. [Key Patterns](#key-patterns)

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

### Benefits
- Style changes propagate automatically to all pages
- Consistent typography and spacing across the app
- Less code duplication and easier maintenance

## UI Guidelines Reference
See `UI_GUIDELINES.md` for full design system details.

---

# Key Patterns

## File Organization
- Components: `src/components/`
- Stores: `src/stores/` (Zustand)
- Hooks: `src/hooks/`
- Types: `src/types/`

## Breadcrumb Navigation

| Level | Behavior |
|-------|----------|
| "The Mood Layer" | No dropdown, just home link |
| Section names (Layers, Closet, Discover) | Show ROOT_OPTIONS for switching sections |
| Specific item names (moodboard name) | Show contextual options for switching items |

## TopBar Consistency
- All icon buttons: `w-8 h-8`
- Use expandable patterns for space-constrained UI (e.g., search icon → expanded search bar)

## Interactive Elements

**Cursor style MUST match functionality.**

### Rule 1: Clickable elements need `cursor-pointer`
```typescript
// GOOD: Button with cursor-pointer
<button onClick={handleClick} className="cursor-pointer">

// BAD: Missing cursor-pointer (appears non-clickable)
<button onClick={handleClick} className="...">
```

### Rule 2: Non-clickable elements must NOT have `cursor-pointer`
```typescript
// GOOD: Conditional cursor based on actual functionality
const hasClickAction = !!onClick;
<div className={`transition-colors ${hasClickAction ? 'cursor-pointer' : ''}`}>

// BAD: Pointer cursor but no action (misleading UX)
<div className="cursor-pointer hover:bg-surface-light">
  {/* No onClick handler - cursor lies to user */}
</div>
```

### When to apply:
- `cursor-pointer`: Elements with `onClick` handlers, links, buttons
- No cursor class: Hover effects without click actions (visual feedback only)
- Conditional: Components with optional `onClick` prop

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
