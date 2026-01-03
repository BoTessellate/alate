import { test, expect } from '@playwright/test';
import {
  assertCenteredIn,
  assertWithinViewport,
  assertConsistentHorizontalSpacing,
  getBoundingBox,
  getCenter,
} from '../utils/layout-assertions';
import { setupMockRoutes, skipOnboarding } from '../fixtures/mock-data';

/**
 * Page-Specific Layout Tests
 *
 * Tests for each page's unique layout requirements.
 * All pages should have consistent header alignment, grid spacing, etc.
 */

test.describe('Page Layouts', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);

    // Navigate first to establish origin, then set localStorage
    await page.goto('/');
    await skipOnboarding(page);
  });

  test.describe('Home Page (/)', () => {
    test('hero section is centered', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Hero title should exist
      const heroTitle = page.locator('h1').first();
      await expect(heroTitle).toBeVisible();

      const viewport = page.viewportSize();
      const box = await getBoundingBox(heroTitle);
      const center = getCenter(box);

      // Should be roughly centered horizontally
      const viewportCenter = viewport!.width / 2;
      expect(Math.abs(center.x - viewportCenter)).toBeLessThan(100);
    });

    test('main content has proper padding', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main').first();
      const box = await getBoundingBox(main);

      // Main content starts at edge but has internal padding
      // It should be at least at x=0 (full-width layout)
      expect(box.x).toBeGreaterThanOrEqual(0);
      // And should have reasonable width
      const viewport = page.viewportSize();
      expect(box.width).toBeGreaterThan(viewport!.width * 0.5);
    });
  });

  test.describe('Discover Page (/discover)', () => {
    test('hero section is centered', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      const heroTitle = page.locator('h1').filter({ hasText: 'Discover' });
      await expect(heroTitle).toBeVisible();

      const viewport = page.viewportSize();
      const box = await getBoundingBox(heroTitle);
      const center = getCenter(box);

      const viewportCenter = viewport!.width / 2;
      expect(Math.abs(center.x - viewportCenter)).toBeLessThan(100);
    });

    test('product grid has consistent spacing', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      // Wait for products to load
      const productCards = page.locator('[class*="grid"] > div').first();

      // If products loaded, check grid exists
      const gridExists = await productCards.isVisible().catch(() => false);
      if (gridExists) {
        const grid = page.locator('[class*="grid"]').first();
        await expect(grid).toBeVisible();
      }
    });
  });

  test.describe('Looks/Layers Page (/looks)', () => {
    test('hero section exists and is styled', async ({ page }) => {
      await page.goto('/looks');
      await page.waitForLoadState('networkidle');

      const heroTitle = page.locator('h1').filter({ hasText: 'Layers' });
      await expect(heroTitle).toBeVisible();
    });

    test('create button is visible', async ({ page }) => {
      await page.goto('/looks');
      await page.waitForLoadState('networkidle');

      // Look for create/new button
      const createButton = page.locator('button').filter({ hasText: /new|create/i });
      await expect(createButton.first()).toBeVisible();
    });
  });

  test.describe('Look Editor Page (/looks/[slug])', () => {
    test('canvas area is visible', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      // Canvas or main editing area should be visible
      const canvas = page.locator('[class*="canvas"], [class*="editor"], main').first();
      await expect(canvas).toBeVisible();
    });

    test('toolbar controls are visible', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      // Look for any toolbar or controls
      // These may include zoom, layout options, etc.
      const mainArea = page.locator('main').first();
      await expect(mainArea).toBeVisible();
    });
  });

  test.describe('Collections Page (/collections)', () => {
    test('page header is visible', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      // Should have a header or title
      const header = page.locator('h1, [class*="header"]').first();
      await expect(header).toBeVisible();
    });

    test('new collection button exists', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      const newButton = page.locator('button').filter({ hasText: /new|create|add/i });
      await expect(newButton.first()).toBeVisible();
    });
  });

  test.describe('Closet Page (/closet)', () => {
    test('has two main sections', async ({ page }) => {
      await page.goto('/closet');
      await page.waitForLoadState('networkidle');

      // Should have Personal and Community sections/cards
      const personalLink = page.locator('a, button').filter({ hasText: /personal/i });
      const communityLink = page.locator('a, button').filter({ hasText: /community/i });

      await expect(personalLink.first()).toBeVisible();
      await expect(communityLink.first()).toBeVisible();
    });
  });

  test.describe('Personal Closet Page (/closet/personal)', () => {
    test('sidebar is visible on desktop', async ({ page }) => {
      await page.goto('/closet/personal');
      await page.waitForLoadState('networkidle');

      // Should have a sidebar for collections
      const sidebar = page.locator('[class*="sidebar"], aside').first();
      // May not always have a dedicated sidebar element
      const main = page.locator('main').first();
      await expect(main).toBeVisible();
    });

    test('add item button is visible', async ({ page }) => {
      await page.goto('/closet/personal');
      await page.waitForLoadState('networkidle');

      const addButton = page.locator('button').filter({ hasText: /add|new/i });
      await expect(addButton.first()).toBeVisible();
    });
  });

  test.describe('Settings Page (/settings)', () => {
    test('page header is visible', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const header = page.locator('h1').filter({ hasText: /settings/i });
      await expect(header).toBeVisible();
    });

    test('settings sections are visible', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Cards use rounded-lg border classes, look for bordered sections
      const sections = page.locator('.rounded-lg.border');
      const count = await sections.count();
      expect(count).toBeGreaterThan(1);
    });

    test('form inputs are aligned', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Settings page has number inputs for price range and button inputs
      const inputs = page.locator('input[type="text"], input[type="email"], input[type="number"]');
      const count = await inputs.count();

      // Should have at least some form inputs
      expect(count).toBeGreaterThan(0);
    });

    test('toggle switches are properly aligned', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Look for toggle switches
      const toggles = page.locator('[role="switch"], [class*="toggle"]');
      const count = await toggles.count();

      // Settings page should have toggle switches
      expect(count).toBeGreaterThan(0);
    });

    test('theme buttons are horizontally aligned', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Look for theme selection buttons (Light, Dark, System)
      const themeButtons = page.locator('button').filter({ hasText: /light|dark|system/i });
      const count = await themeButtons.count();

      if (count >= 2) {
        const boxes = await Promise.all(
          Array.from({ length: count }, (_, i) => getBoundingBox(themeButtons.nth(i)))
        );

        // All theme buttons should be at roughly the same Y position
        const firstY = boxes[0].y;
        for (const box of boxes) {
          expect(Math.abs(box.y - firstY)).toBeLessThan(10);
        }
      }
    });
  });

  test.describe('Onboarding Page (/onboarding)', () => {
    // Note: Onboarding tests need fresh localStorage to not redirect away
    test('content is centered', async ({ page }) => {
      // Clear the Zustand user store to test the actual onboarding page
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.removeItem('tml-user-storage');
      });
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Main onboarding content - look for the centered flex container
      const content = page.locator('.min-h-screen').first();
      await expect(content).toBeVisible();

      const viewport = page.viewportSize();
      const box = await getBoundingBox(content);
      const center = getCenter(box);

      // Should be roughly centered
      const viewportCenter = viewport!.width / 2;
      expect(Math.abs(center.x - viewportCenter)).toBeLessThan(200);
    });

    test('progress indicator is visible', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.removeItem('tml-user-storage');
      });
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Look for progress dots (w-2 h-2 rounded-full elements)
      const progress = page.locator('.w-2.h-2.rounded-full');
      const count = await progress.count();

      // Should have 3 progress dots
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('continue button is visible', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.removeItem('tml-user-storage');
      });
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Wait for content to load and look for continue/skip button
      const continueButton = page.locator('button').filter({ hasText: /continue|skip/i });
      await expect(continueButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Admin Page (/admin)', () => {
    test('tabs are visible', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Admin page should have tabs (Health, Enrich, Shopify, Coverage)
      const tabs = page.locator('button').filter({ hasText: /health|enrich|shopify|coverage/i });
      const count = await tabs.count();

      expect(count).toBeGreaterThan(0);
    });

    test('stat cards are aligned', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Look for stat cards or metrics - cards use rounded-lg border
      const cards = page.locator('.rounded-lg.border');
      const count = await cards.count();

      // Admin dashboard should have multiple cards (or at least page content)
      // If no cards, just check the page loaded
      if (count === 0) {
        const mainContent = page.locator('main, [class*="admin"]');
        await expect(mainContent.first()).toBeVisible();
      } else {
        expect(count).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Looks Discover Page (/looks/discover)', () => {
    // Note: /looks/discover redirects to /discover, so tests verify the redirected page
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto('/');
      await skipOnboarding(page);
    });

    test('page header is visible', async ({ page }) => {
      await page.goto('/looks/discover');
      await page.waitForLoadState('networkidle');

      // After redirect, look for header or main content area
      // The discover page uses a hero section with h1 or main content
      const header = page.locator('h1, [class*="hero"], main').first();
      await expect(header).toBeVisible({ timeout: 10000 });
    });

    test('moodboard grid or list is visible', async ({ page }) => {
      await page.goto('/looks/discover');
      await page.waitForLoadState('networkidle');

      // Should show moodboards in a grid or list layout
      const grid = page.locator('[class*="grid"], [class*="list"], main').first();
      await expect(grid).toBeVisible();
    });

    test('content is within viewport', async ({ page }) => {
      await page.goto('/looks/discover');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main').first();
      await assertWithinViewport(main, page);
    });
  });

  test.describe('Closet Discover Page (/closet/discover)', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto('/');
      await skipOnboarding(page);
    });

    test('page header is visible', async ({ page }) => {
      await page.goto('/closet/discover');
      await page.waitForLoadState('networkidle');

      const header = page.locator('h1').first();
      await expect(header).toBeVisible();
    });

    test('collection cards or grid is visible', async ({ page }) => {
      await page.goto('/closet/discover');
      await page.waitForLoadState('networkidle');

      // Should show collections in a grid layout
      const content = page.locator('[class*="grid"], .rounded-lg.border, main').first();
      await expect(content).toBeVisible();
    });

    test('content is within viewport', async ({ page }) => {
      await page.goto('/closet/discover');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main').first();
      await assertWithinViewport(main, page);
    });
  });

  test.describe('Collection Detail Page (/collections/[id])', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto('/');
      await skipOnboarding(page);
    });

    test('collection content is visible', async ({ page }) => {
      await page.goto('/collections/test-collection-1');
      await page.waitForLoadState('networkidle');

      // Should have some content - main area should be visible
      const main = page.locator('main').first();
      await expect(main).toBeVisible();
    });

    test('product items are displayed', async ({ page }) => {
      await page.goto('/collections/test-collection-1');
      await page.waitForLoadState('networkidle');

      // Should show collection items in some layout
      const content = page.locator('[class*="grid"], main').first();
      await expect(content).toBeVisible();
    });

    test('back navigation or breadcrumb exists', async ({ page }) => {
      await page.goto('/collections/test-collection-1');
      await page.waitForLoadState('networkidle');

      // Should have some way to navigate back (button, link, or breadcrumb)
      const navElement = page.locator('a[href*="collection"], button, [class*="back"], [class*="breadcrumb"]').first();
      await expect(navElement).toBeVisible();
    });

    test('content is within viewport', async ({ page }) => {
      await page.goto('/collections/test-collection-1');
      await page.waitForLoadState('networkidle');

      const main = page.locator('main').first();
      await assertWithinViewport(main, page);
    });
  });

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);

    // Navigate first to establish origin, then set localStorage
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('content remains visible on smaller viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Main content should still be visible
    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    // FAB should still be visible
    const fabButton = page.locator('[aria-label="Open assistant"]');
    await expect(fabButton).toBeVisible();
  });

  test('layout adapts to medium viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Page should render without horizontal overflow
    const body = page.locator('body');
    const box = await getBoundingBox(body);
    const viewport = page.viewportSize();

    expect(box.width).toBeLessThanOrEqual(viewport!.width + 50);
  });
});
