/**
 * Strip literal "undefined" and "null" tokens the scraper sometimes returns
 * when a brand/name has partial/missing fields. Handles multi-token cases
 * like "undefined undefined", "Nike undefined", "  null undefined  ".
 *
 * Case-sensitive on purpose — we want to filter the JS stringified garbage,
 * not the legitimate word "Undefined" (as a product name/title) if it ever
 * appeared.
 */
export function sanitize(val?: string | null): string | undefined {
  if (!val) return undefined;
  const cleaned = val
    .trim()
    .split(/\s+/)
    .filter((t) => t !== 'undefined' && t !== 'null')
    .join(' ');
  return cleaned || undefined;
}
