/**
 * useCollectionsStore Tests
 *
 * NOTE: Test failures should NOT be fixed just to make them pass.
 * Each test must be logically and functionally correct, reflecting
 * the actual intended behavior of the code. If a test fails, verify
 * whether the implementation or the test expectation needs updating.
 */
import { renderHook, act } from '@testing-library/react';
import { useCollectionsStore } from '../useCollectionsStore';
import type { Collection, Product, CollectionMetadata } from '@/types';

// Mock product factory
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: `product-${Date.now()}-${Math.random()}`,
  product_name: 'Test Product',
  brand: 'Test Brand',
  price: 99.99,
  currency: 'USD',
  image_url: 'http://example.com/image.jpg',
  tags: ['modern', 'minimal'],
  color_palette: ['#ffffff', '#000000'],
  category: 'furniture',
  material: 'wood',
  texture: 'smooth',
  tone: 'warm',
  ...overrides,
});

describe('useCollectionsStore', () => {
  beforeEach(() => {
    // Reset store state to empty collections
    useCollectionsStore.setState({
      collections: [],
    });
  });

  describe('Initial State', () => {
    it('should have empty collections array', () => {
      const { result } = renderHook(() => useCollectionsStore());

      expect(result.current.collections).toEqual([]);
    });
  });

  describe('createCollection', () => {
    it('should create a new collection with given name', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('My Collection');
      });

      expect(newCollection!.name).toBe('My Collection');
      expect(result.current.collections).toHaveLength(1);
    });

    it('should create collection with description', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('Test Collection', 'A test description');
      });

      expect(newCollection!.description).toBe('A test description');
    });

    it('should use default name for empty string', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('');
      });

      expect(newCollection!.name).toBe('Untitled Collection');
    });

    it('should trim whitespace from name', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('  My Collection  ');
      });

      expect(newCollection!.name).toBe('My Collection');
    });

    it('should generate unique id with timestamp', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection1: Collection;
      let collection2: Collection;

      // Mock Date.now() to return incrementing values for unique IDs
      const originalDateNow = Date.now;
      let mockTime = 1700000000000;
      Date.now = jest.fn(() => mockTime++);

      try {
        act(() => {
          collection1 = result.current.createCollection('Collection 1');
        });
        act(() => {
          collection2 = result.current.createCollection('Collection 2');
        });

        expect(collection1!.id).not.toBe(collection2!.id);
        expect(collection1!.id).toMatch(/^col-\d+$/);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should initialize with empty products and coverImages arrays', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('Test');
      });

      expect(newCollection!.products).toEqual([]);
      expect(newCollection!.coverImages).toEqual([]);
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let newCollection: Collection;
      act(() => {
        newCollection = result.current.createCollection('Test');
      });

      expect(newCollection!.createdAt).toBeDefined();
      expect(newCollection!.updatedAt).toBeDefined();
      // Should be ISO format
      expect(new Date(newCollection!.createdAt).toISOString()).toBe(newCollection!.createdAt);
    });

    it('should add new collection at the beginning of the array', () => {
      const { result } = renderHook(() => useCollectionsStore());

      act(() => {
        result.current.createCollection('First');
      });
      act(() => {
        result.current.createCollection('Second');
      });

      expect(result.current.collections[0].name).toBe('Second');
      expect(result.current.collections[1].name).toBe('First');
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection by id', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('To Delete');
      });

      act(() => {
        result.current.deleteCollection(collection!.id);
      });

      expect(result.current.collections).toHaveLength(0);
    });

    it('should only delete specified collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with collections that have known, different IDs
      const col1Id = 'test-col-1';
      const col2Id = 'test-col-2';

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: col1Id,
              name: 'Collection 1',
              products: [],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: col2Id,
              name: 'Collection 2',
              products: [],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      });

      act(() => {
        result.current.deleteCollection(col1Id);
      });

      expect(result.current.collections).toHaveLength(1);
      expect(result.current.collections[0].id).toBe(col2Id);
    });

    it('should handle deleting non-existent id gracefully', () => {
      const { result } = renderHook(() => useCollectionsStore());

      act(() => {
        result.current.createCollection('Existing');
      });

      act(() => {
        result.current.deleteCollection('non-existent');
      });

      expect(result.current.collections).toHaveLength(1);
    });
  });

  describe('renameCollection', () => {
    it('should rename collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Original Name');
      });

      act(() => {
        result.current.renameCollection(collection!.id, 'New Name');
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should update updatedAt timestamp', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with a collection that has an old timestamp
      const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
      const colId = 'test-timestamp-col';

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: colId,
              name: 'Original',
              products: [],
              coverImages: [],
              createdAt: originalUpdatedAt,
              updatedAt: originalUpdatedAt,
            },
          ],
        });
      });

      act(() => {
        result.current.renameCollection(colId, 'Renamed');
      });

      const updated = result.current.collections.find((c) => c.id === colId);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should not affect other collections', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with collections that have known, different IDs
      const col1Id = 'test-rename-col-1';
      const col2Id = 'test-rename-col-2';

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: col1Id,
              name: 'Collection 1',
              products: [],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: col2Id,
              name: 'Collection 2',
              products: [],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      });

      act(() => {
        result.current.renameCollection(col1Id, 'Renamed');
      });

      const unchanged = result.current.collections.find((c) => c.id === col2Id);
      expect(unchanged?.name).toBe('Collection 2');
    });
  });

  describe('updateCollectionDescription', () => {
    it('should update description', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test', 'Original description');
      });

      act(() => {
        result.current.updateCollectionDescription(collection!.id, 'Updated description');
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.description).toBe('Updated description');
    });

    it('should update updatedAt timestamp', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with a collection that has an old timestamp
      const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
      const colId = 'test-desc-col';

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: colId,
              name: 'Test',
              products: [],
              coverImages: [],
              createdAt: originalUpdatedAt,
              updatedAt: originalUpdatedAt,
            },
          ],
        });
      });

      act(() => {
        result.current.updateCollectionDescription(colId, 'New description');
      });

      const updated = result.current.collections.find((c) => c.id === colId);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('addProductToCollection', () => {
    it('should add product to collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.products).toHaveLength(1);
      expect(updated?.products[0].id).toBe('product-1');
    });

    it('should not add duplicate product', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });
      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.products).toHaveLength(1);
    });

    it('should update coverImages with product images (max 4)', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const products = [
        createMockProduct({ id: 'p1', image_url: 'http://example.com/1.jpg' }),
        createMockProduct({ id: 'p2', image_url: 'http://example.com/2.jpg' }),
        createMockProduct({ id: 'p3', image_url: 'http://example.com/3.jpg' }),
        createMockProduct({ id: 'p4', image_url: 'http://example.com/4.jpg' }),
        createMockProduct({ id: 'p5', image_url: 'http://example.com/5.jpg' }),
      ];

      products.forEach((product) => {
        act(() => {
          result.current.addProductToCollection(collection!.id, product);
        });
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.coverImages).toHaveLength(4);
      expect(updated?.coverImages).toEqual([
        'http://example.com/1.jpg',
        'http://example.com/2.jpg',
        'http://example.com/3.jpg',
        'http://example.com/4.jpg',
      ]);
    });

    it('should update updatedAt timestamp', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with a collection that has an old timestamp
      const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
      const colId = 'test-add-timestamp-col';

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: colId,
              name: 'Test',
              products: [],
              coverImages: [],
              createdAt: originalUpdatedAt,
              updatedAt: originalUpdatedAt,
            },
          ],
        });
      });

      const product = createMockProduct();

      act(() => {
        result.current.addProductToCollection(colId, product);
      });

      const updated = result.current.collections.find((c) => c.id === colId);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should filter out falsy image URLs from coverImages', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'p1', image_url: '' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.coverImages).toEqual([]);
    });
  });

  describe('removeProductFromCollection', () => {
    it('should remove product from collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });
      act(() => {
        result.current.removeProductFromCollection(collection!.id, 'product-1');
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.products).toHaveLength(0);
    });

    it('should update coverImages after removal', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product1 = createMockProduct({ id: 'p1', image_url: 'http://example.com/1.jpg' });
      const product2 = createMockProduct({ id: 'p2', image_url: 'http://example.com/2.jpg' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product1);
        result.current.addProductToCollection(collection!.id, product2);
      });
      act(() => {
        result.current.removeProductFromCollection(collection!.id, 'p1');
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.coverImages).toEqual(['http://example.com/2.jpg']);
    });

    it('should update updatedAt timestamp', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with a collection that has an old timestamp and a product
      const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
      const colId = 'test-remove-timestamp-col';
      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: colId,
              name: 'Test',
              products: [product],
              coverImages: [],
              createdAt: originalUpdatedAt,
              updatedAt: originalUpdatedAt,
            },
          ],
        });
      });

      act(() => {
        result.current.removeProductFromCollection(colId, 'product-1');
      });

      const updated = result.current.collections.find((c) => c.id === colId);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should handle removing non-existent product gracefully', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });
      act(() => {
        result.current.removeProductFromCollection(collection!.id, 'non-existent');
      });

      const updated = result.current.collections.find((c) => c.id === collection!.id);
      expect(updated?.products).toHaveLength(1);
    });
  });

  describe('getCollectionById', () => {
    it('should return collection by id', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test Collection');
      });

      const found = result.current.getCollectionById(collection!.id);
      expect(found?.name).toBe('Test Collection');
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useCollectionsStore());

      const found = result.current.getCollectionById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getCollectionMetadata', () => {
    it('should return metadata for collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({
        tags: ['modern', 'chic'],
        color_palette: ['#fff', '#000'],
        material: 'leather',
        texture: 'smooth',
        tone: 'cool',
        category: 'accessories',
      });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      const metadata = result.current.getCollectionMetadata(collection!.id);
      expect(metadata?.tags).toContain('modern');
      expect(metadata?.tags).toContain('chic');
      expect(metadata?.colors).toContain('#fff');
      expect(metadata?.materials).toContain('leather');
      expect(metadata?.textures).toContain('smooth');
      expect(metadata?.tones).toContain('cool');
      expect(metadata?.categories).toContain('accessories');
    });

    it('should return null for non-existent collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      const metadata = result.current.getCollectionMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('getAggregatedMetadata', () => {
    it('should aggregate metadata from multiple collections', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection1: Collection;
      let collection2: Collection;

      act(() => {
        collection1 = result.current.createCollection('Collection 1');
        collection2 = result.current.createCollection('Collection 2');
      });

      const product1 = createMockProduct({
        tags: ['modern'],
        color_palette: ['#fff'],
        material: 'wood',
      });

      const product2 = createMockProduct({
        tags: ['vintage'],
        color_palette: ['#000'],
        material: 'metal',
      });

      act(() => {
        result.current.addProductToCollection(collection1!.id, product1);
        result.current.addProductToCollection(collection2!.id, product2);
      });

      const metadata = result.current.getAggregatedMetadata([collection1!.id, collection2!.id]);

      expect(metadata.tags).toContain('modern');
      expect(metadata.tags).toContain('vintage');
      expect(metadata.colors).toContain('#fff');
      expect(metadata.colors).toContain('#000');
      expect(metadata.materials).toContain('wood');
      expect(metadata.materials).toContain('metal');
    });

    it('should deduplicate values', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection1: Collection;
      let collection2: Collection;

      act(() => {
        collection1 = result.current.createCollection('Collection 1');
        collection2 = result.current.createCollection('Collection 2');
      });

      const product1 = createMockProduct({ tags: ['modern', 'minimal'] });
      const product2 = createMockProduct({ tags: ['modern', 'rustic'] });

      act(() => {
        result.current.addProductToCollection(collection1!.id, product1);
        result.current.addProductToCollection(collection2!.id, product2);
      });

      const metadata = result.current.getAggregatedMetadata([collection1!.id, collection2!.id]);

      const modernCount = metadata.tags.filter((t) => t === 'modern').length;
      expect(modernCount).toBe(1);
    });

    it('should handle empty collection ids array', () => {
      const { result } = renderHook(() => useCollectionsStore());

      const metadata = result.current.getAggregatedMetadata([]);

      expect(metadata.tags).toEqual([]);
      expect(metadata.colors).toEqual([]);
      expect(metadata.materials).toEqual([]);
      expect(metadata.textures).toEqual([]);
      expect(metadata.tones).toEqual([]);
      expect(metadata.categories).toEqual([]);
    });

    it('should filter out undefined/null values', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({
        material: undefined,
        texture: undefined,
        tone: undefined,
      });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      const metadata = result.current.getAggregatedMetadata([collection!.id]);

      expect(metadata.materials).toEqual([]);
      expect(metadata.textures).toEqual([]);
      expect(metadata.tones).toEqual([]);
    });
  });

  describe('isProductInCollection', () => {
    it('should return true if product is in collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      const product = createMockProduct({ id: 'product-1' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product);
      });

      expect(result.current.isProductInCollection(collection!.id, 'product-1')).toBe(true);
    });

    it('should return false if product is not in collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Test');
      });

      expect(result.current.isProductInCollection(collection!.id, 'product-1')).toBe(false);
    });

    it('should return false for non-existent collection', () => {
      const { result } = renderHook(() => useCollectionsStore());

      expect(result.current.isProductInCollection('non-existent', 'product-1')).toBe(false);
    });
  });

  describe('isProductInAnyCollection', () => {
    it('should return array of collection ids containing product', () => {
      const { result } = renderHook(() => useCollectionsStore());

      // Pre-populate with collections that have known, different IDs
      const col1Id = 'test-any-col-1';
      const col2Id = 'test-any-col-2';
      const col3Id = 'test-any-col-3';

      const product = createMockProduct({ id: 'shared-product' });

      act(() => {
        useCollectionsStore.setState({
          collections: [
            {
              id: col1Id,
              name: 'Collection 1',
              products: [product],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: col2Id,
              name: 'Collection 2',
              products: [product],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: col3Id,
              name: 'Collection 3',
              products: [],
              coverImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      });

      const collectionIds = result.current.isProductInAnyCollection('shared-product');

      expect(collectionIds).toContain(col1Id);
      expect(collectionIds).toContain(col2Id);
      expect(collectionIds).not.toContain(col3Id);
      expect(collectionIds).toHaveLength(2);
    });

    it('should return empty array if product is in no collections', () => {
      const { result } = renderHook(() => useCollectionsStore());

      act(() => {
        result.current.createCollection('Empty Collection');
      });

      const collectionIds = result.current.isProductInAnyCollection('non-existent-product');
      expect(collectionIds).toEqual([]);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      const { result } = renderHook(() => useCollectionsStore());

      let collection: Collection;
      act(() => {
        collection = result.current.createCollection('Persistent Collection', 'Test');
      });

      const product1 = createMockProduct({ id: 'p1' });
      const product2 = createMockProduct({ id: 'p2' });

      act(() => {
        result.current.addProductToCollection(collection!.id, product1);
        result.current.addProductToCollection(collection!.id, product2);
        result.current.renameCollection(collection!.id, 'Renamed Collection');
      });

      const updated = result.current.getCollectionById(collection!.id);
      expect(updated?.name).toBe('Renamed Collection');
      expect(updated?.products).toHaveLength(2);
      expect(updated?.description).toBe('Test');
    });
  });
});
