import { renderHook, act } from '@testing-library/react';
import { useUploadStore, UploadStatus, ProductType } from '../useUploadStore';
import type { Product } from '@/types';

// Mock URL methods
const mockCreateObjectURL = jest.fn(() => 'blob:http://localhost/mock-url');
const mockRevokeObjectURL = jest.fn();

beforeAll(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Helper to create mock File
const createMockFile = (name: string = 'test.jpg', type: string = 'image/jpeg'): File => {
  return new File(['test content'], name, { type });
};

describe('useUploadStore', () => {
  beforeEach(() => {
    // Reset store state
    useUploadStore.setState({
      isModalOpen: false,
      status: 'idle',
      progress: 0,
      error: null,
      selectedFile: null,
      previewUrl: null,
      productType: 'fashion',
      productData: null,
      selectedCollections: [],
    });
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useUploadStore());

      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.status).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.productType).toBe('fashion');
      expect(result.current.productData).toBeNull();
      expect(result.current.selectedCollections).toEqual([]);
    });
  });

  describe('Modal State', () => {
    it('should open modal', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isModalOpen).toBe(true);
    });

    it('should close modal and reset state', () => {
      const { result } = renderHook(() => useUploadStore());

      // Set up some state
      act(() => {
        result.current.openModal();
        result.current.setStatus('uploading');
        result.current.setProgress(50);
        result.current.setError('Test error');
      });

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.status).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should revoke preview URL when closing modal', () => {
      const { result } = renderHook(() => useUploadStore());
      const mockFile = createMockFile();

      act(() => {
        result.current.openModal();
        result.current.setFile(mockFile);
      });

      act(() => {
        result.current.closeModal();
      });

      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('File Management', () => {
    it('should set file and create preview URL', () => {
      const { result } = renderHook(() => useUploadStore());
      const mockFile = createMockFile();

      act(() => {
        result.current.setFile(mockFile);
      });

      expect(result.current.selectedFile).toBe(mockFile);
      expect(result.current.previewUrl).toBe('blob:http://localhost/mock-url');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockFile);
    });

    it('should clear error when setting file', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setError('Previous error');
      });

      const mockFile = createMockFile();
      act(() => {
        result.current.setFile(mockFile);
      });

      expect(result.current.error).toBeNull();
    });

    it('should revoke previous preview URL when setting new file', () => {
      const { result } = renderHook(() => useUploadStore());

      const file1 = createMockFile('file1.jpg');
      const file2 = createMockFile('file2.jpg');

      act(() => {
        result.current.setFile(file1);
      });

      act(() => {
        result.current.setFile(file2);
      });

      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should clear file and preview when setting null', () => {
      const { result } = renderHook(() => useUploadStore());
      const mockFile = createMockFile();

      act(() => {
        result.current.setFile(mockFile);
      });

      act(() => {
        result.current.setFile(null);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
    });
  });

  describe('Product Type', () => {
    it('should set product type to fashion', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductType('fashion');
      });

      expect(result.current.productType).toBe('fashion');
    });

    it('should set product type to home', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductType('home');
      });

      expect(result.current.productType).toBe('home');
    });

    it('should accept all valid product types', () => {
      const { result } = renderHook(() => useUploadStore());
      const types: ProductType[] = ['fashion', 'home'];

      types.forEach((type) => {
        act(() => {
          result.current.setProductType(type);
        });
        expect(result.current.productType).toBe(type);
      });
    });
  });

  describe('Upload Status', () => {
    it('should set status to uploading', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('uploading');
      });

      expect(result.current.status).toBe('uploading');
    });

    it('should set status to processing', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('processing');
      });

      expect(result.current.status).toBe('processing');
    });

    it('should set status to editing', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('editing');
      });

      expect(result.current.status).toBe('editing');
    });

    it('should set status to saving', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('saving');
      });

      expect(result.current.status).toBe('saving');
    });

    it('should set status to success', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('success');
      });

      expect(result.current.status).toBe('success');
    });

    it('should set status to error', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('error');
      });

      expect(result.current.status).toBe('error');
    });

    it('should accept all valid upload statuses', () => {
      const { result } = renderHook(() => useUploadStore());
      const statuses: UploadStatus[] = ['idle', 'uploading', 'processing', 'editing', 'saving', 'success', 'error'];

      statuses.forEach((status) => {
        act(() => {
          result.current.setStatus(status);
        });
        expect(result.current.status).toBe(status);
      });
    });
  });

  describe('Progress', () => {
    it('should set progress to 0', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProgress(0);
      });

      expect(result.current.progress).toBe(0);
    });

    it('should set progress to 50', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProgress(50);
      });

      expect(result.current.progress).toBe(50);
    });

    it('should set progress to 100', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProgress(100);
      });

      expect(result.current.progress).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setError('Upload failed');
      });

      expect(result.current.error).toBe('Upload failed');
    });

    it('should set status to error when setting error message', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('uploading');
      });

      act(() => {
        result.current.setError('Something went wrong');
      });

      expect(result.current.status).toBe('error');
    });

    it('should preserve status when clearing error', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setStatus('uploading');
        result.current.setError('Error');
      });

      act(() => {
        result.current.setError(null);
      });

      // Status should remain 'error' because setError(null) preserves current status
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeNull();
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setError('Initial error');
      });

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Product Data', () => {
    it('should set product data', () => {
      const { result } = renderHook(() => useUploadStore());

      const productData: Partial<Product> = {
        product_name: 'Test Product',
        brand: 'Test Brand',
        price: 99.99,
      };

      act(() => {
        result.current.setProductData(productData);
      });

      expect(result.current.productData).toEqual(productData);
    });

    it('should clear product data with null', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductData({ product_name: 'Test' });
      });

      act(() => {
        result.current.setProductData(null);
      });

      expect(result.current.productData).toBeNull();
    });

    it('should update individual product field', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductData({ product_name: 'Initial' });
      });

      act(() => {
        result.current.updateProductField('product_name', 'Updated');
      });

      expect(result.current.productData?.product_name).toBe('Updated');
    });

    it('should preserve other fields when updating single field', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductData({
          product_name: 'Test',
          brand: 'Brand',
          price: 100,
        });
      });

      act(() => {
        result.current.updateProductField('price', 200);
      });

      expect(result.current.productData?.product_name).toBe('Test');
      expect(result.current.productData?.brand).toBe('Brand');
      expect(result.current.productData?.price).toBe(200);
    });

    it('should update tags array', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductData({ tags: ['initial'] });
      });

      act(() => {
        result.current.updateProductField('tags', ['new', 'tags']);
      });

      expect(result.current.productData?.tags).toEqual(['new', 'tags']);
    });

    it('should update color_palette array', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setProductData({ color_palette: ['#fff'] });
      });

      act(() => {
        result.current.updateProductField('color_palette', ['#000', '#fff', '#f00']);
      });

      expect(result.current.productData?.color_palette).toEqual(['#000', '#fff', '#f00']);
    });
  });

  describe('Collection Selection', () => {
    it('should toggle collection on', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.toggleCollection('col-1');
      });

      expect(result.current.selectedCollections).toContain('col-1');
    });

    it('should toggle collection off', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.toggleCollection('col-1');
      });

      act(() => {
        result.current.toggleCollection('col-1');
      });

      expect(result.current.selectedCollections).not.toContain('col-1');
    });

    it('should handle multiple collections', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.toggleCollection('col-1');
        result.current.toggleCollection('col-2');
        result.current.toggleCollection('col-3');
      });

      expect(result.current.selectedCollections).toHaveLength(3);
      expect(result.current.selectedCollections).toContain('col-1');
      expect(result.current.selectedCollections).toContain('col-2');
      expect(result.current.selectedCollections).toContain('col-3');
    });

    it('should set selected collections directly', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.setSelectedCollections(['col-1', 'col-2']);
      });

      expect(result.current.selectedCollections).toEqual(['col-1', 'col-2']);
    });

    it('should clear selected collections with empty array', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.toggleCollection('col-1');
        result.current.toggleCollection('col-2');
      });

      act(() => {
        result.current.setSelectedCollections([]);
      });

      expect(result.current.selectedCollections).toEqual([]);
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useUploadStore());

      // Set various state
      act(() => {
        result.current.openModal();
        result.current.setStatus('uploading');
        result.current.setProgress(75);
        result.current.setError('Error');
        result.current.setProductType('home');
        result.current.setProductData({ product_name: 'Test' });
        result.current.setSelectedCollections(['col-1', 'col-2']);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.status).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.productType).toBe('fashion');
      expect(result.current.productData).toBeNull();
      expect(result.current.selectedCollections).toEqual([]);
    });

    it('should revoke preview URL on reset', () => {
      const { result } = renderHook(() => useUploadStore());
      const mockFile = createMockFile();

      act(() => {
        result.current.setFile(mockFile);
      });

      mockRevokeObjectURL.mockClear();

      act(() => {
        result.current.reset();
      });

      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should not call revokeObjectURL if no preview URL exists', () => {
      const { result } = renderHook(() => useUploadStore());

      mockRevokeObjectURL.mockClear();

      act(() => {
        result.current.reset();
      });

      expect(mockRevokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('Upload Flow Simulation', () => {
    it('should handle complete upload flow', () => {
      const { result } = renderHook(() => useUploadStore());

      // 1. Open modal
      act(() => {
        result.current.openModal();
      });
      expect(result.current.isModalOpen).toBe(true);

      // 2. Select file
      const mockFile = createMockFile();
      act(() => {
        result.current.setFile(mockFile);
      });
      expect(result.current.selectedFile).toBe(mockFile);

      // 3. Set product type
      act(() => {
        result.current.setProductType('home');
      });
      expect(result.current.productType).toBe('home');

      // 4. Start upload
      act(() => {
        result.current.setStatus('uploading');
        result.current.setProgress(0);
      });
      expect(result.current.status).toBe('uploading');

      // 5. Update progress
      act(() => {
        result.current.setProgress(50);
      });
      expect(result.current.progress).toBe(50);

      act(() => {
        result.current.setProgress(100);
      });
      expect(result.current.progress).toBe(100);

      // 6. Processing
      act(() => {
        result.current.setStatus('processing');
      });
      expect(result.current.status).toBe('processing');

      // 7. Receive product data from AI
      act(() => {
        result.current.setProductData({
          product_name: 'AI Generated Name',
          brand: 'Unknown',
          tags: ['modern', 'minimal'],
          color_palette: ['#fff', '#000'],
        });
        result.current.setStatus('editing');
      });
      expect(result.current.productData?.product_name).toBe('AI Generated Name');
      expect(result.current.status).toBe('editing');

      // 8. User edits product data
      act(() => {
        result.current.updateProductField('brand', 'User Brand');
      });
      expect(result.current.productData?.brand).toBe('User Brand');

      // 9. Select collections
      act(() => {
        result.current.toggleCollection('col-1');
      });
      expect(result.current.selectedCollections).toContain('col-1');

      // 10. Save
      act(() => {
        result.current.setStatus('saving');
      });
      expect(result.current.status).toBe('saving');

      // 11. Success
      act(() => {
        result.current.setStatus('success');
      });
      expect(result.current.status).toBe('success');

      // 12. Close modal (resets state)
      act(() => {
        result.current.closeModal();
      });
      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.status).toBe('idle');
    });

    it('should handle upload error flow', () => {
      const { result } = renderHook(() => useUploadStore());

      act(() => {
        result.current.openModal();
        result.current.setFile(createMockFile());
        result.current.setStatus('uploading');
        result.current.setProgress(30);
      });

      // Simulate error
      act(() => {
        result.current.setError('Network error: Upload failed');
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error: Upload failed');

      // User can retry by setting file again
      act(() => {
        result.current.setFile(createMockFile('retry.jpg'));
      });

      expect(result.current.error).toBeNull();
    });
  });
});
