// Unit tests for gridManager utility
import {
  initializeGrid,
  getNextAvailableCell,
  resetGrid,
  isGridInitialized,
  type LayoutStyle,
} from './gridManager';

describe('gridManager', () => {
  const mockCanvasWidth = 1200;
  const mockCanvasHeight = 800;

  beforeEach(() => {
    // Reset grid before each test
    resetGrid();
  });

  describe('initializeGrid', () => {
    it('should initialize grid layout correctly', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'grid');
      expect(isGridInitialized()).toBe(true);
    });

    it('should initialize circular layout correctly', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'circular');
      expect(isGridInitialized()).toBe(true);
    });

    it('should initialize editorial layout correctly', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'editorial');
      expect(isGridInitialized()).toBe(true);
    });

    it('should calculate correct cell dimensions for grid layout', () => {
      initializeGrid(2, 2, 1000, 1000, 'grid');
      const cell = getNextAvailableCell(false);

      expect(cell).not.toBeNull();
      expect(cell!.x).toBeGreaterThanOrEqual(0);
      expect(cell!.y).toBeGreaterThanOrEqual(0);
      expect(cell!.width).toBeGreaterThan(0);
      expect(cell!.height).toBeGreaterThan(0);
    });
  });

  describe('getNextAvailableCell', () => {
    beforeEach(() => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'grid');
    });

    it('should return next available cell for regular item', () => {
      const cell = getNextAvailableCell(false);

      expect(cell).not.toBeNull();
      expect(cell!.x).toBeDefined();
      expect(cell!.y).toBeDefined();
      expect(cell!.width).toBeDefined();
      expect(cell!.height).toBeDefined();
    });

    it('should return larger cell for hero item', () => {
      const regularCell = getNextAvailableCell(false);
      resetGrid();
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'grid');
      const heroCell = getNextAvailableCell(true);

      expect(heroCell).not.toBeNull();
      expect(regularCell).not.toBeNull();

      // Hero cell should be 1.8x larger
      expect(heroCell!.width).toBeCloseTo(regularCell!.width * 1.8, 1);
      expect(heroCell!.height).toBeCloseTo(regularCell!.height * 1.8, 1);
    });

    it('should track filled cells correctly', () => {
      const cell1 = getNextAvailableCell(false);
      const cell2 = getNextAvailableCell(false);

      expect(cell1).not.toBeNull();
      expect(cell2).not.toBeNull();

      // Cells should be different positions
      expect(cell1!.x !== cell2!.x || cell1!.y !== cell2!.y).toBe(true);
    });

    it('should wrap around when all cells are filled', () => {
      // Fill all 9 cells (3x3 grid)
      for (let i = 0; i < 9; i++) {
        getNextAvailableCell(false);
      }

      // Next cell should wrap to first position
      const wrappedCell = getNextAvailableCell(false);
      expect(wrappedCell).not.toBeNull();
    });

    it('should return default position when grid not initialized', () => {
      resetGrid();
      const cell = getNextAvailableCell(false);

      expect(cell).not.toBeNull();
      expect(cell!.x).toBe(0);
      expect(cell!.y).toBe(0);
      expect(cell!.width).toBe(400);
      expect(cell!.height).toBe(400);
    });

    it('should return rotation for circular layout', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'circular');
      const cell = getNextAvailableCell(false);

      expect(cell).not.toBeNull();
      expect(cell!.rotation).toBeDefined();
    });

    it('should return rotation for editorial layout (non-hero items)', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'editorial');

      // First cell is hero (no rotation)
      const heroCell = getNextAvailableCell(false);

      // Second cell should have rotation
      const supportCell = getNextAvailableCell(false);
      expect(supportCell).not.toBeNull();
      expect(supportCell!.rotation).toBeDefined();
    });
  });

  describe('resetGrid', () => {
    it('should reset all filled cells', () => {
      initializeGrid(2, 2, mockCanvasWidth, mockCanvasHeight, 'grid');

      // Fill some cells
      getNextAvailableCell(false);
      getNextAvailableCell(false);

      // Reset and check we can get first cell again
      resetGrid();
      const cell1 = getNextAvailableCell(false);

      resetGrid();
      initializeGrid(2, 2, mockCanvasWidth, mockCanvasHeight, 'grid');
      const cell2 = getNextAvailableCell(false);

      expect(cell1!.x).toBe(cell2!.x);
      expect(cell1!.y).toBe(cell2!.y);
    });
  });

  describe('Layout-specific behavior', () => {
    it('should generate correct number of cells for grid layout', () => {
      initializeGrid(4, 3, mockCanvasWidth, mockCanvasHeight, 'grid');

      // Should have 12 cells (4 columns x 3 rows)
      const cells: any[] = [];
      for (let i = 0; i < 12; i++) {
        cells.push(getNextAvailableCell(false));
      }

      expect(cells.every(c => c !== null)).toBe(true);
    });

    it('should center items in circular layout', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'circular');

      const cells: any[] = [];
      for (let i = 0; i < 9; i++) {
        cells.push(getNextAvailableCell(false));
      }

      // All cells should be roughly equidistant from center
      const centerX = mockCanvasWidth / 2;
      const centerY = mockCanvasHeight / 2;

      const distances = cells.map(cell => {
        const dx = cell.x + cell.width / 2 - centerX;
        const dy = cell.y + cell.height / 2 - centerY;
        return Math.sqrt(dx * dx + dy * dy);
      });

      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

      // All distances should be within 20% of average (allowing for some variation)
      distances.forEach(dist => {
        expect(Math.abs(dist - avgDistance) / avgDistance).toBeLessThan(0.2);
      });
    });

    it('should make first item hero in editorial layout', () => {
      initializeGrid(3, 3, mockCanvasWidth, mockCanvasHeight, 'editorial');

      const heroCell = getNextAvailableCell(false);
      const supportCell = getNextAvailableCell(false);

      expect(heroCell).not.toBeNull();
      expect(supportCell).not.toBeNull();

      // Hero should be larger
      expect(heroCell!.width).toBeGreaterThan(supportCell!.width);
      expect(heroCell!.height).toBeGreaterThan(supportCell!.height);
    });
  });
});
