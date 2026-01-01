/**
 * Breadcrumb Logic - Config-Driven Implementation
 *
 * This module uses the centralized route configuration to build breadcrumbs.
 * When adding new pages, add them to src/config/routes.ts and breadcrumbs
 * will automatically work.
 *
 * Separated from the React component for unit testability.
 */

import type { LucideIcon } from 'lucide-react';
import {
  ROUTES,
  getRouteConfig,
  getRouteParentChain,
  getSiblingRoutes,
  buildSectionOptions,
  type RouteConfig,
} from '@/config/routes';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
  options?: {
    label: string;
    href: string;
    icon?: LucideIcon;
  }[];
}

export interface BreadcrumbContext {
  pathname: string;
  displayName: string | null;
  moodboards: Array<{
    id: string;
    name: string;
  }>;
  currentMoodboard: { name: string } | null;
  collections?: Array<{
    id: string;
    name: string;
  }>;
  currentCollection?: { name: string } | null;
  isHydrated: boolean;
}

export interface BreadcrumbIcons {
  Layers2: LucideIcon;
  Compass: LucideIcon;
  AlignHorizontalSpaceAround: LucideIcon;
  Grid3X3: LucideIcon;
}

/**
 * Build ROOT_OPTIONS for section switching
 * @deprecated Use buildSectionOptions from @/config/routes instead
 */
export function buildRootOptions(icons: BreadcrumbIcons) {
  return buildSectionOptions(icons);
}

/**
 * Generate moodboard path from name and id
 */
export function generateMoodboardPath(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${id}`;
}

/**
 * Build a breadcrumb segment from a route config
 */
function buildSegmentFromConfig(
  config: RouteConfig,
  href: string,
  icons: BreadcrumbIcons,
  customLabel?: string,
  customOptions?: BreadcrumbSegment['options']
): BreadcrumbSegment {
  const ROOT_OPTIONS = buildSectionOptions(icons);

  const segment: BreadcrumbSegment = {
    label: customLabel || config.label,
    href,
  };

  // Add section switcher dropdown if configured
  if (config.showSectionSwitcher) {
    segment.options = ROOT_OPTIONS;
  }

  // Add sibling routes dropdown if configured
  if (config.showSiblingRoutes) {
    const siblings = getSiblingRoutes(href);
    if (siblings.length > 0) {
      // Include current route + siblings
      const allOptions = [
        { label: config.label, href, icon: icons.Grid3X3 },
        ...siblings.map(s => ({
          label: s.config.label,
          href: s.path,
          icon: icons.Grid3X3,
        })),
      ];
      segment.options = allOptions;
    }
  }

  // Override with custom options if provided
  if (customOptions) {
    segment.options = customOptions;
  }

  return segment;
}

/**
 * Build breadcrumb segments based on pathname and context
 *
 * Rules:
 * - First segment: "User's Mood Layer" or "The Mood Layer" (no dropdown)
 * - Section root segments (Layers, Closet, Discover): show ROOT_OPTIONS dropdown
 * - Dynamic segments (moodboard name, collection name): show list to switch
 * - Other pages: no dropdown
 */
export function buildBreadcrumbs(
  context: BreadcrumbContext,
  icons: BreadcrumbIcons
): BreadcrumbSegment[] {
  const { pathname, displayName, moodboards, currentMoodboard, collections, currentCollection, isHydrated } = context;
  const segments: BreadcrumbSegment[] = [];

  // First segment: User's Mood Layer or The Mood Layer (no dropdown)
  segments.push({
    label: displayName ? `${displayName}'s Mood Layer` : 'The Mood Layer',
    href: '/',
  });

  // Home page - just show root
  if (pathname === '/' || pathname === '') {
    return segments;
  }

  // Get route config
  const routeConfig = getRouteConfig(pathname);

  // Unknown route - just return root breadcrumb
  if (!routeConfig || routeConfig.hidden) {
    return segments;
  }

  // Get parent chain to build full breadcrumb trail
  const parentChain = getRouteParentChain(pathname);

  // Build segments for each parent in the chain
  for (const parentPath of parentChain) {
    const parentConfig = ROUTES[parentPath];
    if (parentConfig && !parentConfig.hidden) {
      segments.push(buildSegmentFromConfig(parentConfig, parentPath, icons));
    }
  }

  // Build segment for current route
  // Handle dynamic routes specially
  if (routeConfig.isDynamic) {
    // Moodboard route: /looks/[moodboardSlug]
    if (pathname.startsWith('/looks/') && !pathname.includes('/discover')) {
      if (isHydrated && currentMoodboard) {
        const moodboardOptions = moodboards.map(mb => ({
          label: mb.name,
          href: `/looks/${generateMoodboardPath(mb.name, mb.id)}`,
          icon: icons.Grid3X3,
        }));

        segments.push({
          label: currentMoodboard.name,
          href: pathname,
          options: moodboardOptions.length > 0 ? moodboardOptions : undefined,
        });
      }
    }
    // Collection detail route: /collections/[id]
    else if (pathname.startsWith('/collections/') && collections && currentCollection) {
      if (isHydrated) {
        const collectionOptions = collections.map(col => ({
          label: col.name,
          href: `/collections/${col.id}`,
          icon: icons.Grid3X3,
        }));

        segments.push({
          label: currentCollection.name,
          href: pathname,
          options: collectionOptions.length > 0 ? collectionOptions : undefined,
        });
      }
    }
  } else {
    // Static route - use config directly
    segments.push(buildSegmentFromConfig(routeConfig, pathname, icons));
  }

  return segments;
}

/**
 * Check if a segment should have a dropdown
 */
export function hasDropdown(segment: BreadcrumbSegment): boolean {
  return Boolean(segment.options && segment.options.length > 0);
}

/**
 * Get expected breadcrumb structure for a given path
 * Useful for testing
 */
export function getExpectedBreadcrumbStructure(pathname: string): {
  segmentCount: number;
  hasDropdownAt: number[];
} {
  const result = {
    segmentCount: 1, // Always has root
    hasDropdownAt: [] as number[],
  };

  if (pathname === '/' || pathname === '') {
    return result;
  }

  const routeConfig = getRouteConfig(pathname);
  if (!routeConfig || routeConfig.hidden) {
    return result;
  }

  const parentChain = getRouteParentChain(pathname);

  // Count segments: root + parents + current
  result.segmentCount = 1 + parentChain.length + 1;

  // Determine which segments have dropdowns
  let index = 1; // Start after root segment

  // Check parent segments
  for (const parentPath of parentChain) {
    const parentConfig = ROUTES[parentPath];
    if (parentConfig?.showSectionSwitcher) {
      result.hasDropdownAt.push(index);
    }
    index++;
  }

  // Check current segment
  if (routeConfig.showSectionSwitcher) {
    result.hasDropdownAt.push(index);
  }
  // Dynamic routes (moodboards) also have dropdowns
  if (routeConfig.isDynamic && pathname.startsWith('/looks/') && !pathname.includes('/discover')) {
    result.hasDropdownAt.push(index);
  }

  return result;
}

/**
 * Get all configured routes (for debugging/documentation)
 */
export function getAllRoutes(): Record<string, RouteConfig> {
  return { ...ROUTES };
}
