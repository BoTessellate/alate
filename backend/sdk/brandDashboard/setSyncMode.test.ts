/**
 * Unit Tests for Sync Mode Management
 *
 * Tests for setSyncMode.ts functionality:
 * - Setting sync mode (auto/manual)
 * - Getting sync mode
 * - Default behavior (manual)
 * - Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Set environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

import {
  SyncModeService,
  setSyncMode,
  getSyncMode,
  shouldAutoSync,
  type SyncMode,
  type SetSyncModeRequest,
} from './setSyncMode';

describe('SyncModeService', () => {
  let service: SyncModeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncModeService();
  });

  describe('setSyncMode', () => {
    it('should set sync mode to auto', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'auto' },
        error: null,
      });

      const request: SetSyncModeRequest = {
        brand_id: 'brand-123',
        platform: 'shopify',
        sync_mode: 'auto',
      };

      const result = await service.setSyncMode(request);

      expect(result.success).toBe(true);
      expect(result.sync_mode).toBe('auto');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should set sync mode to manual', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'manual' },
        error: null,
      });

      const request: SetSyncModeRequest = {
        brand_id: 'brand-123',
        platform: 'woocommerce',
        sync_mode: 'manual',
      };

      const result = await service.setSyncMode(request);

      expect(result.success).toBe(true);
      expect(result.sync_mode).toBe('manual');
    });

    it('should reject invalid sync mode', async () => {
      const request = {
        brand_id: 'brand-123',
        platform: 'shopify',
        sync_mode: 'invalid' as SyncMode,
      };

      const result = await service.setSyncMode(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid sync mode');
    });

    it('should insert new record if update finds no row', async () => {
      // First call (update) returns no row error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      // Second call (insert) succeeds
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'auto' },
        error: null,
      });

      const request: SetSyncModeRequest = {
        brand_id: 'new-brand',
        platform: 'shopify',
        sync_mode: 'auto',
      };

      const result = await service.setSyncMode(request);

      expect(result.success).toBe(true);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'DB_ERROR', message: 'Database error' },
      });

      const request: SetSyncModeRequest = {
        brand_id: 'brand-123',
        platform: 'shopify',
        sync_mode: 'auto',
      };

      const result = await service.setSyncMode(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSyncMode', () => {
    it('should get sync mode for all platforms', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          { platform: 'shopify', sync_mode: 'auto' },
          { platform: 'woocommerce', sync_mode: 'manual' },
        ],
        error: null,
      });

      const result = await service.getSyncMode({ brand_id: 'brand-123' });

      expect(result.success).toBe(true);
      expect(result.modes).toHaveLength(2);
      expect(result.modes[0].sync_mode).toBe('auto');
      expect(result.modes[1].sync_mode).toBe('manual');
    });

    it('should get sync mode for specific platform', async () => {
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockReturnValueOnce({
        data: [{ platform: 'shopify', sync_mode: 'auto' }],
        error: null,
      });

      const result = await service.getSyncMode({
        brand_id: 'brand-123',
        platform: 'shopify',
      });

      expect(result.success).toBe(true);
      expect(result.modes).toHaveLength(1);
    });

    it('should default to manual if sync_mode is null', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [{ platform: 'shopify', sync_mode: null }],
        error: null,
      });

      const result = await service.getSyncMode({ brand_id: 'brand-123' });

      expect(result.success).toBe(true);
      expect(result.modes[0].sync_mode).toBe('manual');
    });

    it('should return empty array if no integrations found', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const result = await service.getSyncMode({ brand_id: 'brand-123' });

      expect(result.success).toBe(true);
      expect(result.modes).toHaveLength(0);
    });
  });

  describe('shouldAutoSync', () => {
    it('should return true for auto mode with connected integration', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'auto', is_connected: true },
        error: null,
      });

      const result = await service.shouldAutoSync('brand-123', 'shopify');

      expect(result).toBe(true);
    });

    it('should return false for manual mode', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'manual', is_connected: true },
        error: null,
      });

      const result = await service.shouldAutoSync('brand-123', 'shopify');

      expect(result).toBe(false);
    });

    it('should return false for disconnected integration', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'auto', is_connected: false },
        error: null,
      });

      const result = await service.shouldAutoSync('brand-123', 'shopify');

      expect(result).toBe(false);
    });

    it('should return false if integration not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await service.shouldAutoSync('brand-123', 'shopify');

      expect(result).toBe(false);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setSyncMode convenience function should work', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { sync_mode: 'auto' },
      error: null,
    });

    const result = await setSyncMode({
      brand_id: 'brand-123',
      platform: 'shopify',
      sync_mode: 'auto',
    });

    expect(result.success).toBe(true);
  });

  it('getSyncMode convenience function should work', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [{ platform: 'shopify', sync_mode: 'manual' }],
      error: null,
    });

    const result = await getSyncMode({ brand_id: 'brand-123' });

    expect(result.success).toBe(true);
  });

  it('shouldAutoSync convenience function should work', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { sync_mode: 'auto', is_connected: true },
      error: null,
    });

    const result = await shouldAutoSync('brand-123', 'shopify');

    expect(result).toBe(true);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle all three platforms', async () => {
    const platforms = ['shopify', 'woocommerce', 'wix'] as const;

    for (const platform of platforms) {
      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_mode: 'auto' },
        error: null,
      });

      const service = new SyncModeService();
      const result = await service.setSyncMode({
        brand_id: 'brand-123',
        platform,
        sync_mode: 'auto',
      });

      expect(result.success).toBe(true);
    }
  });

  it('should toggle between auto and manual', async () => {
    const service = new SyncModeService();

    // Set to auto
    mockSupabase.single.mockResolvedValueOnce({
      data: { sync_mode: 'auto' },
      error: null,
    });

    let result = await service.setSyncMode({
      brand_id: 'brand-123',
      platform: 'shopify',
      sync_mode: 'auto',
    });
    expect(result.sync_mode).toBe('auto');

    // Set to manual
    mockSupabase.single.mockResolvedValueOnce({
      data: { sync_mode: 'manual' },
      error: null,
    });

    result = await service.setSyncMode({
      brand_id: 'brand-123',
      platform: 'shopify',
      sync_mode: 'manual',
    });
    expect(result.sync_mode).toBe('manual');
  });
});
