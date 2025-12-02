import { openDesign } from '@canva/design';
import type { LayoutStyle } from './gridManager';
import { queueCanvasOperation } from './canvasQueue';

interface LayoutConfig {
  columns: number;
  rows: number;
  layoutStyle: LayoutStyle;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Rearranges elements on the canvas into a specific layout pattern.
 *
 * IMPORTANT BEHAVIOR:
 * - Only rearranges 'image' and 'group' element types (excludes standalone text labels)
 * - NEVER rotates any elements - all items must remain upright for readability
 * - Groups contain image+text combinations and must never be rotated
 * - Supports three layout styles: grid (structured), circular (ring), editorial (hero + cluster)
 *
 * @param config - Layout configuration including dimensions and style
 * @throws {Error} If no rearrangeable elements are found on canvas
 */
export async function rearrangeElementsIntoLayout(config: LayoutConfig): Promise<void> {
  const { columns, rows, layoutStyle, canvasWidth, canvasHeight } = config;

  await queueCanvasOperation(async () => {
    await openDesign(
    { type: 'current_page' },
    async (session) => {
      const page = session.page as any; // Type assertion for elements access
      const elements = page.elements?.toArray() || [];

      // Filter for images only - exclude text elements which are labels
      // NOTE: We now only rearrange standalone images, not groups
      // Labels will be repositioned separately after the rearrange
      const rearrangeableElements = elements.filter(el => el.type === 'image');

      if (rearrangeableElements.length === 0) {
        throw new Error(`No images found on canvas to rearrange. Found ${elements.length} elements of types: ${[...new Set(elements.map(el => el.type))].join(', ')}`);
      }

      // Calculate average element size to adapt layouts
      // Use actual element dimensions which include text labels for groups
      const avgWidth = rearrangeableElements.reduce((sum, el) => sum + (el.width || 0), 0) / rearrangeableElements.length;
      const avgHeight = rearrangeableElements.reduce((sum, el) => sum + (el.height || 0), 0) / rearrangeableElements.length;
      // Add extra buffer for text labels that extend below images in groups
      const avgSize = Math.max(avgWidth, avgHeight + 80); // +80px buffer for text labels

      // Calculate positions based on layout style
      let positions: Array<{ x: number; y: number; rotation?: number }>;

      switch (layoutStyle) {
        case 'grid':
          positions = calculateGridPositions(rearrangeableElements.length, columns, rows, canvasWidth, canvasHeight);
          break;
        case 'circular':
          positions = calculateCircularPositions(rearrangeableElements.length, canvasWidth, canvasHeight, avgSize);
          break;
        case 'editorial':
          positions = calculateEditorialPositions(rearrangeableElements.length, canvasWidth, canvasHeight, avgSize);
          break;
      }

      // Apply new positions to elements (works for both groups and individual items)
      rearrangeableElements.forEach((element, index) => {
        if (index < positions.length) {
          const pos = positions[index];
          element.left = pos.x;
          element.top = pos.y;

          // CRITICAL: Never rotate any elements in a collage - keep everything upright
          // This is essential for readability of text labels (brand names, prices)
          // Groups contain text+image combinations that become unreadable when rotated
          // Even standalone images should not rotate in a collage context
          try {
            element.rotation = 0;
          } catch (error) {
            // Element doesn't support rotation, skip it
          }
        }
      });

      // Save changes
      await session.sync();
    }
  );
  });

  // After rearranging images, reposition their labels intelligently
  // This keeps labels on the periphery without overlapping
  const { repositionLabels } = await import('./labelPositioning');
  await repositionLabels(canvasWidth, canvasHeight);
}

/**
 * Calculates positions for a structured grid layout.
 *
 * FIX HISTORY:
 * - Spacing increased from 20px to 40px to prevent overlap when switching between layouts
 * - Rotation explicitly set to 0 (not undefined) to reset any previous rotation
 * - Shuffles element order on each rearrange to create completely different arrangements
 *
 * @returns Array of positions with x, y coordinates and rotation (always 0 for grid)
 */
function calculateGridPositions(
  count: number,
  columns: number,
  rows: number,
  canvasWidth: number,
  canvasHeight: number
): Array<{ x: number; y: number; rotation: number }> {
  const positions: Array<{ x: number; y: number; rotation: number }> = [];
  const padding = 50;
  const horizontalSpacing = 40; // Horizontal gap between columns
  const verticalSpacing = 100; // INCREASED: Vertical gap to account for text labels below images

  const availableWidth = canvasWidth - (padding * 2);
  const availableHeight = canvasHeight - (padding * 2);

  const cellWidth = (availableWidth - (horizontalSpacing * (columns - 1))) / columns;
  const cellHeight = (availableHeight - (verticalSpacing * (rows - 1))) / rows;

  // Create grid positions
  const gridPositions: Array<{ x: number; y: number; rotation: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = padding + col * (cellWidth + horizontalSpacing);
      const y = padding + row * (cellHeight + verticalSpacing);
      gridPositions.push({ x, y, rotation: 0 });
    }
  }

  // Shuffle positions using timestamp-based seed to create different arrangements
  const seed = Date.now();
  const shuffled = [...gridPositions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use seed-based pseudo-random for deterministic but different results
    const randomValue = Math.sin(seed + i * 43.678) * 43758.5453;
    const j = Math.floor((randomValue - Math.floor(randomValue)) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return only the positions needed for the element count
  return shuffled.slice(0, count);
}

/**
 * Calculates positions for a circular/ring layout.
 *
 * NOTE: Although rotation values are calculated here, they are NOT applied to elements.
 * The main rearrange function forces all elements to rotation: 0 for collage readability.
 * Each rearrange adds variation to create different circular arrangements.
 *
 * @returns Array of positions - rotation values are calculated but not used
 */
function calculateCircularPositions(
  count: number,
  canvasWidth: number,
  canvasHeight: number,
  elementSize: number = 200
): Array<{ x: number; y: number; rotation: number }> {
  const positions: Array<{ x: number; y: number; rotation: number }> = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Calculate safe radius that keeps items within canvas bounds
  // Use responsive padding based on canvas size
  const padding = Math.max(50, Math.min(canvasWidth, canvasHeight) * 0.05);
  const itemSize = Math.max(elementSize, 150); // Use actual element size with minimum
  const maxRadius = Math.min(canvasWidth, canvasHeight) / 2 - itemSize - padding;
  const baseRadius = Math.max(100, maxRadius * 0.65); // Use 65% of max safe radius

  // Add timestamp-based randomization for different arrangements on each click
  const seed = Date.now();
  const startAngleOffset = ((Math.sin(seed * 0.001) + 1) / 2) * Math.PI * 2; // Random start angle

  for (let i = 0; i < count; i++) {
    // Add variation to radius for organic feel
    const radiusVariation = Math.sin(seed + i * 45.678) * 0.15; // ±15% variation
    const radius = baseRadius * (1 + radiusVariation);

    // Add slight angle variation for irregular spacing
    const angleVariation = Math.sin(seed + i * 23.456) * 0.1; // Small angle offset
    const angle = startAngleOffset + (i / count) * Math.PI * 2 + angleVariation;

    const x = centerX + Math.cos(angle) * radius - itemSize / 2;
    const y = centerY + Math.sin(angle) * radius - itemSize / 2;
    // Rotation calculated but NOT applied (kept for future flexibility)
    const rotation = (angle * 180 / Math.PI) + 90;

    positions.push({ x, y, rotation });
  }

  return positions;
}

/**
 * Calculates positions for an editorial/hero layout following modern magazine design principles.
 *
 * DESIGN PRINCIPLES (2024):
 * - Asymmetric but balanced composition with visual weight distribution
 * - Organic scatter placement with intentional clustering and negative space
 * - Elements positioned at varied depths to create visual hierarchy
 * - Avoids grid-like patterns in favor of natural, editorial arrangements
 *
 * NOTE: Rotation values are calculated but NOT applied to maintain text readability.
 *
 * @returns Array of positions following editorial design best practices
 */
function calculateEditorialPositions(
  count: number,
  canvasWidth: number,
  canvasHeight: number,
  elementSize: number = 200
): Array<{ x: number; y: number; rotation?: number }> {
  const positions: Array<{ x: number; y: number; rotation?: number }> = [];

  const padding = 80; // Padding from edges
  const minGap = 60; // Minimum gap between items to prevent overlap
  const itemSize = Math.max(elementSize, 200);

  if (count === 0) return positions;

  const seed = Date.now();
  const availableWidth = canvasWidth - padding * 2 - itemSize;
  const availableHeight = canvasHeight - padding * 2 - itemSize;

  // Define multiple editorial layout patterns that create organic arrangements
  const layoutPatterns = [
    // Pattern 0: Diagonal cascade from top-left to bottom-right
    () => {
      for (let i = 0; i < count; i++) {
        const progress = i / Math.max(count - 1, 1);
        const xOffset = (Math.sin(seed + i * 12.345) * 0.2 + 0.5) * 0.6; // 30-90% across
        const yOffset = (Math.sin(seed + i * 23.456) * 0.2 + 0.5) * 0.6; // 30-90% down

        const x = padding + (progress * 0.7 + xOffset * 0.3) * availableWidth;
        const y = padding + (progress * 0.7 + yOffset * 0.3) * availableHeight;

        positions.push({ x, y, rotation: 0 });
      }
    },

    // Pattern 1: Scattered cluster with hero at top-left
    () => {
      for (let i = 0; i < count; i++) {
        if (i === 0) {
          // Hero position - top-left
          positions.push({ x: padding, y: padding, rotation: 0 });
        } else {
          // Scatter other items avoiding hero area
          const angle = (Math.sin(seed + i * 45.678) * 0.5 + 0.5) * Math.PI * 2;
          const distance = (Math.sin(seed + i * 67.890) * 0.3 + 0.5);

          const centerX = canvasWidth * 0.6;
          const centerY = canvasHeight * 0.55;
          const maxDist = Math.min(availableWidth, availableHeight) * 0.35;

          const x = Math.max(padding, Math.min(centerX + Math.cos(angle) * distance * maxDist, canvasWidth - padding - itemSize));
          const y = Math.max(padding, Math.min(centerY + Math.sin(angle) * distance * maxDist, canvasHeight - padding - itemSize));

          positions.push({ x, y, rotation: 0 });
        }
      }
    },

    // Pattern 2: Asymmetric vertical grouping
    () => {
      const useLeftSide = Math.sin(seed * 0.123) > 0;
      for (let i = 0; i < count; i++) {
        const verticalProgress = (i / Math.max(count - 1, 1));
        const horizontalVariation = Math.sin(seed + i * 34.567) * 0.15;

        const xBase = useLeftSide ? 0.25 : 0.65;
        const x = padding + (xBase + horizontalVariation) * availableWidth;
        const y = padding + (verticalProgress * 0.8 + Math.sin(seed + i * 56.789) * 0.1) * availableHeight;

        positions.push({ x, y, rotation: 0 });
      }
    },

    // Pattern 3: Circular organic scatter
    () => {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const baseRadius = Math.min(availableWidth, availableHeight) * 0.3;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.sin(seed + i * 78.901) * 0.5;
        const radiusVar = (Math.sin(seed + i * 89.012) * 0.4 + 0.8); // 0.4 to 1.2
        const radius = baseRadius * radiusVar;

        const x = Math.max(padding, Math.min(centerX + Math.cos(angle) * radius - itemSize / 2, canvasWidth - padding - itemSize));
        const y = Math.max(padding, Math.min(centerY + Math.sin(angle) * radius - itemSize / 2, canvasHeight - padding - itemSize));

        positions.push({ x, y, rotation: 0 });
      }
    },

    // Pattern 4: Magazine spread with hero + supporting elements
    () => {
      for (let i = 0; i < count; i++) {
        if (i === 0) {
          // Hero - center-left with slight offset
          const x = padding + availableWidth * 0.15;
          const y = padding + availableHeight * 0.25;
          positions.push({ x, y, rotation: 0 });
        } else {
          // Supporting elements scattered on right side
          const xRandom = Math.sin(seed + i * 91.234) * 0.5 + 0.5;
          const yRandom = Math.sin(seed + i * 12.345) * 0.5 + 0.5;

          const x = padding + (0.55 + xRandom * 0.35) * availableWidth;
          const y = padding + yRandom * availableHeight;

          positions.push({ x, y, rotation: 0 });
        }
      }
    }
  ];

  // Select pattern based on seed
  const patternIndex = Math.floor(((Math.sin(seed * 0.456) + 1) / 2) * layoutPatterns.length);
  layoutPatterns[patternIndex]();

  return positions;
}
