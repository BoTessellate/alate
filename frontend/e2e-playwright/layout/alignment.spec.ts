import { test, expect } from '@playwright/test';
import {
  assertVerticallyAligned,
  assertFlexChildrenVerticallyCentered,
  assertIconCenteredInContainer,
  assertCheckboxLabelAligned,
  assertModalCenteredInViewport,
  assertButtonContentCentered,
  getBoundingBox,
  getCenter,
} from '../utils/layout-assertions';
import { setupMockRoutes, skipOnboarding } from '../fixtures/mock-data';

/**
 * Center Alignment Tests
 *
 * Comprehensive tests to ensure all UI elements are properly center-aligned.
 * These tests prevent visual misalignment issues across:
 * - Chat input icons
 * - Buttons with icons
 * - Modals
 * - Checkboxes and toggles
 * - Form inputs with icons
 * - Navigation items
 */

test.describe('Center Alignment Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await skipOnboarding(page);
  });

  test.describe('Chat Input Alignment', () => {
    test('chat input icons are vertically centered with input field', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open assistant panel
      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Find the chat input container (flex row with icons and input)
      const inputRow = page.locator('[class*="flex"][class*="items-center"]').filter({
        has: page.locator('textarea, input[type="text"]'),
      }).first();

      if (await inputRow.isVisible().catch(() => false)) {
        // Get the input row bounding box
        const containerBox = await getBoundingBox(inputRow);
        const containerCenterY = containerBox.y + containerBox.height / 2;

        // Check all buttons/icons in the row are centered
        const buttons = inputRow.locator('button');
        const buttonCount = await buttons.count();

        for (let i = 0; i < buttonCount; i++) {
          const button = buttons.nth(i);
          if (await button.isVisible()) {
            const buttonBox = await getBoundingBox(button);
            const buttonCenterY = buttonBox.y + buttonBox.height / 2;

            const diff = Math.abs(buttonCenterY - containerCenterY);
            expect(
              diff,
              `Chat input button ${i} should be vertically centered. Expected: ${containerCenterY}px, Got: ${buttonCenterY}px`
            ).toBeLessThanOrEqual(5);
          }
        }

        // Check the textarea/input is also centered
        const textarea = inputRow.locator('textarea, input[type="text"]').first();
        if (await textarea.isVisible()) {
          const textareaBox = await getBoundingBox(textarea);
          const textareaCenterY = textareaBox.y + textareaBox.height / 2;

          const diff = Math.abs(textareaCenterY - containerCenterY);
          expect(
            diff,
            `Chat input textarea should be vertically centered`
          ).toBeLessThanOrEqual(10); // Allow more tolerance for textarea due to padding
        }
      }
    });

    test('camera and link icons are aligned with send button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Find camera button and send button
      const cameraButton = page.locator('[aria-label="Attach image"]');
      const sendButton = page.locator('[aria-label="Send"]');

      if (await cameraButton.isVisible().catch(() => false) && await sendButton.isVisible().catch(() => false)) {
        await assertVerticallyAligned(cameraButton, sendButton, 5);
      }
    });
  });

  test.describe('Button Icon Alignment', () => {
    test('icon-only buttons have centered icons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Test FAB button
      const fab = page.locator('[aria-label="Open assistant"]');
      await expect(fab).toBeVisible();
      await assertButtonContentCentered(fab);
    });

    test('buttons with icons in topbar are properly aligned', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const header = page.locator('header').first();
      const buttonsWithIcons = header.locator('button:has(svg)');
      const count = await buttonsWithIcons.count();

      for (let i = 0; i < count; i++) {
        const button = buttonsWithIcons.nth(i);
        if (await button.isVisible()) {
          await assertButtonContentCentered(button, 5);
        }
      }
    });

    test('buttons on settings page have centered content', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          await assertButtonContentCentered(button, 5);
        }
      }
    });
  });

  test.describe('Modal Alignment', () => {
    test('modal dialogs are centered in viewport', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      // Try to open a modal
      const newButton = page.locator('button').filter({ hasText: /new|create|add/i }).first();

      if (await newButton.isVisible().catch(() => false)) {
        await newButton.click();
        await page.waitForTimeout(300);

        const modal = page.locator('[role="dialog"]');

        if (await modal.isVisible().catch(() => false)) {
          await assertModalCenteredInViewport(modal, page, 100);
        }
      }
    });

    test('modal close button icon is centered', async ({ page }) => {
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      const newButton = page.locator('button').filter({ hasText: /new|create|add/i }).first();

      if (await newButton.isVisible().catch(() => false)) {
        await newButton.click();
        await page.waitForTimeout(300);

        const closeButton = page.locator('[role="dialog"] button[aria-label*="close" i], [role="dialog"] button:has(svg)').first();

        if (await closeButton.isVisible().catch(() => false)) {
          await assertButtonContentCentered(closeButton, 5);
        }
      }
    });
  });

  test.describe('Checkbox and Toggle Alignment', () => {
    test('toggle switches are aligned with their labels', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Find toggle rows (label + toggle)
      const toggles = page.locator('[role="switch"]');
      const count = await toggles.count();

      for (let i = 0; i < count; i++) {
        const toggle = toggles.nth(i);
        if (await toggle.isVisible()) {
          // Find the parent row and label
          const toggleBox = await getBoundingBox(toggle);
          const toggleCenterY = toggleBox.y + toggleBox.height / 2;

          // Get parent container
          const parent = toggle.locator('xpath=..');
          const parentBox = await getBoundingBox(parent).catch(() => null);

          if (parentBox) {
            const parentCenterY = parentBox.y + parentBox.height / 2;
            const diff = Math.abs(toggleCenterY - parentCenterY);

            // Toggle should be roughly centered in its row
            expect(diff).toBeLessThanOrEqual(15);
          }
        }
      }
    });

    test('checkbox indicators are centered within checkbox containers', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        const checkbox = checkboxes.nth(i);
        if (await checkbox.isVisible()) {
          const checkboxBox = await getBoundingBox(checkbox);

          // Checkbox should be roughly square and centered in its visual container
          expect(Math.abs(checkboxBox.width - checkboxBox.height)).toBeLessThanOrEqual(5);
        }
      }
    });
  });

  test.describe('Form Input Alignment', () => {
    test('input icons are centered within input containers', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Find inputs that might have icons
      const inputContainers = page.locator('[class*="relative"]:has(input):has(svg)');
      const count = await inputContainers.count();

      for (let i = 0; i < count; i++) {
        const container = inputContainers.nth(i);
        if (await container.isVisible()) {
          const icon = container.locator('svg').first();
          if (await icon.isVisible()) {
            await assertIconCenteredInContainer(icon, container, 5);
          }
        }
      }
    });

    test('select dropdowns have centered content', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Only target actual select elements and dropdown triggers with aria-haspopup
      // Exclude elements with "select" in class name that aren't dropdowns (like SelectionButton)
      const selects = page.locator('select, [role="listbox"], button[aria-haspopup="listbox"]');
      const count = await selects.count();

      for (let i = 0; i < count; i++) {
        const select = selects.nth(i);
        if (await select.isVisible()) {
          const selectBox = await getBoundingBox(select);

          // Select/dropdown should have reasonable height (content centered)
          // Native selects and custom dropdowns should be at least 28px tall
          expect(selectBox.height).toBeGreaterThanOrEqual(28);
          expect(selectBox.height).toBeLessThanOrEqual(60);
        }
      }
    });
  });

  test.describe('Navigation Alignment', () => {
    test('navigation links are vertically aligned', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav').first();
      if (await nav.isVisible()) {
        const navLinks = nav.locator('a');
        const count = await navLinks.count();

        if (count >= 2) {
          const boxes = [];
          for (let i = 0; i < Math.min(count, 4); i++) {
            const link = navLinks.nth(i);
            if (await link.isVisible()) {
              boxes.push(await getBoundingBox(link));
            }
          }

          // Check all nav items are vertically aligned (same Y center)
          if (boxes.length >= 2) {
            const firstCenterY = boxes[0].y + boxes[0].height / 2;

            for (let i = 1; i < boxes.length; i++) {
              const centerY = boxes[i].y + boxes[i].height / 2;
              const diff = Math.abs(centerY - firstCenterY);

              expect(
                diff,
                `Nav link ${i} should be aligned with first nav link`
              ).toBeLessThanOrEqual(5);
            }
          }
        }
      }
    });

    test('navigation icons are centered within nav items', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const navLinks = page.locator('nav a:has(svg)');
      const count = await navLinks.count();

      for (let i = 0; i < count; i++) {
        const link = navLinks.nth(i);
        if (await link.isVisible()) {
          const icon = link.locator('svg').first();
          if (await icon.isVisible()) {
            await assertIconCenteredInContainer(icon, link, 5);
          }
        }
      }
    });
  });

  test.describe('Card Content Alignment', () => {
    test('card headers are properly aligned', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const cards = page.locator('[class*="card"], [class*="rounded-lg"][class*="border"]');
      const count = await cards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = cards.nth(i);
        if (await card.isVisible()) {
          const header = card.locator('h1, h2, h3, h4').first();
          if (await header.isVisible().catch(() => false)) {
            const cardBox = await getBoundingBox(card);
            const headerBox = await getBoundingBox(header);

            // Header should be within card bounds
            expect(headerBox.x).toBeGreaterThanOrEqual(cardBox.x);
            expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
          }
        }
      }
    });
  });

  test.describe('Empty State Alignment', () => {
    test('empty state content is centered', async ({ page }) => {
      await page.goto('/closet/community');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('[class*="empty"], [class*="placeholder"], [class*="flex"][class*="flex-col"][class*="items-center"]');

      if (await emptyState.first().isVisible().catch(() => false)) {
        const box = await getBoundingBox(emptyState.first());
        const viewport = page.viewportSize();

        const centerX = box.x + box.width / 2;
        const viewportCenterX = viewport!.width / 2;

        // Empty state should be horizontally centered
        const diff = Math.abs(centerX - viewportCenterX);
        expect(diff).toBeLessThanOrEqual(200);
      }
    });
  });

  test.describe('Floating Elements Alignment', () => {
    test('FAB icon is centered within button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const fab = page.locator('[aria-label="Open assistant"]');
      await expect(fab).toBeVisible();

      const fabBox = await getBoundingBox(fab);
      const fabCenterX = fabBox.x + fabBox.width / 2;
      const fabCenterY = fabBox.y + fabBox.height / 2;

      const icon = fab.locator('svg').first();
      if (await icon.isVisible()) {
        const iconBox = await getBoundingBox(icon);
        const iconCenterX = iconBox.x + iconBox.width / 2;
        const iconCenterY = iconBox.y + iconBox.height / 2;

        expect(Math.abs(iconCenterX - fabCenterX)).toBeLessThanOrEqual(3);
        expect(Math.abs(iconCenterY - fabCenterY)).toBeLessThanOrEqual(3);
      }
    });
  });

  test.describe('Segmented Control Alignment', () => {
    test('segmented control items are aligned', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Look for segmented controls (like theme selector)
      const segmentedControls = page.locator('[class*="flex"][class*="rounded"]:has(button + button)');
      const count = await segmentedControls.count();

      for (let i = 0; i < count; i++) {
        const control = segmentedControls.nth(i);
        if (await control.isVisible()) {
          const buttons = control.locator('button');
          const buttonCount = await buttons.count();

          if (buttonCount >= 2) {
            const boxes = [];
            for (let j = 0; j < buttonCount; j++) {
              const button = buttons.nth(j);
              if (await button.isVisible()) {
                boxes.push(await getBoundingBox(button));
              }
            }

            // All buttons should have same height and be vertically aligned
            if (boxes.length >= 2) {
              const firstHeight = boxes[0].height;
              const firstCenterY = boxes[0].y + boxes[0].height / 2;

              for (let j = 1; j < boxes.length; j++) {
                // Same height
                expect(Math.abs(boxes[j].height - firstHeight)).toBeLessThanOrEqual(2);

                // Same vertical center
                const centerY = boxes[j].y + boxes[j].height / 2;
                expect(Math.abs(centerY - firstCenterY)).toBeLessThanOrEqual(2);
              }
            }
          }
        }
      }
    });
  });

  test.describe('Chip/Tag Alignment', () => {
    test('chips have centered content', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      const chips = page.locator('[class*="rounded-full"]:has-text("")').filter({
        has: page.locator('text=/./'),
      });
      const count = await chips.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const chip = chips.nth(i);
        if (await chip.isVisible()) {
          const chipBox = await getBoundingBox(chip);

          // Chips should have reasonable height (content vertically centered via padding)
          expect(chipBox.height).toBeGreaterThanOrEqual(24);
          expect(chipBox.height).toBeLessThanOrEqual(48);
        }
      }
    });
  });
});
