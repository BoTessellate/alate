/**
 * Story templates — the editorial-style backdrops for the v2 story share
 * editor. Each template is a composed scene: solid colour bg + optional
 * ghost typography + a public-domain illustration cutout + slotted text
 * overlays the user fills in.
 *
 * Asset sourcing rule: only public-domain plates from Biodiversity
 * Heritage Library or archive.org. See [assets/templates/SOURCES.md](../../assets/templates/SOURCES.md).
 *
 * Adding a new template:
 *   1. Drop a transparent PNG into `mobile/assets/templates/<file>.png`
 *   2. Add a require() reference here, give it a unique `id`
 *   3. Define `bg`, optional `ghostType`, and the text slot positions
 */

import { ImageSourcePropType } from 'react-native';

// Try-require helper — templates list illustrations that may not yet
// have been dropped into the assets folder. We don't want a missing
// PNG to crash the bundle; instead we render the template without the
// illustration layer until the file lands.
function tryRequire(loader: () => ImageSourcePropType): ImageSourcePropType | null {
  try {
    return loader();
  } catch {
    return null;
  }
}

export interface StoryTemplateSlot {
  /** Render position — fraction of canvas (0–1) for portability across aspect ratios. */
  xPct: number;
  yPct: number;
  /** Text size in px at 1080-wide canvas; scales linearly to render size. */
  fontSize: number;
  /** Optional rotation in degrees (e.g. -90 for the side-eyebrow look). */
  rotate?: number;
  /** Default placeholder before the user types. */
  placeholder?: string;
}

export interface StoryTemplate {
  id: string;
  /** User-visible name in the picker grid. */
  name: string;
  /** Solid backdrop colour. */
  bg: string;
  /** Optional ghost-type layer (e.g. "1972 / 1974" faded year stack). */
  ghostType?: {
    text: string;
    color: string;
    /** 0–1, low values give the faded-numerals look from the refs. */
    opacity: number;
    fontSize: number;
    /** Vertical centre as fraction of canvas. */
    yPct: number;
  };
  /** Hero illustration. PNG with transparent bg, see SOURCES.md. */
  illustration: ImageSourcePropType | null;
  /** Where the illustration anchors (centre point). */
  illustrationAnchor?: { xPct: number; yPct: number; widthPct: number };
  /** Wordmark — the small "TAN TYPE CO" / "NIGHTINGALE" caps strip. */
  wordmark?: { text: string; xPct: number; yPct: number; fontSize: number };
  /** Editable slot — user types lyrics, song name, etc. */
  titleSlot: StoryTemplateSlot;
  /** Optional eyebrow slot — side label like "// THE VERVE //". */
  eyebrowSlot?: StoryTemplateSlot;
  /** Source attribution shown in the editor footer. */
  attribution: string;
}

// ── Templates ─────────────────────────────────────────────────────
// Three starters mirroring the user's reference screenshots:
//   1. sage-bouquet — "favorite things" backdrop
//   2. rust-nightingale — 1972 typographic ghost backdrop
//   3. sage-butterfly — "bitter sweet symphony" backdrop

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'sage-bouquet',
    name: 'sage bouquet',
    bg: '#3d4a3a',
    illustration: tryRequire(() => require('../../assets/templates/rose-pink.png')),
    illustrationAnchor: { xPct: 0.5, yPct: 0.55, widthPct: 0.55 },
    wordmark: { text: 'TAN TYPE CO', xPct: 0.5, yPct: 0.04, fontSize: 13 },
    titleSlot: {
      xPct: 0.5,
      yPct: 0.32,
      fontSize: 38,
      placeholder: 'these are a few of my favorite things',
    },
    attribution: "Curtis's Botanical Magazine — public domain (BHL)",
  },
  {
    id: 'rust-nightingale',
    name: 'rust nightingale',
    bg: '#8a3a26',
    ghostType: {
      text: '1970   1972   1974',
      color: 'rgba(255,240,220,0.18)',
      opacity: 0.18,
      fontSize: 220,
      yPct: 0.5,
    },
    illustration: tryRequire(() => require('../../assets/templates/bird-songbird.png')),
    illustrationAnchor: { xPct: 0.62, yPct: 0.42, widthPct: 0.32 },
    wordmark: { text: 'TAN TYPE CO', xPct: 0.5, yPct: 0.04, fontSize: 13 },
    titleSlot: {
      xPct: 0.5,
      yPct: 0.5,
      fontSize: 200,
      placeholder: '1972',
    },
    eyebrowSlot: {
      xPct: 0.5,
      yPct: 0.94,
      fontSize: 13,
      placeholder: 'NIGHTINGALE',
    },
    attribution: 'British Birds (Morris, 1851) — public domain (BHL)',
  },
  {
    id: 'sage-butterfly',
    name: 'sage butterfly',
    bg: '#3f4a3d',
    illustration: tryRequire(() => require('../../assets/templates/butterfly-yellow.png')),
    illustrationAnchor: { xPct: 0.42, yPct: 0.42, widthPct: 0.7 },
    titleSlot: {
      xPct: 0.7,
      yPct: 0.7,
      fontSize: 64,
      placeholder: 'bitter sweet symphony',
    },
    eyebrowSlot: {
      xPct: 0.05,
      yPct: 0.5,
      fontSize: 14,
      rotate: -90,
      placeholder: '// THE VERVE //',
    },
    attribution: 'Butterflies of the British Isles (Frohawk, 1914) — public domain (archive.org)',
  },
];

export function getTemplate(id: string): StoryTemplate | undefined {
  return STORY_TEMPLATES.find((t) => t.id === id);
}
