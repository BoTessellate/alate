# Story-template illustration sources (public domain)

Drop curated PD plates into this folder as PNG with transparent background. Naming: `<slot>.png` where `<slot>` matches a `StoryTemplate.illustration` ref in [src/constants/storyTemplates.ts](../../src/constants/storyTemplates.ts).

## Why public domain

Both BHL and archive.org host scans of pre-1923 natural-history books. The underlying works are out of copyright. Neither institution asserts a new copyright on the scans (BHL: "no known copyright restrictions"; archive.org: PD per source). Commercial use is permitted.

## Curated picks (download targets)

These are vetted starting points — open the URL, download the high-res TIFF/JPG, background-remove (any tool), save as PNG into this folder.

### Butterflies / moths

| File | Source | URL |
|---|---|---|
| `butterfly-yellow.png` | BHL Flickr — Lepidoptera plate, *British butterflies* (Morris, 1853) | https://www.flickr.com/photos/biodivlibrary/ (search `butterflies Morris 1853`) |
| `butterfly-blue.png` | archive.org — *Butterflies of the British Isles* (Frohawk, 1914) | https://archive.org/details/butterfliesofbri00froh |

### Birds

| File | Source | URL |
|---|---|---|
| `bird-songbird.png` | BHL — *British Birds* (Morris, 1851), passerine plates | https://www.biodiversitylibrary.org/bibliography/22148 |
| `bird-finch.png` | archive.org — *Birds of America* (Audubon, 1840 octavo edition) | https://archive.org/details/birdsofamericafr00audu |

### Botanical

| File | Source | URL |
|---|---|---|
| `rose-pink.png` | BHL — *Curtis's Botanical Magazine*, vol 1–60 | https://www.biodiversitylibrary.org/bibliography/9 |
| `rose-cream.png` | BHL — *Les Roses* (Redouté, 1817–1824) | https://www.biodiversitylibrary.org/bibliography/45333 |
| `peony.png` | archive.org — *The genus Paeonia* (Stern, 1946 — check date for PD) | https://archive.org/ |

## Cutout workflow

1. Open the source page, download highest-res image
2. Background-remove (remove.bg / GIMP / Photoshop / Canva — any free tool works for botanical plates; the white plate background is easy to key out)
3. Save as PNG, transparent bg, ~1500px on the long side
4. Drop into this folder, name as above
5. Reference from [src/constants/storyTemplates.ts](../../src/constants/storyTemplates.ts)

## Attribution

Per memory's anti-pattern rules, the app keeps an attribution footer. Each template that uses one of these illustrations should list:

```
Illustration: <book title>, <author>, <year>. Public domain via Biodiversity Heritage Library / archive.org.
```

This is courtesy, not a legal requirement for PD content.

## Bundle-size budget

Each cutout PNG ~150–400 KB at 1500px. Six templates ≈ 1.5–2.5 MB added to APK. Acceptable. If it grows, switch to WebP (RN supports it) and shave ~40 %.
