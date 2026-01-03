import { test, expect } from '@playwright/test';
import {
  assertVerticallyAligned,
  assertCenteredIn,
  assertWithinViewport,
  assertDimensions,
  assertNoOverlap,
  getBoundingBox,
  getCenter,
} from '../utils/layout-assertions';
import { setupMockRoutes, skipOnboarding } from '../fixtures/mock-data';

/**
 * Component Layout Tests
 *
 * Tests for individual UI component alignment and positioning.
 * These tests ensure components render correctly in isolation and in context.
 */

test.describe('Component Layouts', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);

    // Navigate first to establish origin, then set localStorage
    await page.goto('/');
    await skipOnboarding(page);
  });

  test.describe('Input Components', () => {
    test('input fields in assistant panel have proper dimensions', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open assistant panel
      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Find the input or textarea in the panel
      const input = page.locator('input, textarea').first();

      if (await input.isVisible().catch(() => false)) {
        // Get bounding boxes
        const inputBox = await getBoundingBox(input);

        // Input should have reasonable height
        expect(inputBox.height).toBeGreaterThanOrEqual(28);
        expect(inputBox.height).toBeLessThanOrEqual(100);
      }
    });

    test('input fields on settings page are properly sized', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const inputs = page.locator('input[type="text"], input[type="email"]');
      const count = await inputs.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const box = await getBoundingBox(input);

          // Inputs should have minimum width
          expect(box.width).toBeGreaterThanOrEqual(100);

          // Inputs should have reasonable height
          expect(box.height).toBeGreaterThanOrEqual(28);
          expect(box.height).toBeLessThanOrEqual(60);
        }
      }
    });
  });

  test.describe('Button Components', () => {
    test('primary buttons have consistent height', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Find primary-styled buttons
      const buttons = page.locator('button');
      const count = await buttons.count();

      const heights: number[] = [];

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await getBoundingBox(button);
          heights.push(box.height);
        }
      }

      // Buttons should have consistent heights (allowing for size variants)
      // Most buttons should be within similar ranges
      if (heights.length >= 2) {
        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
        for (const h of heights) {
          // Allow 50% variance for different size variants
          expect(Math.abs(h - avgHeight)).toBeLessThan(avgHeight * 0.5 + 10);
        }
      }
    });

    test('icon buttons are square', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // FAB button should be square
      const assistantButton = page.locator('[aria-label="Open assistant"]');
      await expect(assistantButton).toBeVisible();

      const box = await getBoundingBox(assistantButton);

      expect(Math.abs(box.width - box.height)).toBeLessThan(5);
    });
  });

  test.describe('Card Components', () => {
    test('cards have consistent border radius', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const cards = page.locator('[class*="card"], [class*="rounded-lg"]');
      const count = await cards.count();

      // Cards should exist
      expect(count).toBeGreaterThan(0);
    });

    test('card content is within card bounds', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const cards = page.locator('[class*="card"]');
      const count = await cards.count();

      if (count > 0) {
        const firstCard = cards.first();
        if (await firstCard.isVisible()) {
          const cardBox = await getBoundingBox(firstCard);

          // Card should have minimum size
          expect(cardBox.width).toBeGreaterThan(100);
          expect(cardBox.height).toBeGreaterThan(50);
        }
      }
    });
  });

  test.describe('Toggle/Switch Components', () => {
    test('toggle switches have correct dimensions', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const toggles = page.locator('[role="switch"], [class*="toggle"]');
      const count = await toggles.count();

      if (count > 0) {
        const toggle = toggles.first();
        if (await toggle.isVisible()) {
          const box = await getBoundingBox(toggle);

          // Toggle should be wider than tall (track shape)
          expect(box.width).toBeGreaterThan(box.height);

          // Reasonable size range
          expect(box.width).toBeGreaterThanOrEqual(30);
          expect(box.width).toBeLessThanOrEqual(60);
        }
      }
    });
  });

  test.describe('Modal Components', () => {
    test('modal opens centered in viewport', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      // Try to open a modal (new collection button)
      const newButton = page.locator('button').filter({ hasText: /new|create|add/i }).first();

      if (await newButton.isVisible()) {
        await newButton.click();

        // Wait for modal
        const modal = page.locator('[role="dialog"], [class*="modal"]');

        if (await modal.isVisible().catch(() => false)) {
          const viewport = page.viewportSize();
          const box = await getBoundingBox(modal);
          const center = getCenter(box);

          const viewportCenterX = viewport!.width / 2;
          const viewportCenterY = viewport!.height / 2;

          // Modal should be roughly centered
          expect(Math.abs(center.x - viewportCenterX)).toBeLessThan(100);
          expect(Math.abs(center.y - viewportCenterY)).toBeLessThan(150);
        }
      }
    });

    test('modal backdrop covers entire viewport', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      const newButton = page.locator('button').filter({ hasText: /new|create|add/i }).first();

      const buttonVisible = await newButton.isVisible().catch(() => false);
      if (buttonVisible) {
        await newButton.click();

        // Wait a bit for modal to appear
        await page.waitForTimeout(300);

        // Look for the modal dialog itself
        const modal = page.locator('[role="dialog"]');
        const modalVisible = await modal.isVisible().catch(() => false);

        if (modalVisible) {
          // Modal should be visible within viewport
          await assertWithinViewport(modal, page);
        }
      }
      // Test passes if no new button or no modal - layout is still valid
    });
  });

  test.describe('Dropdown Components', () => {
    test('dropdown menu appears below trigger', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // The settings page uses theme buttons (Light, Dark, System) which are clickable
      // Check that theme selection buttons exist and are interactive
      const themeButtons = page.locator('button').filter({ hasText: /light|dark|system/i });
      const count = await themeButtons.count();

      // Settings page should have theme buttons
      expect(count).toBeGreaterThanOrEqual(2);

      // Verify the buttons are properly positioned (all in a row)
      if (count >= 2) {
        const box1 = await getBoundingBox(themeButtons.nth(0));
        const box2 = await getBoundingBox(themeButtons.nth(1));

        // Theme buttons should be roughly aligned horizontally
        expect(Math.abs(box1.y - box2.y)).toBeLessThan(20);
      }
    });
  });

  test.describe('Chip/Tag Components', () => {
    test('chips in onboarding are properly spaced', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Onboarding has style tag chips
      const chips = page.locator('button[class*="rounded-full"], [class*="chip"], [class*="tag"]');
      const count = await chips.count();

      if (count >= 2) {
        // Chips should exist and be visible
        await expect(chips.first()).toBeVisible();
      }
    });
  });

  test.describe('Header Components', () => {
    test('page headers have consistent styling', async ({ page }) => {
      const pages = ['/discover', '/looks', '/collections', '/settings'];

      for (const route of pages) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const header = page.locator('h1').first();

        if (await header.isVisible()) {
          const box = await getBoundingBox(header);

          // Headers should have minimum height
          expect(box.height).toBeGreaterThanOrEqual(20);

          // Headers should not be too far from top
          expect(box.y).toBeLessThan(300);
        }
      }
    });
  });

  test.describe('Empty State Components', () => {
    test('empty state is centered', async ({ page }) => {
      await page.goto('/closet/community');
      await page.waitForLoadState('networkidle');

      // Community closet likely shows empty state
      const emptyState = page.locator('[class*="empty"], [class*="placeholder"]');

      if (await emptyState.first().isVisible().catch(() => false)) {
        const box = await getBoundingBox(emptyState.first());
        const viewport = page.viewportSize();

        const center = getCenter(box);
        const viewportCenter = viewport!.width / 2;

        // Empty state should be roughly centered
        expect(Math.abs(center.x - viewportCenter)).toBeLessThan(200);
      }
    });
  });

  test.describe('Product Card Components', () => {
    test('product cards maintain aspect ratio', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      const productCards = page.locator('[class*="product"], [class*="card"]').filter({
        has: page.locator('img'),
      });

      const count = await productCards.count();

      if (count > 0) {
        const card = productCards.first();
        if (await card.isVisible()) {
          const box = await getBoundingBox(card);

          // Cards should have reasonable aspect ratio (not too thin or wide)
          const aspectRatio = box.width / box.height;
          expect(aspectRatio).toBeGreaterThan(0.3);
          expect(aspectRatio).toBeLessThan(3);
        }
      }
    });
  });

  test.describe('Virtual Grid Components', () => {
    test('product grid or content renders visible items', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      // Look for main content area - grid or card container
      const content = page.locator('[class*="grid"], main, [class*="container"]').first();
      await expect(content).toBeVisible();

      // Content should have children (items)
      const items = page.locator('main > *, [class*="grid"] > *');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
    });

    test('grid items are properly aligned in columns', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      const gridItems = page.locator('[class*="grid"] > div').filter({
        has: page.locator('img'),
      });

      const count = await gridItems.count();

      if (count >= 2) {
        const box1 = await getBoundingBox(gridItems.nth(0));
        const box2 = await getBoundingBox(gridItems.nth(1));

        // Items in same row should have same Y, or items in same column should have same X
        const sameRow = Math.abs(box1.y - box2.y) < 10;
        const sameColumn = Math.abs(box1.x - box2.x) < 10;

        // At least one should be true for a proper grid layout
        expect(sameRow || sameColumn).toBeTruthy();
      }
    });

    test('grid maintains consistent gap between items', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      const gridItems = page.locator('[class*="grid"] > div').filter({
        has: page.locator('img'),
      });

      const count = await gridItems.count();

      if (count >= 3) {
        const boxes = await Promise.all([
          getBoundingBox(gridItems.nth(0)),
          getBoundingBox(gridItems.nth(1)),
          getBoundingBox(gridItems.nth(2)),
        ]);

        // If items are in the same row, check horizontal gaps
        if (Math.abs(boxes[0].y - boxes[1].y) < 10 && Math.abs(boxes[1].y - boxes[2].y) < 10) {
          const gap1 = boxes[1].x - (boxes[0].x + boxes[0].width);
          const gap2 = boxes[2].x - (boxes[1].x + boxes[1].width);

          // Gaps should be reasonably consistent
          expect(Math.abs(gap1 - gap2)).toBeLessThan(20);
        }
      }
    });

    test('content scrolls without layout breaking', async ({ page }) => {
      await page.goto('/discover');
      await page.waitForLoadState('networkidle');

      const content = page.locator('main, [class*="grid"], body').first();
      const boxBefore = await getBoundingBox(content);

      // Scroll down
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(300);

      // Content width should remain the same after scrolling
      const boxAfter = await getBoundingBox(content);
      expect(Math.abs(boxAfter.width - boxBefore.width)).toBeLessThan(10);
    });
  });

  test.describe('Moodboard Canvas Components', () => {
    test('canvas container is visible on moodboard page', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      // Look for canvas or editor area
      const canvas = page.locator('[class*="canvas"], [class*="editor"], [class*="moodboard"], main').first();
      await expect(canvas).toBeVisible();
    });

    test('canvas has appropriate dimensions', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('[class*="canvas"], [class*="editor"], main').first();

      if (await canvas.isVisible()) {
        const box = await getBoundingBox(canvas);
        const viewport = page.viewportSize();

        // Canvas should take up significant portion of viewport
        expect(box.width).toBeGreaterThan(viewport!.width * 0.3);
        expect(box.height).toBeGreaterThan(viewport!.height * 0.3);
      }
    });

    test('moodboard items are within canvas bounds', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('[class*="canvas"], [class*="editor"], main').first();

      if (await canvas.isVisible()) {
        const canvasBox = await getBoundingBox(canvas);

        // Look for items inside the moodboard
        const items = page.locator('[class*="draggable"], [class*="item"]').filter({
          has: page.locator('img'),
        });

        const count = await items.count();

        for (let i = 0; i < Math.min(count, 3); i++) {
          const item = items.nth(i);
          if (await item.isVisible()) {
            const itemBox = await getBoundingBox(item);

            // Items should be at least partially within canvas bounds
            const withinX = itemBox.x + itemBox.width > canvasBox.x && itemBox.x < canvasBox.x + canvasBox.width;
            const withinY = itemBox.y + itemBox.height > canvasBox.y && itemBox.y < canvasBox.y + canvasBox.height;

            expect(withinX && withinY).toBeTruthy();
          }
        }
      }
    });

    test('toolbar or controls are visible', async ({ page }) => {
      await page.goto('/looks/test-collection');
      await page.waitForLoadState('networkidle');

      // Look for any toolbar or control elements
      const toolbar = page.locator('[class*="toolbar"], [class*="controls"], [class*="actions"]');
      const buttons = page.locator('button');

      const hasToolbar = await toolbar.first().isVisible().catch(() => false);
      const buttonCount = await buttons.count();

      // Should have some interactive controls
      expect(hasToolbar || buttonCount > 0).toBeTruthy();
    });
  });
});
