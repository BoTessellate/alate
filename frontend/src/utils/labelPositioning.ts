import { openDesign } from '@canva/design';
import { queueCanvasOperation } from './canvasQueue';

/**
 * Smart label positioning system that places text labels around images
 * without overlapping other elements.
 *
 * Labels are stored with metadata linking them to their parent images.
 * When layouts are rearranged, labels intelligently reposition themselves
 * in available space around their images.
 */

interface ElementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface LabelPosition {
  x: number;
  y: number;
  direction: 'bottom' | 'top' | 'right' | 'left' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const LABEL_GAP = 10; // Gap between image and label
const LABEL_HEIGHT = 60; // Estimated height for brand name + price
const LABEL_WIDTH = 200; // Estimated width for text labels

/**
 * Calculate bounding box for an element
 */
function getElementBounds(element: any): ElementBounds {
  return {
    left: element.left || 0,
    top: element.top || 0,
    width: element.width || 0,
    height: element.height || 0,
    right: (element.left || 0) + (element.width || 0),
    bottom: (element.top || 0) + (element.height || 0),
  };
}

/**
 * Check if two bounding boxes overlap
 */
function checkOverlap(bounds1: ElementBounds, bounds2: ElementBounds, buffer: number = 20): boolean {
  return !(
    bounds1.right + buffer < bounds2.left ||
    bounds1.left - buffer > bounds2.right ||
    bounds1.bottom + buffer < bounds2.top ||
    bounds1.top - buffer > bounds2.bottom
  );
}

/**
 * Calculate candidate positions for a label around an image
 * Returns positions in order of preference - prioritizing edge positions over centered ones
 */
function calculateCandidatePositions(
  imageBounds: ElementBounds,
  canvasWidth: number,
  canvasHeight: number
): LabelPosition[] {
  const candidates: LabelPosition[] = [];

  // PRIORITY 1: Top and Bottom (most preferred - use vertical space first)

  // Bottom centered - horizontally centered below image (MOST PREFERRED)
  candidates.push({
    x: imageBounds.left + (imageBounds.width - LABEL_WIDTH) / 2,
    y: imageBounds.bottom + LABEL_GAP,
    direction: 'bottom',
  });

  // Top centered - horizontally centered above image
  candidates.push({
    x: imageBounds.left + (imageBounds.width - LABEL_WIDTH) / 2,
    y: imageBounds.top - LABEL_HEIGHT - LABEL_GAP,
    direction: 'top',
  });

  // PRIORITY 2: Bottom/Top edges (still prefer vertical space)

  // Bottom-right edge
  candidates.push({
    x: imageBounds.right + LABEL_GAP,
    y: imageBounds.bottom - LABEL_HEIGHT,
    direction: 'bottom-right',
  });

  // Bottom-left edge
  candidates.push({
    x: imageBounds.left - LABEL_WIDTH - LABEL_GAP,
    y: imageBounds.bottom - LABEL_HEIGHT,
    direction: 'bottom-left',
  });

  // Top-right edge
  candidates.push({
    x: imageBounds.right + LABEL_GAP,
    y: imageBounds.top,
    direction: 'top-right',
  });

  // Top-left edge
  candidates.push({
    x: imageBounds.left - LABEL_WIDTH - LABEL_GAP,
    y: imageBounds.top,
    direction: 'top-left',
  });

  // PRIORITY 3: Sides (use horizontal space only when vertical is taken)

  // Right side (vertically centered)
  candidates.push({
    x: imageBounds.right + LABEL_GAP,
    y: imageBounds.top + (imageBounds.height - LABEL_HEIGHT) / 2,
    direction: 'right',
  });

  // Left side (vertically centered)
  candidates.push({
    x: imageBounds.left - LABEL_WIDTH - LABEL_GAP,
    y: imageBounds.top + (imageBounds.height - LABEL_HEIGHT) / 2,
    direction: 'left',
  });

  // Filter out positions that go outside canvas
  return candidates.filter(pos => {
    return pos.x >= 0 &&
           pos.y >= 0 &&
           pos.x + LABEL_WIDTH <= canvasWidth &&
           pos.y + LABEL_HEIGHT <= canvasHeight;
  });
}

/**
 * Find the best position for a label that doesn't overlap with other elements
 */
function findBestLabelPosition(
  imageBounds: ElementBounds,
  parentImageId: string,
  allElements: any[],
  canvasWidth: number,
  canvasHeight: number
): LabelPosition | null {
  const candidates = calculateCandidatePositions(imageBounds, canvasWidth, canvasHeight);

  // Try each candidate position
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const labelBounds: ElementBounds = {
      left: candidate.x,
      top: candidate.y,
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
      right: candidate.x + LABEL_WIDTH,
      bottom: candidate.y + LABEL_HEIGHT,
    };

    // Check if this position overlaps with any OTHER element (exclude parent image)
    let hasOverlap = false;
    for (const element of allElements) {
      // CRITICAL FIX: Skip collision check with the parent image itself
      // Labels should be allowed to be positioned close to their own image
      if (element.type === 'image' && element.id !== parentImageId) {
        const elementBounds = getElementBounds(element);
        const overlaps = checkOverlap(labelBounds, elementBounds);
        if (overlaps) {
          hasOverlap = true;
          break;
        }
      }
    }

    if (!hasOverlap) {
      return candidate;
    }
  }

  // If no non-overlapping position found, return the first candidate (bottom)
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Reposition all text labels around their parent images intelligently.
 * Called after rearranging images to maintain label-image relationships
 * while positioning labels on the periphery without overlaps.
 */
export async function repositionLabels(canvasWidth: number, canvasHeight: number): Promise<void> {
  await queueCanvasOperation(async () => {
    await openDesign({ type: 'current_page' }, async (session) => {
      const page = session.page as any;
      const elements = page.elements?.toArray() || [];

      // Import metadata utilities
      const { parseLabelName, getAllProductImages } = await import('./elementMetadata');

      // Get all product images with their metadata
      const products = await getAllProductImages();

      if (products.length === 0) {
        return; // No products to process
      }

      // Filter for only image elements (no groups for collision detection)
      const imageElements = elements.filter((el: any) => el.type === 'image');

      // Build a map of image ID to labels
      const imageIdToLabels = new Map<string, { brand: any | null; price: any | null }>();

      for (const text of elements) {
        if (text.type === 'text' && text.name) {
          const parsed = parseLabelName(text.name);
          if (parsed) {
            const existing = imageIdToLabels.get(parsed.imageId) || { brand: null, price: null };
            if (parsed.type === 'brand') {
              existing.brand = text;
            } else if (parsed.type === 'price') {
              existing.price = text;
            }
            imageIdToLabels.set(parsed.imageId, existing);
          }
        }
      }

      // Reposition labels for each product image
      for (const { element: image, metadata } of products) {
        const labels = imageIdToLabels.get(image.id);
        if (!labels || (!labels.brand && !labels.price)) {
          continue; // No labels for this image
        }

        const imageBounds = getElementBounds(image);
        const bestPosition = findBestLabelPosition(imageBounds, image.id, imageElements, canvasWidth, canvasHeight);

        if (bestPosition) {
          // Position brand label
          if (labels.brand) {
            labels.brand.left = bestPosition.x;
            labels.brand.top = bestPosition.y;
          }

          // Position price label below brand label
          if (labels.price) {
            labels.price.left = bestPosition.x;
            labels.price.top = labels.brand ? bestPosition.y + 25 : bestPosition.y;
          }
        }
      }

      await session.sync();
    });
  });
}

/**
 * Create text labels for an image with smart positioning.
 * Labels are added as separate text elements with names that link them to the image.
 * Returns the IDs of created label elements.
 */
export async function createSmartLabels(
  imageId: string,
  imageBounds: ElementBounds,
  brandName: string | null,
  price: string | null,
  currency: string | null,
  allElements: any[],
  canvasWidth: number,
  canvasHeight: number
): Promise<{ brandLabelId: string | null; priceLabelId: string | null }> {
  const result = {
    brandLabelId: null as string | null,
    priceLabelId: null as string | null,
  };

  // Find best position that doesn't overlap with other elements
  let bestPosition = findBestLabelPosition(imageBounds, imageId, allElements, canvasWidth, canvasHeight);

  if (!bestPosition) {
    // Fallback to bottom position if no good position found
    bestPosition = {
      x: Math.max(0, Math.min(imageBounds.left, canvasWidth - LABEL_WIDTH)),
      y: Math.min(imageBounds.bottom + LABEL_GAP, canvasHeight - LABEL_HEIGHT),
      direction: 'bottom',
    };
  }

  // Import the naming utility to create linked label names
  const { createLabelName } = await import('./elementMetadata');

  // Create brand name label
  if (brandName) {
    const brandLabelName = createLabelName('brand', imageId);
    await queueCanvasOperation(async () => {
      const { addElementAtPoint, openDesign } = await import('@canva/design');
      const brandId = await addElementAtPoint({
        type: 'text',
        children: [brandName],
        left: bestPosition!.x,
        top: bestPosition!.y,
        width: LABEL_WIDTH,
        fontWeight: 'bold',
        fontSize: 12,
      });

      // Set the name after creation using openDesign
      await openDesign({ type: 'current_page' }, async (session) => {
        const page = session.page as any;
        const elements = page.elements?.toArray() || [];
        const brandElement = elements.find((el: any) => el.id === brandId);
        if (brandElement) {
          brandElement.name = brandLabelName;
        }
        await session.sync();
      });

      result.brandLabelId = brandId;
    });
  }

  // Create price label below brand name
  if (price && currency) {
    const priceText = `${currency} ${price}`;
    const priceLabelName = createLabelName('price', imageId);
    const priceTop = brandName ? bestPosition.y + 25 : bestPosition.y;

    await queueCanvasOperation(async () => {
      const { addElementAtPoint, openDesign } = await import('@canva/design');
      const priceId = await addElementAtPoint({
        type: 'text',
        children: [priceText],
        left: bestPosition!.x,
        top: priceTop,
        width: LABEL_WIDTH,
        fontSize: 10,
      });

      // Set the name after creation using openDesign
      await openDesign({ type: 'current_page' }, async (session) => {
        const page = session.page as any;
        const elements = page.elements?.toArray() || [];
        const priceElement = elements.find((el: any) => el.id === priceId);
        if (priceElement) {
          priceElement.name = priceLabelName;
        }
        await session.sync();
      });

      result.priceLabelId = priceId;
    });
  }

  return result;
}
