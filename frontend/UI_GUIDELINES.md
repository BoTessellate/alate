# TML Frontend UI Guidelines

## Design System: Boldness + Sophistication Hybrid

This project uses a custom design system that blends **Boldness & Clarity** (Vercel-style) with **Sophistication & Trust** (Stripe-style).

### Design Direction
- **Aesthetic**: Refined, premium, decisive
- **Personality**: Sophisticated yet bold — not generic or timid

### Non-Negotiables (Never Change)
- **Typography**: Cormorant (serif headlines) + Jost (sans-serif body)
- **Color Palette**: Forest green (#4c7031), sage (#E8EAE3), warm browns
- **Border Radius**: Soft `rounded-lg` system throughout
- **Muted Text**: #555555 — readable yet refined
- **Fonts**: Do NOT change the font families

### CSS Design Tokens (globals.css)

#### Spacing Scale (4px base)
```css
--space-xs: 4px;      /* micro */
--space-sm: 8px;      /* tight */
--space-md: 16px;     /* standard */
--space-lg: 24px;     /* comfortable */
--space-xl: 32px;     /* generous */
--space-2xl: 48px;    /* section breaks */
--space-hero: 80px;   /* major sections */
```

#### Typography Scale
```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 24px;
--text-2xl: 32px;
--text-hero: 48px;
```

#### Bold Typography
- Weight: `--font-weight-bold: 700` for headlines, `--font-weight-semibold: 600` for subheads
- Letter-spacing: `--letter-spacing-tight: -0.02em` for headlines
- Utility classes: `.text-hero`, `.text-headline`, `.text-subhead`, `.text-title`

#### Shadow System
```css
--shadow-sm: 0 2px 8px -2px rgba(0,0,0,0.08);
--shadow-md: 0 4px 16px -4px rgba(0,0,0,0.12);
--shadow-lg: 0 8px 28px -6px rgba(0,0,0,0.16);
--shadow-hover: 0 12px 32px -8px rgba(0,0,0,0.18);
--shadow-elevated: 0 4px 15px -3px rgba(0,0,0,0.1);
--shadow-elevated-hover: 0 8px 25px -5px rgba(0,0,0,0.18);
```

#### Hover Transforms (Lift Effect)
```css
--lift-sm: translateY(-2px);   /* subtle lift */
--lift-md: translateY(-4px);   /* standard lift */
--lift-lg: translateY(-6px);   /* dramatic lift */
```

#### Transition Timing
```css
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;
--ease-out: cubic-bezier(0.25, 1, 0.5, 1);
```

### Hover State Patterns

All interactive elements should lift on hover:
- **Primary/Secondary buttons**: `translateY(-4px)` + `--shadow-hover`
- **Elevated cards**: `translateY(-4px)` + `--shadow-elevated-hover`
- **Chips/Tags**: `translateY(-2px)` with smooth transition
- **Transition**: `all var(--transition-base) var(--ease-out)`

### Anti-Patterns (Never Do)
- ❌ Dramatic drop shadows (keep refined)
- ❌ Multiple accent colors in one interface
- ❌ Thick decorative borders (2px+)
- ❌ Asymmetric padding without clear reason
- ❌ Spring/bouncy animations
- ❌ Gradients for decoration
- ❌ Large border radius (16px+) on small elements
- ❌ Making muted text lighter than #555555
- ❌ Changing font families (Cormorant, Jost)

### Quality Standard
Every interface should appear "designed by a team that obsesses over 1-pixel differences."

---

## Icon and Element Placement

### Sidebar Icons (Collapsible Sidebar Pattern)

When implementing a collapsible sidebar with icons that need to be centered when collapsed:

**CORRECT Pattern:**
```tsx
// Container uses justify-content to control alignment
<div style={{
  justifyContent: isExpanded ? 'flex-start' : 'center',
  paddingLeft: isExpanded ? '12px' : '0',
  paddingRight: isExpanded ? '12px' : '0',
}}>
  <Icon size={20} className="flex-shrink-0" />

  {/* Text MUST be absolutely positioned to not affect icon centering */}
  <span
    className="absolute"
    style={{
      opacity: isExpanded ? 1 : 0,
      left: '44px', // Calculate: margin + padding + icon width + gap
      pointerEvents: isExpanded ? 'auto' : 'none',
    }}
  >
    Label Text
  </span>
</div>
```

**INCORRECT Patterns (DO NOT USE):**
```tsx
// BAD: Text with opacity:0 still takes space in flex layout
<div className="flex items-center">
  <Icon />
  <span style={{ opacity: isExpanded ? 1 : 0 }}>
    {/* This span still affects layout even when invisible! */}
    Label
  </span>
</div>

// BAD: Fixed padding that doesn't center icons
<div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
  <Icon /> {/* Not centered in 56px sidebar! */}
</div>
```

### Centering Calculation

For the TML sidebar:
- Collapsed width: `--sidebar-width: 56px`
- Expanded width: `--sidebar-expanded: 240px`
- Icon size: 20px
- Logo size: 32px (w-8)

When centered in 56px container:
- Icon position: (56 - 20) / 2 = 18px from edge
- Logo position: (56 - 32) / 2 = 12px from edge

### Key Principles

1. **Absolute positioning for hidden elements**: Any element that fades in/out but shouldn't affect layout MUST use `position: absolute`

2. **Conditional justify-content**: Use `justify-content: center` when collapsed, `flex-start` when expanded

3. **Zero padding when centered**: Remove horizontal padding when using `justify-content: center` to ensure true centering

4. **Calculate fixed positions**: When using absolute positioning, calculate exact `left` values based on:
   - Container margin
   - Container padding (when expanded)
   - Icon/logo width
   - Desired gap

5. **Use flex-shrink-0**: Icons should never shrink - add `flex-shrink-0` class

## Button Interactions

All clickable elements MUST have:
```tsx
className="cursor-pointer"
```

## Modal Positioning

Use `useLayoutEffect` (not `useEffect`) for calculating modal positions to prevent visual flash:
```tsx
useLayoutEffect(() => {
  // Calculate position synchronously before browser paint
  setPosition({ top, left });
}, [isOpen]);
```

## Scroll Containers

- Avoid nested scroll containers (`overflow-y-auto` inside another `overflow-y-auto`)
- The main content area in `AppLayout` already has `overflow-y-auto`
- Page components should NOT add their own scroll container

## Transitions

Use CSS variables for consistent timing:
```css
transition: all var(--transition-base) var(--ease-out);
```

Standard transition durations:
- Fast (micro-interactions): `var(--transition-fast)` / `150ms`
- Base (hover states): `var(--transition-base)` / `200ms`
- Slow (expand/collapse): `var(--transition-slow)` / `300ms`

Standard easing: `var(--ease-out)` / `cubic-bezier(0.25, 1, 0.5, 1)`

**Note:** Prefer CSS variables over Tailwind classes (`duration-200`) for consistency.
