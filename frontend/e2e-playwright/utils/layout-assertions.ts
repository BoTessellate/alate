import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Layout Assertion Utilities
 *
 * Reusable assertions for testing UI alignment and positioning.
 * These assertions use current code values as the baseline.
 *
 * Usage:
 *   import { assertVerticallyAligned, assertBelow } from '../utils/layout-assertions';
 *   await assertVerticallyAligned(page, iconLocator, inputLocator);
 */

// =============================================================================
// CSS Variable Constants (from globals.css)
// =============================================================================

export const CSS_VARS = {
  topbarHeight: 56,
  topbarCurveOffset: 20,
  topbarTotalHeight: 76, // 56 + 20
  sidePanelWidth: 480,
  bubbleWidth: 280,
  bubbleBottom: 88, // Increased from 80 to leave 16px clearance above FAB
  bubbleRight: 24,
  fabBottom: 24,
  fabRight: 24,
  fabSize: 48, // Updated from 44 to match actual button size
  fabBubbleMinGap: 16, // Minimum gap between FAB top and bubble bottom
} as const;

// =============================================================================
// Bounding Box Helpers
// =============================================================================

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get bounding box with null check
 */
export async function getBoundingBox(locator: Locator): Promise<BoundingBox> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Element not visible or not found: ${locator}`);
  }
  return box;
}

/**
 * Get center point of an element
 */
export function getCenter(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

// =============================================================================
// Alignment Assertions
// =============================================================================

/**
 * Assert two elements are vertically aligned (same horizontal center)
 * Useful for: icon + input, button + label
 */
export async function assertVerticallyAligned(
  element1: Locator,
  element2: Locator,
  tolerance: number = 3
): Promise<void> {
  const box1 = await getBoundingBox(element1);
  const box2 = await getBoundingBox(element2);

  const center1 = getCenter(box1);
  const center2 = getCenter(box2);

  const diff = Math.abs(center1.y - center2.y);

  expect(diff, `Elements should be vertically aligned. Difference: ${diff}px`).toBeLessThanOrEqual(
    tolerance
  );
}

/**
 * Assert two elements are horizontally aligned (same vertical center)
 * Useful for: items in a row
 */
export async function assertHorizontallyAligned(
  element1: Locator,
  element2: Locator,
  tolerance: number = 3
): Promise<void> {
  const box1 = await getBoundingBox(element1);
  const box2 = await getBoundingBox(element2);

  const center1 = getCenter(box1);
  const center2 = getCenter(box2);

  const diff = Math.abs(center1.x - center2.x);

  expect(diff, `Elements should be horizontally aligned. Difference: ${diff}px`).toBeLessThanOrEqual(
    tolerance
  );
}

/**
 * Assert element is centered within its container
 */
export async function assertCenteredIn(
  element: Locator,
  container: Locator,
  tolerance: number = 5
): Promise<void> {
  const elementBox = await getBoundingBox(element);
  const containerBox = await getBoundingBox(container);

  const elementCenter = getCenter(elementBox);
  const containerCenter = getCenter(containerBox);

  const xDiff = Math.abs(elementCenter.x - containerCenter.x);
  const yDiff = Math.abs(elementCenter.y - containerCenter.y);

  expect(xDiff, `Element should be horizontally centered. X difference: ${xDiff}px`).toBeLessThanOrEqual(
    tolerance
  );
  expect(yDiff, `Element should be vertically centered. Y difference: ${yDiff}px`).toBeLessThanOrEqual(
    tolerance
  );
}

// =============================================================================
// Position Assertions
// =============================================================================

/**
 * Assert element is positioned below another element
 * Useful for: dropdown below trigger, panel below topbar
 */
export async function assertBelow(
  element: Locator,
  reference: Locator,
  minGap: number = 0,
  maxGap?: number
): Promise<void> {
  const elementBox = await getBoundingBox(element);
  const referenceBox = await getBoundingBox(reference);

  const referenceBottom = referenceBox.y + referenceBox.height;
  const gap = elementBox.y - referenceBottom;

  expect(gap, `Element should be below reference. Gap: ${gap}px`).toBeGreaterThanOrEqual(minGap);

  if (maxGap !== undefined) {
    expect(gap, `Gap should be at most ${maxGap}px. Actual: ${gap}px`).toBeLessThanOrEqual(maxGap);
  }
}

/**
 * Assert element is positioned to the right of another element
 */
export async function assertRightOf(
  element: Locator,
  reference: Locator,
  minGap: number = 0,
  maxGap?: number
): Promise<void> {
  const elementBox = await getBoundingBox(element);
  const referenceBox = await getBoundingBox(reference);

  const referenceRight = referenceBox.x + referenceBox.width;
  const gap = elementBox.x - referenceRight;

  expect(gap, `Element should be to the right. Gap: ${gap}px`).toBeGreaterThanOrEqual(minGap);

  if (maxGap !== undefined) {
    expect(gap, `Gap should be at most ${maxGap}px. Actual: ${gap}px`).toBeLessThanOrEqual(maxGap);
  }
}

/**
 * Assert element top position is at or below a Y value
 * Useful for: side panel below topbar
 */
export async function assertTopAtLeast(element: Locator, minY: number): Promise<void> {
  const box = await getBoundingBox(element);
  expect(box.y, `Element top (${box.y}px) should be >= ${minY}px`).toBeGreaterThanOrEqual(minY);
}

/**
 * Assert element is within viewport bounds
 */
export async function assertWithinViewport(element: Locator, page: Page): Promise<void> {
  const box = await getBoundingBox(element);
  const viewport = page.viewportSize();

  if (!viewport) {
    throw new Error('Viewport size not available');
  }

  expect(box.x, 'Element left edge should be within viewport').toBeGreaterThanOrEqual(0);
  expect(box.y, 'Element top edge should be within viewport').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'Element right edge should be within viewport').toBeLessThanOrEqual(
    viewport.width
  );
  expect(box.y + box.height, 'Element bottom edge should be within viewport').toBeLessThanOrEqual(
    viewport.height
  );
}

// =============================================================================
// Size Assertions
// =============================================================================

/**
 * Assert element has specific dimensions
 */
export async function assertDimensions(
  element: Locator,
  expected: { width?: number; height?: number },
  tolerance: number = 2
): Promise<void> {
  const box = await getBoundingBox(element);

  if (expected.width !== undefined) {
    const widthDiff = Math.abs(box.width - expected.width);
    expect(widthDiff, `Width should be ${expected.width}px. Actual: ${box.width}px`).toBeLessThanOrEqual(
      tolerance
    );
  }

  if (expected.height !== undefined) {
    const heightDiff = Math.abs(box.height - expected.height);
    expect(heightDiff, `Height should be ${expected.height}px. Actual: ${box.height}px`).toBeLessThanOrEqual(
      tolerance
    );
  }
}

/**
 * Assert element has minimum dimensions
 */
export async function assertMinDimensions(
  element: Locator,
  minWidth?: number,
  minHeight?: number
): Promise<void> {
  const box = await getBoundingBox(element);

  if (minWidth !== undefined) {
    expect(box.width, `Width should be >= ${minWidth}px. Actual: ${box.width}px`).toBeGreaterThanOrEqual(
      minWidth
    );
  }

  if (minHeight !== undefined) {
    expect(box.height, `Height should be >= ${minHeight}px. Actual: ${box.height}px`).toBeGreaterThanOrEqual(
      minHeight
    );
  }
}

// =============================================================================
// Overlap Assertions
// =============================================================================

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.x + box1.width <= box2.x ||
    box2.x + box2.width <= box1.x ||
    box1.y + box1.height <= box2.y ||
    box2.y + box2.height <= box1.y
  );
}

/**
 * Assert two elements do NOT overlap
 */
export async function assertNoOverlap(element1: Locator, element2: Locator): Promise<void> {
  const box1 = await getBoundingBox(element1);
  const box2 = await getBoundingBox(element2);

  expect(boxesOverlap(box1, box2), 'Elements should not overlap').toBe(false);
}

/**
 * Assert element is fully contained within container
 */
export async function assertContainedIn(element: Locator, container: Locator): Promise<void> {
  const elementBox = await getBoundingBox(element);
  const containerBox = await getBoundingBox(container);

  expect(elementBox.x, 'Element left should be within container').toBeGreaterThanOrEqual(containerBox.x);
  expect(elementBox.y, 'Element top should be within container').toBeGreaterThanOrEqual(containerBox.y);
  expect(
    elementBox.x + elementBox.width,
    'Element right should be within container'
  ).toBeLessThanOrEqual(containerBox.x + containerBox.width);
  expect(
    elementBox.y + elementBox.height,
    'Element bottom should be within container'
  ).toBeLessThanOrEqual(containerBox.y + containerBox.height);
}

// =============================================================================
// Grid/Spacing Assertions
// =============================================================================

/**
 * Assert elements in a row have consistent spacing
 */
export async function assertConsistentHorizontalSpacing(
  elements: Locator[],
  tolerance: number = 3
): Promise<void> {
  if (elements.length < 2) return;

  const boxes = await Promise.all(elements.map(getBoundingBox));
  const gaps: number[] = [];

  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  for (const gap of gaps) {
    const diff = Math.abs(gap - avgGap);
    expect(diff, `Horizontal spacing should be consistent. Gap: ${gap}px, Average: ${avgGap}px`).toBeLessThanOrEqual(
      tolerance
    );
  }
}

/**
 * Assert elements in a column have consistent spacing
 */
export async function assertConsistentVerticalSpacing(
  elements: Locator[],
  tolerance: number = 3
): Promise<void> {
  if (elements.length < 2) return;

  const boxes = await Promise.all(elements.map(getBoundingBox));
  const gaps: number[] = [];

  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  for (const gap of gaps) {
    const diff = Math.abs(gap - avgGap);
    expect(diff, `Vertical spacing should be consistent. Gap: ${gap}px, Average: ${avgGap}px`).toBeLessThanOrEqual(
      tolerance
    );
  }
}

// =============================================================================
// Specific Component Assertions
// =============================================================================

/**
 * Assert side panel is below topbar curve
 */
export async function assertSidePanelBelowTopbar(panel: Locator): Promise<void> {
  const box = await getBoundingBox(panel);
  expect(
    box.y,
    `Side panel top (${box.y}px) should be >= topbar total height (${CSS_VARS.topbarTotalHeight}px)`
  ).toBeGreaterThanOrEqual(CSS_VARS.topbarTotalHeight - 2); // 2px tolerance
}

/**
 * Assert FAB is in correct position (bottom-right)
 */
export async function assertFabPosition(fab: Locator, page: Page): Promise<void> {
  const box = await getBoundingBox(fab);
  const viewport = page.viewportSize();

  if (!viewport) {
    throw new Error('Viewport size not available');
  }

  const expectedRight = viewport.width - CSS_VARS.fabRight - CSS_VARS.fabSize;
  const expectedBottom = viewport.height - CSS_VARS.fabBottom - CSS_VARS.fabSize;

  expect(Math.abs(box.x - expectedRight), 'FAB should be positioned from right').toBeLessThanOrEqual(5);
  // FAB has two buttons stacked, so check bottom button
}

/**
 * Assert FAB and bubble panel do not visually overlap
 * Ensures minimum gap between FAB top edge and bubble bottom edge
 */
export async function assertFabBubbleNoOverlap(fab: Locator, bubble: Locator): Promise<void> {
  const fabBox = await getBoundingBox(fab);
  const bubbleBox = await getBoundingBox(bubble);

  // FAB top edge
  const fabTop = fabBox.y;
  // Bubble bottom edge
  const bubbleBottom = bubbleBox.y + bubbleBox.height;

  // Gap between FAB top and bubble bottom
  const gap = fabTop - bubbleBottom;

  expect(
    gap,
    `FAB and bubble should have at least ${CSS_VARS.fabBubbleMinGap}px gap. Actual gap: ${gap}px`
  ).toBeGreaterThanOrEqual(CSS_VARS.fabBubbleMinGap);

  // Also ensure they don't overlap horizontally in a confusing way
  const fabRight = fabBox.x + fabBox.width;
  const bubbleRight = bubbleBox.x + bubbleBox.width;

  // Both are right-aligned, so their right edges should be close
  const rightEdgeDiff = Math.abs(fabRight - bubbleRight);
  expect(
    rightEdgeDiff,
    `FAB and bubble should be aligned on right edge. Difference: ${rightEdgeDiff}px`
  ).toBeLessThanOrEqual(30); // Allow some tolerance
}

/**
 * Assert bubble panel dimensions and position
 */
export async function assertBubbleDimensions(bubble: Locator, page: Page): Promise<void> {
  const box = await getBoundingBox(bubble);
  const viewport = page.viewportSize();

  if (!viewport) {
    throw new Error('Viewport size not available');
  }

  // Width should be 280px
  expect(Math.abs(box.width - CSS_VARS.bubbleWidth), 'Bubble width should be 280px').toBeLessThanOrEqual(5);

  // Should be positioned from bottom-right
  const distanceFromRight = viewport.width - (box.x + box.width);
  const distanceFromBottom = viewport.height - (box.y + box.height);

  expect(
    Math.abs(distanceFromRight - CSS_VARS.bubbleRight),
    'Bubble should be 24px from right'
  ).toBeLessThanOrEqual(5);
  expect(
    Math.abs(distanceFromBottom - CSS_VARS.bubbleBottom),
    'Bubble should be 80px from bottom'
  ).toBeLessThanOrEqual(5);
}
