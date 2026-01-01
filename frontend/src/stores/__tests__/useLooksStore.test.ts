import { renderHook, act } from '@testing-library/react';
import {
  useLooksStore,
  generateSlug,
  generateMoodboardPath,
  parseSlugId,
  generateLayerName,
  type CanvasItem,
  type Moodboard,
  type SaveStatus,
} from '../useLooksStore';

// Valid colors from LAYER_COLORS array in useLooksStore
const VALID_LAYER_COLORS = [
  'coral', 'sage', 'blush', 'amber', 'slate', 'ivory', 'olive', 'rust',
  'mauve', 'teal', 'ochre', 'plum', 'mint', 'clay', 'dusk', 'fern',
  'rose', 'moss', 'sand', 'storm', 'pearl', 'cedar', 'honey', 'ash',
];

describe('useLooksStore', () => {
  // Store initial moodboards for resetting
  const defaultMoodboards: Moodboard[] = [
    {
      id: 'mb-1',
      name: 'Living Room Refresh',
      slug: 'living-room-refresh',
      description: 'Ideas for refreshing my living room',
      items: [],
      backgroundIndex: 0,
      createdAt: '2024-12-15',
      updatedAt: '2024-12-18',
    },
    {
      id: 'mb-2',
      name: 'Bedroom Makeover',
      slug: 'bedroom-makeover',
      description: 'Cozy bedroom inspiration',
      items: [],
      backgroundIndex: 0,
      createdAt: '2024-12-10',
      updatedAt: '2024-12-17',
    },
    {
      id: 'mb-3',
      name: 'Office Space',
      slug: 'office-space',
      description: 'Modern home office setup',
      items: [],
      backgroundIndex: 0,
      createdAt: '2024-12-08',
      updatedAt: '2024-12-16',
    },
  ];

  beforeEach(() => {
    useLooksStore.setState({
      moodboards: [...defaultMoodboards],
      currentMoodboardId: null,
      saveStatus: 'saved',
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useLooksStore());

      expect(result.current.moodboards).toHaveLength(3);
      expect(result.current.currentMoodboardId).toBeNull();
      expect(result.current.saveStatus).toBe('saved');
    });

    it('should have default moodboards with correct structure', () => {
      const { result } = renderHook(() => useLooksStore());

      const firstMoodboard = result.current.moodboards[0];
      expect(firstMoodboard).toHaveProperty('id');
      expect(firstMoodboard).toHaveProperty('name');
      expect(firstMoodboard).toHaveProperty('slug');
      expect(firstMoodboard).toHaveProperty('items');
      expect(firstMoodboard).toHaveProperty('backgroundIndex');
      expect(firstMoodboard).toHaveProperty('createdAt');
      expect(firstMoodboard).toHaveProperty('updatedAt');
    });
  });

  describe('createMoodboard', () => {
    it('should create a new moodboard with given name', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('My New Moodboard');
      });

      expect(newMoodboard!.name).toBe('My New Moodboard');
      expect(result.current.moodboards).toHaveLength(4);
      expect(result.current.moodboards[0].name).toBe('My New Moodboard');
    });

    it('should create moodboard with description', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('Test Board', 'A test description');
      });

      expect(newMoodboard!.description).toBe('A test description');
    });

    it('should generate slug from name', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('My Cool Board');
      });

      expect(newMoodboard!.slug).toBe('my-cool-board');
    });

    it('should use generated layer name for empty string', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('');
      });

      // generateLayerName() creates names in format: {color}_mood
      const colorPattern = VALID_LAYER_COLORS.join('|');
      expect(newMoodboard!.name).toMatch(new RegExp(`^(${colorPattern})_mood$`));
    });

    it('should trim whitespace from name', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('  Test Name  ');
      });

      expect(newMoodboard!.name).toBe('Test Name');
    });

    it('should set currentMoodboardId to new moodboard', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('New Board');
      });

      expect(result.current.currentMoodboardId).toBe(newMoodboard!.id);
    });

    it('should generate id with timestamp pattern', () => {
      const { result } = renderHook(() => useLooksStore());

      let moodboard: Moodboard;

      act(() => {
        moodboard = result.current.createMoodboard('Board 1');
      });

      // ID should match the mb-{timestamp} pattern
      expect(moodboard!.id).toMatch(/^mb-\d+$/);

      // The timestamp should be recent (within the last second)
      const timestamp = parseInt(moodboard!.id.replace('mb-', ''), 10);
      const now = Date.now();
      expect(timestamp).toBeGreaterThan(now - 1000);
      expect(timestamp).toBeLessThanOrEqual(now);
    });

    it('should initialize with empty items array', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('Test');
      });

      expect(newMoodboard!.items).toEqual([]);
    });

    it('should initialize backgroundIndex to 0', () => {
      const { result } = renderHook(() => useLooksStore());

      let newMoodboard: Moodboard;
      act(() => {
        newMoodboard = result.current.createMoodboard('Test');
      });

      expect(newMoodboard!.backgroundIndex).toBe(0);
    });

    it('should add new moodboard at the beginning of the array', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.createMoodboard('New First');
      });

      expect(result.current.moodboards[0].name).toBe('New First');
    });
  });

  describe('updateMoodboard', () => {
    it('should update moodboard name', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.updateMoodboard('mb-1', { name: 'Updated Name' });
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.name).toBe('Updated Name');
    });

    it('should update slug when name changes', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.updateMoodboard('mb-1', { name: 'Brand New Name' });
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.slug).toBe('brand-new-name');
    });

    it('should update description', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.updateMoodboard('mb-1', { description: 'New description' });
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.description).toBe('New description');
    });

    it('should update updatedAt timestamp', () => {
      const { result } = renderHook(() => useLooksStore());
      const originalUpdatedAt = result.current.moodboards.find((m) => m.id === 'mb-1')?.updatedAt;

      act(() => {
        result.current.updateMoodboard('mb-1', { name: 'Test' });
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should not affect other moodboards', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.updateMoodboard('mb-1', { name: 'Changed' });
      });

      const mb2 = result.current.moodboards.find((m) => m.id === 'mb-2');
      expect(mb2?.name).toBe('Bedroom Makeover');
    });

    it('should preserve slug when name is not updated', () => {
      const { result } = renderHook(() => useLooksStore());
      const originalSlug = result.current.moodboards.find((m) => m.id === 'mb-1')?.slug;

      act(() => {
        result.current.updateMoodboard('mb-1', { description: 'Just updating description' });
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.slug).toBe(originalSlug);
    });
  });

  describe('deleteMoodboard', () => {
    it('should delete moodboard by id', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.deleteMoodboard('mb-1');
      });

      expect(result.current.moodboards).toHaveLength(2);
      expect(result.current.moodboards.find((m) => m.id === 'mb-1')).toBeUndefined();
    });

    it('should clear currentMoodboardId if deleted moodboard is current', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setCurrentMoodboard('mb-1');
      });

      act(() => {
        result.current.deleteMoodboard('mb-1');
      });

      expect(result.current.currentMoodboardId).toBeNull();
    });

    it('should preserve currentMoodboardId if different moodboard is deleted', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setCurrentMoodboard('mb-2');
      });

      act(() => {
        result.current.deleteMoodboard('mb-1');
      });

      expect(result.current.currentMoodboardId).toBe('mb-2');
    });

    it('should handle deleting non-existent id gracefully', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.deleteMoodboard('non-existent');
      });

      expect(result.current.moodboards).toHaveLength(3);
    });
  });

  describe('getMoodboardBySlug', () => {
    it('should return moodboard by slug-id format', () => {
      const { result } = renderHook(() => useLooksStore());

      const moodboard = result.current.getMoodboardBySlug('living-room-refresh--mb-1');

      expect(moodboard?.id).toBe('mb-1');
      expect(moodboard?.name).toBe('Living Room Refresh');
    });

    it('should return undefined for invalid slug format', () => {
      const { result } = renderHook(() => useLooksStore());

      const moodboard = result.current.getMoodboardBySlug('invalid-slug-no-id');

      expect(moodboard).toBeUndefined();
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useLooksStore());

      const moodboard = result.current.getMoodboardBySlug('some-slug--non-existent');

      expect(moodboard).toBeUndefined();
    });
  });

  describe('getMoodboardById', () => {
    it('should return moodboard by id', () => {
      const { result } = renderHook(() => useLooksStore());

      const moodboard = result.current.getMoodboardById('mb-2');

      expect(moodboard?.name).toBe('Bedroom Makeover');
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useLooksStore());

      const moodboard = result.current.getMoodboardById('non-existent');

      expect(moodboard).toBeUndefined();
    });
  });

  describe('setCurrentMoodboard', () => {
    it('should set current moodboard id', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setCurrentMoodboard('mb-2');
      });

      expect(result.current.currentMoodboardId).toBe('mb-2');
    });

    it('should clear current moodboard with null', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setCurrentMoodboard('mb-1');
      });

      act(() => {
        result.current.setCurrentMoodboard(null);
      });

      expect(result.current.currentMoodboardId).toBeNull();
    });
  });

  describe('updateMoodboardItems', () => {
    it('should update moodboard items', () => {
      const { result } = renderHook(() => useLooksStore());

      const newItems: CanvasItem[] = [
        {
          id: 'item-1',
          type: 'image',
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          rotation: 0,
          zIndex: 1,
          content: 'test-image.jpg',
          src: 'http://example.com/image.jpg',
        },
      ];

      act(() => {
        result.current.updateMoodboardItems('mb-1', newItems);
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.items).toEqual(newItems);
    });

    it('should update updatedAt when items change', () => {
      const { result } = renderHook(() => useLooksStore());
      const originalUpdatedAt = result.current.moodboards.find((m) => m.id === 'mb-1')?.updatedAt;

      act(() => {
        result.current.updateMoodboardItems('mb-1', []);
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should not affect other moodboards', () => {
      const { result } = renderHook(() => useLooksStore());

      const newItems: CanvasItem[] = [
        {
          id: 'item-1',
          type: 'text',
          x: 50,
          y: 50,
          width: 100,
          height: 50,
          rotation: 0,
          zIndex: 1,
          content: 'Hello',
          text: 'Hello',
        },
      ];

      act(() => {
        result.current.updateMoodboardItems('mb-1', newItems);
      });

      const mb2 = result.current.moodboards.find((m) => m.id === 'mb-2');
      expect(mb2?.items).toEqual([]);
    });
  });

  describe('setMoodboardBackground', () => {
    it('should update background index', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setMoodboardBackground('mb-1', 3);
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.backgroundIndex).toBe(3);
    });

    it('should update updatedAt when background changes', () => {
      const { result } = renderHook(() => useLooksStore());
      const originalUpdatedAt = result.current.moodboards.find((m) => m.id === 'mb-1')?.updatedAt;

      act(() => {
        result.current.setMoodboardBackground('mb-1', 2);
      });

      const moodboard = result.current.moodboards.find((m) => m.id === 'mb-1');
      expect(moodboard?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('setSaveStatus', () => {
    it('should set save status to saving', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setSaveStatus('saving');
      });

      expect(result.current.saveStatus).toBe('saving');
    });

    it('should set save status to unsaved', () => {
      const { result } = renderHook(() => useLooksStore());

      act(() => {
        result.current.setSaveStatus('unsaved');
      });

      expect(result.current.saveStatus).toBe('unsaved');
    });

    it('should accept all valid save status values', () => {
      const { result } = renderHook(() => useLooksStore());
      const statuses: SaveStatus[] = ['saved', 'saving', 'unsaved'];

      statuses.forEach((status) => {
        act(() => {
          result.current.setSaveStatus(status);
        });
        expect(result.current.saveStatus).toBe(status);
      });
    });
  });
});

/**
 * Helper Functions Tests
 *
 * NOTE: Test failures should NOT be fixed just to make them pass.
 * Each test must be logically and functionally correct, reflecting
 * the actual intended behavior of the code. If a test fails, verify
 * whether the implementation or the test expectation needs updating.
 */
describe('Helper Functions', () => {
  describe('generateLayerName', () => {
    it('should generate name in {color}_mood format', () => {
      const name = generateLayerName();
      const colorPattern = VALID_LAYER_COLORS.join('|');
      expect(name).toMatch(new RegExp(`^(${colorPattern})_mood$`));
    });

    it('should return a string', () => {
      expect(typeof generateLayerName()).toBe('string');
    });

    it('should generate names from valid color list', () => {
      // Run multiple times to test randomness stays within bounds
      for (let i = 0; i < 20; i++) {
        const name = generateLayerName();
        const [color] = name.split('_');
        expect(VALID_LAYER_COLORS).toContain(color);
      }
    });
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase', () => {
      expect(generateSlug('My Board')).toBe('my-board');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('my cool board')).toBe('my-cool-board');
    });

    it('should remove special characters', () => {
      expect(generateSlug("My Board's Name!")).toBe('my-boards-name');
    });

    it('should replace multiple hyphens with single hyphen', () => {
      expect(generateSlug('my---board')).toBe('my-board');
    });

    it('should trim whitespace', () => {
      expect(generateSlug('  my board  ')).toBe('my-board');
    });

    it('should limit length to 50 characters', () => {
      const longName = 'a'.repeat(100);
      expect(generateSlug(longName).length).toBe(50);
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });

    it('should handle string with only special characters', () => {
      expect(generateSlug('!@#$%')).toBe('');
    });

    it('should handle mixed case and special characters', () => {
      expect(generateSlug('My COOL Board #1!')).toBe('my-cool-board-1');
    });
  });

  describe('generateMoodboardPath', () => {
    it('should generate slug--id format', () => {
      expect(generateMoodboardPath('My Board', 'mb-123')).toBe('my-board--mb-123');
    });

    it('should use double hyphen as separator', () => {
      const path = generateMoodboardPath('Test', 'id-with-hyphen');
      expect(path).toBe('test--id-with-hyphen');
    });
  });

  describe('parseSlugId', () => {
    it('should parse valid slug--id format', () => {
      const result = parseSlugId('my-board--mb-123');

      expect(result).toEqual({
        slug: 'my-board',
        id: 'mb-123',
      });
    });

    it('should return null for invalid format without separator', () => {
      expect(parseSlugId('invalid-slug-no-id')).toBeNull();
    });

    it('should handle IDs with hyphens', () => {
      const result = parseSlugId('my-board--id-with-hyphens');

      expect(result).toEqual({
        slug: 'my-board',
        id: 'id-with-hyphens',
      });
    });

    it('should handle slug with multiple hyphens', () => {
      const result = parseSlugId('my-cool-board-name--mb-1');

      expect(result).toEqual({
        slug: 'my-cool-board-name',
        id: 'mb-1',
      });
    });

    it('should use last double-hyphen as separator', () => {
      const result = parseSlugId('some--thing--mb-final');

      expect(result).toEqual({
        slug: 'some--thing',
        id: 'mb-final',
      });
    });

    it('should handle empty string', () => {
      expect(parseSlugId('')).toBeNull();
    });
  });
});

describe('CanvasItem Types', () => {
  it('should support image type canvas item', () => {
    const imageItem: CanvasItem = {
      id: 'item-1',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 1,
      content: 'image.jpg',
      src: 'http://example.com/image.jpg',
      alt: 'Test image',
      productName: 'Product',
      productBrand: 'Brand',
      productPrice: 99.99,
      productCurrency: 'USD',
    };

    expect(imageItem.type).toBe('image');
    expect(imageItem.src).toBeDefined();
  });

  it('should support text type canvas item', () => {
    const textItem: CanvasItem = {
      id: 'item-2',
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      rotation: 0,
      zIndex: 1,
      content: 'Hello World',
      text: 'Hello World',
      fontSize: 16,
      fontWeight: 'bold',
    };

    expect(textItem.type).toBe('text');
    expect(textItem.text).toBe('Hello World');
    expect(textItem.fontSize).toBe(16);
  });
});
