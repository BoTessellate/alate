/**
 * Tag filtering — strip the noise that Shopify tag fields tend to
 * accumulate over a brand's life so the user sees only the tags that
 * describe the GARMENT (material, color, fit, occasion, vibe).
 *
 * Why this exists: brands use `tags` in Shopify as their internal
 * filing system. A typical tag string for a single product looks like:
 *   "april26-sale-10, april26sale, best seller, Black, DROP XXIV-1,
 *    Full Price, going out, holiday edit, L, Linen, linen tops, M,
 *    mix+match, Most Loved, occasionwear, S, Sets, Slim Fit, Top,
 *    vacation ready, XL, XS"
 *
 * Of those 22 tags, exactly 8 describe the garment to a shopper:
 *   Black, going out, holiday edit, Linen, occasionwear, Slim Fit,
 *   vacation ready, (and Top is already in `category`)
 *
 * The other 14 are merchandising metadata that's irrelevant in a fit
 * card: marketing labels, sale codes, drops, sizes (already in their
 * own field), pricing, internal collection slugs.
 *
 * Approach: exclude-list of patterns. Any tag matching ANY pattern is
 * dropped. Everything else passes through. Easier to maintain than an
 * include-list because new "useful" categories appear faster than new
 * "noise" ones.
 */

const NOISE_PATTERNS: RegExp[] = [
  // Sale codes: "sale", "sale-10", "may-sale", "blackfriday-sale", etc.
  /\bsale\b/i,
  // Date-bounded marketing tags: "april26-sale-10", "spring2026"
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\d/i,
  // Pricing labels
  /\bfull\s*price\b/i,
  /\b\d+%\s*off\b/i,
  // Marketing labels
  /\bbest\s*seller\b/i,
  /\bmost\s*loved\b/i,
  /\bnew\s*arrival\b/i,
  /\btrending\b/i,
  /\bfeatured\b/i,
  /\bstaff\s*pick\b/i,
  // Collection / drop slugs
  /\bdrop\s+[ivx\d]+/i,
  /\b(ss|aw|fw|ss)\d{2,4}\b/i, // "SS24", "AW2024"
  /\bcollection\s*\d+/i,
  // Sizes (already shown in the size pill, redundant as tags)
  /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|one\s*size)$/i,
  /^(uk|us|eu|au)\s*\d+/i, // "UK 10", "US 4"
  // Mix-and-match / set merchandising
  /\bmix\s*\+?\s*match\b/i,
  /\bsets?\b/i,
  // Internal / archived / staff filters
  /\barchived?\b/i,
  /\bstaff\s*only\b/i,
  /\binternal\b/i,
  // Price tier merchandising
  /\bunder\s*[$£€₹]?\s*\d/i,
  /\bbudget\b/i,
  /\bluxury\b/i,
  // Brand-internal taxonomy slugs. Tags that contain `*`, `::`, or `|`
  // are signatures of a merchant's PIM / collection-slug system rather
  // than user-facing copy (e.g. yamayoga emits "yama*santi women" as a
  // tag). These never read well in a fit card.
  /[*|]/,
  /::/,
  // Status / merchandising flags that read as "internal Shopify" not
  // "tells the shopper anything about the garment". yamayoga ships
  // these literally as tags: "new_draft", "new_drop", "out".
  /^new[_\s-](draft|drop|arrival|in)/i,
  /^out$/i,
  /^draft$/i,
  /^archived?$/i,
  /^hidden$/i,
  /^featured$/i,
];

/**
 * Filter a list of raw Shopify tags down to user-facing ones.
 * Order is preserved. Empty / whitespace-only entries are dropped.
 *
 * Optionally pass `excludeCategory` to also strip a tag matching the
 * product's own category (e.g. don't show "Top" as a tag when the
 * category field is already "Top").
 */
export function filterUserFacingTags(
  tags: string[] | undefined | null,
  excludeCategory?: string
): string[] {
  if (!tags || tags.length === 0) return [];

  const lowerCategory = (excludeCategory || '').trim().toLowerCase();

  return tags
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
    .filter((t) => !NOISE_PATTERNS.some((p) => p.test(t)))
    .filter((t) => t.toLowerCase() !== lowerCategory)
    // Snake_case slugs ("yoga_pilates", "working_out") survive the
    // noise filter but read as "internal label" with the underscores
    // intact. Normalize to spaces so they render as natural words on
    // the chip pill (April 29 2026 polish).
    .map((t) => t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim());
}
