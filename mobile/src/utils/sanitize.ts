/**
 * String sanitiser for scraped values (brand, product name, etc.).
 *
 * Three jobs:
 *   1. Strip literal "undefined" and "null" tokens that the scraper
 *      sometimes returns when a brand/name has missing fields.
 *      Handles multi-token cases like "undefined undefined", "Nike
 *      undefined", "  null undefined  ".
 *   2. Strip HTML tags + decode common entities. Some Shopify stores
 *      put markup inside their `vendor` / `title` fields (yamayoga.in
 *      embeds `<span class="custom-fonts">…</span>` for a CSS font
 *      swap; others surface `&amp;` etc.). Without stripping, the raw
 *      markup lands on the fit card.
 *   3. Collapse whitespace and trim.
 *
 * Case-sensitive on the "undefined" / "null" filter — we want to
 * strip the JS stringified garbage, not the legitimate word
 * "Undefined" if it ever appeared in a real brand.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeHtmlEntities(s: string): string {
  return s.replace(
    /&(?:nbsp|amp|lt|gt|quot|#39|apos);/g,
    (m) => HTML_ENTITIES[m] ?? m
  );
}

/** Strip HTML tags. Inline tags (`<span>`, `<b>`, `<i>` …) collapse
 *  to nothing so adjacent text fuses (`<span>YAMA</span>YOGA` →
 *  `YAMAYOGA`, not `YAMA YOGA`). Block-level breaks (`<br>`, `</p>`,
 *  `</div>`) produce a space so visually-separated tokens stay
 *  separated (`Brand<br/>Name` → `Brand Name`). Then collapse runs
 *  of whitespace and trim. */
function stripHtml(s: string): string {
  return s
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|td)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitize(val?: string | null): string | undefined {
  if (!val) return undefined;

  // 1. Strip HTML tags first so token-filtering operates on plain
  //    text. Then decode entities.
  const decoded = decodeHtmlEntities(stripHtml(val));

  // 2. Filter the "undefined" / "null" garbage tokens. Keep
  //    case-sensitive so "Undefined" (legitimate) survives.
  const cleaned = decoded
    .trim()
    .split(/\s+/)
    .filter((t) => t !== 'undefined' && t !== 'null')
    .join(' ');

  return cleaned || undefined;
}
