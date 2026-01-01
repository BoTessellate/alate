/**
 * Breadcrumb Logic - Extracted for testability
 *
 * This module contains the pure logic for building breadcrumb segments.
 * It's separated from the React component so it can be unit tested independently.
 */

import type { LucideIcon } from 'lucide-react';

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
 */
export function buildRootOptions(icons: BreadcrumbIcons) {
  return [
    { label: 'Layers', href: '/looks', icon: icons.Layers2 },
    { label: 'Closet', href: '/closet', icon: icons.AlignHorizontalSpaceAround },
    { label: 'Discover', href: '/discover', icon: icons.Compass },
  ];
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
 * Build breadcrumb segments based on pathname and context
 *
 * Rules:
 * - First segment: "User's Mood Layer" or "The Mood Layer" (no dropdown)
 * - Section segments (Layers, Closet, Discover): show ROOT_OPTIONS dropdown
 * - Moodboard segment: show list of moodboards to switch between
 * - Settings: no dropdown
 */
export function buildBreadcrumbs(
  context: BreadcrumbContext,
  icons: BreadcrumbIcons
): BreadcrumbSegment[] {
  const { pathname, displayName, moodboards, currentMoodboard, isHydrated } = context;
  const ROOT_OPTIONS = buildRootOptions(icons);
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

  // LOOKS SECTION
  if (pathname.startsWith('/looks')) {
    // "Layers" shows navigation options to switch sections
    segments.push({
      label: 'Layers',
      href: '/looks',
      options: ROOT_OPTIONS,
    });

    // /looks page - shows all moodboards
    if (pathname === '/looks') {
      return segments;
    }

    // /looks/discover - discover looks page
    if (pathname === '/looks/discover') {
      segments.push({
        label: 'Discover',
        href: '/looks/discover',
      });
      return segments;
    }

    const pathParts = pathname.split('/').filter(Boolean);

    // /looks/[moodboardSlug] - moodboard editor
    if (pathParts.length === 2 && isHydrated && currentMoodboard) {
      // Get all moodboards as options for dropdown to switch boards
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
      return segments;
    }

    return segments;
  }

  // DISCOVER PAGE (at root level)
  if (pathname === '/discover') {
    segments.push({
      label: 'Discover',
      href: '/discover',
      options: ROOT_OPTIONS,
    });
    return segments;
  }

  // CLOSET SECTION
  if (pathname.startsWith('/closet')) {
    // "Closet" shows navigation options to switch sections
    segments.push({
      label: 'Closet',
      href: '/closet',
      options: ROOT_OPTIONS,
    });

    if (pathname === '/closet/personal') {
      segments.push({
        label: 'Personal Collection',
        href: '/closet/personal',
      });
    }
    return segments;
  }

  // SETTINGS SECTION
  if (pathname === '/settings') {
    segments.push({
      label: 'Account Settings',
      href: '/settings',
    });
    return segments;
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

  if (pathname.startsWith('/looks')) {
    result.segmentCount = 2;
    result.hasDropdownAt = [1]; // "Layers" has dropdown

    if (pathname !== '/looks' && pathname !== '/looks/discover') {
      // Moodboard editor
      result.segmentCount = 3;
      result.hasDropdownAt = [1, 2]; // Both "Layers" and moodboard name have dropdowns
    }

    if (pathname === '/looks/discover') {
      result.segmentCount = 3;
      result.hasDropdownAt = [1]; // Only "Layers" has dropdown
    }
  }

  if (pathname === '/discover') {
    result.segmentCount = 2;
    result.hasDropdownAt = [1]; // "Discover" has dropdown
  }

  if (pathname.startsWith('/closet')) {
    result.segmentCount = 2;
    result.hasDropdownAt = [1]; // "Closet" has dropdown

    if (pathname === '/closet/personal') {
      result.segmentCount = 3;
      result.hasDropdownAt = [1]; // Only "Closet" has dropdown
    }
  }

  if (pathname === '/settings') {
    result.segmentCount = 2;
    result.hasDropdownAt = []; // No dropdowns
  }

  return result;
}
