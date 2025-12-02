// Grid state management for automatic product placement

export type LayoutStyle = 'grid' | 'circular' | 'editorial';

interface GridConfig {
  columns: number;
  rows: number;
  padding: number;
  spacing: number;
  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;
  layoutStyle: LayoutStyle;
}

interface GridCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  filled: boolean;
}

let gridConfig: GridConfig | null = null;
let gridCells: GridCell[] = [];
let currentCellIndex = 0;

export async function initializeGrid(
  columns: number,
  rows: number,
  canvasWidth: number,
  canvasHeight: number,
  layoutStyle: LayoutStyle = 'grid',
  padding: number = 30,
  spacing: number = 15
) {
  const availableWidth = canvasWidth - (padding * 2) - (spacing * (columns - 1));
  const availableHeight = canvasHeight - (padding * 2) - (spacing * (rows - 1));

  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;

  gridConfig = {
    columns,
    rows,
    padding,
    spacing,
    canvasWidth,
    canvasHeight,
    cellWidth,
    cellHeight,
    layoutStyle,
  };

  // Initialize cells based on layout style
  gridCells = [];

  switch (layoutStyle) {
    case 'grid':
      gridCells = generateGridLayout(columns, rows, padding, spacing, cellWidth, cellHeight);
      break;
    case 'circular':
      gridCells = generateCircularLayout(columns * rows, canvasWidth, canvasHeight, cellWidth, cellHeight);
      break;
    case 'editorial':
      gridCells = generateEditorialLayout(columns * rows, canvasWidth, canvasHeight, cellWidth, cellHeight);
      break;
  }

  currentCellIndex = 0;
  wrapAroundCount = 0; // Reset wrap around counter

  // CRITICAL: Sync grid state with existing products on canvas
  // This ensures that when the page is refreshed, the grid manager knows
  // which cells are already occupied by existing products
  await syncGridWithCanvas();
}

/**
 * Syncs the grid state with existing products on the canvas.
 * Marks cells as filled if they contain products from previous sessions.
 */
async function syncGridWithCanvas(): Promise<void> {
  try {
    const { getAllProductImages } = await import('./elementMetadata');
    const products = await getAllProductImages();

    if (products.length === 0) {
      return; // No products to sync
    }

    console.log('[GridManager] Syncing grid with', products.length, 'existing products');

    // For each existing product, find the closest grid cell and mark it as filled
    for (const { element } of products) {
      const productX = element.left || 0;
      const productY = element.top || 0;

      // Find the closest grid cell to this product
      let closestCellIndex = -1;
      let minDistance = Infinity;

      gridCells.forEach((cell, index) => {
        const dx = cell.x - productX;
        const dy = cell.y - productY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestCellIndex = index;
        }
      });

      // Mark the closest cell as filled
      if (closestCellIndex >= 0) {
        gridCells[closestCellIndex].filled = true;
        console.log('[GridManager] Marked cell', closestCellIndex, 'as filled for product at', { x: productX, y: productY });
      }
    }

    // Update currentCellIndex to point to the first unfilled cell
    for (let i = 0; i < gridCells.length; i++) {
      if (!gridCells[i].filled) {
        currentCellIndex = i;
        console.log('[GridManager] Next available cell index:', i);
        break;
      }
    }
  } catch (error) {
    console.error('[GridManager] Failed to sync grid with canvas:', error);
    // Continue without syncing - better to have potential overlap than crash
  }
}

function generateGridLayout(columns: number, rows: number, padding: number, spacing: number, cellWidth: number, cellHeight: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = padding + col * (cellWidth + spacing);
      const y = padding + row * (cellHeight + spacing);
      cells.push({ row, col, x, y, width: cellWidth, height: cellHeight, filled: false });
    }
  }
  return cells;
}


function generateCircularLayout(count: number, canvasWidth: number, canvasHeight: number, cellWidth: number, cellHeight: number): GridCell[] {
  const cells: GridCell[] = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.42;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius - cellWidth / 2;
    const y = centerY + Math.sin(angle) * radius - cellHeight / 2;

    cells.push({
      row: Math.floor(i / 3),
      col: i % 3,
      x,
      y,
      width: cellWidth * 0.9,
      height: cellHeight * 0.9,
      rotation: (angle * 180 / Math.PI) + 90,
      filled: false
    });
  }

  return cells;
}

function generateEditorialLayout(count: number, canvasWidth: number, canvasHeight: number, cellWidth: number, cellHeight: number): GridCell[] {
  const cells: GridCell[] = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  if (count === 0) return cells;

  // First item is the hero (larger, centered)
  const heroWidth = cellWidth * 1.4;
  const heroHeight = cellHeight * 1.4;
  cells.push({
    row: 0,
    col: 0,
    x: centerX - heroWidth / 2,
    y: centerY - heroHeight / 2,
    width: heroWidth,
    height: heroHeight,
    filled: false
  });

  if (count === 1) return cells;

  // Remaining items cluster around the hero in a tight formation
  const clusterRadius = Math.max(heroWidth, heroHeight) * 1.0;
  const angleStep = (Math.PI * 2) / (count - 1);

  for (let i = 1; i < count; i++) {
    // Vary the radius slightly for more organic clustering
    const radiusVariation = 0.8 + Math.random() * 0.4; // 80% to 120%
    const actualRadius = clusterRadius * radiusVariation;

    // Calculate angle with slight randomization
    const baseAngle = angleStep * (i - 1);
    const angleVariation = (Math.random() - 0.5) * 0.3; // ±15 degrees
    const angle = baseAngle + angleVariation;

    // Smaller sizes for supporting items
    const itemWidth = cellWidth * (0.6 + Math.random() * 0.3); // 60-90% of base
    const itemHeight = cellHeight * (0.6 + Math.random() * 0.3);

    const x = centerX + Math.cos(angle) * actualRadius - itemWidth / 2;
    const y = centerY + Math.sin(angle) * actualRadius - itemHeight / 2;

    cells.push({
      row: Math.floor(i / 3),
      col: i % 3,
      x,
      y,
      width: itemWidth,
      height: itemHeight,
      rotation: -8 + Math.random() * 16, // -8 to +8 degrees
      filled: false
    });
  }

  return cells;
}

let wrapAroundCount = 0; // Track how many times we've wrapped around

export function getNextAvailableCell(isHero: boolean = false): { x: number; y: number; width: number; height: number; rotation?: number } | null {
  if (!gridConfig || gridCells.length === 0) {
    const defaultSize = isHero ? 720 : 400;
    return { x: 0, y: 0, width: defaultSize, height: defaultSize };
  }

  // Find next unfilled cell
  for (let i = currentCellIndex; i < gridCells.length; i++) {
    if (!gridCells[i].filled) {
      gridCells[i].filled = true;
      currentCellIndex = i;

      // Apply hero sizing multiplier
      const sizeMultiplier = isHero ? 1.8 : 1.0;
      let width = gridCells[i].width * sizeMultiplier;
      let height = gridCells[i].height * sizeMultiplier;

      // If we've wrapped around, make items progressively smaller and offset toward center
      if (wrapAroundCount > 0) {
        // Each wrap makes items 20% smaller
        const wrapScale = Math.pow(0.8, wrapAroundCount);
        width *= wrapScale;
        height *= wrapScale;

        // Calculate offset toward canvas center
        const canvasCenterX = gridConfig.canvasWidth / 2;
        const canvasCenterY = gridConfig.canvasHeight / 2;
        const cellCenterX = gridCells[i].x + gridCells[i].width / 2;
        const cellCenterY = gridCells[i].y + gridCells[i].height / 2;

        // Move 30% closer to center with each wrap
        const offsetFactor = wrapAroundCount * 0.3;
        const xShift = (canvasCenterX - cellCenterX) * offsetFactor;
        const yShift = (canvasCenterY - cellCenterY) * offsetFactor;

        return {
          x: gridCells[i].x + xShift + (gridCells[i].width - width) / 2,
          y: gridCells[i].y + yShift + (gridCells[i].height - height) / 2,
          width,
          height,
          rotation: gridCells[i].rotation,
        };
      }

      // Normal positioning (no wrap around)
      const xOffset = (width - gridCells[i].width) / 2;
      const yOffset = (height - gridCells[i].height) / 2;

      return {
        x: gridCells[i].x - xOffset,
        y: gridCells[i].y - yOffset,
        width,
        height,
        rotation: gridCells[i].rotation,
      };
    }
  }

  // All cells filled, wrap around with smaller, centered positioning
  wrapAroundCount++;
  console.log(`[GridManager] Grid full, wrapping around (count: ${wrapAroundCount}). Next items will be smaller and closer to center.`);
  resetGrid();
  return getNextAvailableCell(isHero);
}

export function resetGrid() {
  gridCells.forEach(cell => {
    cell.filled = false;
  });
  currentCellIndex = 0;
  // Don't reset wrapAroundCount here - it should keep incrementing
  // across resets to maintain visual distinction
}

export function isGridInitialized(): boolean {
  return gridConfig !== null && gridCells.length > 0;
}

export function getGridInfo() {
  return {
    isInitialized: isGridInitialized(),
    totalCells: gridCells.length,
    filledCells: gridCells.filter(c => c.filled).length,
    config: gridConfig,
  };
}
