/**
 * Native re-export of expo-share-intent
 */
export { useShareIntentContext, ShareIntentProvider } from 'expo-share-intent';

function isHttpUrl(text: string): boolean {
  try {
    const { protocol } = new URL(text);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalise a URL delivered via the OS share sheet.
 *
 * Share-sheet payloads are messier than a pasted string: the URL can
 * arrive with leading/trailing whitespace, wrapped inside a longer
 * "page title + link" blob, or carrying a `#...` fragment (including
 * Chrome text-fragment junk). The direct-paste path sidesteps all of
 * this — which is why a product link can fail via share yet work when
 * pasted into the Home search bar.
 *
 * Returns a clean http(s) URL string, or null when no URL is found.
 */
export function extractSharedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Use the whole string if it's already a bare URL; otherwise pull
  // the first http(s) token out of a longer share blob.
  const candidate = isHttpUrl(trimmed)
    ? trimmed
    : trimmed.match(/https?:\/\/\S+/i)?.[0] ?? null;
  if (!candidate) return null;
  // Strip trailing punctuation that clings when a URL is embedded in
  // prose, e.g. "...check this out (https://x.com/p)."
  const cleaned = candidate.replace(/[)\]}>.,;!?'"]+$/, '');
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Fragments never reach the server and can carry text-fragment
    // junk — drop them so the scrape input matches the paste path.
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
