/**
 * Centralized Route Configuration
 *
 * Single source of truth for all routes, their labels, sections, and breadcrumb behavior.
 * When adding a new page, add it here and breadcrumbs will automatically work.
 *
 * Usage:
 * ```ts
 * import { ROUTES, getRouteConfig, getSectionRoutes } from '@/config/routes';
 * ```
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Section identifiers - main navigation areas
 */
export type Section = 'looks' | 'closet' | 'discover' | null;

/**
 * Route configuration for a single route
 */
export interface RouteConfig {
  /** Display label in breadcrumbs */
  label: string;
  /** Which main section this route belongs to (null for standalone pages) */
  section: Section;
  /** Parent route path (for nested breadcrumbs) */
  parent?: string;
  /** Whether this route should show the section switcher dropdown */
  showSectionSwitcher?: boolean;
  /** Whether this route is a section root (like /looks, /closet, /discover) */
  isSectionRoot?: boolean;
  /** Whether this is a dynamic route (has [param] segments) */
  isDynamic?: boolean;
  /** Hide from breadcrumbs entirely */
  hidden?: boolean;
  /** Show sibling routes in dropdown (routes with same parent) */
  showSiblingRoutes?: boolean;
}

/**
 * All route configurations
 *
 * Key: pathname pattern (use [param] for dynamic segments)
 * Value: RouteConfig
 */
export const ROUTES: Record<string, RouteConfig> = {
  // ============ HOME ============
  '/': {
    label: 'Home',
    section: null,
  },

  // ============ LOOKS/LAYERS SECTION ============
  '/looks': {
    label: 'Layers',
    section: 'looks',
    isSectionRoot: true,
    showSectionSwitcher: true,
  },
  '/looks/discover': {
    label: 'Discover',
    section: 'looks',
    parent: '/looks',
  },
  '/looks/[moodboardSlug]': {
    label: '', // Dynamic - filled at runtime with moodboard name
    section: 'looks',
    parent: '/looks',
    isDynamic: true,
  },

  // ============ DISCOVER SECTION (root level) ============
  '/discover': {
    label: 'Discover',
    section: 'discover',
    isSectionRoot: true,
    showSectionSwitcher: true,
  },

  // ============ CLOSET SECTION ============
  '/closet': {
    label: 'Closet',
    section: 'closet',
    isSectionRoot: true,
    showSectionSwitcher: true,
  },
  '/closet/personal': {
    label: 'Personal',
    section: 'closet',
    parent: '/closet',
    showSiblingRoutes: true,
  },
  '/closet/community': {
    label: 'Community',
    section: 'closet',
    parent: '/closet',
    showSiblingRoutes: true,
  },
  '/closet/discover': {
    label: 'Discover',
    section: 'closet',
    parent: '/closet',
    showSiblingRoutes: true,
  },

  // ============ COLLECTIONS SECTION ============
  '/collections': {
    label: 'Collections',
    section: 'closet',
    parent: '/closet',
  },
  '/collections/[id]': {
    label: '', // Dynamic - filled at runtime with collection name
    section: 'closet',
    parent: '/collections',
    isDynamic: true,
  },

  // ============ STANDALONE PAGES ============
  '/settings': {
    label: 'Account Settings',
    section: null,
  },
  '/admin': {
    label: 'Admin Dashboard',
    section: null,
  },
  '/onboarding': {
    label: 'Onboarding',
    section: null,
    hidden: true, // Excluded from breadcrumbs
  },
};

/**
 * Section icons configuration
 * Maps section IDs to their icon keys
 */
export interface SectionIconConfig {
  looks: LucideIcon;
  closet: LucideIcon;
  discover: LucideIcon;
}

/**
 * Section switcher options (for dropdown)
 */
export interface SectionOption {
  label: string;
  href: string;
  icon?: LucideIcon;
  section: Section;
}

/**
 * Build section switcher options with icons
 */
export function buildSectionOptions(icons: {
  Layers2: LucideIcon;
  AlignHorizontalSpaceAround: LucideIcon;
  Compass: LucideIcon;
}): SectionOption[] {
  return [
    { label: 'Layers', href: '/looks', icon: icons.Layers2, section: 'looks' },
    { label: 'Closet', href: '/closet', icon: icons.AlignHorizontalSpaceAround, section: 'closet' },
    { label: 'Discover', href: '/discover', icon: icons.Compass, section: 'discover' },
  ];
}

/**
 * Get route config for a pathname
 *
 * Handles both static and dynamic routes.
 * For dynamic routes like /looks/my-board-123, matches /looks/[moodboardSlug]
 */
export function getRouteConfig(pathname: string): RouteConfig | null {
  // Try exact match first
  if (ROUTES[pathname]) {
    return ROUTES[pathname];
  }

  // Try dynamic route matching
  const segments = pathname.split('/').filter(Boolean);

  // Check for dynamic patterns
  for (const [pattern, config] of Object.entries(ROUTES)) {
    if (!config.isDynamic) continue;

    const patternSegments = pattern.split('/').filter(Boolean);

    // Must have same number of segments
    if (patternSegments.length !== segments.length) continue;

    // Check if pattern matches (considering [param] wildcards)
    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSeg = patternSegments[i];
      const actualSeg = segments[i];

      // Dynamic segment matches anything
      if (patternSeg.startsWith('[') && patternSeg.endsWith(']')) {
        continue;
      }

      // Static segment must match exactly
      if (patternSeg !== actualSeg) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return config;
    }
  }

  return null;
}

/**
 * Get the section root config for a given section
 */
export function getSectionRootConfig(section: Section): RouteConfig | null {
  if (!section) return null;

  for (const [, config] of Object.entries(ROUTES)) {
    if (config.section === section && config.isSectionRoot) {
      return config;
    }
  }

  return null;
}

/**
 * Get all routes within a section
 */
export function getSectionRoutes(section: Section): Array<{ path: string; config: RouteConfig }> {
  return Object.entries(ROUTES)
    .filter(([, config]) => config.section === section && !config.hidden)
    .map(([path, config]) => ({ path, config }));
}

/**
 * Check if a pathname is within a section
 */
export function isInSection(pathname: string, section: Section): boolean {
  const config = getRouteConfig(pathname);
  return config?.section === section;
}

/**
 * Get parent chain for a route (for building breadcrumb trail)
 */
export function getRouteParentChain(pathname: string): string[] {
  const chain: string[] = [];
  let currentPath = pathname;

  // Prevent infinite loops
  const visited = new Set<string>();

  while (currentPath) {
    if (visited.has(currentPath)) break;
    visited.add(currentPath);

    const config = getRouteConfig(currentPath);
    if (!config?.parent) break;

    chain.unshift(config.parent);
    currentPath = config.parent;
  }

  return chain;
}

/**
 * Get sibling routes (routes with the same parent)
 * Used for showing navigation options in breadcrumb dropdowns
 */
export function getSiblingRoutes(pathname: string): Array<{ path: string; config: RouteConfig }> {
  const currentConfig = getRouteConfig(pathname);
  if (!currentConfig?.parent) return [];

  const parent = currentConfig.parent;

  return Object.entries(ROUTES)
    .filter(([path, config]) => {
      // Same parent, not hidden, not dynamic (we don't show dynamic routes as siblings)
      return config.parent === parent &&
        !config.hidden &&
        !config.isDynamic &&
        path !== pathname; // Exclude current route
    })
    .map(([path, config]) => ({ path, config }));
}
