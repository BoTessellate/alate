/**
 * robots.txt parser + path-disallow tests.
 */

import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, isPathDisallowed } from './robotsTxt';

describe('parseRobotsTxt', () => {
  it('parses a simple rule', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /admin
Allow: /admin/public
`);
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe('*');
    expect(rules[0].disallow).toEqual(['/admin']);
    expect(rules[0].allow).toEqual(['/admin/public']);
  });

  it('strips comments', () => {
    const rules = parseRobotsTxt(`
# general policy
User-agent: * # all bots
Disallow: /private # secret
`);
    expect(rules[0].disallow).toEqual(['/private']);
  });

  it('parses multiple user-agent groups', () => {
    const rules = parseRobotsTxt(`
User-agent: Alate
Disallow: /

User-agent: *
Disallow: /admin
`);
    expect(rules).toHaveLength(2);
    expect(rules[0].userAgent).toBe('alate');
    expect(rules[1].userAgent).toBe('*');
  });

  it('ignores empty Disallow (means allow-all)', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow:
`);
    expect(rules[0].disallow).toEqual([]);
  });
});

describe('isPathDisallowed', () => {
  it('allows when no rules match the UA', () => {
    const rules = parseRobotsTxt(`
User-agent: Googlebot
Disallow: /
`);
    expect(isPathDisallowed(rules, 'Alate', '/products/foo')).toBe(false);
  });

  it('blocks when wildcard UA disallows the path', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /admin
`);
    expect(isPathDisallowed(rules, 'Alate', '/admin/users')).toBe(true);
  });

  it('allows when wildcard UA disallow does not match the path', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /admin
`);
    expect(isPathDisallowed(rules, 'Alate', '/products/foo')).toBe(false);
  });

  it('prefers Alate-specific rules over wildcard', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /

User-agent: Alate
Disallow: /admin
`);
    // Alate-named group allows /products (only /admin is disallowed)
    expect(isPathDisallowed(rules, 'Alate', '/products/foo')).toBe(false);
    expect(isPathDisallowed(rules, 'Alate', '/admin/x')).toBe(true);
  });

  it('honours Allow over shorter Disallow', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /shop
Allow: /shop/public
`);
    expect(isPathDisallowed(rules, 'Alate', '/shop/private')).toBe(true);
    expect(isPathDisallowed(rules, 'Alate', '/shop/public/item')).toBe(false);
  });
});
