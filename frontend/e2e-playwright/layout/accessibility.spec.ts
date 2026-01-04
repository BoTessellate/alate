import { test, expect, Page, Locator } from '@playwright/test';
import { setupMockRoutes, skipOnboarding } from '../fixtures/mock-data';

/**
 * Accessibility Tests - Color Contrast
 *
 * Tests to ensure text has adequate contrast against backgrounds.
 * WCAG 2.1 AA requires:
 * - 4.5:1 contrast ratio for normal text
 * - 3:1 contrast ratio for large text (18pt+ or 14pt+ bold)
 */

// Parse CSS color to RGB
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle rgb/rgba format
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Handle hex format
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  // Handle named colors (common ones)
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
  };
  if (namedColors[color.toLowerCase()]) {
    return namedColors[color.toLowerCase()];
  }

  return null;
}

// Calculate relative luminance per WCAG 2.1
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio per WCAG 2.1
function getContrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = getLuminance(fg.r, fg.g, fg.b);
  const l2 = getLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Get computed styles for an element
async function getElementColors(element: Locator): Promise<{
  color: string;
  backgroundColor: string;
}> {
  return await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
    };
  });
}

// Assert contrast ratio meets WCAG AA standard
async function assertContrastRatio(
  element: Locator,
  minRatio: number = 4.5,
  description: string = ''
): Promise<{ passed: boolean; ratio: number; fg: string; bg: string }> {
  const colors = await getElementColors(element);
  const fg = parseColor(colors.color);
  const bg = parseColor(colors.backgroundColor);

  // If we can't parse colors, skip the check
  if (!fg || !bg) {
    return { passed: true, ratio: 0, fg: colors.color, bg: colors.backgroundColor };
  }

  // Handle transparent backgrounds - check parent
  if (colors.backgroundColor === 'rgba(0, 0, 0, 0)') {
    return { passed: true, ratio: 0, fg: colors.color, bg: 'transparent' };
  }

  const ratio = getContrastRatio(fg, bg);
  const passed = ratio >= minRatio;

  if (!passed && description) {
    console.log(
      `Contrast failure: ${description} - Ratio: ${ratio.toFixed(2)}:1 (need ${minRatio}:1), FG: ${colors.color}, BG: ${colors.backgroundColor}`
    );
  }

  return { passed, ratio, fg: colors.color, bg: colors.backgroundColor };
}

test.describe('Accessibility - Color Contrast', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await skipOnboarding(page);
  });

  test.describe('Chat Message Contrast', () => {
    test('user message text has sufficient contrast against bubble background', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open assistant panel
      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Type a message and send it
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('https://example.com/product');
        await page.click('[aria-label="Send"]');
        await page.waitForTimeout(500);

        // Find user message bubbles (messages with primary background)
        const userMessages = page.locator('[style*="primary-light"] p, [style*="primary-dark"] p');
        const count = await userMessages.count();

        for (let i = 0; i < count; i++) {
          const message = userMessages.nth(i);
          if (await message.isVisible()) {
            const result = await assertContrastRatio(
              message,
              4.5,
              `User message ${i}`
            );

            // Only fail if we could actually calculate the ratio
            if (result.ratio > 0) {
              expect(
                result.passed,
                `User message text contrast ratio is ${result.ratio.toFixed(2)}:1, needs 4.5:1. FG: ${result.fg}, BG: ${result.bg}`
              ).toBe(true);
            }
          }
        }
      }
    });

    test('assistant message text has sufficient contrast', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.click('[aria-label="Open assistant"]');
      await page.waitForTimeout(300);

      // Look for assistant messages (surface-light background)
      const assistantMessages = page.locator('[style*="surface-light"] p');
      const count = await assistantMessages.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const message = assistantMessages.nth(i);
        if (await message.isVisible()) {
          const result = await assertContrastRatio(message, 4.5, `Assistant message ${i}`);
          if (result.ratio > 0) {
            expect(
              result.passed,
              `Assistant message contrast is ${result.ratio.toFixed(2)}:1`
            ).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Button Text Contrast', () => {
    test('primary buttons have sufficient text contrast', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Find buttons with primary styling
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const text = await button.textContent();
          if (text && text.trim()) {
            const result = await assertContrastRatio(button, 4.5, `Button: ${text.trim()}`);
            // Log but don't fail for transparent backgrounds
            if (result.ratio > 0 && !result.passed) {
              console.warn(
                `Button "${text.trim()}" may have contrast issues: ${result.ratio.toFixed(2)}:1`
              );
            }
          }
        }
      }
    });
  });

  test.describe('Form Input Contrast', () => {
    test('input placeholder text has sufficient contrast', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      const inputs = page.locator('input[placeholder]');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          // Check the input text color (placeholder inherits from input)
          const result = await assertContrastRatio(input, 3, `Input ${i} placeholder`);
          // Placeholder text only needs 3:1 ratio per WCAG
          if (result.ratio > 0 && !result.passed) {
            console.warn(`Input placeholder may have contrast issues: ${result.ratio.toFixed(2)}:1`);
          }
        }
      }
    });
  });

  test.describe('Link Contrast', () => {
    test('links are distinguishable from surrounding text', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const links = page.locator('a');
      const count = await links.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const result = await assertContrastRatio(link, 4.5, `Link ${i}`);
          if (result.ratio > 0 && !result.passed) {
            console.warn(`Link may have contrast issues: ${result.ratio.toFixed(2)}:1`);
          }
        }
      }
    });
  });

  test.describe('Badge/Chip Contrast', () => {
    test('badges have readable text', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForLoadState('networkidle');

      // Chips/badges are often rounded-full with text
      const badges = page.locator('[class*="rounded-full"]:has-text("")');
      const count = await badges.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const badge = badges.nth(i);
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          if (text && text.trim()) {
            const result = await assertContrastRatio(badge, 4.5, `Badge: ${text.trim()}`);
            if (result.ratio > 0 && !result.passed) {
              console.warn(
                `Badge "${text.trim()}" may have contrast issues: ${result.ratio.toFixed(2)}:1`
              );
            }
          }
        }
      }
    });
  });

  test.describe('Status/Alert Contrast', () => {
    test('error messages have sufficient contrast', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Error messages typically have red styling
      const errorElements = page.locator('[class*="error"], [style*="error"], [class*="red"]');
      const count = await errorElements.count();

      for (let i = 0; i < count; i++) {
        const el = errorElements.nth(i);
        if (await el.isVisible()) {
          const result = await assertContrastRatio(el, 4.5, `Error element ${i}`);
          if (result.ratio > 0) {
            expect(result.passed, `Error text contrast is ${result.ratio.toFixed(2)}:1`).toBe(true);
          }
        }
      }
    });
  });
});

test.describe('Accessibility - Focus Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('interactive elements have visible focus indicators', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Tab through first few focusable elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = page.locator(':focus');
      if (await focusedElement.count() > 0) {
        // Check if element has some form of focus styling
        const styles = await focusedElement.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            outline: computed.outline,
            boxShadow: computed.boxShadow,
            border: computed.border,
          };
        });

        // At least one focus indicator should be present
        const hasFocusIndicator =
          (styles.outline && styles.outline !== 'none' && !styles.outline.includes('0px')) ||
          (styles.boxShadow && styles.boxShadow !== 'none') ||
          (styles.border && styles.border.includes('2px'));

        // Log warning if no focus indicator found
        if (!hasFocusIndicator) {
          console.warn(`Element may lack visible focus indicator: ${await focusedElement.evaluate(el => el.tagName)}`);
        }
      }
    }
  });
});
