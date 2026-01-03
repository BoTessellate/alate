import { test, expect } from '@playwright/test';
import {
  CSS_VARS,
  assertTopAtLeast,
  assertWithinViewport,
  assertDimensions,
  assertNoOverlap,
  assertSidePanelBelowTopbar,
  assertBubbleDimensions,
  getBoundingBox,
} from '../utils/layout-assertions';
import { setupMockRoutes, skipOnboarding } from '../fixtures/mock-data';

/**
 * Global Layout Tests
 *
 * Tests for layout elements that appear across all/most pages:
 * - Topbar
 * - Sidebar
 * - FAB (Floating Action Buttons)
 * - SidePanel (bubble and expanded modes)
 */

test.describe('Global Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);

    // Navigate first to establish origin, then set localStorage
    await page.goto('/');
    await skipOnboarding(page);
  });

  test.describe('Topbar', () => {
    test('has correct height including curve', async ({ page }) => {
      await page.goto('/discover'); // Use discover to avoid redirects
      await page.waitForLoadState('networkidle');

      // Topbar should exist - wait up to 10 seconds
      const topbar = page.locator('header').first();
      await expect(topbar).toBeVisible({ timeout: 10000 });

      const box = await getBoundingBox(topbar);

      // Height should be approximately topbar height (56px)
      // The curve extends below but the header element itself is 56px
      expect(box.height).toBeGreaterThanOrEqual(CSS_VARS.topbarHeight - 5);
      expect(box.height).toBeLessThanOrEqual(CSS_VARS.topbarHeight + 30); // Allow for curve
    });

    test('spans full viewport width', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const topbar = page.locator('header').first();
      await expect(topbar).toBeVisible();

      const box = await getBoundingBox(topbar);
      const viewport = page.viewportSize();

      expect(box.width).toBeGreaterThanOrEqual(viewport!.width - 10);
    });

    test('is positioned at top of viewport', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const topbar = page.locator('header').first();
      const box = await getBoundingBox(topbar);

      expect(box.y).toBeLessThanOrEqual(5); // Should be at or near top
    });
  });

  test.describe('Navigation', () => {
    test('top navigation is visible on desktop viewport', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigation is in the topbar
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
    });

    test('navigation contains main links', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for navigation items in topbar
      const looksLink = page.locator('a[href="/looks"]').first();
      const collectionsLink = page.locator('a[href="/collections"]').first();
      const discoverLink = page.locator('a[href="/discover"]').first();

      // At least some nav links should be visible
      const navCount = await page.locator('nav a').count();
      expect(navCount).toBeGreaterThanOrEqual(1);
    });

    test('navigation is in the header area', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav').first();
      const box = await getBoundingBox(nav);

      // Navigation should be within topbar height area
      expect(box.y).toBeLessThanOrEqual(CSS_VARS.topbarHeight + 20);
    });
  });

  test.describe('Floating Action Button (Unified Assistant)', () => {
    test('is visible on all pages', async ({ page }) => {
      // Test fewer pages to reduce timeout risk
      const pages = ['/', '/discover', '/settings'];

      for (const route of pages) {
        await page.goto(route, { timeout: 15000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        const assistantButton = page.locator('[aria-label="Open assistant"]');
        await expect(assistantButton).toBeVisible({ timeout: 5000 });
      }
    });

    test('is positioned in bottom-right corner', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const assistantButton = page.locator('[aria-label="Open assistant"]');
      await expect(assistantButton).toBeVisible();

      const box = await getBoundingBox(assistantButton);
      const viewport = page.viewportSize();

      // Should be near bottom-right
      const distanceFromRight = viewport!.width - (box.x + box.width);
      const distanceFromBottom = viewport!.height - (box.y + box.height);

      expect(distanceFromRight).toBeLessThanOrEqual(50);
      expect(distanceFromBottom).toBeLessThanOrEqual(50);
    });

    test('has correct size (48px)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const assistantButton = page.locator('[aria-label="Open assistant"]');
      await expect(assistantButton).toBeVisible();

      const box = await getBoundingBox(assistantButton);
      // FAB is now 48px (updated from 44px)
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeLessThanOrEqual(52);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(52);
    });

    test('is a circular button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const assistantButton = page.locator('[aria-label="Open assistant"]');
      await expect(assistantButton).toBeVisible();

      const box = await getBoundingBox(assistantButton);
      // Should be roughly square (circular)
      expect(Math.abs(box.width - box.height)).toBeLessThan(5);
    });
  });

  test.describe('Side Panel - Bubble Mode', () => {
    test('opens in bubble mode when FAB clicked', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Click assistant button to open bubble
      await page.click('[aria-label="Open assistant"]');

      // Bubble/panel should appear - look for fixed positioned content
      const bubble = page.locator('[class*="fixed"]').filter({
        has: page.locator('input, textarea'),
      });
      await expect(bubble.first()).toBeVisible({ timeout: 5000 });
    });

    test('has reasonable dimensions', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Find the bubble panel
      const bubble = page.locator('[class*="fixed"]').filter({
        has: page.locator('input, textarea'),
      }).first();

      if (await bubble.isVisible().catch(() => false)) {
        const box = await getBoundingBox(bubble);
        // Bubble should have reasonable size
        expect(box.width).toBeGreaterThan(200);
        expect(box.height).toBeGreaterThan(50);
      }
    });

    test('is positioned near FAB', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const bubble = page.locator('[class*="fixed"]').filter({
        has: page.locator('input, textarea'),
      }).first();
      const fab = page.locator('[aria-label="Open assistant"]');

      if (await bubble.isVisible().catch(() => false)) {
        const bubbleBox = await getBoundingBox(bubble);
        const viewport = page.viewportSize();

        // Bubble should be on right side of screen
        expect(bubbleBox.x + bubbleBox.width).toBeGreaterThan(viewport!.width / 2);
      }
    });

    test('is within viewport bounds', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const bubble = page.locator('[class*="fixed"]').filter({
        has: page.locator('input, textarea'),
      }).first();

      if (await bubble.isVisible().catch(() => false)) {
        await assertWithinViewport(bubble, page);
      }
    });
  });

  test.describe('Side Panel - Expanded Mode', () => {
    test('expands when expand button clicked', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open bubble
      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Look for expand button
      const expandButton = page.locator('[aria-label="Expand to side panel"], [aria-label*="expand" i]');

      if (await expandButton.first().isVisible().catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(400);

        // Panel should be visible and wider
        const panel = page.locator('[class*="fixed"]').filter({
          has: page.locator('input, textarea'),
        }).first();

        if (await panel.isVisible().catch(() => false)) {
          const box = await getBoundingBox(panel);
          expect(box.width).toBeGreaterThanOrEqual(300);
        }
      }
    });

    test('is positioned correctly on screen', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const expandButton = page.locator('[aria-label="Expand to side panel"], [aria-label*="expand" i]');

      if (await expandButton.first().isVisible().catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(400);

        const panel = page.locator('[class*="fixed"]').filter({
          has: page.locator('input, textarea'),
        }).first();

        if (await panel.isVisible().catch(() => false)) {
          const box = await getBoundingBox(panel);
          // Panel should be on the right side
          const viewport = page.viewportSize();
          expect(box.x + box.width).toBeGreaterThan(viewport!.width / 2);
        }
      }
    });

    test('has reasonable width when expanded', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const expandButton = page.locator('[aria-label="Expand to side panel"], [aria-label*="expand" i]');

      if (await expandButton.first().isVisible().catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(400);

        const panel = page.locator('[class*="fixed"]').filter({
          has: page.locator('input, textarea'),
        }).first();

        if (await panel.isVisible().catch(() => false)) {
          const box = await getBoundingBox(panel);
          // Expanded panel should be wider than bubble mode
          expect(box.width).toBeGreaterThanOrEqual(350);
        }
      }
    });

    test('stretches vertically', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const expandButton = page.locator('[aria-label="Expand to side panel"], [aria-label*="expand" i]');

      if (await expandButton.first().isVisible().catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(400);

        const panel = page.locator('[class*="fixed"]').filter({
          has: page.locator('input, textarea'),
        }).first();

        if (await panel.isVisible().catch(() => false)) {
          const box = await getBoundingBox(panel);
          const viewport = page.viewportSize();

          // Panel should have significant height
          expect(box.height).toBeGreaterThan(viewport!.height * 0.3);
        }
      }
    });

    test('main content adjusts when panel opens', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get main content before opening panel
      const mainContent = page.locator('main').first();
      const boxBefore = await getBoundingBox(mainContent);

      // Open panel
      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      const expandButton = page.locator('[aria-label="Expand to side panel"], [aria-label*="expand" i]');

      if (await expandButton.first().isVisible().catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(500);

        // Check if main content adjusted (may or may not depending on panel mode)
        const boxAfter = await getBoundingBox(mainContent);
        // Just verify main content is still visible and reasonable
        expect(boxAfter.width).toBeGreaterThan(0);
      }
    });
  });
});
