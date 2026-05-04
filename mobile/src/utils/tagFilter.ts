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
  // Sale codes: "sale", "sale-10", "may-sale", "blackfriday-sale", and
  // common typos / merchant suffixes: "salex", "sales", "saleitem".
  // Word-boundary on the LEFT only — anchoring right with \b would
  // miss "salex" (which is what bit us in Reistor testing May 2 2026).
  /\bsale(?:s|x|item)?\b/i,
  // Fused sale flags with no word-boundary on the left:
  // "onsale" / "on-sale" / "on_sale" — Genes Le Coanet Hemant
  // (May 3 2026 PM) shipped these as discrete tags. Don't bound on
  // the left so the literal "onsale" matches.
  /\b(?:on[\s_-]?sale|onsale)\b/i,
  // "save 50%" / "save up to 50%" / "save upto 50%" — discount-amount
  // labels (Genes Le Coanet Hemant, May 3 2026 PM). Allow optional
  // "up(\s)?to" between "save" and the percentage.
  /\bsave\s+(?:up\s*to\s+)?\d{1,3}\s*%/i,
  // Date-bounded marketing tags: "april26-sale-10", "spring2026"
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\d/i,
  // Pricing labels — "Full Price", "20% off", "new price", "regular
  // price", "marked down". Same family: merchandising flags that
  // describe the price stage, not the garment.
  /\bfull\s*price\b/i,
  /\b\d+%\s*off\b/i,
  /\bnew\s+price\b/i,
  /\bregular\s+price\b/i,
  /\bmarked\s+down\b/i,
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
  // Resort / cruise / capsule + 2-4 digit collection codes —
  // "resort24", "cruise2025", "holiday-25", "capsule24". Mirrors the
  // existing season-prefix pattern; merchants extend the same naming
  // scheme to non-spring/fall lines.
  /\b(resort|cruise|holiday|festive|capsule)\W?\d{2,4}\b/i,
  // Long-form season-year labels: "spring summer 23", "spring/summer
  // 2023", "fall winter 24", "autumn winter 2024". Mirrors the
  // SS24 / AW2024 pattern but for spelled-out season names. A SECOND
  // season is optional (handles single-season lines like "spring
  // 2023" too). YEAR is REQUIRED so a bare "summer" tag still passes
  // the filter — that's a legit garment tag.
  /\b(spring|summer|fall|autumn|winter)(?:[\s\/]+(spring|summer|fall|autumn|winter))?[\s\/]*\d{2,4}\b/i,
  /\bcollection\s*\d+/i,
  // Sizes (already shown in the size pill, redundant as tags)
  /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|one\s*size)$/i,
  /^(uk|us|eu|au)\s*\d+/i, // "UK 10", "US 4"
  // SKU / design-code shaped tags: 1-4 letters, optional separator,
  // 1-4 digits, optional `-N` suffix. Catches "dc-01", "tm08", "sku123",
  // "AB-12-3". Real garment tags with hyphens stay safe because they
  // have no digit run ("v-neck", "high-waisted", "off-shoulder").
  /^[a-z]{1,4}[-_]?\d{1,4}(?:[-_]\d{1,3})?$/i,
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
 * Normalize a tag for dedup comparison. Lowercase, strip whitespace +
 * hyphens + underscores. Catches the Reistor case (May 2 2026) where
 * "organic cotton" and "organiccotton" rendered as separate chips —
 * same attribute, two formattings.
 */
function dedupKey(tag: string): string {
  return tag.toLowerCase().replace(/[\s\-_]+/g, '');
}

// ─── STRICT-MODE WHITELIST ──────────────────────────────────────────
// Garment-attribute keywords. In `strict` mode (May 4 2026, opt-in),
// a tag is kept ONLY if its lowercased text contains one of these
// substrings. Defends against marketing copy that slips past the
// noise patterns ("shop the look", "must have", "editor pick", etc.)
// by requiring the tag to look like a garment descriptor.
//
// Categories follow the user's spec ("material, texture, colour,
// length, product type" + the natural extensions: fit/silhouette,
// occasion, construction). Substring match (lowercased) so phrasing
// variations ("cotton dress", "100% cotton") all hit "cotton" and
// pass through. Conservative — better to under-show than to surface
// noise the user has flagged twice.
const GARMENT_ATTR_KEYWORDS: string[] = [
  // Materials
  'cotton', 'linen', 'silk', 'wool', 'polyester', 'viscose', 'rayon',
  'nylon', 'elastane', 'spandex', 'lycra', 'denim', 'leather', 'suede',
  'cashmere', 'merino', 'tencel', 'modal', 'jersey', 'knit', 'chiffon',
  'satin', 'velvet', 'tweed', 'fleece', 'crepe', 'organza', 'tulle',
  'lace', 'muslin', 'terry', 'corduroy', 'georgette', 'crepon', 'twill',
  // Textures / surface treatments
  'ribbed', 'textured', 'embroidered', 'pleated', 'smocked', 'quilted',
  'sequin', 'beaded', 'fringed', 'crochet', 'cable', 'waffle', 'striped',
  'printed', 'patterned', 'floral', 'polka', 'paisley', 'gingham',
  'plaid', 'tartan', 'herringbone', 'houndstooth', 'jacquard', 'brocade',
  'applique',
  // Colours
  'black', 'white', 'navy', 'beige', 'cream', 'ivory', 'grey', 'gray',
  'tan', 'camel', 'sand', 'olive', 'mustard', 'burgundy', 'maroon',
  'scarlet', 'crimson', 'cherry', 'coral', 'peach', 'salmon', 'nude',
  'pink', 'rose', 'blush', 'magenta', 'fuchsia', 'red', 'orange',
  'yellow', 'green', 'emerald', 'jade', 'mint', 'sage', 'teal',
  'turquoise', 'aqua', 'blue', 'indigo', 'cobalt', 'royal', 'sky',
  'pastel', 'lavender', 'lilac', 'purple', 'violet', 'plum', 'brown',
  'chocolate', 'khaki', 'charcoal', 'metallic', 'gold', 'silver',
  'bronze', 'copper',
  // Lengths
  'mini', 'midi', 'maxi', 'short', 'long', 'knee', 'ankle', 'floor',
  'cropped', 'crop', 'tea',
  // Product types
  'dress', 'gown', 'skirt', 'shorts', 'trouser', 'pant', 'jean',
  'legging', 'jumpsuit', 'playsuit', 'romper', 'top', 'tee', 'tshirt',
  'tank', 'cami', 'camisole', 'blouse', 'shirt', 'tunic', 'sweatshirt',
  'hoodie', 'sweater', 'jumper', 'cardigan', 'coat', 'jacket', 'blazer',
  'vest', 'gilet', 'kimono', 'kaftan', 'caftan', 'kurta', 'kurti',
  'saree', 'sari', 'dhoti', 'lehenga', 'salwar', 'coord', 'bralette',
  'bodysuit', 'bra', 'swimsuit', 'bikini', 'loungewear', 'nightwear',
  'pyjama', 'pajama',
  // Fit / silhouette / construction
  'slim', 'fitted', 'loose', 'relaxed', 'oversized', 'tailored', 'wide',
  'straight', 'skinny', 'bootcut', 'flared', 'tapered', 'baggy', 'boxy',
  'cinched', 'empire', 'sheath', 'shift', 'wrap', 'halter', 'strapless',
  'sleeveless', 'backless', 'turtleneck', 'mockneck', 'vneck', 'crewneck',
  'scoopneck', 'squareneck', 'boatneck', 'cowl',
  // Occasion / vibe
  'casual', 'formal', 'cocktail', 'evening', 'wedding', 'party',
  'workwear', 'office', 'brunch', 'vacation', 'beach', 'resort',
  'summer', 'winter', 'spring', 'fall', 'autumn', 'festive', 'minimal',
  'easy', 'easystyle', 'breezy', 'flowy', 'breathable', 'lightweight',
  'airy', 'heavyweight',
  // Construction / craft
  'handcrafted', 'handmade', 'handwoven', 'organic', 'sustainable',
  'eco', 'recycled', 'natural',
];

function looksLikeGarmentAttr(tag: string): boolean {
  const normalized = tag.toLowerCase();
  return GARMENT_ATTR_KEYWORDS.some((kw) => normalized.includes(kw));
}

export interface FilterOptions {
  /** Strict mode (May 4 2026): drop any tag that doesn't contain a
   *  known garment-attribute keyword. Recommended for the FitResult
   *  tags chip row. Default off so existing callers don't change
   *  behaviour. */
  strict?: boolean;
}

/**
 * Filter a list of raw Shopify tags down to user-facing ones.
 * Order is preserved. Empty / whitespace-only entries are dropped.
 *
 * Optionally pass:
 *   - `excludeCategory`: strip a tag matching the product's own
 *     category (e.g. don't show "Top" as a tag when the category
 *     field is already "Top").
 *   - `excludeMaterial`: strip a tag matching the product's own
 *     material (May 3 2026 — Cordstudio's `poem-dress-f22-pnd-rt`
 *     surfaced "100% cotton" both in the MATERIAL row and as a tag
 *     chip below; user feedback flagged the redundancy). Comparison
 *     uses the same normalisation as dedupKey (case + whitespace +
 *     hyphen + underscore insensitive) so "100% cotton" matches
 *     "100%cotton" / "100%COTTON" / "100% Cotton".
 */
export function filterUserFacingTags(
  tags: string[] | undefined | null,
  excludeCategory?: string,
  excludeMaterial?: string,
  options: FilterOptions = {}
): string[] {
  if (!tags || tags.length === 0) return [];

  const lowerCategory = (excludeCategory || '').trim().toLowerCase();
  const materialKey = excludeMaterial ? dedupKey(excludeMaterial) : '';

  const cleaned = tags
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
    .filter((t) => !NOISE_PATTERNS.some((p) => p.test(t)))
    .filter((t) => t.toLowerCase() !== lowerCategory)
    .filter((t) => !materialKey || dedupKey(t) !== materialKey)
    // Snake_case slugs ("yoga_pilates", "working_out") survive the
    // noise filter but read as "internal label" with the underscores
    // intact. Normalize to spaces so they render as natural words on
    // the chip pill (April 29 2026 polish).
    .map((t) => t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
    // Strict mode: drop anything that doesn't read as a garment
    // attribute. Off by default to keep existing call sites' output
    // unchanged.
    .filter((t) => !options.strict || looksLikeGarmentAttr(t));

  // Dedupe: case + whitespace + separator-insensitive. Reistor (May 2
  // 2026) shipped both "organic cotton" and "organiccotton" — same
  // attribute, two formattings. First occurrence wins to preserve the
  // merchant's preferred presentation.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tag of cleaned) {
    const key = dedupKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tag);
  }
  return deduped;
}
