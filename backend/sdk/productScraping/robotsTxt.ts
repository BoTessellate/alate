/**
 * Minimal robots.txt honour check — consulted by the scraper before
 * hitting a product URL.
 *
 * We implement a small subset of the robots.txt spec that's sufficient
 * for our use case: we check whether Alate's User-Agent (or a wildcard)
 * is disallowed from the product path. Full RFC support is out of
 * scope — this is a good-faith signal, not a compliance-grade parser.
 *
 * Behaviour on ambiguity:
 *   - robots.txt 404 / network error → ALLOW (most sites don't serve one)
 *   - robots.txt present but no matching rule → ALLOW
 *   - matching Disallow found → BLOCK
 *
 * Cached per-origin for 60 minutes so we don't re-fetch on every scrape.
 */

import { createModuleLogger } from '../shared/logger';

const log = createModuleLogger('robots-txt');

const TTL_MS = 60 * 60 * 1000; // 1-hour cache per origin

type RobotsRule = { userAgent: string; disallow: string[]; allow: string[] };

interface CacheEntry {
  rules: RobotsRule[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Reset the in-memory cache. Test-only helper. */
export function resetRobotsCache(): void {
  cache.clear();
}

/**
 * Parse robots.txt content into grouped rules. We handle the common
 * `User-agent:` / `Disallow:` / `Allow:` pattern. Comments and unknown
 * directives are ignored.
 */
export function parseRobotsTxt(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    // Strip comments + trim.
    const line = raw.split('#')[0].trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // A new User-agent section starts a new rule group, unless the
      // previous line was ALSO a user-agent (multiple UAs can share
      // a rule block — we merge them into separate rules for simplicity).
      current = { userAgent: value.toLowerCase(), disallow: [], allow: [] };
      rules.push(current);
    } else if (directive === 'disallow' && current) {
      // Empty Disallow means "allow all" per spec — we just skip,
      // which is equivalent given our default-allow posture.
      if (value) current.disallow.push(value);
    } else if (directive === 'allow' && current) {
      if (value) current.allow.push(value);
    }
  }

  return rules;
}

/**
 * Apply parsed rules to a given user-agent + path. Returns true if the
 * path is disallowed for the agent. Follows the standard precedence:
 * Alate-specific rules > wildcard rules; longer match > shorter match;
 * Allow tied with Disallow ⇒ Allow wins.
 */
export function isPathDisallowed(
  rules: RobotsRule[],
  userAgent: string,
  path: string
): boolean {
  const ua = userAgent.toLowerCase();

  // Find the most specific matching rule group: Alate-named UA beats
  // the wildcard `*` group. If neither matches, no rules apply.
  const alateGroup = rules.find((r) => r.userAgent === 'alate' || ua.includes(r.userAgent));
  const wildcardGroup = rules.find((r) => r.userAgent === '*');
  const active = alateGroup ?? wildcardGroup;
  if (!active) return false;

  // Longest-match wins between Disallow and Allow.
  let longestDisallow = '';
  for (const pattern of active.disallow) {
    if (path.startsWith(pattern) && pattern.length > longestDisallow.length) {
      longestDisallow = pattern;
    }
  }
  let longestAllow = '';
  for (const pattern of active.allow) {
    if (path.startsWith(pattern) && pattern.length > longestAllow.length) {
      longestAllow = pattern;
    }
  }

  // Disallow only wins if it's strictly longer than the matching Allow.
  return longestDisallow.length > longestAllow.length;
}

/**
 * Check whether a URL is disallowed by the origin's robots.txt for
 * Alate's User-Agent. Fails open on network errors — we do NOT want
 * to block legitimate scrapes because the origin's robots endpoint
 * is flaky.
 */
export async function isDisallowedByRobots(
  url: URL,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const origin = url.origin;
  const now = Date.now();

  let entry = cache.get(origin);
  if (!entry || now >= entry.expiresAt) {
    try {
      const res = await fetchFn(`${origin}/robots.txt`, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
            'Alate/1.0 (+https://alate.app)',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        // 404 / 403 / 500 — treat as "no robots present, allow."
        entry = { rules: [], expiresAt: now + TTL_MS };
      } else {
        const text = await res.text();
        entry = { rules: parseRobotsTxt(text), expiresAt: now + TTL_MS };
      }
    } catch (err) {
      log.debug({ origin, error: (err as Error).message }, 'robots.txt fetch failed — allowing');
      entry = { rules: [], expiresAt: now + TTL_MS };
    }
    cache.set(origin, entry);
  }

  return isPathDisallowed(entry.rules, 'Alate', url.pathname);
}
