import { formatRelativeTime, displayHostname } from '../utils/relativeTime';

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-04-24T14:30:00Z');

  it('treats missing input as "just now"', () => {
    expect(formatRelativeTime(null)).toBe('just now');
    expect(formatRelativeTime(undefined)).toBe('just now');
    expect(formatRelativeTime('not-a-date' as any)).toBe('just now');
  });

  it('treats recent timestamps (<45s) as "just now"', () => {
    const iso = new Date(NOW.getTime() - 10_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('just now');
  });

  it('formats minutes', () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('5m ago');
  });

  it('formats hours', () => {
    const iso = new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('3h ago');
  });

  it('formats yesterday with wall-clock time', () => {
    const iso = new Date(NOW.getTime() - 30 * 3600 * 1000).toISOString();
    const result = formatRelativeTime(iso, NOW);
    expect(result).toMatch(/^yesterday at \d{2}:\d{2}$/);
  });

  it('formats multi-day ago', () => {
    const iso = new Date(NOW.getTime() - 4 * 24 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('4d ago');
  });

  it('falls back to short date for older than 7 days', () => {
    const iso = new Date('2026-02-10T09:00:00Z').toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('10 Feb');
  });
});

describe('displayHostname', () => {
  it('strips scheme + www', () => {
    expect(displayHostname('https://www.summeraway.in/products/costa-top')).toBe('summeraway.in');
  });

  it('keeps subdomains other than www', () => {
    expect(displayHostname('https://shop.example.com/x')).toBe('shop.example.com');
  });

  it('returns raw string on invalid URL', () => {
    expect(displayHostname('not-a-url')).toBe('not-a-url');
  });
});
