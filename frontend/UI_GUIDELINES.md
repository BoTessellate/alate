# TML Frontend UI Guidelines

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

Standard transition durations:
- Fast (hover states): `duration-200`
- Medium (expand/collapse): `duration-300`
- Slow (page transitions): `duration-500`

Standard easing: `ease-in-out`
