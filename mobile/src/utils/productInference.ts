/**
 * Product inference — derives a likely category + material from
 * URL handle, product title, and tag list when the upstream scrape
 * + AI enrichment didn't surface them.
 *
 * Design intent: every fit card SHOULD have at least a sensible
 * Material + Category line. When the Shopify direct fetch returns
 * blanks (yamayoga's product_type drops as title-echo, no fabric in
 * tags) and the Gemini enrichment also misses (sparse description),
 * this is the last-ditch deterministic fallback before we render a
 * "—" placeholder. Pure regex matching against a haystack of all
 * available text — no network, no AI.
 *
 * The category list is intentionally apparel-focused since 100% of
 * Alate's URL pastes are clothing today. Add new patterns at the
 * top of `CATEGORY_KEYWORDS` for specificity (the loop returns the
 * first match — list specific-first).
 */

/** Ordered patterns — first match wins, so SPECIFIC items come
 *  before general ones. "yoga pants" beats "pants" beats nothing. */
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  // Activewear (specific)
  [/\b(yoga|gym|workout|active|sport|athleisure)\b/i, 'Activewear'],
  // Co-ord sets (must beat "tops" / "shorts" individually)
  [/\b(co[-\s]?ord|matching\s*set|two[-\s]?piece\s*set)\b/i, 'Co-ord Set'],
  // Swimwear (must beat "tops")
  [/\b(swim|bikini|swimwear|swimsuit|trunks)\b/i, 'Swimwear'],
  // Dresses + dress-adjacent
  [/\b(midi|maxi|sundress|gown|kaftan|kurti)\b/i, 'Dresses'],
  [/\bdress\b/i, 'Dresses'],
  // Outerwear
  [/\b(blazer|jacket|coat|trench|parka|cardigan)\b/i, 'Outerwear'],
  // Knitwear (sweaters / hoodies)
  [/\b(sweater|jumper|knit|hoodie|sweatshirt|pullover)\b/i, 'Knitwear'],
  // Suits
  [/\bsuit\b/i, 'Suits'],
  // Bottoms — pants/jeans/trousers/chinos
  [/\b(jean|trouser|slack|chino|legging)s?\b/i, 'Bottoms'],
  [/\bpants?\b/i, 'Bottoms'],
  [/\bshort(s)?\b/i, 'Shorts'],
  [/\bskirt\b/i, 'Skirts'],
  // Tops
  [/\b(t[-\s]?shirt|tee|blouse|tank|polo|camisole|bodysuit)\b/i, 'Tops'],
  [/\btop\b/i, 'Tops'],
  [/\bshirt\b/i, 'Tops'],
  // Footwear
  [/\b(sneaker|trainer|boot|sandal|heel|loafer|mule|flip[-\s]?flop)s?\b/i, 'Footwear'],
  [/\bshoes?\b/i, 'Footwear'],
  // Bags / accessories
  [/\b(bag|tote|clutch|backpack|crossbody|satchel|purse)\b/i, 'Bags'],
  [/\b(scarf|belt|hat|cap|beanie|sunglasses)\b/i, 'Accessories'],
];

/** Fabric vocabulary. Matches against the haystack and Title-cases
 *  the captured group on return. */
const MATERIAL_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(linen)\b/i, 'Linen'],
  [/\bcotton\s+blend\b/i, 'Cotton Blend'],
  [/\b(cotton)\b/i, 'Cotton'],
  [/\b(silk)\b/i, 'Silk'],
  [/\b(merino)\b/i, 'Merino Wool'],
  [/\b(cashmere)\b/i, 'Cashmere'],
  [/\b(wool)\b/i, 'Wool'],
  [/\b(polyester)\b/i, 'Polyester'],
  [/\b(viscose)\b/i, 'Viscose'],
  [/\b(rayon)\b/i, 'Rayon'],
  [/\b(denim)\b/i, 'Denim'],
  [/\b(leather)\b/i, 'Leather'],
  [/\b(suede)\b/i, 'Suede'],
  [/\b(nylon)\b/i, 'Nylon'],
  [/\b(modal)\b/i, 'Modal'],
  [/\b(tencel|lyocell)\b/i, 'Tencel'],
  [/\b(velvet)\b/i, 'Velvet'],
  [/\b(satin)\b/i, 'Satin'],
  [/\b(chiffon)\b/i, 'Chiffon'],
  [/\b(jersey)\b/i, 'Jersey'],
  [/\b(crepe)\b/i, 'Crepe'],
  // Generic knit — last so a specific fibre ("merino knit") wins.
  [/\bknit(ted)?\b/i, 'Knit'],
];

interface InferenceContext {
  /** Full URL or just the path/handle. */
  url?: string;
  /** Product display name. */
  title?: string;
  /** Storefront tag list (Shopify or otherwise). */
  tags?: string[];
}

/** Build the haystack — everything we have, joined into one
 *  case-insensitive search string. URL is included because handles
 *  (`/products/aero-flared-yoga-pants`) frequently carry the
 *  category word that the merchant-supplied product_type missed. */
function buildHaystack(ctx: InferenceContext): string {
  return [ctx.url, ctx.title, ...(ctx.tags ?? [])]
    .filter(Boolean)
    .join(' ');
}

/** Pick a category bucket from URL / title / tags. Returns
 *  undefined when no signal matches; the caller renders a "—"
 *  placeholder in that case. */
export function inferCategory(ctx: InferenceContext): string | undefined {
  const haystack = buildHaystack(ctx);
  if (!haystack.trim()) return undefined;

  for (const [pattern, label] of CATEGORY_KEYWORDS) {
    if (pattern.test(haystack)) return label;
  }
  return undefined;
}

/** Extract the product handle (last path segment) from a URL, with
 *  hyphen/underscore separators turned into spaces — e.g.
 *  `/products/perforated-knit-jumper` → "perforated knit jumper".
 *  Returns "" when the URL is missing or unparseable. */
function urlHandle(url?: string): string {
  if (!url) return '';
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    return seg.replace(/[-_]+/g, ' ');
  } catch {
    return '';
  }
}

/** Pick a fabric from title, tags, and the URL handle. Only the
 *  handle (last path segment) is searched — not the whole URL —
 *  because handles often bake the fabric in (`…-perforated-knit-…`)
 *  when a bespoke storefront schema drops the material field, while
 *  the rest of the path is just brand/category noise. */
export function inferMaterial(ctx: InferenceContext): string | undefined {
  const haystack = [ctx.title, urlHandle(ctx.url), ...(ctx.tags ?? [])]
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return undefined;

  for (const [pattern, label] of MATERIAL_KEYWORDS) {
    if (pattern.test(haystack)) return label;
  }
  return undefined;
}
