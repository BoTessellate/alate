import { usePendingShareStore } from '../store/pendingShareStore';

describe('pendingShareStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePendingShareStore.setState({ pendingUrl: null });
  });

  it('should initialize with null pendingUrl', () => {
    const { pendingUrl } = usePendingShareStore.getState();
    expect(pendingUrl).toBeNull();
  });

  it('should set pending URL', () => {
    const testUrl = 'https://www.asos.com/product/123';

    usePendingShareStore.getState().setPendingUrl(testUrl);

    const { pendingUrl } = usePendingShareStore.getState();
    expect(pendingUrl).toBe(testUrl);
  });

  it('should clear pending URL', () => {
    // First set a URL
    usePendingShareStore.getState().setPendingUrl('https://example.com');

    // Then clear it
    usePendingShareStore.getState().clearPendingUrl();

    const { pendingUrl } = usePendingShareStore.getState();
    expect(pendingUrl).toBeNull();
  });

  it('should overwrite existing URL when setting new one', () => {
    usePendingShareStore.getState().setPendingUrl('https://old-url.com');
    usePendingShareStore.getState().setPendingUrl('https://new-url.com');

    const { pendingUrl } = usePendingShareStore.getState();
    expect(pendingUrl).toBe('https://new-url.com');
  });
});
