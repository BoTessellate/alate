# Brand-name SVG slots

Drop a TAN Nightingale (or DM Serif Display fallback) SVG export into this folder, named by **brand slug**:

- file name: `<slug>.svg` (lowercased, non-alphanumeric → `-`)
- examples: `asos.svg`, `cos.svg`, `& other stories` → `and-other-stories.svg`, `weekday.svg`

[BrandHeading](../../../src/components/BrandHeading.tsx) auto-resolves a slug from any brand string via `slugifyBrand()` and looks up `<slug>.svg`. If the file doesn't exist, the component falls back to the styled text in DM Serif Display Italic — so you can ship without any SVGs and add them brand-by-brand as you export.

## Export workflow (Canva Pro)

The same workflow as [headings/README](../headings/) — Canva Pro's font library includes TAN Nightingale, and Canva-exported SVG is licensed under your Canva subscription. **No separate font license needed for these specific exports.**

1. In Canva, type the brand name in TAN Nightingale Italic, lowercase
2. Trim canvas tight to the text bounds
3. Export → SVG, transparent background
4. Drop into this folder, named `<slug>.svg`

## Why this works without re-licensing

- TAN Nightingale ships with Canva Pro
- Canva's terms allow commercial use of fonts **within Canva-generated assets**
- The SVG export is a Canva-generated asset — distributable inside your app
- We are NOT bundling the font file itself, only static glyph paths in SVG

This is the same posture the project already takes for [src/components/HeadingImage.tsx](../../../src/components/HeadingImage.tsx). Brand-name SVGs extend the existing pattern.

## Limit

Per Canva's terms, mass automated extraction of font glyphs is not permitted. Doing this manually for the top ~30 most-checked brands is fine. If you grow past ~hundreds, switch to a real font license.
