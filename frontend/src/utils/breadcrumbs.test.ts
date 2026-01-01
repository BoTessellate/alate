/**
 * Unit tests for breadcrumb logic
 *
 * These tests validate the breadcrumb building logic independently
 * from the React component. When these tests fail, the root cause
 * is in the logic, not the UI rendering.
 */

import {
  buildBreadcrumbs,
  getExpectedBreadcrumbStructure,
  hasDropdown,
  type BreadcrumbContext,
  type BreadcrumbIcons,
} from './breadcrumbs';

// Mock icons (we don't need actual icons for logic testing)
const mockIcons: BreadcrumbIcons = {
  Layers2: (() => null) as unknown as BreadcrumbIcons['Layers2'],
  Compass: (() => null) as unknown as BreadcrumbIcons['Compass'],
  AlignHorizontalSpaceAround: (() => null) as unknown as BreadcrumbIcons['AlignHorizontalSpaceAround'],
  Grid3X3: (() => null) as unknown as BreadcrumbIcons['Grid3X3'],
};

const mockMoodboards = [
  { id: '1', name: 'Bedroom Makeover' },
  { id: '2', name: 'Living Room' },
  { id: '3', name: 'Office Setup' },
];

function createContext(overrides: Partial<BreadcrumbContext> = {}): BreadcrumbContext {
  return {
    pathname: '/',
    displayName: null,
    moodboards: mockMoodboards,
    currentMoodboard: null,
    isHydrated: true,
    ...overrides,
  };
}

describe('buildBreadcrumbs', () => {
  describe('Home page', () => {
    it('should return only root segment on home page', () => {
      const context = createContext({ pathname: '/' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(1);
      expect(segments[0].label).toBe('The Mood Layer');
      expect(segments[0].href).toBe('/');
      expect(segments[0].options).toBeUndefined();
    });

    it('should show user name when logged in', () => {
      const context = createContext({ pathname: '/', displayName: 'John' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments[0].label).toBe("John's Mood Layer");
    });
  });

  describe('Looks section', () => {
    it('should show Layers with ROOT_OPTIONS dropdown on /looks', () => {
      const context = createContext({ pathname: '/looks' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(2);
      expect(segments[1].label).toBe('Layers');
      expect(segments[1].href).toBe('/looks');
      expect(segments[1].options).toHaveLength(3); // Layers, Closet, Discover
    });

    it('should show moodboard name with moodboard options on editor', () => {
      const context = createContext({
        pathname: '/looks/bedroom-makeover-1',
        currentMoodboard: { name: 'Bedroom Makeover' },
      });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(3);
      expect(segments[1].label).toBe('Layers');
      expect(segments[2].label).toBe('Bedroom Makeover');
      expect(segments[2].options).toHaveLength(3); // All moodboards
    });

    it('should not show moodboard dropdown before hydration', () => {
      const context = createContext({
        pathname: '/looks/bedroom-makeover-1',
        currentMoodboard: { name: 'Bedroom Makeover' },
        isHydrated: false,
      });
      const segments = buildBreadcrumbs(context, mockIcons);

      // Before hydration, moodboard segment won't be added
      expect(segments).toHaveLength(2);
    });
  });

  describe('Discover page', () => {
    it('should show Discover with ROOT_OPTIONS dropdown on /discover', () => {
      const context = createContext({ pathname: '/discover' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(2);
      expect(segments[1].label).toBe('Discover');
      expect(segments[1].options).toHaveLength(3);
    });
  });

  describe('Closet section', () => {
    it('should show Closet with ROOT_OPTIONS dropdown on /closet', () => {
      const context = createContext({ pathname: '/closet' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(2);
      expect(segments[1].label).toBe('Closet');
      expect(segments[1].options).toHaveLength(3);
    });

    it('should show Personal with sibling routes dropdown on /closet/personal', () => {
      const context = createContext({ pathname: '/closet/personal' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(3);
      expect(segments[2].label).toBe('Personal');
      // Should have dropdown with sibling routes (Personal, Community, Discover)
      expect(segments[2].options).toBeDefined();
      expect(segments[2].options!.length).toBeGreaterThan(0);
    });
  });

  describe('Settings page', () => {
    it('should show Account Settings without dropdown on /settings', () => {
      const context = createContext({ pathname: '/settings' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(2);
      expect(segments[1].label).toBe('Account Settings');
      expect(segments[1].options).toBeUndefined();
    });
  });

  describe('Closet subsections (new routes)', () => {
    it('should show Community with sibling routes dropdown on /closet/community', () => {
      const context = createContext({ pathname: '/closet/community' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(3);
      expect(segments[1].label).toBe('Closet');
      expect(segments[1].options).toHaveLength(3); // Section switcher
      expect(segments[2].label).toBe('Community');
      // Should have dropdown with sibling routes
      expect(segments[2].options).toBeDefined();
    });

    it('should show Discover with sibling routes dropdown on /closet/discover', () => {
      const context = createContext({ pathname: '/closet/discover' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(3);
      expect(segments[1].label).toBe('Closet');
      expect(segments[2].label).toBe('Discover');
      // Should have dropdown with sibling routes
      expect(segments[2].options).toBeDefined();
    });
  });

  describe('Collections section', () => {
    it('should show Collections with Closet parent on /collections', () => {
      const context = createContext({ pathname: '/collections' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(3);
      expect(segments[1].label).toBe('Closet');
      expect(segments[2].label).toBe('Collections');
    });
  });

  describe('Admin page', () => {
    it('should show Admin Dashboard without dropdown on /admin', () => {
      const context = createContext({ pathname: '/admin' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(2);
      expect(segments[1].label).toBe('Admin Dashboard');
      expect(segments[1].options).toBeUndefined();
    });
  });

  describe('Unknown/hidden routes', () => {
    it('should return only root for unknown routes', () => {
      const context = createContext({ pathname: '/unknown-page' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(1);
      expect(segments[0].label).toBe('The Mood Layer');
    });

    it('should return only root for hidden routes like /onboarding', () => {
      const context = createContext({ pathname: '/onboarding' });
      const segments = buildBreadcrumbs(context, mockIcons);

      expect(segments).toHaveLength(1);
    });
  });
});

describe('hasDropdown', () => {
  it('should return true when segment has options', () => {
    expect(hasDropdown({ label: 'Test', options: [{ label: 'A', href: '/a' }] })).toBe(true);
  });

  it('should return false when segment has no options', () => {
    expect(hasDropdown({ label: 'Test' })).toBe(false);
  });

  it('should return false when options is empty array', () => {
    expect(hasDropdown({ label: 'Test', options: [] })).toBe(false);
  });
});

describe('getExpectedBreadcrumbStructure', () => {
  it('should return correct structure for home', () => {
    const result = getExpectedBreadcrumbStructure('/');
    expect(result.segmentCount).toBe(1);
    expect(result.hasDropdownAt).toEqual([]);
  });

  it('should return correct structure for /looks', () => {
    const result = getExpectedBreadcrumbStructure('/looks');
    expect(result.segmentCount).toBe(2);
    expect(result.hasDropdownAt).toEqual([1]);
  });

  it('should return correct structure for moodboard editor', () => {
    const result = getExpectedBreadcrumbStructure('/looks/my-board-123');
    expect(result.segmentCount).toBe(3);
    expect(result.hasDropdownAt).toEqual([1, 2]);
  });

  it('should return correct structure for /discover', () => {
    const result = getExpectedBreadcrumbStructure('/discover');
    expect(result.segmentCount).toBe(2);
    expect(result.hasDropdownAt).toEqual([1]);
  });

  it('should return correct structure for /closet', () => {
    const result = getExpectedBreadcrumbStructure('/closet');
    expect(result.segmentCount).toBe(2);
    expect(result.hasDropdownAt).toEqual([1]);
  });

  it('should return correct structure for /settings', () => {
    const result = getExpectedBreadcrumbStructure('/settings');
    expect(result.segmentCount).toBe(2);
    expect(result.hasDropdownAt).toEqual([]);
  });
});
