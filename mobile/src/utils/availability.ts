/**
 * Availability — derives in-stock / out-of-stock state for the user's
 * recommended size from the storefront's `availableSizes` array.
 *
 * Why we don't need a separate `/api/availability/check` endpoint:
 * the Shopify direct-fetch layer (backend/sdk/productScraping/
 * shopifyFetch.ts) already returns `availableSizes` filtered to
 * variants with `inventory_management: 'shopify'`. So the same scrape
 * call that produces the fit verdict also tells us which sizes are
 * actually stocked. The "your recommended size is/isn't available"
 * answer is the most actionable read for a shopper, even more so than
 * a generic "X items left".
 *
 * Three states:
 *   - `in_stock`     — recommended size is in `availableSizes`
 *   - `out_of_stock` — recommended size is NOT in `availableSizes`
 *                      (but the list itself exists, so we know it's
 *                      a Shopify storefront)
 *   - `unknown`      — list missing (non-Shopify scrape) or recommended
 *                      size missing (avatar-derived size unavailable)
 *
 * The previous spec called for a `low_stock` state when count <= 5,
 * but the public Shopify JSON endpoint doesn't expose inventory
 * counts — only whether `inventory_management` is set. Skip for now;
 * the merchant-plugin v2 will expose actual counts via webhook.
 */

export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'unknown';

export interface AvailabilityState {
  status: AvailabilityStatus;
  /** Recommended size at the time availability was computed (so
   *  history cards can show "in stock in L" even if the avatar later
   *  changes and we'd recommend a different size). */
  size?: string;
  /** When this availability snapshot was taken. ISO timestamp. */
  checkedAt: string;
}

export function computeAvailability(
  recommendedSize: string | undefined | null,
  availableSizes: string[] | undefined | null,
  now: Date = new Date()
): AvailabilityState {
  const checkedAt = now.toISOString();

  // No size list at all — non-Shopify scrape or HTML extraction
  // couldn't find variant data. Honest answer is "we don't know".
  if (!availableSizes || availableSizes.length === 0) {
    return { status: 'unknown', size: recommendedSize ?? undefined, checkedAt };
  }

  // We have a size list but no recommendation (e.g. fit-check failed
  // upstream). Surface the unknown state — the user can still see the
  // raw available sizes elsewhere if needed.
  if (!recommendedSize) {
    return { status: 'unknown', size: undefined, checkedAt };
  }

  // Case-insensitive match — Shopify variants use "M" but some sites
  // mix case ("m" / "Medium"). Normalising both sides here is cheap.
  const normalised = recommendedSize.trim().toLowerCase();
  const found = availableSizes.some((s) => s.trim().toLowerCase() === normalised);

  return {
    status: found ? 'in_stock' : 'out_of_stock',
    size: recommendedSize,
    checkedAt,
  };
}

/** Display copy for a given availability status — short, in lower-case
 *  to match the app's serif voice. The size suffix is appended by the
 *  caller (e.g. "in stock · L"). */
export function describeAvailability(
  status: AvailabilityStatus,
  size?: string
): string {
  switch (status) {
    case 'in_stock':
      return size ? `in stock · ${size}` : 'in stock';
    case 'out_of_stock':
      return size ? `out of stock · ${size}` : 'out of stock';
    case 'unknown':
      return 'stock unknown';
  }
}
