/**
 * Relative-time formatter — "3m ago", "2h ago", "yesterday at 14:30".
 * Short, human, locale-neutral. Used on the fit-analysis attribution
 * footer to show when the data was scraped.
 */

export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'just now';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'just now';

  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 45) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 2) {
    const hh = then.getHours().toString().padStart(2, '0');
    const mm = then.getMinutes().toString().padStart(2, '0');
    return `yesterday at ${hh}:${mm}`;
  }
  if (diffDay < 7) return `${diffDay}d ago`;

  // Fallback for older entries — short date like "24 Apr".
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

/**
 * Extract a display hostname from a URL — no scheme, no www. prefix,
 * no path. Used on the attribution footer: "Data from summeraway.in".
 */
export function displayHostname(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
